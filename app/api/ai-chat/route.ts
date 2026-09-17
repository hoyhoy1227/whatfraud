import {validateDecisionContext,decisionPrompt,parseDecisionReply,decisionReactions,AI_CASE_LIMITS,AI_RUN_LIMIT} from '../../story/decision-message.js';
import { validateStoryContext, storyPrompt, parseStoryReply, branchModes, branchFocus } from '../../story/one-shot.js';
import { reserveSharedBudget } from '../ai-budget';
import { sanitizePlayerText, validateAiReply, getScriptedReply, type AiChatMessage } from '../../ai-dialogue';
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
let activeProviderRequests = 0;
const MAX_PROVIDER_CONCURRENCY = 2;
const aiEnabled = () => process.env.GEMINI_ENABLED !== 'false';

async function readBoundedBody(request: Request) {
  const reader = request.body?.getReader();
  if (!reader) throw new Error('empty body');
  const chunks: Uint8Array[] = [];
  let size = 0;
  let rejectDeadline: (reason: Error) => void = () => {};
  const deadline = new Promise<never>((_, reject) => { rejectDeadline = reject; });
  const cancel = (reason: string) => {
    rejectDeadline(new Error(reason));
    void reader.cancel().catch(() => {});
  };
  const timer = setTimeout(() => cancel('body_timeout'), 2_000);
  const abort = () => cancel('request_aborted');
  request.signal.addEventListener('abort', abort, { once: true });
  try {
    if (request.signal.aborted) throw new Error('request_aborted');
    return await Promise.race([deadline, (async () => {
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > 12_000) {
          void reader.cancel().catch(() => {});
          throw new Error('body too large');
        }
        chunks.push(value);
      }
      const bytes = new Uint8Array(size);
      let offset = 0;
      for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
      return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
    })()]);
  } finally {
    clearTimeout(timer);
    request.signal.removeEventListener('abort', abort);
    reader.releaseLock();
  }
}

// Browser cross-origin defense, not authentication: a non-browser client can
// spoof these headers. Never trust forwarded host/IP values from arbitrary proxies.
function validateRequestEnvelope(request: Request) {
  const origin = request.headers.get('origin');
  if (origin && origin !== new URL(request.url).origin) return json({ code: 'forbidden_origin' }, 403);
  const site = request.headers.get('sec-fetch-site');
  if (site && site !== 'same-origin' && site !== 'none') return json({ code: 'forbidden_origin' }, 403);
  if (request.headers.get('content-type')?.split(';')[0].trim().toLowerCase() !== 'application/json') {
    return json({ code: 'unsupported_media_type' }, 415);
  }
  const length = request.headers.get('content-length');
  if (length && (!/^\d+$/.test(length) || Number(length) > 12_000)) return json({ code: 'invalid_request' }, 400);
  return null;
}


function json(payload: unknown, status = 200, headers: HeadersInit = {}) {
  const outcome = payload as { code?: string; provider?: string; validation?: string };
  // Only application-defined categorical outcomes; no request content/identity.
  console.info(JSON.stringify({ event: 'ai_chat_result', status, outcome: outcome.code ?? outcome.provider ?? 'status', ...(outcome.validation === 'story_contract' || outcome.validation === 'reply_policy' ? { validation: outcome.validation } : {}) }));
  return Response.json(payload, {
    status,
    headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer', ...headers },
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
    if (record.content.length > 500) return null;
    const content = sanitizePlayerText(record.content);
    if (!content) return null;
    messages.push({ role: record.role, content });
  }
  if (messages.at(-1)?.role !== 'user') return null;
  const firstUser = messages.findIndex((message) => message.role === 'user');
  for (let index = firstUser + 1; index < messages.length; index++) {
    if (messages[index].role === messages[index - 1].role) return null;
  }
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
    enabled: aiEnabled() && Boolean(process.env.GEMINI_API_KEY?.trim()),
    mode: aiEnabled() ? 'selective' : 'scripted',
    limiterScope: 'shared-d1-budget-and-isolate-throttle',
    provider: 'gemini',
    model: GEMINI_MODEL,
    fallback: true,
  });
}

type ChatBody = { caseId?: unknown; messages?: unknown; userTurnCount?: unknown; stageId?: unknown; inputMode?: unknown; choices?: unknown; checks?: unknown; sceneId?: unknown; resolved?: unknown; joined?: unknown; attachment?: unknown; contractVersion?: unknown };
type PendingReply = { response: Promise<Response>; expires: number };
const pendingReplies = new Map<string, PendingReply>();

// Exact request coalescing, scoped to identity and full context. No cross-player
// response reuse; only short-lived process memory, never logs or durable storage.
export async function POST(request: Request) {
  const rejected = validateRequestEnvelope(request);
  if (rejected) return rejected;
  let body: ChatBody;
  try {
    body = await readBoundedBody(request) as ChatBody;
    if (!body || typeof body !== 'object' || Array.isArray(body) || Object.keys(body).some((key) => !['caseId', 'messages', 'userTurnCount', 'stageId', 'inputMode', 'choices', 'checks', 'sceneId', 'resolved', 'joined', 'attachment', 'contractVersion'].includes(key))) return json({ code: 'invalid_request' }, 400);
  } catch (error) {
    return json({ code: error instanceof Error && error.message === 'body_timeout' ? 'body_timeout' : 'invalid_request' }, error instanceof Error && error.message === 'body_timeout' ? 408 : 400);
  }
  if (!aiEnabled()) return handleChat(request, body);
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
    const resolved = await response;
    if (!resolved.ok) pendingReplies.delete(key);
    return resolved.clone();
  } catch {
    pendingReplies.delete(key);
    return json({ code: 'provider_error' }, 502);
  }
}

async function handleChat(request: Request, body: ChatBody) {
  if (typeof body.caseId !== 'string') return json({ code: 'invalid_request' }, 400);
  const gameCase = cases.find((item) => item.id === body.caseId);
  if (!gameCase || gameCase.mode !== 'chat' || !gameCase.dialogue) return json({ code: 'invalid_case' }, 400);
  const messages = parseMessages(body.messages);
  if (!messages) return json({ code: 'invalid_messages' }, 400);
  // Old clients may still request built-in lines, but never reach the provider.
  if(body.inputMode!=='story-message'&&body.inputMode!=='decision-message'){
    const scripted=body.inputMode===undefined?getScriptedReply(gameCase,messages):null;
    if(scripted!==null)return json({reply:scripted,provider:'scripted',model:null});
    return json({code:'story_message_required'},409);
  }
  if(messages.length!==1||messages[0].role!=='user'||body.userTurnCount!==1)return json({code:'invalid_messages'},400);
  const isDecision=body.inputMode==='decision-message';
  if((body.contractVersion!==undefined&&body.contractVersion!==2)||(isDecision?!validateDecisionContext(body):(!validateStoryContext(body)||body.choices!==undefined||body.checks!==undefined)))return json({code:'invalid_story_context'},400);
  const sceneId=body.sceneId as 'peer'|'friend';
  const contractVersion=body.contractVersion===2?2:1;
  const moment=(isDecision?'decision-':'story-')+body.sceneId;
  const conversation=messages;
  if (!aiEnabled()) return json({ code: 'ai_disabled' }, 503, { 'Retry-After': '300' });
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) return json({ code: 'ai_unconfigured' }, 503);

  if (Date.now() < providerPausedUntil) {
    return json({ code: 'provider_cooldown' }, 503, { 'Retry-After': String(Math.ceil((providerPausedUntil - Date.now()) / 1000)) });
  }

  if (activeProviderRequests >= MAX_PROVIDER_CONCURRENCY) return json({ code: 'provider_busy' }, 503, { 'Retry-After': '12' });
  const { ip, session } = requestIdentity(request);
  const lastRequest = rateBuckets.get(`session:${ip}:${session}`)?.minute.at(-1);
  if (lastRequest !== undefined && Date.now() - lastRequest < 12_000) return json({ code: 'rate_limit' }, 429, { 'Retry-After': String(Math.ceil((12_000 - (Date.now() - lastRequest)) / 1000)) });
  if (!consumeRateLimit(`ip:${ip}`, IP_MINUTE_LIMIT, IP_DAY_LIMIT)
    || !consumeRateLimit(`session:${ip}:${session}`, SESSION_MINUTE_LIMIT, SESSION_DAY_LIMIT)) {
    return json({ code: 'rate_limit' }, 429, { 'Retry-After': '60' });
  }


  if(!consumeRateLimit(`run:${ip}:${session}`,AI_RUN_LIMIT,AI_RUN_LIMIT))return json({code:'run_limit'},429);
  const momentKey = `moment:${ip}:${session}:${moment}`;
  if (!consumeRateLimit(momentKey, 1, 1)) return json({ code: 'moment_used' }, 429);
  const caseKey = `case:${ip}:${session}:${gameCase.id}`;
  // Supplemental isolate-local throttle; not a project-wide quota or billing cap.
  if (!consumeRateLimit(caseKey, AI_CASE_LIMITS[cases.findIndex(c=>c.id===gameCase.id)], AI_CASE_LIMITS[cases.findIndex(c=>c.id===gameCase.id)])) {
    return json({ code: 'rate_limit' }, 429, { 'Retry-After': '60' });
  }
  // Aggregate brake remains isolate-local and does not claim a billing cap.
  if (!consumeRateLimit('aggregate', 20, 240)) return json({ code: 'rate_limit' }, 429, { 'Retry-After': '60' });
  const replyMode = 'normal' as const;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), PROVIDER_TIMEOUT_MS);
  const abort=()=>controller.abort();
  request.signal.addEventListener('abort',abort,{once:true});
  if(request.signal.aborted)controller.abort();
  activeProviderRequests += 1;

  try {
    const budget = await reserveSharedBudget();
    if (budget !== 'allowed') return json({ code: budget === 'exhausted' ? 'budget_exhausted' : 'budget_unavailable' }, budget === 'exhausted' ? 429 : 503, { 'Retry-After': '60' });
    if (controller.signal.aborted) return json({ code: 'provider_timeout' }, 504);
    const response = await fetch(GEMINI_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey,
      },
      signal: controller.signal,
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: isDecision?decisionPrompt(body):storyPrompt(sceneId,body.attachment as string,contractVersion,body.stageId as string) }] },
        contents: conversation.map((message) => ({
          role: message.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: message.content }],
        })),
        generationConfig: {
          maxOutputTokens: contractVersion===2?280:180,
          responseMimeType: 'application/json',
          responseSchema: isDecision?{type:'OBJECT',properties:{reply:{type:'STRING'},reaction:{type:'STRING',enum:decisionReactions}},required:['reply','reaction']}:{type:'OBJECT',properties:{reply:{type:'STRING'},reaction:{type:'STRING',enum:sceneId==='peer'?['check','acknowledge','boundary']:['together','space']}},required:['reply','reaction'],...(contractVersion===2?{properties:{reply:{type:'STRING'},reaction:{type:'STRING',enum:sceneId==='peer'?['check','acknowledge','boundary']:['together','space']},supportMode:{type:'STRING',enum:branchModes[sceneId]},focus:{type:'STRING',enum:branchFocus}},required:['reply','reaction','supportMode','focus']}: {})},
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
    const result = isDecision?parseDecisionReply(extractGeminiText(payload)):parseStoryReply(extractGeminiText(payload),sceneId,contractVersion,body.attachment as string);
    if (!result) return json({ code: 'unsafe_response', validation: 'story_contract' }, 502);
    if (!validateAiReply(result.reply, undefined, replyMode, 'story')) return json({ code: 'unsafe_response', validation: 'reply_policy' }, 502);
    return json({ reply:result.reply, reaction:result.reaction, provider: 'gemini', model: GEMINI_MODEL, ...(!isDecision&&contractVersion===2?{supportMode:result.supportMode,focus:result.focus}: {}) });
  } catch (error) {
    providerPausedUntil = Date.now() + 30_000;
    return json({ code: error instanceof Error && error.name === 'AbortError' ? 'provider_timeout' : 'provider_error' }, 504);
  } finally {
    clearTimeout(timeout);
    request.signal.removeEventListener('abort',abort);
    activeProviderRequests -= 1;
  }
}
