import {messageChapter, messageWindow, messageStyle,peerOpening,messageStatus,peerFollowupText,friendFollowupLines} from './one-shot.js';
// Presentation-only helpers. No financial decisions or model calls.
/** @typedef {{id:string,speaker:string,text:string,attachment?:string}} ChatEntry */
/** @typedef {{draft:string,sent:string,reply:string,attachment:string,sentAttachment:string,preparedSent:string,transcript?:ChatEntry[],callStep:number}} MessageMemory */
/** @returns {MessageMemory} */
export const emptyMessageMemory=()=>({draft:'',sent:'',reply:'',attachment:'none',sentAttachment:'none',preparedSent:'',transcript:[],callStep:0});
/** Convert legacy slots to the best available chronological order. @param {MessageMemory} memory */
export function messageTranscript(memory=emptyMessageMemory(),counterpart='상대방'){
 if(Array.isArray(memory.transcript))return memory.transcript.filter(entry=>entry&&typeof entry.id==='string'&&typeof entry.speaker==='string'&&typeof entry.text==='string').map(entry=>({...entry,...(typeof entry.attachment==='string'&&entry.attachment!=='none'?{attachment:entry.attachment}:{})}));
 /** @type {ChatEntry[]} */
 const transcript=[];
 if(memory.sent)transcript.push({id:'legacy-sent',speaker:'나',text:memory.sent,...(memory.sentAttachment&&memory.sentAttachment!=='none'?{attachment:memory.sentAttachment}:{})});
 if(memory.reply)transcript.push({id:'legacy-reply',speaker:counterpart,text:memory.reply});
 if(memory.preparedSent)transcript.push({id:'legacy-prepared',speaker:'나',text:memory.preparedSent});
 return transcript;
}
/** @param {MessageMemory} memory @param {Array<Partial<ChatEntry>&Pick<ChatEntry,'speaker'|'text'>>} entries */
export function appendMessageTranscript(memory,entries,counterpart='상대방'){
 const current=messageTranscript(memory,counterpart),used=new Set(current.map(entry=>entry.id));
 return [...current,...entries.map((entry,index)=>{
  let sequence=current.length+index+1,id=entry.id;
  while(!id||used.has(id)){id='message-'+sequence;sequence++;}
  used.add(id);
  return {id,speaker:entry.speaker,text:entry.text,...(entry.attachment&&entry.attachment!=='none'?{attachment:entry.attachment}:{})};
 })];
}
/** Anchor AI text between authored lines without changing authored stage ordering.
 * @param {{stage?:string,after:number}} anchor
 */
export function historyAt(anchor,stage,after,lineCount){
 return anchor.stage===stage&&Math.min(anchor.after,lineCount)===after;
}
export function messageOpening(state,scene){
 if(scene==='peer')return peerOpening(state.chapter===1?state.stage:state.events.some(e=>e.chapter===1&&e.type==='withdraw')?'withdrawal':'group');
 if(state.calls.includes('0:junho'))return '아까 새 계정으로 확인했던 일이구나. 무슨 일이 있었는지 알려줘.';
 return '이제 잠깐 메시지 볼 수 있어. 아침에 무슨 일 있었어?';
}
export function peerRecordReady(state){
 if(state.version!==3&&state.chapter!==1)return false;
 if(state.chapter===1&&state.results.some(r=>r.chapter===1)&&messageStatus(state,'peer')==='check')return true;
 if(state.events.some(e=>e.type==='message-followup'&&e.data==='peer:record'))return true;
 const at=state.events.findIndex(e=>e.type==='message'&&e.data==='peer:check');
 return at>=0&&state.events.slice(at+1).some(e=>e.type==='resolve'&&e.chapter===1||e.type==='read'&&e.data==='bank'||e.type==='message-followup'&&e.data==='peer:checked-bank'||e.type==='next'&&e.chapter===1);
}
export function supportReady(state){
 return state.version===3&&state.chapter===2&&!state.completed&&messageStyle(state,'friend').mode==='verify'&&state.events.some(e=>e.type==='message-followup'&&e.data==='friend:call');
}
export function minimumReplyDelay(elapsed,reduced=false){return reduced?0:Math.max(0,700-elapsed);}
export const supportCall=[
 '아까 남긴 말 읽었어. 같이 볼 내용 남겨 둘게.',
 '화면에 나온 설명이랑 실제 거래 기록은 따로 보자. 지금 모든 걸 해결하려고 서두르지는 말고.',
 '다른 연락이 와도 바로 돈부터 보내지 말자. 필요하면 그 메시지만 나한테 보여 줘.',
 '이따 약속한 데서 보자. 먼저 도착하면 연락할게.'
];

export function messageThreadVisible(state,id){
 return state.chapter===messageChapter(id)&&(messageWindow(state,id)||state.events.some(e=>e.chapter===state.chapter&&e.type==='message'&&e.data.startsWith(id+':')));
}
export function resetMessageMemory(memory,mode){
 return Object.fromEntries(Object.entries(memory).filter(([key])=>!key.startsWith(mode+':')&&!key.startsWith('practice:')));
}
/** No drafts or attachments: only content that has actually entered the transcript. */
export function threadPreview(state,scene,memory=emptyMessageMemory()){
 const followed=state.events.some(e=>e.type==='message-followup'&&e.data===(scene==='peer'?'peer:record':'friend:call'));
 if(followed)return scene==='peer'?peerFollowupText(state):friendFollowupLines(state)[Math.max(0,memory.callStep-1)]??'준호가 연락 내용을 남겼어요.';
 const last=messageTranscript(memory,scene==='peer'?'지수':'준호').at(-1);
 if(last)return (last.speaker==='나'?'나: ':'')+last.text;
 const status=messageStatus(state,scene);
 if(!['ready','attempt'].includes(status))return status==='skip'?'지금은 말하지 않기로 했습니다.':'이 대화는 마쳤습니다.';
 return messageOpening(state,scene);
}
export function threadReceipt(state,scene,memory=emptyMessageMemory()){
 const status=messageStatus(state,scene);
 const followed=state.events.some(e=>e.type==='message-followup'&&e.data===(scene==='peer'?'peer:record':'friend:call'));
 return scene+':'+status+':'+(followed?'followup':'message')+':'+memory.callStep+':'+messageTranscript(memory,scene==='peer'?'지수':'준호').length;
}
