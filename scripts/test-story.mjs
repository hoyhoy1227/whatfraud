import assert from 'node:assert/strict';
import * as e from '../app/story/engine.js';
import {closureScene,closureComplete,messageStatus} from '../app/story/one-shot.js';
// Financial path fixtures explicitly decline optional conversation before advancing.
const step=(s,type,data='')=>{
 if(type==='next'&&e.isResolved(s)&&!closureComplete(s)){
  const scene=closureScene(s);
  if(['ready','attempt'].includes(messageStatus(s,scene)))s=e.transition(s,{type:'message',chapter:s.chapter,data:scene+':skip'});
  s=e.transition(s,{type:'message-close',chapter:s.chapter,data:scene});
 }
 return e.transition(s,{type,chapter:s.chapter,data});
};
const inspectAll=s=>e.currentCase(s).story.evidence.reduce((v,clue)=>step(v,'inspect',e.currentCase(v).id+':'+clue.id),s);
const finish=(s,kind)=>step(step(s,'resolve',kind),'next');
const spend=s=>{const offer=e.offerFor(s);assert.ok(offer);return step(s,'confirm',offer.id);};
assert.equal(e.chapters.length,3);
for(const kind of ['paused','blocked','verified']){
 let s=e.createRun();
 for(let chapter=0;chapter<3;chapter++){
  assert.equal(s.chapter,chapter);
  if(kind==='verified')s=inspectAll(s);
  s=finish(s,kind);
 }
 assert.equal(s.completed,true);assert.equal(e.totalSpent(s),0);
 assert.equal(e.endingFor(s).title,'지켜낸 하루');
 assert.deepEqual(e.restoreRun(e.serializeRun(s)),s);
 assert.equal(e.transition(s,{type:'confirm',chapter:2,data:'recovery-team:main'}),s);
}
// Cross-product paths: no forced loss and every safe ending remains reachable.
for(const a of ['paused','blocked','verified','loss']){
 for(const b of ['paused','blocked','verified','loss']){
  for(const c of ['paused','blocked','verified','reported','loss']){
   let s=e.createRun();
   for(const kind of [a,b,c]){
    if(kind==='verified'||kind==='reported')s=inspectAll(s);
    if(kind==='reported')s=step(s,'save',e.currentCase(s).id+':official-help');
    if(kind==='loss'){
     s=step(s,'advance');if(s.chapter===1)s=step(s,'advance');
     s=spend(s);
     if(s.chapter===1){s=step(s,'withdraw');s=spend(s);}
    }
    const previous=s;s=step(s,'resolve',kind);assert.notEqual(s,previous,kind);
    s=step(s,'next');
   }
   assert.equal(s.completed,true);
   assert.ok(e.totalSpent(s)<=e.INITIAL_BALANCE);
   assert.equal(s.transactions.length,new Set(s.transactions.map(t=>t.id)).size);
   assert.deepEqual(e.restoreRun(e.serializeRun(s)),s);
  }
 }
}
let s=e.createRun();
assert.equal(step(s,'confirm','familiar-request:main'),s,'cannot pay before offer');
assert.equal(step(s,'resolve','verified'),s,'cannot fabricate verification');
assert.equal(step(s,'resolve','reported'),s,'cannot report without records');
assert.equal(step(s,'resolve','loss'),s,'cannot invent a loss ending');
assert.equal(step(s,'save','familiar-request:recipient'),s,'cannot save unopened record');
assert.equal(step(s,'inspect','recovery-team:official-help'),s,'no future evidence');
const original=s;
s=step(s,'advance');s=spend(s);
assert.equal(e.totalSpent(s),80000);
assert.equal(step(s,'confirm','familiar-request:main'),s,'double confirmation idempotent');
assert.equal(original.transactions.length,0,'pure reducer');
s=finish(s,'stopped');
s=step(s,'advance');s=step(s,'platform');s=spend(s);s=step(s,'withdraw');
s=finish(s,'stopped');
assert.ok(e.recoveryContext(s).includes('돈이 나간'));
s=inspectAll(s);s=step(s,'save','recovery-team:official-help');s=finish(s,'reported');
assert.equal(e.endingFor(s).title,'멈춰 세운 하루');
assert.equal(e.totalSpent(s),380000,'report never refunds');
const saved=e.serializeRun(s);
assert.ok(!saved.includes('content')&&!saved.includes('messages')&&!saved.includes('balance'),'no chat or trusted balances');
for(const pivot of e.timeline(s)){
 const before=e.replayBefore(s,pivot.index);
 assert.ok(before);assert.equal(before.events.length,pivot.index);
 assert.equal(e.serializeRun(s),saved,'rewind leaves original intact');
}
for(const value of [null,'not json',{version:1,events:[]},{version:3,mode:'full',events:[{type:'confirm',chapter:0,data:'familiar-request:main'}]},
 {version:3,mode:'full',events:[{type:'advance',chapter:1,data:''}]},
 {version:3,mode:'full',events:[{type:'advance',chapter:0,data:'',content:'private'}]},
 {version:3,mode:'full',events:Array(601).fill({type:'advance',chapter:0,data:''})}]){
 assert.equal(e.restoreRun(value),null);
}
assert.equal(e.restoreRun({version:3,mode:'full',events:[],balance:999999}).transactions.length,0,'untrusted balance ignored');
s=e.createRun();s=step(s,'resolve','blocked');assert.equal(step(s,'call','current'),s,'blocked contact cannot call');
s=e.createRun();const cue=step(s,'cue','familiar-request:routine');
assert.equal(cue.stage,'arrival');assert.equal(e.totalSpent(cue),0);assert.equal(step(cue,'cue','familiar-request:routine'),cue);
assert.equal(step(s,'next'),s,'unfinished act cannot be skipped');
s=e.createRun('demo');assert.equal(s.chapter,1);assert.equal(s.mode,'demo');
s=finish(s,'paused');assert.ok(e.recoveryContext(s).includes('참여한 적 없는'));
s=e.createRun('demo');s=step(s,'advance');s=finish(s,'paused');assert.ok(e.recoveryContext(s).includes('돈을 보내지는'));
console.log('Story tests passed: 80 path combinations, no forced loss, idempotency, verification/report gates, privacy, restore, rewind, contextual recovery.');

const {budgetKey,restoreBudget}=await import('../app/story/session-budget.js');
assert.notEqual(budgetKey('full'),budgetKey('demo'),'demo budget must not overwrite campaign budget');
const used=restoreBudget({session:'test-session-0000001',counts:[1,2,1],last:12,cooldown:0},'replacement');
assert.deepEqual(used.counts,[1,2,1]);
assert.deepEqual(restoreBudget({session:'bad',counts:[9,9,9]},'replacement').counts,[0,0,0]);
console.log('Separate campaign/demo budget restore passed.');

const n=await import('../app/story/narrative.js');
for(let chapter=0;chapter<3;chapter++){
 assert.ok(n.narratives[chapter].background.length>=2);
 assert.ok(n.narratives[chapter].beats.length>=5);
 let v=e.createRun();while(v.chapter<chapter)v=finish(v,'paused');
 const initial=v;
 const beat=n.pendingBeat(v);assert.ok(beat);
 const option=beat.options.find(o=>n.choiceAllowed(v,o));
 v=step(v,'talk',option.id);assert.notEqual(v,initial);
 assert.equal(step(v,'talk',option.id),v,'same choice once');
 assert.deepEqual(e.restoreRun(e.serializeRun(v)),v,'authored choices restore');
 assert.ok(n.authoredMessages(v,v.stage).some(m=>m.speaker==='나'));
 const alternative=beat.options.find(o=>o.id!==option.id);
 assert.equal(step(v,'talk',alternative.id),v,'exclusive choice');
 assert.equal(step(v,'talk','invented-choice'),v);
 v=step(v,'resolve','paused');assert.equal(step(v,'talk',option.id),v);
 v=step(v,'reflect','tell');assert.deepEqual(e.restoreRun(e.serializeRun(v)),v);
 assert.equal(step(v,'reflect','keep'),v,'reflection once');
}
let undisclosed=e.createRun('demo');undisclosed=finish(undisclosed,'paused');
assert.equal(n.choiceAllowed(undisclosed,n.findChoice(2,'recovery-explain-loss').choice),false);
assert.equal(step(undisclosed,'talk','recovery-explain-loss'),undisclosed,'cannot invent prior loss');
console.log('Narrative choice tests passed: prerequisites, disclosure, exclusivity, restore and aftercare.');

assert.equal(n.aiMoment('paper-profit','arrival'),null);
assert.equal(n.aiMoment('paper-profit','offer'),'paper-entry');
assert.equal(n.aiMoment('paper-profit','withdrawal'),'paper-withdrawal');
assert.equal(n.aiMoment('familiar-request','request'),n.aiMoment('familiar-request','waiting'));
assert.equal(n.aiMoment('recovery-team','paid'),null);
const baseLines=[{speaker:'운영자',text:'처음 안내'},{speaker:'나',text:'선택 질문'},{speaker:'운영자',text:'선택 답장'}];
const transient=[{role:'user',content:'자유 질문',anchor:1,speaker:'운영자'},{role:'assistant',content:'자유 답장',anchor:1,speaker:'운영자'}];
assert.deepEqual(n.conversationTimeline(baseLines,transient).map(m=>m.text),['처음 안내','자유 질문','자유 답장','선택 질문','선택 답장']);
assert.deepEqual(n.conversationTimeline(baseLines,transient,1).map(m=>m.text),['처음 안내','자유 질문','자유 답장']);
const restoredBudget=restoreBudget({session:'test-session-0000001',counts:[0,1,0],last:12,cooldown:0,moments:['paper-entry','paper-entry','invented']},'replacement');
assert.deepEqual(restoredBudget.moments,['paper-entry']);
assert.deepEqual(used.moments,[],'old budget remains compatible and retains counts');
let told=e.createRun();told=step(told,'resolve','paused');told=step(told,'reflect','tell');told=step(told,'next');
assert.ok(!n.friendFollowup(told).includes('기억해'),'previous incident does not open as a current conversation');
assert.ok(!n.friendFollowup(e.createRun('demo')).includes('기억해'),'unshared events stay private');
console.log('Decision windows, chronological chat, quota restore and relationship memory passed.');

assert.equal(n.decisionReadyFor('familiar-request','request',['familiar-request-what'],[]),false);
assert.equal(n.decisionReadyFor('familiar-request','request',['familiar-request-what'],['recipient']),true);
assert.equal(n.decisionReadyFor('paper-profit','offer',[],['success-post']),false);
assert.equal(n.decisionReadyFor('paper-profit','offer',['paper-offer-withdraw'],['success-post']),true);
assert.equal(n.decisionReadyFor('paper-profit','withdrawal',['paper-withdraw-old'],['success-post']),false);
assert.equal(n.decisionReadyFor('paper-profit','withdrawal',['paper-withdraw-old'],['terms-comparison']),true);
assert.equal(n.decisionReadyFor('recovery-team','offer',['recovery-offer-hold','recovery-offer-why'],['official-help']),true);
let captured=e.createRun('demo');
assert.equal(step(captured,'capture','paper-question'),captured);
captured=step(captured,'advance');
assert.ok(n.displayedMessages(captured,'group').some(m=>m.text===n.retainedQuestion.text));
captured=step(captured,'capture','paper-question');captured=step(captured,'advance');captured=step(captured,'confirm','paper-profit:main');
assert.equal(step(captured,'observe','terms-comparison'),captured);
captured=step(captured,'withdraw');captured=step(captured,'observe','terms-comparison');
assert.ok(!n.displayedMessages(captured,'group').some(m=>m.text===n.retainedQuestion.text));
assert.deepEqual(e.restoreRun(e.serializeRun(captured)),captured);
assert.ok(!e.serializeRun(captured).includes(n.retainedQuestion.text));
assert.equal(step(captured,'capture','paper-question'),captured);
assert.ok(n.decisionChecks(captured).includes('terms-comparison'));
console.log('Evidence gates, retained deletion and profile metadata passed.');

const shot=await import('../app/story/one-shot.js');

for(const mode of ['full','demo']){
 let run=e.createRun(mode);
 if(mode==='demo')run=step(run,'advance');
 run=step(run,'resolve','paused');
 const scene=shot.closureScene(run);
 assert.equal(scene,mode==='full'?'friend':'peer');
 assert.equal(e.transition(run,{type:'next',chapter:run.chapter,data:''}),run,'unclosed dialogue blocks next');
 assert.ok(shot.messageWindow(run,scene));
 const money=e.totalSpent(run);
 run=step(run,'message',scene+':attempt');
 assert.equal(step(run,'message',scene+':attempt'),run);
 run=step(run,'message',scene==='friend'?'friend:together':'peer:check');
 run=step(run,'message-style',scene==='friend'?'friend:records:records':'peer:cautious:none');
 assert.equal(step(run,'message-close',scene),run,'read the followup before closing');
 run=step(run,'message-followup',scene==='friend'?'friend:call':'peer:record');
 run=step(run,'message-close',scene);
 assert.equal(step(run,'message-close',scene),run);
 assert.deepEqual(e.restoreRun(e.serializeRun(run)),run);
 const oldChapter=run.chapter;
 run=step(run,'next');
 assert.equal(run.chapter,oldChapter+1);
 assert.equal(e.totalSpent(run),money);
 assert.equal(shot.messageWindow(run,scene),false);
 assert.equal(step(run,'message-followup',scene==='friend'?'friend:call':'peer:record'),run);
 assert.equal(e.transition(run,{type:'message',chapter:oldChapter,data:scene+':together'}),run,'late old response rejected');
 assert.deepEqual(e.restoreRun(e.serializeRun(run)),run);
}
const presentation=await import('../app/story/presentation.js');
let morning=step(e.createRun(),'resolve','blocked');
assert.ok(presentation.messageThreadVisible(morning,'friend'));
assert.ok(!presentation.messageOpening(morning,'friend').includes('퇴근'));
morning=step(morning,'message','friend:space');morning=step(morning,'message-close','friend');
let afternoon=step(morning,'next');
assert.equal(presentation.messageThreadVisible(afternoon,'friend'),false);
assert.equal(step(afternoon,'message','friend:attempt'),afternoon);
assert.equal(presentation.supportReady({...afternoon,chapter:2}),false);
assert.equal(shot.branchUseAllowed({...afternoon,chapter:2},'verify'),false);
const context=await import('../app/story/context.js');
assert.equal(afternoon.scenePage,0);
assert.equal(afternoon.sceneEntered,false);
const pageEvent={type:'scene-page',chapter:1,data:'0'};
afternoon=e.transition(afternoon,pageEvent);
assert.equal(afternoon.scenePage,1);
assert.equal(e.transition(afternoon,pageEvent),afternoon,'double click cannot consume another page');
assert.deepEqual(e.restoreRun(e.serializeRun(afternoon)),afternoon);
afternoon=step(afternoon,'scene-enter');
assert.equal(afternoon.sceneEntered,true);
assert.equal(step(afternoon,'scene-enter'),afternoon);
assert.ok(!context.dinnerContext({...afternoon,chapter:2}).includes('기록을 같이'));
const legacy={version:3,mode:'full',events:[
 {type:'advance',chapter:0,data:''},
 {type:'confirm',chapter:0,data:'familiar-request:main'},
 {type:'inspect',chapter:0,data:'familiar-request:recipient'},
 {type:'save',chapter:0,data:'familiar-request:recipient'},
 {type:'resolve',chapter:0,data:'stopped'},
 {type:'next',chapter:0,data:''},
 {type:'resolve',chapter:1,data:'paused'},
 {type:'message',chapter:1,data:'friend:attempt'}
]};
let migrated=e.restoreRun(legacy);
assert.ok(migrated);
assert.equal(migrated.chapter,1);
assert.equal(migrated.version,4);
assert.equal(e.totalSpent(migrated),80000);
assert.ok(migrated.saved.includes('familiar-request:recipient'));
assert.equal(migrated.events.filter(x=>x.type==='message'&&x.data.endsWith(':attempt')).length,1,'legacy quota survives');
assert.equal(shot.messageWindow(migrated,'friend'),false);
assert.equal(presentation.messageThreadVisible(migrated,'friend'),false);
assert.deepEqual(e.restoreRun(e.serializeRun(migrated)),migrated);
migrated=step(migrated,'next');assert.equal(migrated.chapter,2);
assert.deepEqual(e.restoreRun(e.serializeRun(migrated)),migrated);
for(const pivot of e.timeline(migrated))assert.ok(e.replayBefore(migrated,pivot.index));
for(const scene of ['friend','peer']){
 const request={sceneId:scene,caseId:scene==='friend'?'familiar-request':'paper-profit',stageId:scene==='friend'?'arrival':'withdrawal',resolved:true,joined:scene==='peer',attachment:'none'};
 assert.equal(shot.validateStoryContext(request),true);
 assert.equal(shot.validateStoryContext({...request,caseId:scene==='friend'?'paper-profit':'familiar-request'}),false);
}
assert.ok(!shot.storyPrompt('friend').includes('퇴근 후'));
assert.equal(shot.validBranch('peer','check','compare','none'),false);
assert.equal(shot.validBranch('friend','space','records','records'),false);
const attachedReply=reply=>JSON.stringify({reply,reaction:'check',supportMode:'compare',focus:'deleted-question'});
assert.equal(shot.parseStoryReply(attachedReply('기록을 보내 주시면 같이 읽어볼게요.'),'peer',2,'deleted-question'),null);
assert.ok(shot.parseStoryReply(attachedReply('제가 추가 비용을 물었던 질문이네요. 남겨 주신 기록을 보고 처음 안내부터 다시 확인할게요.'),'peer',2,'deleted-question'));
assert.deepEqual(n.narratives[0].scenes.waiting.map(line=>line.text),['메시지는 되니까, 물어볼 게 있으면 물어봐.']);
console.log('Scene-local closure, stale events, saved pages, legacy quota/ledger and prompt contracts covered.');
