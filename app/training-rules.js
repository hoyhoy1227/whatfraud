export const TRAINING_VERSION = 2;
export const EVIDENCE_KINDS = { decisive: '확인 증거', signal: '의심 신호', neutral: '중립 정보', misleading: '오해하기 쉬운 정보' };

export function evaluateDecision(gameCase, decision) {
  const profile = gameCase.training;
  const found = new Set(decision.evidence ?? []);
  const selected = new Set((decision.selectedEvidence ?? []).filter(text => found.has(text)));
  const selectedClues = profile.evidence.filter(clue => selected.has(clue.text));
  const correct = decision.picked === gameCase.verdict;
  const actionCorrect = profile.appropriateActions.includes(decision.action);
  const keyClues = profile.evidence.filter(clue => clue.key);
  const supported = selectedClues.filter(clue => clue.key && clue.supports.includes(decision.picked));
  const irrelevant = selectedClues.filter(clue => !clue.supports.includes(decision.picked));
  const evidenceScore = Math.max(0, Math.round(30 * supported.length / keyClues.length) - irrelevant.length * 4);
  const keyCount = selectedClues.filter(clue => clue.key).length;
  const confidence = [50,70,90].includes(decision.confidence) ? decision.confidence : 50;
  const probability = confidence / 100;
  const calibration = Math.round(15 * (1 - (probability - Number(correct)) ** 2));
  const sources = new Set((decision.history ?? []).map(event => event.source));
  const efficient = keyCount === keyClues.length && !decision.riskBeforeEvidence && sources.size <= profile.optimalSources.length;
  const breakdown = { verdict: correct ? 25 : 0, evidence: evidenceScore, action: actionCorrect ? 20 : 0, confidence: calibration, efficiency: efficient ? 10 : 0 };
  const feedback = [
    correct ? '판별은 맞았습니다.' : '판별을 다시 검토해 보세요.',
    supported.length === keyClues.length ? '선택한 핵심 근거가 결론을 뒷받침합니다.' : '선택한 근거만으로 결론을 충분히 뒷받침하지 못했습니다.',
    ...(selectedClues.some(clue => clue.key && !clue.supports.includes(decision.picked)) ? ['선택한 독립 기록과 내 결론이 서로 모순됩니다.'] : []),
    ...(irrelevant.length ? ['중립 정보나 인상에 가까운 단서를 결정적 증거로 선택하지 않았는지 확인하세요.'] : []),
    actionCorrect ? '상황에 맞는 안전 행동을 선택했습니다.' : '이 사건에 더 적절한 대응을 대안 경로에서 확인하세요.',
    ...(!correct && confidence === 90 ? ['90% 확신한 오답입니다. 놓친 반대 단서를 먼저 확인해 보세요.'] : []),
    ...(decision.riskBeforeEvidence ? ['핵심 확인 전 링크를 열었습니다. 다음에는 확인 순서를 바꿔 보세요.'] : []),
  ];
  return { correct, actionCorrect, score: Object.values(breakdown).reduce((a,b)=>a+b,0), breakdown, feedback, keyCount,
    northStar: keyCount === keyClues.length && supported.length === keyClues.length && actionCorrect };
}

export function verifiedClaims(gameCase, evidence) {
  const found = new Set(evidence);
  return [...new Set(gameCase.training.evidence.filter(clue => found.has(clue.text)).flatMap(clue => clue.claimIds))];
}

export function hadEarlyRisk(gameCase, history, risks) {
  return (risks ?? []).some(risk => risk.kind === 'link' && gameCase.training.evidence.filter(clue =>
    clue.key && history.some(event => event.source === clue.source && event.evidence === clue.text && event.minuteOffset < risk.minuteOffset)
  ).length < gameCase.training.optimalSources.length);
}

export function deriveDayState(results, cases, openedLinks) {
  return {
    exposed: cases.some(c => c.verdict !== 'normal' && openedLinks[c.id]) || results.some(r => r.exposed),
    verificationHabit: results.filter(r => r.northStar).length,
    impulsive: results.some(r => r.riskBeforeEvidence || (!r.correct && r.confidence === 90)),
    reported: results.some(r => r.action === 'report'),
  };
}

export function summarizeTraining(results, cases, practice = []) {
  const percent = count => results.length ? Math.round(count / results.length * 100) : 0;
  return {
    firstAccuracy: percent(results.filter(r=>r.correct).length),
    groundedSafety: percent(results.filter(r=>r.northStar).length),
    keyCoverage: percent(results.filter(r=>r.keyCount >= 2).length),
    noEvidence: percent(results.filter(r=>r.selectedEvidence.length === 0).length),
    overconfidentErrors: percent(results.filter(r=>!r.correct && r.confidence === 90).length),
    safeActions: percent(results.filter(r=>r.actionCorrect).length),
    changedAfterReview: practice.length ? Math.round(practice.filter(p=>p.changed).length/practice.length*100) : 0,
    weaknesses: [...new Set(results.filter(r=>!r.northStar).map(r=>cases.find(c=>c.id===r.caseId)?.training.weakness).filter(Boolean))],
  };
}

export function replayCases(cases, round) {
  return cases.map(c => round % 2 ? { ...c, sender: c.training.variant.sender, preview: c.training.variant.preview } : c);
}
