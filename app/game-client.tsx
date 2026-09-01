'use client';

import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { CaseData, cases, DialogueTopic, LocationId, locations, Verdict, verdictLabels } from './game-data';
import { validateAiReply } from './ai-dialogue';
import { ARRIVAL_MINUTES, IDEAL_ACTION, advanceCaseProgress, calculateCaseScore, formatGameClock } from './game-rules';
import GameLoadingScreen from './game-loading';

type ChatMessage = { role: 'user' | 'assistant'; content: string };
type ResponseAction = 'verify' | 'pause' | 'block';
type Result = {
  caseId: string;
  correct: boolean;
  actionCorrect: boolean;
  score: number;
  picked: Verdict;
  confidence: number;
  action: ResponseAction;
  selectedEvidence: string[];
};
type ModelState = 'unchecked' | 'checking' | 'connected' | 'fallback';
type GameView = 'world' | 'phone';
type PhoneApp = 'home' | 'messages' | 'calls' | 'bank' | 'stocks' | 'browser' | 'social' | 'calendar' | 'notes' | 'contacts' | 'safety' | 'settings' | 'photos';
type AppId = Exclude<PhoneApp, 'home'>;
type TutorialKind = 'controls' | 'interface' | 'mission' | 'places' | 'apps' | 'verdict' | 'score';
type PhoneAppDefinition = { id: AppId; label: string; icon: string; purpose: string; useWhen: string; caution: string };
type LoadingTask = { kind: 'startup' | 'case'; progress: number; title: string; detail: string };
type SavedProgress = {
  version: 1;
  savedAt: number;
  availableCount: number;
  activeIndex: number;
  location: LocationId;
  view: GameView;
  phoneApp: PhoneApp;
  phoneLocked: boolean;
  results: Result[];
  evidence: Record<string, string[]>;
  openedLinks: Record<string, boolean>;
  openedCases: Record<string, boolean>;
};

const PROGRESS_SAVE_KEY = 'profit-24-progress-v1';
const AI_REQUEST_TIMEOUT_MS = 16_000;
const AI_SLOW_NOTICE_MS = 10_000;
const verdictValues: Verdict[] = ['normal', 'caution', 'scam'];
const responseActionValues: ResponseAction[] = ['verify', 'pause', 'block'];
const gameViewValues: GameView[] = ['world', 'phone'];
const phoneAppValues: PhoneApp[] = ['home', 'messages', 'calls', 'bank', 'stocks', 'browser', 'social', 'calendar', 'notes', 'contacts', 'safety', 'settings', 'photos'];

const startupAssets = [
  '/assets/pixel/start-screen.png',
  '/assets/pixel/town-map.png',
  '/assets/pixel/player-sprites.png',
  '/assets/pixel/phone-wallpaper.png',
  '/assets/pixel/phone-app-icons.png',
];
const loadingSteps = {
  startup: ['사건 데이터 확인', '마을·휴대폰 자산 준비', '플레이 기록과 AI 경로 설정'],
  case: ['판정 기록 반영', '게임 시간 진행', '새 연락 수신'],
};

function wait(milliseconds: number) {
  return new Promise<void>((resolve) => window.setTimeout(resolve, milliseconds));
}

function preloadAsset(source: string) {
  return new Promise<void>((resolve) => {
    const image = new window.Image();
    image.onload = () => resolve();
    image.onerror = () => resolve();
    image.src = source;
  });
}

function readSavedProgress(serialized: string | null): SavedProgress | null {
  if (!serialized) return null;
  try {
    const raw = JSON.parse(serialized) as Partial<SavedProgress>;
    if (raw.version !== 1 || !Array.isArray(raw.results) || !Number.isFinite(raw.savedAt)) return null;

    const results: Result[] = [];
    for (let index = 0; index < raw.results.length && index < cases.length; index += 1) {
      const candidate = raw.results[index] as Partial<Result>;
      const gameCase = cases[index];
      if (candidate.caseId !== gameCase.id || !verdictValues.includes(candidate.picked as Verdict) || !responseActionValues.includes(candidate.action as ResponseAction) || !confidenceOptions.includes(candidate.confidence ?? -1)) return null;
      const picked = candidate.picked as Verdict;
      const action = candidate.action as ResponseAction;
      const confidence = candidate.confidence as number;
      const knownEvidence = new Set(Object.values(gameCase.checks));
      const selectedEvidence = Array.isArray(candidate.selectedEvidence)
        ? candidate.selectedEvidence.filter((item): item is string => typeof item === 'string' && knownEvidence.has(item))
        : [];
      const correct = picked === gameCase.verdict;
      const actionCorrect = action === IDEAL_ACTION[gameCase.verdict];
      results.push({
        caseId: gameCase.id,
        picked,
        action,
        confidence,
        selectedEvidence,
        correct,
        actionCorrect,
        score: calculateCaseScore({ correct, actionCorrect, confidence, evidenceCount: selectedEvidence.length }),
      });
    }
    if (results.length !== raw.results.length) return null;

    const availableCount = Math.min(cases.length, results.length === cases.length ? cases.length : results.length + 1);
    const activeIndex = typeof raw.activeIndex === 'number' && Number.isInteger(raw.activeIndex)
      ? Math.max(0, Math.min(raw.activeIndex, availableCount - 1))
      : Math.max(0, availableCount - 1);
    const visibleCaseIds = new Set(cases.slice(0, availableCount).map((item) => item.id));
    const evidence = Object.fromEntries(cases.slice(0, availableCount).map((gameCase) => {
      const knownEvidence = new Set(Object.values(gameCase.checks));
      const items = raw.evidence?.[gameCase.id];
      return [gameCase.id, Array.isArray(items) ? items.filter((item): item is string => typeof item === 'string' && knownEvidence.has(item)) : []];
    }).filter(([, items]) => (items as string[]).length > 0));
    const booleanRecord = (source: Record<string, boolean> | undefined) => Object.fromEntries(
      Object.entries(source ?? {}).filter(([caseId, value]) => visibleCaseIds.has(caseId) && value === true),
    );
    const location = locations.some((item) => item.id === raw.location) ? raw.location as LocationId : 'home';
    const view = gameViewValues.includes(raw.view as GameView) ? raw.view as GameView : 'phone';
    const phoneApp = phoneAppValues.includes(raw.phoneApp as PhoneApp) ? raw.phoneApp as PhoneApp : 'home';

    return {
      version: 1,
      savedAt: raw.savedAt as number,
      availableCount,
      activeIndex,
      location,
      view,
      phoneApp,
      phoneLocked: Boolean(raw.phoneLocked),
      results,
      evidence,
      openedLinks: booleanRecord(raw.openedLinks),
      openedCases: booleanRecord(raw.openedCases),
    };
  } catch {
    return null;
  }
}

function formatSavedTime(timestamp: number) {
  return new Intl.DateTimeFormat('ko-KR', { month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(timestamp);
}

const phoneApps: PhoneAppDefinition[] = [
  { id: 'messages', label: '메시지', icon: 'messages', purpose: '대화형 연락, 공식 안내문과 링크 연락을 확인합니다.', useWhen: '새 연락의 발신 경로와 전체 문맥을 읽고 필요한 질문을 할 때 사용합니다.', caution: '답장이 가능한 대화형 연락에만 입력창이 나타납니다.' },
  { id: 'calls', label: '전화', icon: 'calls', purpose: '최근 발신 기록과 연락 유형을 확인합니다.', useWhen: '저장된 이름만 믿지 않고 발신 기록을 다시 살펴볼 때 사용합니다.', caution: '표시된 발신자 이름만으로 실제 신원을 확정할 수 없습니다.' },
  { id: 'bank', label: '새봄은행', icon: 'bank', purpose: '계좌, 송금과 은행 안내를 공식 경로에서 확인합니다.', useWhen: '입금·출금·계좌 관련 주장을 은행 정보와 비교할 때 사용합니다.', caution: '연락에 포함된 번호나 링크가 아니라 공식 앱에서 직접 확인하세요.' },
  { id: 'stocks', label: '채움증권', icon: 'stocks', purpose: '공식 거래 내역과 투자 관련 주장을 비교합니다.', useWhen: '체결 알림이나 외부 투자방의 종목 주장을 검토할 때 사용합니다.', caution: '종목 추천과 수익 인증은 수익이나 안전을 보장하지 않습니다.' },
  { id: 'browser', label: '웹', icon: 'browser', purpose: '업체·공시·신고 사례를 독립적으로 검색합니다.', useWhen: '메시지 속 링크를 거치지 않고 출처를 교차 확인할 때 사용합니다.', caution: '자물쇠 표시는 통신 암호화일 뿐 사이트의 신뢰를 보장하지 않습니다.' },
  { id: 'social', label: '모임', icon: 'social', purpose: 'SNS 광고, 투자 추천과 모임 게시물을 확인합니다.', useWhen: '친구나 광고 계정이 공유한 주장의 출처를 살펴볼 때 사용합니다.', caution: '좋아요와 후기는 업체 등록이나 실제 수익의 증거가 아닙니다.' },
  { id: 'calendar', label: '달력', icon: 'calendar', purpose: '현재 시간과 하루 사건 진행을 확인합니다.', useWhen: '연락이 언제 도착했고 몇 사건을 완료했는지 볼 때 사용합니다.', caution: '급한 시간 제한을 강조하는 연락일수록 서두르지 마세요.' },
  { id: 'notes', label: '메모', icon: 'notes', purpose: '현재 사건에서 확인한 근거를 모아 봅니다.', useWhen: '판정 전에 조사 결과를 다시 비교할 때 사용합니다.', caution: '상대의 주장과 독립 확인 결과를 구분해서 살펴보세요.' },
  { id: 'contacts', label: '연락처', icon: 'contacts', purpose: '친구와 공식 기관에 직접 연락합니다.', useWhen: '메시지에 적힌 연락처 대신 저장된 공식 경로로 확인할 때 사용합니다.', caution: '친구의 의견도 참고 정보이며 공식 사실 확인을 대신하지 않습니다.' },
  { id: 'safety', label: '안전센터', icon: 'safety', purpose: '완료한 판정과 안전 행동 기록을 복습합니다.', useWhen: '이전 사건의 결과, 근거와 대응 점수를 다시 볼 때 사용합니다.', caution: '현재 사건 판정은 화면 아래의 판정하기 버튼에서 바로 진행합니다.' },
  { id: 'settings', label: '설정', icon: 'settings', purpose: '게임 방법과 Gemini 보조 AI 상태를 확인합니다.', useWhen: '전체 안내를 다시 보거나 AI 연결 상태를 점검할 때 사용합니다.', caution: '실제 계좌번호·비밀번호·개인정보는 입력하지 마세요.' },
  { id: 'photos', label: '사진', icon: 'photos', purpose: '가상 증거 화면과 보관 요령을 확인합니다.', useWhen: '신고에 필요한 기록을 어떻게 남기는지 살펴볼 때 사용합니다.', caution: '실제 신고에서는 원본 링크와 시간 정보도 함께 보관하세요.' },
];

const confidenceOptions = [50, 70, 90];
const responseActions: { id: ResponseAction; label: string; description: string }[] = [
  { id: 'verify', label: '공식 경로로 확인', description: '연락 속 링크가 아닌 공식 앱·번호로 다시 확인한다.' },
  { id: 'pause', label: '대화 중단·보류', description: '결제와 정보 제공을 멈추고 판단 시간을 확보한다.' },
  { id: 'block', label: '차단·신고', description: '연락을 끊고 안전센터나 관계 기관에 신고한다.' },
];
const chatCaseCount = cases.filter((item) => item.mode === 'chat').length;
const tutorialSteps: { kind: TutorialKind; eyebrow: string; title: string; body: string; icon: string }[] = [
  {
    kind: 'controls', eyebrow: '먼저 조작 방법', title: '선택하고, 읽고, 닫으세요',
    body: 'PC에서는 클릭·Tab·Enter를, 모바일에서는 터치와 스크롤을 사용합니다. 마을에서는 지도 위 건물을 선택해 바로 이동합니다.',
    icon: '01',
  },
  {
    kind: 'interface', eyebrow: '주요 버튼 위치', title: '화면의 세 구역을 기억하세요',
    body: '위쪽에는 시간·사건·점수와 도움말, 가운데에는 현재 목표, 아래에는 마을·휴대폰·판정하기가 항상 표시됩니다.',
    icon: '02',
  },
  {
    kind: 'mission', eyebrow: '오늘의 임무', title: '연락의 정체를 판단하세요',
    body: `하루 동안 ${cases.length}개의 연락이 하나씩 도착합니다. 정상·주의·사기를 구분하고 가장 안전한 대응까지 선택하세요.`,
    icon: '03',
  },
  {
    kind: 'places', eyebrow: '마을 조사처', title: '주장에 맞는 확인 장소를 찾으세요',
    body: '장소마다 확인할 수 있는 정보가 다릅니다. 모든 장소가 현재 사건과 관련 있는 것은 아닙니다.',
    icon: '04',
  },
  {
    kind: 'apps', eyebrow: '휴대폰 앱', title: '앱마다 확인 역할이 다릅니다',
    body: '홈 화면에는 앱 이름만 표시됩니다. 플레이 중 앱 안의 i 버튼을 누르면 이 설명을 다시 볼 수 있습니다.',
    icon: '05',
  },
  {
    kind: 'verdict', eyebrow: '언제든 판정', title: '안전센터를 찾을 필요가 없습니다',
    body: '조사가 충분하다고 생각되면 어느 화면에서든 아래 판정하기 버튼을 누르세요. 닫으면 원래 화면으로 돌아옵니다.',
    icon: '06',
  },
  {
    kind: 'score', eyebrow: '점수 획득', title: '정답보다 판단 과정이 중요합니다',
    body: '판정·근거·대응 행동·확신도를 함께 평가합니다. 모르면 서두르지 않고 확인하는 것도 좋은 선택입니다.',
    icon: '07',
  },
];

const locationPosition: Record<LocationId, { left: string; top: string; spriteRow: number }> = {
  home: { left: '22%', top: '28%', spriteRow: 0 },
  bank: { left: '74%', top: '29%', spriteRow: 0 },
  cafe: { left: '73%', top: '54%', spriteRow: 1 },
  police: { left: '23%', top: '77%', spriteRow: 2 },
  library: { left: '73%', top: '79%', spriteRow: 3 },
};

const locationKeys: Record<LocationId, string> = {
  home: '집', bank: '은행', cafe: '카페', police: '경찰서', library: '도서관',
};

function initialChat(gameCase: CaseData): ChatMessage[] {
  return gameCase.initialMessages.map((content) => ({ role: 'assistant', content }));
}

function classifyDialogueTopic(text: string): DialogueTopic {
  if (/돈|입금|계좌|송금|출금|충전|비용|결제/.test(text)) return 'money';
  if (/위험|손실|틀리|보장|실패|잃/.test(text)) return 'risk';
  if (/소속|누구|회사|신원|등록|자격/.test(text)) return 'identity';
  if (/어디서|출처|자료|공시|성과|적중률|기록|근거/.test(text)) return 'source';
  return 'default';
}

function fallbackReply(gameCase: CaseData, userText: string, messages: ChatMessage[]) {
  const topic = classifyDialogueTopic(userText);
  const replies = [
    ...(gameCase.dialogue ? [gameCase.dialogue.fallbackByTopic[topic]] : []),
    ...(gameCase.fallbackReplies ?? []),
    '그 질문은 조금 더 확인해 보고 답할게.',
  ];
  const used = new Set(messages.filter((message) => message.role === 'assistant').map((message) => message.content));
  return replies.find((reply) => !used.has(reply)) ?? replies[messages.length % replies.length];
}

export default function GameClient() {
  const dialogReturnFocus = useRef<HTMLElement | null>(null);
  const [started, setStarted] = useState(false);
  const [loadingTask, setLoadingTask] = useState<LoadingTask | null>(null);
  const [view, setView] = useState<GameView>('world');
  const [phoneApp, setPhoneApp] = useState<PhoneApp>('home');
  const [phoneLocked, setPhoneLocked] = useState(true);
  const [tutorialStep, setTutorialStep] = useState<number | null>(null);
  const [availableCount, setAvailableCount] = useState(1);
  const [activeIndex, setActiveIndex] = useState(0);
  const [location, setLocation] = useState<LocationId>('home');
  const [notice, setNotice] = useState('오늘 도착한 연락을 확인하고, 필요한 곳에서 사실을 조사하세요.');
  const [chats, setChats] = useState<Record<string, ChatMessage[]>>(() =>
    Object.fromEntries(cases.map((item) => [item.id, initialChat(item)]))
  );
  const [evidence, setEvidence] = useState<Record<string, string[]>>({});
  const [openedLinks, setOpenedLinks] = useState<Record<string, boolean>>({});
  const [openedCases, setOpenedCases] = useState<Record<string, boolean>>({});
  const [results, setResults] = useState<Result[]>([]);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [aiWaitMs, setAiWaitMs] = useState(0);
  const [picked, setPicked] = useState<Verdict | null>(null);
  const [confidence, setConfidence] = useState(70);
  const [selectedAction, setSelectedAction] = useState<ResponseAction | null>(null);
  const [selectedEvidence, setSelectedEvidence] = useState<string[]>([]);
  const [showVerdictPanel, setShowVerdictPanel] = useState(false);
  const [infoApp, setInfoApp] = useState<AppId | null>(null);
  const [showDebrief, setShowDebrief] = useState(false);
  const [modelState, setModelState] = useState<ModelState>('unchecked');
  const [modelLoadMs, setModelLoadMs] = useState<number | null>(null);
  const [lastResponseMs, setLastResponseMs] = useState<number | null>(null);
  const [fallbackReason, setFallbackReason] = useState<string | null>(null);
  const [aiSessionId] = useState(() => typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `session-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  const [bestScore, setBestScore] = useState(0);
  const [savedProgress, setSavedProgress] = useState<SavedProgress | null>(null);

  const activeCase = cases[activeIndex];
  const activeChat = chats[activeCase.id] ?? initialChat(activeCase);
  const activeEvidence = evidence[activeCase.id] ?? [];
  const activeResult = results.find((result) => result.caseId === activeCase.id);
  const score = results.reduce((sum, result) => sum + result.score, 0);
  const complete = results.length === cases.length;
  const accuracy = results.length ? Math.round((results.filter((result) => result.correct).length / results.length) * 100) : 0;
  const actionAccuracy = results.length ? Math.round((results.filter((result) => result.actionCorrect).length / results.length) * 100) : 0;
  const groundedCount = results.filter((result) => result.selectedEvidence.length > 0).length;
  const availableCases = cases.slice(0, availableCount);
  const unreadCount = availableCases.filter((item) => !results.some((result) => result.caseId === item.id)).length;
  const gameTime = formatGameClock(ARRIVAL_MINUTES[Math.min(availableCount - 1, ARRIVAL_MINUTES.length - 1)] + activeEvidence.length * 6);
  const currentPlace = locations.find((item) => item.id === location) ?? locations[0];
  const playerPosition = locationPosition[location];
  const activeAppInfo = infoApp ? phoneApps.find((app) => app.id === infoApp) : undefined;
  const playerTitle = accuracy >= 80 && actionAccuracy >= 80 ? '근거 중심 안전 탐정' : actionAccuracy >= accuracy ? '신중한 안전 행동가' : groundedCount >= Math.ceil(Math.max(results.length, 1) / 2) ? '공식 확인 습관가' : '성장 중인 디지털 시민';
  const contactReviewed = Boolean(openedCases[activeCase.id]);
  const objectiveStage = activeResult ? 3 : activeEvidence.length ? 2 : contactReviewed ? 1 : 0;
  const objective = [
    { title: '새 연락을 확인하세요', detail: `${activeCase.sender}의 연락을 열어 내용과 발신 경로를 살펴보세요.` },
    { title: '공식 경로에서 근거를 찾으세요', detail: activeCase.mode === 'chat' ? '질문을 해보고 마을의 은행·경찰서·도서관 등에서 교차 확인하세요.' : '안내문이나 링크의 주장과 공식 앱·기관 정보를 비교하세요.' },
    { title: '근거와 안전 행동을 선택하세요', detail: '화면 아래 판정하기를 눌러 근거와 실제로 취할 대응을 함께 제출하세요.' },
    { title: '판정을 완료했습니다', detail: '해설을 확인한 뒤 시간을 진행하면 다음 연락이 도착합니다.' },
  ][objectiveStage];
  const aiWaitProgress = Math.min(92, Math.max(8, Math.round((aiWaitMs / AI_REQUEST_TIMEOUT_MS) * 100)));
  const aiWaitLabel = aiWaitMs >= AI_SLOW_NOTICE_MS
    ? '응답이 늦어 검수된 후보 대사도 함께 준비 중입니다.'
    : modelState === 'checking'
      ? 'Gemini가 현재 사건과 질문을 확인하고 있습니다.'
      : `${activeCase.sender}가 답변을 작성 중입니다.`;

  useEffect(() => {
    let storedBest = 0;
    let storedProgress: SavedProgress | null = null;
    try {
      storedBest = Number(window.localStorage.getItem('profit-24-best-score') ?? 0);
      storedProgress = readSavedProgress(window.localStorage.getItem(PROGRESS_SAVE_KEY));
    } catch {
      storedBest = 0;
      storedProgress = null;
    }
    window.setTimeout(() => {
      setBestScore(Number.isFinite(storedBest) ? storedBest : 0);
      setSavedProgress(storedProgress);
    }, 0);
  }, []);

  useEffect(() => {
    if (complete && score > bestScore) {
      window.localStorage.setItem('profit-24-best-score', String(score));
      window.setTimeout(() => setBestScore(score), 0);
    }
  }, [bestScore, complete, score]);

  useEffect(() => {
    if (!started || loadingTask) return;
    const snapshot: SavedProgress = {
      version: 1,
      savedAt: Date.now(),
      availableCount,
      activeIndex,
      location,
      view,
      phoneApp,
      phoneLocked,
      results,
      evidence,
      openedLinks,
      openedCases,
    };
    const timer = window.setTimeout(() => {
      try {
        window.localStorage.setItem(PROGRESS_SAVE_KEY, JSON.stringify(snapshot));
        setSavedProgress(snapshot);
      } catch {
        // 저장 공간을 사용할 수 없어도 게임 진행은 계속한다.
      }
    }, 250);
    return () => window.clearTimeout(timer);
  }, [activeIndex, availableCount, evidence, loadingTask, location, openedCases, openedLinks, phoneApp, phoneLocked, results, started, view]);

  useEffect(() => {
    if (!sending) return;
    const startedAt = performance.now();
    const timer = window.setInterval(() => setAiWaitMs(performance.now() - startedAt), 200);
    return () => window.clearInterval(timer);
  }, [sending]);

  useEffect(() => {
    function handleEscape(event: KeyboardEvent) {
      const dialog = document.querySelector<HTMLElement>('[role="dialog"][aria-modal="true"]');
      if (event.key === 'Tab' && dialog) {
        const focusable = Array.from(dialog.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])'));
        if (!focusable.length) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
        return;
      }
      if (event.key !== 'Escape') return;
      if (infoApp) setInfoApp(null);
      else if (showVerdictPanel) setShowVerdictPanel(false);
      else if (tutorialStep !== null) setTutorialStep(null);
    }
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [infoApp, showVerdictPanel, tutorialStep]);

  useEffect(() => {
    const hasDialog = Boolean(showVerdictPanel || infoApp || tutorialStep !== null || showDebrief || complete);
    if (hasDialog) {
      if (!dialogReturnFocus.current) dialogReturnFocus.current = document.activeElement as HTMLElement | null;
      const timer = window.setTimeout(() => {
        const dialog = document.querySelector<HTMLElement>('[role="dialog"][aria-modal="true"]');
        const target = dialog?.querySelector<HTMLElement>('button:not([disabled]), input:not([disabled])') ?? dialog;
        target?.focus();
      }, 0);
      return () => window.clearTimeout(timer);
    }
    dialogReturnFocus.current?.focus();
    dialogReturnFocus.current = null;
  }, [complete, infoApp, showDebrief, showVerdictPanel, tutorialStep]);

  const modelLabel = useMemo(() => ({
    unchecked: 'Gemini 확인 전', checking: 'AI 확인 중', connected: 'Gemini 연결', fallback: '대체 대사'
  })[modelState], [modelState]);

  function explainFallback(error: unknown) {
    const message = error instanceof Error ? error.message : '';
    if (/ai_unconfigured/i.test(message)) return '서버에 Gemini API 키가 없어 검수된 내장 대사를 사용합니다.';
    if (/free_quota|rate_limit|429/i.test(message)) return '무료 사용 한도 또는 게임 내 이용 한도에 도달해 내장 대사로 이어갑니다.';
    if (/invalid_api_key|401|403/i.test(message)) return 'Gemini API 키를 확인할 수 없어 내장 대사를 사용합니다.';
    if (/timeout|abort/i.test(message)) return '16초 응답 제한을 넘어 내장 대사로 전환했습니다.';
    if (/unsafe|repeated/i.test(message)) return '안전 검사 또는 반복 검사에서 제외되어 검수된 대사를 사용했습니다.';
    return 'Gemini 응답을 받을 수 없어 검수된 내장 대사를 사용했습니다.';
  }

  async function requestGemini(gameCase: CaseData, messages: ChatMessage[]) {
    if (gameCase.mode !== 'chat' || !gameCase.dialogue) throw new Error('read-only contact');
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), AI_REQUEST_TIMEOUT_MS);
    const response = await fetch('/api/ai-chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-whatfraud-session': aiSessionId },
      signal: controller.signal,
      body: JSON.stringify({
        caseId: gameCase.id,
        messages: messages.slice(-6),
      }),
    }).finally(() => window.clearTimeout(timeout));
    const payload = await response.json().catch(() => ({})) as { reply?: unknown; code?: unknown };
    if (!response.ok) throw new Error(typeof payload.code === 'string' ? payload.code : `gemini ${response.status}`);
    if (typeof payload.reply !== 'string' || !payload.reply.trim()) throw new Error('empty gemini response');
    const reply = payload.reply.trim();
    if (!validateAiReply(reply)) throw new Error('unsafe gemini response');
    return reply;
  }

  async function checkModel() {
    setModelState('checking');
    setFallbackReason(null);
    const startedAt = performance.now();
    try {
      const testCase = cases.find((item) => item.mode === 'chat') ?? activeCase;
      await requestGemini(testCase, [{ role: 'user', content: '게임 속 역할로 짧게 인사해 주세요.' }]);
      setModelLoadMs(Math.round(performance.now() - startedAt));
      setModelState('connected');
    } catch (error) {
      setFallbackReason(explainFallback(error));
      setModelState('fallback');
    }
  }

  async function sendMessage(event: FormEvent) {
    event.preventDefault();
    const content = draft.trim();
    if (!content || sending || activeResult || activeCase.mode !== 'chat') return;
    const nextMessages = [...activeChat, { role: 'user' as const, content }];
    setChats((current) => ({ ...current, [activeCase.id]: nextMessages }));
    setDraft('');
    setAiWaitMs(0);
    setSending(true);
    const responseStartedAt = performance.now();
    try {
      if (modelState !== 'connected') setModelState('checking');
      const reply = await requestGemini(activeCase, nextMessages);
      const normalizedReply = reply.replace(/\s+/g, ' ').trim();
      const repeated = activeChat.some((message) => message.role === 'assistant' && message.content.replace(/\s+/g, ' ').trim() === normalizedReply);
      if (repeated) throw new Error('repeated response');
      setLastResponseMs(Math.round(performance.now() - responseStartedAt));
      setFallbackReason(null);
      setModelState('connected');
      setChats((current) => ({
        ...current,
        [activeCase.id]: [...(current[activeCase.id] ?? nextMessages), { role: 'assistant', content: reply }],
      }));
    } catch (error) {
      setLastResponseMs(Math.round(performance.now() - responseStartedAt));
      setFallbackReason(explainFallback(error));
      setModelState('fallback');
      setChats((current) => ({
        ...current,
        [activeCase.id]: [...(current[activeCase.id] ?? nextMessages), { role: 'assistant', content: fallbackReply(activeCase, content, current[activeCase.id] ?? nextMessages) }],
      }));
    } finally {
      setSending(false);
      setAiWaitMs(0);
    }
  }

  function visit(nextLocation: LocationId) {
    setLocation(nextLocation);
    const place = locations.find((item) => item.id === nextLocation);
    const found = activeCase.checks[nextLocation];
    if (found) {
      setEvidence((current) => {
        const list = current[activeCase.id] ?? [];
        return list.includes(found) ? current : { ...current, [activeCase.id]: [...list, found] };
      });
      setNotice(`${place?.label ?? '장소'}에서 단서를 찾았다! ${found}`);
    } else {
      setNotice(`${place?.label ?? '장소'}을 확인했지만, 이 연락과 직접 연결되는 단서는 없었다.`);
    }
  }

  function openCase(index: number) {
    if (index < 0 || index >= availableCount) {
      setNotice('아직 도착하지 않은 연락입니다. 현재 사건을 판정하면 시간이 진행됩니다.');
      return;
    }
    const result = results.find((entry) => entry.caseId === cases[index].id);
    setActiveIndex(index);
    setShowDebrief(Boolean(result));
    setPhoneLocked(false);
    setPhoneApp('messages');
    setOpenedCases((current) => ({ ...current, [cases[index].id]: true }));
    setDraft('');
    setView('phone');
  }

  function submitVerdict() {
    if (activeResult || !picked || !selectedAction) return;
    const correct = picked === activeCase.verdict;
    const actionCorrect = selectedAction === IDEAL_ACTION[activeCase.verdict];
    const caseScore = calculateCaseScore({ correct, actionCorrect, confidence, evidenceCount: selectedEvidence.length });
    setResults((current) => [...current, { caseId: activeCase.id, correct, actionCorrect, score: caseScore, picked, confidence, action: selectedAction, selectedEvidence }]);
    setShowVerdictPanel(false);
    setShowDebrief(true);
  }

  function openVerdictPanel() {
    if (activeResult) {
      setShowDebrief(true);
      return;
    }
    setInfoApp(null);
    setShowVerdictPanel(true);
  }

  async function nextCase() {
    if (loadingTask) return;
    setShowDebrief(false);
    const progress = advanceCaseProgress({ activeIndex, availableCount, resultCount: results.length, totalCases: cases.length });
    if (!progress.unlocked) {
      setActiveIndex(progress.activeIndex);
      setPhoneApp('messages');
      return;
    }
    const nextIndex = progress.activeIndex;
    setLoadingTask({ kind: 'case', progress: 12, title: '하루의 시간이 흐릅니다', detail: '방금 내린 판단을 기록하고 다음 연락을 기다리는 중입니다.' });
    await wait(180);
    setLoadingTask({ kind: 'case', progress: 48, title: '판정 기록을 정리했습니다', detail: `${formatGameClock(ARRIVAL_MINUTES[nextIndex])} 시점으로 게임 시간을 이동합니다.` });
    await wait(180);
    setAvailableCount(progress.availableCount);
    setActiveIndex(nextIndex);
    setPicked(null);
    setConfidence(70);
    setSelectedAction(null);
    setSelectedEvidence([]);
    setDraft('');
    setPhoneApp('home');
    setPhoneLocked(true);
    setView('phone');
    setNotice(`${formatGameClock(ARRIVAL_MINUTES[nextIndex])}, 새로운 연락이 도착했다.`);
    setLoadingTask({ kind: 'case', progress: 82, title: '새 연락을 수신 중입니다', detail: `오늘의 ${nextIndex + 1}번째 연락을 휴대폰 알림에 추가합니다.` });
    await wait(220);
    setLoadingTask({ kind: 'case', progress: 100, title: '새 연락이 도착했습니다', detail: '휴대폰 알림에서 발신자와 연락 내용을 확인하세요.' });
    await wait(180);
    setLoadingTask(null);
  }

  function prepareDefaultAi() {
    setModelState('checking');
    setFallbackReason(null);
    const startedAt = performance.now();
    void fetch('/api/ai-chat', { cache: 'no-store' }).then(async (response) => {
      if (!response.ok) throw new Error(`ai status ${response.status}`);
      const payload = await response.json() as { enabled?: unknown };
      setModelLoadMs(Math.round(performance.now() - startedAt));
      if (payload.enabled === true) setModelState('connected');
      else {
        setFallbackReason(explainFallback(new Error('ai_unconfigured')));
        setModelState('fallback');
      }
    }).catch((error) => {
      setFallbackReason(explainFallback(error));
      setModelState('fallback');
    });
  }

  function clearSavedProgress() {
    try {
      window.localStorage.removeItem(PROGRESS_SAVE_KEY);
    } catch {
      // 브라우저 저장소를 사용할 수 없어도 새 게임은 시작할 수 있다.
    }
    setSavedProgress(null);
  }

  async function startSimulation(forceGuide = false, resume = false) {
    if (loadingTask) return;
    const progressToRestore = resume ? savedProgress : null;
    setLoadingTask({ kind: 'startup', progress: 8, title: progressToRestore ? '저장한 하루를 불러옵니다' : '시뮬레이션을 준비합니다', detail: progressToRestore ? '기기에 저장된 판정과 조사 기록을 확인하는 중입니다.' : `오늘의 판별 사건 ${cases.length}건을 안전하게 불러오는 중입니다.` });
    const minimumDisplay = wait(900);
    await wait(120);
    setLoadingTask({ kind: 'startup', progress: 18, title: progressToRestore ? '저장 기록을 확인했습니다' : '사건 데이터를 확인했습니다', detail: progressToRestore ? `완료한 사건 ${progressToRestore.results.length}/${cases.length} · 현재 사건 ${progressToRestore.activeIndex + 1}번` : '정상·주의·사기 연락의 순서와 판정 규칙을 준비합니다.' });
    let loadedAssets = 0;
    await Promise.all(startupAssets.map(async (source) => {
      await preloadAsset(source);
      loadedAssets += 1;
      const progress = 18 + Math.round((loadedAssets / startupAssets.length) * 58);
      setLoadingTask({ kind: 'startup', progress, title: '마을과 휴대폰을 준비합니다', detail: `화면 자산 ${loadedAssets}/${startupAssets.length}개를 불러왔습니다.` });
    }));
    let guideComplete = false;
    try {
      guideComplete = window.localStorage.getItem('profit-24-guide-complete') === '1';
    } catch {
      guideComplete = false;
    }
    setLoadingTask({ kind: 'startup', progress: 90, title: '플레이 환경을 설정합니다', detail: progressToRestore ? '개인 대화 입력은 복원하지 않고 사건 진행 상태만 적용합니다.' : '저장된 안내 설정과 Gemini 보조 AI 사용 가능 여부를 확인합니다.' });
    await minimumDisplay;
    setLoadingTask({ kind: 'startup', progress: 100, title: '준비가 완료되었습니다', detail: forceGuide || !guideComplete ? '조작 안내부터 차근차근 시작합니다.' : progressToRestore ? '저장했던 사건 화면으로 돌아갑니다.' : '첫 번째 휴대폰 알림으로 이동합니다.' });
    await wait(220);
    if (progressToRestore) {
      setAvailableCount(progressToRestore.availableCount);
      setActiveIndex(progressToRestore.activeIndex);
      setLocation(progressToRestore.location);
      setResults(progressToRestore.results);
      setEvidence(progressToRestore.evidence);
      setOpenedLinks(progressToRestore.openedLinks);
      setOpenedCases(progressToRestore.openedCases);
      setPhoneApp(progressToRestore.phoneApp);
      setPhoneLocked(progressToRestore.phoneLocked);
      setNotice(`저장한 진행을 불러왔습니다. ${cases[progressToRestore.activeIndex].sender} 연락부터 이어서 확인하세요.`);
      setChats(Object.fromEntries(cases.map((item) => [item.id, initialChat(item)])));
      setPicked(null);
      setConfidence(70);
      setSelectedAction(null);
      setSelectedEvidence([]);
      setShowDebrief(false);
      setShowVerdictPanel(false);
      setInfoApp(null);
    }
    setStarted(true);
    setView(forceGuide || !guideComplete ? 'world' : progressToRestore?.view ?? 'phone');
    setTutorialStep(forceGuide || !guideComplete ? 0 : null);
    setLoadingTask(null);
    window.setTimeout(prepareDefaultAi, 0);
  }

  function closeTutorial() {
    window.localStorage.setItem('profit-24-guide-complete', '1');
    setTutorialStep(null);
    setView('phone');
    if (results.length === 0 && Object.keys(evidence).length === 0) {
      setPhoneLocked(true);
      setNotice('첫 연락이 도착했다. 휴대폰 알림부터 확인해 보자.');
    } else {
      setPhoneLocked(false);
      setNotice(`게임 안내를 마쳤습니다. ${activeCase.sender} 연락부터 계속 확인하세요.`);
    }
  }

  function toggleEvidence(item: string) {
    setSelectedEvidence((current) => current.includes(item) ? current.filter((entry) => entry !== item) : [...current, item]);
  }

  function openPhone() {
    setView('phone');
  }

  function selectPhoneApp(target: PhoneApp) {
    setPhoneApp(target);
    if (target === 'messages') setOpenedCases((current) => ({ ...current, [activeCase.id]: true }));
  }

  function unlockPhone(target: PhoneApp = 'home') {
    setPhoneLocked(false);
    selectPhoneApp(target);
  }

  function restart() {
    clearSavedProgress();
    setView('world');
    setPhoneApp('home');
    setPhoneLocked(true);
    setTutorialStep(null);
    setAvailableCount(1);
    setStarted(false);
    setActiveIndex(0);
    setLocation('home');
    setResults([]);
    setEvidence({});
    setOpenedLinks({});
    setOpenedCases({});
    setShowDebrief(false);
    setShowVerdictPanel(false);
    setInfoApp(null);
    setPicked(null);
    setSelectedAction(null);
    setSelectedEvidence([]);
    setNotice('새로운 하루가 시작됐다. 도착한 연락을 차분히 확인해 보자.');
    setChats(Object.fromEntries(cases.map((item) => [item.id, initialChat(item)])));
  }

  if (loadingTask) {
    return <GameLoadingScreen variant={loadingTask.kind} progress={loadingTask.progress} eyebrow={loadingTask.kind === 'startup' ? 'SIMULATION BOOT' : `CASE ${String(Math.min(results.length + 1, cases.length)).padStart(2, '0')} TRANSITION`} title={loadingTask.title} detail={loadingTask.detail} steps={loadingSteps[loadingTask.kind]} />;
  }

  if (!started) {
    return (
      <main className="simulation-intro">
        <img src="/assets/pixel/start-screen.png" alt="저녁 마을이 내려다보이는 방과 책상 위 휴대폰" />
        <div className="intro-shade" />
        <section className="intro-panel" aria-labelledby="game-title">
          <span className="intro-kicker">디지털 안전 시뮬레이션</span>
          <h1 id="game-title"><small>투자·도박 사기 판별 게임</small>수익률 24시</h1>
          <p>하루 동안 연락이 하나씩 도착합니다.<br />내용을 확인하고 근거와 안전한 대응을 찾아 판별하세요.</p>
          {savedProgress && <div className="resume-summary" aria-label="저장된 게임 진행"><span>이어할 기록</span><b>사건 {Math.min(savedProgress.results.length + 1, cases.length)}/{cases.length} · 판정 {savedProgress.results.length}건 완료</b><small>{formatSavedTime(savedProgress.savedAt)} 자동 저장 · 대화 입력은 저장하지 않음</small></div>}
          <button className="start-simulation" onClick={() => startSimulation(false, Boolean(savedProgress))}>
            <b>{savedProgress ? '저장한 게임 이어하기' : '시뮬레이션 시작'}</b><i>▶</i>
          </button>
          {savedProgress && <button className="intro-new-game" onClick={() => { clearSavedProgress(); void startSimulation(false, false); }}>처음부터 새로 시작</button>}
          <button className="intro-guide-button" onClick={() => startSimulation(true, Boolean(savedProgress))}>조작·게임 안내부터 보기</button>
          <small className="intro-disclaimer">교육용 가상 시뮬레이션 · 실제 금융기관과 무관합니다</small>
        </section>
      </main>
    );
  }

  return (
    <main className={`game-shell view-${view}`}>
      <header className="game-hud">
        <div className="brand-block"><span className="brand-kicker">투자·도박 사기 판별</span><h1>수익률 24시</h1></div>
        <div className="hud-right">
          <div className="hud-stats" aria-label="게임 상태">
            <span><small>시간</small><b>{gameTime}</b></span>
            <span><small>사건</small><b>{Math.min(results.length + 1, cases.length)}/{cases.length}</b></span>
            <span><small>점수</small><b>{score}</b></span>
          </div>
          <button className="game-help-button" onClick={() => setTutorialStep(0)} aria-label="조작법과 게임 안내 다시 보기">?</button>
        </div>
      </header>

      <section className="mission-strip" aria-label="현재 목표">
        <div className="mission-copy"><span>현재 목표</span><b>{objective.title}</b><small>{objective.detail}</small></div>
        <ol aria-label="사건 진행 단계">
          {['연락 확인', '공식 조사', '판정·대응'].map((label, index) => (
            <li key={label} className={objectiveStage > index ? 'done' : objectiveStage === index ? 'current' : ''}>
              <i>{objectiveStage > index ? '✓' : index + 1}</i><span>{label}</span>
            </li>
          ))}
        </ol>
      </section>

      {view === 'world' ? (
        <section className="world-screen" aria-label="마을 화면">
          <div className="world-frame">
            <div className="map-stage">
              <img className="town-map" src="/assets/pixel/town-map.png" alt="집, 은행, 카페, 경찰서와 도서관이 있는 마을 지도" />
              {locations.map((place) => {
                const position = locationPosition[place.id];
                return <button key={place.id} className={`map-hotspot hotspot-${place.id} ${location === place.id ? 'current' : ''}`} style={{ left: position.left, top: position.top }} onClick={() => visit(place.id)} aria-label={`${place.label}로 이동`}><span>{locationKeys[place.id]}</span></button>;
              })}
              <div className={`player-sprite row-${playerPosition.spriteRow}`} style={{ left: playerPosition.left, top: playerPosition.top }} role="img" aria-label={`${currentPlace.label}에 있는 플레이어`} />
              <div className="map-objective"><span>현재 사건 · {formatGameClock(ARRIVAL_MINUTES[activeIndex])}</span><b>{activeCase.sender}</b><small>{activeCase.preview}</small></div>
            </div>
            <div className="dialog-window" aria-live="polite"><div className="speaker-tag">{currentPlace.label}</div><p>{notice}</p><span className="dialog-arrow">▼</span></div>
          </div>
          <aside className="world-side-panel">
            <div className="quest-card">
              <span className="pixel-label">조사 수첩</span><h2>{activeCase.sender}</h2><p>{activeCase.preview}</p><div className="evidence-count">단서 {activeEvidence.length}개</div>
              {activeEvidence.length ? <ul>{activeEvidence.map((item) => <li key={item}>{item}</li>)}</ul> : <p className="empty-note">건물을 방문해 공식 경로로 사실을 확인하세요.</p>}
            </div>
            <div className="control-card"><b>다음 행동</b><p>{objective.detail}</p><button onClick={openPhone}>휴대폰 열기 <span>▶</span></button></div>
          </aside>
        </section>
      ) : (
        <section className={`phone-screen phone-os-shell ${phoneLocked ? 'is-locked' : ''}`} aria-label="휴대폰 화면">
          <div className="phone-statusbar"><b>{gameTime}</b><span>SIM · Wi-Fi ▮▮▮</span></div>

          {phoneLocked ? (
            <div className="phone-lock-screen">
              <div className="lock-content">
                <div className="lock-padlock">●</div>
                <time>{gameTime}</time><span>8월 29일 토요일</span>
                <div className="lock-notifications" aria-label="새 알림">
                  <button onClick={() => unlockPhone('messages')}><i className="mini-icon icon-messages"/><span><b>메시지 · 지금</b><strong>{activeCase.sender}</strong><small>{activeCase.preview}</small></span></button>
                  <button onClick={() => unlockPhone('bank')}><i className="mini-icon icon-bank"/><span><b>새봄은행 · 12분 전</b><strong>오늘의 금융 안전 점검</strong><small>송금 전 수취인과 거래 목적을 확인하세요.</small></span></button>
                  <button onClick={() => unlockPhone('safety')}><i className="mini-icon icon-safety"/><span><b>안전센터 · 오늘</b><strong>판정 기록 {results.length}건</strong><small>완료한 사건의 판단과 안전 행동을 복습할 수 있습니다.</small></span></button>
                </div>
              </div>
              <button className="unlock-button" onClick={() => unlockPhone()}><span>위로 밀어 열기</span><b>⌃</b></button>
              <div className="lock-shortcuts"><button onClick={() => unlockPhone('calls')} aria-label="전화 열기">☎</button><button onClick={() => unlockPhone('photos')} aria-label="카메라와 사진 열기">▣</button></div>
            </div>
          ) : (
            <>
              {phoneApp === 'home' && (
                <div className="phone-home-screen">
                    <button className="home-notification" onClick={() => selectPhoneApp('messages')}><i className="mini-icon icon-messages"/><span><b>{activeCase.sender}</b><small>{activeCase.preview}</small></span><em>{formatGameClock(ARRIVAL_MINUTES[activeIndex])}</em></button>
                  <div className="home-widgets">
                    <div><span>오늘의 판별 훈련</span><strong>{results.length}/{cases.length}</strong><small>정확도 {accuracy}% · 점수 {score}</small></div>
                    <div><span>현재 위치</span><strong>{currentPlace.label}</strong><small>{currentPlace.hint}</small></div>
                  </div>
                  <div className="app-grid" aria-label="앱 목록">
                    {phoneApps.map((app) => <button key={app.id} onClick={() => selectPhoneApp(app.id)}><i className={`app-icon icon-${app.icon}`}/><span>{app.label}</span>{app.id === 'messages' && unreadCount > 0 && <em>{unreadCount}</em>}</button>)}
                  </div>
                  <div className="phone-dock">
                    {phoneApps.filter((app) => ['calls','messages','browser','safety'].includes(app.id)).map((app) => <button key={app.id} onClick={() => selectPhoneApp(app.id)} aria-label={`${app.label} 열기`}><i className={`app-icon icon-${app.icon}`}/></button>)}
                  </div>
                </div>
              )}

              {phoneApp !== 'home' && <div className="native-app-header"><button onClick={() => setPhoneApp('home')} aria-label="홈 화면으로">‹</button><div><b>{phoneApps.find((app) => app.id === phoneApp)?.label}</b><small>수익률 24시 시뮬레이션</small></div><span className="native-header-actions"><button className="app-info-button" onClick={() => setInfoApp(phoneApp)} aria-label={`${phoneApps.find((app) => app.id === phoneApp)?.label} 앱 정보 보기`}>i</button><button onClick={() => setPhoneLocked(true)} aria-label="휴대폰 잠그기">⌁</button></span></div>}

              {phoneApp === 'messages' && (
                <div className="phone-workspace phone-app-body">
                  <aside className="contact-list" aria-label="오늘의 연락">
                    <div className="contact-title"><span>도착한 연락</span><b>{availableCases.length}</b></div>
                    {availableCases.map((item, index) => {
                      const result = results.find((entry) => entry.caseId === item.id);
                      return <button key={item.id} className={`contact-card ${index === activeIndex ? 'selected' : ''}`} onClick={() => openCase(index)}><i>{item.sender.slice(0, 1)}</i><span><b>{item.sender}</b><small>{item.preview}</small></span>{result ? <em>{result.correct ? 'OK' : '!'}</em> : <em className="unread">●</em>}</button>;
                    })}
                  </aside>
                  <section className={`messenger-panel mode-${activeCase.mode}`} aria-busy={sending}>
                    <header className="chat-header"><button onClick={() => setPhoneApp('home')} aria-label="홈 화면으로">◀</button><div><b>{activeCase.sender}</b><small>{activeCase.handle} · {activeCase.channel}</small></div>{activeCase.mode === 'chat' && <span className={`model-dot ${modelState}`}>{modelLabel}</span>}</header>
                    {activeCase.mode === 'chat' && <><div className="chat-area" aria-live="polite"><span className="date-pill">오늘</span>{activeChat.map((message, index) => <div key={`${message.role}-${index}`} className={`message ${message.role}`}><p>{message.content}</p><time>{formatGameClock(9 * 60 + 3 + index * 2)}</time></div>)}{!activeResult && activeCase.dialogue && <div className="quick-questions" aria-label="추천 질문"><span>어떤 점을 물어볼까요?</span><div>{activeCase.dialogue.quickQuestions.map((question) => <button key={question} type="button" onClick={() => setDraft(question)} disabled={sending}>{question}</button>)}</div></div>}{sending && <div className="ai-wait-card" role="status"><div><i className="model-pulse" aria-hidden="true"/><span><b>실시간 응답 준비</b><small>{aiWaitLabel}</small></span><em>{Math.ceil(aiWaitMs / 1000)}초</em></div><div className="ai-wait-progress" role="progressbar" aria-label="Gemini 응답 준비 진행" aria-valuemin={0} aria-valuemax={100} aria-valuenow={aiWaitProgress}><i style={{ width: `${aiWaitProgress}%` }}/></div><p>최대 16초 동안 기다린 뒤에도 완료되지 않으면 게임이 멈추지 않도록 자연스러운 내장 대사로 이어집니다.</p></div>}</div><form className="reply-row" onSubmit={sendMessage}><input aria-label="메시지" maxLength={500} autoComplete="off" value={draft} onChange={(event) => setDraft(event.target.value)} placeholder={activeResult ? '판정이 완료된 연락입니다' : sending ? '상대의 답변을 준비하고 있습니다' : '상대에게 질문하거나 직접 입력하기'} disabled={Boolean(activeResult) || sending} /><button type="submit" disabled={!draft.trim() || sending || Boolean(activeResult)}>전송</button></form></>}
                    {activeCase.mode === 'notice' && <div className="read-only-surface notice-surface"><span className="date-pill">오늘</span><article><header><span>{activeCase.channel}</span><time>{formatGameClock(9 * 60 + 8)}</time></header><div className="notice-brand"><i>{activeCase.sender.slice(0,1)}</i><div><b>{activeCase.sender}</b><small>{activeCase.handle}</small></div></div><h2>{activeCase.initialMessages[0]}</h2>{activeCase.initialMessages.slice(1).map((text) => <p key={text}>{text}</p>)}<button className="official-app-button" onClick={() => setPhoneApp(activeCase.id === 'bank-fraud-check' ? 'bank' : activeCase.id === 'official-etf-fill' ? 'stocks' : 'browser')}>메시지를 닫고 관련 앱 직접 열기</button></article></div>}
                    {activeCase.mode === 'link' && <div className="read-only-surface link-surface"><span className="date-pill">오늘</span><article className="one-way-message"><header><b>{activeCase.handle}</b><time>{formatGameClock(10 * 60 + 17)}</time></header>{activeCase.initialMessages.map((text) => <p key={text}>{text}</p>)}<button className="embedded-link" onClick={() => setOpenedLinks((current) => ({ ...current, [activeCase.id]: true }))}><span>외부 페이지</span><b>{activeCase.linkLabel}</b><small>{activeCase.displayUrl}</small></button></article>{openedLinks[activeCase.id] && <section className="simulated-landing"><div className="landing-address"><span>교육용 가상 주소</span><b>{activeCase.displayUrl}</b></div><div className="landing-copy"><small>SPONSORED INFORMATION</small><h2>{activeCase.landingTitle}</h2><p>{activeCase.landingCopy}</p><button disabled>{activeCase.landingCta}</button><span>시뮬레이션에서는 정보 제출과 결제가 실행되지 않습니다.</span></div></section>}</div>}
                  </section>
                </div>
              )}

              {phoneApp === 'calls' && <div className="native-app phone-app-body"><h2>최근 통화</h2><p className="app-lead">발신자 이름만 믿지 말고 공식 번호를 직접 찾아 다시 거세요.</p><div className="call-list">{availableCases.slice(0,5).map((item,index) => <button key={item.id} onClick={() => openCase(index)}><i>{item.sender.slice(0,1)}</i><span><b>{item.sender}</b><small>{item.channel} · {index % 2 ? '부재중' : '수신'}</small></span><em>{formatGameClock(ARRIVAL_MINUTES[index])}</em></button>)}</div></div>}

              {phoneApp === 'bank' && <div className="native-app phone-app-body bank-app"><div className="app-account"><small>새봄은행 생활계좌</small><strong>1,284,600원</strong><span>오늘 출금 45,000원</span></div><h3>최근 거래</h3><div className="transaction-list"><p><span>청년교통카드</span><b>- 45,000원</b></p><p><span>월급</span><b className="positive">+ 2,140,000원</b></p><p><span>주식 주문 연결</span><b>- 82,450원</b></p></div><div className="official-banner"><b>안심 확인</b><span>낯선 사람이 알려 준 계좌로 보내기 전, 수취인과 금융회사 등록 여부를 확인하세요.</span></div><button className="app-primary" onClick={() => { visit('bank'); setView('world'); }}>은행에서 공식 확인하기</button></div>}

              {phoneApp === 'stocks' && <div className="native-app phone-app-body stock-app"><div className="stock-index"><span>가상 종합지수</span><strong>2,614.37 <em>+0.42%</em></strong></div><h3>내 자산</h3><div className="holding"><span>안정 ETF <small>3주</small></span><b>82,450원</b></div><h3>오늘 확인한 투자 연락</h3><div className="watch-list">{availableCases.map((item, index) => ({ item, index })).filter(({ item }) => /투자|주식|공모주|금융/.test(item.category)).map(({ item, index }) => <button key={item.id} onClick={() => openCase(index)}><span>{item.sender}</span><b>{item.mode === 'notice' ? '공식 안내' : item.mode === 'link' ? '광고 링크' : '출처 확인'}</b></button>)}</div><p className="app-footnote">새 연락은 하루의 시간이 흐르면서 하나씩 추가됩니다. 종목과 금액은 모두 교육용 가상 정보입니다.</p></div>}

              {phoneApp === 'browser' && <div className="native-app phone-app-body browser-app"><div className="fake-address"><span>🔒</span><b>직접 주소 입력 또는 공식 검색</b></div><h3>안전한 확인 바로가기</h3><div className="browser-links"><button onClick={() => { visit('library'); setView('world'); }}><b>업체·공시 독립 검색</b><span>메시지 속 링크를 거치지 않고 확인</span></button><button onClick={() => { visit('police'); setView('world'); }}><b>의심 사이트 신고 조회</b><span>유사 피해와 공식 신고 경로 확인</span></button><button onClick={openVerdictPanel}><b>현재 연락 판정하기</b><span>화면을 이동하지 않고 근거·대응·확신도 제출</span></button></div><div className="search-warning">주소창의 자물쇠 표시는 통신 암호화만 뜻하며, 사이트가 안전하다는 보장은 아닙니다.</div></div>}

              {phoneApp === 'social' && <div className="native-app phone-app-body social-app"><h2>오늘의 피드</h2>{availableCases.map((item, index) => ({ item, index })).filter(({ item }) => item.channel === 'SNS').map(({ item, index }) => <button className="feed-card" key={item.id} onClick={() => openCase(index)}><span className="feed-avatar">{item.sender.slice(0,1)}</span><div><b>{item.sender}</b><small>{item.handle}</small><p>{item.preview}</p><em>광고·추천도 출처를 확인하세요</em></div></button>)}{availableCases.every((item) => item.channel !== 'SNS') && <p className="app-lead">새 게시물과 연락은 시간이 흐르면 도착합니다.</p>}</div>}

              {phoneApp === 'calendar' && <div className="native-app phone-app-body calendar-app"><div className="calendar-date"><strong>29</strong><span>8월 토요일</span></div><h3>오늘 일정</h3><ol><li><time>08:20</time><span><b>시뮬레이션 시작</b><small>첫 연락부터 차례로 확인</small></span></li><li><time>{gameTime}</time><span><b>{currentPlace.label} 조사</b><small>{activeCase.sender} 사건 · 진행 {results.length}/{cases.length}</small></span></li><li><time>하루</time><span><b>시간차 연락</b><small>판정 후 다음 연락이 도착합니다</small></span></li></ol></div>}

              {phoneApp === 'notes' && <div className="native-app phone-app-body notes-app"><h2>조사 메모</h2><div className="note-paper"><b>현재 사건 · {activeCase.sender}</b><p>{activeCase.preview}</p>{activeEvidence.length ? <ul>{activeEvidence.map((item) => <li key={item}>{item}</li>)}</ul> : <span>아직 기록된 단서가 없습니다.</span>}</div><div className="note-tip"><b>판별 원칙</b><p>연락에 포함된 링크·번호가 아니라 내가 직접 찾은 공식 경로로 교차 확인한다.</p></div></div>}

              {phoneApp === 'contacts' && <div className="native-app phone-app-body contacts-app"><h2>연락처</h2><div className="contact-directory"><button onClick={() => { visit('cafe'); setView('world'); }}><i>준</i><span><b>준호</b><small>친구 · 저장된 연락처</small></span></button><button onClick={() => { visit('bank'); setView('world'); }}><i>은</i><span><b>새봄은행 공식 상담</b><small>앱에서 직접 연결</small></span></button><button onClick={() => { visit('police'); setView('world'); }}><i>경</i><span><b>경찰서</b><small>마을 방문으로 확인</small></span></button><button onClick={() => { visit('library'); setView('world'); }}><i>도</i><span><b>정보검색 도우미</b><small>업체·공시 확인</small></span></button></div></div>}

              {phoneApp === 'safety' && (
                <div className="native-app phone-app-body safety-history">
                  <div className="safety-overview"><span className="pixel-label">TODAY&apos;S SAFETY LOG</span><h2>오늘의 판정 기록</h2><div><span><b>{results.length}</b><small>완료 사건</small></span><span><b>{accuracy}%</b><small>판정 정확도</small></span><span><b>{actionAccuracy}%</b><small>안전 대응</small></span></div></div>
                  {results.length ? <div className="safety-records">{results.map((result) => { const index = cases.findIndex((item) => item.id === result.caseId); const item = cases[index]; return <button key={result.caseId} onClick={() => openCase(index)}><i>{item.sender.slice(0,1)}</i><span><b>{item.sender}</b><small>나의 판정 {verdictLabels[result.picked]} · 대응 {responseActions.find((action) => action.id === result.action)?.label}</small></span><em className={result.correct && result.actionCorrect ? 'safe' : 'review'}>{result.correct && result.actionCorrect ? '안전' : '복습'}</em></button>; })}</div> : <div className="safety-empty"><b>아직 완료한 판정이 없습니다</b><p>현재 사건을 조사한 뒤 화면 아래의 판정하기를 누르세요.</p></div>}
                  <button className="app-primary safety-current-action" onClick={openVerdictPanel}>{activeResult ? '현재 사건 결과 보기' : '현재 사건 판정하기'}</button>
                </div>
              )}

              {phoneApp === 'settings' && <div className="settings-screen phone-app-body"><span className="pixel-label">GAME GUIDE</span><h2>게임 방법</h2><p>연락 확인 → 공식 조사 → 근거·판정·대응 선택의 순서로 진행합니다. 사건은 판정을 마칠 때마다 하나씩 도착합니다.</p><button className="guide-replay" onClick={() => setTutorialStep(0)}>게임 방법 다시 보기</button><span className="pixel-label settings-section-label">LOCAL AUTO SAVE</span><h2>기기 내 자동 저장</h2><p>사건 진행, 조사 근거와 판정 결과만 이 브라우저에 저장해 다음 방문에 이어갈 수 있습니다. 직접 입력한 대화와 AI 답변은 저장하지 않습니다.</p><div className="save-status-card" aria-live="polite"><i>✓</i><span><b>현재 진행 자동 저장 중</b><small>{savedProgress ? `${formatSavedTime(savedProgress.savedAt)} 저장 · 판정 ${savedProgress.results.length}/${cases.length}` : '첫 진행 상태를 준비 중입니다.'}</small></span></div><span className="pixel-label settings-section-label">GEMINI ASSIST AI</span><h2>Gemini 보조 AI</h2><p>대화형 사건에서만 Gemini 3.6 Flash가 최소 생각 수준으로 한국어 1~2문장을 답합니다. 키가 없거나 무료 한도·16초 제한을 넘으면 검수된 대사로 자동 전환합니다.</p><button className={`model-test ${modelState}`} onClick={checkModel} disabled={modelState === 'checking'}>{modelLabel} · 연결 시험</button><div className="ai-runtime-summary" aria-live="polite"><span><b>실행 범위</b><small>대화형 사건 {chatCaseCount}건만 보조 AI 사용</small></span><span><b>준비 상태</b><small>{modelLabel}</small></span><span><b>측정값</b><small>{lastResponseMs !== null ? `최근 답변 ${lastResponseMs}ms` : modelLoadMs !== null ? `연결 확인 ${modelLoadMs}ms` : '아직 측정 전'}</small></span>{fallbackReason && <p>{fallbackReason}</p>}</div><div className="privacy-note"><b>개인정보를 입력하지 마세요</b><span>질문은 게임 서버를 거쳐 Gemini로 전송됩니다. 링크·이메일·전화번호 형태는 서버에서 제거하며, 직접 입력한 대화와 AI 답변은 게임 진행 기록에 저장하지 않습니다.</span></div></div>}

              {phoneApp === 'photos' && <div className="native-app phone-app-body photos-app"><h2>사진</h2><p className="app-lead">시뮬레이션 기록은 실제 개인정보를 포함하지 않습니다.</p><div className="photo-grid"><figure><img src="/assets/pixel/town-map.png" alt="마을 지도 기록"/><figcaption>오늘의 마을</figcaption></figure><figure><img src="/assets/pixel/phone-wallpaper.png" alt="휴대폰 배경화면"/><figcaption>기본 배경</figcaption></figure><div className="empty-photo">+<span>증거 화면은 원본 링크와 함께 공식기관에 보관하세요.</span></div></div></div>}

              <div className="gesture-area"><button onClick={() => setPhoneApp('home')} aria-label="홈 화면으로" /></div>
            </>
          )}
        </section>
      )}

      <nav className="view-switcher" aria-label="화면 전환">
        <button className={view === 'world' ? 'active' : ''} onClick={() => setView('world')}><i>⌂</i><span>마을</span></button>
        <button className={view === 'phone' ? 'active' : ''} onClick={openPhone}><i>▣</i><span>휴대폰</span>{unreadCount > 0 && <em>{unreadCount}</em>}</button>
        <button className={`verdict-action ${showVerdictPanel ? 'active' : ''} ${objectiveStage === 2 ? 'ready' : ''}`} onClick={openVerdictPanel} aria-haspopup="dialog" aria-expanded={showVerdictPanel}><i>{activeResult ? '✓' : '!'}</i><span>{activeResult ? '결과 보기' : '판정하기'}</span>{activeEvidence.length > 0 && <em>{activeEvidence.length}</em>}</button>
      </nav>

      {showVerdictPanel && !activeResult && <div className="verdict-overlay-backdrop" role="dialog" aria-modal="true" aria-labelledby="global-verdict-title" onMouseDown={(event) => { if (event.target === event.currentTarget) setShowVerdictPanel(false); }}><section className="verdict-overlay"><header><div><span className="pixel-label">CASE {String(activeIndex + 1).padStart(2,'0')} · 어디서든 판정</span><h2 id="global-verdict-title">{activeCase.sender} 판단 등록</h2></div><button onClick={() => setShowVerdictPanel(false)} aria-label="판정창 닫기">×</button></header><div className="verdict-screen verdict-overlay-content"><div className="verdict-file"><p className="case-preview">“{activeCase.preview}”</p><div className="case-meta"><span>{activeCase.channel}</span><span>{activeCase.category}</span></div><h3>판정에 사용할 근거</h3><p className="selection-help">직접 확인한 근거를 선택하세요. 선택한 근거만 점수에 반영됩니다.</p>{activeEvidence.length ? <div className="evidence-picker">{activeEvidence.map((item) => <button key={item} className={selectedEvidence.includes(item) ? 'active' : ''} onClick={() => toggleEvidence(item)}><i>{selectedEvidence.includes(item) ? '✓' : '+'}</i><span>{item}</span></button>)}</div> : <p className="empty-note">아직 확인한 근거가 없습니다. 바로 판정할 수 있지만 공식 조사 점수는 받을 수 없습니다.</p>}<button className="back-to-world" onClick={() => { setShowVerdictPanel(false); setView('world'); }}>마을에서 더 조사하기</button></div><div className="verdict-card"><span className="pixel-label">판정과 대응</span><h2>이 연락은 무엇일까요?</h2><div className="verdict-buttons">{(['normal','caution','scam'] as Verdict[]).map((value) => <button key={value} className={picked === value ? 'active' : ''} onClick={() => setPicked(value)}>{verdictLabels[value]}</button>)}</div><h3>실제로 어떻게 행동할까요?</h3><div className="response-actions">{responseActions.map((action) => <button key={action.id} className={selectedAction === action.id ? 'active' : ''} onClick={() => setSelectedAction(action.id)}><b>{action.label}</b><small>{action.description}</small></button>)}</div><p className="confidence-label">판정 확신도 <strong>{confidence}%</strong></p><div className="confidence-buttons">{confidenceOptions.map((value) => <button key={value} className={confidence === value ? 'active' : ''} onClick={() => setConfidence(value)}>{value}%</button>)}</div><button className="submit-verdict" onClick={submitVerdict} disabled={!picked || !selectedAction}>{!picked ? '판정을 선택하세요' : !selectedAction ? '대응 행동을 선택하세요' : '판정 제출'}</button></div></div></section></div>}

      {activeAppInfo && <div className="app-info-backdrop" role="dialog" aria-modal="true" aria-labelledby="app-info-title" onMouseDown={(event) => { if (event.target === event.currentTarget) setInfoApp(null); }}><section className="app-info-sheet"><header><i className={`app-icon icon-${activeAppInfo.icon}`}/><div><span className="pixel-label">APP INFORMATION</span><h2 id="app-info-title">{activeAppInfo.label}</h2></div><button onClick={() => setInfoApp(null)} aria-label="앱 정보 닫기">×</button></header><dl><div><dt>이 앱의 역할</dt><dd>{activeAppInfo.purpose}</dd></div><div><dt>언제 사용하나요?</dt><dd>{activeAppInfo.useWhen}</dd></div><div><dt>확인할 점</dt><dd>{activeAppInfo.caution}</dd></div></dl><button className="app-info-close" onClick={() => setInfoApp(null)}>확인</button></section></div>}

      {tutorialStep !== null && <div className="tutorial-backdrop" role="dialog" aria-modal="true" aria-labelledby="tutorial-title"><section className={`tutorial-card guide-${tutorialSteps[tutorialStep].kind}`}><div className="tutorial-progress" aria-label={`${tutorialStep + 1}단계 / ${tutorialSteps.length}단계`}>{tutorialSteps.map((_, index) => <i key={index} className={index <= tutorialStep ? 'active' : ''}/>)}</div><div className="tutorial-icon">{tutorialSteps[tutorialStep].icon}</div><span className="pixel-label">{tutorialSteps[tutorialStep].eyebrow}</span><h2 id="tutorial-title">{tutorialSteps[tutorialStep].title}</h2><p>{tutorialSteps[tutorialStep].body}</p>{tutorialSteps[tutorialStep].kind === 'controls' && <div className="control-guide-grid"><article><b>PC</b><span>클릭 · Tab 이동 · Enter 실행</span><small>ESC로 열린 창 닫기</small></article><article><b>모바일</b><span>터치로 선택 · 위아래 스크롤</span><small>하단 메뉴로 화면 전환</small></article></div>}{tutorialSteps[tutorialStep].kind === 'interface' && <ol className="interface-guide"><li><i>1</i><span><b>상단 상태와 ? 도움말</b><small>시간·사건·점수와 전체 안내</small></span></li><li><i>2</i><span><b>현재 목표</b><small>지금 필요한 다음 행동</small></span></li><li><i>3</i><span><b>하단 고정 메뉴</b><small>마을 · 휴대폰 · 판정하기</small></span></li><li><i>4</i><span><b>설정과 앱 i</b><small>휴대폰 설정 및 앱별 도움말</small></span></li></ol>}{tutorialSteps[tutorialStep].kind === 'mission' && <div className="tutorial-loop"><span>연락 확인</span><i>→</i><span>공식 조사</span><i>→</i><span>판정·대응</span></div>}{tutorialSteps[tutorialStep].kind === 'places' && <div className="place-guide-grid">{locations.map((place) => <article key={place.id}><i>{locationKeys[place.id]}</i><span>{place.hint}</span></article>)}</div>}{tutorialSteps[tutorialStep].kind === 'apps' && <div className="app-guide-grid">{phoneApps.map((app) => <article key={app.id}><i className={`app-icon icon-${app.icon}`}/><span><b>{app.label}</b><small>{app.purpose}</small></span></article>)}</div>}{tutorialSteps[tutorialStep].kind === 'verdict' && <div className="tutorial-nav-demo"><span>⌂<small>마을</small></span><span>▣<small>휴대폰</small></span><span className="highlight">!<small>판정하기</small></span></div>}{tutorialSteps[tutorialStep].kind === 'score' && <div className="score-guide-grid"><span>판정<strong>45%</strong></span><span>근거<strong>25%</strong></span><span>대응<strong>20%</strong></span><span>확신도<strong>10%</strong></span></div>}<div className="tutorial-actions"><button className="tutorial-skip" onClick={closeTutorial}>건너뛰기</button><button className="tutorial-next" onClick={() => tutorialStep === tutorialSteps.length - 1 ? closeTutorial() : setTutorialStep(tutorialStep + 1)}>{tutorialStep === tutorialSteps.length - 1 ? '첫 연락 확인하기' : '다음'}</button></div></section></div>}

      {showDebrief && activeResult && <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="debrief-title" tabIndex={-1}><section className={`debrief ${activeResult.correct ? 'correct' : 'wrong'}`}><span className="pixel-label">판정 결과 · {activeCase.category}</span><h2 id="debrief-title">{activeResult.correct ? '정확한 판정입니다!' : `실제 판정은 “${verdictLabels[activeCase.verdict]}”입니다`}</h2><p>{activeCase.debrief}</p><div className="simulated-outcome"><b>이 선택이 이어졌다면</b><span>{activeCase.verdict === 'scam' ? activeResult.actionCorrect ? '연락을 끊고 신고해 추가 입금과 개인정보 노출 위험을 막을 수 있었습니다.' : '대화를 계속했다면 추가 입금이나 개인정보 요구로 피해가 커질 수 있었습니다.' : activeCase.verdict === 'caution' ? activeResult.actionCorrect ? '결정을 보류해 과도한 위험을 다시 검토할 시간을 확보했습니다.' : '서둘러 행동했다면 사기는 아니더라도 감당하기 어려운 손실로 이어질 수 있었습니다.' : activeResult.actionCorrect ? '공식 경로 확인 후 정상적인 안내를 안전하게 처리할 수 있었습니다.' : '정상 연락도 공식 경로 확인 없이 처리하면 다른 위조 연락에 취약해질 수 있습니다.'}</span></div><div className={`action-result ${activeResult.actionCorrect ? 'correct' : 'needs-review'}`}><b>{activeResult.actionCorrect ? '안전한 대응을 선택했습니다' : '대응 행동도 다시 확인해 보세요'}</b><span>나의 선택: {responseActions.find((action) => action.id === activeResult.action)?.label}</span></div><h3>확인해야 했던 핵심 단서</h3><ul>{activeCase.clueLabels.map((clue) => <li key={clue}>{clue}</li>)}</ul><div className="safe-action"><b>현실에서의 권장 행동</b><span>{activeCase.safeAction}</span></div><div className="debrief-score"><span>판정·근거·대응 점수</span><strong>{activeResult.score > 0 ? '+' : ''}{activeResult.score}</strong></div><button onClick={nextCase}>{activeIndex < availableCount - 1 ? '현재 연락으로 돌아가기' : results.length === cases.length ? '최종 결과 보기' : '다음 시간으로'}</button></section></div>}

      {complete && !showDebrief && <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="summary-title" tabIndex={-1}><section className="summary-card"><span className="pixel-label">DAY CLEAR!</span><h2 id="summary-title">{playerTitle}</h2><p className="summary-lead">판정 정확도 {accuracy}% · 안전 대응 {actionAccuracy}%</p><div className="summary-grid"><div><span>최종 점수</span><strong>{score}</strong></div><div><span>근거 판정</span><strong>{groundedCount}/{results.length}</strong></div><div><span>공식 확인</span><strong>{Object.values(evidence).flat().length}회</strong></div></div><p>사기범을 말로 이기는 것보다, 돈을 보내기 전에 독립적인 공식 경로로 확인하는 습관이 중요합니다.</p><button onClick={restart}>새로운 하루 시작</button></section></div>}
    </main>
  );
}
