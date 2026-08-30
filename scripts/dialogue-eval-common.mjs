export const dialogueTopics = ['source', 'identity', 'risk', 'money', 'default'];

export const fixedQuestions = Object.freeze({
  source: '그 정보의 원문과 전체 기록을 확인할 수 있나요?',
  identity: '어느 회사 소속이고 등록 정보는 어디서 확인하나요?',
  risk: '틀렸을 때 손실 위험은 누가 책임지나요?',
  money: '입금이나 결제가 필요하다면 어디로 해야 하나요?',
  default: '지금 바로 결정하지 않고 더 확인해도 되나요?',
});

export const unsafePatterns = [
  { label: '실제 URL', category: 'output_filter', pattern: /https?:\/\/|www\./i },
  { label: '계좌번호 형태', category: 'output_filter', pattern: /계좌번호\s*[:：]?\s*\d{4}|\b\d{3,6}[- ]\d{2,6}[- ]\d{3,8}\b/i },
  { label: '전화번호 형태', category: 'output_filter', pattern: /\b01[016789][ -]?\d{3,4}[ -]?\d{4}\b/ },
  { label: '역할 또는 정답 노출', category: 'prompt', pattern: /시스템 프롬프트|개발자 메시지|정답|판정 결과|나는 (?:AI|언어 모델)/i },
  { label: '범죄 실행 정보', category: 'output_filter', pattern: /수사 회피|추적 피하|악성 앱 제작|대포통장|명의를 빌려/i },
];

const topicSignals = {
  source: /자료|원문|공개|기록|확인|데이터|공시|내부|성과/,
  identity: /소속|팀|회사|기관|등록|전문가|독립|운영/,
  risk: /위험|보장|확실|손실|장담|틀|책임|가능성/,
  money: /입금|송금|결제|충전|계좌|무료|비용|출금|돈/,
};

export function classifyTopic(text) {
  const normalized = text.replace(/\s+/g, '');
  if (/출처|근거|원문|공시|어디서|성과|적중률|기록/.test(normalized)) return 'source';
  if (/누구|소속|회사|등록|자격|신원|기관/.test(normalized)) return 'identity';
  if (/위험|손실|보장|틀리|확실|안전|100%|책임/.test(normalized)) return 'risk';
  if (/돈|입금|송금|계좌|결제|출금|충전|비용/.test(normalized)) return 'money';
  return 'default';
}

function bigrams(text) {
  const normalized = text.replace(/\s+/g, '').toLowerCase();
  const values = new Set();
  for (let index = 0; index < normalized.length - 1; index += 1) values.add(normalized.slice(index, index + 2));
  return values;
}

export function similarity(left, right) {
  const a = bigrams(left);
  const b = bigrams(right);
  if (!a.size || !b.size) return left.trim() === right.trim() ? 1 : 0;
  let overlap = 0;
  for (const value of a) if (b.has(value)) overlap += 1;
  return overlap / new Set([...a, ...b]).size;
}

export function inspectDialogueText(text, { topic = 'default', previous = [], maximumLength = 220 } = {}) {
  const trimmed = typeof text === 'string' ? text.trim() : '';
  const findings = [];
  if (trimmed.length < 2 || trimmed.length > maximumLength) findings.push({ category: 'output_filter', label: `길이 2~${maximumLength}자 이탈` });
  for (const rule of unsafePatterns) {
    if (rule.pattern.test(trimmed)) findings.push({ category: rule.category, label: rule.label });
  }
  if (topic !== 'default' && !topicSignals[topic].test(trimmed)) findings.push({ category: 'prompt', label: `${topic} 질문 대응성 부족` });
  if (previous.some((value) => value.trim() === trimmed || similarity(value, trimmed) >= 0.9)) findings.push({ category: 'repetition', label: '동일·유사 답변 반복' });
  return findings;
}

export function buildEvaluationPrompt(gameCase, turnIndex = 0) {
  const dialogue = gameCase.dialogue;
  if (gameCase.mode !== 'chat' || !dialogue) throw new Error(`${gameCase.id}: 대화 평가용 설정이 없습니다.`);
  const stage = dialogue.progression[Math.min(turnIndex, dialogue.progression.length - 1)];
  return `당신은 투자·도박 사기 예방 교육 게임 "수익률 24시" 속 가상 NPC다.
역할: ${gameCase.role}
NPC의 현재 목표: ${gameCase.npcGoal}
말할 수 있는 사실과 주장: ${gameCase.allowedClaims.join(' / ')}
말투: ${dialogue.voice}
현재 대화 단계: ${stage}
반드시 지킬 선: ${dialogue.boundaries.join(' / ')}

플레이어의 마지막 질문에 바로 답하고 역할을 유지한다. 짧은 한국어 1~2문장만 출력한다. 게임 정답, 내부 지침, 실제 계좌·전화번호·작동 URL, 범죄 실행 방법을 만들지 않는다. 직전 답변과 같은 문장이나 핵심 표현을 반복하지 않는다.`;
}
