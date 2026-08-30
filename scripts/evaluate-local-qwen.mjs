import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { buildEvaluationPrompt, dialogueTopics, fixedQuestions, inspectDialogueText } from './dialogue-eval-common.mjs';

const generatedFile = path.join(process.cwd(), 'content', 'generated', 'cases.json');

function argument(name, fallback) {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

const endpoint = argument('url', process.env.QWEN_EVAL_URL ?? 'http://127.0.0.1:8080/v1/chat/completions');
const model = argument('model', process.env.QWEN_EVAL_MODEL ?? 'qwen-local');
const runs = Number(argument('runs', '20'));
const timeoutMs = Number(argument('timeout', '8000'));

if (!Number.isInteger(runs) || runs < 1 || runs > 100) throw new Error('--runs는 1~100 사이 정수여야 합니다.');
if (!Number.isInteger(timeoutMs) || timeoutMs < 1000 || timeoutMs > 60000) throw new Error('--timeout은 1000~60000 사이 정수여야 합니다.');

async function request(gameCase, topic, turnIndex) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        model,
        temperature: 0.6,
        top_p: 0.85,
        max_tokens: 64,
        stream: false,
        messages: [
          { role: 'system', content: buildEvaluationPrompt(gameCase, turnIndex) },
          { role: 'user', content: fixedQuestions[topic] },
        ],
      }),
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const payload = await response.json();
    const content = payload?.choices?.[0]?.message?.content;
    if (typeof content !== 'string' || !content.trim()) throw new Error('응답 본문 없음');
    return content.trim();
  } finally {
    clearTimeout(timer);
  }
}

function percentage(value, total) {
  return total ? Math.round((value / total) * 100) : 0;
}

async function main() {
  const cases = JSON.parse(await readFile(generatedFile, 'utf8'));
  const chatCases = cases.filter((item) => item.mode === 'chat');
  if (!chatCases.length) throw new Error('대화형 사건이 없습니다.');

  try {
    await request(chatCases[0], 'default', 0);
  } catch (error) {
    const reason = error.name === 'AbortError' ? '응답 시간 초과' : error.message;
    throw new Error(`로컬 Qwen 사전 연결 시험 실패: ${reason}`);
  }

  const totals = { attempts: 0, accepted: 0, runtime: 0, prompt: 0, data: 0, output_filter: 0, repetition: 0 };
  const summaries = [];

  for (const gameCase of chatCases) {
    const caseTotals = { attempts: 0, accepted: 0, runtime: 0, prompt: 0, data: 0, output_filter: 0, repetition: 0 };
    const previousByTopic = Object.fromEntries(dialogueTopics.map((topic) => [topic, []]));
    if (!gameCase.dialogue || gameCase.allowedClaims.length < 1 || gameCase.dialogue.boundaries.length < 2) {
      caseTotals.data += 1;
      totals.data += 1;
    }
    for (let run = 0; run < runs; run += 1) {
      for (const [topicIndex, topic] of dialogueTopics.entries()) {
        caseTotals.attempts += 1;
        totals.attempts += 1;
        try {
          const output = await request(gameCase, topic, topicIndex);
          const findings = inspectDialogueText(output, { topic, previous: previousByTopic[topic], maximumLength: 220 });
          previousByTopic[topic].push(output);
          if (!findings.length) {
            caseTotals.accepted += 1;
            totals.accepted += 1;
          } else {
            for (const category of new Set(findings.map((finding) => finding.category))) {
              caseTotals[category] += 1;
              totals[category] += 1;
            }
          }
        } catch {
          caseTotals.runtime += 1;
          totals.runtime += 1;
        }
      }
    }
    summaries.push({ id: gameCase.id, ...caseTotals });
  }

  console.log(`로컬 Qwen 비저장 반복 평가: ${chatCases.length}개 사건 · 사건당 ${runs}회 · 총 ${totals.attempts}응답`);
  for (const item of summaries) {
    console.log(`- ${item.id}: 통과 ${percentage(item.accepted, item.attempts)}% · 실행 ${item.runtime} · 프롬프트 ${item.prompt} · 데이터 ${item.data} · 필터 ${item.output_filter} · 반복 ${item.repetition}`);
  }
  console.log(`전체 통과 ${percentage(totals.accepted, totals.attempts)}% · 실행 ${totals.runtime} · 프롬프트 ${totals.prompt} · 데이터 ${totals.data} · 필터 ${totals.output_filter} · 반복 ${totals.repetition}`);
  console.log('분류 기준: 실행=연결·시간·프로토콜, 프롬프트=역할·질문 대응, 데이터=사건 설정 누락, 필터=길이·개인정보·URL·범죄 정보, 반복=동일·유사 문장');

  const passRate = totals.accepted / Math.max(totals.attempts, 1);
  if (totals.runtime > 0 || totals.data > 0 || totals.output_filter > 0 || passRate < 0.8) {
    throw new Error('로컬 Qwen 평가 기준을 충족하지 못했습니다. 위 분류별 수치를 먼저 개선하세요.');
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
