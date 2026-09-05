'use client';
import { useState } from 'react';
import type { CaseData, LocationId, Verdict } from './game-data';
import { verdictLabels } from './game-data';
import { EVIDENCE_KINDS, evaluateDecision, verifiedClaims } from './training-rules';
export type TrainingAction = 'verify' | 'pause' | 'block' | 'report';
export const actionLabels: Record<TrainingAction,string> = {verify:'공식 경로 확인',pause:'행동 보류',block:'연락 차단',report:'기록 보관·신고'};
export const sourceLabels: Record<LocationId,string> = {home:'내 공식 앱 기록',bank:'은행 앱',cafe:'저장된 연락처',police:'공식 신고 창구',library:'업체·공시 검색'};

export function ClaimsPanel({gameCase,evidence,verify,fast=false}: {gameCase:CaseData;evidence:string[];verify:(source:LocationId)=>void;fast?:boolean}) {
  const checked=verifiedClaims(gameCase,evidence);
  return <section className="claims-panel" aria-label="검증할 주장"><h3>무엇을 확인할까요?</h3><p>{checked.length?'주장 '+checked.length+'/'+gameCase.training.claims.length+'개와 연결된 기록을 찾았습니다. 의미는 직접 판단하세요.':'아직 검증한 주장 없음'}</p>
  {gameCase.training.claims.map(claim=><article key={claim.id}><b>{checked.includes(claim.id)?'✓ ':'○ '}{claim.text}</b><div>{[...new Set(gameCase.training.evidence.filter(clue=>clue.claimIds.includes(claim.id)).map(clue=>clue.source))].map(source=><button key={source} onClick={()=>verify(source)} disabled={evidence.includes(gameCase.checks[source]??'')}>{sourceLabels[source]}{evidence.includes(gameCase.checks[source]??'')?' · 확인함':''}</button>)}</div></article>)}
  {fast&&<button onClick={()=>{const next=gameCase.training.optimalSources.find(source=>!evidence.includes(gameCase.checks[source]??''));if(next)verify(next);}} disabled={gameCase.training.optimalSources.every(source=>evidence.includes(gameCase.checks[source]??''))}>확인 습관 보너스 · 다음 핵심 경로</button>}</section>;
}

export function DecisionPanel({gameCase,evidence,selected,toggle,picked,setPicked,action,setAction,confidence,setConfidence,submit,close,investigate}: {
 gameCase:CaseData;evidence:string[];selected:string[];toggle:(text:string)=>void;picked:Verdict|null;setPicked:(value:Verdict)=>void;action:TrainingAction|null;setAction:(value:TrainingAction)=>void;confidence:number;setConfidence:(value:number)=>void;submit:()=>void;close:()=>void;investigate:()=>void;
}) {
 return <div className="verdict-overlay-backdrop" role="dialog" aria-modal="true" aria-labelledby="global-verdict-title"><section className="verdict-overlay training-decision"><header><h2 id="global-verdict-title">{gameCase.sender} · 판단 등록</h2><button onClick={close} aria-label="판정창 닫기">×</button></header>
 <div className="training-decision-scroll"><p>“{gameCase.preview}”</p><p>내 결론을 뒷받침하는 근거만 선택하세요.</p>
 {evidence.length?<div className="evidence-picker">{evidence.map(text=><button key={text} aria-pressed={selected.includes(text)} className={selected.includes(text)?'active':''} onClick={()=>toggle(text)}><i>{selected.includes(text)?'✓':'+'}</i><span>{text}</span></button>)}</div>:<p>아직 검증한 주장 없음 · 근거 없이도 제출할 수 있지만 판단 과정 점수는 낮아집니다.</p>}<button onClick={investigate}>앱에서 더 확인하기</button>
 <fieldset><legend>판별</legend><div className="verdict-buttons">{(['normal','caution','scam'] as Verdict[]).map(value=><button key={value} aria-pressed={picked===value} className={picked===value?'active':''} onClick={()=>setPicked(value)}>{verdictLabels[value]}</button>)}</div><small>주의: 추가 확인이나 행동 보류가 필요한 상태</small></fieldset>
 <fieldset><legend>안전한 다음 행동</legend><div className="response-actions">{(Object.keys(actionLabels) as TrainingAction[]).map(value=><button key={value} aria-pressed={action===value} className={action===value?'active':''} onClick={()=>setAction(value)}>{actionLabels[value]}</button>)}</div></fieldset>
 <fieldset><legend>확신도</legend><div className="confidence-buttons">{[50,70,90].map(value=><button key={value} aria-pressed={confidence===value} className={confidence===value?'active':''} onClick={()=>setConfidence(value)}>{value}%</button>)}</div></fieldset></div>
 <footer className="decision-dock" aria-live="polite"><span>{picked?verdictLabels[picked]:'판별 미선택'} · {action?actionLabels[action]:'대응 미선택'} · 확신 {confidence}% · 선택 근거 {selected.length}개</span><button className="submit-verdict" onClick={submit} disabled={!picked||!action}>이 판단으로 제출</button></footer></section></div>;
}

export function ProcessFeedback({gameCase,result}: {gameCase:CaseData;result:ReturnType<typeof evaluateDecision>}) {
 const labels:Record<string,string>={verdict:'판별 /25',evidence:'근거 /30',action:'대응 /20',confidence:'확신도 /15',efficiency:'효율 /10'};
 return <section className="process-feedback"><h3>내 판단 과정</h3><div className="score-breakdown">{Object.entries(result.breakdown).map(([key,value])=><span key={key}>{labels[key]}<b>{String(value)}</b></span>)}</div><ul>{result.feedback.map((text:string)=><li key={text}>{text}</li>)}</ul><p><b>더 안전했던 경로</b> {gameCase.training.optimalSources.map(source=>sourceLabels[source]).join(' → ')} → {gameCase.training.appropriateActions.map(action=>actionLabels[action]).join(' 또는 ')}</p><blockquote>{gameCase.training.takeaway}</blockquote></section>;
}
export type PracticeRecord={caseId:string;changed:boolean;correct:boolean;northStar:boolean};
export function BranchPractice({gameCase,firstPicked,onFinish,onClose}: {gameCase:CaseData;firstPicked:Verdict;onFinish:(record:PracticeRecord)=>void;onClose:()=>void}) {
 const [found,setFound]=useState<string[]>([]),[selected,setSelected]=useState<string[]>([]);
 const [picked,setPicked]=useState<Verdict|null>(null),[action,setAction]=useState<TrainingAction|null>(null);
 const [confidence,setConfidence]=useState(50),[assessment,setAssessment]=useState<ReturnType<typeof evaluateDecision>|null>(null);
 const submit=()=>{if(!picked||!action||assessment)return;const result=evaluateDecision(gameCase,{picked,action,confidence,selectedEvidence:selected,evidence:found,history:gameCase.training.evidence.filter(clue=>found.includes(clue.text)).map(clue=>({source:clue.source})),riskBeforeEvidence:false});setAssessment(result);onFinish({caseId:gameCase.id,changed:picked!==firstPicked,correct:result.correct,northStar:result.northStar});};
 return <div className="modal-backdrop practice-backdrop" role="dialog" aria-modal="true" aria-labelledby="practice-title"><section className="debrief practice-panel"><header><h2 id="practice-title">핵심 분기 재훈련</h2><button onClick={onClose} aria-label="재훈련 닫기">×</button></header><p>연락을 받은 뒤 어떤 주장부터 확인할까요? 최초 점수와 하루 진행은 바뀌지 않습니다. Gemini도 호출하지 않습니다.</p>
 {assessment?<><ProcessFeedback gameCase={gameCase} result={assessment}/><button onClick={onClose}>복기로 돌아가기</button></>:<><ClaimsPanel gameCase={gameCase} evidence={found} verify={source=>setFound(current=>[...new Set([...current,gameCase.checks[source]??''])].filter(Boolean))}/>
 {found.map(text=><label className="practice-evidence" key={text}><input type="checkbox" checked={selected.includes(text)} onChange={()=>setSelected(current=>current.includes(text)?current.filter(item=>item!==text):[...current,text])}/>{text}</label>)}
 <label>판별<select value={picked??''} onChange={event=>setPicked(event.target.value as Verdict)}><option value="" disabled>선택하세요</option>{Object.entries(verdictLabels).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label>
 <label>대응<select value={action??''} onChange={event=>setAction(event.target.value as TrainingAction)}><option value="" disabled>선택하세요</option>{Object.entries(actionLabels).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label>
 <label>확신도<select value={confidence} onChange={event=>setConfidence(Number(event.target.value))}>{[50,70,90].map(value=><option key={value} value={value}>{value}%</option>)}</select></label><button disabled={!picked||!action} onClick={submit}>다시 판단하기</button></>}</section></div>;
}
export function EvidenceRewind({gameCase,evidence,history,arrival,clock}: {gameCase:CaseData;evidence:string[];history:{source:LocationId;minuteOffset:number}[];arrival:number;clock:(minutes:number)=>string}) {
 return <section className="evidence-rewind"><h3>지나친 단서와 판단의 갈림길</h3><ol>{[...gameCase.training.evidence].sort((a,b)=>(history.find(event=>event.source===a.source)?.minuteOffset??a.availableAt)-(history.find(event=>event.source===b.source)?.minuteOffset??b.availableAt)).map(clue=>{const event=history.find(event=>event.source===clue.source);return <li key={clue.id} className={evidence.includes(clue.text)?'completed':'missed'}><time>{clock(arrival+(event?.minuteOffset??clue.availableAt))}</time><b>{evidence.includes(clue.text)?'확인함':'이때 확인할 수 있었음'} · {EVIDENCE_KINDS[clue.kind]}</b><p>{clue.text}</p><small>{clue.explanation}</small></li>;})}</ol></section>;
}
