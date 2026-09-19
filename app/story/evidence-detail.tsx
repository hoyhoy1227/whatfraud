import {sourceLabels} from './fraud-context';
import {chapters,money} from './engine';
type Run=ReturnType<typeof import('./engine').createRun>;
type Evidence={id:string;title:string;text:string;chapter?:number;sourceType?:string;provenance?:string;claimedFact?:string;content?:string;missingInfo?:string;redFlags?:string[];independentCheck?:string[]};
export default function EvidenceDetail({e,state,onRecord}:{e:Evidence;state:Run;onRecord?:(type:string,data:string)=>void}){
 if(!e.sourceType)return null;
 const chapter=e.chapter??state.chapter;
 const records=chapters[chapter].story.evidence;
 const targets=(e.independentCheck??[]).map(id=>records.find(record=>record.id===id)).filter(Boolean) as Evidence[];
 const uid=chapters[chapter].id+':'+e.id;
 const compared=state.events.some(event=>event.type==='evidence-compare'&&event.data===uid);
 const reported=state.events.some(event=>event.type==='evidence-report'&&event.data===uid);
 const renderRecord=(record:Evidence)=>{
  if(!['ledger','recovery-ledger'].includes(record.id))return <p className="evidence-summary">{record.text}</p>;
  const transactions=state.transactions.filter(t=>t.chapter===1||record.id==='recovery-ledger'&&t.chapter===2);
  return <section className="evidence-ledger" aria-label="관련 입출금 내역"><p className="evidence-summary">{record.text}</p><small>현재 거래 내역 · {record.id==='ledger'?'온결 관련':'온결·회복 상담 관련'}</small>{transactions.length?<ul>{transactions.map(t=><li key={t.id}><span><time>{t.time}</time> · {t.recipient}<small>{t.purpose}</small></span><strong>−{money(t.amount)}</strong></li>)}</ul>:<p>이 연락과 관련해 보낸 돈이 없습니다.</p>}<p className="ledger-deposit">{record.id==='ledger'?'수익금 입금':'수익금·환급금 입금'} <strong>0건</strong></p></section>;
 };
 return <div className="evidence-detail">
  <small>{sourceLabels[e.sourceType as keyof typeof sourceLabels]}</small>
  {renderRecord(e)}
  <details><summary>출처와 자세한 내용</summary><dl><dt>어디에서 봤나요?</dt><dd>{e.provenance}</dd><dt>{e.sourceType.startsWith('sender')?'상대방의 설명':'확인한 점'}</dt><dd>{e.claimedFact}</dd>{e.content!==e.text&&<><dt>기록 내용</dt><dd className="evidence-facts">{e.content}</dd></>}<dt>아직 확인하지 못한 점</dt><dd>{e.missingInfo}</dd></dl>{!!e.redFlags?.length&&<><p>눈여겨볼 부분</p><ul>{e.redFlags.map(flag=><li key={flag}>{flag}</li>)}</ul></>}</details>
  {!!targets.length&&<details><summary>다른 기록과 맞춰보기</summary><div className="comparison-pair"><article><small>지금 보는 기록</small><h3>{e.title}</h3><p>{e.claimedFact}</p></article><article><small>비교할 기록</small>{targets.map(target=><section key={target.id}><h3>{target.title}</h3>{renderRecord(target)}</section>)}</article></div>{onRecord&&<button disabled={compared} onClick={()=>onRecord('evidence-compare',uid)}>{compared?'비교한 내용 기록됨':'비교한 내용 기록하기'}</button>}</details>}
  {onRecord&&<button disabled={reported||!state.saved.includes(uid)} onClick={()=>onRecord('evidence-report',uid)}>{reported?'신고용 기록에 포함됨':'보관 후 신고용 기록에 포함'}</button>}
  {reported&&<small>신고할 때 참고할 기록으로 묶었습니다. 아직 신고를 접수한 것은 아닙니다.</small>}
 </div>;
}
