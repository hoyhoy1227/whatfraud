import {messageStyle,peerOpening,messageStatus,peerFollowupText,friendFollowupLines} from './one-shot.js';
// Presentation-only helpers. No financial decisions or model calls.
export const emptyMessageMemory=()=>({draft:'',sent:'',reply:'',attachment:'none',sentAttachment:'none',preparedSent:'',callStep:0});
export function messageOpening(state,scene){
 if(scene==='peer')return peerOpening(state.chapter===1?state.stage:state.events.some(e=>e.chapter===1&&e.type==='withdraw')?'withdrawal':'group');
 if(state.events.some(e=>e.type==='reflect'&&e.data==='tell'))return '아까 하려던 얘기, 지금 들어도 돼. 말하고 싶은 만큼만 남겨 줘.';
 if(state.calls.includes('0:junho'))return '나 이제 퇴근했어. 아까 그 계정 일은 좀 정리됐어? 지금 말하고 싶은 만큼만 얘기해 줘.';
 return '나 이제 퇴근했어. 약속대로 보면 되지? 오늘 무슨 일 있었으면 말하고 싶은 만큼만 남겨 줘.';
}
export function peerRecordReady(state){
 if(state.events.some(e=>e.type==='message-followup'&&e.data==='peer:record'))return true;
 const at=state.events.findIndex(e=>e.type==='message'&&e.data==='peer:check');
 return at>=0&&state.events.slice(at+1).some(e=>e.type==='resolve'&&e.chapter===1||e.type==='read'&&e.data==='bank'||e.type==='message-followup'&&e.data==='peer:checked-bank'||e.type==='next'&&e.chapter===1);
}
export function supportReady(state){
 return state.chapter===2&&!state.completed&&messageStyle(state,'friend').mode==='verify'&&state.events.some(e=>e.type==='message-followup'&&e.data==='friend:call');
}
export function minimumReplyDelay(elapsed,reduced=false){return reduced?0:Math.max(0,700-elapsed);}
export const supportCall=[
 '아까 남긴 말 읽었어. 같이 볼 내용 남겨 둘게.',
 '화면에 나온 설명이랑 실제 거래 기록은 따로 보자. 지금 모든 걸 해결하려고 서두르지는 말고.',
 '다른 연락이 와도 바로 돈부터 보내지 말자. 필요하면 그 메시지만 나한테 보여 줘.',
 '이따 약속한 데서 보자. 먼저 도착하면 연락할게.'
];

export function messageThreadVisible(state,id){
 return state.chapter===1||state.chapter===2&&state.events.some(e=>e.type==='message'&&e.data.startsWith(id+':'));
}
export function resetMessageMemory(memory,mode){
 return Object.fromEntries(Object.entries(memory).filter(([key])=>!key.startsWith(mode+':')&&!key.startsWith('practice:')));
}
/** No drafts or attachments: only content that has actually entered the transcript. */
export function threadPreview(state,scene,memory=emptyMessageMemory()){
 const followed=state.events.some(e=>e.type==='message-followup'&&e.data===(scene==='peer'?'peer:record':'friend:call'));
 if(followed)return scene==='peer'?peerFollowupText(state):friendFollowupLines(state)[Math.max(0,memory.callStep-1)]??'준호가 연락 내용을 남겼어요.';
 if(memory.reply)return memory.reply;
 if(memory.preparedSent||memory.sent)return '나: '+(memory.preparedSent||memory.sent);
 const status=messageStatus(state,scene);
 if(!['ready','attempt'].includes(status))return status==='skip'?'지금은 말하지 않기로 했습니다.':'이 대화는 마쳤습니다.';
 return messageOpening(state,scene);
}
export function threadReceipt(state,scene,memory=emptyMessageMemory()){
 const status=messageStatus(state,scene);
 const followed=state.events.some(e=>e.type==='message-followup'&&e.data===(scene==='peer'?'peer:record':'friend:call'));
 return scene+':'+status+':'+(followed?'followup':'message')+':'+memory.callStep;
}

/** A receipt only advances after a message has actually appeared on screen. */
export function currentThreadReceipt(stage,visibleCount,resolved,total){
 const delivered=resolved?total:Math.max(0,Math.min(visibleCount,total));
 return 'current:'+stage+':'+delivered;
}
