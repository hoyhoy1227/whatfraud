import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import ts from 'typescript';
import {chapters,createRun,transition,serializeRun,restoreRun} from '../app/story/engine.js';
import {canAttach,attachmentText} from '../app/story/one-shot.js';
import {decisionWindows,validateDecisionContext} from '../app/story/decision-message.js';
import {narratives} from '../app/story/narrative.js';

let source=await readFile('app/story/evidence-detail.tsx','utf8');
for(const moduleName of ['engine','fraud-context'])source=source.replace("'./"+moduleName+"'",JSON.stringify(new URL('../app/story/'+moduleName+'.js',import.meta.url).href));
const js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText.replace('from "react/jsx-runtime"','from '+JSON.stringify(import.meta.resolve('react/jsx-runtime')));
const {default:EvidenceDetail}=await import('data:text/javascript;base64,'+Buffer.from(js).toString('base64'));
const render=(state,id)=>renderToStaticMarkup(createElement(EvidenceDetail,{state,e:{...chapters[state.chapter].story.evidence.find(e=>e.id===id),chapter:state.chapter}}));
const step=(state,type,data='')=>transition(state,{type,data,chapter:state.chapter});

let state=createRun('demo');
let html=render(state,'ledger');
assert.ok(html.includes('보낸 돈이 없습니다.'));
assert.ok(!html.includes('−300,000원'));
state=step(step(state,'advance'),'advance');
state=step(state,'confirm','paper-profit:main');
html=render(state,'ledger');
assert.ok(html.includes('−300,000원')&&html.includes('온결 파트너'));
assert.ok(!html.includes('보낸 돈이 없습니다.')&&!html.includes('−120,000원'));
state=step(state,'withdraw');
state=step(state,'confirm','paper-profit:extra');
assert.ok(render(state,'ledger').includes('−120,000원'));
state=step(state,'inspect','paper-profit:ledger');
state=step(state,'save','paper-profit:ledger');
assert.equal(render(restoreRun(serializeRun(state)),'ledger'),render(state,'ledger'));

for(const window of decisionWindows.filter(w=>w.chapter>0)){
 const chapter=window.chapter,caseId=window.caseId;
 const fixture={...createRun(),chapter,stage:'offer',visited:['arrival','group','offer'],joined:chapter===1};
 const choices=narratives[chapter].beats.filter(b=>b.required&&b.stage==='offer').map(b=>b.options[0].id);
 const baseCheck=chapter===1?'official-record':'official-help';
 for(const id of window.attachments.filter(id=>chapters[chapter].story.evidence.some(e=>e.id===id))){
  assert.equal(canAttach(fixture,id),false,'unread evidence must not be attached: '+id);
  const inspected=step(fixture,'inspect',caseId+':'+id);
  assert.equal(canAttach(inspected,id),true);
  const body={caseId,sceneId:window.id,stageId:'offer',resolved:false,joined:fixture.joined,attachment:id,choices,checks:[...new Set([baseCheck,id])]};
  assert.equal(validateDecisionContext(body),true,'server accepts inspected case evidence: '+id);
  assert.equal(validateDecisionContext({...body,checks:body.checks.filter(check=>check!==id)}),false,'server requires attachment evidence: '+id);
  assert.equal(canAttach({...inspected,chapter:chapter===1?2:1},id),false,'evidence cannot leak into another case: '+id);
  assert.ok(attachmentText[id].includes(chapters[chapter].story.evidence.find(e=>e.id===id).text));
 }
}
const recovery={...createRun(),chapter:2};
const official=chapters[2].story.evidence.find(e=>e.id==='official-help');
html=render(recovery,'official-help');
assert.equal(html.split(official.text).length-1,1,'the main note appears once');
assert.ok(html.includes('출처와 자세한 내용')&&html.includes('class="evidence-facts"'));
assert.ok(!html.includes('확인 가능 정보')&&!html.includes('게임 내 공식 안내'));
console.log('Evidence notes: transaction states, restored records, attachment guards and readable detail markup passed.');
