import generatedCases from '../content/generated/cases.json';

export type Verdict = 'normal' | 'caution' | 'scam';
export type LocationId = 'home' | 'bank' | 'cafe' | 'police' | 'library';
export type ContactMode = 'chat' | 'notice' | 'link';
export type DialogueTopic = 'source' | 'identity' | 'risk' | 'money' | 'default';

export type DialogueProfile = {
  voice: string;
  progression: string[];
  boundaries: string[];
  quickQuestions: string[];
  fallbackByTopic: Record<DialogueTopic, string>;
};

export type CaseData = {
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
  fallbackReplies?: string[];
  dialogue?: DialogueProfile;
  checks: Partial<Record<LocationId, string>>;
  clueLabels: string[];
  debrief: string;
  safeAction: string;
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
    if (Object.keys(item.checks).length < 2) errors.push(`${item.id}: 독립 확인 장소가 2곳 이상 필요합니다.`);
    if (item.clueLabels.length < 2) errors.push(`${item.id}: 복기 단서가 2개 이상 필요합니다.`);

    if (item.mode === 'chat') {
      if (!item.dialogue) errors.push(`${item.id}: 대화형 사건에 dialogue 설정이 없습니다.`);
      if (!item.fallbackReplies?.length) errors.push(`${item.id}: 대체 대사가 없습니다.`);
      if ((item.dialogue?.quickQuestions.length ?? 0) < 3) errors.push(`${item.id}: 추천 질문이 3개 이상 필요합니다.`);
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

  for (const verdict of Object.keys(verdictCounts) as Verdict[]) {
    if (verdictCounts[verdict] < 2) errors.push(`${verdict}: 판정 사례가 2개 미만입니다.`);
  }
  for (const mode of Object.keys(modeCounts) as ContactMode[]) {
    if (modeCounts[mode] < 2) errors.push(`${mode}: 연락 표현 사례가 2개 미만입니다.`);
  }

  return errors;
}

const caseValidationErrors = validateCases(cases);
if (caseValidationErrors.length) {
  throw new Error(`시나리오 데이터 검증 실패:\n${caseValidationErrors.join('\n')}`);
}

export const verdictLabels: Record<Verdict, string> = { normal: '정상', caution: '주의', scam: '사기' };
