import assert from 'node:assert/strict';
import * as e from '../app/story/engine.js';
const step=(s,type,data='')=>e.transition(s,{type,chapter:s.chapter,data});
const inspectAll=s=>e.currentCase(s).story.evidence.reduce((v,clue)=>step(v,'inspect',e.currentCase(v).id+':'+clue.id),s);
const finish=(s,kind)=>step(step(s,'resolve',kind),'next');
const spend=s=>{const offer=e.offerFor(s);assert.ok(offer);return step(s,'confirm',offer.id);};
const noMoreReplies='상대방에게서 더 도착할 답장은 없습니다. 이 대화는 여기서 끝났습니다.';
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
    assert.equal(e.conversationEndText(s),kind==='loss'?noMoreReplies:'','only unanswered loss endings close the conversation');
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
let authoredRoom=e.createRun('demo');
authoredRoom=step(authoredRoom,'talk','paper-note-meaning');
assert.ok(!n.scenarioTranscript(authoredRoom,Infinity).some(message=>message.text==='자유 질문'),'scenario room excludes free-form AI messages');
let ordered=e.createRun('demo');
for(const choice of ['paper-intro-purpose','paper-intro-proof'])ordered=step(ordered,'talk',choice);
ordered=step(ordered,'advance');
for(const choice of ['paper-group-source','paper-group-look'])ordered=step(ordered,'talk',choice);
ordered=step(ordered,'advance');
ordered=step(ordered,'talk','paper-offer-withdraw');
ordered=step(ordered,'inspect','paper-profit:official-record');
ordered=step(ordered,'talk','paper-offer-official');
ordered=spend(ordered);
const orderedTranscript=n.conversationTranscript(ordered).map(message=>message.text);
const evidenceQuestion=orderedTranscript.indexOf('공식 기록에서 위탁 관계를 찾지 못했어요.');
const evidenceReply=orderedTranscript.indexOf('그 조회와 저희 방 안내는 구분해서 보셔야 합니다.');
const paidReply=orderedTranscript.indexOf('이용 화면에서 표시 상태를 보실 수 있습니다.');
assert.ok(evidenceQuestion>=0&&evidenceQuestion<evidenceReply&&evidenceReply<paidReply,'evidence question and reply stay before post-transfer messages');
assert.deepEqual(n.conversationTranscript(ordered,[],1).filter(message=>message.stageId==='paid').map(message=>message.text),['이용 화면에서 표시 상태를 보실 수 있습니다.']);
const restoredBudget=restoreBudget({session:'test-session-0000001',counts:[0,1,0],last:12,cooldown:0,moments:['paper-entry','paper-entry','invented']},'replacement');
assert.deepEqual(restoredBudget.moments,['paper-entry']);
assert.deepEqual(used.moments,[],'old budget remains compatible and retains counts');
let told=e.createRun();told=step(told,'resolve','paused');told=step(told,'reflect','tell');told=step(told,'next');
assert.ok(n.friendFollowup(told).includes('기억해'));
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
let story=e.createRun('demo');
assert.equal(shot.messageWindow(story,'peer'),false);
assert.equal(step(story,'message','peer:attempt'),story);
story=step(story,'advance');story=step(story,'advance');story=step(story,'confirm','paper-profit:main');story=step(story,'withdraw');
assert.equal(shot.messageWindow(story,'peer'),true);
const beforeMoney=e.totalSpent(story);
story=step(story,'message','peer:attempt');
assert.equal(shot.messageStatus(story,'peer'),'attempt');
assert.equal(step(story,'message','peer:attempt'),story,'no duplicate attempt');
assert.equal(shot.messageStatus(e.restoreRun(e.serializeRun(story)),'peer'),'attempt','reload cannot re-open input');
assert.equal(step(story,'message','peer:refund'),story,'unknown outcome rejected');
story=step(story,'message','peer:check');
assert.equal(step(story,'message','peer:boundary'),story,'outcome immutable');
story=step(story,'message-followup','peer:record');
assert.equal(step(story,'message-followup','peer:record'),story,'followup idempotent');
assert.equal(e.totalSpent(story),beforeMoney,'AI outcomes never mutate money');
assert.equal(story.saved.length,0,'AI does not invent verified evidence');
assert.equal(step(story,'message','friend:attempt'),story,'friend is after resolution only');
story=step(story,'resolve','stopped');
story=step(story,'message','friend:attempt');story=step(story,'message','friend:together');
story=step(story,'message-followup','friend:call');
assert.equal(e.totalSpent(story),beforeMoney);
const restored=e.restoreRun(e.serializeRun(story));
assert.deepEqual(restored,story);
assert.ok(shot.messageConsequences(restored).some(line=>line.includes('연락 요약을 확인했다')));
story=step(story,'next');
assert.equal(step(story,'message','peer:attempt'),story,'past scene closed');
assert.ok(n.friendFollowup(story).includes('같이 확인'));
for(const result of ['paused','blocked']){
 let safe=e.createRun('demo');safe=step(safe,'advance');safe=step(safe,'resolve',result);
 assert.ok(shot.messageWindow(safe,'peer'),'nonpayer can message after leaving group');
 safe=step(safe,'message','peer:skip');safe=step(safe,'message','friend:space');safe=step(safe,'next');
 safe=step(safe,'resolve','paused');safe=step(safe,'next');
 assert.ok(safe.completed);assert.equal(e.totalSpent(safe),0);assert.ok(e.restoreRun(e.serializeRun(safe)));
}
for(const [scene,values] of Object.entries(shot.reactions)){
 for(const reaction of values){
  let run=e.createRun('demo');run=step(run,'advance');run=step(run,'resolve','paused');
  run=step(run,'message',scene+':'+reaction);assert.equal(shot.messageStatus(run,scene),reaction);
  assert.ok(e.restoreRun(e.serializeRun(run)));
 }
}
assert.equal(shot.parseStoryReply('{"reply":"확인해 볼게요.","reaction":"refund"}','peer'),null);
assert.equal(shot.parseStoryReply('{"reply":"다시 말해 줄래?","reaction":"together"}','friend'),null);
assert.equal(shot.canAttach(e.createRun('demo'),'deleted-question'),false);
console.log('Two message story tests passed: no-loss access, skip, outcome restore, no retry, immutable results, no financial side effects.');

const presentation=await import('../app/story/presentation.js');
assert.equal(presentation.minimumReplyDelay(50),650);
assert.equal(presentation.minimumReplyDelay(900),0);
assert.equal(presentation.minimumReplyDelay(0,true),0);
assert.notEqual(presentation.emptyMessageMemory(),presentation.emptyMessageMemory());
const presentationState={chapter:1,completed:false,calls:[],events:[{type:'message',data:'peer:check',chapter:1}]};
assert.equal(presentation.peerRecordReady(presentationState),false);
assert.equal(presentation.peerRecordReady({...presentationState,events:[...presentationState.events,{type:'resolve',chapter:1}]}),true);
assert.equal(presentation.supportReady({...presentationState,chapter:2}),false);
assert.equal(presentation.supportReady({...presentationState,chapter:2,events:[{type:'message',data:'friend:together'},{type:'message-followup',data:'friend:call'}]}),true);
assert.ok(presentation.messageOpening({...presentationState,calls:['0:junho']},'friend').includes('그 계정'));
console.log('Presentation gates passed: delayed records, support continuity, response timing.');

let supportRun=e.createRun('demo');
supportRun=step(supportRun,'resolve','paused');
supportRun=step(supportRun,'message','friend:together');
supportRun=step(supportRun,'message-followup','friend:call');
supportRun=step(supportRun,'next');
const supportBefore=e.totalSpent(supportRun);
supportRun=step(supportRun,'support','recovery');
assert.ok(supportRun.events.some(event=>event.type==='support'));
assert.equal(step(supportRun,'support','recovery'),supportRun);
assert.equal(e.totalSpent(supportRun),supportBefore);
assert.equal(supportRun.inspected.length,0);
assert.deepEqual(e.restoreRun(e.serializeRun(supportRun)),supportRun);
let privateRun=step(step(e.createRun('demo'),'resolve','paused'),'next');
assert.equal(step(privateRun,'support','recovery'),privateRun,'support requires a received call');
assert.equal(shot.parseStoryReply(JSON.stringify({reply:'지금 전화할게. 같이 확인하자.',reaction:'space'}),'friend'),null);

const splitMemory={'full:peer':{draft:'본편 초안'},'demo:peer':{draft:'체험 초안'},'practice:full:peer':{draft:'되감기'}};
assert.deepEqual(presentation.resetMessageMemory(splitMemory,'demo'),{'full:peer':splitMemory['full:peer']});
assert.equal(splitMemory['demo:peer'].draft,'체험 초안','reset is immutable');
let delayed=e.createRun('demo');
delayed=step(delayed,'advance');delayed=step(delayed,'advance');delayed=step(delayed,'confirm','paper-profit:main');delayed=step(delayed,'withdraw');
delayed=step(delayed,'read','bank');
delayed=step(delayed,'message','peer:check');
assert.equal(presentation.peerRecordReady(delayed),false,'prior bank visit is not a later action');
assert.equal(step(delayed,'read','bank'),delayed,'read event already exists');
delayed=step(delayed,'message-followup','peer:checked-bank');
assert.equal(presentation.peerRecordReady(delayed),true,'bank revisit unlocks delayed record');
assert.equal(step(delayed,'message-followup','peer:checked-bank'),delayed,'revisit event only once');
assert.equal(step(delayed,'message-followup','peer:saved'),delayed,'read before saving');
delayed=step(delayed,'message-followup','peer:record');
assert.ok(!shot.messageConsequences(delayed).some(x=>x.startsWith('보관한 지수')));
delayed=step(delayed,'message-followup','peer:saved');
assert.ok(shot.messageConsequences(delayed).some(x=>x.startsWith('보관한 지수')));
delayed=step(delayed,'resolve','paused');
delayed=step(delayed,'message','friend:together');
delayed=step(delayed,'next');
assert.equal(presentation.messageThreadVisible(delayed,'friend'),true);
assert.equal(presentation.messageThreadVisible(delayed,'peer'),true);
assert.equal(step(delayed,'message','friend:attempt'),delayed,'historical thread never reopens AI');
delayed=step(delayed,'message-followup','friend:call');
assert.ok(presentation.supportReady(delayed),'deferred call can be received in third act');
assert.deepEqual(e.restoreRun(e.serializeRun(delayed)),delayed);
assert.equal(e.totalSpent(delayed),300000);
console.log('Continuity gaps passed: demo memory, bank revisits, explicit record save, deferred calls.');

for(const [mode,focus,reaction,use] of [['records','records','together','records'],['verify','contact','together','verify'],['listen','none','together','pause'],['space','none','space',null],['neutral','none','together',null]]){
 let run=e.createRun('demo');run=step(run,'advance');run=step(run,'resolve','paused');
 assert.equal(step(run,'message-style','friend:'+mode+':'+focus),run,'style cannot precede message');
 run=step(run,'message','friend:'+reaction);run=step(run,'message-style','friend:'+mode+':'+focus);
 assert.equal(shot.messageStyle(run,'friend').mode,mode);
 assert.equal(step(run,'message-style','friend:'+mode+':'+focus),run,'style immutable');
 run=step(run,'message-followup','friend:call');run=step(run,'next');
 if(use==='verify'){assert.equal(shot.branchUseAllowed(run,'verify'),false);run=step(run,'support','recovery');}
 if(use){assert.equal(shot.branchUseAllowed(run,use),true);run=step(run,'branch-use',use);}
 else assert.equal(shot.branchUseAllowed(run,'records'),false);
 assert.equal(e.totalSpent(run),0);assert.equal(run.inspected.length,0);
 assert.deepEqual(e.restoreRun(e.serializeRun(run)),run);
 if(mode==='listen'){assert.ok(!n.friendFollowup(run).includes('확인'));assert.ok(!shot.friendFollowupLines(run).join(' ').includes('기록'));}
 run=finish(run,'paused');assert.ok(run.completed);assert.equal(e.totalSpent(run),0);
}
let proof=e.createRun('demo');proof=step(proof,'advance');proof=step(proof,'capture','paper-question');proof=step(proof,'resolve','paused');
proof=step(proof,'message','peer:check');proof=step(proof,'message-style','peer:compare:deleted-question');
proof=step(proof,'message-followup','peer:record');proof=step(proof,'message-followup','peer:saved');proof=step(proof,'next');
assert.ok(shot.branchUseAllowed(proof,'compare'));proof=step(proof,'branch-use','compare');
assert.equal(proof.inspected.length,0);assert.equal(e.totalSpent(proof),0);
assert.deepEqual(e.restoreRun(e.serializeRun(proof)),proof);
assert.ok(shot.messageConsequences(proof).some(text=>text.includes('나란히')));
assert.ok(shot.peerFollowupText(proof).includes('제가 추가 비용'));
assert.equal(shot.validBranch('peer','check','compare','none'),false);
assert.equal(shot.validBranch('friend','space','records','records'),false);
console.log('Story branches passed: intent modes, explicit use, no forced loss, record provenance, no invented verification, save replay.');

const attachedReply=(reply)=>JSON.stringify({reply,reaction:'check',supportMode:'compare',focus:'deleted-question'});
assert.equal(shot.parseStoryReply(attachedReply('저도 질문이 지워진 걸 봤어요. 보관하신 내용이 있다면 저도 같이 읽어볼게요.'),'peer',2,'deleted-question'),null);
assert.equal(shot.parseStoryReply(attachedReply('기록을 보내 주시면 같이 읽어볼게요.'),'peer',2,'deleted-question'),null);
assert.ok(shot.parseStoryReply(attachedReply('제가 추가 비용을 물었던 질문이네요. 남겨 주신 기록을 보고 처음 안내부터 다시 확인할게요.'),'peer',2,'deleted-question'));
console.log('Attachment reply regression passed: already-received record, no invented witnessing.');

const context=await import('../app/story/context.js');
assert.equal(context.chapterPages(e.createRun()).length,1);
assert.equal(context.chapterPages(e.createRun('demo')).length,1,'demo does not invent morning events');
assert.ok(context.arrivalContext(e.createRun('demo')).join(' ').includes('무료 시장 노트'));
for(const paid of [false,true]){
 let run=e.createRun();
 if(paid){run=step(run,'advance');run=step(run,'confirm','familiar-request:main');}
 run=step(run,'resolve','paused');run=step(run,'next');
 const snapshot=e.serializeRun(run);
 assert.equal(context.chapterPages(run).length,2);
 const bridge=context.chapterPages(run)[0].lines.join(' ');
 assert.equal(bridge.includes('80,000원'),paid);
 assert.ok(!bridge.includes('만회'));
 context.resumeContext(run);assert.equal(e.serializeRun(run),snapshot,'context is read-only');
 assert.deepEqual(e.restoreRun(snapshot),run);
}
for(const mode of ['listen','records','verify','space','neutral','skip']){
 let run=step(e.createRun('demo'),'resolve','paused');
 run=step(run,'message','friend:'+(mode==='skip'?'skip':mode==='space'?'space':'together'));
 if(!['skip'].includes(mode))run=step(run,'message-style','friend:'+mode+':'+(mode==='records'?'records':mode==='verify'?'contact':'none'));
 run=step(run,'next');
 const dinner=context.dinnerContext(run);
 if(mode==='listen')assert.ok(dinner.includes('들어 달라는'));
 if(mode==='space')assert.ok(dinner.includes('더 묻지'));
 if(mode==='records')assert.ok(dinner.includes('확인된 것은 아니다'));
 if(mode==='skip')assert.ok(!/기록을 같이|털어놓았다/.test(dinner));
 assert.ok(!/이따|먼저 도착|와서 천천히/.test(n.friendFollowup(run)));
 assert.ok(!/이따|먼저 도착/.test(shot.friendFollowupLines(run).join(' ')));
 assert.equal(e.totalSpent(run),0);
 assert.ok(context.arrivalContext(run).join(' ').includes('확인되지'));
 assert.deepEqual(e.restoreRun(e.serializeRun(run)),run);
}
assert.ok(n.narratives[1].scenes.arrival.some(m=>m.text.includes('오늘의 노트')));
assert.ok(n.narratives[0].scenes.request.some(m=>m.text.includes('태블릿')));
console.log('Context continuity passed: intro/demo, conditional bridges, dinner privacy, after-dinner timing, no state mutation.');

let earlyContact=e.createRun();
earlyContact=step(earlyContact,'call','junho');
assert.ok(earlyContact.cues.includes('junho-unanswered'));
assert.ok(!earlyContact.calls.includes('0:junho'));
assert.ok(!earlyContact.inspected.includes('familiar-request:saved-contact'));
assert.deepEqual(e.restoreRun(e.serializeRun(earlyContact)),earlyContact);
earlyContact=step(earlyContact,'advance');
earlyContact=step(earlyContact,'call','junho');
assert.ok(earlyContact.calls.includes('0:junho'));
assert.ok(earlyContact.inspected.includes('familiar-request:saved-contact'));
console.log('Early contact stays unanswered; later independent verification and restore remain available.');
