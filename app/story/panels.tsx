import {chapterPages,chapterAction,resumeContext} from './context';
import ResponseReport from './analysis-report';
import { chapters, INITIAL_BALANCE, money, totalSpent, endingFor, timeline } from './engine';
type Run = ReturnType<typeof import('./engine').createRun>;
export function Ledger({state}:{state:Run}) {
  return <><div className="balance"><span>생활 계좌</span><strong>{money(INITIAL_BALANCE-totalSpent(state))}</strong><small>출금 가능 잔액</small></div>
    <h2>거래 내역</h2><div className="ledger-row"><span>시작 잔액</span><b>{money(INITIAL_BALANCE)}</b></div>
    {state.transactions.length===0?<p className="muted">오늘 출금된 거래가 없습니다.</p>:state.transactions.map((tx:{id:string;time:string;recipient:string;amount:number})=><div className="ledger-row" key={tx.id}><span>{tx.recipient}<small>{tx.time} · 출금</small></span><b className="negative">−{money(tx.amount)}</b></div>)}</>;
}

export function InvestmentScreen({state}:{state:Run}){
 const invested=state.transactions.some(tx=>tx.id==='paper-profit:main');
 const held=['withdrawal','extra-paid'].includes(state.stage);
 const extra=state.transactions.some(tx=>tx.id==='paper-profit:extra');
 return <section className="investment-screen" aria-label="온결 투자 화면">
   <header className="investment-brand"><span className="investment-mark" aria-hidden="true">O</span><div><strong>온결 리서치</strong><small>MARKET INSIGHT · 시장 분석</small></div><span className="investment-account">{invested?'구매 내역':'무료 요약'}</span></header>
   <div className="research-hero"><small>오늘의 시장 노트 · 공개 사례</small><h2>숫자 뒤의 기회를<br/>읽는 시간</h2><p>정밀한 평가금액 분석은 별도 자료로 안내합니다.</p></div>
   <div className="investment-total"><span>게시 사례의 평가금액</span><strong>355,200<span>원</span></strong><p>표시된 변동 <b>+55,200원</b><span className="return-chip">+18.4%</span></p></div>
   <div className="research-chart"><svg viewBox="0 0 320 86" role="img" aria-label="운영팀이 게시한 상승 예시 그래프. 실제 시세가 아닙니다."><path d="M0 70H320M0 40H320M0 10H320" stroke="#dde6ef" fill="none"/><path d="M0 74L35 62L65 66L100 48L130 53L163 34L200 42L235 24L270 29L320 8" fill="none" stroke="#d65660" strokeWidth="3"/></svg><small>게시된 일부 사례 · 전체 기간과 계산 근거 미공개</small></div>
   <dl className="investment-metrics"><div><dt>사례의 기준 금액</dt><dd>300,000원</dd></div><div><dt>자료 구분</dt><dd>평가 요약</dd></div></dl>
   <section className="investment-position"><h3>분석 자료 이용 안내</h3><div className="investment-row"><span>무료 시장 노트<small>게시 사례와 평가금액 요약</small></span><strong>열람 중</strong></div><div className="investment-row"><span>상세 분석 자료<small>안내된 이용료 300,000원</small></span><strong>{invested?'결제됨 · 요약만 제공':'별도 구매'}</strong></div><div className="research-locked"><span aria-hidden="true">▣</span><div><b>정밀 평가금액 분석</b><p>{held?'추가 이용료 120,000원 안내':'계산 근거·항목별 분석은 요청 후 안내'}</p></div><strong>{extra?'준비 중':held?'추가 결제 요구':'별도 요청'}</strong></div>{extra&&<p className="investment-pending">추가 이용료를 보냈지만 정밀 분석 자료는 아직 제공되지 않았습니다.</p>}</section>
   <footer>내 계좌 잔액이나 실제 시세가 아닌 게시 자료입니다.<br/>구매 안내·받은 자료와 은행 출금 내역을 대조할 수 있습니다.</footer>
 </section>;
}

export function PlayGuide({state}:{state:Run}){
 return state.chapter===0
  ? <p className="guide-footnote">첫 사건의 시작에서 실제 버튼 위치를 밝게 표시하는 조작 안내가 진행됩니다.</p>
  : <p className="guide-footnote">조작 안내는 첫 사건에서만 진행됩니다. 이후 사건에서는 같은 휴대폰 조작을 그대로 사용합니다.</p>;
}

export function Rewind({state,onReplay,onRestart}:{state:Run;onReplay:(index:number)=>void;onRestart:()=>void}) {
  const ending=endingFor(state);
  const pivots=timeline(state);
  // One card per played act; keep every alternate pivot inside its details.
  const played=chapters.map((chapter,index)=>({chapter,index,events:pivots.filter(p=>p.chapter===index)})).filter(p=>p.events.length);
  return <div className="rewind"><ResponseReport state={state}/><h2>{ending.title}</h2><p>{ending.line}</p>
    <div className="balance loss-balance"><span>돌아오지 않은 금액</span><strong>{money(totalSpent(state))}</strong><small>가상 거래 · 접수와 차단은 환급이 아닙니다.</small></div>
    <p className="ending-personal">{state.saved.length||state.events.some(e=>e.type==='capture')?'확인하고 보관한 기록이 남아 있다. 필요한 경우 공식 경로에서 사실관계를 설명하는 데 활용할 수 있다.':'은행과 사건별 선택 기록이 남아 있다. 필요한 자료는 사라지기 전에 별도로 보관하는 편이 안전하다.'}</p>
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
    <details className="ending-notes"><summary>오늘 남길 세 문장</summary><ul><li>익숙한 이름보다, 내가 저장한 연락처를 확인한다.</li><li>분석 자료의 약속된 범위와 추가 비용을 확인한다.</li><li>돌려받기 위해 먼저 돈을 보내라는 요청에서 멈춘다.</li></ul><p className="fine">실제 피해는 금융사와 수사기관의 공식 경로로 도움을 요청하세요.</p></details>
    <button className="primary" onClick={onRestart}>처음 화면으로</button></div>;
}


export function RecordComparison({state,onObserve,onQuestion,onBank,onPlatform}:{state:Run;onObserve?:()=>void;onQuestion?:()=>void;onBank?:()=>void;onPlatform?:()=>void}){
 if(state.chapter!==1||!['paid','withdrawal','extra-paid'].includes(state.stage))return null;
 const seen=(id:string)=>state.events.some(e=>e.type==='observe'&&e.chapter===1&&e.data===id);
 const sent=state.transactions.filter(tx=>tx.chapter===1).reduce((sum,tx)=>sum+tx.amount,0);
 return <section className="record comparison"><h3>기록 대조</h3>
 {seen('bank-view')&&seen('platform-view')?<details><summary>화면 금액과 은행 내역</summary><div className="comparison-pair"><article><small>출처 · 온결 화면</small><h3>표시된 평가 금액</h3><strong>355,200원</strong></article><article><small>출처 · 생활 계좌</small><h3>온결 관련 출금</h3><strong>−{money(sent)}</strong><p>들어온 돈 0원</p></article></div></details>:<div>{!seen('platform-view')&&<button onClick={onPlatform}>투자 화면 확인하기</button>}{!seen('bank-view')&&<button onClick={onBank}>은행 내역 확인하기</button>}</div>}
 {['withdrawal','extra-paid'].includes(state.stage)&&<details onToggle={event=>{if(event.currentTarget.open)onObserve?.();}}><summary>처음 안내와 지금 안내</summary><div className="comparison-pair"><article><small>출처 · 참여 전 대화</small><p>{state.events.some(e=>e.type==='talk'&&e.data==='paper-offer-withdraw')?'“상세 평가 자료를 이용 화면에서 보는 방식이에요.”':'“무료 요약과 상세 분석 자료는 별도예요. 상세 자료 이용료는 30만 원이에요.”'}</p></article><article><small>출처 · 현재 대화</small><p>“더 정확한 평가금액 분석 자료에는 추가 이용료 12만 원이 필요해요.”</p><strong>추가 요청 120,000원</strong></article></div><button onClick={onQuestion}>지수에게 메시지 보내기</button></details>}
 </section>;
}
export function PhoneStatus({time}:{time:string}){
 return <div className="statusbar"><b>{time}</b><span className="camera-island" aria-hidden="true"/><span className="phone-indicators"><svg className="wifi-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M3 8a15 15 0 0 1 18 0M6 12a10 10 0 0 1 12 0M9 16a5 5 0 0 1 6 0"/><circle cx="12" cy="20" r="1" fill="currentColor" stroke="none"/></svg><span className="battery-icon" aria-hidden="true"/></span></div>;
}
export function Closing({state,step,onNext,onSkip}:{state:Run;step:number;onNext:()=>void;onSkip:()=>void}){
 const last=state.results.find(r=>r.chapter===2);
 return <div className={'closing closing-'+step}>
 {step===0?<><small>마지막 대화</small><h2>회복 지원 상담</h2><p className="system-message">{last?.kind==='loss'?'요청한 처리는 완료되지 않았다.':last?.kind==='reported'?'게임 안에 자료 접수 기록이 남아 있다.':'이 연락은 여기서 멈췄다.'}</p></>:step===1?<><small>생활 계좌</small><Ledger state={state}/><p>돌아오지 않은 금액 {money(totalSpent(state))}</p></>:step===2?<><small>지금까지의 정리</small><h2>연락과 거래 기록</h2><p>{state.saved.length||state.events.some(e=>e.type==='capture')?'메모에 보관한 기록과 은행 거래 내역이 남아 있다.':'은행 거래 내역과 사건별 선택 기록이 남아 있다.'}</p><p className="system-message">회복 지원 상담 이후 새로운 개인 연락은 없습니다.</p></>:<><div className="lock-clock">22:10</div><p>휴대폰을 잠갔다.</p><small>하루가 끝나도 다음 선택은 남아 있다.</small></>}
 <button className="primary" onClick={onNext}>{['은행 내역 보기','지금까지 내용 정리하기','화면 잠그기','결과 보기'][step]}</button>{step<3&&<button className="text-button" onClick={onSkip}>오늘의 기록으로 바로 가기</button>}
 </div>;
}
type Profile={name:string;initial:string;status:string;relationship:string;kind:string};
export function ContactProfile({profile,blocked,onClose,onChat,onCall,callAvailable=true}:{profile:Profile;blocked:boolean;callAvailable?:boolean;onClose:()=>void;onChat:()=>void;onCall:()=>void}){
 return <div className={'contact-profile profile-'+profile.kind}><div className="profile-cover"><button className="profile-close" aria-label="프로필 닫기" onClick={onClose}>×</button></div><div className="profile-body"><div className="profile-avatar" data-person={profile.name} aria-hidden="true">{profile.initial}</div><h2>{profile.name}</h2><p className="profile-status">{profile.status}</p><span className="profile-relationship">{profile.relationship}</span>{blocked&&<p>차단한 계정</p>}<div className="profile-actions"><button onClick={onChat}>대화 보기</button><button disabled={blocked||!callAvailable} onClick={onCall}>{callAvailable?'연락 확인':'등록된 번호 없음'}</button></div><small>이름과 상태 메시지는 계정에 표시된 정보입니다.</small></div></div>;
}

export function ChapterScene({state,page=0,resume=false,onNext,onContinue}:{state:Run;page?:number;resume?:boolean;onNext:()=>void;onContinue:()=>void}){
 const pages=chapterPages(state),scene=pages[Math.min(page,pages.length-1)],last=resume||page>=pages.length-1;
 return <section className={'chapter-scene chapter-scene-'+state.chapter} aria-label="하루의 장면">
 <small>{resume?'멈췄던 순간':scene.time}</small><h2>{resume?'다시 휴대폰을 열었다':scene.title}</h2>
 <div key={resume?'resume':page} className="chapter-copy">{(resume?resumeContext(state):scene.lines).filter(Boolean).map(line=><p key={line}>{line}</p>)}</div>
 {!resume&&<p className="chapter-count">{page+1} / {pages.length}</p>}
 <button className="primary" onClick={last?onContinue:onNext}>{last?(resume?'멈춘 연락으로 돌아가기':chapterAction(state)) :'계속 진행'}</button>
 </section>;
}

export function ConversationRow({name,initial,preview,detail,unread=false,onOpen}:{name:string;initial:string;preview:string;detail:string;unread?:boolean;onOpen:()=>void}){
 return <button className="conversation-row" onClick={onOpen} aria-label={name+' · '+detail+(unread?' · 읽지 않은 연락':'')}>
 <span className="avatar" data-person={name} aria-hidden="true">{initial}</span><span className="conversation-copy"><span className="conversation-name">{name}<small>{detail}</small></span><span className="conversation-preview">{preview}</span></span>
 {unread&&<span className="conversation-unread" aria-label="읽지 않은 연락"/>}
 </button>;
}
