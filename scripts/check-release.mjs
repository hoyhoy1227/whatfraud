import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {chapters,createRun,transition,endingFor} from '../app/story/engine.js';
assert.deepEqual(chapters.map(c=>c.id),['familiar-request','paper-profit','recovery-team']);
assert.deepEqual(chapters.map(c=>c.story.aiLimit),[2,2,1]);
for(const c of chapters){
 assert.equal(c.mode,'chat');
 assert.ok(c.story.evidence.filter(e=>e.key).length>=2);
 assert.ok(c.story.evidence.some(e=>!e.key));
 assert.ok(c.story.stages.some(s=>s.actions.some(a=>a.type==='transfer')));
 assert.ok(c.story.stages.some(s=>s.actions.some(a=>a.type==='finish')));
 assert.ok(Object.values(c.review.safetyAudit).every(value=>value===false));
 assert.ok(!/https?:\/\//.test(JSON.stringify(c)),'no live content links');
}
let state=createRun();
for(let i=0;i<3;i++){
 state=transition(state,{type:'resolve',chapter:i,data:'paused'});
 if(i===0){state=transition(state,{type:'message',chapter:i,data:'friend:skip'});state=transition(state,{type:'message-close',chapter:i,data:'friend'});}
 state=transition(state,{type:'next',chapter:i,data:''});
}
assert.ok(state.completed);assert.equal(endingFor(state).title,'지켜낸 하루');
const route=await readFile('app/api/ai-chat/route.ts','utf8');
for(const guard of ['reserveSharedBudget','validateRequestEnvelope','readBoundedBody','getScriptedReply','validateAiReply','MAX_PROVIDER_CONCURRENCY','AbortController','AI_CASE_LIMITS','AI_RUN_LIMIT','validateDecisionContext'])assert.ok(route.includes(guard),guard);
const hosting=JSON.parse(await readFile('.openai/hosting.json','utf8'));
assert.equal(hosting.project_id,'appgprj_6a93064a0e288191ae08e88bafdd694a');assert.equal(hosting.d1,'DB');
const live=await readFile('scripts/evaluate-live-gemini.mjs','utf8');
assert.ok(live.includes('--allow-live'),'live evaluation must remain opt-in');
const client=await readFile('app/story/story-client.tsx','utf8');
assert.ok(client.includes('useState(false)')&&client.includes('aiAllowed'));
assert.ok(!client.includes('GEMINI_API_KEY'));
console.log('Release checks passed: three-act order, fixed budgets, zero-AI ending, server guards and deployment binding.');
