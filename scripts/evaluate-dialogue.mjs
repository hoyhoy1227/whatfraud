import { readFile } from 'node:fs/promises';
import path from 'node:path';

const generatedFile = path.join(process.cwd(), 'content', 'generated', 'cases.json');
const topics = ['source', 'identity', 'risk', 'money', 'default'];
const unsafePatterns = [
  { label: '실제 URL', pattern: /https?:\/\/|www\./i },
  { label: '계좌번호 형태', pattern: /계좌번호\s*[:：]?\s*\d{4}|\b\d{3,6}[- ]\d{2,6}[- ]\d{3,8}\b/i },
  { label: '전화번호 형태', pattern: /\b01[016789][ -]?\d{3,4}[ -]?\d{4}\b/ },
  { label: '역할 또는 정답 노출', pattern: /시스템 프롬프트|개발자 메시지|정답|판정 결과|나는 (?:AI|언어 모델)/i },
  { label: '범죄 실행 정보', pattern: /수사 회피|추적 피하|악성 앱 제작|대포통장|명의를 빌려/i },
];

function classifyTopic(text) {
  const normalized = text.replace(/\s+/g, '');
  if (/출처|근거|원문|공시|어디서|성과|적중률|기록/.test(normalized)) return 'source';
  if (/누구|소속|회사|등록|자격|신원|기관/.test(normalized)) return 'identity';
  if (/위험|손실|보장|틀리|확실|안전|100%/.test(normalized)) return 'risk';
  if (/돈|입금|송금|계좌|결제|출금|충전|비용/.test(normalized)) return 'money';
  return 'default';
}

function checkText(caseId, label, text, errors) {
  const trimmed = text.trim();
  if (trimmed.length < 2 || trimmed.length > 420) errors.push(`${caseId} ${label}: 길이가 2~420자 범위를 벗어났습니다.`);
  for (const rule of unsafePatterns) {
    if (rule.pattern.test(trimmed)) errors.push(`${caseId} ${label}: ${rule.label}가 포함되어 있습니다.`);
  }
}

async function main() {
  const cases = JSON.parse(await readFile(generatedFile, 'utf8'));
  const chatCases = cases.filter((item) => item.mode === 'chat');
  const errors = [];
  const exactResponses = new Map();
  let responseCount = 0;

  for (const item of chatCases) {
    const responses = [
      ...item.fallbackReplies.map((text, index) => [`fallbackReplies[${index}]`, text]),
      ...topics.map((topic) => [`fallbackByTopic.${topic}`, item.dialogue.fallbackByTopic[topic]]),
    ];

    const distinctTopicReplies = new Set(topics.map((topic) => item.dialogue.fallbackByTopic[topic].trim()));
    if (distinctTopicReplies.size < 4) errors.push(`${item.id}: 주제별 대체 응답이 지나치게 반복됩니다.`);

    const coveredTopics = new Set(item.dialogue.quickQuestions.map(classifyTopic).filter((topic) => topic !== 'default'));
    if (coveredTopics.size < 3) errors.push(`${item.id}: 추천 질문이 서로 다른 확인 주제를 3개 이상 다루어야 합니다.`);

    for (const [label, text] of responses) {
      responseCount += 1;
      checkText(item.id, label, text, errors);
      const normalized = text.trim().replace(/\s+/g, ' ');
      const previous = exactResponses.get(normalized);
      if (previous && previous !== item.id) errors.push(`${item.id} ${label}: ${previous} 사건과 동일한 대사가 반복됩니다.`);
      exactResponses.set(normalized, item.id);
    }
  }

  if (chatCases.length < 3) errors.push('대화형 평가 대상 사건이 3개 미만입니다.');
  if (errors.length) throw new Error(`대화 안전 평가 실패:\n- ${errors.join('\n- ')}`);

  console.log(`대화 안전 평가 완료: ${chatCases.length}개 사건 · ${responseCount}개 후보 응답`);
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
