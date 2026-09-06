import { chapters, INITIAL_BALANCE, money, totalSpent, endingFor, timeline } from './engine';
type Run = ReturnType<typeof import('./engine').createRun>;
export function Ledger({state}:{state:Run}) {
  return <><div className="balance"><span>생활 계좌 · 가상</span><strong>{money(INITIAL_BALANCE-totalSpent(state))}</strong><small>게임 내 거래만 표시됩니다</small></div>
    <h2>최근 거래</h2><div className="ledger-row"><span>오늘의 시작 잔액</span><b>{money(INITIAL_BALANCE)}</b></div>
    {state.transactions.length===0?<p className="muted">오늘 출금된 거래가 없습니다.</p>:state.transactions.map((tx:{id:string;time:string;recipient:string;amount:number})=><div className="ledger-row" key={tx.id}><span>{tx.recipient}<small>{tx.time} · 가상 출금</small></span><b className="negative">−{money(tx.amount)}</b></div>)}
    <p className="fine">다른 앱에 표시된 수익은 이 계좌의 입금과 별개입니다.</p></>;
}
export function Rewind({state,onReplay,onRestart}:{state:Run;onReplay:(index:number)=>void;onRestart:()=>void}) {
  const ending=endingFor(state);
  const pivots=timeline(state);
  // Preserve one decisive event per act, plus at most two extra money/call pivots.
  const primary=pivots.filter(e=>e.type==='resolve');
  const extra=pivots.filter(e=>e.type==='confirm').slice(0,2);
  const selected=[...primary,...extra].sort((a,b)=>a.index-b.index);
  return <div className="rewind"><span className="eyebrow">수익률 24시 · 오늘의 기록</span><h1>{ending.title}</h1><p>{ending.line}</p>
    <div className="balance"><span>돌아오지 않은 가상 금액</span><strong>{money(totalSpent(state))}</strong><small>접수나 차단은 이미 보낸 돈을 되돌리지 않습니다.</small></div>
    <h2>시간을 되감으면</h2><p className="muted">선택 직전으로 돌아갑니다. 원래 하루의 기록은 바뀌지 않습니다.</p>
    {selected.map(p=><article className="pivot" key={p.index}><span className="eyebrow">{chapters[p.chapter].story.time<720?'오전':p.chapter===1?'오후':'저녁'} · {p.title}</span><h3>{p.label}</h3>
      {p.takeaway.map((e:{title:string;seen:boolean})=><p key={e.title}><span className={e.seen?'good':'negative'}>{e.seen?'확인한 단서':'지나친 단서'}</span> · {e.title}</p>)}
      <button onClick={()=>onReplay(p.index)}>이 선택 직전 다시 해보기 ↶</button></article>)}
    <h2>오늘 남길 세 문장</h2><ul><li>익숙한 이름보다, 내가 저장한 연락처를 확인한다.</li><li>수익 화면보다, 실제 입출금 기록을 확인한다.</li><li>돌려받기 위해 먼저 돈을 보내라는 요청에서 멈춘다.</li></ul>
    <p className="fine">가상 사건입니다. 실제 상황에서는 해당 금융사와 수사기관의 공식 경로로 도움을 요청하세요.</p>
    <button className="primary" onClick={onRestart}>처음 화면으로</button></div>;
}
