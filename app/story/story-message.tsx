'use client';
import {useEffect,useRef,useState} from 'react';
import {sanitizePlayerText,validateAiReply} from '../ai-dialogue';
import {storyMessages,messageStatus,messageWindow,canAttach,attachmentText,reactions} from './one-shot';
type Run=ReturnType<typeof import('./engine').createRun>;
type Scene='peer'|'friend';
type Props={state:Run;scene:Scene;aiAllowed:boolean;session:string;remaining:number;practice:boolean;reduced:boolean;paused:boolean;onEvent:(type:string,data:string)=>boolean;onBack:()=>void;onContinue:()=>void;onProfile:()=>void};
export default function StoryMessage({state,scene,aiAllowed,session,remaining,practice,reduced,paused,onEvent,onBack,onContinue,onProfile}:Props){
 const person=storyMessages[scene],status=messageStatus(state,scene),available=messageWindow(state,scene);
 const [draft,setDraft]=useState(''),[sent,setSent]=useState(''),[reply,setReply]=useState(''),[attachment,setAttachment]=useState('none');
 const [busy,setBusy]=useState(false),[error,setError]=useState('');
 const controller=useRef<AbortController|null>(null),pending=useRef(false),mounted=useRef(true);
 useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;controller.current?.abort();};},[]);
 useEffect(()=>{if(paused)controller.current?.abort();},[paused]);
 useEffect(()=>{const hide=()=>{if(document.hidden)controller.current?.abort();};document.addEventListener('visibilitychange',hide);return()=>document.removeEventListener('visibilitychange',hide);},[]);
 const done=!['ready','attempt'].includes(status);
 const canGenerate=available&&status==='ready'&&aiAllowed&&!practice&&remaining>0;
 const recovered=status==='attempt'&&!busy;
 function prepared(){
  if(pending.current||!available||done)return;
  if(onEvent('message',scene+':'+person.reaction)){setSent(person.prepared);setReply(person.reply);setError('');}
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
  setSent(text);setDraft('');setError('');setBusy(true);
  const aborter=new AbortController();controller.current=aborter;
  const timer=setTimeout(()=>aborter.abort(),10000);
  try{
   const response=await fetch('/api/ai-chat',{method:'POST',headers:{'Content-Type':'application/json','x-whatfraud-session':session},signal:aborter.signal,body:JSON.stringify({caseId:'paper-profit',stageId:state.stage,sceneId:scene,resolved:state.results.some(r=>r.chapter===1),joined:state.joined,attachment:scene==='peer'?attachment:'none',inputMode:'story-message',messages:[{role:'user',content:text}],userTurnCount:1})});
   const value=await response.json();
   if(!response.ok||value.provider!=='gemini'||typeof value.reply!=='string'||!validateAiReply(value.reply)||!reactions[scene].includes(value.reaction)||/[?？]/.test(value.reply))throw Error('unavailable');
   if(!reduced)await new Promise<void>(resolve=>{const wait=setTimeout(resolve,600);aborter.signal.addEventListener('abort',()=>{clearTimeout(wait);resolve();},{once:true});});
   if(!mounted.current||aborter.signal.aborted)return;
   if(onEvent('message',scene+':'+value.reaction))setReply(value.reply);
  }catch{
   if(mounted.current)setError('AI 답장을 받지 못했습니다. 다시 요청하지 않습니다. 준비된 메시지를 보내거나 이 대화를 건너뛸 수 있습니다.');
  }finally{
   clearTimeout(timer);pending.current=false;
   if(mounted.current){setBusy(false);if(aborter.signal.aborted)setError('전송이 중단되었습니다. 재요청 없이 준비된 메시지로 이어갈 수 있습니다.');}
  }
 }
 const followed=state.events.some(e=>e.type==='message-followup'&&e.data===(scene==='peer'?'peer:record':'friend:call'));
 return <section className="story-message-thread">
  <button className="chat-back" onClick={onBack}>‹ 대화 목록</button>
  <button className="profile-entry chat-profile" onClick={onProfile} aria-label={person.name+' 프로필 열기'}><span className="avatar">{person.initial}</span><span><b>{person.name}</b><small>{scene==='peer'?'온결 자료방 참여자':'저장된 연락처'}</small></span></button>
  <p className="system-message">{person.title}</p>
  <div className="bubble"><small>{person.name}</small><p>{person.opening}</p></div>
  {sent&&<div className="bubble mine"><p>{sent}</p>{attachment!=='none'&&<small>첨부 · {attachmentText[attachment]}</small>}</div>}
  {busy&&<p className="typing" role="status">{person.name} 입력 중 …</p>}
  {reply&&<div className="bubble"><small>{person.name}</small><p>{reply}</p></div>}
  {done&&!reply&&status!=='skip'&&<p className="system-message">이 대화는 마쳤습니다. 개인정보 보호를 위해 입력과 AI 답장 원문은 저장하지 않습니다.</p>}
  {(error||recovered)&&<p className="message-error" role="status">{error||'이 장면의 요청 기록이 있습니다. 다시 호출하지 않고 이어갑니다.'}</p>}
  {!available&&<p className="system-message">이 대화는 해당 사건의 마지막에 열립니다.</p>}
  {available&&!done&&!busy&&<>
   {canGenerate?<form className="story-message-composer" onSubmit={send}>
    {scene==='peer'&&<label className="attachment-picker">기록 첨부<select value={attachment} onChange={e=>setAttachment(e.target.value)}>{Object.keys(attachmentText).filter(id=>canAttach(state,id)).map(id=><option key={id} value={id}>{id==='none'?'첨부 안 함':id==='first-notice'?'처음 참여 안내':'보관한 지수의 질문'}</option>)}</select></label>}
    <label htmlFor="story-message-draft">자유답변(개인정보는 입력하지 마세요)</label>
    <textarea id="story-message-draft" rows={3} maxLength={500} value={draft} onChange={e=>setDraft(e.target.value)} placeholder={scene==='peer'?'지수에게 전하고 싶은 말':'준호에게 지금 하고 싶은 말'}/>
    <button className="primary" disabled={!draft.trim()} type="submit">보내기</button><small>보내면 한 번의 답장으로 이 장면이 이어집니다.</small>
   </form>:<p className="fine">{practice?'되감기에서는 준비된 메시지를 사용합니다.':!aiAllowed?'AI를 사용하지 않는 플레이입니다.':'이 장면에서 AI를 추가로 요청하지 않습니다.'}</p>}
   <details className="prepared-message"><summary>준비된 메시지로 보내기</summary><p>{person.prepared}</p><button onClick={prepared}>이 메시지 보내기</button></details>
   <button className="text-button" onClick={()=>{if(onEvent('message',scene+':skip'))onContinue();}}>지금은 말하지 않기</button>
  </>}
  {done&&<>
   {scene==='peer'&&status==='check'&&<article className="message-consequence"><p>지수는 입금을 미루고 안내를 다시 확인하러 갔다.</p>{!followed?<button onClick={()=>onEvent('message-followup','peer:record')}>지수가 남긴 기록 보기</button>:<><p>지수: 처음 안내와 나중 안내를 따로 보관해 뒀어요. 저도 확인하고 나서 결정할게요.</p><small>이 연락이 메모에 남았습니다. 이후 거래 결과는 아직 알 수 없습니다.</small></>}</article>}
   {scene==='peer'&&status==='acknowledge'&&<p className="system-message">메시지를 남겼다. 지수의 다음 결정은 아직 알 수 없다.</p>}
   {scene==='peer'&&status==='boundary'&&<p className="system-message">이 대화는 여기서 마쳤다. 더 설명하지 않아도 된다.</p>}
   {scene==='friend'&&status==='together'&&<article className="incoming-call"><span>준호 · 기존 연락처</span><h3>{followed?'통화 종료':'음성 통화'}</h3>{!followed?<button className="primary" onClick={()=>onEvent('message-followup','friend:call')}>받기</button>:<p>준호: 화면에 나온 말과 실제 기록은 따로 보자. 또 돈을 보내라는 연락이 오면 혼자 바로 결정하지 말고 같이 확인하자.</p>}<small>게임 내 통화 · 실제 전화 연결 없음</small></article>}
   {scene==='friend'&&status==='space'&&<p className="system-message">준호는 더 묻지 않았다. 저녁 약속은 그대로다.</p>}
   {status==='skip'&&<p className="system-message">지금 말하지 않기로 했다. 이 선택으로 불이익은 생기지 않는다.</p>}
   <button className="primary" onClick={onContinue}>{scene==='peer'?'내 연락으로 돌아가기':'저녁 약속으로 이어가기'}</button>
  </>}
 </section>;
}
