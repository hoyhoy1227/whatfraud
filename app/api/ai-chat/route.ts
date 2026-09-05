import { buildSystemPrompt, inferDialogueEmotion, inferDialogueReplyMode, sanitizePlayerText, validateAiReply, type AiChatMessage } from '../../ai-dialogue';
import { cases } from '../../game-data';

const GEMINI_MODEL = 'gemini-3.5-flash-lite';
const GEMINI_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;
const PROVIDER_TIMEOUT_MS = 8_000;
const SESSION_MINUTE_LIMIT = 5;
const SESSION_DAY_LIMIT = 30;
const IP_MINUTE_LIMIT = 10;
const IP_DAY_LIMIT = 120;

type RateBucket = { minute: number[]; day: number[] };
const rateBuckets = new Map<string, RateBucket>();
let providerPausedUntil = 0;

async function readBoundedBody(request: Request) {
  const reader = request.body?.getReader();
  if (!reader) throw new Error('empty body');
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 12_000) {
        await reader.cancel();
        throw new Error('body too large');
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  return JSON.parse(new TextDecoder().decode(bytes));
}


function json(payload: unknown, status = 200, headers: HeadersInit = {}) {
  return Response.json(payload, {
    status,
    headers: { 'Cache-Control': 'no-store', ...headers },
  });
}

function cleanTimes(values: number[], cutoff: number) {
  return values.filter((value) => value > cutoff);
}

function consumeRateLimit(key: string, minuteLimit: number, dayLimit: number) {
  const now = Date.now();
  if (!rateBuckets.has(key) && rateBuckets.size >= 1_000) {
    for (const [bucketKey, bucket] of rateBuckets) {
      if (!bucket.day.some((time) => time > now - 86_400_000)) rateBuckets.delete(bucketKey);
    }
    if (rateBuckets.size >= 1_000) return false;
  }
  const current = rateBuckets.get(key) ?? { minute: [], day: [] };
  current.minute = cleanTimes(current.minute, now - 60_000);
  current.day = cleanTimes(current.day, now - 86_400_000);
  if (current.minute.length >= minuteLimit || current.day.length >= dayLimit) return false;
  current.minute.push(now);
  current.day.push(now);
  rateBuckets.set(key, current);

  if (rateBuckets.size > 1_000) {
    for (const [bucketKey, bucket] of rateBuckets) {
      bucket.day = cleanTimes(bucket.day, now - 86_400_000);
      if (!bucket.day.length) rateBuckets.delete(bucketKey);
    }
  }
  return true;
}

function requestIdentity(request: Request) {
  const ip = request.headers.get('cf-connecting-ip')
    ?? request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    ?? 'unknown';
  const rawSession = request.headers.get('x-whatfraud-session') ?? '';
  const session = /^[a-zA-Z0-9-]{16,64}$/.test(rawSession) ? rawSession : 'anonymous';
  return { ip, session };
}

function parseMessages(value: unknown): AiChatMessage[] | null {
  if (!Array.isArray(value) || value.length < 1 || value.length > 4) return null;
  const messages: AiChatMessage[] = [];
  for (const candidate of value) {
    if (!candidate || typeof candidate !== 'object') return null;
    const record = candidate as { role?: unknown; content?: unknown };
    if ((record.role !== 'user' && record.role !== 'assistant') || typeof record.content !== 'string') return null;
    const content = record.role === 'user' ? sanitizePlayerText(record.content) : record.content.slice(0, 500).trim();
    if (!content) return null;
    messages.push({ role: record.role, content });
  }
  if (messages.at(-1)?.role !== 'user') return null;
  return messages;
}

function extractGeminiText(payload: unknown) {
  const data = payload as { candidates?: Array<{ content?: { parts?: Array<{ text?: unknown; thought?: unknown }> } }> };
  return data.candidates?.[0]?.content?.parts
    ?.map((part) => part.thought === true ? '' : typeof part.text === 'string' ? part.text : '')
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim() ?? '';
}

export async function GET() {
  return json({
    enabled: Boolean(process.env.GEMINI_API_KEY?.trim()),
    provider: 'gemini',
    model: GEMINI_MODEL,
    fallback: true,
  });
}

type ChatBody = { caseId?: unknown; messages?: unknown; userTurnCount?: unknown };
type PendingReply = { response: Promise<Response>; expires: number };
const pendingReplies = new Map<string, PendingReply>();

// Exact request coalescing, scoped to identity and full context. No cross-player
// response reuse; only short-lived process memory, never logs or durable storage.
export async function POST(request: Request) {
  let body: ChatBody;
  try {
    body = await readBoundedBody(request) as ChatBody;
    if (!body || typeof body !== 'object') return json({ code: 'invalid_request' }, 400);
  } catch {
    return json({ code: 'invalid_request' }, 400);
  }
  const identity = requestIdentity(request);
  const bytes = new TextEncoder().encode(JSON.stringify([identity.ip, identity.session, body]));
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  const key = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
  const now = Date.now();
  for (const [entryKey, entry] of pendingReplies) {
    if (entry.expires <= now) pendingReplies.delete(entryKey);
  }
  const existing = pendingReplies.get(key);
  if (existing) return (await existing.response).clone();
  if (pendingReplies.size >= 128) return json({ code: 'rate_limit' }, 429, { 'Retry-After': '30' });
  const response = handleChat(request, body);
  pendingReplies.set(key, { response, expires: now + 60_000 });
  try {
    return (await response).clone();
  } catch {
    pendingReplies.delete(key);
    return json({ code: 'provider_error' }, 502);
  }
}

async function handleChat(request: Request, body: ChatBody) {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) return json({ code: 'ai_unconfigured' }, 503);

  if (Date.now() < providerPausedUntil) {
    return json({ code: 'provider_cooldown' }, 503, { 'Retry-After': String(Math.ceil((providerPausedUntil - Date.now()) / 1000)) });
  }
  const { ip, session } = requestIdentity(request);
  if (!consumeRateLimit(`ip:${ip}`, IP_MINUTE_LIMIT, IP_DAY_LIMIT)
    || !consumeRateLimit(`session:${ip}:${session}`, SESSION_MINUTE_LIMIT, SESSION_DAY_LIMIT)) {
    return json({ code: 'rate_limit' }, 429, { 'Retry-After': '60' });
  }

  if (typeof body.caseId !== 'string') return json({ code: 'invalid_request' }, 400);
  const gameCase = cases.find((item) => item.id === body.caseId);
  if (!gameCase || gameCase.mode !== 'chat' || !gameCase.dialogue) return json({ code: 'invalid_case' }, 400);
  const messages = parseMessages(body.messages);
  if (!messages) return json({ code: 'invalid_messages' }, 400);

  const firstUser = messages.findIndex((message) => message.role === 'user');
  const conversation = messages.slice(Math.max(firstUser, 0));
  const visibleUserTurns = conversation.filter((message) => message.role === 'user').length;
  if (!Number.isInteger(body.userTurnCount) || Number(body.userTurnCount) < visibleUserTurns || Number(body.userTurnCount) > 24) {
    return json({ code: 'invalid_turn_count' }, 400);
  }
  const userTurnCount = Number(body.userTurnCount);
  // Supplemental isolate-local throttle; not a project-wide quota or billing cap.
  if (!consumeRateLimit(`case:${ip}:${session}:${gameCase.id}`, 5, 8)) {
    return json({ code: 'rate_limit' }, 429, { 'Retry-After': '60' });
  }
  const emotion = inferDialogueEmotion(conversation, userTurnCount);
  const replyMode = inferDialogueReplyMode(conversation, userTurnCount);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), PROVIDER_TIMEOUT_MS);

  try {
    const response = await fetch(GEMINI_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey,
      },
      signal: controller.signal,
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: buildSystemPrompt(gameCase, conversation, userTurnCount) }] },
        contents: conversation.map((message) => ({
          role: message.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: message.content }],
        })),
        generationConfig: {
          maxOutputTokens: replyMode === 'short' ? 40 : 96,
          thinkingConfig: { thinkingLevel: 'minimal' },
        },
      }),
    });

    if (response.status === 429) {
      providerPausedUntil = Date.now() + 60_000;
      return json({ code: 'provider_quota' }, 429, { 'Retry-After': '60' });
    }
    if (!response.ok) {
      providerPausedUntil = Date.now() + (response.status === 400 || response.status === 403 ? 300_000 : 30_000);
      return json({ code: response.status === 400 || response.status === 403 ? 'provider_configuration' : 'provider_error' }, 502, { 'Retry-After': response.status === 400 || response.status === 403 ? '300' : '30' });
    }
    const payload = await response.json() as { candidates?: Array<{ finishReason?: string }> };
    if (payload.candidates?.[0]?.finishReason !== 'STOP') return json({ code: 'incomplete_response' }, 502);
    const reply = extractGeminiText(payload);
    if (!validateAiReply(reply, emotion, replyMode)) return json({ code: 'unsafe_response' }, 502);
    return json({ reply, provider: 'gemini', model: GEMINI_MODEL });
  } catch (error) {
    providerPausedUntil = Date.now() + 30_000;
    return json({ code: error instanceof Error && error.name === 'AbortError' ? 'provider_timeout' : 'provider_error' }, 504);
  } finally {
    clearTimeout(timeout);
  }
}
