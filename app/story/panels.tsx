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
