'use client';
import {useEffect,useRef,useState} from 'react';
import {decisionWindows,decisionAvailable,decisionAttempted,decisionReactions} from './decision-message';
import {attachmentText,canAttach} from './one-shot';
import {chosenIds,decisionChecks} from './narrative';
import {sanitizePlayerText,validateAiReply} from '../ai-dialogue';
import {ChatBubbles} from './chat-bubbles';
import AttachmentPicker from './attachment-picker';
type Run=ReturnType<typeof import('./engine').createRun>;
export type DecisionMemory={draft:string;attachment:string;sent:string;reply:string;error:string;scripted:boolean};
export const emptyDecisionMemory=():DecisionMemory=>({draft:'',attachment:'none',sent:'',reply:'',error:'',scripted:false});
type Props={memory:DecisionMemory;onMemory:(patch:Partial<DecisionMemory>)=>void;state:Run;enabled:boolean;remaining:number;blocked:boolean;getSession:()=>string;onEvent:(type:string,data:string)=>boolean;onIncoming?:()=>void};
export default function DecisionComposer({memory,onMemory,state,enabled,remaining,blocked,getSession,onEvent,onIncoming}:Props){
 const window=decisionWindows.find(w=>w.chapter===state.chapter),available=decisionAvailable(state);
 const {draft,attachment,sent,reply,error,scripted}=memory;
 const setDraft=(draft:string)=>onMemory({draft}),setAttachment=(attachment:string)=>onMemory({attachment}),setSent=(sent:string)=>onMemory({sent}),setReply=(reply:string)=>onMemory({reply}),setError=(error:string)=>onMemory({error}),setScripted=(scripted:boolean)=>onMemory({scripted});
 const [busy,setBusy]=useState(false);
 const pending=useRef(false),controller=useRef<AbortController|null>(null),mounted=useRef(true);
 useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;controller.current?.abort();};},[]);
 useEffect(()=>{if(blocked||!enabled)controller.current?.abort();},[blocked,enabled]);
 const attempted=window&&decisionAttempted(state,window.id);
 async function send(event:React.FormEvent){
  event.preventDefault();if(!window||!available||attempted||pending.current||!enabled||remaining<=0||blocked||!canAttach(state,attachment))return;
  const text=sanitizePlayerText(draft);if(!text)return;
  pending.current=true;
  if(!onEvent('decision-attempt',window.id+':attempt')){pending.current=false;return;}
  setBusy(true);setSent(text);setDraft('');setError('');
  const aborter=new AbortController();controller.current=aborter;const timer=setTimeout(()=>aborter.abort(),12000);
  try{
   const checks=decisionChecks(state);if(state.events.some(e=>e.type==='capture'&&e.data==='paper-question'))checks.push('paper-question');
   const response=await fetch('/api/ai-chat',{method:'POST',headers:{'Content-Type':'application/json','x-whatfraud-session':getSession()},signal:aborter.signal,body:JSON.stringify({contractVersion:2,inputMode:'decision-message',caseId:window.caseId,sceneId:window.id,stageId:state.stage,resolved:false,joined:state.joined,attachment,choices:chosenIds(state),checks,messages:[{role:'user',content:text}],userTurnCount:1})});
   const value=await response.json() as {provider?:unknown;reply?:unknown;reaction?:unknown;fallbackReason?:unknown};
   const fallback=value.provider==='scripted'&&value.fallbackReason==='reply_quality';
   if(!response.ok||(value.provider!=='gemini'&&!fallback)||typeof value.reply!=='string'||typeof value.reaction!=='string'||!decisionReactions.includes(value.reaction)||!validateAiReply(value.reply,undefined,'normal','story')||/[?？]/.test(value.reply))throw Error('unavailable');
   if(!mounted.current||aborter.signal.aborted)return;
   if(onEvent('decision-result',window.id+':'+value.reaction+':'+attachment)){setReply(value.reply);setScripted(fallback);onIncoming?.();}
  }catch{if(mounted.current)setError('AI 답장을 받지 못했습니다. 다시 요청하지 않고 준비된 답장으로 계속할 수 있습니다.');}
  finally{clearTimeout(timer);pending.current=false;if(mounted.current){setBusy(false);if(aborter.signal.aborted)setError('전송이 중단됐습니다. 재요청 없이 준비된 답장으로 계속할 수 있습니다.');}}
 }
 if(!window||(!available&&!sent&&!reply))return null;
 return <section className="decision-message">
  {sent&&<ChatBubbles speaker="나" text={sent}>{attachment!=='none'&&<small>첨부 · {attachmentText[attachment as keyof typeof attachmentText]}</small>}</ChatBubbles>}
  {busy&&<p className="typing" role="status">{['준호 · 새 계정','온결 리서치','회복 지원 상담'][state.chapter]} 입력 중 …</p>}
  {reply&&<ChatBubbles speaker={['준호','온결 리서치','회복 지원 상담'][state.chapter]} text={reply}/>}
  {scripted&&<small className="fine">답변 품질 기준에 따라 준비된 대사로 이어졌습니다. 추가 AI 호출은 없습니다.</small>}
  {error&&<p className="message-error" role="status">{error}</p>}
  {attempted&&!busy&&!reply&&!error&&<p className="fine">이 확인 구간에서는 이미 AI를 사용했습니다. 원문은 저장하지 않으며 아래 선택으로 계속할 수 있습니다.</p>}
  {available&&!attempted&&<details className="prepared-message"><summary>직접 답장하기</summary>{enabled&&remaining>0?<form className="story-message-composer" onSubmit={send}>
   <AttachmentPicker value={attachment} onChange={setAttachment} options={window.attachments.filter(id=>canAttach(state,id))} disabled={blocked||busy}/>
   <label>자유답변(개인정보는 입력하지 마세요)<textarea value={draft} rows={3} maxLength={500} onChange={e=>setDraft(e.target.value)}/></label>
   <button className="primary" disabled={blocked||busy||!draft.trim()} type="submit">보내기</button><small>이 구간에서는 한 번만 답장을 받습니다. 송금·보류·차단은 직접 선택하세요.</small>
  </form>:<p className="fine">{!enabled?'AI 사용을 켠 경우에만 직접 답장할 수 있습니다.':'이번 회차의 AI 사용 한도를 모두 사용했습니다.'} 준비된 답장으로도 계속할 수 있습니다.</p>}</details>}
 </section>;
}
