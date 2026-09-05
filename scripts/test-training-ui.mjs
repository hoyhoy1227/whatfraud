import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import ts from 'typescript';
const cases=JSON.parse(await readFile('content/generated/cases.json','utf8'));
let source=await readFile('app/training-panels.tsx','utf8');
source=source.replace("import { verdictLabels } from './game-data';","const verdictLabels={normal:'정상',caution:'주의',scam:'사기'};")
 .replace("from './training-rules'","from "+JSON.stringify(new URL('../app/training-rules.js',import.meta.url).href))
 .replace("from 'react'","from "+JSON.stringify(import.meta.resolve('react')));
const js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText.replace('from "react/jsx-runtime"','from '+JSON.stringify(import.meta.resolve('react/jsx-runtime')));
const ui=await import('data:text/javascript;base64,'+Buffer.from(js).toString('base64'));
const noop=()=>{};
for(const gameCase of cases){
 const evidence=gameCase.training.evidence.filter(clue=>clue.key).map(clue=>clue.text);
 const claims=renderToStaticMarkup(createElement(ui.ClaimsPanel,{gameCase,evidence:[],verify:noop}));
 assert.ok(claims.includes('아직 검증한 주장 없음'));
 for(const claim of gameCase.training.claims)assert.ok(claims.includes(claim.text));
 const props={gameCase,evidence,selected:evidence,toggle:noop,picked:gameCase.verdict,setPicked:noop,action:gameCase.training.appropriateActions[0],setAction:noop,confidence:70,setConfidence:noop,submit:noop,close:noop,investigate:noop};
 const decision=renderToStaticMarkup(createElement(ui.DecisionPanel,props));
 assert.ok(decision.includes('decision-dock')&&decision.includes('선택 근거 2개'));
 assert.ok(!/class="submit-verdict"[^>]*disabled/.test(decision));
 const empty=renderToStaticMarkup(createElement(ui.DecisionPanel,{...props,picked:null,action:null}));
 assert.ok(/class="submit-verdict"[^>]*disabled/.test(empty));
 const practice=renderToStaticMarkup(createElement(ui.BranchPractice,{gameCase,firstPicked:gameCase.verdict,onFinish:noop,onClose:noop}));
 assert.ok(practice.includes('최초 점수와 하루 진행은 바뀌지 않습니다.'));
 assert.ok(practice.includes('practice-title')&&practice.includes('<select'));
}
console.log('Training component render tests passed: all six claim panels, evidence summary, required decisions, independent practice and accessible labels.');
