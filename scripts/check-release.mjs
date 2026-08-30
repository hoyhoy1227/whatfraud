import { readFile } from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const generatedFile = path.join(root, 'content', 'generated', 'cases.json');
const clientFile = path.join(root, 'app', 'game-client.tsx');
const cssFile = path.join(root, 'app', 'globals.css');

function assert(condition, message, errors) {
  if (!condition) errors.push(message);
}

async function main() {
  const [{ ARRIVAL_MINUTES, IDEAL_ACTION, advanceCaseProgress, calculateCaseScore }, cases, client, css] = await Promise.all([
    import('../app/game-rules.js'),
    readFile(generatedFile, 'utf8').then(JSON.parse),
    readFile(clientFile, 'utf8'),
    readFile(cssFile, 'utf8'),
  ]);
  const errors = [];
  const expectedOrder = [
    'official-etf-fill', 'friend-hot-tip', 'vip-research-room', 'bank-fraud-check',
    'paid-market-class', 'fixed-match-ai', 'recovery-team', 'official-maintenance',
  ];

  assert(cases.length === 8, '출시판에는 정확히 8개 사건이 필요합니다.', errors);
  assert(JSON.stringify(cases.map((item) => item.id)) === JSON.stringify(expectedOrder), '사건 도착 순서가 승인된 8단계 순서와 다릅니다.', errors);
  assert(ARRIVAL_MINUTES.length === cases.length, '사건별 도착 시간이 부족합니다.', errors);
  assert(ARRIVAL_MINUTES.every((value, index) => index === 0 || value > ARRIVAL_MINUTES[index - 1]), '사건 도착 시간은 계속 증가해야 합니다.', errors);

  let progress = { activeIndex: 0, availableCount: 1 };
  for (let resultCount = 1; resultCount <= cases.length; resultCount += 1) {
    const next = advanceCaseProgress({ ...progress, resultCount, totalCases: cases.length });
    if (resultCount < cases.length) {
      assert(next.unlocked, `${resultCount}번 판정 뒤 다음 사건이 한 건만 해금되지 않습니다.`, errors);
      assert(next.availableCount === resultCount + 1, `${resultCount}번 판정 뒤 미래 사건이 한꺼번에 해금됩니다.`, errors);
    } else {
      assert(next.complete && !next.unlocked, '마지막 사건 뒤 종료 상태가 되지 않습니다.', errors);
    }
    progress = next;
  }

  assert(calculateCaseScore({ correct: true, actionCorrect: true, confidence: 90, evidenceCount: 2 }) === 210, '최고 확신 정답 점수 계산이 변경됐습니다.', errors);
  assert(calculateCaseScore({ correct: false, actionCorrect: false, confidence: 90, evidenceCount: 0 }) === -90, '오답 위험 점수 계산이 변경됐습니다.', errors);
  assert(Object.keys(IDEAL_ACTION).sort().join(',') === 'caution,normal,scam', '판정별 안전 행동 연결이 부족합니다.', errors);

  for (const item of cases) {
    assert(Object.keys(item.checks).length >= 2, `${item.id}: 독립 조사 경로가 2개 미만입니다.`, errors);
    assert(item.review?.verificationPaths.length >= 2, `${item.id}: 콘텐츠 검수 경로가 2개 미만입니다.`, errors);
    assert(item.review?.learningObjectives.length >= 2, `${item.id}: 학습 목표가 2개 미만입니다.`, errors);
    assert(item.review && Object.values(item.review.safetyAudit).every((value) => value === false), `${item.id}: 안전 검수표를 통과하지 못했습니다.`, errors);
    if (item.mode !== 'chat') assert(!item.dialogue && !item.fallbackReplies, `${item.id}: 읽기 전용 연락이 Qwen 데이터를 포함합니다.`, errors);
    if (item.mode === 'link') assert(item.displayUrl.includes('.invalid'), `${item.id}: 링크가 가상 도메인이 아닙니다.`, errors);
  }

  assert(client.includes("if (gameCase.mode !== 'chat'"), '읽기 전용 연락의 Qwen 호출 차단이 없습니다.', errors);
  assert(client.includes('aria-live="polite"'), '대화와 조사 결과의 화면 읽기 알림이 없습니다.', errors);
  assert(client.includes('aria-labelledby="debrief-title"'), '판정 결과 대화상자에 접근 가능한 제목이 없습니다.', errors);
  assert(client.includes('aria-labelledby="summary-title"'), '최종 결과 대화상자에 접근 가능한 제목이 없습니다.', errors);
  assert(!client.includes('role="button" tabIndex={0}'), '키보드 실행 처리가 없는 가상 버튼이 남아 있습니다.', errors);
  assert(css.includes(':focus-visible'), '키보드 초점 표시 규칙이 없습니다.', errors);
  assert(css.includes('prefers-reduced-motion'), '동작 감소 접근성 규칙이 없습니다.', errors);
  assert(css.includes('@media (max-width: 680px)') && css.includes('@media (max-width: 430px)'), '모바일 대응 구간이 부족합니다.', errors);
  assert(css.includes('overflow-wrap: anywhere'), '긴 한글 문구와 가상 주소의 화면 이탈 방어가 없습니다.', errors);

  if (errors.length) throw new Error(`출시 전 자동 점검 실패:\n- ${errors.join('\n- ')}`);
  console.log(`출시 전 자동 점검 완료: 8개 사건 순차 진행 · 점수 · Qwen 격리 · 키보드 · 모바일 · 콘텐츠 안전`);
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
