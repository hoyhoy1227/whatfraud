import {narratives} from './narrative.js';
import {messageStyle,messageStatus} from './one-shot.js';
import {chapterSpent,money,outcomeText,isResolved} from './engine.js';

// Authored context only. Reading these scenes never changes evidence, money or AI quota.
export function priorResult(state,chapter){
 const result=state.results.find(r=>r.chapter===chapter);
 if(!result)return '';
 const snapshot={...state,chapter};
 return chapterSpent(snapshot)>0?'은행'+'에는 '+money(chapterSpent(snapshot))+' 출금이 남아 있다. 돌아온 돈은 아직 없다.':outcomeText(snapshot);
}
export function dinnerContext(state){
 const mode=messageStyle(state,'friend').mode;
 if(messageStatus(state,'friend')==='space')return '준호와 저녁을 먹었다. 오늘 일은 더 묻지 않았고, 평소처럼 서로의 근황을 이야기했다.';
 if(mode==='listen'&&messageStatus(state,'friend')==='together')return '준호와 저녁을 먹었다. 조언보다 들어 달라는 말대로, 급히 답을 내리려 하지 않았다.';
 if(mode==='records'&&messageStatus(state,'friend')==='together')return '준호와 저녁을 먹었다. 기록을 같이 봐 달라는 메시지는 남겼지만, 그 부탁만으로 거래가 확인된 것은 아니다.';
 if(mode==='verify'&&messageStatus(state,'friend')==='together')return '준호와 저녁을 먹었다. 낯선 연락이 오면 함께 확인해 보자는 말이 남았다.';
 return '준호와 저녁을 먹고 역 앞에서 헤어졌다. 길게 이야기하지 못한 일은 휴대폰 속에 남겨 두었다.';
}
export function arrivalContext(state){
 if(state.chapter===0)return ['당신은 출근길에 지하철을 기다리고 있다.\n월급날까지 나흘. 생활 계좌의 68만 원으로 당분간의 생활비를 챙겨야 한다.','오늘 저녁에는 오랜 친구 준호와 약속이 있다.\n어제 정한 장소를 확인하려고 휴대폰을 연다.\n이제부터 연락을 읽고 답장하거나, 다른 앱에서 내용을 확인하며 하루를 진행한다.'];
 if(state.chapter===1)return ['점심을 먹고 자리로 돌아오는 길이다.\n며칠 전 투자에 대해 알아보다 신청한 무료 시장 노트가 도착했다.','월급까지 남은 나흘이 유난히 길게 느껴진다.\n점심값을 확인하다가, 투자 정보를 찾아보며 신청했던 시장 노트가 생각났다.\n책상에 앉자 자료방 초대와 먼저 들어온 사람들의 메시지가 차례로 뜬다.'];
 const loss=state.transactions.some(tx=>tx.chapter<2);
 return ['준호와 헤어진 뒤 역으로 걷는다. 처음 보는 상담 계정의 알림에 낮에 보았던 온결이라는 이름이 적혀 있다.',loss?'돌아오지 않은 돈과 답 없는 연락이 남아 있다. 이 계정이 내 거래를 알고 연락했는지는 아직 모른다.':state.joined?'자료방을 보았지만 돈을 보내지는 않았다. 이 계정이 왜 나에게 연락했는지 알 수 없다.':'거래에 참여한 적은 없다. 이 상담 계정과 연락하게 된 경로도 확인되지 않았다.'];
}
export function chapterPages(state){
 const arrival={time:narratives[state.chapter].place,title:['저녁 약속이 있는 날','신청해 둔 시장 노트','귀갓길에 도착한 연락'][state.chapter],lines:arrivalContext(state)};
 if(state.chapter===0||state.mode==='demo'&&state.chapter===1)return [arrival];
 return [{time:state.chapter===1?'오전의 연락을 닫고':'19:00 · 준호와의 저녁',title:state.chapter===1?'다시 일상으로':'약속은 그대로였다',lines:state.chapter===1?[priorResult(state,0),'출근해 오전 일을 마쳤다. 저녁 약속은 그대로 두고 점심을 먹으러 나왔다.']:[priorResult(state,1),dinnerContext(state)]},arrival];
}
export function resumeContext(state){
 if(state.completed)return ['오늘의 연락을 모두 정리했다.','남은 거래 기록과 선택을 다시 살펴볼 수 있다.'];
 const place=narratives[state.chapter].place;
 const status=isResolved(state)?outcomeText(state):({arrival:'새 연락을 살펴보던 중이다.',request:'대신 결제해 달라는 부탁을 받은 상태다.',waiting:'요청을 남겨 두고 확인하고 있다.',group:'자료방의 대화를 읽고 있다.',offer:'별도 안내를 받은 상태다. 결정은 아직 내 몫이다.',paid:'송금한 거래가 남아 있다. 이후 연락을 확인하고 있다.',withdrawal:'출금을 요청한 뒤 보안 확인 비용을 요구받은 상태다.','extra-paid':'추가 비용을 보냈지만 은행에 수익금은 들어오지 않았다.'}[state.stage]??'진행 중인 연락이 남아 있다.');
 const last=[...state.events].reverse().find(e=>['confirm','inspect','save','capture','resolve','talk','message'].includes(e.type));
 const lastLine=last?({confirm:'마지막으로 게임 안에서 송금했다.',inspect:'마지막으로 확인 자료를 열어 보았다.',save:'마지막으로 기록을 메모에 보관했다.',capture:'마지막으로 대화의 질문을 보관했다.',resolve:'마지막으로 연락에 대한 결정을 남겼다.',talk:'마지막으로 준비된 답장을 보냈다.',message:'마지막으로 메시지 장면을 진행했다.'}[last.type]):'아직 이 하루에 새 선택을 남기지 않았다.';
 return [place+' · '+status,lastLine];
}
export function chapterAction(state){return state.chapter===0?'준호와의 약속 대화 열기':state.chapter===1?'도착한 시장 노트 보기':'새 상담 연락 보기';}
