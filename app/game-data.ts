import generatedCases from '../content/generated/cases.json';

export type Verdict = 'normal' | 'caution' | 'scam';
export type LocationId = 'home' | 'bank' | 'cafe' | 'police' | 'library';
export type ContactMode = 'chat' | 'notice' | 'link';
export type DialogueTopic = 'source' | 'identity' | 'risk' | 'money' | 'default';
export type DialogueEmotion = 'friendly' | 'evasive' | 'deflecting' | 'pressuring' | 'disappointed' | 'closed';
export type SceneAppId = 'messages' | 'calls' | 'bank' | 'stocks' | 'browser' | 'social' | 'calendar' | 'notes' | 'contacts' | 'safety' | 'settings' | 'photos';
export type SceneStage = 'signal' | 'pressure' | 'decision';
export type SceneTone = 'routine' | 'social' | 'warning';
export type ScenePresentation = 'notification' | 'incoming-call' | 'bank-overlay' | 'message-status';
export type SceneCondition = 'opened-link-before' | 'prolonged-chat-before' | 'unsafe-action-before' | 'any-risk-exposure';

export type SceneCueData = {
  id: string;
  app: SceneAppId;
  sender: string;
  title: string;
  detail: string;
  icon: string;
  tone: SceneTone;
  minuteOffset: number;
  stage: SceneStage;
  interference: boolean;
  presentation?: ScenePresentation;
  silenceMs?: number;
  messageState?: {
    kind: 'edited' | 'deleted';
    text: string;
  };
  condition?: SceneCondition;
};

export type DialogueProfile = {
  voice: string;
  progression: string[];
  boundaries: string[];
  quickQuestions: string[];
  fallbackByTopic: Record<DialogueTopic, string>;
  fallbackByEmotion: Record<DialogueEmotion, string>;
};

export type ContentReview = {
  sourceBasis: string[];
  adaptationScope: string;
  verdictReason: string;
  verificationPaths: string[];
  misdirection: string[];
  learningObjectives: string[];
  safetyAudit: {
    containsPersonalData: false;
    containsLiveUrl: false;
    containsOperationalCrimeInfo: false;
  };
};

export type TrainingProfile = {
  claims: { id: string; text: string }[];
  evidence: { id: string; source: LocationId; kind: 'decisive' | 'signal' | 'neutral' | 'misleading'; key: boolean; claimIds: string[]; text: string; explanation: string; supports: Verdict[]; availableAt: number }[];
  appropriateActions: ('verify' | 'pause' | 'block' | 'report')[];
  optimalSources: LocationId[];
  riskConsequence: string;
  takeaway: string;
  weakness: string;
  variant: { sender: string; preview: string };
};

export type StoryProfile = {
  title:string; time:number; tone:string; intro:string; amount:number; recipient:string; purpose:string; aiLimit:number;
  evidence:{id:string;app:string;title:string;text:string;key:boolean;type?:string;content?:string;claimedFact?:string;provenance?:string;sourceType?:'sender-attachment'|'sender-message'|'independent-record'|'player-record';claimIds?:string[];redFlags?:string[];independentCheck?:string[];availableAt?:string;missingInfo?:string}[];
  stages:{id:string;messages:{speaker:string;text:string}[];actions:{type:string;label:string}[];next?:string}[];
};

export type CaseData = {
  story: StoryProfile;
  training: TrainingProfile;
  id: string;
  sender: string;
  handle: string;
  channel: '메신저' | '문자' | '앱 알림' | 'SNS';
  mode: ContactMode;
  preview: string;
  verdict: Verdict;
  category: string;
  initialMessages: string[];
  role: string;
  npcGoal: string;
  allowedClaims: string[];
  sceneCues: SceneCueData[];
  fallbackReplies?: string[];
  dialogue?: DialogueProfile;
  checks: Partial<Record<LocationId, string>>;
  clueLabels: string[];
  debrief: string;
  safeAction: string;
  review: ContentReview;
  displayUrl?: string;
  linkLabel?: string;
  landingTitle?: string;
  landingCopy?: string;
  landingCta?: string;
};

export const locations: { id: LocationId; label: string; hint: string }[] = [
  { id: 'home', label: '집', hint: '앱 설치 기록과 대화 내용을 차분히 검토합니다.' },
  { id: 'bank', label: '은행', hint: '계좌·송금·금융회사 정보를 공식 경로로 확인합니다.' },
  { id: 'cafe', label: '카페', hint: '친구의 의견을 들을 수 있지만 항상 정확하지는 않습니다.' },
  { id: 'police', label: '경찰서', hint: '의심 번호와 사이트를 확인하고 피해를 신고합니다.' },
  { id: 'library', label: '도서관', hint: '업체 등록과 공식 홈페이지를 독립적으로 조사합니다.' },
];

export const cases = generatedCases as CaseData[];

export function validateCases(items: CaseData[]) {
  const errors: string[] = [];
  const ids = new Set<string>();
  const verdictCounts: Record<Verdict, number> = { normal: 0, caution: 0, scam: 0 };
  const modeCounts: Record<ContactMode, number> = { chat: 0, notice: 0, link: 0 };

  for (const item of items) {
    if (ids.has(item.id)) errors.push(`${item.id}: 중복된 사건 ID입니다.`);
    ids.add(item.id);
    verdictCounts[item.verdict] += 1;
    modeCounts[item.mode] += 1;

    if (!item.initialMessages.length) errors.push(`${item.id}: 표시할 최초 연락이 없습니다.`);
    if (!Array.isArray(item.sceneCues) || item.sceneCues.length < 1 || item.sceneCues.length > 5) errors.push(`${item.id}: 영화형 앱 알림이 1~5개 필요합니다.`);
    const cueIds = new Set<string>();
    let previousCueOffset = 0;
    for (const cue of item.sceneCues ?? []) {
      if (cueIds.has(cue.id)) errors.push(`${item.id}: 중복된 영화형 알림 ID ${cue.id}입니다.`);
      cueIds.add(cue.id);
      if (cue.minuteOffset <= previousCueOffset) errors.push(`${item.id}: 영화형 알림 시간은 순서대로 증가해야 합니다.`);
      previousCueOffset = cue.minuteOffset;
    }
    if (Object.keys(item.checks).length < 2) errors.push(`${item.id}: 독립 확인 장소가 2곳 이상 필요합니다.`);
    if (item.clueLabels.length < 2) errors.push(`${item.id}: 복기 단서가 2개 이상 필요합니다.`);
    if (!item.review || item.review.sourceBasis.length < 1) errors.push(`${item.id}: 실제 유형 근거가 포함된 콘텐츠 검수표가 필요합니다.`);
    if ((item.review?.verificationPaths.length ?? 0) < 2) errors.push(`${item.id}: 콘텐츠 검수표에 독립 확인 경로가 2개 이상 필요합니다.`);
    if ((item.review?.learningObjectives.length ?? 0) < 2) errors.push(`${item.id}: 학습 목표가 2개 이상 필요합니다.`);
    if (item.review && Object.values(item.review.safetyAudit).some(Boolean)) errors.push(`${item.id}: 개인정보·작동 링크·범죄 실행 정보 안전 검수를 통과하지 못했습니다.`);

    if (item.mode === 'chat') {
      if (!item.dialogue) errors.push(`${item.id}: 대화형 사건에 dialogue 설정이 없습니다.`);
      if (!item.fallbackReplies?.length) errors.push(`${item.id}: 대체 대사가 없습니다.`);
      if ((item.dialogue?.quickQuestions.length ?? 0) < 3) errors.push(`${item.id}: 추천 질문이 3개 이상 필요합니다.`);
      if ((Object.keys(item.dialogue?.fallbackByEmotion ?? {}).length) !== 6) errors.push(`${item.id}: 감정 단계별 대체 대사 6개가 필요합니다.`);
    } else if (item.dialogue || item.fallbackReplies?.length) {
      errors.push(`${item.id}: 읽기 전용 사건에는 LLM 대화 설정을 둘 수 없습니다.`);
    }

    if (item.mode === 'link') {
      if (!item.displayUrl?.endsWith('.invalid') && !item.displayUrl?.includes('.invalid/')) errors.push(`${item.id}: 링크 주소는 .invalid 가상 도메인이어야 합니다.`);
      if (!item.linkLabel || !item.landingTitle || !item.landingCopy || !item.landingCta) errors.push(`${item.id}: 링크 미리보기 필드가 부족합니다.`);
    }

    const allText = [item.preview, ...item.initialMessages, item.debrief, item.safeAction].join(' ');
    if (/https?:\/\//i.test(allText)) errors.push(`${item.id}: 검수 콘텐츠에 실제 접속 형식의 URL이 포함되어 있습니다.`);
  }

  if(items.map(item=>item.id).join(',')!=='familiar-request,paper-profit,recovery-team')errors.push('승인된 3막 순서가 아닙니다.');
  for(const item of items){
    if(item.mode!=='chat'||!item.story?.stages?.length||!item.story?.evidence?.length)errors.push(item.id+': 이야기 데이터가 없습니다.');
  }
  return errors;
}

const caseValidationErrors = validateCases(cases);
if (caseValidationErrors.length) {
  throw new Error(`시나리오 데이터 검증 실패:\n${caseValidationErrors.join('\n')}`);
}

export const verdictLabels: Record<Verdict, string> = { normal: '정상', caution: '주의', scam: '사기' };
