import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const casesDirectory = path.join(root, 'content', 'cases');
const generatedDirectory = path.join(root, 'content', 'generated');
const generatedFile = path.join(generatedDirectory, 'cases.json');
const checkOnly = process.argv.includes('--check');

const verdicts = new Set(['normal', 'caution', 'scam']);
const modes = new Set(['chat', 'notice', 'link']);
const channels = new Set(['메신저', '문자', '앱 알림', 'SNS']);
const locations = new Set(['home', 'bank', 'cafe', 'police', 'library']);
const dialogueTopics = ['source', 'identity', 'risk', 'money', 'default'];
const commonKeys = new Set([
  'id', 'sender', 'handle', 'channel', 'mode', 'preview', 'verdict', 'category',
  'initialMessages', 'role', 'npcGoal', 'allowedClaims', 'fallbackReplies', 'dialogue',
  'checks', 'clueLabels', 'debrief', 'safeAction', 'displayUrl', 'linkLabel',
  'landingTitle', 'landingCopy', 'landingCta', 'review',
]);

function isRecord(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function addError(errors, file, message) {
  errors.push(`${file}: ${message}`);
}

function requireString(data, key, errors, file) {
  if (typeof data[key] !== 'string' || !data[key].trim()) addError(errors, file, `${key}는 비어 있지 않은 문자열이어야 합니다.`);
}

function requireStringArray(data, key, minimum, errors, file) {
  if (!Array.isArray(data[key]) || data[key].length < minimum || data[key].some((value) => typeof value !== 'string' || !value.trim())) {
    addError(errors, file, `${key}에는 문자열이 ${minimum}개 이상 필요합니다.`);
  }
}

function validateCase(data, file, errors) {
  if (!isRecord(data)) {
    addError(errors, file, '사건 파일의 최상위 값은 객체여야 합니다.');
    return;
  }

  for (const key of Object.keys(data)) {
    if (!commonKeys.has(key)) addError(errors, file, `허용되지 않은 필드 ${key}가 있습니다.`);
  }

  for (const key of ['id', 'sender', 'handle', 'preview', 'category', 'role', 'npcGoal', 'debrief', 'safeAction']) {
    requireString(data, key, errors, file);
  }
  requireStringArray(data, 'initialMessages', 1, errors, file);
  requireStringArray(data, 'allowedClaims', 1, errors, file);
  requireStringArray(data, 'clueLabels', 2, errors, file);

  if (!isRecord(data.review)) {
    addError(errors, file, 'review 콘텐츠 검수표가 필요합니다.');
  } else {
    requireStringArray(data.review, 'sourceBasis', 1, errors, file);
    requireString(data.review, 'adaptationScope', errors, file);
    requireString(data.review, 'verdictReason', errors, file);
    requireStringArray(data.review, 'verificationPaths', 2, errors, file);
    requireStringArray(data.review, 'misdirection', 1, errors, file);
    requireStringArray(data.review, 'learningObjectives', 2, errors, file);
    if (!isRecord(data.review.safetyAudit)) {
      addError(errors, file, 'review.safetyAudit 객체가 필요합니다.');
    } else {
      for (const key of ['containsPersonalData', 'containsLiveUrl', 'containsOperationalCrimeInfo']) {
        if (data.review.safetyAudit[key] !== false) addError(errors, file, `review.safetyAudit.${key}는 검수 완료를 뜻하는 false여야 합니다.`);
      }
    }
    if (new Set(data.review.verificationPaths ?? []).size !== (data.review.verificationPaths ?? []).length) {
      addError(errors, file, 'review.verificationPaths에는 서로 다른 독립 확인 경로가 필요합니다.');
    }
  }

  if (!verdicts.has(data.verdict)) addError(errors, file, 'verdict는 normal, caution, scam 중 하나여야 합니다.');
  if (!modes.has(data.mode)) addError(errors, file, 'mode는 chat, notice, link 중 하나여야 합니다.');
  if (!channels.has(data.channel)) addError(errors, file, '지원하지 않는 channel입니다.');
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(data.id ?? '')) addError(errors, file, 'id는 소문자 kebab-case여야 합니다.');

  if (!isRecord(data.checks)) {
    addError(errors, file, 'checks는 장소별 확인 결과 객체여야 합니다.');
  } else {
    const entries = Object.entries(data.checks);
    if (entries.length < 2) addError(errors, file, 'checks에는 독립 확인 장소가 2곳 이상 필요합니다.');
    for (const [location, value] of entries) {
      if (!locations.has(location)) addError(errors, file, `지원하지 않는 확인 장소 ${location}가 있습니다.`);
      if (typeof value !== 'string' || !value.trim()) addError(errors, file, `${location} 확인 결과가 비어 있습니다.`);
    }
  }

  if (data.mode === 'chat') {
    requireStringArray(data, 'fallbackReplies', 1, errors, file);
    if (!isRecord(data.dialogue)) {
      addError(errors, file, '대화형 사건에는 dialogue 객체가 필요합니다.');
    } else {
      requireString(data.dialogue, 'voice', errors, file);
      requireStringArray(data.dialogue, 'progression', 2, errors, file);
      requireStringArray(data.dialogue, 'boundaries', 2, errors, file);
      requireStringArray(data.dialogue, 'quickQuestions', 3, errors, file);
      if (!isRecord(data.dialogue.fallbackByTopic)) {
        addError(errors, file, 'dialogue.fallbackByTopic 객체가 필요합니다.');
      } else {
        for (const topic of dialogueTopics) requireString(data.dialogue.fallbackByTopic, topic, errors, file);
      }
    }
  } else if (data.dialogue !== undefined || data.fallbackReplies !== undefined) {
    addError(errors, file, '읽기 전용 사건에는 dialogue 또는 fallbackReplies를 둘 수 없습니다.');
  }

  const linkKeys = ['displayUrl', 'linkLabel', 'landingTitle', 'landingCopy', 'landingCta'];
  if (data.mode === 'link') {
    for (const key of linkKeys) requireString(data, key, errors, file);
    if (typeof data.displayUrl === 'string' && !/^[a-z0-9.-]+\.invalid(?:\/[^\s]*)?$/i.test(data.displayUrl)) {
      addError(errors, file, 'displayUrl은 접속 불가능한 .invalid 도메인이어야 합니다.');
    }
  } else if (linkKeys.some((key) => data[key] !== undefined)) {
    addError(errors, file, 'link가 아닌 사건에는 링크 미리보기 필드를 둘 수 없습니다.');
  }

  if (/https?:\/\//i.test(JSON.stringify(data))) addError(errors, file, '실제 접속 형식의 URL이 포함되어 있습니다.');
  if (/\b\d{2,4}[- ]\d{3,4}[- ]\d{4}\b/.test(JSON.stringify(data))) addError(errors, file, '실존 개인정보로 오인할 수 있는 전화번호 형태가 포함되어 있습니다.');
}

async function main() {
  const fileNames = (await readdir(casesDirectory)).filter((file) => file.endsWith('.json')).sort();
  const errors = [];
  const cases = [];
  const ids = new Set();
  const verdictCounts = { normal: 0, caution: 0, scam: 0 };
  const modeCounts = { chat: 0, notice: 0, link: 0 };

  if (!fileNames.length) throw new Error('content/cases에 사건 JSON 파일이 없습니다.');

  for (const file of fileNames) {
    let data;
    try {
      data = JSON.parse(await readFile(path.join(casesDirectory, file), 'utf8'));
    } catch (error) {
      addError(errors, file, `JSON을 읽을 수 없습니다: ${error.message}`);
      continue;
    }
    validateCase(data, file, errors);
    if (ids.has(data.id)) addError(errors, file, `중복된 사건 ID ${data.id}입니다.`);
    ids.add(data.id);
    if (verdictCounts[data.verdict] !== undefined) verdictCounts[data.verdict] += 1;
    if (modeCounts[data.mode] !== undefined) modeCounts[data.mode] += 1;
    cases.push(data);
  }

  for (const [verdict, count] of Object.entries(verdictCounts)) {
    if (count < 2) errors.push(`${verdict}: 판정 사례가 2개 미만입니다.`);
  }
  for (const [mode, count] of Object.entries(modeCounts)) {
    if (count < 2) errors.push(`${mode}: 연락 표현 사례가 2개 미만입니다.`);
  }

  if (errors.length) throw new Error(`콘텐츠 검증 실패:\n- ${errors.join('\n- ')}`);

  const output = `${JSON.stringify(cases, null, 2)}\n`;
  let current = '';
  try {
    current = await readFile(generatedFile, 'utf8');
  } catch {}

  if (checkOnly) {
    if (current !== output) throw new Error('content/generated/cases.json이 최신 상태가 아닙니다. pnpm content:build를 실행하세요.');
    console.log(`콘텐츠 검증 완료: ${cases.length}개 사건`);
    return;
  }

  await mkdir(generatedDirectory, { recursive: true });
  if (current !== output) await writeFile(generatedFile, output, 'utf8');
  console.log(`콘텐츠 통합 완료: ${cases.length}개 사건 → content/generated/cases.json`);
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
