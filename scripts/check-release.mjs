import { readFile } from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const generatedFile = path.join(root, 'content', 'generated', 'cases.json');
const clientFile = path.join(root, 'app', 'game-client.tsx');
const loadingFile = path.join(root, 'app', 'game-loading.tsx');
const appIconFile = path.join(root, 'app', 'app-icon.tsx');
const aiRouteFile = path.join(root, 'app', 'api', 'ai-chat', 'route.ts');
const aiDialogueFile = path.join(root, 'app', 'ai-dialogue.ts');
const cssFile = path.join(root, 'app', 'globals.css');
const envExampleFile = path.join(root, '.env.example');
const apiKeyGuideFile = path.join(root, 'API_KEY_MANAGEMENT.md');
const liveGeminiEvaluationFile = path.join(root, 'scripts', 'evaluate-live-gemini.mjs');

function assert(condition, message, errors) {
  if (!condition) errors.push(message);
}

async function main() {
  const [{ ARRIVAL_MINUTES, IDEAL_ACTION, advanceCaseProgress, calculateCaseScore }, cases, client, loading, appIcon, aiRoute, aiDialogue, css, envExample, apiKeyGuide, liveGeminiEvaluation] = await Promise.all([
    import('../app/game-rules.js'),
    readFile(generatedFile, 'utf8').then(JSON.parse),
    readFile(clientFile, 'utf8'),
    readFile(loadingFile, 'utf8'),
    readFile(appIconFile, 'utf8'),
    readFile(aiRouteFile, 'utf8'),
    readFile(aiDialogueFile, 'utf8'),
    readFile(cssFile, 'utf8'),
    readFile(envExampleFile, 'utf8'),
    readFile(apiKeyGuideFile, 'utf8'),
    readFile(liveGeminiEvaluationFile, 'utf8'),
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
    if (item.mode === 'chat') assert(Object.keys(item.dialogue?.fallbackByEmotion ?? {}).length === 6, `${item.id}: 감정 단계별 검수 대사가 부족합니다.`, errors);
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
  assert(!client.includes('world-screen') && !client.includes('town-map') && !client.includes('player-sprite'), '스마트폰 전용 화면에 마을 또는 캐릭터 요소가 남아 있습니다.', errors);
  assert(client.includes('function verifySource') && client.includes("verifySource('bank')") && client.includes("verifySource('library')") && client.includes("verifySource('police')"), '휴대폰 앱을 통한 독립 확인 경로가 부족합니다.', errors);
  assert(client.includes('phone-system-nav') && client.includes('앱에서 더 확인하기'), '전역 홈·판정 메뉴 또는 앱 복귀 흐름이 없습니다.', errors);
  assert(client.includes('actForIndex') && client.includes('1막 · 평범한 오전') && client.includes('3막 · 압박의 밤'), '오전·오후·밤의 3막 진행 연출이 없습니다.', errors);
  assert(client.includes('setTutorialStep(forceGuide ? 0 : null)') && client.includes('게임 방법부터 보기'), '기본 진입에서 긴 안내를 건너뛰거나 선택형 안내를 여는 흐름이 없습니다.', errors);
  assert(client.includes('isAmbientEntry') && css.includes('.phone-only-game.ambient-entry'), '첫 잠금 화면의 조용한 휴대폰 진입 연출이 없습니다.', errors);
  assert(client.includes('<h1 id="game-title">수익률 24시</h1>') && !client.includes('className="intro-disclaimer"'), '시작 화면에 게임 제목 외의 불필요한 설명이 남아 있습니다.', errors);
  assert(client.includes('showObjectiveCue') && client.includes('setShowObjectiveCue(false), 4200') && css.includes('.mission-strip.objective-toast'), '상황 변화에 따라 나타났다 사라지는 목표 안내가 없습니다.', errors);
  assert(client.includes('activeCase.sceneCues') && client.includes('ambient-notification') && client.includes('이전 선택의 여파'), '사건별 주변 알림 또는 이전 선택의 후속 연출이 없습니다.', errors);
  assert(client.includes('verificationHistory') && client.includes('case-rewind') && client.includes('사건 되감기'), '조사 순서 저장 또는 판정 후 되감기 복습이 없습니다.', errors);
  assert(client.includes('openedCues') && client.includes('seenFollowUps') && client.includes('safetySeenCount') && client.includes('!openedCases[item.id]'), '메시지·앱·후속 알림의 읽음 상태가 저장되거나 표시에서 제거되지 않습니다.', errors);
  assert(client.includes('!contactReviewed && <button className="home-notification"') && client.includes('nextSceneCue && <button'), '확인한 홈·잠금 알림을 한 건씩 이어 보여 주는 흐름이 없습니다.', errors);
  assert(client.includes('AI_REQUEST_TIMEOUT_MS = 10_000') && client.includes("setTypingPhase('paused')"), '보조 AI의 전체 대기 제한 또는 휴대폰 입력 상태 연출이 올바르지 않습니다.', errors);
  const saveSnapshot = client.match(/const snapshot: SavedProgress = \{([\s\S]*?)\n    \};/);
  assert(client.includes("const PROGRESS_SAVE_KEY = 'profit-24-progress-v1'"), '버전이 있는 진행 저장 키가 없습니다.', errors);
  assert(client.includes('readSavedProgress') && client.includes('calculateCaseScore({ correct, actionCorrect, confidence'), '저장된 판정과 점수를 다시 검증하는 복원 절차가 없습니다.', errors);
  assert(Boolean(saveSnapshot) && !saveSnapshot?.[1].includes('chats') && !saveSnapshot?.[1].includes('draft'), '자유 입력 대화가 진행 저장에 포함될 수 있습니다.', errors);
  assert(client.includes('>이어하기<') && client.includes('>새로 시작<'), '타이틀 화면에 이어하기와 새 게임 선택이 모두 없습니다.', errors);
  assert(client.includes('window.localStorage.removeItem(PROGRESS_SAVE_KEY)'), '새로운 하루를 시작할 때 진행 기록을 지우지 않습니다.', errors);
  assert(aiRoute.includes('process.env.GEMINI_API_KEY') && !aiRoute.includes('process.env.NEXT_PUBLIC_GEMINI_API_KEY'), 'Gemini 키가 서버 전용 환경 변수로 격리되지 않았습니다.', errors);
  assert(aiRoute.includes("gameCase.mode !== 'chat'") && aiRoute.includes('value.length > 4') && aiRoute.includes('invalid_turn_count') && client.includes('messages.slice(-4)') && client.includes('userTurnCount:'), '최근 4개 메시지 제한 또는 전체 대화 단계 보존이 없습니다.', errors);
  assert(aiRoute.includes("GEMINI_MODEL = 'gemini-3.5-flash-lite'") && aiRoute.includes("replyMode === 'short' ? 40 : 96") && aiRoute.includes("thinkingLevel: 'minimal'"), 'Gemini 3.5 Flash-Lite의 동적 응답 길이 또는 최소 생각 설정이 없습니다.', errors);
  assert(aiRoute.includes('PROVIDER_TIMEOUT_MS = 8_000'), 'Gemini 공급자 대기 시간이 8초로 설정되지 않았습니다.', errors);
  assert(!aiRoute.includes('temperature:') && !aiRoute.includes('topP:') && !aiRoute.includes('thinkingBudget:'), 'Gemini 3.5 Flash-Lite에서 사용하지 않는 생성 옵션이 남아 있습니다.', errors);
  assert(aiRoute.includes('SESSION_MINUTE_LIMIT = 5') && aiRoute.includes('IP_DAY_LIMIT = 120'), '서버의 기본 호출 제한이 없습니다.', errors);
  assert(aiRoute.includes("'Cache-Control': 'no-store'") && aiRoute.includes('sanitizePlayerText'), '보조 AI 응답 캐시 차단 또는 입력 정제가 없습니다.', errors);
  assert(aiDialogue.includes('[링크 제거]') && aiDialogue.includes('[전화번호 제거]') && aiDialogue.includes('validateAiReply'), '입력 개인정보 제거 또는 AI 답변 검사가 없습니다.', errors);
  assert(aiDialogue.includes('inferDialogueEmotion') && aiDialogue.includes('inferDialogueReplyMode') && aiDialogue.includes('답변 길이:') && aiDialogue.includes('감정은 말투만 바꾸며'), 'NPC 감정 또는 동적 답변 길이 규칙이 없습니다.', errors);
  assert(aiDialogue.includes('가상 허위 주장을 새로 만들어도 된다') && aiDialogue.includes('구체적인 실제 수익률') && aiDialogue.includes("topic === 'default'") && aiDialogue.includes('emotionFirst'), '사기 역할의 허위 주장 경계 또는 질문 우선 대체 대사가 없습니다.', errors);
  assert(aiDialogue.includes('8~35자') && aiDialogue.includes('35~100자') && aiDialogue.includes("replyMode === 'short' ? 55 : 140") && aiDialogue.includes('/보장|확정|무조건|100'), 'Gemini 동적 길이·보장·과장 표현 제한이 없습니다.', errors);
  assert(aiDialogue.includes("emotion === 'closed'") && aiDialogue.includes('생각이\\s*바뀌'), '연락 중단 요청 뒤 재접촉 문구 차단이 없습니다.', errors);
  assert(aiRoute.includes('validateAiReply(reply, emotion, replyMode)') && client.includes('inferDialogueReplyMode(messages)'), '서버와 브라우저가 같은 감정·길이 단계로 Gemini 답변을 검사하지 않습니다.', errors);
  assert(liveGeminiEvaluation.includes('친구·출처 질문') && liveGeminiEvaluation.includes('리딩방·말로 중단 요구') && liveGeminiEvaluation.includes("replyMode: 'short'") && liveGeminiEvaluation.includes('guardedFallbacks'), '대표 반응과 동적 길이를 점검하는 Gemini 실응답 평가가 없습니다.', errors);
  assert(envExample.includes('GEMINI_API_KEY=') && !envExample.includes('NEXT_PUBLIC_GEMINI_API_KEY='), '서버 전용 Gemini 환경 변수 예제가 올바르지 않습니다.', errors);
  assert(apiKeyGuide.includes('Sites Secret') && apiKeyGuide.includes('NEXT_PUBLIC_GEMINI_API_KEY') && apiKeyGuide.includes('키가 유출됐을 때'), 'API 키 등록·노출 방지·교체 안내가 부족합니다.', errors);
  assert(loading.includes('role="progressbar"') && loading.includes('aria-valuenow={safeProgress}'), '전체 화면 로딩 진행률의 접근성 정보가 없습니다.', errors);
  assert(loading.includes('aria-busy="true"') && loading.includes('role="status"'), '전체 화면 로딩 상태가 화면 읽기 도구에 전달되지 않습니다.', errors);
  assert(loading.includes('loading-device-status') && loading.includes('loading-message-preview') && loading.includes('loading-device-gesture') && loading.includes('native-loading-spinner'), '전체 화면 로딩이 휴대폰 앱 실행·알림 수신 화면으로 구성되지 않았습니다.', errors);
  assert(!loading.includes('loading-steps') && !loading.includes('detail: string') && !loading.includes('준비 단계'), '로딩 화면에 내부 처리 단계 설명이 노출될 수 있습니다.', errors);
  assert(client.includes("import AppIcon from './app-icon'") && loading.includes("import AppIcon from './app-icon'"), '홈 화면과 로딩 화면이 공통 앱 아이콘을 사용하지 않습니다.', errors);
  assert(['messages', 'calls', 'bank', 'stocks', 'browser', 'social', 'calendar', 'notes', 'contacts', 'safety', 'settings', 'photos'].every((name) => appIcon.includes(`case '${name}'`)), '앱 기능별 벡터 아이콘이 모두 구현되지 않았습니다.', errors);
  assert(appIcon.includes('<svg') && appIcon.includes('strokeLinecap="round"') && css.includes('.app-icon svg, .mini-icon svg'), '확대 가능한 벡터 아이콘 또는 크기별 표시 규칙이 없습니다.', errors);
  assert(css.includes('@keyframes phoneTyping') && css.includes('.message-typing-indicator'), '메신저 입력 중 말풍선 애니메이션이 없습니다.', errors);
  assert(client.includes('aria-labelledby="debrief-title"'), '판정 결과 대화상자에 접근 가능한 제목이 없습니다.', errors);
  assert(client.includes('aria-labelledby="summary-title"'), '최종 결과 대화상자에 접근 가능한 제목이 없습니다.', errors);
  assert(!client.includes('role="button" tabIndex={0}'), '키보드 실행 처리가 없는 가상 버튼이 남아 있습니다.', errors);
  assert(css.includes(':focus-visible'), '키보드 초점 표시 규칙이 없습니다.', errors);
  assert(css.includes('prefers-reduced-motion'), '동작 감소 접근성 규칙이 없습니다.', errors);
  assert(css.includes('.game-loading-screen') && css.includes('.message-typing-indicator'), '전체 화면과 메신저 응답 대기 스타일이 없습니다.', errors);
  assert(css.includes('.chapter-card') && css.includes('.ambient-notification') && css.includes('.case-rewind'), '3막·주변 알림·사건 되감기 스타일이 없습니다.', errors);
  assert(css.includes('@media (max-width: 680px)') && css.includes('@media (max-width: 430px)'), '모바일 대응 구간이 부족합니다.', errors);
  assert(css.includes('overflow-wrap: anywhere'), '긴 한글 문구와 가상 주소의 화면 이탈 방어가 없습니다.', errors);
  assert(client.includes('phone-home-content') && css.includes('overscroll-behavior: contain') && css.includes('.phone-home-screen .phone-dock'), '홈 화면 콘텐츠 스크롤과 고정 독 분리가 없습니다.', errors);
  assert(css.includes('.phone-only-game:not(.ambient-entry)') && css.includes('height: 100dvh'), '게임 화면이 브라우저 뷰포트에 고정되지 않습니다.', errors);
  assert(client.includes('start-menu') && client.includes('이어하기') && client.includes('새로 시작') && client.includes('showStartSettings'), '첫 화면의 이어하기·새 게임·설정 메뉴가 없습니다.', errors);
  assert(client.includes('confirmNewGame') && client.includes('PREFERENCES_KEY') && css.includes('.start-setting-list'), '새 게임 확인 또는 시작 설정 저장이 없습니다.', errors);
  assert(client.includes('followUpCue') && client.includes('habitBadges') && css.includes('.habit-badges') && css.includes('.summary-badges'), '선택 결과 후속 알림 또는 안전 습관 배지가 없습니다.', errors);
  assert(client.includes('showPauseMenu') && client.includes('returnToMainMenu') && client.includes('저장하고 메인 메뉴로'), '게임 중 메뉴 또는 즉시 저장 후 메인 화면 복귀가 없습니다.', errors);
  assert(css.includes('.game-menu-button') && css.includes('.pause-menu-backdrop') && css.includes('.pause-progress'), '게임 중 메뉴의 화면 스타일이 없습니다.', errors);
  assert(client.includes('SCENE_GAP_MS') && client.includes('nextSceneCue') && client.includes('seenSceneCues'), '사건별 순차 앱 흔적 또는 확인 상태 저장이 없습니다.', errors);
  assert(client.includes('incoming-call-screen') && client.includes('bank-interruption-banner') && client.includes('message-status-event'), '수신 전화·은행 겹침·메시지 상태 변화 연출이 없습니다.', errors);
  assert(client.includes('blockActiveContact') && client.includes('blockedContacts') && client.includes('차단한 연락처입니다'), '휴대폰에서 직접 연락처를 차단하는 기능이 없습니다.', errors);
  assert(aiDialogue.includes('실제 차단되기 전') && aiDialogue.includes('신체 위해') && aiDialogue.includes('/죽|해코지|찾아가'), '차단 전 회유 또는 위험한 협박 차단 규칙이 없습니다.', errors);
  assert(client.includes('playPhoneFeedback') && client.includes('navigator.vibrate') && client.includes('soundEnabled') && client.includes('vibrationEnabled'), '선택 가능한 휴대폰 알림음·진동이 없습니다.', errors);
  assert(aiDialogue.includes('fallbackByEmotion[emotion]'), 'Gemini 실패 시 동일 감정 단계의 검수 대사를 사용하지 않습니다.', errors);
  assert(client.includes('anyRiskExposure') && cases.some((item) => item.sceneCues.some((cue) => cue.condition === 'any-risk-exposure')), '플레이어 행동에 따른 조건부 후속 연락이 없습니다.', errors);
  assert(client.includes('rewindScenes') && client.includes('도착했지만 확인하지 않은 앱 알림') && css.includes('.scene-rewind'), '사건 되감기에 앱 흔적과 놓친 알림 복기가 없습니다.', errors);

  if (errors.length) throw new Error(`출시 전 자동 점검 실패:\n- ${errors.join('\n- ')}`);
  console.log(`출시 전 자동 점검 완료: ${cases.length}개 사건 순차 진행 · 읽음 처리 · 자동 저장 · 로딩 전환 · 점수 · Gemini 서버 격리 · 키보드 · 모바일 · 콘텐츠 안전`);
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
