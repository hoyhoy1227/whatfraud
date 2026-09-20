'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import AppIcon from '../app-icon';
import {ChatBubbles} from './chat-bubbles';
import type { AiChatMessage } from '../ai-dialogue';
import {arrivalContext,chapterPages,resumeContext} from './context';
import StoryMessage, {type MessageMemory} from './story-message';
import {currentThreadReceipt,emptyMessageMemory,peerRecordReady,supportReady,messageThreadVisible,resetMessageMemory,threadPreview,threadReceipt} from './presentation';
import {messageWindow,messageStatus,messageConsequences,messageStyle,branchUseAllowed,peerFollowupText,attachmentText} from './one-shot';
import { chapters, createRun, currentCase, currentStage, transition, SAVE_KEY, serializeRun, restoreRun, replayBefore, evidenceFor, verified, offerFor, money, gameTime, isResolved, outcomeText, conversationEndText, chapterSpent } from './engine';
import { budgetKey, restoreBudget } from './session-budget';
import { ReplyGate } from './reply-gate';
import { narratives, displayedMessages, pendingBeat, chosenIds, choiceAllowed, conversationTimeline, conversationTranscript, friendFollowup, retainedQuestion, contactProfile, messageParts, messagePreview } from './narrative';
import { scheduleMessage } from './message-pacing';
import { Ledger, Rewind, RecordComparison, Closing, PhoneStatus, ContactProfile, ChapterScene, ConversationRow, InvestmentScreen, PlayGuide } from './panels';
type Run = ReturnType<typeof createRun>;
type App = 'home'|'messages'|'calls'|'bank'|'browser'|'notes'|'settings';
type Chat = AiChatMessage & {stage:string;anchor:number;speaker:string};
const names:Record<App,string>={home:'홈',messages:'메시지',calls:'연락처',bank:'은행',browser:'브라우저',notes:'메모',settings:'설정'};
const appList:App[]=['messages','calls','bank','browser','notes'];

export default function StoryClient(){
  const [state,setState]=useState<Run>(()=>createRun());
  const [ready,setReady]=useState(false),[started,setStarted]=useState(false),[hasSave,setHasSave]=useState(false);
  const [app,setApp]=useState<App>('home'),[recent,setRecent]=useState<App[]>([]),[showRecent,setShowRecent]=useState(false);
  const [thread,setThread]=useState('current'),[browserPage,setBrowserPage]=useState('start');
  const [messageMemory,setMessageMemory]=useState<Record<string,MessageMemory>>({});
  const followTail=useRef(true);
  const [atTail,setAtTail]=useState(true);
  const [newMessages,setNewMessages]=useState(false);
  const [chats,setChats]=useState<Record<string,Chat[]>>({});
  const [sending,setSending]=useState(false),[paused,setPaused]=useState(false),[note,setNote]=useState('');
  const [aiUsed,setAiUsed]=useState(0);
  const [closingStep,setClosingStep]=useState(0);
  const [chapterPage,setChapterPage]=useState(0),[chapterResume,setChapterResume]=useState(false);
  const [tutorialStep,setTutorialStep]=useState<number|null>(null);
  const [profileKnown,setProfileKnown]=useState(false);
  const [startRequest,setStartRequest]=useState<{mode:'full'|'demo';resume:boolean}>({mode:'full',resume:false});
  const [aiConsent,setAiConsent]=useState(false);
  const [revealed,setRevealed]=useState<Record<string,number>>({});
  const [pageVisible,setPageVisible]=useState(true);
  const [aiAllowed,setAiAllowed]=useState(false),[modelStatus,setModelStatus]=useState('확인하지 않음'),[checking,setChecking]=useState(false);
  const [reduced,setReduced]=useState(false),[large,setLarge]=useState(false);
  const [dialog,setDialog]=useState<'transfer'|'restart'|'reply'|'safety'|'ai-choice'|'chapter'|'profile'|null>(null),[pendingOffer,setPendingOffer]=useState<ReturnType<typeof offerFor>>(null);
  const [practiceOriginal,setPracticeOriginal]=useState<Run|null>(null),[practiceDone,setPracticeDone]=useState(false);
  const gate=useRef(new ReplyGate()),scroll=useRef<HTMLDivElement>(null),positions=useRef<Record<string,number>>({});
  const mainSaved=useRef<Run|null>(null);
  const budget=useRef(restoreBudget(null,'','full'));
  const stateRef=useRef(state);
  useEffect(()=>{stateRef.current=state;},[state]);
  const dialogRef=useRef<HTMLDialogElement>(null);
  const c=currentCase(state),stage=currentStage(state)!,resolved=isResolved(state);
  const chat=chats[c.id]??[];

  const ownEvidence=evidenceFor(state).filter(e=>e.chapter===state.chapter);
  // A newly entered story stage appends a new block to the current thread.
  // Give that block its own scroll-restoration key so returning from the AI
  // side conversation cannot restore the old (now middle-of-thread) offset.
  const threadStage=app==='messages'&&thread==='current'?':'+state.stage:'';
  const scrollKey=(practiceOriginal?'practice:':'')+state.mode+':'+state.chapter+':'+app+':'+thread+threadStage+':'+browserPage;
  const narrative=narratives[state.chapter],sceneLines=useMemo(()=>messageParts(conversationTimeline(displayedMessages(state,state.stage),(chats[c.id]??[]).filter(m=>m.stage===state.stage))),[state,chats,c.id]);
  const beat=pendingBeat(state);
  const selectedChoices=chosenIds(state);
  const momentUsed=false; // authored replies remain available; AI moved to separate story threads.
  const storyAttempts=state.events.filter(e=>e.type==='message'&&e.data.endsWith(':attempt')).length;
  const remaining=Math.max(0,2-aiUsed-storyAttempts);
  const storyScene=thread==='jisu'?'peer':thread==='support'?'friend':null;
  const memoryKey=(practiceOriginal?'practice:':'')+state.mode+':'+storyScene;
  const reflection=state.events.find(event=>event.type==='reflect'&&event.chapter===state.chapter)?.data;
  const sceneKey=c.id+':'+state.stage;
  const visibleCount=revealed[sceneKey]??0;
  const sceneTyping=!resolved&&visibleCount<sceneLines.length;
  const progressLocked=paused||state.completed||resolved||sceneTyping;
  // Rebuild the whole thread in visited-stage order. In particular, an
  // evidence-card question remains before the paid scene after a transfer.
  const visibleMessages=conversationTranscript(state,chat,resolved?Infinity:visibleCount);
  const currentReceipt=currentThreadReceipt(state.stage,visibleCount,resolved,sceneLines.length);
  const unread=!state.read.includes(state.chapter+':'+currentReceipt);
  const peerMemory=messageMemory[(practiceOriginal?'practice:':'')+state.mode+':peer']??emptyMessageMemory();
  const friendMemory=messageMemory[(practiceOriginal?'practice:':'')+state.mode+':friend']??emptyMessageMemory();
  const peerReceipt=threadReceipt(state,'peer',peerMemory),friendReceipt=threadReceipt(state,'friend',friendMemory);
  const knownReceipt='junho:'+state.stage+':'+(state.calls.includes('0:junho')?'verified':state.cues.includes('junho-unanswered')?'waiting':'hello');
  const activeReceipt=thread==='current'?currentReceipt:thread==='jisu'?peerReceipt:thread==='support'?friendReceipt:knownReceipt;
  const deliveredSignature=thread==='current'?state.stage+':'+(resolved?sceneLines.length:visibleCount):activeReceipt;
  const previousDelivery=useRef({key:scrollKey,signature:deliveredSignature});
  useEffect(()=>{
    if(!started||app!=='messages'||thread==='list'||!atTail||!pageVisible||dialog||paused||showRecent||thread==='current'&&visibleCount===0&&!resolved)return;
    let live=true;
    if(!state.read.includes(state.chapter+':'+activeReceipt))queueMicrotask(()=>{
      if(live&&scroll.current&&scroll.current.scrollHeight-scroll.current.scrollTop-scroll.current.clientHeight<80)setState(previous=>transition(previous,{type:'read',chapter:state.chapter,data:activeReceipt}));
    });
    return()=>{live=false;};
  },[started,app,thread,atTail,pageVisible,dialog,paused,showRecent,visibleCount,resolved,activeReceipt,state.chapter,state.read]);

  useEffect(()=>{
    const update=()=>setPageVisible(!document.hidden);
    document.addEventListener('visibilitychange',update);
    return()=>document.removeEventListener('visibilitychange',update);
  },[]);
  useEffect(()=>{
    if(!started||paused||dialog||showRecent||!pageVisible||app!=='messages'||thread!=='current'||!sceneTyping)return;
    return scheduleMessage(sceneLines[visibleCount].text,reduced,()=>setRevealed(old=>({...old,[sceneKey]:reduced?sceneLines.length:visibleCount+1})),undefined,undefined,sceneLines[visibleCount].speaker);
  },[started,paused,dialog,showRecent,pageVisible,app,thread,sceneTyping,sceneLines,visibleCount,reduced,sceneKey]);
  function cancelReply(){gate.current.cancel();setSending(false);}
  function act(type:string,data=''){
    if(!['inspect','save','read','cue'].includes(type))cancelReply();
    setState(previous=>transition(previous,{type,chapter:previous.chapter,data}));
  }
  function phoneBack(){if(app==='messages'&&thread!=='list')openApp('messages','list');else openApp('home');}
  function openApp(next:App,conversation='current'){
    if(scroll.current)positions.current[scrollKey]=scroll.current.scrollTop;
    cancelReply();setApp(next);setThread(conversation);setShowRecent(false);
    setRecent(previous=>[next,...previous.filter(a=>a!==next)].filter(a=>a!=='home').slice(0,4));
    if(next==='messages'&&conversation!=='list')act('read',conversation);
    if(next==='bank'){act('message-followup','peer:checked-bank');act('read','bank');act('observe','bank-view');}
  }
  useEffect(()=>{
    const viewport=window.visualViewport;
    const update=()=>document.documentElement.style.setProperty('--phone-viewport',Math.round(viewport?.height??window.innerHeight)+'px');
    update();
    window.addEventListener('resize',update);
    viewport?.addEventListener('resize',update);
    return()=>{window.removeEventListener('resize',update);viewport?.removeEventListener('resize',update);document.documentElement.style.removeProperty('--phone-viewport');};
  },[]);
  useEffect(()=>{
    let live=true;const activeGate=gate.current;
    Promise.resolve().then(()=>{
      if(!live)return;
      try {
        const saved=restoreRun(localStorage.getItem(SAVE_KEY));
        if(saved){mainSaved.current=saved;setState(saved);setHasSave(true);}
        budget.current=restoreBudget(localStorage.getItem(budgetKey('full')),crypto.randomUUID(),'full');
        setAiUsed(budget.current.counts.reduce((a,b)=>a+b,0));
      }catch{budget.current.session=crypto.randomUUID();setNote('이 기기에서는 저장을 사용할 수 없습니다. 화면을 닫기 전까지는 진행할 수 있습니다.');}
      setReady(true);
    });
    return()=>{live=false;activeGate.cancel();};
  },[]);
  useEffect(()=>{
    if(!ready||!started||practiceOriginal)return;
    try{localStorage.setItem(state.mode==='demo'?SAVE_KEY+'-demo':SAVE_KEY,serializeRun(state));if(state.mode==='full')mainSaved.current=state;}
    catch{queueMicrotask(()=>setNote('진행 저장에 실패했습니다. 이 화면을 닫으면 기록이 사라질 수 있습니다.'));}
  },[state,ready,started,practiceOriginal]);
  useEffect(()=>{
    queueMicrotask(()=>setNewMessages(false));
    if(scroll.current){scroll.current.scrollTop=positions.current[scrollKey]??(app==='messages'&&thread==='current'?scroll.current.scrollHeight:0);followTail.current=scroll.current.scrollHeight-scroll.current.scrollTop-scroll.current.clientHeight<80;const tail=followTail.current;queueMicrotask(()=>setAtTail(tail));}
  },[scrollKey,app,thread]);
  useEffect(()=>{
    const previous=previousDelivery.current;
    previousDelivery.current={key:scrollKey,signature:deliveredSignature};
    if(previous.key!==scrollKey||previous.signature===deliveredSignature||app!=='messages'||thread==='list')return;
    if(scroll.current){if(followTail.current)scroll.current.scrollTop=scroll.current.scrollHeight;else queueMicrotask(()=>setNewMessages(true));}
  },[scrollKey,deliveredSignature,app,thread]);
  useEffect(()=>{
    if(dialog||paused||showRecent||practiceDone){if(!dialogRef.current?.open)dialogRef.current?.showModal();}
    else dialogRef.current?.close();
  },[dialog,paused,showRecent,practiceDone]);
  useEffect(()=>{
    if(tutorialStep===0&&app==='messages'&&thread==='current')queueMicrotask(()=>setTutorialStep(1));
  },[tutorialStep,app,thread]);
  // Active-screen time only. Backgrounding/pausing resets this optional routine cue;
  // it never advances the plot or triggers a transaction.
  useEffect(()=>{
    if(!started||paused||state.completed||resolved)return;
    let timer:ReturnType<typeof setTimeout>|undefined;
    const schedule=()=>{
      clearTimeout(timer);
      if(document.hidden){gate.current.cancel();setSending(false);return;}
      timer=setTimeout(()=>setState(previous=>transition(previous,{type:'cue',chapter:previous.chapter,data:currentCase(previous).id+':routine'})),12000);
    };
    schedule();document.addEventListener('visibilitychange',schedule);
    return()=>{clearTimeout(timer);document.removeEventListener('visibilitychange',schedule);};
  },[started,paused,state.chapter,state.completed,resolved]);
  function requestStart(mode:'full'|'demo',resume=false){
    setStartRequest({mode,resume});setAiConsent(false);setDialog('ai-choice');
  }
  function start(mode:'full'|'demo',resume=false){
    cancelReply();setNote('');setClosingStep(0);setPracticeOriginal(null);setPracticeDone(false);setTutorialStep(null);
    if(resume&&mainSaved.current){setState(mainSaved.current);try{budget.current=restoreBudget(localStorage.getItem(budgetKey('full')),crypto.randomUUID(),'full');setAiUsed(budget.current.counts.reduce((a,b)=>a+b,0));}catch{setAiAllowed(false);}}
    if(!resume){setMessageMemory(old=>resetMessageMemory(old,mode));setRevealed({});setState(createRun(mode));setChats({});positions.current=resetMessageMemory(positions.current,mode);budget.current=restoreBudget(null,crypto.randomUUID(),mode);persistBudget();}
    setChapterPage(0);setChapterResume(resume);setDialog(resume&&mainSaved.current?.completed?null:'chapter');setStarted(true);setApp(!resume&&mode==='full'?'messages':'home');setThread(!resume&&mode==='full'?'junho':'current');setBrowserPage('start');setPaused(false);
  }
  function persistBudget(){setAiUsed(budget.current.counts.reduce((a,b)=>a+b,0));try{localStorage.setItem(budgetKey(budget.current.mode),JSON.stringify(budget.current));}catch{/* no chat or identity beyond random quota token */}}
  function messageAct(type:string,data:string){
    const previous=stateRef.current;
    // Event-time only: no wall-clock value is read during rendering.
    // eslint-disable-next-line react-hooks/purity
    const now=Date.now();
    if(data.endsWith(':attempt')&&now-budget.current.last<12000){setNote('앞선 메시지 전송 후 12초가 지나면 보낼 수 있습니다. 작성한 내용은 그대로 남아 있습니다.');return false;}
    const nextState=transition(previous,{type,chapter:previous.chapter,data});
    if(nextState===previous)return false;
    // Save the categorical attempt before dispatch, not in a later render effect.
    if(!practiceOriginal){
      try{localStorage.setItem(previous.mode==='demo'?SAVE_KEY+'-demo':SAVE_KEY,serializeRun(nextState));}
      catch{setNote('진행을 저장할 수 없습니다. AI 전송 없이 준비된 메시지나 건너뛰기로 계속할 수 있습니다.');if(data.endsWith(':attempt'))return false;}
    }
    if(data.endsWith(':attempt')){budget.current.last=now;persistBudget();}
    stateRef.current=nextState;setState(nextState);return true;
  }
  function action(type:string){
    if(beat){openApp('messages');return;}
    if(type==='transfer'){if(state.chapter===0)inspect(c.id+':recipient');const offer=offerFor(state);if(offer){cancelReply();setPendingOffer(offer);setDialog('transfer');}return;}
    if(type==='help'){openApp('browser');setBrowserPage('official');return;}
    if(type==='platform'){act('platform');openApp('browser');showPlatform();return;}
    if(type==='stop'){act('resolve','stopped');return;}
    if(type==='finish'){act('resolve','loss');return;}
    act(type);
  }
  function inspect(uid:string){act('inspect',uid);}
  function showPlatform(){act('observe','platform-view');setBrowserPage('platform');}
  function checkRecords(){openApp('browser');setBrowserPage('official');}
  function questionFromRecord(){openApp('messages',messageWindow(state,'peer')?'jisu':'current');}
  function openProfile(known=false){cancelReply();setProfileKnown(known);if(!known&&state.chapter===0)inspect(c.id+':profile');setDialog('profile');}
  const comparison=<RecordComparison state={state} onObserve={()=>act('observe','terms-comparison')} onQuestion={questionFromRecord} onBank={()=>openApp('bank')} onPlatform={()=>{openApp('browser');showPlatform();}}/>;
  function evidenceCards(target:App){
    return ownEvidence.filter(e=>!(e.id==='saved-contact'&&state.chapter===0&&state.stage==='arrival')&&e.app===target&&(target!=='browser'||(browserPage==='platform'?e.id==='success-post':browserPage==='official'?e.id!=='success-post':false))).map(e=><details className="record evidence-record" key={e.uid} onToggle={event=>{if(event.currentTarget.open&&!state.inspected.includes(e.uid))inspect(e.uid);}}>
      <summary><span>{e.title}</span><span aria-hidden="true">⌄</span></summary><p>{state.chapter===2&&e.id==='case-record'?(selectedChoices.some(id=>id==='recovery-explain-loss'||id==='recovery-offer-share')?'이 상담에 전달한 범위는 대화에 남아 있다. 다른 앱에서 확인한 기록은 자동으로 공유되지 않는다.':e.text):e.text}</p>{narrative.beats.filter(b=>!b.required&&!momentUsed&&b.stage===state.stage).flatMap(b=>b.options.filter(o=>o.requires===e.id&&!b.options.some(option=>selectedChoices.includes(option.id))).map(o=><button key={o.id} disabled={resolved||!state.inspected.includes(e.uid)} onClick={()=>{act('talk',o.id);openApp('messages');}}>{o.label}</button>))}<button disabled={state.saved.includes(e.uid)} onClick={()=>act('save',e.uid)}>{state.saved.includes(e.uid)?'메모에 보관됨':'메모에 보관'}</button></details>);
  }
  function next(){
    if(state.chapter===1&&thread!=='support'&&messageStatus(state,'friend')==='ready'){openApp('messages','support');return;}
    if(practiceOriginal){setPracticeDone(true);return;}
    act('next');openApp('home');setBrowserPage('start');
    if(state.chapter<2){setChapterPage(0);setChapterResume(false);setDialog('chapter');}
  }
  function finishChapterScene(){
    const firstTutorial=!chapterResume&&state.mode==='full'&&state.chapter===0;
    setDialog(null);openApp('messages',firstTutorial?'junho':'current');setTutorialStep(firstTutorial?0:null);
  }
  function advanceTutorial(){
    if(tutorialStep===null)return;
    if(tutorialStep>=4){setTutorialStep(null);return;}
    openApp('messages','current');setTutorialStep(tutorialStep+1);
  }
  function rewind(index:number){
    const original=practiceOriginal??state,value=replayBefore(original,index);if(!value)return;
    cancelReply();setMessageMemory(old=>Object.fromEntries(Object.entries(old).filter(([key])=>!key.startsWith('practice:'))));setRevealed({});setPracticeOriginal(original);setPracticeDone(false);setState(value);setChats({});setApp('messages');setThread('current');setBrowserPage('start');setPaused(false);
  }
  function exitPractice(){if(practiceOriginal){cancelReply();setState(practiceOriginal);setPracticeOriginal(null);setPracticeDone(false);setApp('home');}}
  const intro=<div className="intro lock-intro"><div className="lock-clock">09:10</div><p className="lock-date">오늘 · 출근길</p><h1>수익률 24시</h1><p className="intro-lead">월급날까지 나흘.<br/>오늘 저녁에는 준호와 약속이 있다.</p><div className="intro-card"><AppIcon name="messages" size="mini"/><span>메시지 · 준호</span><p>어제<br/><b>내일 저녁 일곱 시, 역 앞에서 보자.</b></p></div>
    {hasSave&&<button className="primary" disabled={!ready} onClick={()=>requestStart('full',true)}>저장된 하루 이어하기</button>}
    <button className={hasSave?'':'primary'} disabled={!ready} onClick={()=>hasSave?setDialog('restart'):requestStart('full')}>새로운 하루 시작</button>
    <button disabled={!ready} onClick={()=>requestStart('demo')}>투자방부터 짧게 체험</button>
    <p className="fine">가상 사기 체험 · 실제 송금·전화는 없습니다. 언제든 멈출 수 있습니다.</p><details className="intro-help"><summary>체험·저장 안내</summary><p className="fine">모든 인물과 거래는 허구이며 압박성 연락이 등장합니다. 진행만 이 기기에 저장하고 대화 원문은 저장하지 않습니다. AI 없이도 끝까지 플레이할 수 있습니다.</p></details></div>;
  const currentPreview=state.blocked.includes(state.chapter)?'차단한 계정':messagePreview(visibleMessages,c.preview);
  const junhoReply=state.chapter===0?(state.calls.includes('0:junho')?'이제 메시지 봤어. 나는 다른 계정으로 결제 부탁한 적 없어. 무슨 일이야?':'출근 중이라 한동안 답장이 늦을 수 있어. 저녁에 보자.'):friendFollowup(state);
  const homeContent=<div className="phone-home"><div className="home-clock"><span>오늘, 나의 하루</span><strong>{gameTime(state)}</strong><p>{state.chapter===0?'저녁 약속이 있는 날':state.chapter===1?'익숙한 화면, 낯선 숫자':'아직 남아 있는 연락'}</p></div>
      <button className="notification" onClick={()=>openApp('messages')}><span>메시지 · {unread?'새 연락':'최근 연락'}</span><strong>{c.sender}</strong><p>{currentPreview}</p></button>
      {state.cues.includes(c.id+':routine')&&<button className="notification quiet" onClick={()=>openApp('messages','junho')}><span>준호 · 기존 연락처</span><p>{junhoReply}</p></button>}
      <article className="calendar-widget"><small>{state.chapter===2?'마친 일정':'오늘 일정'}</small><b>19:00</b><span>준호와 저녁 · 역 앞</span></article><p className="routine-plan">생활 메모 · 월급날까지 나흘<br/>교통비와 저녁값 남겨 두기</p><div className="app-grid">{[...appList,'settings' as App].map(a=><button key={a} onClick={()=>openApp(a,a==='messages'?'list':'current')}><AppIcon name={a}/><span>{names[a]}</span>{a==='messages'&&unread&&<i className="unread-dot" aria-label="읽지 않은 연락"/>}</button>)}</div>
      </div>;
  const branchActions=state.chapter===2?<div className="contact-branches">
    {branchUseAllowed(state,'compare')&&<button onClick={()=>{if(messageAct('branch-use','compare'))openApp('notes');}}>지수와 남긴 기록 대조하기</button>}
    {branchUseAllowed(state,'records')&&<button onClick={()=>{if(messageAct('branch-use','records'))openApp('bank');}}>준호와 확인할 거래 내역 열기</button>}
    {branchUseAllowed(state,'pause')&&<article className="record"><small>준호 · 저녁 약속</small><p>아까 못다 한 얘기는 나중에 해도 돼. 집에 가는 길엔 잠깐 쉬어.</p><button onClick={()=>{if(messageAct('branch-use','pause'))act('resolve','paused');}}>이 연락에는 지금 답하지 않기</button></article>}
  </div>:null;
  const messagesContent=
storyScene?<><StoryMessage embedded key={storyScene+':'+state.chapter+':'+Boolean(practiceOriginal)} state={state} memory={messageMemory[memoryKey]??emptyMessageMemory()} onMemory={patch=>setMessageMemory(old=>({...old,[memoryKey]:{...(old[memoryKey]??emptyMessageMemory()),...patch}}))} scene={storyScene} aiAllowed={aiAllowed} getSession={()=>budget.current.session} remaining={remaining} practice={Boolean(practiceOriginal)} reduced={reduced} paused={paused||showRecent||Boolean(dialog)} onEvent={messageAct} onBack={()=>openApp('messages','list')} onContinue={()=>storyScene==='friend'&&state.chapter===1?next():openApp('messages')} onProfile={()=>openProfile(storyScene==='friend')}/>{storyScene==='friend'&&<button className="text-button history-link" onClick={()=>openApp('messages','junho')}>이전 약속 대화 보기</button>}</>:
thread==='list'?<><div className="conversation-list">
 <ConversationRow name={c.sender} initial={contactProfile(state.chapter).initial} detail={state.chapter===1?'안내 채널':'저장되지 않은 계정'} preview={currentPreview} unread={unread} onOpen={()=>openApp('messages','current')}/>
 <ConversationRow name="준호" initial="준" detail="저장된 연락처" preview={messageThreadVisible(state,'friend')&&(messageWindow(state,'friend')||messageStatus(state,'friend')!=='ready')?threadPreview(state,'friend',friendMemory):state.chapter===0&&!state.calls.includes('0:junho')&&state.cues.includes('junho-unanswered')?'나: 지금 연락 가능해?':junhoReply} unread={!state.read.includes(state.chapter+':'+(messageThreadVisible(state,'friend')&&(messageWindow(state,'friend')||messageStatus(state,'friend')!=='ready')?friendReceipt:knownReceipt))} onOpen={()=>openApp('messages',messageThreadVisible(state,'friend')&&(messageWindow(state,'friend')||messageStatus(state,'friend')!=='ready')?'support':'junho')}/>
 {messageThreadVisible(state,'peer')&&(messageWindow(state,'peer')||messageStatus(state,'peer')!=='ready')&&<ConversationRow name="지수" initial="지" detail="온결 자료방 참여자" preview={threadPreview(state,'peer',peerMemory)} unread={!state.read.includes(state.chapter+':'+peerReceipt)} onOpen={()=>openApp('messages','jisu')}/>}
 </div>{branchActions}{supportReady(state)&&!state.events.some(e=>e.type==='support')&&<button className="support-forward" onClick={()=>{act('support','recovery');openApp('messages','junho');}}>준호에게 이 연락 전달하기</button>}
 {state.results.some(r=>r.chapter<state.chapter)&&<details className="past-conversations"><summary>이전 연락 기록</summary>{state.results.filter(r=>r.chapter<state.chapter).map(r=><article className="record" key={r.chapter}><h3>{chapters[r.chapter].story.title}</h3><p>출금 {money(r.spent)}</p><button onClick={()=>openApp('notes')}>보관한 기록 보기</button></article>)}</details>}</>:thread!=='current'?<><p className="day-context">{state.chapter===0?'월급날까지 나흘. 오늘 저녁 약속을 다시 확인한다.':narrative.place}</p><p className="system-message">어제</p><ChatBubbles speaker="나" text="이번 주는 월급 전이라 저녁은 가볍게 먹자. 늘 가던 데 어때?"/><ChatBubbles speaker="준호" text="내일 저녁 일곱 시, 역 앞에서 보자. 지난번처럼 내가 먼저 가 있을게. 늦으면 원래 번호로 연락해."/><p className="system-message">{state.chapter===2?'오늘 · 저녁 약속 이후':'오늘'}</p>{state.calls.includes(state.chapter+':junho')&&<ChatBubbles speaker="나" text={state.chapter===0?'혹시 다른 계정으로 결제를 부탁했어?':'네 이름이 보이는 연락이 왔는데, 네가 아는 곳인지 확인해 줄래?'}/>}<ChatBubbles speaker="준호" text={junhoReply}/>{state.chapter===0&&!state.calls.includes('0:junho')&&state.cues.includes('junho-unanswered')&&<><ChatBubbles speaker="나" text="지금 연락 가능해?"/><p className="system-message">아직 읽지 않음</p></>}<button className="contact-shortcut" onClick={()=>openApp('calls')}><span className="avatar" data-person="준호">준</span><span>저장된 연락처 확인<small>준호 · 기존 번호</small></span></button>{state.chapter===0&&<button className="notification new-account" onClick={()=>openApp('messages','current')}><small>메시지 · 준호의 새 계정</small><p>{c.preview}</p><span>도착한 새 연락 보기</span></button>}{state.chapter===2&&state.events.some(e=>e.type==='support'&&e.data==='recovery')&&<><div className="bubble mine"><small>전달한 연락 · {c.sender}</small><p>피해 확인과 회수 지원을 안내하는 연락이 왔어.</p></div><div className="bubble"><small>준호</small><p>아까 말한 새 연락이구나. 이 사람이 준 연락처 말고, 우리가 직접 공식 접수 안내를 열어 보자. 접수와 돈을 돌려받는 건 다른 일이니까.</p></div><button onClick={()=>{messageAct('branch-use','verify');openApp('browser');setBrowserPage('official');}}>공식 접수 안내 열기</button></>}</>:<><p className="system-message">{narrative.place}</p><details className="scene-context"><summary>이 연락이 오기 전</summary>{arrivalContext(state).map(text=><p key={text}>{text}</p>)}</details><details className="chat-records"><summary>프로필·연락 기록</summary>{evidenceCards('messages')}</details>
      <section className="chat-stage">{visibleMessages.map((m,i)=>m.speaker==='알림'?<p className="system-message" key={m.stageId+':'+m.id}>{m.text}</p>:<ChatBubbles speaker={m.speaker} text={m.text} showSender={i===0||visibleMessages[i-1].speaker!==m.speaker} key={m.stageId+':'+m.id}>{m.speaker===retainedQuestion.speaker&&m.sourceText===retainedQuestion.text&&m.lastPart&&state.chapter===1&&!['withdrawal','extra-paid'].includes(state.stage)&&<button className="message-save" disabled={state.events.some(e=>e.type==='capture'&&e.data===retainedQuestion.id)} onClick={()=>act('capture',retainedQuestion.id)}>{state.events.some(e=>e.type==='capture'&&e.data===retainedQuestion.id)?'보관됨':'메모에 보관'}</button>}</ChatBubbles>)}</section>
      {(sending||sceneTyping)&&<p className="typing" role="status">{sending?c.sender+' 입력 중':sceneLines[visibleCount]?.speaker==='알림'?'대화 업데이트 중':sceneLines[visibleCount]?.speaker==='나'?'보내는 중':sceneLines[visibleCount]?.speaker+' 입력 중'}<span aria-hidden="true"> …</span></p>}
      {branchActions}{messageWindow(state,'peer')&&<button className="notification peer-invitation" onClick={()=>openApp('messages','jisu')}><strong>지수 · 개인 메시지</strong><p>{messageStatus(state,'peer')==='ready'?'입금하기 전에 먼저 확인할 게 있을까요?':'지수와의 연락 보기'}</p></button>}{resolved&&<>{conversationEndText(state)&&<p className="system-message">{conversationEndText(state)}</p>}<div className="resolution-line"><p>{outcomeText(state)}</p><p>{chapterSpent(state)>0?narrative.aftermath.loss:narrative.aftermath.safe}</p>{state.chapter===1?<button onClick={()=>openApp('messages','support')}>준호의 메시지 보기</button>:!reflection?<><button onClick={()=>act('reflect','tell')}>준호에게 오늘 일을 말하기</button><button onClick={()=>act('reflect','keep')}>기록을 남기고 혼자 정리하기</button></>:<p>{reflection==='tell'?(chapterSpent(state)>0?'준호: 말해 줘서 고마워. 혼자 급하게 해결하려고 하지는 말자. 남은 기록부터 같이 보자.':'준호: 확인해 보고 멈춘 거구나. 얘기해 줘서 고마워.'): '당장 말로 정리하지 않아도 된다. 오늘 확인한 기록은 이 휴대폰에 남아 있다.'}</p>}</div></>}</>;
  const messageDock=<div className="message-dock" aria-label="대화 행동">
    {resolved?<><p className="next-scene-hint">{state.chapter===2?'연락을 정리했습니다. 아래 버튼으로 하루를 마무리하세요.':'이 연락은 정리됐습니다. 아래 버튼으로 다음 장면을 이어가세요.'}</p><button className="primary" onClick={next}>{practiceOriginal?'바뀐 선택 확인':state.chapter===2?'휴대폰 정리하기':state.chapter===0?'점심시간으로':'준호와의 저녁 약속으로'}</button></>:<>
      {sceneTyping&&<button className="skip-messages" onClick={()=>setRevealed(old=>({...old,[sceneKey]:sceneLines.length}))}>대화 바로 보기</button>}
      <div className="dock-actions">{beat?beat.options.filter(o=>choiceAllowed(state,o)).map(o=><button className="reply-option" key={o.id} disabled={sceneTyping||sending} onClick={()=>act('talk',o.id)}>{o.label}</button>):stage.actions.map((a,i)=><button className={i===0?'primary':''} key={a.type} disabled={sceneTyping||sending} onClick={()=>action(a.type)}>{a.type==='transfer'?'송금 안내':a.type==='platform'?'투자 화면':a.type==='withdraw'?'출금 요청':a.type==='stop'?'추가 송금 중단':a.type==='advance'?(state.chapter===1&&state.stage==='arrival'?'자료방 들어가기':'계속 읽기'):a.label}</button>)}</div>
      <div className="input-rail"><button aria-label="준비된 답장" disabled={sceneTyping||sending} onClick={()=>setDialog('reply')}>＋</button><button className="input-placeholder" onClick={checkRecords}>기록 확인하기</button><button aria-label="보류·차단" onClick={()=>{cancelReply();setDialog('safety');}}>⋯</button></div>
    </>}
  </div>;
  const callsContent=<>{messageStatus(state,'friend')==='together'&&<article className="record"><h3>준호 · 저녁 약속 전 연락</h3><p>{state.events.some(e=>e.type==='message-followup'&&e.data==='friend:call')?'연락 요약':'아직 안 읽은 연락'}</p><button onClick={()=>openApp('messages','support')}>연락 요약 보기</button></article>}<article className="record contact-card"><div className="contact-identity"><span className="avatar" data-person="준호">준</span><h3>준호 <small>저장된 번호</small></h3></div><button onClick={()=>{act('call','junho');openApp('messages','junho');}}>저장된 번호로 확인하기</button>{state.chapter===0&&!state.calls.includes('0:junho')&&state.cues.includes('junho-unanswered')&&<p>보낸 메시지를 아직 읽지 않았습니다.</p>}{state.calls.includes(state.chapter+':junho')&&<p>{state.chapter===0?'기존 번호의 준호가 결제를 부탁한 적도, 새 계정을 만든 적도 없다고 답했습니다.':'기존 번호의 준호는 이 서비스에 관해 아는 것이 없다고 답했습니다.'}</p>}</article>
      <article className="record contact-card"><div className="contact-identity"><span className="avatar" data-person={c.sender}>{c.sender.slice(0,1)}</span><h3>{c.sender} <small>{state.chapter===1?'안내 채널':'저장되지 않은 계정'}</small></h3></div><button onClick={()=>openApp('messages','current')}>이 계정과의 대화 보기</button></article>
      {state.chapter===2&&<button onClick={()=>act('call','contact')}>상담 연락처 대조하기</button>}
      {evidenceCards('calls')}</>;
  const browserContent=<><div className="address">⌑ {browserPage==='platform'?'on-gyeol.invalid / account':'내가 직접 연 브라우저'}<span>가상</span></div>
      <nav className="browser-tabs"><button onClick={()=>setBrowserPage('start')}>시작</button><button onClick={()=>setBrowserPage('official')}>공식 경로</button>{state.chapter===1&&<button onClick={showPlatform}>투자 화면</button>}</nav>
      {browserPage==='platform'&&state.chapter===1?<><InvestmentScreen state={state}/>{state.stage==='paid'&&!beat&&<button onClick={()=>action('withdraw')}>출금 요청</button>}{['withdrawal','extra-paid'].includes(state.stage)&&<p className="system-message">출금 보류 · 담당자 확인 중</p>}{comparison}<button onClick={()=>openApp('bank')}>은행 거래 내역 열기</button><button onClick={()=>openApp('messages')}>자료방으로</button></>:<><h2>{browserPage==='official'?'공식 확인':'브라우저'}</h2>{browserPage==='start'&&<button className="search-entry" onClick={()=>setBrowserPage('official')}>⌕ 금융회사·접수 안내 찾기</button>}</>}
      {evidenceCards('browser')}
      {browserPage==='official'&&state.chapter===0&&<article className="record"><h3>지인 연락 확인</h3><p>새 대화에 적힌 연락처가 아닌, 이전부터 저장한 연락처에서 먼저 확인할 수 있습니다.</p><button onClick={()=>openApp('calls')}>내 연락처 열기</button></article>}
      {browserPage==='official'&&state.chapter===2&&<article className="record"><h3>자료 접수</h3><p>현재 연락의 기록을 보관하면 접수할 수 있습니다. 접수는 환급이 아닙니다.</p><button disabled={resolved||!ownEvidence.some(e=>state.saved.includes(e.uid))} onClick={()=>{act('resolve','reported');openApp('messages');}}>보관한 자료로 접수</button><button onClick={()=>openApp('notes')}>보관한 기록 보기</button></article>}</>;
  async function checkModel(){if(checking)return;setChecking(true);try{const response=await fetch('/api/ai-chat');const value=await response.json() as {enabled?:boolean};setModelStatus(response.ok&&value.enabled?'서버 연결됨 · 생성 호출 없음':'내장 대사 사용 가능');}catch{setModelStatus('연결 불가 · 내장 대사 사용 가능');}finally{setChecking(false);}}
  const tutorialCopy=[
    ['새 연락 열기','밝게 표시된 ‘도착한 새 연락 보기’를 직접 눌러 새 계정의 대화를 여세요.'],
    ['답장 고르기','메시지가 모두 도착하면 이 위치에 답장 선택지가 나타납니다. 선택에 따라 상대의 반응과 다음 행동이 달라집니다.'],
    ['기록 확인하기','대화만 믿지 않고 연락처·은행·공식 안내를 확인하려면 이 버튼을 사용합니다.'],
    ['연락 정리하기','보류하거나 차단하려면 오른쪽의 ‘⋯’ 버튼을 사용합니다. 송금하지 않아도 끝까지 진행할 수 있습니다.'],
    ['홈으로 이동하기','화면 아래의 홈 버튼으로 은행·연락처·메모 등 다른 앱을 열 수 있습니다.']
  ];
  const tutorial=tutorialStep!==null&&state.chapter===0?<><div className="tutorial-scrim" aria-hidden="true"/><section className={'phone-tutorial tutorial-card-'+tutorialStep} role="dialog" aria-label="첫 사건 조작 안내"><small>조작 안내 {tutorialStep+1} / {tutorialCopy.length}</small><h2>{tutorialCopy[tutorialStep][0]}</h2><p>{tutorialCopy[tutorialStep][1]}</p>{tutorialStep===0?<p className="tutorial-action">밝게 표시된 실제 버튼을 눌러 보세요.</p>:<button className="primary" onClick={advanceTutorial}>{tutorialStep===tutorialCopy.length-1?'안내 마치기':'다음 위치 보기'}</button>}<button className="text-button" onClick={()=>setTutorialStep(null)}>안내 건너뛰기</button></section></>:null;
  const content=app==='home'?homeContent:app==='messages'?messagesContent:app==='calls'?callsContent:app==='bank'?<><Ledger state={state}/>{comparison}{evidenceCards('bank')}{offerFor(state)&&!beat&&<button className="primary" onClick={()=>action('transfer')}>현재 요청의 송금 안내</button>}</>:app==='browser'?browserContent:app==='notes'?<><h2>오늘의 기록</h2><details className="record"><summary>지금까지의 하루</summary>{chapterPages(state).map(scene=><article key={scene.title}><h3>{scene.time}</h3>{scene.lines.filter(Boolean).map(text=><p key={text}>{text}</p>)}</article>)}<h3>멈춘 연락</h3>{resumeContext(state).map(text=><p key={text}>{text}</p>)}</details><h2>내가 보관한 기록</h2>{branchActions}{state.chapter===2&&state.events.some(e=>e.type==='branch-use'&&e.data==='compare')&&<section className="record-comparison"><h3>서로 다른 연락의 주장</h3><article className="record"><small>앞서 지수에게 보낸 기록</small><p>{attachmentText[messageStyle(state,'peer').focus as keyof typeof attachmentText]}</p><p>지수: {peerFollowupText(state)}</p></article><article className="record"><small>현재 발신자 · {c.sender}</small><p>{c.preview}</p></article><p className="fine">이전 자료와 현재 발신자의 말은 각각의 주장입니다. 같은 업체인지, 공식 접수인지 별도로 확인해야 합니다.</p><button onClick={()=>{openApp('browser');setBrowserPage('official');}}>독립된 공식 안내 열기</button></section>}{messageConsequences(state).map(text=><article className="record" key={text}><p>{text}</p></article>)}{evidenceFor(state).filter(e=>state.saved.includes(e.uid)).map(e=><article className="record" key={e.uid}><span className="eyebrow">{chapters[e.chapter].story.title}</span><h3>{e.title}</h3><small>{names[e.app as App]} · {gameTime(replayBefore(state,state.events.findIndex((event:{type:string;data:string})=>event.type==='save'&&event.data===e.uid))!)}</small><p>{e.text}</p></article>)}{state.events.some(e=>e.type==='capture'&&e.data===retainedQuestion.id)&&<article className="record"><small>온결 자료방 · 삭제 전 보관</small><h3>{retainedQuestion.speaker}</h3><p>{retainedQuestion.text}</p></article>}{!state.saved.length&&!state.events.some(e=>e.type==='capture')&&!messageConsequences(state).length&&<p>아직 보관한 기록이 없습니다.</p>}<button onClick={()=>openApp('messages')}>최근 연락으로 돌아가기</button></>:<><h2>잠깐 쉬어가기</h2><details className="settings-guide"><summary>조작 안내 다시 보기</summary><PlayGuide state={state}/></details><article className="record"><h3>지금 할 수 있는 일</h3><p>메시지에서 대화를 더 읽거나, 다른 앱에서 기록을 살펴볼 수 있습니다. 진행하지 않으려면 대화 하단의 ‘보류·차단’을 누르세요.</p><button onClick={()=>openApp('messages')}>현재 연락으로</button></article><label className="setting"><input type="checkbox" checked={large} onChange={e=>setLarge(e.target.checked)}/>글자 크게</label><label className="setting"><input type="checkbox" checked={reduced} onChange={e=>setReduced(e.target.checked)}/>움직임 줄이기</label><label className="setting"><input type="checkbox" checked={aiAllowed} onChange={e=>{cancelReply();setAiAllowed(e.target.checked);}}/>만 18세 이상이며, 선택적 AI 대화 사용</label><p className="fine">켜면 지수·준호에게 직접 보내는 메시지와 선택한 첨부만 Gemini로 전송됩니다. 개인정보를 입력하지 마세요. 사건 진행과 거래값은 코드로 결정됩니다. AI 대사의 오류 가능성은 남아 있으므로 실제 금융 안내로 사용하지 마세요. 내장 대사만으로도 끝까지 진행됩니다.</p><button disabled={checking} onClick={()=>void checkModel()}>{checking?'연결 확인 중':'연결 상태만 확인'}</button><p role="status">{modelStatus}</p><p className="fine">이번 실행의 AI 시도 {aiUsed+storyAttempts} / 2. 지수·준호에게 각각 한 번만 사용합니다. 이전 버전의 사용량도 포함하며 재시도는 하지 않습니다.</p><button onClick={()=>setDialog('restart')}>새 하루로 초기화</button><p className="fine">이 기기의 진행 기록을 바꿉니다. 입력 대화는 원래 저장하지 않습니다.</p></>;
  return <main className={'story-world '+c.story.tone+(large?' large-text':'')+(reduced?' reduce-motion':'')}><div className="desktop-caption"><span>WHATFRAUD</span><p>낯선 위험은<br/>익숙한 화면으로 온다.</p><small>하나의 휴대폰, 세 번의 선택.<br/>소리 없이도 모든 내용을 볼 수 있습니다.</small></div><section className={'phone phone-'+app+((app==='home'||!started)?' wallpaper':'')} aria-label="가상 휴대폰">
    <PhoneStatus time={started?gameTime(state):'09:10'}/>
    {!started?<div className="screen-scroll">{intro}</div>:state.completed&&!practiceOriginal&&closingStep<4?<div className="screen-scroll closing-screen"><Closing state={state} step={closingStep} onNext={()=>setClosingStep(step=>step+1)} onSkip={()=>setClosingStep(4)}/></div>:state.completed&&!practiceOriginal?<div className="screen-scroll"><Rewind state={state} onReplay={rewind} onRestart={()=>{setHasSave(Boolean(mainSaved.current));setStarted(false);}}/></div>:<>
      <header className="app-header"><button onClick={phoneBack} aria-label={app==='messages'&&thread!=='list'?'대화 목록으로':'홈으로'}>‹</button>{app==='messages'&&thread!=='list'?<button className="header-contact" onClick={()=>openProfile(thread!=='current'&&thread!=='jisu')}><span className="avatar" data-person={thread==='jisu'?'지수':thread==='current'?c.sender:'준호'} aria-hidden="true">{thread==='jisu'?'지':thread==='current'?contactProfile(state.chapter).initial:'준'}</span><span><b>{thread==='jisu'?'지수':thread==='current'?c.sender:'준호'}</b><small>{thread==='jisu'?'온결 자료방 참여자':thread==='current'?contactProfile(state.chapter).relationship:'저장된 연락처'}</small></span></button>:<strong>{app==='messages'?'대화':names[app]}</strong>}<button onClick={()=>{cancelReply();setPaused(true);}} aria-label="일시정지">Ⅱ</button><button onClick={()=>openApp('settings')} aria-label="설정">⚙</button></header>
      {practiceOriginal&&<div className="practice-bar"><span>되감기 · 원본 기록 보존</span><button onClick={exitPractice}>원래 기록으로</button></div>}
      {unread&&app!=='home'&&app!=='messages'&&<button className="notification compact" onClick={()=>openApp('messages')}>메시지 · {c.sender}의 새 연락</button>}
      {peerRecordReady(state)&&!state.events.some(e=>e.type==='message-followup'&&e.data==='peer:record')&&<button className="notification compact" onClick={()=>{if(messageAct('message-followup','peer:record'))openApp('messages','jisu');}}>지수 · 확인해 본 기록을 남겼어요</button>}
      <div className={'screen-scroll app-'+app} ref={scroll} onScroll={e=>{const node=e.currentTarget;positions.current[scrollKey]=node.scrollTop;followTail.current=node.scrollHeight-node.scrollTop-node.clientHeight<80;setAtTail(followTail.current);if(followTail.current)setNewMessages(false);}}>{content}</div>
      {app==='messages'&&newMessages&&<button className="new-message-pill" onClick={()=>{if(scroll.current)scroll.current.scrollTop=scroll.current.scrollHeight;followTail.current=true;setAtTail(true);setNewMessages(false);}}>새 메시지 ↓</button>}
      {app==='messages'&&thread==='current'&&messageDock}
      <nav className="system-nav" aria-label="휴대폰 탐색"><button onClick={phoneBack} aria-label="뒤로">‹</button><button className="home-indicator" onClick={()=>openApp('home')} aria-label="홈"><span/></button><button onClick={()=>{cancelReply();setShowRecent(!showRecent);}}>최근 앱</button></nav>
      {tutorial}

    </>}
    {note&&<div className="notice" role="status"><p>{note}</p><button onClick={()=>setNote('')} aria-label="안내 닫기">×</button></div>}
    <dialog className={dialog==='profile'?'profile-dialog':''} ref={dialogRef} onCancel={()=>{setDialog(null);setPaused(false);setShowRecent(false);if(practiceDone)exitPractice();}} onClose={()=>{setDialog(null);setPaused(false);setShowRecent(false);}} aria-label="휴대폰 선택 창">{paused?<><span className="eyebrow">잠시 멈춘 하루</span><h2>준비되면 이어가세요.</h2><p>멈춰 있는 동안 연락이 진행되거나 돈이 빠져나가지 않습니다.</p><button className="primary" onClick={()=>setPaused(false)}>계속하기</button><button onClick={()=>{setPaused(false);setStarted(false);setHasSave(Boolean(mainSaved.current));}}>처음 화면으로</button></>:showRecent?<><h2>최근 앱</h2>{recent.map(a=><button key={a} onClick={()=>openApp(a,a==='messages'?'list':'current')}><AppIcon name={a} size="mini"/>{names[a]}</button>)}<button onClick={()=>setShowRecent(false)}>닫기</button></>:practiceDone?<><h2>이번에는 이렇게 멈췄습니다</h2><p>{outcomeText(state)}</p><p>이 연락의 가상 출금: {money(chapterSpent(state))}</p><p>원래 기록: {money(chapterSpent({...practiceOriginal!,chapter:state.chapter}))}</p><button className="primary" onClick={exitPractice}>원래 하루의 기록으로</button></>:dialog==='profile'?<ContactProfile profile={thread==='jisu'?{name:'지수',initial:'지',status:'잠깐 멈추고 확인 중',relationship:'온결 자료방 참여자',kind:'friend'}:contactProfile(state.chapter,profileKnown)} callAvailable={thread!=='jisu'} blocked={thread!=='jisu'&&!profileKnown&&state.blocked.includes(state.chapter)} onClose={()=>setDialog(null)} onChat={()=>{setDialog(null);openApp('messages',thread==='jisu'?'jisu':thread==='support'?'support':profileKnown?'junho':'current');}} onCall={()=>{setDialog(null);openApp('calls');}}/>:dialog==='chapter'?<ChapterScene state={state} page={chapterPage} resume={chapterResume} onNext={()=>setChapterPage(page=>page+1)} onContinue={finishChapterScene}/>:dialog==='ai-choice'?<><h2>어떻게 대화할까요?</h2><p>선택 답장만으로도 끝까지 플레이할 수 있습니다.</p><label className="setting"><input type="checkbox" checked={aiConsent} onChange={e=>setAiConsent(e.target.checked)}/>만 18세 이상이며 AI 대화 사용에 동의합니다.</label><p className="fine">AI를 켜면 투자방의 지수와 실제 친구 준호에게 한 번씩 직접 메시지를 보낼 수 있습니다. 작성한 메시지와 선택한 첨부가 Gemini로 전송됩니다. 개인정보는 입력하지 마세요. 전체 최대 2회이며 잘못된 답변이 나올 수 있습니다.</p><button className="primary" disabled={!aiConsent} onClick={()=>{setAiAllowed(true);setDialog(null);start(startRequest.mode,startRequest.resume);}}>AI 대화로 시작</button><button onClick={()=>{setAiAllowed(false);setDialog(null);start(startRequest.mode,startRequest.resume);}}>준비된 답장으로 시작</button><button onClick={()=>setDialog(null)}>돌아가기</button></>:dialog==='reply'?<><h2>답장</h2><div className="quick-questions">{narrative.beats.filter(b=>b.stage===state.stage&&(b===beat||!b.required&&!momentUsed)&&!b.options.some(o=>selectedChoices.includes(o.id))).flatMap(b=>b.options.filter(o=>choiceAllowed(state,o)).map(o=><button key={o.id} disabled={sending||progressLocked} onClick={()=>{setDialog(null);act('talk',o.id);}}>{o.label}</button>))}</div><p className="fine">준비된 답장은 AI를 사용하지 않습니다.</p><button onClick={()=>{setDialog(null);checkRecords();}}>기록 확인하기</button><button onClick={()=>setDialog(null)}>닫기</button></>:dialog==='safety'?<><h2>이 연락을 어떻게 할까요?</h2><button onClick={()=>{act('resolve','paused');setDialog(null);}}>일단 보류하기</button><button onClick={()=>{act('resolve','blocked');setDialog(null);}}>이 계정 차단하기</button><button disabled={!verified(state)} onClick={()=>{act('resolve','verified');setDialog(null);}}>확인한 내용으로 요청 종료</button>{!verified(state)&&<p className="fine">확인 후 종료하려면 독립된 기록을 살펴보세요.</p>}<button onClick={()=>setDialog(null)}>대화로 돌아가기</button></>:dialog==='transfer'&&pendingOffer?<><span className="eyebrow">송금</span><h2 id="dialog-title">{money(pendingOffer.amount)}</h2><p>받는 이름 <b>{pendingOffer.recipient}</b></p><p>목적 {pendingOffer.purpose}</p><p className="fine">실제 돈은 이동하지 않습니다. ‘보내기’를 누르면 게임 잔액에서 출금됩니다.</p><button className="primary" onClick={()=>{act('confirm',pendingOffer.id);setDialog(null);openApp('messages');}}>보내기</button><button onClick={()=>setDialog(null)}>취소하고 더 확인</button></>:<><h2 id="dialog-title">새 하루를 시작할까요?</h2><p>이 기기의 기존 진행 기록을 새 기록으로 바꿉니다.</p><button className="primary" onClick={()=>requestStart('full')}>기존 기록 바꾸고 시작</button><button onClick={()=>setDialog(null)}>취소</button></>}</dialog>
  </section><div className="desktop-footer">수익률 24시 <span>가상 스마트폰 체험</span></div></main>;
}
