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
    .replace("import { reserveSharedBudget } from '../ai-budget';", "const reserveSharedBudget = async () => globalThis.__budgetOutcome ?? 'allowed';")
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
const originalEnabled = process.env.GEMINI_ENABLED;
const originalNow = Date.now;
let clock = 1_800_000_000_000;
Date.now = () => clock;
const successful = () => Response.json({ candidates: [{ finishReason: 'STOP', content: { parts: [{ text: '조금 더 확인해 볼게.' }] } }] });
try {
  process.env.GEMINI_ENABLED = 'true';
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
  clock += 12_000;
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
  assert.equal((await route.POST(new Request('https://example.invalid/api/ai-chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: 'x'.repeat(12001) }))).status, 400);
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
  // Execute shared routing and fallback functions used by both client and server.
  for (const gameCase of cases.filter((item) => item.mode === 'chat')) {
    const question = '손실 가능성은 어떤가요?';
    const first = dialogue.buildFallbackReply(gameCase, question, [{ role: 'user', content: question }]);
    const second = dialogue.buildFallbackReply(gameCase, question, [{ role: 'user', content: question }, { role: 'assistant', content: first }, { role: 'user', content: question }]);
    assert.equal(first, gameCase.dialogue.fallbackByTopic.risk);
    assert.notEqual(second, first, 'same topic should use an alternate, not repeat verbatim');
    assert.equal(dialogue.classifyDialogueTopic(question), 'risk');
    assert.ok(dialogue.getScriptedReply(gameCase, [{ role: 'user', content: '안녕하세요' }]));
    assert.equal(dialogue.getScriptedReply(gameCase, [{ role: 'user', content: '자료 공개 범위가 어떻게 정해졌는지 설명해 주세요' }]), null);
    const refusal = [{ role: 'user', content: '하지 않을게요' }];
    const firstRefusal = dialogue.getScriptedReply(gameCase, refusal);
    assert.equal(firstRefusal, gameCase.dialogue.fallbackByEmotion.disappointed);
    const secondRefusal = dialogue.getScriptedReply(gameCase, [...refusal, { role: 'assistant', content: firstRefusal }, { role: 'user', content: '연락 그만' }]);
    assert.equal(secondRefusal, gameCase.dialogue.fallbackByEmotion.closed);
    assert.ok(dialogue.validateAiReply(secondRefusal, 'closed'));
    assert.ok(dialogue.validateAiReply(second), 'alternate must pass output safety rules');
  }
  calls = 0;
  route = await freshRoute();
  globalThis.fetch = async () => { calls++; return successful(); };
  for (const gameCase of cases.filter((item) => item.mode === 'chat')) {
    for (const question of gameCase.dialogue.quickQuestions) {
      const payload = await (await route.POST(request(question, 'test-session-scripted', { caseId: gameCase.id }))).json();
      assert.equal(payload.provider, 'scripted');
      assert.ok(payload.reply);
    }
  }
  assert.equal(calls, 0, 'all recommended questions bypass Gemini on the server');
  const friend = cases.find((item) => item.id === 'friend-hot-tip');
  const prompt = dialogue.buildSystemPrompt(friend, [{ role: 'user', content: '어떻게 생각해?' }], 1);
  assert.ok(prompt.includes(friend.dialogue.progression[0]), 'first reply uses first story stage');
  assert.ok(dialogue.buildSystemPrompt(friend, [{ role: 'user', content: '설명 부탁해' }], 5).includes('감정과 대응: friendly'));
  // Spacing applies to novel questions, but never stops a scripted reply.
  route = await freshRoute();
  await route.POST(request('새로운 질문 첫째'));
  clock += 1_000;
  assert.equal((await route.POST(request('새로운 질문 둘째'))).status, 429);
  assert.equal((await (await route.POST(request('네'))).json()).provider, 'scripted');
  assert.equal(calls, 1);
  clock += 11_000;
  assert.equal((await route.POST(request('새로운 질문 셋째'))).status, 200, 'rejected attempt must not extend spacing');
  for (const text of ['새로운 질문 넷째', '새로운 질문 다섯째']) {
    clock += 12_000;
    assert.equal((await route.POST(request(text))).status, 200);
  }
  clock += 12_000;
  assert.equal((await route.POST(request('새로운 질문 여섯째'))).status, 429);
  assert.equal(calls, 4, 'case budget allows only four generation attempts');
  assert.equal((await (await route.POST(request('네'))).json()).provider, 'scripted');
  assert.ok(clientSource.includes('getScriptedReply(activeCase, nextMessages)'));
  const statusCheck = clientSource.slice(clientSource.indexOf('async function checkModel'), clientSource.indexOf('async function sendMessage'));
  assert.ok(!statusCheck.includes('requestGemini('), 'settings check must not generate');
  await testClientCancellation();
  await testSecurity();
  for (const outcome of ['exhausted','unavailable']) {
    globalThis.__budgetOutcome=outcome;
    const route=await freshRoute(); let budgetCalls=0;
    globalThis.fetch=async()=>{budgetCalls++;return successful();};
    assert.equal((await (await route.POST(request())).json()).code,outcome==='exhausted'?'budget_exhausted':'budget_unavailable');
    assert.equal(budgetCalls,0);
    assert.equal((await (await route.POST(request('네'))).json()).provider,'scripted');
  }
  delete globalThis.__budgetOutcome;
  console.log('AI call tests passed: status, coalescing, isolation, cooldown, body limit, invalid inputs, missing key, truncation, topic continuity.');
} finally {
  if (originalEnabled === undefined) delete process.env.GEMINI_ENABLED;
  else process.env.GEMINI_ENABLED = originalEnabled;
  globalThis.fetch = originalFetch;
  Date.now = originalNow;
  if (originalKey === undefined) delete process.env.GEMINI_API_KEY;
  else process.env.GEMINI_API_KEY = originalKey;
}

async function testClientCancellation() {
  // Run the actual client handlers with deterministic React-state stand-ins.
  const cancel = clientSource.slice(clientSource.indexOf('  function cancelPendingReply'), clientSource.indexOf('  async function requestGemini'));
  const send = clientSource.slice(clientSource.indexOf('  async function sendMessage'), clientSource.indexOf('  function verifySource'));
  const block = clientSource.slice(clientSource.indexOf('  function blockActiveContact'), clientSource.indexOf('  function openCase'));
  const harnessUrl = moduleUrl(`
    import { getScriptedReply, buildFallbackReply as fallbackReply } from ${JSON.stringify(dialogueUrl)};
    export function harness(activeCase, pending) {
      let draft = '자료 공개 범위는 어떻게 정해졌나요?';
      const activeChat = [];
      const activeResult = false, activeContactBlocked = false;
      const sendingRef = {current:false}, requestSequence={current:0}, activeRequest={current:new AbortController()};
      const aiPausedUntil={current:0}, lastAiRequestAt={current:0}, aiCallsByCase={current:{}}, typingCueTimers={current:[]};
      let chats={}, blocked={}, sending=false, feedback=0, requests=0;
      const preferences={};
      const window={setTimeout:()=>0,clearTimeout:()=>{}};
      const setChats=fn=>{chats=fn(chats)}, setBlockedContacts=fn=>{blocked=fn(blocked)};
      const setDraft=v=>{draft=v}, setSending=v=>{sending=v};
      const clearTypingCueTimers=()=>{},setTypingPhase=()=>{},setLastResponseMs=()=>{},setFallbackReason=()=>{},setModelState=()=>{};
      const setSelectedAction=()=>{},setNotice=()=>{},explainFallback=()=>'',playPhoneFeedback=()=>{feedback++};
      const requestGemini=()=>{requests++;return pending};
      ${cancel}\n${send}\n${block}
      const controller=activeRequest.current;
      return {send:()=>sendMessage({preventDefault(){}}),block:blockActiveContact,cancel:cancelPendingReply,
        snapshot:()=>({chats,blocked,sending,feedback,requests,aborted:controller.signal.aborted})};
    }`);
  const {harness} = await import(harnessUrl);
  const friend = cases.find(item=>item.id==='friend-hot-tip');
  for (const action of ['block','cancel']) {
    let resolve;
    const pending = new Promise(done=>{resolve=done});
    const client = harness(friend,pending);
    const first = client.send();
    await client.send();
    assert.equal(client.snapshot().requests,1,'double submit must not race');
    client[action]();
    resolve({reply:'뒤늦게 도착한 답변',provider:'gemini'});
    await first;
    const state = client.snapshot();
    assert.equal(state.aborted,true);
    assert.equal(state.sending,false);
    assert.equal(state.feedback,0);
    assert.equal(state.chats[friend.id].filter(message=>message.role==='assistant').length,0,'late reply must not reach chat');
    if(action==='block') assert.equal(state.blocked[friend.id],true);
  }
}

async function testSecurity() {
  let route = await freshRoute();
  calls = 0;
  globalThis.fetch = async () => { calls++; return successful(); };
  const withHeaders = (headers, text = '새 질문입니다') => {
    const value = request(text);
    for (const [key, content] of Object.entries(headers)) value.headers.set(key, content);
    return value;
  };
  for (const [headers, status] of [
    [{ Origin: 'https://other.invalid' }, 403],
    [{ Origin: 'null' }, 403],
    [{ 'sec-fetch-site': 'cross-site' }, 403],
    [{ 'sec-fetch-site': 'same-site' }, 403],
    [{ 'Content-Type': 'text/plain' }, 415],
    [{ 'Content-Length': '12001' }, 400],
  ]) assert.equal((await route.POST(withHeaders(headers))).status, status);
  assert.equal((await route.POST(request('a'.repeat(501)))).status, 400);
  assert.equal((await route.POST(request('질문', undefined, { extra: 'unknown' }))).status, 400);
  assert.equal((await route.POST(request('질문', undefined, { messages: [{ role: 'user', content: '하나' }, { role: 'user', content: '둘' }], userTurnCount: 2 }))).status, 400);
  assert.equal(calls, 0, 'rejected envelopes and messages must not generate');
  const stalled = new Request('https://example.invalid/api/ai-chat', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: new ReadableStream({ start() {} }), duplex: 'half',
  });
  assert.equal((await route.POST(stalled)).status, 408, 'slow body must time out before provider access');
  assert.equal(calls, 0);
  const ok = await route.POST(withHeaders({ Origin: 'https://example.invalid', 'sec-fetch-site': 'same-origin' }));
  assert.equal(ok.status, 200);
  assert.equal(ok.headers.get('X-Content-Type-Options'), 'nosniff');
  assert.equal(ok.headers.get('Cache-Control'), 'no-store');
  // Changing untrusted forwarding headers cannot create a new quota identity.
  clock += 1_000;
  const forwarded = withHeaders({ 'x-forwarded-for': '198.51.100.88' }, '또 다른 질문');
  forwarded.headers.delete('cf-connecting-ip');
  route = await freshRoute();
  await route.POST(forwarded);
  const changed = withHeaders({ 'x-forwarded-for': '198.51.100.99' }, '다음 질문');
  changed.headers.delete('cf-connecting-ip');
  assert.equal((await route.POST(changed)).status, 429);

  route = await freshRoute();
  calls = 0;
  let release;
  const gate = new Promise(resolve => { release = resolve; });
  globalThis.fetch = async () => { calls++; await gate; return successful(); };
  const first = route.POST(request('서로 다른 질문 하나', 'concurrency-session-01'));
  const second = route.POST(request('서로 다른 질문 둘', 'concurrency-session-02'));
  for (let i = 0; i < 100 && calls < 2; i++) await new Promise(resolve => setTimeout(resolve, 1));
  assert.equal(calls, 2);
  const third = await route.POST(request('서로 다른 질문 셋', 'concurrency-session-03'));
  assert.equal((await third.json()).code, 'provider_busy');
  assert.equal(calls, 2);
  release();
  await Promise.all([first, second]);
  assert.equal((await route.POST(request('서로 다른 질문 셋', 'concurrency-session-03'))).status, 200, 'busy errors must not occupy the response cache');
  assert.equal(calls, 3);

  process.env.GEMINI_ENABLED = 'false';
  const disabled = await route.POST(request('새로운 질문', 'disable-session-0001'));
  assert.equal((await disabled.json()).code, 'ai_disabled');
  assert.equal((await (await route.GET()).json()).enabled, false);
  assert.equal((await (await route.POST(request('네'))).json()).provider, 'scripted');
  assert.equal(calls, 3, 'operator switch must not disable scripted gameplay or call provider');
  process.env.GEMINI_ENABLED = 'true';

  route = await freshRoute();
  let providerBody;
  globalThis.fetch = async (_url, options) => { providerBody = options.body; return successful(); };
  await route.POST(request('질문', 'privacy-session-0001', {
    messages: [{ role: 'user', content: 'abc@example.invalid 내용은?' }, { role: 'assistant', content: 'https://example.invalid 010-1234-5678' }, { role: 'user', content: '설명 부탁드립니다' }],
    userTurnCount: 2,
  }));
  assert.ok(providerBody);
  assert.ok(!providerBody.includes('abc@example.invalid') && !providerBody.includes('https://example.invalid') && !providerBody.includes('010-1234-5678'), 'sanitize both roles before provider access');
  assert.equal(dialogue.validateAiReply('abc@example.invalid로 연락하세요'), false);
  assert.notEqual(dialogue.inferDialogueEmotion([{ role: 'user', content: '어떻게 생각해?' }]), 'disappointed');
  assert.equal(dialogue.inferDialogueEmotion([{ role: 'user', content: '생각해 볼게' }]), 'disappointed');
  console.log('Security request tests passed: origin, media type, body deadline, schema, forwarding, concurrency, kill switch, privacy.');
}
