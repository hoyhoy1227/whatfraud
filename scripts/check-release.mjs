import { readFile } from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const generatedFile = path.join(root, 'content', 'generated', 'cases.json');
const clientFile = path.join(root, 'app', 'game-client.tsx');
const loadingFile = path.join(root, 'app', 'game-loading.tsx');
const browserQwenFile = path.join(root, 'app', 'browser-qwen.ts');
const aiRouteFile = path.join(root, 'app', 'api', 'ai-chat', 'route.ts');
const aiDialogueFile = path.join(root, 'app', 'ai-dialogue.ts');
const cssFile = path.join(root, 'app', 'globals.css');
const trainingBuilderFile = path.join(root, 'training', 'build_dataset.py');
const trainingTrainerFile = path.join(root, 'training', 'train_lora.py');
const trainingReadmeFile = path.join(root, 'training', 'README.md');
const gitignoreFile = path.join(root, '.gitignore');
const envExampleFile = path.join(root, '.env.example');
const apiKeyGuideFile = path.join(root, 'API_KEY_MANAGEMENT.md');

function assert(condition, message, errors) {
  if (!condition) errors.push(message);
}

async function main() {
  const [{ ARRIVAL_MINUTES, IDEAL_ACTION, advanceCaseProgress, calculateCaseScore }, cases, client, loading, browserQwen, aiRoute, aiDialogue, css, trainingBuilder, trainingTrainer, trainingReadme, gitignore, envExample, apiKeyGuide] = await Promise.all([
    import('../app/game-rules.js'),
    readFile(generatedFile, 'utf8').then(JSON.parse),
    readFile(clientFile, 'utf8'),
    readFile(loadingFile, 'utf8'),
    readFile(browserQwenFile, 'utf8'),
    readFile(aiRouteFile, 'utf8'),
    readFile(aiDialogueFile, 'utf8'),
    readFile(cssFile, 'utf8'),
    readFile(trainingBuilderFile, 'utf8'),
    readFile(trainingTrainerFile, 'utf8'),
    readFile(trainingReadmeFile, 'utf8'),
    readFile(gitignoreFile, 'utf8'),
    readFile(envExampleFile, 'utf8'),
    readFile(apiKeyGuideFile, 'utf8'),
  ]);
  const errors = [];
  const expectedOrder = [
    'official-etf-fill', 'friend-hot-tip', 'vip-research-room', 'bank-fraud-check',
    'paid-market-class', 'fixed-match-ai', 'recovery-team', 'official-maintenance',
    'official-ipo-calendar', 'ai-celebrity-room', 'overseas-preipo-agent', 'worldcup-betting-bonus',
  ];

  assert(cases.length === 12, '출시판에는 정확히 12개 사건이 필요합니다.', errors);
  assert(JSON.stringify(cases.map((item) => item.id)) === JSON.stringify(expectedOrder), '사건 도착 순서가 승인된 12단계 순서와 다릅니다.', errors);
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
    if (item.mode !== 'chat') assert(!item.dialogue && !item.fallbackReplies, `${item.id}: 읽기 전용 연락이 보조 AI 데이터를 포함합니다.`, errors);
    if (item.mode === 'link') assert(item.displayUrl.includes('.invalid'), `${item.id}: 링크가 가상 도메인이 아닙니다.`, errors);
  }

  const verdictCounts = Object.groupBy(cases, (item) => item.verdict);
  assert((verdictCounts.normal?.length ?? 0) >= 3 && (verdictCounts.caution?.length ?? 0) >= 2 && (verdictCounts.scam?.length ?? 0) >= 4, '정상·주의·사기 사건의 혼합 비율이 부족합니다.', errors);
  assert(cases.some((item) => item.id === 'overseas-preipo-agent') && cases.some((item) => item.id === 'worldcup-betting-bonus'), '최신 투자·도박 피해 유형 사건이 누락됐습니다.', errors);

  assert(client.includes("if (gameCase.mode !== 'chat'"), '읽기 전용 연락의 보조 AI 호출 차단이 없습니다.', errors);
  assert(client.includes("fetch('/api/ai-chat'"), '클라이언트가 서버 보조 AI 경로를 사용하지 않습니다.', errors);
  assert(client.includes('aria-live="polite"'), '대화와 조사 결과의 화면 읽기 알림이 없습니다.', errors);
  assert(client.includes('aria-busy={sending}'), '보조 AI 응답 대기 상태가 보조 기술에 전달되지 않습니다.', errors);
  assert(client.includes("kind: 'startup'") && client.includes("kind: 'case'"), '시작·사건 전환 로딩 상태가 모두 구현되지 않았습니다.', errors);
  assert(client.includes('await Promise.all(startupAssets.map'), '시작 화면이 실제 시각 자산 준비와 연결되지 않았습니다.', errors);
  assert(client.includes('aiWaitMs >= 6000'), '보조 AI 지연 시 후보 대사 준비 안내가 없습니다.', errors);
  const saveSnapshot = client.match(/const snapshot: SavedProgress = \{([\s\S]*?)\n    \};/);
  assert(client.includes("const PROGRESS_SAVE_KEY = 'profit-24-progress-v1'"), '버전이 있는 진행 저장 키가 없습니다.', errors);
  assert(client.includes('readSavedProgress') && client.includes('calculateCaseScore({ correct, actionCorrect, confidence'), '저장된 판정과 점수를 다시 검증하는 복원 절차가 없습니다.', errors);
  assert(Boolean(saveSnapshot) && !saveSnapshot?.[1].includes('chats') && !saveSnapshot?.[1].includes('draft'), '자유 입력 대화가 진행 저장에 포함될 수 있습니다.', errors);
  assert(client.includes('저장한 게임 이어하기') && client.includes('처음부터 새로 시작'), '타이틀 화면에 이어하기와 새 게임 선택이 모두 없습니다.', errors);
  assert(client.includes('window.localStorage.removeItem(PROGRESS_SAVE_KEY)'), '새로운 하루를 시작할 때 진행 기록을 지우지 않습니다.', errors);
  assert(browserQwen.includes('NEXT_PUBLIC_QWEN_MODEL_ID') && browserQwen.includes('DEFAULT_MODEL_ID'), '튜닝한 브라우저 모델을 안전하게 교체할 설정이 없습니다.', errors);
  assert(aiRoute.includes('process.env.GEMINI_API_KEY') && !aiRoute.includes('process.env.NEXT_PUBLIC_GEMINI_API_KEY'), 'Gemini 키가 서버 전용 환경 변수로 격리되지 않았습니다.', errors);
  assert(aiRoute.includes("gameCase.mode !== 'chat'") && aiRoute.includes('value.length > 6'), '서버의 대화형 사건 또는 최근 메시지 제한이 없습니다.', errors);
  assert(aiRoute.includes("GEMINI_MODEL = 'gemini-3.6-flash'") && aiRoute.includes('maxOutputTokens: 120') && aiRoute.includes("thinkingLevel: 'minimal'"), 'Gemini 3.6 Flash의 짧은 응답 설정이 고정되지 않았습니다.', errors);
  assert(!aiRoute.includes('temperature:') && !aiRoute.includes('topP:') && !aiRoute.includes('thinkingBudget:'), 'Gemini 3.6 Flash에서 폐기된 생성 옵션이 남아 있습니다.', errors);
  assert(aiRoute.includes('SESSION_MINUTE_LIMIT = 5') && aiRoute.includes('IP_DAY_LIMIT = 120'), '서버의 기본 호출 제한이 없습니다.', errors);
  assert(aiRoute.includes("'Cache-Control': 'no-store'") && aiRoute.includes('sanitizePlayerText'), '보조 AI 응답 캐시 차단 또는 입력 정제가 없습니다.', errors);
  assert(aiDialogue.includes('[링크 제거]') && aiDialogue.includes('[전화번호 제거]') && aiDialogue.includes('validateAiReply'), '입력 개인정보 제거 또는 AI 답변 검사가 없습니다.', errors);
  assert(envExample.includes('GEMINI_API_KEY=') && !envExample.includes('NEXT_PUBLIC_GEMINI_API_KEY='), '서버 전용 Gemini 환경 변수 예제가 올바르지 않습니다.', errors);
  assert(apiKeyGuide.includes('Sites Secret') && apiKeyGuide.includes('NEXT_PUBLIC_GEMINI_API_KEY') && apiKeyGuide.includes('키가 유출됐을 때'), 'API 키 등록·노출 방지·교체 안내가 부족합니다.', errors);
  assert(trainingBuilder.includes('contains_player_messages') && trainingBuilder.includes('case.get("mode") == "chat"'), '튜닝 데이터의 대화형 사건 제한 또는 개인정보 비저장 표기가 없습니다.', errors);
  assert(trainingTrainer.includes('LoraConfig') && trainingTrainer.includes('DataCollatorForSeq2Seq'), '로컬 LoRA 학습 파이프라인이 없습니다.', errors);
  assert(trainingReadme.includes('training/output/') && trainingReadme.includes('dialogue:qwen:evaluate'), '튜닝 산출물 격리와 배포 전 평가 안내가 부족합니다.', errors);
  assert(gitignore.includes('/training/output/') && gitignore.includes('*.gguf') && gitignore.includes('*.safetensors'), '모델 가중치와 튜닝 산출물의 Git 제외 규칙이 부족합니다.', errors);
  assert(loading.includes('role="progressbar"') && loading.includes('aria-valuenow={safeProgress}'), '전체 화면 로딩 진행률의 접근성 정보가 없습니다.', errors);
  assert(loading.includes('aria-busy="true"') && loading.includes('role="status"'), '전체 화면 로딩 상태가 화면 읽기 도구에 전달되지 않습니다.', errors);
  assert(client.includes('aria-labelledby="debrief-title"'), '판정 결과 대화상자에 접근 가능한 제목이 없습니다.', errors);
  assert(client.includes('aria-labelledby="summary-title"'), '최종 결과 대화상자에 접근 가능한 제목이 없습니다.', errors);
  assert(!client.includes('role="button" tabIndex={0}'), '키보드 실행 처리가 없는 가상 버튼이 남아 있습니다.', errors);
  assert(css.includes(':focus-visible'), '키보드 초점 표시 규칙이 없습니다.', errors);
  assert(css.includes('prefers-reduced-motion'), '동작 감소 접근성 규칙이 없습니다.', errors);
  assert(css.includes('.game-loading-screen') && css.includes('.ai-wait-card'), '전체 화면과 보조 AI 부분 로딩 스타일이 없습니다.', errors);
  assert(css.includes('@media (max-width: 680px)') && css.includes('@media (max-width: 430px)'), '모바일 대응 구간이 부족합니다.', errors);
  assert(css.includes('overflow-wrap: anywhere'), '긴 한글 문구와 가상 주소의 화면 이탈 방어가 없습니다.', errors);

  if (errors.length) throw new Error(`출시 전 자동 점검 실패:\n- ${errors.join('\n- ')}`);
  console.log(`출시 전 자동 점검 완료: ${cases.length}개 사건 순차 진행 · 자동 저장 · 로딩 전환 · 점수 · Gemini 서버 격리 · 키보드 · 모바일 · 콘텐츠 안전`);
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
