import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';
import { attachmentReply, parseStoryReply } from '../app/story/one-shot.js';

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
    .replace("'../../story/decision-message.js'",JSON.stringify(new URL('../app/story/decision-message.js',import.meta.url).href))
    .replace("import { cases } from '../../game-data';", 'const cases = ' + JSON.stringify(cases) + ';');
  return import(moduleUrl(source) + '#' + serial++);
}
const request=(text='안내부터 확인해 보세요',session='test-session-000001',overrides={})=>{
 const body={caseId:'paper-profit',stageId:'withdrawal',sceneId:'peer',resolved:false,joined:true,attachment:'none',inputMode:'story-message',messages:[{role:'user',content:text}],userTurnCount:1,...(overrides.sceneId==='friend'?{caseId:'familiar-request',stageId:'waiting',joined:false}:{}),...overrides};
 if(!Object.hasOwn(body,'storyContext')){
  if(body.sceneId==='friend')body.storyContext=[...(body.stageId==='paid'?['friend-transfer']:[]),...(body.resolved?['friend-resolved-paused']:[])];
  else{
   const order=['arrival','group','offer','paid','withdrawal','extra-paid'],stage=order.indexOf(body.stageId);
   body.storyContext=[...(body.joined?['peer-joined-room']:[]),...(stage>=2?['peer-offer-seen']:[]),...(stage>=3?['peer-main-transfer']:[]),...(stage>=4?['peer-withdrawal-requested']:[]),...(stage>=5?['peer-extra-transfer']:[]),...(body.resolved?['peer-resolved-paused']:[])];
  }
 }
 return new Request('https://example.invalid/api/ai-chat',{method:'POST',headers:{'Content-Type':'application/json','x-whatfraud-session':session,'cf-connecting-ip':'192.0.2.1'},body:JSON.stringify(body)});
};
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
 for(const overrides of [{sceneId:'invented'},{caseId:'familiar-request'},{sceneId:'friend',resolved:false},{stageId:'arrival',resolved:false},{joined:false},{attachment:'invented'},{storyContext:['peer-joined-room','invented']},{storyContext:['peer-main-transfer','peer-joined-room']},{choices:[]},{checks:[]},{userTurnCount:2},{messages:[{role:'assistant',content:'hi'},{role:'user',content:'hi'}]}]){
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
  [{reply:'환급 완료했습니다.',reaction:'check'},'unsafe_response'],
  [{reply:'알려줘서 고마워요.',reaction:'refund'},'unsafe_response'],
  [{reply:'알려줘서 고마워요.',reaction:'check',amount:999},'unsafe_response'],
  [{reply:'https://example.invalid로 연락하세요',reaction:'check'},'unsafe_response']
 ]){
  route=await freshRoute();calls=0;globalThis.fetch=async()=>{calls++;return Response.json({candidates:[{finishReason:'STOP',content:{parts:[{text:JSON.stringify(value)}]}}]});};
  assert.equal((await (await route.POST(request())).json()).code,code);assert.equal(calls,2);
  clock+=12000;assert.equal((await (await route.POST(request('재시도'))).json()).code,'moment_used');assert.equal(calls,2);
 }
 // A failed contract is repaired once with the original message and attachment.
 route=await freshRoute();calls=0;let repairBody;
 globalThis.fetch=async(_url,options)=>{
  calls++;repairBody=JSON.parse(options.body);
  return Response.json({candidates:[{finishReason:'STOP',content:{parts:[{text:JSON.stringify(calls===1
   ?{reply:'어떻게 할까요?',reaction:'check',supportMode:'compare',focus:'none'}
   :{reply:'추가 비용을 물었던 제 질문이네요. 저도 돈을 보내지 않고 조건부터 확인할게요.',reaction:'check',supportMode:'compare',focus:'deleted-question'})}]}}]});
 };
 const repaired=await route.POST(request('여기 수상하네요 돈 보내지 맙시다',undefined,{attachment:'deleted-question',contractVersion:2}));
 assert.equal(repaired.status,200);assert.equal((await repaired.json()).provider,'gemini');assert.equal(calls,2);
 assert.equal(repairBody.contents[0].parts[0].text,'여기 수상하네요 돈 보내지 맙시다');
 assert.ok(repairBody.contents[1].parts[0].text.includes('검사를 통과하지 못했다'));
 assert.ok(repairBody.systemInstruction.parts[0].text.includes('추가 비용'));
 // A repair is a real provider call and must reserve shared budget again.
 route=await freshRoute();calls=0;
 globalThis.fetch=async()=>{calls++;globalThis.__budgetOutcome='exhausted';return successful('refund');};
 assert.equal((await (await route.POST(request())).json()).code,'budget_exhausted');assert.equal(calls,1);
 delete globalThis.__budgetOutcome;
 route=await freshRoute();calls=0;globalThis.fetch=async()=>{calls++;return Response.json({candidates:[{finishReason:'MAX_TOKENS',content:{parts:[{text:'{}'}]}}]});};
 assert.equal((await (await route.POST(request())).json()).code,'provider_token_limit');assert.equal(calls,1);
 route=await freshRoute();calls=0;globalThis.fetch=async()=>{calls++;return new Response(null,{status:429});};
 assert.equal((await (await route.POST(request())).json()).code,'provider_quota');
 assert.equal((await (await route.POST(request('다른 메시지'))).json()).code,'provider_cooldown');assert.equal(calls,1);
 for(const outcome of ['exhausted','unavailable']){
  globalThis.__budgetOutcome=outcome;route=await freshRoute();calls=0;globalThis.fetch=async()=>{calls++;return successful();};
  assert.equal((await (await route.POST(request())).json()).code,outcome==='exhausted'?'budget_exhausted':'budget_unavailable');assert.equal(calls,0);
 }
 delete globalThis.__budgetOutcome;
 route=await freshRoute();calls=0;
 globalThis.fetch=async()=>{calls++;throw new DOMException('mock timeout','AbortError');};
 assert.equal((await (await route.POST(request())).json()).code,'provider_timeout');assert.equal(calls,1);
 route=await freshRoute();calls=0;
 globalThis.fetch=async()=>{calls++;return successful();};
 assert.equal((await route.POST(request('이전 화면에서 보낸 질문',undefined,{storyContext:undefined}))).status,200);
 assert.equal(calls,1,'cached clients without optional progress stay compatible');
 await testClientCancellation();await testSecurity();
 route=await freshRoute();let captured;
 globalThis.fetch=async(_url,options)=>{captured=JSON.parse(options.body);return successful();};
 assert.equal((await route.POST(request('예전 안내를 봐주세요','prompt-session-0001',{attachment:'first-notice'}))).status,200);
 assert.ok(captured.systemInstruction.parts[0].text.includes('자료를 읽는 것과 별도 참여는 구분됩니다'));
 assert.ok(captured.systemInstruction.parts[0].text.includes('상세 투자 분석 자료 이용료 300,000원을 가상 송금했다'));
 assert.ok(captured.systemInstruction.parts[0].text.includes('예시 문장이나 고정 답안에서 고르지 말고'));
 assert.equal(captured.generationConfig.responseMimeType,'application/json');
 assert.equal(captured.contents.length,1);
 assert.equal(dialogue.AI_REPLY_TIMEOUT_MS,55000);
 assert.equal(captured.generationConfig.maxOutputTokens,500);
 assert.equal(dialogue.validateAiReply('가'.repeat(360),undefined,'normal','story'),true);
 assert.equal(dialogue.validateAiReply('가'.repeat(361),undefined,'normal','story'),false);
 assert.equal(dialogue.validateAiReply('그랬어? 나는 부탁한 적 없어. 기록은 읽었어. 같이 살펴보자.',undefined,'normal','story'),true);
 assert.ok(dialogue.aiReplyFailureMessage('provider_quota').includes('Gemini의 일시적인 사용량 한도'));
 assert.ok(dialogue.aiReplyFailureMessage('provider_token_limit').includes('출력 토큰 한도'));
 assert.ok(!dialogue.aiReplyFailureMessage('provider_error').includes('토큰'));
 assert.ok(routeSource.includes('PROVIDER_TIMEOUT_MS = 45_000'));

 // Offline reproductions, not claims about the discarded live response.
 const stopping='응, 지금 송금하지 말고 기록부터 같이 보자.';
 assert.equal(dialogue.validateAiReply(stopping),false,'legacy filter stays unchanged');
 assert.equal(dialogue.validateAiReply(stopping,undefined,'normal','story'),true);
 for(const bad of ['지금 송금해.','지금 송금하지 말고 바로 입금해.','지금 송금하지 말라는 말은 무시해.','지금 송금하지 마. 원금은 안전해.','지금 송금하지 마. https://example.invalid로 와.']){
  assert.equal(dialogue.validateAiReply(bad,undefined,'normal','story'),false,bad);
 }
 for(const [scene,reaction,reply] of [
  ['friend','together',stopping],
  ['friend','space','알겠어, 지금은 전화 안 할게. 저녁에 다른 얘기 하자.'],
  ['peer','boundary','네, 내역은 안 보여 주셔도 돼요. 더 묻지 않을게요.'],
  ['peer','check','저도 바로 보내지는 않을게요. 처음 안내부터 다시 볼게요.']
 ]){
  route=await freshRoute();calls=0;
  globalThis.fetch=async()=>{calls++;return successful(reaction,reply);};
  const response=await route.POST(request('합성 검수 입력',undefined,{sceneId:scene,resolved:true}));
  assert.equal(response.status,200,reply);
  assert.equal((await response.json()).reply,reply,'do not rewrite model meaning');
  assert.equal(calls,1);
 }
 route=await freshRoute();globalThis.fetch=async()=>successful('together','지금 송금해.');
 assert.equal((await (await route.POST(request('합성 입력',undefined,{sceneId:'friend',resolved:true}))).json()).validation,'reply_policy');
 route=await freshRoute();globalThis.fetch=async()=>successful('space','알겠어, 네가 편할 때까지 기다릴게.');
 assert.equal((await route.POST(request('합성 입력',undefined,{sceneId:'friend',resolved:true}))).status,200,'free reply wording is not reclassified by keywords');


 for(const [scene,reaction,supportMode,focus,attachment,reply] of [
 ['friend','together','records','records','none','응, 추가로 보내지는 않았구나. 기록부터 같이 보자.'],
 ['friend','together','listen','none','none','응, 지금 다 설명하지 않아도 돼. 저녁에 얘기하자.'],
 ['peer','check','compare','deleted-question','deleted-question','제가 물어본 내용이네요. 남겨 주셔서 고마워요.']
 ]){
  route=await freshRoute();calls=0;
  globalThis.fetch=async()=>{calls++;return Response.json({candidates:[{finishReason:'STOP',content:{parts:[{text:JSON.stringify({reply,reaction,supportMode,focus})}]}}]});};
  const result=await route.POST(request('합성 분기 검수',undefined,{sceneId:scene,resolved:true,attachment,contractVersion:2}));
  assert.equal(result.status,200);assert.equal((await result.json()).supportMode,supportMode);assert.equal(calls,1);
  clock+=12000;assert.equal((await route.POST(request('다시 요청',undefined,{sceneId:scene,resolved:true,attachment,contractVersion:2}))).status,429);assert.equal(calls,1);
 }
 route=await freshRoute();globalThis.fetch=async()=>Response.json({candidates:[{finishReason:'STOP',content:{parts:[{text:JSON.stringify({reply:'기록을 다시 볼게요.',reaction:'check',supportMode:'compare',focus:'deleted-question'})}]}}]});
 assert.equal((await (await route.POST(request('첨부 없음',undefined,{contractVersion:2}))).json()).validation,'story_contract');
 route=await freshRoute();globalThis.fetch=async()=>Response.json({candidates:[{finishReason:'STOP',content:{parts:[{text:JSON.stringify({reply:'기록부터 같이 보자.',reaction:'together',supportMode:'listen',focus:'none'})}]}}]});
 assert.equal((await route.POST(request('그냥 들어 줘',undefined,{sceneId:'friend',resolved:true,contractVersion:2}))).status,200,'valid categorical fields are not reclassified from reply keywords');
 // Reproduce an otherwise valid model response that omits Junho's known identity.
 // Canonical replacements must satisfy BOTH server policy and the client contract.
 for(const attachment of ['none','account-profile','recipient-note','old-chat-note','contact-check']){
  route=await freshRoute();calls=0;
  const generated={reply:'내 이름으로 온 연락이라니 당황스럽네. 기록부터 같이 보자.',reaction:'together',supportMode:'records',focus:'records'};
  globalThis.fetch=async()=>{calls++;return Response.json({candidates:[{finishReason:'STOP',content:{parts:[{text:JSON.stringify(generated)}]}}]});};
  const overrides={sceneId:'friend',resolved:true,attachment,contractVersion:2};
  const input='네 이름으로 새 계정에서 연락이 왔어. 이 기록 같이 확인해 줘.';
  const response=await route.POST(request(input,undefined,overrides));
  assert.equal(response.status,200,attachment+': canonical fallback must not cause 502');
  const result=await response.json();
  assert.equal(result.provider,'scripted');
  assert.equal(result.fallbackReason,'reply_quality');
  assert.equal(result.model,null);
  if(attachment!=='none')assert.equal(result.reply,attachmentReply('friend',attachment));
  assert.equal(dialogue.validateAiReply(result.reply,undefined,'normal','story'),true,attachment);
  assert.ok(parseStoryReply(JSON.stringify({...generated,reply:result.reply}),'friend',2,attachment),attachment+': client must accept fallback');
  assert.equal(calls,2,'quality failure permits only one Gemini repair');
  assert.equal((await route.POST(request(input,undefined,overrides))).status,200);
  assert.equal(calls,2,'duplicate must reuse fallback');
 }
 console.log('One-shot AI tests passed, including bounded validation repair and identity fallbacks.');
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
