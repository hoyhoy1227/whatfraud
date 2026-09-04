import { buildSystemPrompt, inferDialogueEmotion, sanitizePlayerText, validateAiReply, type AiChatMessage } from '../../ai-dialogue';
import { cases } from '../../game-data';

const GEMINI_MODEL = 'gemini-3.6-flash';
const GEMINI_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;
const PROVIDER_TIMEOUT_MS = 24_000;
const SESSION_MINUTE_LIMIT = 5;
const SESSION_DAY_LIMIT = 30;
const IP_MINUTE_LIMIT = 10;
const IP_DAY_LIMIT = 120;

type RateBucket = { minute: number[]; day: number[] };
const rateBuckets = new Map<string, RateBucket>();

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
  if (!Array.isArray(value) || value.length < 1 || value.length > 6) return null;
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

export async function POST(request: Request) {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) return json({ code: 'ai_unconfigured' }, 503);

  const { ip, session } = requestIdentity(request);
  if (!consumeRateLimit(`ip:${ip}`, IP_MINUTE_LIMIT, IP_DAY_LIMIT)
    || !consumeRateLimit(`session:${ip}:${session}`, SESSION_MINUTE_LIMIT, SESSION_DAY_LIMIT)) {
    return json({ code: 'rate_limit' }, 429, { 'Retry-After': '60' });
  }

  let body: { caseId?: unknown; messages?: unknown };
  try {
    body = await request.json() as { caseId?: unknown; messages?: unknown };
  } catch {
    return json({ code: 'invalid_request' }, 400);
  }

  if (typeof body.caseId !== 'string') return json({ code: 'invalid_request' }, 400);
  const gameCase = cases.find((item) => item.id === body.caseId);
  if (!gameCase || gameCase.mode !== 'chat' || !gameCase.dialogue) return json({ code: 'invalid_case' }, 400);
  const messages = parseMessages(body.messages);
  if (!messages) return json({ code: 'invalid_messages' }, 400);

  const firstUser = messages.findIndex((message) => message.role === 'user');
  const conversation = messages.slice(Math.max(firstUser, 0));
  const emotion = inferDialogueEmotion(conversation);
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
        systemInstruction: { parts: [{ text: buildSystemPrompt(gameCase, conversation) }] },
        contents: conversation.map((message) => ({
          role: message.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: message.content }],
        })),
        generationConfig: {
          maxOutputTokens: 120,
          thinkingConfig: { thinkingLevel: 'minimal' },
        },
      }),
    });

    if (response.status === 429) return json({ code: 'free_quota' }, 429, { 'Retry-After': '60' });
    if (!response.ok) return json({ code: response.status === 400 || response.status === 403 ? 'invalid_api_key' : 'provider_error' }, 502);
    const reply = extractGeminiText(await response.json());
    if (!validateAiReply(reply, emotion)) return json({ code: 'unsafe_response' }, 502);
    return json({ reply, provider: 'gemini', model: GEMINI_MODEL });
  } catch (error) {
    return json({ code: error instanceof Error && error.name === 'AbortError' ? 'provider_timeout' : 'provider_error' }, 504);
  } finally {
    clearTimeout(timeout);
  }
}
