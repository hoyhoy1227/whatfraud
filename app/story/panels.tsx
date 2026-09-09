import { chapters, INITIAL_BALANCE, money, totalSpent, endingFor, timeline } from './engine';
type Run = ReturnType<typeof import('./engine').createRun>;
export function Ledger({state}:{state:Run}) {
  return <><div className="balance"><span>생활 계좌</span><strong>{money(INITIAL_BALANCE-totalSpent(state))}</strong><small>출금 가능 잔액</small></div>
    <h2>거래 내역</h2><div className="ledger-row"><span>시작 잔액</span><b>{money(INITIAL_BALANCE)}</b></div>
    {state.transactions.length===0?<p className="muted">오늘 출금된 거래가 없습니다.</p>:state.transactions.map((tx:{id:string;time:string;recipient:string;amount:number})=><div className="ledger-row" key={tx.id}><span>{tx.recipient}<small>{tx.time} · 출금</small></span><b className="negative">−{money(tx.amount)}</b></div>)}</>;
}
export function Rewind({state,onReplay,onRestart}:{state:Run;onReplay:(index:number)=>void;onRestart:()=>void}) {
  const ending=endingFor(state);
  const pivots=timeline(state);
  // One card per played act; keep every alternate pivot inside its details.
  const played=chapters.map((chapter,index)=>({chapter,index,events:pivots.filter(p=>p.chapter===index)})).filter(p=>p.events.length);
  return <div className="rewind"><span className="eyebrow">오늘의 기록</span><h1>{ending.title}</h1><p>{ending.line}</p>
    <div className="balance loss-balance"><span>돌아오지 않은 금액</span><strong>{money(totalSpent(state))}</strong><small>가상 거래 · 접수와 차단은 환급이 아닙니다.</small></div>
    <p className="ending-personal">{state.events.some(e=>e.type==='reflect'&&e.data==='tell')?'준호에게 이야기한 일이 남아 있다. 이 하루를 혼자 설명할 필요는 없다.':'누구에게 말할지는 아직 정하지 않았다. 지금 남긴 기록은 다음 이야기를 시작할 때 꺼낼 수 있다.'}</p>
    <h2>다시 고른다면</h2><p className="muted">선택 직전으로. 원래 기록은 그대로.</p>
    {played.map(({chapter,index,events})=>{
      const p=events.find(e=>e.type==='confirm')??events.find(e=>e.type==='resolve')??events[0];
      const spent=state.transactions.filter(tx=>tx.chapter===index).reduce((sum,tx)=>sum+tx.amount,0);
      const result=state.results.find(r=>r.chapter===index);
      const resultLabel=({verified:'직접 확인 후 종료',paused:'결정 보류',blocked:'연락 차단',reported:'자료 접수',stopped:'추가 송금 중단',loss:'돌아오지 않은 송금'} as Record<string,string>)[result?.kind??'']??p.label;
      return <article className="pivot" key={index}><span className="eyebrow">{index===0?'09:10':index===1?'14:00':'19:50'} · {chapter.story.title}</span><h3>{resultLabel}</h3>
        <div className="pivot-result"><span>이 연락의 출금</span><b className={spent?'negative':'good'}>{spent?'−':' '}{money(spent)}</b></div>
        <button onClick={()=>onReplay(p.index)}>이 순간으로 돌아가기 ↶</button>
        <details className="pivot-details"><summary>확인한 기록과 다른 선택</summary>
          {p.takeaway.map(e=><p key={e.title}><span className={e.seen?'good':'negative'}>{e.seen?'확인한 단서':'지나친 단서'}</span> · {e.title}</p>)}
          {events.filter(e=>e.index!==p.index).map(e=><button key={e.index} onClick={()=>onReplay(e.index)}>{e.label} 직전으로 ↶</button>)}
        </details></article>;
    })}
    <details className="ending-notes"><summary>오늘 남길 세 문장</summary><ul><li>익숙한 이름보다, 내가 저장한 연락처를 확인한다.</li><li>수익 화면보다, 실제 입출금 기록을 확인한다.</li><li>돌려받기 위해 먼저 돈을 보내라는 요청에서 멈춘다.</li></ul><p className="fine">실제 피해는 금융사와 수사기관의 공식 경로로 도움을 요청하세요.</p></details>
    <button className="primary" onClick={onRestart}>처음 화면으로</button></div>;
}

export function RecordComparison({state}:{state:Run}){
  if(state.chapter!==1||!['paid','withdrawal','extra-paid'].includes(state.stage))return null;
  const sent=state.transactions.filter(tx=>tx.chapter===1).reduce((sum,tx)=>sum+tx.amount,0);
  return <details className="record comparison"><summary>두 기록 나란히 보기</summary>
    <div className="comparison-pair"><article><h3>온결 화면</h3><p>표시된 평가 금액</p><strong>355,200원</strong></article><article><h3>생활 계좌</h3><p>온결 관련 출금</p><strong>−{money(sent)}</strong><p>들어온 돈 0원</p></article></div>
    {['withdrawal','extra-paid'].includes(state.stage)&&<div className="comparison-pair"><article><h3>참여 전 대화</h3><p>{state.events.some(e=>e.type==='talk'&&e.data==='paper-offer-withdraw')?'“이용 화면에서 출금 요청을 하는 방식입니다.”':'“자료를 읽는 것과 별도 참여는 구분됩니다. 참여 안내를 남겼어요.”'}</p><small>참여 전 대화 · 확인 비용 안내 없음</small></article><article><h3>현재 대화</h3><p>“현재 출금이 보류되어 있습니다. 별도 확인 비용 안내를 읽어 주세요.”</p><small>추가 요청 120,000원</small></article></div>}
  </details>;
}
