import { messageEventAllowed, messageFollowupAllowed } from './one-shot.js';
import { findChoice, pendingBeat, choiceAllowed, chosenIds } from './narrative.js';
import chapters from '../../content/generated/cases.json' with { type: 'json' };

/**
 * @typedef {{type:string,chapter:number,data:string}} StoryEvent
 * @typedef {{id:string,chapter:number,amount:number,recipient:string,purpose:string,time:string}} Transaction
 * @typedef {{chapter:number,kind:string,verified:boolean,spent:number}} Resolution
 * @typedef {{version:number,mode:string,chapter:number,stage:string,visited:string[],events:StoryEvent[],transactions:Transaction[],inspected:string[],saved:string[],blocked:number[],calls:string[],cues:string[],read:string[],results:Resolution[],completed:boolean,joined:boolean}} Run
 * @typedef {{type:string,chapter:number,data:string,index:number,title:string,label:string,takeaway:{title:string,seen:boolean}[]}} Pivot
 */
export { chapters };
export const SAVE_KEY = 'whatfraud-story-v3';
export const INITIAL_BALANCE = 680000;
export const APPS = ['home', 'messages', 'calls', 'bank', 'browser', 'notes', 'settings'];
const terminal = ['verified', 'paused', 'blocked', 'reported', 'stopped', 'loss'];
const validTypes = ['advance','platform','withdraw','confirm','inspect','save','call','resolve','next','cue','read','talk','reflect','observe','capture','message','message-followup','support'];
export const currentCase = state => chapters[state.chapter];
export const currentStage = state => currentCase(state).story.stages.find(item => item.id === state.stage);
export const totalSpent = state => state.transactions.reduce((sum, tx) => sum + tx.amount, 0);
export const chapterSpent = state => state.transactions.filter(tx => tx.chapter === state.chapter).reduce((sum, tx) => sum + tx.amount, 0);
export const money = value => new Intl.NumberFormat('ko-KR').format(value) + '원';
export const gameTime = state => {
  const minute = currentCase(state).story.time + state.events.filter(e => e.chapter === state.chapter && e.type !== 'read').length;
  return String(Math.floor(minute / 60) % 24).padStart(2,'0') + ':' + String(minute % 60).padStart(2,'0');
};
/** @returns {Run} */
export function createRun(mode = 'full') {
  return { version:3, mode:mode === 'demo' ? 'demo' : 'full', chapter:mode === 'demo' ? 1 : 0,
    stage:'arrival', visited:['arrival'], events:[], transactions:[], inspected:[], saved:[],
    blocked:[], calls:[], cues:[], read:[], results:[], completed:false, joined:false };
}
export function isResolved(state) { return state.results.some(r => r.chapter === state.chapter); }
export function evidenceFor(state) {
  return chapters.slice(0,state.chapter+1).flatMap((c,index) => c.story.evidence.map(e => ({...e,chapter:index,uid:c.id+':'+e.id})));
}
export function verified(state) {
  return currentCase(state).story.evidence.filter(e=>e.key).every(e=>state.inspected.includes(currentCase(state).id+':'+e.id));
}
export function offerFor(state) {
  if (isResolved(state) || state.completed || state.blocked.includes(state.chapter)) return null;
  const c=currentCase(state);
  if (!currentStage(state).actions.some(a=>a.type==='transfer')) return null;
  const extra=state.stage==='withdrawal';
  return {id:c.id+(extra?':extra':':main'),chapter:state.chapter,amount:extra?120000:c.story.amount,
    recipient:c.story.recipient,purpose:extra?'출금 확인 비용':c.story.purpose};
}
export function recoveryContext(state) {
  if (state.transactions.some(tx=>tx.chapter<2)) return '이전 연락에서 돈이 나간 뒤다. 돌려받을 수 있다는 말에 시선이 멈춘다.';
  return state.joined ? '자료방에서 나왔지만 돈을 보내지는 않았다. 참여자 보상이라는 말이 낯설다.' : '참여한 적 없는 서비스의 안내다. 오늘의 내역을 알고 보낸 연락인지 확인할 수 없다.';
}
export function endingFor(state) {
  const loss=totalSpent(state), last=state.results.find(r=>r.chapter===2);
  if (!loss) return {title:'지켜낸 하루',line:'낯선 요청을 지나왔지만, 계좌의 돈은 제자리에 남아 있다.'};
  if (last && last.kind!=='loss') return {title:'멈춰 세운 하루',line:'돌아오지 않은 돈은 있지만, 다음 요청은 여기서 멈췄다.'};
  return {title:'아직 끝나지 않은 하루',line:'답장을 기다리는 대화가 남았다. 지금부터 할 수 있는 일도 남아 있다.'};
}
export function outcomeText(state) {
  const r=state.results.find(r=>r.chapter===state.chapter);
  if (!r) return '';
  if(r.kind==='verified') return '직접 확인한 기록을 남기고 요청을 종료했다.';
  if(r.kind==='reported') return '자료를 보관하고 공식 창구에 접수했다. 접수는 환급 완료를 뜻하지 않는다.';
  if(r.kind==='blocked') return '이 계정의 연락을 차단했다. 확인하지 못한 내용은 기록에 남아 있다.';
  if(r.kind==='paused') return '돈을 보내지 않고 결정을 미뤘다. 나중에 다시 확인할 수 있다.';
  if(r.kind==='stopped') return '추가 요청을 중단했다. 이미 나간 돈은 거래 기록에 남아 있다.';
  return '처리 중이라는 말만 남았다. 은행에는 출금 내역이 남아 있다.';
}
function move(state,id) { state.stage=id; if(!state.visited.includes(id))state.visited.push(id); }
function settle(state,kind) {
  if (isResolved(state))return false;
  if(kind==='verified'&&!verified(state))return false;
  if(kind==='reported'&&!currentCase(state).story.evidence.some(e=>state.saved.includes(currentCase(state).id+':'+e.id)))return false;
  if(kind==='paused'&&chapterSpent(state)>0)kind='stopped';
  state.results.push({chapter:state.chapter,kind,verified:verified(state),spent:chapterSpent(state)});
  return true;
}
// Pure reducer: only bounded, known semantic actions are persisted. No chat text.
/** @param {Run} input @param {StoryEvent} event @returns {Run} */
export function transition(input,event) {
  if (!input || input.completed || !event || !validTypes.includes(event.type) || event.chapter!==input.chapter) return input;
  if (input.events.length>=600) return input;
  const state=structuredClone(input), c=currentCase(state), stage=currentStage(state);
  const data=typeof event.data==='string'?event.data:'';
  let changed=false;
  const active=!isResolved(state);
  switch(event.type) {
    case 'support':
      changed=state.chapter===2&&active&&data==='recovery'&&state.events.some(e=>e.type==='message-followup'&&e.data==='friend:call')&&!state.events.some(e=>e.type==='support'&&e.data===data);break;
    case 'message':
      changed=messageEventAllowed(state,data);break;
    case 'message-followup':
      changed=messageFollowupAllowed(state,data);break;
    case 'observe': {
      const allowed=state.chapter===1&&(data==='platform-view'&&['group','offer','paid','withdrawal','extra-paid'].includes(state.stage)||data==='bank-view'&&chapterSpent(state)>0||data==='terms-comparison'&&['withdrawal','extra-paid'].includes(state.stage)&&state.visited.includes('offer'));
      if(allowed&&!state.events.some(e=>e.type==='observe'&&e.chapter===state.chapter&&e.data===data))changed=true;
      break;
    }
    case 'capture':
      if(active&&state.chapter===1&&data==='paper-question'&&['group','offer','paid'].includes(state.stage)&&!state.events.some(e=>e.type==='capture'&&e.data===data))changed=true;
      break;
    case 'talk': {
      const selected=findChoice(state.chapter,data);
      if(!active||!selected||selected.beat.stage!==state.stage||!choiceAllowed(state,selected.choice))break;
      const chosen=chosenIds(state),pending=pendingBeat(state);
      if(selected.beat.options.some(o=>chosen.includes(o.id)))break;
      if(selected.beat.required&&pending?.id!==selected.beat.id)break;
      changed=true;break;
    }
    case 'reflect':
      if(isResolved(state)&&['tell','keep'].includes(data)&&!state.events.some(e=>e.type==='reflect'&&e.chapter===state.chapter))changed=true;
      break;
    case 'advance':
      if(active&&stage.next&&stage.actions.some(a=>a.type==='advance')){if(state.chapter===1)state.joined=true;move(state,stage.next);changed=true;} break;
    case 'platform':
      if(active&&state.chapter===1&&stage.actions.some(a=>a.type==='platform')){
        state.joined=true;if(stage.id==='group')move(state,'offer');
        changed=!input.joined||input.stage!==state.stage;
      } break;
    case 'withdraw':
      if(active&&state.chapter===1&&stage.id==='paid'){move(state,'withdrawal');changed=true;} break;
    case 'confirm': {
      const offer=offerFor(state);
      if(offer&&offer.id===data&&!state.transactions.some(t=>t.id===offer.id)&&offer.amount<=INITIAL_BALANCE-totalSpent(state)){
        state.transactions.push({...offer,time:gameTime(state)});
        move(state,stage.id==='withdrawal'?'extra-paid':'paid');changed=true;
      } break;
    }
    case 'inspect':
    case 'save': {
      const e=evidenceFor(state).find(e=>e.uid===data&&e.chapter===state.chapter);
      if(!e)break;
      if(event.type==='inspect'&&!state.inspected.includes(data)){state.inspected.push(data);changed=true;}
      if(event.type==='save'&&state.inspected.includes(data)&&!state.saved.includes(data)){state.saved.push(data);changed=true;}
      break;
    }
    case 'call': {
      if(!['junho','contact','current'].includes(data)||(data==='current'&&(!active||state.blocked.includes(state.chapter))))break;
      const id=state.chapter+':'+data;
      if(!state.calls.includes(id)){
        state.calls.push(id);changed=true;
        const key=state.chapter===0&&data==='junho'?'saved-contact':state.chapter===2&&data==='contact'?'contact-history':null;
        if(key&&!state.inspected.includes(c.id+':'+key))state.inspected.push(c.id+':'+key);
      }break;
    }
    case 'resolve':
      if(active&&terminal.includes(data)){
        if(data==='loss'&&!stage.actions.some(a=>a.type==='finish'))break;
        if(data==='stopped'&&chapterSpent(state)===0)break;
        changed=settle(state,data);
        if(changed&&data==='blocked')state.blocked.push(state.chapter);
      }break;
    case 'next':
      if(isResolved(state)){
        if(state.chapter===2){state.completed=true;}
        else {state.chapter++;state.stage='arrival';state.visited=['arrival'];}
        changed=true;
      } break;
    case 'cue': {
      if(active&&data===c.id+':routine'&&!state.cues.includes(data)){state.cues.push(data);changed=true;} break;
    }
    case 'read':
      if(['current','junho','bank'].includes(data)&&!state.read.includes(state.chapter+':'+data)){state.read.push(state.chapter+':'+data);changed=true;} break;
  }
  if(!changed)return input;
  state.events.push({type:event.type,chapter:event.chapter,data});
  return state;
}
export function serializeRun(state) {
  return JSON.stringify({version:3,mode:state.mode,events:state.events});
}
// Restore by replaying known actions, never by trusting saved balance or results.
/** @returns {Run|null} */
export function restoreRun(value) {
  try {
    const raw=typeof value==='string'?JSON.parse(value):value;
    if(!raw||raw.version!==3||!['full','demo'].includes(raw.mode)||!Array.isArray(raw.events)||raw.events.length>600)return null;
    let state=createRun(raw.mode);
    for(const event of raw.events){
      if(!event||Object.keys(event).some(k=>!['type','chapter','data'].includes(k))||typeof event.data!=='string'||event.data.length>100)return null;
      const next=transition(state,event);
      if(next===state)return null;
      state=next;
    }
    return state;
  }catch{return null;}
}
export function replayBefore(state,eventIndex) {
  return restoreRun({version:3,mode:state.mode,events:state.events.slice(0,eventIndex)});
}
/** @returns {Pivot[]} */
export function timeline(state) {
  return state.events.map((event,index)=>({...event,index})).filter(e=>['confirm','call','resolve'].includes(e.type)).map(e=>{
    const c=chapters[e.chapter];
    const label=e.type==='confirm'?'가상 거래 실행':e.type==='call'?'전화 경로 확인':({verified:'독립 확인 후 종료',paused:'행동 보류',blocked:'연락 차단',reported:'기록 보관·접수',stopped:'추가 요청 중단',loss:'답변을 기다림'}[e.data]??'연락 정리');
    return {...e,title:c.story.title,label,takeaway:c.story.evidence.filter(item=>item.key).map(item=>({title:item.title,seen:state.events.slice(0,e.index).some(ev=>(ev.type==='inspect'&&ev.data===c.id+':'+item.id)||(ev.type==='call'&&ev.chapter===e.chapter&&((ev.data==='junho'&&item.id==='saved-contact')||(ev.data==='contact'&&item.id==='contact-history'))))}))};
  });
}
