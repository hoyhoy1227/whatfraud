import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { classifyTopic, dialogueTopics as topics, inspectDialogueText } from './dialogue-eval-common.mjs';

const generatedFile = path.join(process.cwd(), 'content', 'generated', 'cases.json');
const emotions = ['friendly', 'evasive', 'deflecting', 'pressuring', 'disappointed', 'closed'];

function checkText(caseId, label, text, errors) {
  for (const finding of inspectDialogueText(text, { maximumLength: 420 })) errors.push(`${caseId} ${label}: ${finding.label}가 포함되어 있습니다.`);
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
      ...emotions.map((emotion) => [`fallbackByEmotion.${emotion}`, item.dialogue.fallbackByEmotion[emotion]]),
    ];

    const distinctTopicReplies = new Set(topics.map((topic) => item.dialogue.fallbackByTopic[topic].trim()));
    if (distinctTopicReplies.size < 4) errors.push(`${item.id}: 주제별 대체 응답이 지나치게 반복됩니다.`);
    const distinctEmotionReplies = new Set(emotions.map((emotion) => item.dialogue.fallbackByEmotion[emotion].trim()));
    if (distinctEmotionReplies.size !== emotions.length) errors.push(`${item.id}: 감정 단계별 대체 응답은 모두 달라야 합니다.`);

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
