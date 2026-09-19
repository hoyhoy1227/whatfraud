'use client';
import {useEffect,useRef,useState} from 'react';
import {ChatBubbles} from './chat-bubbles';
import AttachmentPicker from './attachment-picker';
import {sanitizePlayerText,validateAiReply} from '../ai-dialogue';
import {storyMessages,messageStatus,messageWindow,canAttach,attachmentText,reactions,preparedMessages,peerFollowupText,friendFollowupLines,validBranch,messageStyle,canCloseMessage,attachmentReply,messageAttachment} from './one-shot';
import {currentCase} from './engine';
import {emptyMessageMemory,messageOpening,peerRecordReady,minimumReplyDelay} from './presentation';
export type MessageMemory=ReturnType<typeof emptyMessageMemory>;
type Run=ReturnType<typeof import('./engine').createRun>;
type Scene='peer'|'friend';
type Props={embedded?:boolean;memory?:MessageMemory;onMemory?:(patch:Partial<MessageMemory>)=>void;state:Run;scene:Scene;aiAllowed:boolean;getSession:()=>string;remaining:number;practice:boolean;reduced:boolean;paused:boolean;onEvent:(type:string,data:string)=>boolean;onBack:()=>void;onContinue:()=>void;onProfile:()=>void};
export default function StoryMessage({embedded=false,memory=emptyMessageMemory(),onMemory,state,scene,aiAllowed,getSession,remaining,practice,reduced,paused,onEvent,onBack,onContinue,onProfile}:Props){
 const person=storyMessages[scene],status=messageStatus(state,scene),available=messageWindow(state,scene);
 const {draft,sent,reply,attachment:memoryAttachment,sentAttachment,preparedSent}=memory;
 const attachment=messageAttachment(state,scene)!=='none'?messageAttachment(state,scene):memoryAttachment;
 const setDraft=(draft:string)=>onMemory?.({draft}),setSent=(sent:string)=>onMemory?.({sent}),setReply=(reply:string)=>onMemory?.({reply}),setAttachment=(attachment:string)=>onMemory?.({attachment});
 const [busy,setBusy]=useState(false),[error,setError]=useState('');
 const controller=useRef<AbortController|null>(null),pending=useRef(false),mounted=useRef(true);
 useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;controller.current?.abort();};},[state.chapter,scene]);
 useEffect(()=>{if(paused||!aiAllowed)controller.current?.abort();},[paused,aiAllowed]);
 useEffect(()=>{const hide=()=>{if(document.hidden)controller.current?.abort();};document.addEventListener('visibilitychange',hide);return()=>document.removeEventListener('visibilitychange',hide);},[]);
 const done=!['ready','attempt'].includes(status);
 const canGenerate=available&&!paused&&status==='ready'&&aiAllowed&&!practice&&remaining>0;
 const recovered=status==='attempt'&&!busy;
 function prepared(choice:typeof preparedMessages.peer[number]){
  if(pending.current||!available||done)return;
  const selectedAttachment=['space','distance'].includes(choice.mode)?'none':attachment;
  const focus=scene==='peer'&&choice.mode==='compare'?selectedAttachment:choice.mode==='records'?'records':choice.mode==='verify'?'contact':'none';
  if(!validBranch(scene,choice.reaction,choice.mode,focus)||!canAttach(state,scene==='peer'?focus:'none'))return;
  if(selectedAttachment!=='none'&&canAttach(state,selectedAttachment))onEvent('message-attachment',scene+':'+selectedAttachment);
  if(onEvent('message',scene+':'+choice.reaction)){
   onEvent('message-style',scene+':'+choice.mode+':'+focus);
   if(sent)onMemory?.({preparedSent:choice.text});else{onMemory?.({sentAttachment:selectedAttachment});setSent(choice.text);}
   setReply(selectedAttachment!=='none'&&!['space','listen','distance'].includes(choice.mode)?attachmentReply(scene,selectedAttachment):choice.reply);setError('');
  }
 }
 async function send(event:React.FormEvent){
  event.preventDefault();
  if(!canGenerate||pending.current)return;
  const text=sanitizePlayerText(draft);
  if(!text){setError('메시지를 입력해 주세요.');return;}
  if(!canAttach(state,attachment)){setError('첨부할 수 있는 기록을 다시 선택해 주세요.');return;}
  pending.current=true;
  // Persist attempt before dispatch: reload, abort and double submit cannot retry.
  if(!onEvent('message',scene+':attempt')){pending.current=false;return;}
  if(attachment!=='none')onEvent('message-attachment',scene+':'+attachment);
  onMemory?.({sentAttachment:attachment});setSent(text);setDraft('');setError('');setBusy(true);
  const aborter=new AbortController();controller.current=aborter;
  const dispatched=performance.now();
  const timer=setTimeout(()=>aborter.abort(),10000);
  try{
   const response=await fetch('/api/ai-chat',{method:'POST',headers:{'Content-Type':'application/json','x-whatfraud-session':getSession()},signal:aborter.signal,body:JSON.stringify({contractVersion:2,caseId:currentCase(state).id,stageId:state.stage,sceneId:scene,resolved:state.results.some(r=>r.chapter===state.chapter),joined:state.joined,attachment,inputMode:'story-message',messages:[{role:'user',content:text}],userTurnCount:1})});
   const value=await response.json() as {reply?:unknown;provider?:unknown;reaction?:unknown;supportMode?:unknown;focus?:unknown;fallbackReason?:unknown};
   const preparedFallback=value.provider==='scripted'&&value.fallbackReason==='reply_quality';
   if(!response.ok||(value.provider!=='gemini'&&!preparedFallback)||typeof value.reply!=='string'||!validateAiReply(value.reply,undefined,'normal','story')||typeof value.reaction!=='string'||!reactions[scene].includes(value.reaction)||/[?？]/.test(value.reply)||!validBranch(scene,value.reaction,value.supportMode,value.focus))throw Error('unavailable');
   if(!reduced)await new Promise<void>(resolve=>{const wait=setTimeout(resolve,minimumReplyDelay(performance.now()-dispatched,reduced));aborter.signal.addEventListener('abort',()=>{clearTimeout(wait);resolve();},{once:true});});
   if(!mounted.current||aborter.signal.aborted)return;
   if(onEvent('message',scene+':'+value.reaction)){onEvent('message-style',scene+':'+value.supportMode+':'+value.focus);setReply(value.reply);}
  }catch{
   if(mounted.current)setError('AI 답장을 받지 못했습니다. 다시 요청하지 않습니다. 준비된 메시지를 보내거나 이 대화를 건너뛸 수 있습니다.');
  }finally{
   clearTimeout(timer);pending.current=false;
   if(mounted.current){setBusy(false);if(aborter.signal.aborted)setError('전송이 중단되었습니다. 재요청 없이 준비된 메시지로 이어갈 수 있습니다.');}
  }
 }
 const supportCall=friendFollowupLines(state);
 function finish(){if(canCloseMessage(state,scene))onEvent('message-close',scene);onContinue();}
 const followed=state.events.some(e=>e.type==='message-followup'&&e.data===(scene==='peer'?'peer:record':'friend:call'));
 return <section className="story-message-thread">
  {!embedded&&<><button className="chat-back" onClick={onBack}>‹ 대화 목록</button>
  <button className="profile-entry chat-profile" onClick={onProfile} aria-label={person.name+' 프로필 열기'}><span className="avatar">{person.initial}</span><span><b>{person.name}</b><small>{scene==='peer'?'온결 자료방 참여자':'저장된 연락처'}</small></span></button></>}
  <p className="system-message">{state.chapter===2?'저녁 약속 전 메시지 · 이전 대화':person.title}</p>
  <ChatBubbles speaker={person.name} text={messageOpening(state,scene)}/>
  {sent&&<ChatBubbles speaker="나" text={sent}>{sentAttachment!=='none'&&<small>첨부 · {attachmentText[sentAttachment as keyof typeof attachmentText]}</small>}</ChatBubbles>}
  {preparedSent&&<ChatBubbles speaker="나" text={preparedSent}/>}
  {busy&&<p className="typing" role="status">{person.name} 입력 중 …</p>}
  {reply&&<ChatBubbles speaker={person.name} text={reply}/>}
  {done&&!reply&&status!=='skip'&&<p className="system-message">이 대화는 마쳤습니다. 개인정보 보호를 위해 입력과 AI 답장 원문은 저장하지 않습니다.</p>}
  {(error||recovered)&&<p className="message-error" role="status">{error||'이 장면의 요청 기록이 있습니다. 다시 호출하지 않고 이어갑니다.'}</p>}
  {!available&&!done&&<p className="system-message">이 대화는 해당 사건의 마지막에 열립니다.</p>}
  {available&&!done&&!busy&&<>
   {canGenerate?<form className="story-message-composer" onSubmit={send}>
    <AttachmentPicker value={attachment} onChange={setAttachment} options={Object.keys(attachmentText).filter(id=>canAttach(state,id))}/>
    <label htmlFor="story-message-draft">자유답변(개인정보는 입력하지 마세요)</label>
    <textarea id="story-message-draft" rows={3} maxLength={500} value={draft} onChange={e=>setDraft(e.target.value)} placeholder={scene==='peer'?'지수에게 전하고 싶은 말':'준호에게 지금 하고 싶은 말'}/>
    <button className="primary" disabled={!draft.trim()} type="submit">보내기</button><small>보내면 한 번의 답장으로 이 장면이 이어집니다.</small>
   </form>:<p className="fine">{practice?'되감기에서는 준비된 메시지를 사용합니다.':!aiAllowed?'AI를 사용하지 않는 플레이입니다.':'이 장면에서 AI를 추가로 요청하지 않습니다.'}</p>}
   <details className="prepared-message"><summary>준비된 메시지로 보내기</summary>{!canGenerate&&<AttachmentPicker value={attachment} onChange={setAttachment} options={Object.keys(attachmentText).filter(id=>canAttach(state,id))} disabled={status==='attempt'}/>}{preparedMessages[scene].filter(choice=>choice.mode!=='compare'||attachment!=='none').map(choice=><button key={choice.mode} onClick={()=>prepared(choice)}>{choice.text}</button>)}</details>
   <button className="text-button" onClick={()=>{if(onEvent('message',scene+':skip')){onEvent('message-close',scene);onContinue();}}}>지금은 말하지 않기</button>
  </>}
  {done&&<>
   {scene==='peer'&&status==='check'&&<article className="message-consequence"><p>지수는 자신의 안내를 확인해 보기로 했다.</p>{!followed?(peerRecordReady(state)?<button onClick={()=>onEvent('message-followup','peer:record')}>지수가 남긴 기록 보기</button>:<small>다른 기록을 살펴보는 동안 지수도 안내를 확인합니다.</small>):<><p>지수: {peerFollowupText(state)}</p><button disabled={state.events.some(e=>e.type==='message-followup'&&e.data==='peer:saved')} onClick={()=>onEvent('message-followup','peer:saved')}>{state.events.some(e=>e.type==='message-followup'&&e.data==='peer:saved')?'메모에 보관됨':'메모에 보관'}</button><small>이후 거래 결과는 아직 알 수 없습니다.</small></>}</article>}
   {scene==='peer'&&status==='acknowledge'&&<p className="system-message">메시지를 남겼다. 지수의 다음 결정은 아직 알 수 없다.</p>}
   {scene==='peer'&&status==='boundary'&&<p className="system-message">이 대화는 여기서 마쳤다. 더 설명하지 않아도 된다.</p>}
   {scene==='friend'&&status==='together'&&<article className="incoming-call"><span>준호 · {state.chapter===2?'귀갓길 연락':messageStyle(state,'friend').mode==='listen'?'저녁 약속':'기존 연락처'}</span><h3>{followed?'연락 요약 확인 완료':'준호가 남긴 연락'}</h3>{!followed?<><button className="primary" onClick={()=>{if(onEvent('message-followup','friend:call'))onMemory?.({callStep:1});}}>연락 내용 보기</button></>:<><div aria-live="polite">{supportCall.map(line=><p key={line}>{line}</p>)}</div></>}<small>이 사건에 관해 준호가 남긴 내용입니다.</small></article>}
   {scene==='friend'&&status==='space'&&<p className="system-message">준호는 더 묻지 않았다. 말할 때는 내가 정할 수 있다.</p>}
   {status==='skip'&&<p className="system-message">지금 말하지 않기로 했다. 이 선택으로 불이익은 생기지 않는다.</p>}
   <button className="primary" disabled={state.results.some(r=>r.chapter===state.chapter)&&!canCloseMessage(state,scene)&&!state.events.some(e=>e.type==='message-close'&&e.chapter===state.chapter&&e.data===scene)} onClick={finish}>{state.results.some(r=>r.chapter===state.chapter)?'이 사건 마무리하기':'내 연락으로 돌아가기'}</button>
  </>}
 </section>;
}
