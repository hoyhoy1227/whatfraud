import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import ts from 'typescript';
import * as engine from '../app/story/engine.js';
let source=await readFile('app/story/panels.tsx','utf8');
source=source.replace("from './context'","from "+JSON.stringify(new URL('../app/story/context.js',import.meta.url).href));
source=source.replace("from './one-shot'","from "+JSON.stringify(new URL('../app/story/one-shot.js',import.meta.url).href));
source=source.replace("from './decision-message'","from "+JSON.stringify(new URL('../app/story/decision-message.js',import.meta.url).href));
source=source.replace("from './engine'","from "+JSON.stringify(new URL('../app/story/engine.js',import.meta.url).href));
const js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText.replace('from "react/jsx-runtime"','from '+JSON.stringify(import.meta.resolve('react/jsx-runtime')));
const ui=await import('data:text/javascript;base64,'+Buffer.from(js).toString('base64'));
const noop=()=>{};
let state=engine.createRun();
const step=(type,data='')=>{
 if(type==='next'&&state.chapter===0){state=engine.transition(state,{type:'message',data:'friend:skip',chapter:0});state=engine.transition(state,{type:'message-close',data:'friend',chapter:0});}
 state=engine.transition(state,{type,data,chapter:state.chapter});
};
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
for(const label of ['준호에게 메시지 보내기','출금 요청','보관한 자료로 접수','메모에 보관','보내기','일단 보류하기','이 계정 차단하기','최근 앱','일시정지','움직임 줄이기','글자 크게'])assert.ok(client.includes(label),label);
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
 assert.ok(profile.includes('대화 보기')&&profile.includes('연락 확인')&&!profile.includes('사기'));
 if(!known)assert.ok(profile.includes('disabled'));
}
const statusHtml=renderToStaticMarkup(createElement(ui.PhoneStatus,{time:'09:10'}));
assert.ok(statusHtml.includes('wifi-icon')&&statusHtml.includes('battery-icon'));
assert.ok(!statusHtml.includes('가상 체험')&&!statusHtml.includes('▂▄▆'));
for(let step=0;step<4;step++)assert.ok(renderToStaticMarkup(createElement(ui.Closing,{state,step,onNext:noop,onSkip:noop})).includes(['마지막 대화','생활 계좌','준호','휴대폰을 잠갔다'][step]));
assert.ok(client.includes('StoryMessage')&&client.includes('visualViewport')&&client.includes('openProfile'));
assert.ok(!client.slice(client.indexOf("dialog==='reply'?")).includes('<textarea'));

let messageSource=messageClient.replace("from './engine'","from "+JSON.stringify(new URL('../app/story/engine.js',import.meta.url).href)).replace("from './presentation'","from "+JSON.stringify(new URL('../app/story/presentation.js',import.meta.url).href)).replace("from '../ai-dialogue'","from "+JSON.stringify('data:text/javascript;base64,'+Buffer.from(ts.transpileModule((await readFile('app/ai-dialogue.ts','utf8')).replaceAll("'./story/narrative.js'",JSON.stringify(new URL('../app/story/narrative.js',import.meta.url).href)),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText).toString('base64'))).replace("from './one-shot'","from "+JSON.stringify(new URL('../app/story/one-shot.js',import.meta.url).href));
const bubbleJs=ts.transpileModule(await readFile('app/story/chat-bubbles.tsx','utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText.replace('from "react/jsx-runtime"','from '+JSON.stringify(import.meta.resolve('react/jsx-runtime')));
messageSource=messageSource.replace("from './chat-bubbles'","from "+JSON.stringify('data:text/javascript;base64,'+Buffer.from(bubbleJs).toString('base64')));
const compiled=ts.transpileModule(messageSource,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText.replace('from "react/jsx-runtime"','from '+JSON.stringify(import.meta.resolve('react/jsx-runtime'))).replace("from 'react'","from "+JSON.stringify(import.meta.resolve('react')));
const Message=(await import('data:text/javascript;base64,'+Buffer.from(compiled).toString('base64'))).default;
for(const aiAllowed of [false,true]){
 const html=renderToStaticMarkup(createElement(Message,{state:investment,scene:'peer',aiAllowed,getSession:()=> 'test-ui-session-0001',remaining:2,practice:false,reduced:true,paused:false,onEvent:()=>true,onBack:noop,onContinue:noop,onProfile:noop}));
 assert.ok(html.includes('지수')&&html.includes('준비된 메시지로 보내기'));
 assert.equal(html.includes('<textarea'),aiAllowed);
 assert.ok(!html.includes('어떻게 행동'));
}
console.log('One-shot message SSR passed: input opt-in, prepared alternative, profile and story context.');

let late=engine.createRun();
for(const [type,data] of [['resolve','paused'],['message','friend:together']])late=engine.transition(late,{type,data,chapter:late.chapter});
const lateHtml=renderToStaticMarkup(createElement(Message,{state:late,scene:'friend',aiAllowed:true,getSession:()=> 'test-ui-session-0001',remaining:1,practice:false,reduced:true,paused:false,onEvent:()=>true,onBack:noop,onContinue:noop,onProfile:noop}));
assert.ok(lateHtml.includes('연락 내용 보기')&&lateHtml.includes('이 사건 마무리하기'));
assert.ok(!lateHtml.includes('<textarea'),'history permits call, not another generation');
const restoredHtml=renderToStaticMarkup(createElement(Message,{state:investment,scene:'peer',memory:{draft:'작성 중인 문장',sent:'첫 메시지',reply:'받은 답장',attachment:'none',sentAttachment:'none',preparedSent:'준비된 후속 메시지',callStep:0},aiAllowed:true,getSession:()=> 'test-ui-session-0001',remaining:1,practice:false,reduced:true,paused:false,onEvent:()=>true,onBack:noop,onContinue:noop,onProfile:noop}));
for(const line of ['작성 중인 문장','첫 메시지','받은 답장','준비된 후속 메시지'])assert.ok(restoredHtml.includes(line));
assert.ok(client.includes("act('message-followup','peer:checked-bank')"));
console.log('Deferred call and in-memory transcript SSR passed.');

// Remounting the decision composer after navigation must retain the transcript,
// including at later stages; a reload intentionally receives empty memory.
let decisionSource=await readFile('app/story/decision-composer.tsx','utf8');
for(const name of ['decision-message','one-shot','narrative'])decisionSource=decisionSource.replace("from './"+name+"'","from "+JSON.stringify(new URL('../app/story/'+name+'.js',import.meta.url).href));
decisionSource=decisionSource.replace("from '../ai-dialogue'","from "+JSON.stringify('data:text/javascript;base64,'+Buffer.from(ts.transpileModule((await readFile('app/ai-dialogue.ts','utf8')).replaceAll("'./story/narrative.js'",JSON.stringify(new URL('../app/story/narrative.js',import.meta.url).href)),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText).toString('base64'))).replace("from './chat-bubbles'","from "+JSON.stringify('data:text/javascript;base64,'+Buffer.from(bubbleJs).toString('base64')));
const decisionJs=ts.transpileModule(decisionSource,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText.replace('from "react/jsx-runtime"','from '+JSON.stringify(import.meta.resolve('react/jsx-runtime'))).replace("from 'react'","from "+JSON.stringify(import.meta.resolve('react')));
const decisionUi=await import('data:text/javascript;base64,'+Buffer.from(decisionJs).toString('base64'));
const memory={...decisionUi.emptyDecisionMemory(),sent:'받는 이름을 확인할게.',reply:'받는 이름이 달라서 확인하려는 거구나.'};
for(const stage of ['request','waiting','paid']){
 const run={...engine.createRun(),stage};
 const props={state:run,memory,onMemory:noop,enabled:false,remaining:0,blocked:false,getSession:()=>'',onEvent:()=>false};
 const first=renderToStaticMarkup(createElement(decisionUi.default,props));
 const remounted=renderToStaticMarkup(createElement(decisionUi.default,props));
 assert.equal(first,remounted);
 assert.ok(remounted.includes(memory.sent)&&remounted.includes(memory.reply));
 assert.ok(!renderToStaticMarkup(createElement(decisionUi.default,{...props,memory:decisionUi.emptyDecisionMemory()})).includes(memory.reply));
}
const {dinnerContext}=await import('../app/story/context.js');
for(const [mode,focus,expected] of [['listen','none','조언보다 들어'],['verify','contact','함께 확인']]){
 let run=engine.createRun();
 for(const [type,data] of [['resolve','paused'],['message','friend:together'],['message-style','friend:'+mode+':'+focus]])run=engine.transition(run,{type,data,chapter:0});
 assert.ok(dinnerContext({...run,chapter:2}).includes(expected),'current saves preserve dinner choice');
}

assert.ok(!messageClient.includes('음성 통화')&&!messageClient.includes('계속 듣기'));
assert.ok(messageClient.includes('연락 요약')&&client.includes('연락 요약 보기'));

for(const [mode,focus] of [['records','records'],['listen','none']]){
 let branch=engine.createRun();
 for(const [type,data] of [['resolve','paused'],['message','friend:together'],['message-style','friend:'+mode+':'+focus],['message-followup','friend:call']])branch=engine.transition(branch,{type,data,chapter:0});
 const html=renderToStaticMarkup(createElement(Message,{state:branch,scene:'friend',memory:{draft:'',sent:'',reply:'',attachment:'none',sentAttachment:'none',preparedSent:'',callStep:4},aiAllowed:false,getSession:()=>'',remaining:0,practice:false,reduced:true,paused:false,onEvent:()=>true,onBack:noop,onContinue:noop,onProfile:noop}));
 assert.ok(html.includes(mode==='listen'?'지금 다 설명':'화면에 적힌 금액'));
 if(mode==='listen')assert.ok(!html.includes('은행에서 실제로'));
}
for(const label of ['지수와 남긴 기록 대조하기','준호와 확인할 거래 내역 열기','이 연락에는 지금 답하지 않기'])assert.ok(client.includes(label));

for(const mode of ['full','demo']){
 const run=engine.createRun(mode);
 const html=renderToStaticMarkup(createElement(ui.ChapterScene,{state:run,page:0,onNext:noop,onContinue:noop}));
 assert.ok(html.includes(mode==='full'?'출근길':'무료 시장 노트'));
 assert.ok(!html.includes('조작 안내 보기')&&!html.includes('이 휴대폰으로 할 일'));
 assert.ok(html.includes(mode==='full'?'준호와의 약속 대화 열기':'도착한 시장 노트 보기'));
 const resumed=renderToStaticMarkup(createElement(ui.ChapterScene,{state:run,resume:true,onNext:noop,onContinue:noop}));
 assert.ok(resumed.includes('멈춘 연락으로 돌아가기')&&resumed.includes('새 연락을 살펴보던'));
}
let interlude=engine.createRun('demo');
interlude=engine.transition(interlude,{type:'resolve',data:'paused',chapter:1});
interlude=engine.transition(interlude,{type:'next',data:'',chapter:1});
for(const page of [0,1]){
 const html=renderToStaticMarkup(createElement(ui.ChapterScene,{state:interlude,page,onNext:noop,onContinue:noop}));
 assert.ok(html.includes(page===0?'약속은 그대로였다':'귀갓길에 도착한 연락'));
 assert.equal(html.includes('장면 건너뛰기'),false);
 assert.equal(html.includes('계속 진행'),page===0);
}
assert.ok(client.includes("setDialog(resume&&mainSaved.current?.completed?null:'chapter')"));
assert.ok(client.includes("if(current.chapter<2){setChapterResume(false);setDialog('chapter');}"));
for(const label of ['점심시간으로','지금까지의 하루','도착한 새 연락 보기'])assert.ok(client.includes(label));
console.log('Context SSR passed: entry, demo, resume, bridge skip, new-contact affordance.');

const narrativeSource=await readFile('app/story/narrative.js','utf8');
assert.ok(!narrativeSource.includes('상태에 저녁 약속')&&!narrativeSource.includes('공개된 상태 메시지에'));
assert.ok(narrativeSource.includes('휴대폰 화면·상태·캘린더·다른 대화는 볼 수 없다'));
assert.ok(narrativeSource.includes('잠깐 부탁할 게 있어서 연락했어.'));
for(const unread of [false,true]){
 const row=renderToStaticMarkup(createElement(ui.ConversationRow,{name:'준호',initial:'준',preview:'약속 확인',detail:'저장된 연락처',unread,onOpen:noop}));
 assert.ok(row.includes('conversation-row')&&row.includes('약속 확인'));
 assert.equal(row.includes('conversation-unread'),unread);
}
const embedded=renderToStaticMarkup(createElement(Message,{embedded:true,state:investment,scene:'peer',aiAllowed:false,getSession:()=>'',remaining:0,practice:false,reduced:true,paused:false,onEvent:()=>true,onBack:noop,onContinue:noop,onProfile:noop}));
assert.ok(!embedded.includes('chat-back')&&!embedded.includes('chat-profile'),'parent owns the single chat header');
assert.ok(client.includes("openApp(a,a==='messages'?'list':'current')"),'app icon opens inbox');
assert.ok(client.includes("if(app==='messages'&&thread!=='list')openApp('messages','list')"),'all chat threads return to inbox');
assert.ok(client.includes("if(next==='messages'&&conversation!=='list')act('read',conversation)"),'opening inbox does not read a chat');
assert.equal((client.match(/onClick={phoneBack}/g)||[]).length,2,'header and system back agree');
assert.ok(!client.includes("onClick={()=>setThread("),'navigation preserves per-thread scroll through openApp');
assert.ok(client.includes('이전 약속 대화 보기'),'unified friend row retains older history');
console.log('Messenger SSR passed: bounded character knowledge, unified header, inbox rows and consistent back navigation.');

const parts=n.messageParts([{speaker:'지수',text:'첫 문장. 다음 문장?'}]);
assert.equal(parts.length,2);
assert.equal(parts[0].lastPart,false);
assert.equal(parts[1].lastPart,true);
assert.equal(parts[1].sourceText,'첫 문장. 다음 문장?');
assert.equal(n.messagePreview(parts.slice(0,1)),'첫 문장.');
assert.equal(n.messagePreview([{speaker:'나',text:'확인할게.'}]),'나: 확인할게.');
const presentation=await import('../app/story/presentation.js');
const oneShot=await import('../app/story/one-shot.js');
assert.ok(!oneShot.peerOpening('offer').includes('추가 비용 설명'));
assert.ok(oneShot.peerOpening('withdrawal').includes('추가 비용 설명'));
assert.ok(oneShot.storyPrompt('peer','none',2,'offer').includes(oneShot.peerOpening('offer')));
const draftMemory={...presentation.emptyMessageMemory(),draft:'작성 중'};
assert.equal(presentation.threadReceipt(engine.createRun('demo'),'peer',draftMemory),presentation.threadReceipt(engine.createRun('demo'),'peer'));
assert.equal(presentation.threadPreview(engine.createRun('demo'),'peer',draftMemory),presentation.messageOpening(engine.createRun('demo'),'peer'));
let readRun=engine.createRun();
readRun=engine.transition(readRun,{type:'read',chapter:0,data:'current:arrival:1'});
assert.ok(readRun.read.includes('0:current:arrival:1'));
assert.ok(!readRun.read.includes('0:current:arrival:2'));
assert.deepEqual(engine.restoreRun(engine.serializeRun(readRun)),readRun);
assert.ok(!client.includes('[state.stage,chat.length,resolved,visibleCount,messageMemory]'));
assert.ok(client.includes('messagePreview(visibleMessages,c.preview)'));
console.log('Messenger consistency passed: sentence delivery, evidence gate, previews, private read receipts and stage-aware peer context.');
