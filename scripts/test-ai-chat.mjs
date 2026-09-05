import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';

const cases = JSON.parse(await readFile(new URL('../content/generated/cases.json', import.meta.url), 'utf8'));
const dialogueSource = await readFile(new URL('../app/ai-dialogue.ts', import.meta.url), 'utf8');
const routeSource = await readFile(new URL('../app/api/ai-chat/route.ts', import.meta.url), 'utf8');
const clientSource = await readFile(new URL('../app/game-client.tsx', import.meta.url), 'utf8');
const compile = (source) => ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
const moduleUrl = (source) => 'data:text/javascript;base64,' + Buffer.from(compile(source)).toString('base64');
const dialogueUrl = moduleUrl(dialogueSource);
const dialogue = await import(dialogueUrl);
let serial = 0;
async function freshRoute() {
  const source = routeSource
    .replace("'../../ai-dialogue'", JSON.stringify(dialogueUrl))
    .replace("import { cases } from '../../game-data';", 'const cases = ' + JSON.stringify(cases) + ';');
  return import(moduleUrl(source) + '#' + serial++);
}
const request = (text = 'この質問', session = 'test-session-000001', overrides = {}) => new Request('https://example.invalid/api/ai-chat', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'x-whatfraud-session': session, 'cf-connecting-ip': '192.0.2.1' },
  body: JSON.stringify({ caseId: 'friend-hot-tip', messages: [{ role: 'user', content: text }], userTurnCount: 1, ...overrides }),
});
let calls = 0;
const originalFetch = globalThis.fetch;
const originalKey = process.env.GEMINI_API_KEY;
const successful = () => Response.json({ candidates: [{ finishReason: 'STOP', content: { parts: [{ text: '조금 더 확인해 볼게.' }] } }] });
try {
  process.env.GEMINI_API_KEY = 'mock-only-not-a-real-key';
  globalThis.fetch = async () => { calls++; return successful(); };
  let route = await freshRoute();
  assert.equal((await (await route.GET()).json()).enabled, true);
  assert.equal(calls, 0, 'status must not generate');
  const concurrent = await Promise.all(Array.from({ length: 5 }, () => route.POST(request())));
  assert.equal(calls, 1, 'duplicates must generate once');
  for (const response of concurrent) assert.equal(response.status, 200);
  await route.POST(request());
  assert.equal(calls, 1, 'exact retry reuses response');
  await route.POST(request('別の質問'));
  assert.equal(calls, 2, 'changed content must not collide');
  await route.POST(request('この質問', 'test-session-000002'));
  assert.equal(calls, 3, 'different player must not share response');

  calls = 0;
  route = await freshRoute();
  globalThis.fetch = async () => { calls++; return new Response(null, { status: 429 }); };
  assert.equal((await (await route.POST(request())).json()).code, 'provider_quota');
  assert.equal((await (await route.POST(request('다른 질문'))).json()).code, 'provider_cooldown');
  assert.equal(calls, 1, 'cooldown must avoid another provider request');

  calls = 0;
  route = await freshRoute();
  globalThis.fetch = async () => { calls++; return successful(); };
  assert.equal((await route.POST(new Request('https://example.invalid/api/ai-chat', { method: 'POST', body: 'x'.repeat(12001) }))).status, 400);
  assert.equal((await route.POST(request('확인', 'test-session-000003', { caseId: 'official-etf-fill' }))).status, 400);
  assert.equal((await route.POST(request('확인', 'test-session-000004', { userTurnCount: 25 }))).status, 400);
  assert.equal(calls, 0, 'invalid requests must not generate');
  delete process.env.GEMINI_API_KEY;
  route = await freshRoute();
  assert.equal((await (await route.POST(request())).json()).code, 'ai_unconfigured');
  assert.equal(calls, 0);

  process.env.GEMINI_API_KEY = 'mock-only-not-a-real-key';
  route = await freshRoute();
  globalThis.fetch = async () => { calls++; return Response.json({ candidates: [{ finishReason: 'MAX_TOKENS', content: { parts: [{ text: '아직 끝나지' }] } }] }); };
  assert.equal((await (await route.POST(request())).json()).code, 'incomplete_response');
  assert.equal(calls, 1, 'truncation must not trigger regeneration');

  for (const question of ['근거는 어디서 확인해?', '손실 가능성은?', '돈은 어디로 보내나요?']) {
    assert.equal(dialogue.inferDialogueReplyMode([{ role: 'user', content: question }], 5), 'normal');
  }
  // Execute the actual pure fallback functions extracted from the client.
  const fallbackSource = clientSource.slice(clientSource.indexOf('function classifyDialogueTopic'), clientSource.indexOf('export default function GameClient'));
  const fallbackModule = await import(moduleUrl('import { inferDialogueEmotion } from ' + JSON.stringify(dialogueUrl) + ';\n' + fallbackSource + '\nexport { fallbackReply };'));
  for (const gameCase of cases.filter((item) => item.mode === 'chat')) {
    const text = '손실 가능성은 어떤가요?';
    const previous = gameCase.dialogue.fallbackByTopic.risk;
    assert.equal(fallbackModule.fallbackReply(gameCase, text, [{ role: 'assistant', content: previous }, { role: 'user', content: text }]), previous);
  }
  assert.ok(clientSource.includes('gameCase.dialogue.quickQuestions.includes(latest)'));
  const statusCheck = clientSource.slice(clientSource.indexOf('async function checkModel'), clientSource.indexOf('async function sendMessage'));
  assert.ok(!statusCheck.includes('requestGemini('), 'settings check must not generate');
  console.log('AI call tests passed: status, coalescing, isolation, cooldown, body limit, invalid inputs, missing key, truncation, topic continuity.');
} finally {
  globalThis.fetch = originalFetch;
  if (originalKey === undefined) delete process.env.GEMINI_API_KEY;
  else process.env.GEMINI_API_KEY = originalKey;
}
