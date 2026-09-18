// Explicit, bounded production evaluation. Synthetic inputs only; no secrets or real user logs.
import {narratives} from '../app/story/narrative.js';
import {validateDecisionContext} from '../app/story/decision-message.js';
import {validateStoryContext} from '../app/story/one-shot.js';
if(!process.argv.includes('--allow-live')){console.log('No live requests: pass --allow-live to authorize at most five calls.');process.exit(0);}
const argument=(key,fallback)=>{const i=process.argv.indexOf('--'+key);return i>=0?process.argv[i+1]:fallback;};
const url=new URL('/api/ai-chat',argument('url',process.env.GEMINI_EVAL_URL??'https://whatfraud-demo.hoyhoy1227.chatgpt.site'));
const interval=Math.max(15000,Number(argument('interval-ms','15000'))||15000);
const count=Math.min(5,Math.max(1,Number(argument('limit','5'))||5));
function decision(chapter,stageId,sceneId,attachment,checks,text,expected){
 const stages=Object.keys(narratives[chapter].scenes);
 const choices=narratives[chapter].beats.filter(b=>b.required&&stages.indexOf(b.stage)<=stages.indexOf(stageId)).map(b=>b.options.find(o=>!o.requires)?.id??b.options[0].id);
 return {label:['사칭 계정','운영자','회복 상담'][chapter],expected,body:{contractVersion:2,inputMode:'decision-message',sceneId,caseId:['familiar-request','paper-profit','recovery-team'][chapter],stageId,attachment,choices,checks,resolved:false,joined:chapter===1,messages:[{role:'user',content:text}],userTurnCount:1}};
}
const tests=[
 decision(0,'request','familiar-check','recipient-note',['recipient'],'받는 이름이 네 이름이 아니네. 돈은 아직 안 보냈어. 원래 저장된 번호로 먼저 확인할게.','verify'),
 {label:'실제 준호',expected:'together',body:{contractVersion:2,inputMode:'story-message',sceneId:'friend',caseId:'familiar-request',stageId:'waiting',attachment:'recipient-note',resolved:true,joined:false,messages:[{role:'user',content:'돈은 안 보냈어. 네 이름으로 온 부탁인데 받는 곳이 달라서 이상했어. 이 기록을 같이 확인해 줘.'}],userTurnCount:1}},
 decision(1,'offer','paper-entry','first-notice',['official-record'],'처음에는 자료 구독이라고 했는데 왜 별도 입금 안내가 온 건가요? 아직 참여하겠다고 한 적은 없어요.','clarify'),
 {label:'지수',expected:'check',body:{contractVersion:2,inputMode:'story-message',sceneId:'peer',caseId:'paper-profit',stageId:'withdrawal',attachment:'deleted-question',resolved:false,joined:true,messages:[{role:'user',content:'지수 님 질문을 미리 보관해 뒀어요. 추가 비용에 답이 없었으니 이 내용부터 확인하고 입금은 미루는 게 좋겠어요.'}],userTurnCount:1}},
 decision(2,'offer','recovery-check','official-recovery',['official-help'],'공식 안내에는 이 선입금 절차가 없네요. 이곳에는 신청하지 않겠습니다. 더 연락하지 마세요.','refuse')
].slice(0,count);
for(const test of tests){if(!(test.body.inputMode==='decision-message'?validateDecisionContext(test.body):validateStoryContext(test.body)))throw Error('Invalid fixture: '+test.label);}
const session=crypto.randomUUID();let replies=0,failures=0;
for(const [index,test] of tests.entries()){
 if(index)await new Promise(resolve=>setTimeout(resolve,interval));
 try{
  const response=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json','Origin':url.origin,'x-whatfraud-session':session},body:JSON.stringify(test.body),signal:AbortSignal.timeout(20000)});
  const payload=await response.json();
  const problems=[];
  if(!response.ok||payload.provider!=='gemini')problems.push('HTTP '+response.status+' / '+(payload.code??payload.provider??'unknown'));
  else{
   replies++;
   if(payload.reaction!==test.expected)problems.push('intent '+payload.reaction+' expected '+test.expected);
   if(typeof payload.reply!=='string'||payload.reply.length>140||/[?？]/.test(payload.reply))problems.push('reply format');
   if(test.body.attachment!=='none'&&test.expected!=='refuse'&&typeof payload.reply==='string'&&payload.reply.length<25)problems.push('attachment reaction too generic/short');
   if(test.body.inputMode==='decision-message'&&/진행하지 않는 것이 맞|올바른 판단|잘하셨/.test(payload.reply))problems.push('NPC sounds like safety instructor');
   if(/환급.*완료|신고.*완료|돌려받았|고객님/.test(payload.reply))problems.push('unsupported fact/tone');
  }
  if(problems.length)failures++;
  console.log(JSON.stringify({label:test.label,status:response.status,provider:payload.provider,reply:payload.reply,reaction:payload.reaction,supportMode:payload.supportMode,focus:payload.focus,problems}));
  // Never retry; stop on quota/cooldown/server failure.
  if(!response.ok&&(response.status===429||response.status>=500))break;
 }catch(error){failures++;console.log(JSON.stringify({label:test.label,error:error.name}));break;}
}
console.log(JSON.stringify({maxRequests:count,providerReplies:replies,failures,intervalMs:interval}));
if(failures||replies!==tests.length)process.exitCode=1;
