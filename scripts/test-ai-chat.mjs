import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';

const cases = JSON.parse(await readFile(new URL('../content/generated/cases.json', import.meta.url), 'utf8'));
const dialogueSource = await readFile(new URL('../app/ai-dialogue.ts', import.meta.url), 'utf8');
const routeSource = await readFile(new URL('../app/api/ai-chat/route.ts', import.meta.url), 'utf8');
const compile = (source) => ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
const moduleUrl = (source) => 'data:text/javascript;base64,' + Buffer.from(compile(source)).toString('base64');
const dialogueUrl = moduleUrl(dialogueSource.replaceAll("'./story/narrative.js'",JSON.stringify(new URL('../app/story/narrative.js',import.meta.url).href)));
const dialogue = await import(dialogueUrl);
let serial = 0;
async function freshRoute() {
  const source = routeSource
    .replace("import { reserveSharedBudget } from '../ai-budget';", "const reserveSharedBudget = async () => globalThis.__budgetOutcome ?? 'allowed';")
    .replace("'../../ai-dialogue'", JSON.stringify(dialogueUrl))
    .replace("'../../story/one-shot.js'",JSON.stringify(new URL('../app/story/one-shot.js',import.meta.url).href))
    .replace("import { cases } from '../../game-data';", 'const cases = ' + JSON.stringify(cases) + ';');
  return import(moduleUrl(source) + '#' + serial++);
}
const request=(text='안내부터 확인해 보세요',session='test-session-000001',overrides={})=>new Request('https://example.invalid/api/ai-chat',{method:'POST',headers:{'Content-Type':'application/json','x-whatfraud-session':session,'cf-connecting-ip':'192.0.2.1'},body:JSON.stringify({caseId:'paper-profit',stageId:'withdrawal',sceneId:'peer',resolved:false,joined:true,attachment:'none',inputMode:'story-message',messages:[{role:'user',content:text}],userTurnCount:1,...overrides})});
let calls=0;
const originalFetch=globalThis.fetch,originalKey=process.env.GEMINI_API_KEY,originalEnabled=process.env.GEMINI_ENABLED,originalNow=Date.now;
let clock=1_800_000_000_000;
Date.now=()=>clock;
const successful=(reaction='check',reply='알려주셔서 고마워요. 안내부터 다시 볼게요.')=>Response.json({candidates:[{finishReason:'STOP',content:{parts:[{text:JSON.stringify({reply,reaction})}]}}]});
try{
 process.env.GEMINI_ENABLED='true';process.env.GEMINI_API_KEY='mock-only-not-a-real-key';
 globalThis.fetch=async()=>{calls++;return successful();};
 let route=await freshRoute();
 assert.equal((await (await route.GET()).json()).enabled,true);assert.equal(calls,0);
 const results=await Promise.all(Array.from({length:5},()=>route.POST(request())));
 assert.equal(calls,1);for(const result of results)assert.equal(result.status,200);
 assert.equal((await route.POST(request())).status,200);assert.equal(calls,1,'exact duplicate coalesces');
 clock+=12000;
 assert.equal((await (await route.POST(request('다른 메시지'))).json()).code,'moment_used');
 assert.equal(calls,1,'changed text cannot reopen a consumed scene');
 clock+=12000;
 globalThis.fetch=async()=>{calls++;return successful('together','말해 줘서 고마워. 내가 전화할게.');};
 assert.equal((await route.POST(request('같이 확인해 줘',undefined,{sceneId:'friend',resolved:true}))).status,200);
 assert.equal(calls,2,'two distinct scenes per run');
 clock+=12000;
 assert.equal((await route.POST(request('다른 내용',undefined,{sceneId:'friend',resolved:true}))).status,429);
 globalThis.fetch=async()=>{calls++;return successful();};
 assert.equal((await route.POST(request('안내부터 확인','different-session-01'))).status,200);
 assert.equal(calls,3,'no cross-player response reuse');

 route=await freshRoute();calls=0;
 for(const overrides of [{sceneId:'invented'},{caseId:'familiar-request'},{sceneId:'friend',resolved:false},{stageId:'arrival',resolved:false},{joined:false},{attachment:'invented'},{choices:[]},{checks:[]},{userTurnCount:2},{messages:[{role:'assistant',content:'hi'},{role:'user',content:'hi'}]}]){
  assert.equal((await route.POST(request('확인',undefined,overrides))).status,400,JSON.stringify(overrides));
 }
 assert.equal((await (await route.POST(request('질문',undefined,{inputMode:'free'}))).json()).code,'story_message_required');
 assert.equal(calls,0);
 const builtin=await (await route.POST(request('네',undefined,{inputMode:undefined}))).json();
 assert.equal(builtin.provider,'scripted');assert.equal(calls,0);

 delete process.env.GEMINI_API_KEY;
 assert.equal((await (await route.POST(request())).json()).code,'ai_unconfigured');assert.equal(calls,0);
 process.env.GEMINI_API_KEY='mock-only-not-a-real-key';
 for(const [value,code] of [
  [{reply:'괜찮아요?',reaction:'check'},'unsafe_response'],
  [{reply:'알려줘서 고마워요.',reaction:'refund'},'unsafe_response'],
  [{reply:'알려줘서 고마워요.',reaction:'check',amount:999},'unsafe_response'],
  [{reply:'https://example.invalid로 연락하세요',reaction:'check'},'unsafe_response']
 ]){
  route=await freshRoute();calls=0;globalThis.fetch=async()=>{calls++;return Response.json({candidates:[{finishReason:'STOP',content:{parts:[{text:JSON.stringify(value)}]}}]});};
  assert.equal((await (await route.POST(request())).json()).code,code);assert.equal(calls,1);
  clock+=12000;assert.equal((await (await route.POST(request('재시도'))).json()).code,'moment_used');assert.equal(calls,1);
 }
 route=await freshRoute();calls=0;globalThis.fetch=async()=>{calls++;return Response.json({candidates:[{finishReason:'MAX_TOKENS',content:{parts:[{text:'{}'}]}}]});};
 assert.equal((await (await route.POST(request())).json()).code,'incomplete_response');assert.equal(calls,1);
 route=await freshRoute();calls=0;globalThis.fetch=async()=>{calls++;return new Response(null,{status:429});};
 assert.equal((await (await route.POST(request())).json()).code,'provider_quota');
 assert.equal((await (await route.POST(request('다른 메시지'))).json()).code,'provider_cooldown');assert.equal(calls,1);
 for(const outcome of ['exhausted','unavailable']){
  globalThis.__budgetOutcome=outcome;route=await freshRoute();calls=0;globalThis.fetch=async()=>{calls++;return successful();};
  assert.equal((await (await route.POST(request())).json()).code,outcome==='exhausted'?'budget_exhausted':'budget_unavailable');assert.equal(calls,0);
 }
 delete globalThis.__budgetOutcome;
 await testClientCancellation();await testSecurity();
 route=await freshRoute();let captured;
 globalThis.fetch=async(_url,options)=>{captured=JSON.parse(options.body);return successful();};
 assert.equal((await route.POST(request('예전 안내를 봐주세요','prompt-session-0001',{attachment:'first-notice'}))).status,200);
 assert.ok(captured.systemInstruction.parts[0].text.includes('자료를 읽는 것과 별도 참여는 구분됩니다'));
 assert.equal(captured.generationConfig.responseMimeType,'application/json');
 assert.equal(captured.contents.length,1);
 console.log('One-shot AI tests passed: two windows, legacy disabled, exact coalescing, no retry, schema, provider and shared-budget failures.');
}finally{
 if(originalEnabled===undefined)delete process.env.GEMINI_ENABLED;else process.env.GEMINI_ENABLED=originalEnabled;
 if(originalKey===undefined)delete process.env.GEMINI_API_KEY;else process.env.GEMINI_API_KEY=originalKey;
 globalThis.fetch=originalFetch;Date.now=originalNow;delete globalThis.__budgetOutcome;
}
async function testClientCancellation() {
  const {ReplyGate}=await import('../app/story/reply-gate.js');
  for(const context of ['block','app-switch','chapter','pause','unmount','rewind']){
    const gate=new ReplyGate();let release,requests=0,accepted=0,signal;
    const pending=new Promise(resolve=>{release=resolve;});
    const first=gate.run(async value=>{signal=value;requests++;await pending;return 'late';},()=>{accepted++;});
    await gate.run(async()=>{requests++;return 'duplicate';},()=>{accepted++;});
    assert.equal(requests,1,context+': double submit');
    gate.cancel();release();await first;
    assert.equal(signal.aborted,true,context);
    assert.equal(accepted,0,context+': stale reply');
    assert.equal(gate.pending,null);
  }
  const gate=new ReplyGate();let result;
  await gate.run(async()=> 'local fallback',value=>{result=value;});
  assert.equal(result,'local fallback');
  globalThis.fetch=async()=>{calls++;return successful();};
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
  assert.equal((await (await route.POST(request('네',undefined,{inputMode:undefined}))).json()).provider, 'scripted');
  assert.equal(calls, 3, 'operator switch must not disable scripted gameplay or call provider');
  process.env.GEMINI_ENABLED = 'true';

  route = await freshRoute();
  let providerBody;
  globalThis.fetch = async (_url, options) => { providerBody = options.body; return successful(); };
  await route.POST(request('질문', 'privacy-session-0001', {
    messages: [{ role: 'user', content: 'abc@example.invalid https://example.invalid 010-1234-5678 설명 부탁드립니다' }],
    userTurnCount: 1,
  }));
  assert.ok(providerBody);
  assert.ok(!providerBody.includes('abc@example.invalid') && !providerBody.includes('https://example.invalid') && !providerBody.includes('010-1234-5678'), 'sanitize both roles before provider access');
  assert.equal(dialogue.validateAiReply('abc@example.invalid로 연락하세요'), false);
  assert.notEqual(dialogue.inferDialogueEmotion([{ role: 'user', content: '어떻게 생각해?' }]), 'disappointed');
  assert.equal(dialogue.inferDialogueEmotion([{ role: 'user', content: '생각해 볼게' }]), 'disappointed');
  console.log('Security request tests passed: origin, media type, body deadline, schema, forwarding, concurrency, kill switch, privacy.');
}

const paper=cases.find(c=>c.id==='paper-profit'),recovery=cases.find(c=>c.id==='recovery-team');
assert.equal(dialogue.validateCharacterChoices(recovery,'arrival',['recovery-offer-share']),false,'future disclosures rejected');
assert.equal(dialogue.validateCharacterChoices(recovery,'arrival',['recovery-scope-name','recovery-scope-first']),false,'contradictory choices rejected');
const privatePrompt=dialogue.buildSystemPrompt(recovery,[{role:'user',content:'누구세요?'}],1,'arrival',[]);
assert.ok(privatePrompt.includes('플레이어가 이 상대에게 전달한 정보: 없음'));
const sharedPrompt=dialogue.buildSystemPrompt(recovery,[{role:'user',content:'그다음은요?'}],2,'offer',['recovery-scope-name','recovery-explain-loss']);
assert.ok(sharedPrompt.includes('service / loss'));
assert.ok(!dialogue.buildSystemPrompt(paper,[{role:'user',content:'자료란 뭔가요?'}],1,'arrival',[]).includes('현재 출금이 보류'),'no future plot in early prompt');
