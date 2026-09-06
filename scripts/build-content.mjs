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
const sceneApps = new Set(['messages', 'calls', 'bank', 'stocks', 'browser', 'social', 'calendar', 'notes', 'contacts', 'safety', 'settings', 'photos']);
const sceneTones = new Set(['routine', 'social', 'warning']);
const sceneStages = new Set(['signal', 'pressure', 'decision']);
const scenePresentations = new Set(['notification', 'incoming-call', 'bank-overlay', 'message-status']);
const sceneConditions = new Set(['opened-link-before', 'prolonged-chat-before', 'unsafe-action-before', 'any-risk-exposure']);
const dialogueTopics = ['source', 'identity', 'risk', 'money', 'default'];
const dialogueEmotions = ['friendly', 'evasive', 'deflecting', 'pressuring', 'disappointed', 'closed'];
const commonKeys = new Set([
  'id', 'sender', 'handle', 'channel', 'mode', 'preview', 'verdict', 'category',
  'initialMessages', 'role', 'npcGoal', 'allowedClaims', 'sceneCues', 'fallbackReplies', 'dialogue',
  'checks', 'clueLabels', 'debrief', 'safeAction', 'displayUrl', 'linkLabel',
  'landingTitle', 'landingCopy', 'landingCta', 'review', 'training', 'story',
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

  if (!Array.isArray(data.sceneCues) || data.sceneCues.length < 1 || data.sceneCues.length > 5) {
    addError(errors, file, 'sceneCues에는 영화형 앱 알림이 1~5개 필요합니다.');
  } else {
    const cueIds = new Set();
    let previousOffset = 0;
    for (const cue of data.sceneCues) {
      if (!isRecord(cue)) {
        addError(errors, file, 'sceneCues의 각 항목은 객체여야 합니다.');
        continue;
      }
      for (const key of ['id', 'sender', 'title', 'detail', 'icon']) requireString(cue, key, errors, file);
      if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(cue.id ?? '')) addError(errors, file, 'sceneCues.id는 소문자 kebab-case여야 합니다.');
      if (cueIds.has(cue.id)) addError(errors, file, `sceneCues에 중복 ID ${cue.id}가 있습니다.`);
      cueIds.add(cue.id);
      if (!sceneApps.has(cue.app)) addError(errors, file, `sceneCues의 앱 ${cue.app}은 지원하지 않습니다.`);
      if (!sceneTones.has(cue.tone)) addError(errors, file, `sceneCues의 분위기 ${cue.tone}은 지원하지 않습니다.`);
      if (!sceneStages.has(cue.stage)) addError(errors, file, `sceneCues의 단계 ${cue.stage}는 지원하지 않습니다.`);
      if (!Number.isInteger(cue.minuteOffset) || cue.minuteOffset < 1 || cue.minuteOffset > 59) addError(errors, file, 'sceneCues.minuteOffset은 1~59 사이의 정수여야 합니다.');
      if (Number.isInteger(cue.minuteOffset) && cue.minuteOffset <= previousOffset) addError(errors, file, 'sceneCues.minuteOffset은 앞 알림보다 커야 합니다.');
      if (Number.isInteger(cue.minuteOffset)) previousOffset = cue.minuteOffset;
      if (typeof cue.interference !== 'boolean') addError(errors, file, 'sceneCues.interference는 불리언이어야 합니다.');
      if (cue.presentation !== undefined && !scenePresentations.has(cue.presentation)) addError(errors, file, `sceneCues의 표시 방식 ${cue.presentation}은 지원하지 않습니다.`);
      if (cue.silenceMs !== undefined && (!Number.isInteger(cue.silenceMs) || cue.silenceMs < 0 || cue.silenceMs > 3000)) addError(errors, file, 'sceneCues.silenceMs는 0~3000 사이의 정수여야 합니다.');
      if (cue.messageState !== undefined) {
        if (!isRecord(cue.messageState) || !['edited', 'deleted'].includes(cue.messageState.kind) || typeof cue.messageState.text !== 'string' || !cue.messageState.text.trim()) {
          addError(errors, file, 'sceneCues.messageState에는 edited 또는 deleted 상태와 표시 문구가 필요합니다.');
        }
        if (cue.presentation !== 'message-status' || cue.app !== 'messages') addError(errors, file, 'messageState는 messages 앱의 message-status 표시에서만 사용할 수 있습니다.');
      }
      if (cue.presentation === 'message-status' && cue.messageState === undefined) addError(errors, file, 'message-status 표시에는 messageState가 필요합니다.');
      if (cue.condition !== undefined && !sceneConditions.has(cue.condition)) addError(errors, file, `sceneCues의 등장 조건 ${cue.condition}은 지원하지 않습니다.`);
    }
  }

  const training = data.training;
  if (!training || !Array.isArray(training.claims) || training.claims.length < 3 || training.claims.length > 5 || !Array.isArray(training.evidence)) {
    addError(errors, file, '검증 주장 3~5개와 연결된 단서가 필요합니다.');
  } else {
    const ids = new Set(training.claims.map(claim => claim.id));
    if (ids.size !== training.claims.length || training.claims.some(claim => !claim.text)) addError(errors,file,'주장 ID 또는 본문이 올바르지 않습니다.');
    const clueIds = new Set();
    for (const clue of training.evidence) {
      if (!clue.id || clueIds.has(clue.id)) addError(errors,file,'단서 ID가 중복되거나 없습니다.');
      clueIds.add(clue.id);
      if (!locations.has(clue.source) || data.checks?.[clue.source] !== clue.text) addError(errors,file,'단서와 공식 확인 본문이 다릅니다.');
      if (!['decisive','signal','neutral','misleading'].includes(clue.kind) || typeof clue.key !== 'boolean') addError(errors,file,'단서 분류가 잘못됐습니다.');
      if (!Array.isArray(clue.claimIds) || !clue.claimIds.length || clue.claimIds.some(id=>!ids.has(id))) addError(errors,file,'단서가 알 수 없는 주장을 가리킵니다.');
      if (!Array.isArray(clue.supports) || clue.supports.some(value=>!verdicts.has(value))) addError(errors,file,'단서의 지지 결론이 잘못됐습니다.');
      if (!clue.explanation || !Number.isInteger(clue.availableAt) || clue.availableAt < 0) addError(errors,file,'단서의 복기 설명과 등장 시점이 필요합니다.');
    }
    const keys = training.evidence.filter(clue=>clue.key);
    if (keys.length < 2 || keys.length > 3 || !training.evidence.some(clue=>['neutral','misleading'].includes(clue.kind))) addError(errors,file,'핵심 단서 2~3개와 중립·반대 정보가 필요합니다.');
    if (!Array.isArray(training.appropriateActions) || training.appropriateActions.length < 1 || training.appropriateActions.length > 2 || training.appropriateActions.some(value=>!['verify','pause','block','report'].includes(value))) addError(errors,file,'적절한 대응 1~2개가 필요합니다.');
    if (!Array.isArray(training.optimalSources) || keys.some(clue=>!training.optimalSources.includes(clue.source))) addError(errors,file,'최소 확인 경로가 핵심 단서와 연결되지 않습니다.');
    for (const key of ['riskConsequence','takeaway','weakness']) requireString(training,key,errors,file);
    if (!training.variant?.sender || !training.variant?.preview) addError(errors,file,'재훈련용 표현 변형이 필요합니다.');
  }

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
      if (!isRecord(data.dialogue.fallbackByEmotion)) {
        addError(errors, file, 'dialogue.fallbackByEmotion 객체가 필요합니다.');
      } else {
        for (const emotion of dialogueEmotions) requireString(data.dialogue.fallbackByEmotion, emotion, errors, file);
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


function validateStory(c,errors){
  const fail=message=>errors.push(c.id+': '+message),s=c.story;
  if(!s||typeof s!=='object'){fail('story missing');return;}
  for(const key of ['title','tone','intro','recipient','purpose'])if(typeof s[key]!=='string'||!s[key].trim())fail(key+' missing');
  if(!Number.isInteger(s.time)||s.time<0||s.time>1439)fail('invalid time');
  if(!Number.isInteger(s.amount)||s.amount<=0||s.amount>680000)fail('invalid amount');
  if(s.aiLimit!==(c.id==='paper-profit'?2:1))fail('AI budget must be 1/2/1');
  if(!Array.isArray(s.evidence)||s.evidence.length<3||s.evidence.length>5){fail('evidence count');return;}
  const eids=new Set();
  for(const e of s.evidence){
    if(eids.has(e.id)||!['messages','calls','bank','browser'].includes(e.app)||typeof e.key!=='boolean'||!e.title||!e.text)fail('invalid evidence');
    eids.add(e.id);
  }
  if(s.evidence.filter(e=>e.key).length<2||!s.evidence.some(e=>!e.key))fail('independent and neutral records required');
  if(!Array.isArray(s.stages)||s.stages.length<3){fail('stages missing');return;}
  const ids=s.stages.map(stage=>stage.id),allowed=['advance','platform','withdraw','transfer','help','stop','finish'];
  if(new Set(ids).size!==ids.length||ids[0]!=='arrival'||!ids.includes('paid'))fail('stage IDs');
  for(const stage of s.stages){
    if(!Array.isArray(stage.messages)||!stage.messages.length||stage.messages.some(m=>typeof m.text!=='string'||!m.text.trim()||!m.speaker))fail('stage messages');
    if(!Array.isArray(stage.actions)||!stage.actions.length||stage.actions.some(a=>!allowed.includes(a.type)||!a.label))fail('stage actions');
    if(stage.next&&!ids.includes(stage.next))fail('dangling stage');
    if(stage.actions.some(a=>a.type==='advance')&&!stage.next)fail('advance without target');
  }
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

  if(cases.map(c=>c.id).join(',')!=='familiar-request,paper-profit,recovery-team')errors.push('승인된 세 이야기의 순서가 아닙니다.');
  for (const c of cases) validateStory(c,errors);
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
