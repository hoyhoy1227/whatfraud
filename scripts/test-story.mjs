import assert from 'node:assert/strict';
import * as e from '../app/story/engine.js';
const step=(s,type,data='')=>e.transition(s,{type,chapter:s.chapter,data});
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
