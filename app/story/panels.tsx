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
 const held=state.events.some(e=>e.chapter===1&&e.type==='withdraw');
 const extra=state.transactions.some(tx=>tx.id==='paper-profit:extra');
 return <section className="investment-screen" aria-label="온결 투자 화면">
 <header className="investment-brand"><span className="investment-mark">O</span><div><strong>온결 리서치</strong><small>상대방이 보낸 자료 · 공식 확인 전</small></div><span>{invested?'참여 화면':'게시 사례'}</span></header>
 <div className="research-hero"><small>온결 수익률 보고서</small><h2>오늘의 평가 현황</h2><p>운영자가 게시한 수치입니다. 은행 입금과 구분해 확인하세요.</p></div>
 <div className="investment-total"><span>{invested?'플랫폼 표시 평가금액':'게시 사례의 평가금액'}</span><strong>355,200<span>원</span></strong><p>기준 300,000원 · 표시 수익 <b>+55,200원</b><span className="return-chip">+18.4%</span></p></div>
 <section className="investment-position"><h3>출금 상태</h3><p>{extra?'비용을 보냈지만 출금 확인 중':held?'출금 전 보안 확인 비용 120,000원 요구':invested?'출금 요청 전':'내 투자·입금 증빙이 아닌 게시 사례'}</p><p>계산 근거·실제 거래 원장·전체 손익 미공개</p></section>
 <div className="comparison-pair"><article><small>발신자 주장</small><h3>화면 수익</h3><strong>+55,200원</strong></article><article><small>독립 확인 기록 · 은행</small><h3>실제 게임 거래</h3><p>수익금 입금 0원</p><p>온결 관련 출금 {money(state.transactions.filter(t=>t.chapter===1).reduce((sum,t)=>sum+t.amount,0))}</p></article></div>
 <footer>화면의 숫자는 입금 증빙이 아닙니다. 메신저의 수익률 보고서를 보관하고 은행·회사 확인 기록과 비교할 수 있습니다.</footer>
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
    <details className="ending-notes"><summary>오늘 남길 세 문장</summary><ul><li>익숙한 이름보다, 내가 저장한 연락처를 확인한다.</li><li>수익 화면과 은행 원장, 출금 조건을 비교한다.</li><li>돌려받기 위해 먼저 돈을 보내라는 요청에서 멈춘다.</li></ul><p className="fine">실제 피해는 금융사와 수사기관의 공식 경로로 도움을 요청하세요.</p></details>
    <button className="primary" onClick={onRestart}>처음 화면으로</button></div>;
}


export function RecordComparison({state,onObserve,onQuestion,onBank,onPlatform}:{state:Run;onObserve?:()=>void;onQuestion?:()=>void;onBank?:()=>void;onPlatform?:()=>void}){
 if(state.chapter!==1||!['paid','withdrawal','extra-paid'].includes(state.stage))return null;
 const seen=(id:string)=>state.events.some(e=>e.type==='observe'&&e.chapter===1&&e.data===id);
 const sent=state.transactions.filter(tx=>tx.chapter===1).reduce((sum,tx)=>sum+tx.amount,0);
 return <section className="record comparison"><h3>기록 대조</h3>
 {seen('bank-view')&&seen('platform-view')?<details><summary>화면 금액과 은행 내역</summary><div className="comparison-pair"><article><small>출처 · 온결 화면</small><h3>표시된 평가 금액</h3><strong>355,200원</strong></article><article><small>출처 · 생활 계좌</small><h3>온결 관련 출금</h3><strong>−{money(sent)}</strong><p>들어온 돈 0원</p></article></div></details>:<div>{!seen('platform-view')&&<button onClick={onPlatform}>투자 화면 확인하기</button>}{!seen('bank-view')&&<button onClick={onBank}>은행 내역 확인하기</button>}</div>}
 {['withdrawal','extra-paid'].includes(state.stage)&&<details onToggle={event=>{if(event.currentTarget.open)onObserve?.();}}><summary>처음 안내와 지금 안내</summary><div className="comparison-pair"><article><small>출처 · 참여 전 대화</small><p>{state.events.some(e=>e.type==='talk'&&e.data==='paper-offer-withdraw')?'“이용 화면에서 출금을 요청하는 방식이에요.”':'“참여금은 30만 원입니다.”'}</p></article><article><small>출처 · 현재 대화</small><p>“출금 전 보안 확인 비용 12만 원이 필요해요.”</p><strong>추가 요청 120,000원</strong></article></div><button onClick={onQuestion}>지수에게 메시지 보내기</button></details>}
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
