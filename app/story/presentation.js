// Presentation-only helpers. No financial decisions or model calls.
export const emptyMessageMemory=()=>({draft:'',sent:'',reply:'',attachment:'none',sentAttachment:'none',preparedSent:'',callStep:0});
export function messageOpening(state,scene){
 if(scene==='peer')return '아까부터 방 분위기가 좀 이상하네요. 저도 보내기 전에 확인하려고요. 보신 내용 있으면 남겨 주세요.';
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
 return state.chapter===2&&!state.completed&&state.events.some(e=>e.type==='message-followup'&&e.data==='friend:call');
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
