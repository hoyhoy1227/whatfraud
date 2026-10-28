import {buildResponseReport,reportSources} from './response-report.js';
import {money} from './engine';
type Run=ReturnType<typeof import('./engine').createRun>;
export default function ResponseReport({state}:{state:Run}){
 const report=buildResponseReport(state);
 return <section className="response-report" aria-label="사기 대응 분석 보고서">
  <header className="report-cover"><span className="report-emblem" aria-hidden="true">✓</span><span className="eyebrow">사기방지위원회 · 분석 완료</span><h1>당신의 선택이<br/>남긴 대응 보고서</h1><p>지금까지 사기방지위원회에서 진행한 사기 대응 분석 테스트였습니다.</p><p>익숙한 연락, 수익의 약속, 피해 회복 제안 앞에서 당신이 무엇을 확인하고 어떻게 행동했는지 돌아봅니다.</p><small>게임 속 가상 위원회입니다. 실제 공공기관의 검사·인증이나 개인의 사기 취약성 진단이 아닙니다.</small></header>
  <div className="report-metrics"><article><b>{report.protectedCases} / {report.cases.length}</b><span>송금하지 않은 사건</span></article><article><b>{report.groundedCases} / {report.cases.length}</b><span>핵심 확인 후 송금 없이 종료</span></article></div>
  <p className="report-summary">당신은 {report.cases.length}개의 사건을 마쳤습니다. 게임 내 총 출금은 {money(report.spent)}입니다. 송금 여부뿐 아니라 확인 순서와 대화에서 정한 경계가 실제 행동으로 이어졌는지도 살펴봤습니다.</p>
  {state.mode==='demo'&&<p className="report-limits">짧은 체험에서 완료한 사건만 분석했습니다. 플레이하지 않은 사건은 평가하지 않습니다.</p>}
  {report.cases.map(item=><article className="report-case" key={item.index}><small>사건 {item.index+1}</small><h2>{item.title}</h2><p className="report-choice">당신의 선택 · <strong>{item.choice}</strong><br/>게임 내 출금 · {money(item.spent)}</p>
   {item.strengths.length>0&&<section className="report-strength"><h3>잘한 대응</h3><ul>{item.strengths.map(text=><li key={text}>{text}</li>)}</ul></section>}
   <section className="report-caution"><h3>{item.cautions.length?'다음에 더 조심할 부분':'계속 유지할 대응 원칙'}</h3>{item.cautions.length>0&&<ul>{item.cautions.map(text=><li key={text}>{text}</li>)}</ul>}<p>{item.advice}</p></section>
   <details><summary>내 선택·대화·확인 기록</summary><h3>선택한 답장</h3>{item.choices.length?item.choices.map((text,i)=><blockquote key={i}>{text}</blockquote>):<p>선택 답장 기록이 없습니다.</p>}<h3>대화와 첨부가 남긴 방향</h3>{item.dialogue.length?item.dialogue.map(text=><p key={text}>{text}</p>):<p>분석할 대화 분기·첨부 기록이 없습니다.</p>}<h3>직접 확인한 기록</h3>{item.checked.length?<ul>{item.checked.map(text=><li key={text}>{text}</li>)}</ul>:<p>직접 열어 본 증거 기록이 없습니다.</p>}</details>
  </article>)}
  <section className="report-help"><h2>현실에서 비슷한 일이 생긴다면</h2><ol><li>추가 송금과 개인정보 전달을 중단하세요. 상대가 제공한 연락처 대신 직접 찾은 공식 경로를 이용하세요.</li><li>실제 보이스피싱으로 돈을 보냈다면 즉시 112 또는 해당 금융회사에 피해를 알리고 지급정지를 요청하세요. 적용 여부와 피해구제 절차는 사건 유형에 따라 다르며 환급은 보장되지 않습니다.</li><li>대화, 상대 계정, 거래 내역을 보존하세요. 일반 사이버사기는 경찰청 ECRM에서 신고 절차를 확인할 수 있습니다. 긴급 상황은 온라인 접수를 기다리지 말고 112로 신고하세요.</li></ol><p>피해의 책임은 속인 사람에게 있습니다. 이 보고서는 당신을 탓하거나 안전을 보증하기 위한 평가가 아니라, 다음 행동을 구체적으로 준비하는 기록입니다.</p><nav aria-label="공식 대응 참고 자료">{reportSources.map(source=><a key={source.url} href={source.url} target="_blank" rel="noopener noreferrer">{source.name} ↗</a>)}</nav></section>
  <p className="report-limits">분석 범위: 저장된 게임 행동·선택 답장·첨부 및 대화 분기. 자유 답변의 의도 분류는 AI가 잘못 해석할 수 있어 행동 사실과 구분했습니다. 자유 입력·AI 답장 원문은 저장하거나 재분석하지 않습니다. 실제 신고·지급정지는 수행하지 않습니다. 참고 안내 확인: 2026-09-19.</p>
 </section>;
}
