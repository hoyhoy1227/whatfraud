import {chapterPages,chapterAction,resumeContext} from './context';
import {messageConsequences} from './one-shot';
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
   <header className="investment-brand"><span className="investment-mark" aria-hidden="true">O</span><div><strong>온결</strong><small>자산 현황</small></div><span className="investment-account">{invested?'내 이용 화면':'참여자 공개 화면'}</span></header>
   {!invested&&<p className="investment-sample">게시된 참여자 사례입니다. 내 계좌 내역이 아닙니다.</p>}
   <div className="investment-total"><span>총 평가 금액</span><strong>355,200<span>원</span></strong><p>평가 수익 <b>+55,200원</b><span className="return-chip">+18.4%</span></p></div>
   <dl className="investment-metrics"><div><dt>참여 금액</dt><dd>300,000원</dd></div><div><dt>평가 손익</dt><dd className="investment-gain">+55,200원</dd></div></dl>
   <section className="investment-position"><h3>참여 현황</h3><div className="investment-row"><span>참여 계정<small>{invested?'현재 이용 내역':'공개된 이용 사례'}</small></span><strong>평가 중</strong></div><div className="investment-row"><span>출금 상태</span><strong>{held?'보류':invested?'요청 전':'공개되지 않음'}</strong></div>{extra&&<div className="investment-row"><span>추가 확인 비용</span><strong>120,000원 납부</strong></div>}</section>
   {held&&<p className="investment-pending">출금 요청을 확인 중입니다.<br/>담당자가 보낸 안내를 확인해 주세요.</p>}
   <footer>온결 화면에 표시된 금액입니다.<br/>실제 입출금은 휴대폰의 은행 앱에서 확인할 수 있습니다.</footer>
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
  return <div className="rewind"><div className="game-complete" role="status"><span aria-hidden="true">✓</span><div><strong>게임이 종료되었습니다</strong><small>3개의 사기 상황을 모두 완료했습니다.</small></div></div><span className="eyebrow">오늘의 기록</span><h1>{ending.title}</h1><p>{ending.line}</p>
    <PlayerReview state={state}/>
    <div className="balance loss-balance"><span>돌아오지 않은 금액</span><strong>{money(totalSpent(state))}</strong><small>가상 거래 · 접수와 차단은 환급이 아닙니다.</small></div>
    <p className="ending-personal">{state.events.some(e=>e.type==='reflect'&&e.data==='tell'||e.type==='message'&&e.data==='friend:together')?'준호에게 이야기한 일이 남아 있다. 이 하루를 혼자 설명할 필요는 없다.':'누구에게 말할지는 아직 정하지 않았다. 지금 남긴 기록은 다음 이야기를 시작할 때 꺼낼 수 있다.'}</p>
    {messageConsequences(state).length>0&&<section className="ending-messages"><h2>오늘 남긴 연락</h2>{messageConsequences(state).map(text=><p key={text}>{text}</p>)}</section>}
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

export function buildPlayerReview(state:Run){
 const checkedIdentity=state.calls.some(call=>call.endsWith(':junho')||call.endsWith(':contact'));
 const comparedRecords=state.events.some(event=>event.type==='observe'&&event.data==='bank-view')&&state.events.some(event=>event.type==='observe'&&event.data==='platform-view');
 const keptEvidence=state.saved.length>0||state.events.some(event=>event.type==='capture');
 const stoppedRequests=state.results.filter(result=>['verified','paused','blocked','reported','stopped'].includes(result.kind)).length;
 const strengths:string[]=[];
 if(checkedIdentity)strengths.push('상대가 알려 준 연락처가 아니라, 원래 저장된 연락처와 기록으로 신원을 확인했어요.');
 if(comparedRecords)strengths.push('수익 화면의 숫자를 믿기 전에 실제 은행 입출금 내역과 대조했어요.');
 if(keptEvidence)strengths.push('대화와 단서를 보관해 신고·상담에 쓸 수 있는 기록을 남겼어요.');
 if(stoppedRequests>=2)strengths.push(`3개 상황 중 ${stoppedRequests}개에서 송금을 보류하거나 추가 피해를 멈췄어요.`);
 if(!strengths.length)strengths.push('끝까지 상황을 살펴본 경험이 다음 의심스러운 연락을 알아채는 단서가 됩니다.');
 const risks=[];
 if(!checkedIdentity)risks.push({title:'지인 사칭',text:'익숙한 이름과 말투만 믿게 한 뒤 새 계정이나 낯선 결제 경로로 유도해요.',action:'기존에 저장한 번호로 직접 확인하기'});
 if(state.transactions.some(tx=>tx.chapter===1))risks.push({title:'가짜 투자 수익',text:'화면 속 수익을 보여 주고, 출금하려면 세금·인증비 같은 추가 송금을 요구해요.',action:'수익 화면 대신 내 은행의 실제 입금 내역 확인하기'});
 if(state.transactions.length>0||state.results.some(result=>result.chapter===2&&result.kind==='loss'))risks.push({title:'피해 회복 사기',text:'이미 잃은 돈을 돌려주겠다며 선입금이나 개인정보를 다시 요구해요.',action:'상대가 준 링크가 아닌 공식 기관 경로로 접수하기'});
 if(!risks.length)risks.push({title:'긴급 송금 유도',text:'친밀감, 한정 기회, 처리 마감으로 확인할 시간을 빼앗는 방식에 특히 주의하세요.',action:'송금 전 대화를 멈추고 다른 경로로 교차 확인하기'});
 return {strengths:strengths.slice(0,3),risks:risks.slice(0,3)};
}

export function PlayerReview({state}:{state:Run}){
 const review=buildPlayerReview(state);
 return <section className="ai-review" aria-labelledby="ai-review-title">
   <header><span className="ai-review-mark" aria-hidden="true">AI</span><div><small>플레이 기록 분석 완료</small><h2 id="ai-review-title">나의 사기 대응 리포트</h2></div></header>
   <p className="ai-review-privacy">대화 내용이 아닌, 게임에서 고른 행동과 확인한 기록만 분석했어요.</p>
   <section className="review-strengths"><h3>잘한 점</h3><ul>{review.strengths.map(item=><li key={item}><span aria-hidden="true">✓</span>{item}</li>)}</ul></section>
   <section className="review-risks"><h3>다음에 조심할 사기 수법</h3>{review.risks.map(risk=><article key={risk.title}><strong>{risk.title}</strong><p>{risk.text}</p><small>대응 습관 · {risk.action}</small></article>)}</section>
   <p className="review-note">이 분석은 학습을 위한 안내이며 실제 사기 여부를 판정하지 않습니다.</p>
 </section>;
}


export function RecordComparison({state,onObserve,onQuestion,onBank,onPlatform}:{state:Run;onObserve?:()=>void;onQuestion?:()=>void;onBank?:()=>void;onPlatform?:()=>void}){
 if(state.chapter!==1||!['paid','withdrawal','extra-paid'].includes(state.stage))return null;
 const seen=(id:string)=>state.events.some(e=>e.type==='observe'&&e.chapter===1&&e.data===id);
 const sent=state.transactions.filter(tx=>tx.chapter===1).reduce((sum,tx)=>sum+tx.amount,0);
 return <section className="record comparison"><h3>기록 대조</h3>
 {seen('bank-view')&&seen('platform-view')?<details><summary>화면 금액과 은행 내역</summary><div className="comparison-pair"><article><small>출처 · 온결 화면</small><h3>표시된 평가 금액</h3><strong>355,200원</strong></article><article><small>출처 · 생활 계좌</small><h3>온결 관련 출금</h3><strong>−{money(sent)}</strong><p>들어온 돈 0원</p></article></div></details>:<div>{!seen('platform-view')&&<button onClick={onPlatform}>투자 화면 확인하기</button>}{!seen('bank-view')&&<button onClick={onBank}>은행 내역 확인하기</button>}</div>}
 {['withdrawal','extra-paid'].includes(state.stage)&&<details onToggle={event=>{if(event.currentTarget.open)onObserve?.();}}><summary>처음 안내와 지금 안내</summary><div className="comparison-pair"><article><small>출처 · 참여 전 대화</small><p>{state.events.some(e=>e.type==='talk'&&e.data==='paper-offer-withdraw')?'“이용 화면에서 출금 요청을 하는 방식입니다.”':'“자료를 읽는 것과 별도 참여는 구분됩니다. 참여 안내를 남겼어요.”'}</p></article><article><small>출처 · 현재 대화</small><p>“현재 출금이 보류되어 있습니다. 별도 확인 비용 안내를 읽어 주세요.”</p><strong>추가 요청 120,000원</strong></article></div><button onClick={onQuestion}>지수에게 메시지 보내기</button></details>}
 </section>;
}
export function PhoneStatus({time}:{time:string}){
 return <div className="statusbar"><b>{time}</b><span className="camera-island" aria-hidden="true"/><span className="phone-indicators"><svg className="wifi-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M3 8a15 15 0 0 1 18 0M6 12a10 10 0 0 1 12 0M9 16a5 5 0 0 1 6 0"/><circle cx="12" cy="20" r="1" fill="currentColor" stroke="none"/></svg><span className="battery-icon" aria-hidden="true"/></span></div>;
}
export function Closing({state,step,onNext,onSkip}:{state:Run;step:number;onNext:()=>void;onSkip:()=>void}){
 const told=state.events.some(e=>e.type==='reflect'&&e.data==='tell'),last=state.results.find(r=>r.chapter===2);
 return <div className={'closing closing-'+step}>
 {step===0?<><small>마지막 대화</small><h2>회복 지원 상담</h2><p className="system-message">{last?.kind==='loss'?'접수 내용 확인 중':last?.kind==='reported'?'자료 접수 기록이 남아 있다.':'이 연락은 여기서 멈췄다.'}</p></>:step===1?<><small>생활 계좌</small><Ledger state={state}/><p>돌아오지 않은 금액 {money(totalSpent(state))}</p></>:step===2?<><small>준호 · 기존 연락처</small><div className="bubble"><p>{told?'오늘 얘기해 줘서 고마워. 내일도 연락할게. 혼자 급하게 해결하려고 하진 말자.':'집에 도착했어? 오늘 만나서 좋았어. 내일 연락할게.'}</p></div><p>{state.saved.length||state.events.some(e=>e.type==='capture')?'메모에 보관한 기록이 남아 있다.':'은행에는 오늘의 거래 내역이 남아 있다.'}</p></>:<><div className="lock-clock">22:10</div><p>휴대폰을 잠갔다.</p><small>하루가 끝나도 다음 선택은 남아 있다.</small></>}
 <button className="primary" onClick={onNext}>{['은행 내역 보기','준호의 연락 보기','화면 잠그기','오늘의 기록 열기'][step]}</button>{step<3&&<button className="text-button" onClick={onSkip}>오늘의 기록으로 바로 가기</button>}
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
 <button className="primary" onClick={last?onContinue:onNext}>{last?(resume?'멈춘 연락으로 돌아가기':chapterAction(state)):'계속하기'}</button>
 {!last&&<button className="text-button" onClick={onContinue}>장면 건너뛰기</button>}
 </section>;
}

export function ConversationRow({name,initial,preview,detail,unread=false,onOpen}:{name:string;initial:string;preview:string;detail:string;unread?:boolean;onOpen:()=>void}){
 return <button className="conversation-row" onClick={onOpen} aria-label={name+' · '+detail+(unread?' · 읽지 않은 연락':'')}>
 <span className="avatar" data-person={name} aria-hidden="true">{initial}</span><span className="conversation-copy"><span className="conversation-name">{name}<small>{detail}</small></span><span className="conversation-preview">{preview}</span></span>
 {unread&&<span className="conversation-unread" aria-label="읽지 않은 연락"/>}
 </button>;
}
