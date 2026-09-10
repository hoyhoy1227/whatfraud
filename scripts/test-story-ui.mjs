import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import ts from 'typescript';
import * as engine from '../app/story/engine.js';
let source=await readFile('app/story/panels.tsx','utf8');
source=source.replace("from './one-shot'","from "+JSON.stringify(new URL('../app/story/one-shot.js',import.meta.url).href));
source=source.replace("from './engine'","from "+JSON.stringify(new URL('../app/story/engine.js',import.meta.url).href));
const js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText.replace('from "react/jsx-runtime"','from '+JSON.stringify(import.meta.resolve('react/jsx-runtime')));
const ui=await import('data:text/javascript;base64,'+Buffer.from(js).toString('base64'));
const noop=()=>{};
let state=engine.createRun();
const step=(type,data='')=>{state=engine.transition(state,{type,data,chapter:state.chapter});};
let ledger=renderToStaticMarkup(createElement(ui.Ledger,{state}));
assert.ok(ledger.includes('680,000원')&&ledger.includes('출금된 거래가 없습니다'));
step('advance');step('confirm','familiar-request:main');
ledger=renderToStaticMarkup(createElement(ui.Ledger,{state}));
assert.ok(ledger.includes('600,000원')&&ledger.includes('한별 서비스'));
step('resolve','stopped');step('next');step('resolve','paused');step('next');step('resolve','paused');step('next');
const rewind=renderToStaticMarkup(createElement(ui.Rewind,{state,onReplay:noop,onRestart:noop}));
assert.ok(rewind.includes('멈춰 세운 하루')&&rewind.includes('80,000원')&&rewind.includes('선택 직전'));
assert.ok(rewind.includes('지나친 단서')&&!rewind.includes('정답률'));
const client=await readFile('app/story/story-client.tsx','utf8');
for(const label of ['저장된 준호에게 전화','출금 요청','보관한 자료로 접수','메모에 보관','보내기','일단 보류하기','이 계정 차단하기','최근 앱','일시정지','움직임 줄이기','글자 크게'])assert.ok(client.includes(label),label);
assert.ok(client.includes('showModal()')&&client.includes('onCancel='));
const messageClient=await readFile('app/story/story-message.tsx','utf8');
assert.ok(messageClient.includes('signal:aborter.signal')&&client.includes('practiceOriginal'));
assert.ok(!/href=|tel:|mailto:|window.open|location.href/.test(client),'no external action escapes phone');
assert.equal((rewind.match(/class="pivot"/g)||[]).length,3,'one summary per act');
assert.ok(rewind.includes('이 순간으로 돌아가기')&&rewind.includes('pivot-details'));
assert.ok(client.includes('message-dock')&&client.includes('보류·차단')&&client.includes("dialog==='reply'"));
assert.ok(!client.includes('내용 확인하기'),'record titles are the affordance');
assert.ok(client.includes("browserPage==='platform'?e.id==='success-post'"),'official records stay outside fake platform');
console.log('Story UI SSR tests passed: ledger, endings, pivot labels and controls. Browser/device QA is separate.');

assert.ok(messageClient.includes('자유답변(개인정보는 입력하지 마세요)'));
assert.ok(client.includes("dialog==='ai-choice'")&&client.includes('준비된 답장으로 시작'));
assert.ok(client.includes('scheduleMessage')&&client.includes('visibleCount')&&client.includes('대화 바로 보기'));
assert.ok(messageClient.includes("inputMode:'story-message'")&&messageClient.includes('준비된 메시지'),'free failures are explicit');
const {scheduleMessage,messageDelay}=await import('../app/story/message-pacing.js');
assert.ok(messageDelay('짧은 메시지')>=650);
assert.ok(messageDelay('긴 메시지'.repeat(100))<=1600);
assert.equal(messageDelay('문장',true),0);
let callback,delivered=0,cleared=false;
const cancel=scheduleMessage('문장',false,()=>delivered++,fn=>{callback=fn;return 1;},()=>{cleared=true;});
cancel();callback();assert.equal(delivered,0);assert.equal(cleared,true);
scheduleMessage('문장',false,()=>delivered++,fn=>{callback=fn;return 2;},()=>{});
callback();assert.equal(delivered,1);

let investment=engine.createRun('demo');
const advance=(type,data='')=>{investment=engine.transition(investment,{type,data,chapter:1});};
advance('advance');advance('advance');advance('observe','platform-view');advance('confirm','paper-profit:main');advance('observe','bank-view');
let comparison=renderToStaticMarkup(createElement(ui.RecordComparison,{state:investment}));
assert.ok(comparison.includes('355,200원')&&comparison.includes('300,000원')&&comparison.includes('들어온 돈 0원'));
assert.ok(!comparison.includes('120,000원'),'future fee is not exposed');
advance('withdraw');
comparison=renderToStaticMarkup(createElement(ui.RecordComparison,{state:investment}));
assert.ok(comparison.includes('120,000원')&&comparison.includes('참여 전 대화'));
assert.ok(!comparison.includes('이용 화면에서 출금 요청을 하는 방식입니다'),'unchosen dialogue is not presented as history');
advance('confirm','paper-profit:extra');
comparison=renderToStaticMarkup(createElement(ui.RecordComparison,{state:investment}));
assert.ok(comparison.includes('420,000원'));
assert.ok(client.includes('messageWindow')&&client.includes('conversationTimeline'));
assert.ok(!client.includes('activeCase.dialogue?.quickQuestions.map'),'reply choices are scene-bound');

const n=await import('../app/story/narrative.js');
for(const known of [false,true]){
 const profile=renderToStaticMarkup(createElement(ui.ContactProfile,{profile:n.contactProfile(0,known),blocked:!known,onClose:noop,onChat:noop,onCall:noop}));
 assert.ok(profile.includes(known?'내 연락처에 저장됨':'친구로 등록되지 않음'));
 assert.ok(profile.includes('대화 보기')&&profile.includes('음성 통화')&&!profile.includes('사기'));
 if(!known)assert.ok(profile.includes('disabled'));
}
assert.ok(renderToStaticMarkup(createElement(ui.PhoneStatus,{time:'09:10'})).includes('가상 체험'));
for(let step=0;step<4;step++)assert.ok(renderToStaticMarkup(createElement(ui.Closing,{state,step,onNext:noop,onSkip:noop})).includes(['마지막 대화','생활 계좌','준호','휴대폰을 잠갔다'][step]));
assert.ok(client.includes('StoryMessage')&&client.includes('visualViewport')&&client.includes('openProfile'));
assert.ok(!client.slice(client.indexOf("dialog==='reply'?")).includes('<textarea'));

let messageSource=messageClient.replace("from '../ai-dialogue'","from "+JSON.stringify('data:text/javascript;base64,'+Buffer.from(ts.transpileModule((await readFile('app/ai-dialogue.ts','utf8')).replaceAll("'./story/narrative.js'",JSON.stringify(new URL('../app/story/narrative.js',import.meta.url).href)),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText).toString('base64'))).replace("from './one-shot'","from "+JSON.stringify(new URL('../app/story/one-shot.js',import.meta.url).href));
const compiled=ts.transpileModule(messageSource,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText.replace('from "react/jsx-runtime"','from '+JSON.stringify(import.meta.resolve('react/jsx-runtime'))).replace("from 'react'","from "+JSON.stringify(import.meta.resolve('react')));
const Message=(await import('data:text/javascript;base64,'+Buffer.from(compiled).toString('base64'))).default;
for(const aiAllowed of [false,true]){
 const html=renderToStaticMarkup(createElement(Message,{state:investment,scene:'peer',aiAllowed,getSession:()=> 'test-ui-session-0001',remaining:2,practice:false,reduced:true,paused:false,onEvent:()=>true,onBack:noop,onContinue:noop,onProfile:noop}));
 assert.ok(html.includes('지수')&&html.includes('준비된 메시지로 보내기'));
 assert.equal(html.includes('<textarea'),aiAllowed);
 assert.ok(!html.includes('어떻게 행동'));
}
console.log('One-shot message SSR passed: input opt-in, prepared alternative, profile and story context.');
