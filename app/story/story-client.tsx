'use client';

import { useEffect, useRef, useState } from 'react';
import AppIcon from '../app-icon';
import { cases } from '../game-data';
import { getScriptedReply, buildFallbackReply, sanitizePlayerText, validateAiReply, type AiChatMessage } from '../ai-dialogue';
import { chapters, createRun, currentCase, currentStage, transition, SAVE_KEY, serializeRun, restoreRun, replayBefore, evidenceFor, verified, offerFor, money, gameTime, isResolved, outcomeText, recoveryContext, chapterSpent } from './engine';
import { budgetKey, restoreBudget } from './session-budget';
import { ReplyGate } from './reply-gate';
import { Ledger, Rewind } from './panels';
type Run = ReturnType<typeof createRun>;
type App = 'home'|'messages'|'calls'|'bank'|'browser'|'notes'|'settings';
type Chat = AiChatMessage & {stage:string};
const names:Record<App,string>={home:'홈',messages:'메시지',calls:'전화',bank:'은행',browser:'브라우저',notes:'메모',settings:'설정'};
const appList:App[]=['messages','calls','bank','browser','notes'];

export default function StoryClient(){
  const [state,setState]=useState<Run>(()=>createRun());
  const [ready,setReady]=useState(false),[started,setStarted]=useState(false),[hasSave,setHasSave]=useState(false);
  const [app,setApp]=useState<App>('home'),[recent,setRecent]=useState<App[]>([]),[showRecent,setShowRecent]=useState(false);
  const [thread,setThread]=useState('current'),[browserPage,setBrowserPage]=useState('start');
  const [chats,setChats]=useState<Record<string,Chat[]>>({}),[drafts,setDrafts]=useState<Record<string,string>>({});
  const [sending,setSending]=useState(false),[paused,setPaused]=useState(false),[note,setNote]=useState('');
  const [aiUsed,setAiUsed]=useState(0);
  const [aiAllowed,setAiAllowed]=useState(false),[modelStatus,setModelStatus]=useState('확인하지 않음'),[checking,setChecking]=useState(false);
  const [reduced,setReduced]=useState(false),[large,setLarge]=useState(false);
  const [dialog,setDialog]=useState<'transfer'|'restart'|null>(null),[pendingOffer,setPendingOffer]=useState<ReturnType<typeof offerFor>>(null);
  const [practiceOriginal,setPracticeOriginal]=useState<Run|null>(null),[practiceDone,setPracticeDone]=useState(false);
  const gate=useRef(new ReplyGate()),scroll=useRef<HTMLDivElement>(null),positions=useRef<Record<string,number>>({});
  const mainSaved=useRef<Run|null>(null);
  const budget=useRef(restoreBudget(null,'','full'));
  const stateRef=useRef(state);
  useEffect(()=>{stateRef.current=state;},[state]);
  const dialogRef=useRef<HTMLDialogElement>(null);
  const c=currentCase(state),stage=currentStage(state)!,resolved=isResolved(state),activeCase=cases.find(item=>item.id===c.id)!;
  const chat=chats[c.id]??[],draft=drafts[c.id]??'';
  const readKey=state.chapter+':current',unread=!state.read.includes(readKey);
  const ownEvidence=evidenceFor(state).filter(e=>e.chapter===state.chapter);
  const scrollKey=state.chapter+':'+app+':'+thread+':'+browserPage;
  const progressLocked=paused||state.completed||resolved;
  function cancelReply(){gate.current.cancel();setSending(false);}
  function act(type:string,data=''){
    if(!['inspect','save','read','cue'].includes(type))cancelReply();
    setState(previous=>transition(previous,{type,chapter:previous.chapter,data}));
  }
  function openApp(next:App,conversation='current'){
    if(scroll.current)positions.current[scrollKey]=scroll.current.scrollTop;
    cancelReply();setApp(next);setThread(conversation);setShowRecent(false);
    setRecent(previous=>[next,...previous.filter(a=>a!==next)].filter(a=>a!=='home').slice(0,4));
    if(next==='messages')act('read',conversation);
    if(next==='bank')act('read','bank');
  }
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
    if(scroll.current)scroll.current.scrollTop=positions.current[scrollKey]??0;
  },[scrollKey]);
  useEffect(()=>{
    if(dialog||paused||showRecent||practiceDone){if(!dialogRef.current?.open)dialogRef.current?.showModal();}
    else dialogRef.current?.close();
  },[dialog,paused,showRecent,practiceDone]);
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
  function start(mode:'full'|'demo',resume=false){
    cancelReply();setNote('');setPracticeOriginal(null);setPracticeDone(false);
    if(resume&&mainSaved.current){setState(mainSaved.current);try{budget.current=restoreBudget(localStorage.getItem(budgetKey('full')),crypto.randomUUID(),'full');setAiUsed(budget.current.counts.reduce((a,b)=>a+b,0));}catch{setAiAllowed(false);}}
    if(!resume){setState(createRun(mode));setChats({});setDrafts({});positions.current={};budget.current=restoreBudget(null,crypto.randomUUID(),mode);persistBudget();}
    setStarted(true);setApp('home');setThread('current');setBrowserPage('start');setPaused(false);
  }
  function persistBudget(){setAiUsed(budget.current.counts.reduce((a,b)=>a+b,0));try{localStorage.setItem(budgetKey(budget.current.mode),JSON.stringify(budget.current));}catch{/* no chat or identity beyond random quota token */}}
  async function send(text:string){
    if(progressLocked||sending||gate.current.pending||state.blocked.includes(state.chapter)||chat.filter(m=>m.role==='user').length>=24)return;
    const clean=sanitizePlayerText(text);if(!clean)return;
    const chapter=state.chapter,id=c.id,stageId=state.stage;
    const messages:AiChatMessage[]=[];
    for(const message of [...chat.map(({role,content})=>({role,content})),{role:'user' as const,content:clean}]){
      if(messages.at(-1)?.role===message.role)messages[messages.length-1]=message;else messages.push(message);
    }
    const fallback=buildFallbackReply(activeCase,clean,messages),scripted=getScriptedReply(activeCase,messages);
    setDrafts(old=>({...old,[id]:''}));setChats(old=>({...old,[id]:[...(old[id]??[]),{role:'user',content:clean,stage:stageId}]}));setSending(true);
    try{
      await gate.current.run(async(signal:AbortSignal)=>{
        let reply=scripted??fallback;
        const canGenerate=scripted===null&&aiAllowed&&!practiceOriginal&&Date.now()>=budget.current.cooldown&&Date.now()-budget.current.last>=12000&&budget.current.counts[chapter]<c.story.aiLimit&&budget.current.counts.reduce((a,b)=>a+b,0)<4;
        if(canGenerate){
          budget.current.counts[chapter]++;budget.current.last=Date.now();persistBudget();
          const providerController=new AbortController();
          const abort=()=>providerController.abort();signal.addEventListener('abort',abort,{once:true});
          const timeout=setTimeout(abort,10000);
          try{
            const response=await fetch('/api/ai-chat',{method:'POST',headers:{'Content-Type':'application/json','x-whatfraud-session':budget.current.session},signal:providerController.signal,
              body:JSON.stringify({caseId:id,messages:messages.slice(-4),userTurnCount:chat.filter(m=>m.role==='user').length+1})});
            const result=await response.json() as {reply?:unknown;provider?:string};
            if(response.ok&&typeof result.reply==='string'&&validateAiReply(result.reply)){reply=result.reply;setModelStatus(result.provider==='gemini'?'AI 보조 응답 사용':'내장 대사 사용');}
            else {budget.current.cooldown=Date.now()+60000;persistBudget();setModelStatus('내장 대사로 계속 진행');}
          }catch{if(!signal.aborted){budget.current.cooldown=Date.now()+60000;persistBudget();setModelStatus('연결 없이 계속 진행');}}
          finally{clearTimeout(timeout);signal.removeEventListener('abort',abort);}
        }
        // Bounded typing pause for local lines, abortable on app/scene changes.
        if(!signal.aborted)await new Promise<void>(resolve=>{const timer=setTimeout(resolve,reduced?0:550);signal.addEventListener('abort',()=>{clearTimeout(timer);resolve();},{once:true});});
        return reply;
      },(reply:string)=>{
        if(stateRef.current.chapter!==chapter||stateRef.current.stage!==stageId||isResolved(stateRef.current))return;
        setChats(old=>({...old,[id]:[...(old[id]??[]),{role:'assistant',content:reply,stage:stageId}]}));
      });
    }finally{setSending(Boolean(gate.current.pending));}
  }
  function action(type:string){
    if(type==='transfer'){const offer=offerFor(state);if(offer){cancelReply();setPendingOffer(offer);setDialog('transfer');}return;}
    if(type==='help'){openApp('browser');setBrowserPage('official');return;}
    if(type==='platform'){act('platform');openApp('browser');setBrowserPage('platform');return;}
    if(type==='stop'){act('resolve','stopped');return;}
    if(type==='finish'){act('resolve','loss');return;}
    act(type);
  }
  function inspect(uid:string){act('inspect',uid);}
  function evidenceCards(target:App){
    return ownEvidence.filter(e=>e.app===target).map(e=><article className="record" key={e.uid}><h3>{e.title}</h3>
      {state.inspected.includes(e.uid)?<><p>{e.text}</p><button disabled={state.saved.includes(e.uid)} onClick={()=>act('save',e.uid)}>{state.saved.includes(e.uid)?'메모에 보관됨':'메모에 보관'}</button></>:<button onClick={()=>inspect(e.uid)}>내용 확인하기</button>}</article>);
  }
  function next(){
    if(practiceOriginal){setPracticeDone(true);return;}
    act('next');openApp('home');setBrowserPage('start');
  }
  function rewind(index:number){
    const original=practiceOriginal??state,value=replayBefore(original,index);if(!value)return;
    cancelReply();setPracticeOriginal(original);setPracticeDone(false);setState(value);setChats({});setDrafts({});setApp('messages');setThread('current');setBrowserPage('start');setPaused(false);
  }
  function exitPractice(){if(practiceOriginal){cancelReply();setState(practiceOriginal);setPracticeOriginal(null);setPracticeDone(false);setApp('home');}}
  const intro=<div className="intro"><span className="eyebrow">인터랙티브 스마트폰 스릴러</span><h1>수익률<br/><em>24시</em><span>.</span></h1><p className="intro-lead">평범한 연락으로 시작된 하루.<br/>당신은 어디에서 멈추겠습니까?</p>
    <div className="intro-card"><span>09:10 · 새 메시지</span><p>준호<br/><b>나야. 오늘 약속 기억하지?</b></p></div>
    {hasSave&&<button className="primary" disabled={!ready} onClick={()=>start(state.mode==='demo'?'demo':'full',true)}>저장된 하루 이어하기</button>}
    <button className={hasSave?'':'primary'} disabled={!ready} onClick={()=>hasSave?setDialog('restart'):start('full')}>새로운 하루 시작</button>
    <button disabled={!ready} onClick={()=>start('demo')}>투자방부터 짧게 체험</button>
    <p className="fine">모든 인물·거래·연락은 허구입니다. 실제 송금·전화·외부 링크는 없습니다. 피해 상황과 압박성 연락이 등장하며 언제든 일시정지할 수 있습니다.</p>
    <p className="fine">진행만 이 기기에 저장됩니다. 자유 대화는 저장하지 않습니다. AI 없이 모든 경로를 체험할 수 있습니다.</p></div>;
  const homeContent=<div className="phone-home"><div className="home-clock"><span>오늘, 나의 하루</span><strong>{gameTime(state)}</strong><p>{state.chapter===0?'저녁 약속이 있는 날':state.chapter===1?'익숙한 화면, 낯선 숫자':'아직 남아 있는 연락'}</p></div>
      <button className="notification" onClick={()=>openApp('messages')}><span>메시지 · {unread?'새 연락':'최근 연락'}</span><strong>{c.sender}</strong><p>{stage.messages[0].text}</p></button>
      {state.cues.includes(c.id+':routine')&&<button className="notification quiet" onClick={()=>openApp('messages','junho')}><span>준호 · 기존 연락처</span><p>{state.chapter===0?'저녁 일곱 시에 보자.':state.chapter===1?'나 퇴근하고 연락할게.':'오늘 고마웠어. 집에 잘 들어갔어?'}</p></button>}
      <div className="app-grid">{appList.map(a=><button key={a} onClick={()=>openApp(a)}><AppIcon name={a}/><span>{names[a]}</span>{a==='messages'&&unread&&<i className="unread-dot" aria-label="읽지 않은 연락"/>}</button>)}</div>
      <p className="home-tip">메시지에 답하거나, 다른 앱에서 확인해 보세요.</p></div>;
  const messagesContent=
thread==='list'?<><h2>대화</h2><button className="notification" onClick={()=>setThread('current')}><strong>{c.sender}</strong><p>{c.preview}</p></button><button className="notification quiet" onClick={()=>setThread('junho')}><strong>준호 · 기존 연락처</strong><p>오늘 저녁 약속</p></button>{state.results.filter((r:{chapter:number})=>r.chapter<state.chapter).map((r:{chapter:number;kind:string;spent:number})=><article className="record" key={r.chapter}><h3>{chapters[r.chapter].story.title}</h3><p>이전 연락은 정리되었습니다. 가상 출금 {money(r.spent)}</p><button onClick={()=>openApp('notes')}>보관한 기록 보기</button></article>)}</>:thread!=='current'?<><button onClick={()=>setThread('current')}>← 새 연락으로</button><h2>준호 · 저장된 연락처</h2><div className="bubble"><small>어제</small><p>내일 저녁 일곱 시, 역 앞에서 보자. 늦으면 원래 번호로 전화해.</p></div><div className="bubble"><p>{state.chapter===2?'오늘 고마웠어. 집에 잘 들어갔어?':'퇴근하고 연락할게.'}</p></div><button onClick={()=>openApp('calls')}>저장된 번호로 통화</button></>:<><button className="chat-back" onClick={()=>setThread('list')}>‹ 대화 목록</button><div className="chat-profile"><span className="avatar">{c.sender.slice(0,1)}</span><div><h2>{c.sender}</h2><small>{state.chapter===0?'새 계정 · 친구 미등록':state.chapter===1?'시장 노트 · 자료방':'새 상담 계정'}</small></div></div>
      <p className="scene-intro">{c.story.intro}{state.chapter===2&&<><br/>{recoveryContext(state)}</>}</p>
      {state.visited.map((id:string)=><section className="chat-stage" key={id}>{c.story.stages.find(s=>s.id===id)?.messages.map((m,i)=><div className={m.speaker==='알림'?'system-message':'bubble'} key={id+i}>{m.speaker!=='알림'&&<small>{m.speaker}</small>}<p>{m.text}</p></div>)}
        {chat.filter(m=>m.stage===id).map((m,i)=><div className={'bubble '+(m.role==='user'?'mine':'')} key={'chat'+i}><small>{m.role==='user'?'나':c.sender}</small><p>{m.content}</p></div>)}</section>)}
      {sending&&<p className="typing" role="status">상대가 입력 중…</p>}
      {!resolved&&<><div className="story-actions">{stage.actions.map(a=><button className={a.type==='advance'?'primary':''} key={a.type} onClick={()=>action(a.type)}>{a.label}</button>)}</div>
        <details className="conversation-tools"><summary>직접 물어보기</summary><div className="quick-questions">{activeCase.dialogue?.quickQuestions.map(q=><button key={q} disabled={sending||progressLocked} onClick={()=>send(q)}>{q}</button>)}</div>
          <form onSubmit={e=>{e.preventDefault();void send(draft);}} className="composer"><label className="sr-only" htmlFor="message-draft">상대에게 보낼 질문</label><textarea id="message-draft" maxLength={500} rows={2} value={draft} onChange={e=>setDrafts(old=>({...old,[c.id]:e.target.value}))} placeholder="내 개인정보를 쓰지 말고 물어보세요"/><button disabled={sending||!draft.trim()||chat.filter(m=>m.role==='user').length>=24} type="submit">보내기</button></form><small>직접 입력은 선택 사항입니다. 행동은 아래 연락 정리와 다른 앱에서 선택합니다.</small></details>
        <details className="conversation-tools"><summary>연락 정리</summary><div className="safe-actions"><button onClick={()=>act('resolve','paused')}>일단 보류하기</button><button onClick={()=>act('resolve','blocked')}>이 계정 차단하기</button><button disabled={!verified(state)} onClick={()=>act('resolve','verified')}>확인한 내용으로 요청 종료</button></div><p className="fine">확인 후 종료하려면 독립된 기록을 살펴보세요. 보류·차단에는 확인 조건이 없습니다.</p></details></>}
      {evidenceCards('messages')}
      {resolved&&<div className="resolution"><p>{outcomeText(state)}</p><button className="primary" onClick={next}>{practiceOriginal?'바뀐 선택 확인':state.chapter===2?'오늘의 기록 보기':'하루 이어가기 →'}</button></div>}</>;
  const callsContent=<><span className="eyebrow">연락처 · 가상 통화</span><h2>내가 저장한 사람</h2><article className="record"><h3>준호 <small>기존 연락처</small></h3><button onClick={()=>act('call','junho')}>저장된 준호에게 전화</button>{state.calls.includes(state.chapter+':junho')&&<p>{state.chapter===0?'준호: 오늘 약속은 맞는데, 결제 부탁은 안 했어. 새 계정도 내 것이 아니야.':'준호: 나는 그 서비스에 관해 아는 게 없어. 내 이름이 보여도 먼저 여기로 물어봐.'}</p>}</article>
      <article className="record"><h3>{c.sender} <small>현재 대화의 계정</small></h3><button disabled={resolved||state.blocked.includes(state.chapter)} onClick={()=>act('call','current')}>현재 계정으로 통화 시도</button>{state.calls.includes(state.chapter+':current')&&<p>통화 연결이 되지 않습니다. 이 계정의 신원을 확인하지 못했습니다.</p>}</article>
      {state.chapter===2&&<button onClick={()=>act('call','contact')}>상담 연락처 대조하기</button>}
      {evidenceCards('calls')}<p className="fine">버튼은 게임 내 통화 장면만 재생합니다. 실제 전화번호로 연결되지 않습니다.</p></>;
  const browserContent=<><div className="address">⌑ {browserPage==='platform'?'on-gyeol.invalid / account':'내가 직접 연 브라우저'}<span>가상</span></div>
      <nav className="browser-tabs"><button onClick={()=>setBrowserPage('start')}>시작</button><button onClick={()=>setBrowserPage('official')}>공식 경로</button>{state.chapter===1&&<button onClick={()=>setBrowserPage('platform')}>투자 화면</button>}</nav>
      {browserPage==='platform'&&state.chapter===1?<><div className="platform"><span>온결 · 이용 화면</span><h2>{chapterSpent(state)>0?'+18.4%':'오늘의 기록'}</h2><p>{chapterSpent(state)>0?'화면상 평가 금액 355,200원':'참여자의 일부 이용 화면이 게시되어 있다.'}</p><small>플랫폼 표시값 · 은행 입금과 별개</small></div>{state.stage==='paid'&&<button onClick={()=>{act('withdraw');openApp('messages');}}>출금 요청</button>}{['withdrawal','extra-paid'].includes(state.stage)&&<p className="system-message">출금 보류 · 담당자 확인 중</p>}<button onClick={()=>openApp('bank')}>은행 거래 내역 열기</button><button onClick={()=>openApp('messages')}>자료방으로</button></>:<><h2>{browserPage==='official'?'직접 확인하는 경로':'내가 찾은 정보'}</h2><p className="muted">연락에 첨부된 화면과, 직접 찾아본 기록은 다를 수 있습니다.</p></>}
      {evidenceCards('browser')}
      {state.chapter===0&&<article className="record"><h3>지인 연락 확인</h3><p>새 대화에 적힌 연락처가 아닌, 이전부터 저장한 연락처에서 먼저 확인할 수 있습니다.</p><button onClick={()=>openApp('calls')}>내 연락처 열기</button></article>}
      {state.chapter===2&&<article className="record"><h3>공식 접수 · 게임 내 재현</h3><p>메모에 현재 연락의 기록을 보관한 뒤 접수할 수 있습니다. 돈은 자동 환급되지 않습니다.</p><button disabled={resolved||!ownEvidence.some(e=>state.saved.includes(e.uid))} onClick={()=>{act('resolve','reported');openApp('messages');}}>보관한 자료로 접수</button><button onClick={()=>openApp('notes')}>보관한 기록 보기</button></article>}</>;
  async function checkModel(){if(checking)return;setChecking(true);try{const response=await fetch('/api/ai-chat');const value=await response.json() as {enabled?:boolean};setModelStatus(response.ok&&value.enabled?'서버 연결됨 · 생성 호출 없음':'내장 대사 사용 가능');}catch{setModelStatus('연결 불가 · 내장 대사 사용 가능');}finally{setChecking(false);}}
  const content=app==='home'?homeContent:app==='messages'?messagesContent:app==='calls'?callsContent:app==='bank'?<><Ledger state={state}/>{evidenceCards('bank')}{offerFor(state)&&<button className="primary" onClick={()=>action('transfer')}>현재 요청의 송금 안내</button>}</>:app==='browser'?browserContent:app==='notes'?<><h2>내가 보관한 기록</h2><p className="muted">앱에서 내용을 확인하고 ‘메모에 보관’을 누르면 모입니다.</p>{evidenceFor(state).filter(e=>state.saved.includes(e.uid)).map(e=><article className="record" key={e.uid}><span className="eyebrow">{chapters[e.chapter].story.title}</span><h3>{e.title}</h3><small>{names[e.app as App]} · {gameTime(replayBefore(state,state.events.findIndex((event:{type:string;data:string})=>event.type==='save'&&event.data===e.uid))!)}</small><p>{e.text}</p></article>)}{!state.saved.length&&<p>아직 보관한 기록이 없습니다.</p>}<button onClick={()=>openApp('messages')}>최근 연락으로 돌아가기</button></>:<><h2>잠깐 쉬어가기</h2><article className="record"><h3>지금 할 수 있는 일</h3><p>메시지에서 대화를 더 읽거나, 다른 앱에서 기록을 살펴볼 수 있습니다. 진행하지 않으려면 ‘연락 정리’에서 보류·차단을 선택하세요.</p><button onClick={()=>openApp('messages')}>현재 연락으로</button></article><label className="setting"><input type="checkbox" checked={large} onChange={e=>setLarge(e.target.checked)}/>글자 크게</label><label className="setting"><input type="checkbox" checked={reduced} onChange={e=>setReduced(e.target.checked)}/>움직임 줄이기</label><label className="setting"><input type="checkbox" checked={aiAllowed} onChange={e=>{cancelReply();setAiAllowed(e.target.checked);}}/>만 18세 이상이며, 선택적 AI 대화 사용</label><p className="fine">켜면 일부 자유 질문의 최근 대화가 Gemini로 전송됩니다. 개인정보를 입력하지 마세요. 사건 진행과 거래값은 코드로 결정됩니다. AI 대사의 오류 가능성은 남아 있으므로 실제 금융 안내로 사용하지 마세요. 내장 대사만으로도 끝까지 진행됩니다.</p><button disabled={checking} onClick={()=>void checkModel()}>{checking?'연결 확인 중':'연결 상태만 확인'}</button><p role="status">{modelStatus}</p><p className="fine">이번 실행의 AI 시도 {aiUsed} / 4. 장면별 최대 1·2·1회, 12초 간격. 재시도는 하지 않습니다.</p><button onClick={()=>setDialog('restart')}>새 하루로 초기화</button><p className="fine">이 기기의 진행 기록을 바꿉니다. 입력 대화는 원래 저장하지 않습니다.</p></>;
  return <main className={'story-world '+c.story.tone+(large?' large-text':'')+(reduced?' reduce-motion':'')}><div className="desktop-caption"><span>WHATFRAUD</span><p>낯선 위험은<br/>익숙한 화면으로 온다.</p><small>하나의 휴대폰, 세 번의 선택.<br/>소리 없이도 모든 내용을 볼 수 있습니다.</small></div><section className={'phone '+(app==='home'&&started?' wallpaper':'')} aria-label="가상 휴대폰">
    <div className="statusbar"><b>{started?gameTime(state):'09:10'}</b><span>가상 통신 ▰</span></div>
    {!started?<div className="screen-scroll">{intro}</div>:state.completed&&!practiceOriginal?<div className="screen-scroll"><Rewind state={state} onReplay={rewind} onRestart={()=>{setHasSave(Boolean(mainSaved.current));setStarted(false);}}/></div>:<>
      <header className="app-header"><button onClick={()=>openApp('home')} aria-label="홈으로">‹</button><strong>{names[app]}</strong><button onClick={()=>{cancelReply();setPaused(true);}} aria-label="일시정지">Ⅱ</button><button onClick={()=>openApp('settings')} aria-label="설정">⚙</button></header>
      {practiceOriginal&&<div className="practice-bar"><span>되감기 · 원본 기록 보존</span><button onClick={exitPractice}>원래 기록으로</button></div>}
      {unread&&app!=='home'&&app!=='messages'&&<button className="notification compact" onClick={()=>openApp('messages')}>메시지 · {c.sender}의 새 연락</button>}
      <div className={'screen-scroll app-'+app} ref={scroll}>{content}</div>
      <nav className="system-nav" aria-label="휴대폰 탐색"><button onClick={()=>openApp('messages')}>연락</button><button onClick={()=>openApp('home')} aria-label="홈">○</button><button onClick={()=>{cancelReply();setShowRecent(!showRecent);}}>최근 앱</button></nav>

    </>}
    {note&&<div className="notice" role="status"><p>{note}</p><button onClick={()=>setNote('')} aria-label="안내 닫기">×</button></div>}
    <dialog ref={dialogRef} onCancel={()=>{setDialog(null);setPaused(false);setShowRecent(false);if(practiceDone)exitPractice();}} onClose={()=>{setDialog(null);setPaused(false);setShowRecent(false);}} aria-label="휴대폰 선택 창">{paused?<><span className="eyebrow">잠시 멈춘 하루</span><h2>준비되면 이어가세요.</h2><p>멈춰 있는 동안 연락이 진행되거나 돈이 빠져나가지 않습니다.</p><button className="primary" onClick={()=>setPaused(false)}>계속하기</button><button onClick={()=>{setPaused(false);setStarted(false);setHasSave(Boolean(mainSaved.current));}}>처음 화면으로</button></>:showRecent?<><h2>최근 앱</h2>{recent.map(a=><button key={a} onClick={()=>openApp(a)}><AppIcon name={a} size="mini"/>{names[a]}</button>)}<button onClick={()=>setShowRecent(false)}>닫기</button></>:practiceDone?<><h2>이번에는 이렇게 멈췄습니다</h2><p>{outcomeText(state)}</p><p>이 연락의 가상 출금: {money(chapterSpent(state))}</p><p>원래 기록: {money(chapterSpent({...practiceOriginal!,chapter:state.chapter}))}</p><button className="primary" onClick={exitPractice}>원래 하루의 기록으로</button></>:dialog==='transfer'&&pendingOffer?<><span className="eyebrow">게임 내 송금 확인</span><h2 id="dialog-title">{money(pendingOffer.amount)}</h2><p>받는 이름 <b>{pendingOffer.recipient}</b></p><p>목적 {pendingOffer.purpose}</p><p className="fine">실제 돈은 이동하지 않습니다. 확인하면 이 하루의 잔액과 후속 이야기에 반영됩니다.</p><button className="primary" onClick={()=>{act('confirm',pendingOffer.id);setDialog(null);openApp('messages');}}>가상 송금 확인</button><button onClick={()=>setDialog(null)}>취소하고 더 확인</button></>:<><h2 id="dialog-title">새 하루를 시작할까요?</h2><p>이 기기의 기존 진행 기록을 새 기록으로 바꿉니다.</p><button className="primary" onClick={()=>{setDialog(null);start('full');}}>기존 기록 바꾸고 시작</button><button onClick={()=>setDialog(null)}>취소</button></>}</dialog>
  </section><div className="desktop-footer">수익률 24시 <span>가상 스마트폰 체험</span></div></main>;
}
