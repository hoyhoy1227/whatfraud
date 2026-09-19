import { chapters, money } from './engine.js';
import { findChoice } from './narrative.js';
import { attachmentLabel } from './one-shot.js';

export const reportSources = [
 {name:'경찰청 · 사이버범죄 신고 절차',url:'https://ecrm.police.go.kr/minwon/crs/quick/process'},
 {name:'저축은행중앙회 · 보이스피싱 예방·피해 대처',url:'https://www.fsb.or.kr/cosboyfpred_0100.act'}
];
const resolutions={verified:'기록 확인 후 요청 종료',paused:'결정 보류',blocked:'연락 차단',reported:'게임 내 자료 접수',stopped:'추가 송금 중단',loss:'송금 후 사건 종료'};
const intents={verify:'다른 경로로 확인하겠다는 의사',pause:'결정을 미루겠다는 의사',refuse:'연락을 거절하겠다는 의사',clarify:'설명의 이유·차이에 대한 질문',share:'상황 전달'};
const modes={records:'기록을 함께 확인하는 방향',verify:'연락의 진위를 확인하는 방향',listen:'이야기를 들어 달라는 방향',space:'대화할 시간을 두는 방향',compare:'첨부 자료를 비교하는 방향',distance:'자료 공개에 선을 긋는 방향',neutral:'상황을 전달하는 방향',cautious:'결정 전에 확인하는 방향'};
const reminders=[
 '이름·사진이 익숙해도 새 계정만 믿지 마세요. 상대가 보낸 번호가 아닌, 원래 저장한 연락처로 신원을 확인한 뒤 금전 요청을 판단하세요.',
 '수익 화면·단체방 후기만으로 거래를 판단하지 마세요. 독립된 공식 경로와 실제 계좌 내역을 대조하고, 구매 후 설명에 없던 비용을 계속 요구하면 추가 결제를 중단하세요.',
 '손실을 되찾아 준다는 연락에도 먼저 돈이나 개인정보를 보내지 마세요. 상대가 준 창구와 별개로 금융회사·경찰의 공식 경로에 직접 문의하세요.'
];

// Only recorded actions determine advice. Model intent is a hint, never proof of action.
// No new storage, model call, free-text interpretation, or personality diagnosis.
export function buildResponseReport(state){
 const cases=chapters.flatMap((chapter,index)=>{
  const events=state.events.filter(e=>e.chapter===index);
  const result=state.results.find(r=>r.chapter===index);
  if(!result)return [];
  const tx=state.transactions.filter(t=>t.chapter===index),spent=tx.reduce((sum,t)=>sum+t.amount,0);
  const firstPayment=events.findIndex(e=>e.type==='confirm');
  const cutoff=firstPayment<0?events.findIndex(e=>e.type==='resolve'):firstPayment;
  const before=cutoff<0?events:events.slice(0,cutoff);
  const keyIds=chapter.story.evidence.filter(e=>e.key).map(e=>chapter.id+':'+e.id);
  const hasKeyBefore=keyIds.length>0&&keyIds.every(id=>before.some(e=>e.type==='inspect'&&e.data===id));
  const checked=chapter.story.evidence.filter(e=>state.inspected.includes(chapter.id+':'+e.id));
  const saved=chapter.story.evidence.filter(e=>state.saved.includes(chapter.id+':'+e.id));
  const captured=events.some(e=>e.type==='capture'&&e.data==='paper-question');
  const strengths=[],cautions=[],dialogue=[];
  if(!spent)strengths.push('이 사건에서 송금하지 않아 금전 노출을 막았습니다.');
  if(hasKeyBefore)strengths.push('송금 또는 요청 종료 전에 이 사건의 핵심 기록을 모두 확인했습니다.');
  else if(checked.length)strengths.push('직접 기록을 열어 상대의 말과 대조할 단서를 확보했습니다.');
  if(saved.length||captured)strengths.push('자료를 메모에 보관했습니다. 이후 사실관계를 설명할 근거를 남긴 행동입니다.');
  if(result.kind==='stopped')strengths.push('이미 송금한 뒤에도 추가 요청을 중단했습니다. 더 큰 손실을 막는 의미 있는 선택입니다.');
  if(result.kind==='reported')strengths.push('보관한 자료로 게임 안의 접수 경로를 이용했습니다. 실제 기관에 신고된 것은 아닙니다.');
  if(result.kind==='blocked')strengths.push('해당 계정의 연락을 차단해 추가 접촉에 경계를 세웠습니다.');
  if(!hasKeyBefore)cautions.push(firstPayment>=0?'첫 송금 전에 핵심 기록을 모두 확인한 이력이 없습니다. 송금 이후 확인과 송금 전 확인은 위험을 줄이는 효과가 다릅니다.':'돈을 보내지 않은 것과 상대의 주장을 검증한 것은 다릅니다. 요청을 정리하기 전 핵심 기록을 모두 확인한 이력은 없습니다.');
  if(!saved.length&&!captured)cautions.push('자료를 별도로 보관한 이력이 없습니다. 실제 상황에서는 대화·계정·송금 내역 등 증거를 보존하되, 긴급 신고를 늦추지는 마세요.');
  if(spent)cautions.push('출금 '+money(spent)+'가 기록되어 있습니다. 상대의 추가 입금 요구를 중단하고 공식 경로로 피해 대응을 시작하는 것이 우선입니다.');
  for(const event of events){
   if(event.type==='decision-result'){
    const [,intent,attachment]=event.data.split(':');
    if(intents[intent])dialogue.push('자유 답변의 기록된 의도: '+intents[intent]+'.'+(attachmentLabel[attachment]&&attachment!=='none'?' 첨부: '+attachmentLabel[attachment]+'.':''));
    if(['verify','pause','refuse'].includes(intent)&&events.slice(events.indexOf(event)+1).some(e=>e.type==='confirm'))cautions.push('대화에서는 확인·보류·거절 의사를 전했지만, 그 뒤 실제 송금을 선택했습니다. 말로 정한 경계를 행동에서도 유지해 보세요.');
   }
   if(event.type==='message-style'){
    const [person,mode]=event.data.split(':');
    if(modes[mode])dialogue.push((person==='friend'?'준호':'지수')+'와의 대화는 '+modes[mode]+'으로 이어졌습니다. 이것만으로 실제 확인 완료를 뜻하지는 않습니다.');
   }
   if(event.type==='message-attachment'||event.type==='recovery-record'){
    const id=event.type==='recovery-record'?event.data:event.data.split(':')[1];
    if(attachmentLabel[id])dialogue.push('전달한 자료: '+attachmentLabel[id]+'. 자료 전달과 상대의 진위 확인은 별개입니다.');
   }
  }
  /** @type {string[]} */
  const choices=events.filter(e=>e.type==='talk').map(e=>findChoice(index,e.data)?.choice.label).filter(Boolean);
  return [{index,title:chapter.story.title,choice:resolutions[result.kind]??'기록된 사건 종료',spent,hasKeyBefore,checked:checked.map(e=>e.title),choices,dialogue:[...new Set(dialogue)],strengths:[...new Set(strengths)],cautions:[...new Set(cautions)],advice:reminders[index]}];
 });
 return {cases,protectedCases:cases.filter(c=>!c.spent).length,groundedCases:cases.filter(c=>!c.spent&&c.hasKeyBefore).length,spent:cases.reduce((sum,c)=>sum+c.spent,0)};
}
