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
 const renderRecord=(record:Evidence)=> <><p>{record.text}</p>{['ledger','recovery-ledger'].includes(record.id)&&<><p>실제 게임 원장 · 수익/환급 입금 0원</p>{state.transactions.filter(t=>t.chapter===1||record.id==='recovery-ledger'&&t.chapter===2).map(t=><p key={t.id}>{t.recipient} · 출금 {money(t.amount)}</p>)}</>}</>;
 return <div className="evidence-detail">
  <small>{sourceLabels[e.sourceType as keyof typeof sourceLabels]}</small>
  {e.sourceType.startsWith('sender')&&<p className="fine">발신자 주장·공식 확인 전</p>}
  <dl><dt>출처</dt><dd>{e.provenance}</dd><dt>주장</dt><dd>{e.claimedFact}</dd><dt>확인 가능 정보</dt><dd>{e.content}</dd><dt>누락 정보</dt><dd>{e.missingInfo}</dd></dl>
  {!!e.redFlags?.length&&<details><summary>살펴볼 위험 신호</summary><ul>{e.redFlags.map(flag=><li key={flag}>{flag}</li>)}</ul></details>}
  {!!targets.length&&<details><summary>독립 기록과 비교하기</summary><div className="comparison-pair"><article><small>{sourceLabels[e.sourceType as keyof typeof sourceLabels]}</small><h3>{e.title}</h3>{renderRecord(e)}</article><article><small>독립 확인 기록</small>{targets.map(target=><section key={target.id}><h3>{target.title}</h3>{renderRecord(target)}</section>)}</article></div>{onRecord&&<button disabled={compared} onClick={()=>onRecord('evidence-compare',uid)}>{compared?'대조 기록 남김':'대조한 내용 기록하기'}</button>}</details>}
  {onRecord&&<button disabled={reported||!state.saved.includes(uid)} onClick={()=>onRecord('evidence-report',uid)}>{reported?'신고용 기록에 포함됨':'보관 후 신고용 기록에 포함'}</button>}
  <small>신고용 기록은 게임 안의 메모이며 실제 신고·환급 처리가 아닙니다.</small>
 </div>;
}
