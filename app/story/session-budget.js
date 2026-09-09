export const budgetKey=mode=>mode==='demo'?'whatfraud-ai-v3-demo':'whatfraud-ai-v3';
export function restoreBudget(raw,session,mode='full'){
  const empty={session,mode,counts:[0,0,0],last:0,cooldown:0,moments:/** @type {string[]} */([])};
  try{
    const value=typeof raw==='string'?JSON.parse(raw):raw;
    if(!value||!/^[a-zA-Z0-9-]{16,64}$/.test(value.session)||!Array.isArray(value.counts)||value.counts.length!==3||!value.counts.every((n,i)=>Number.isInteger(n)&&n>=0&&n<=[1,2,1][i])||![value.last,value.cooldown].every(n=>Number.isFinite(n)&&n>=0))return empty;
    return {session:value.session,mode,counts:[...value.counts],last:value.last,cooldown:value.cooldown,moments:Array.isArray(value.moments)?[...new Set(value.moments.filter(id=>['familiar-check','paper-entry','paper-withdrawal','recovery-check'].includes(id)))]:[]};
  }catch{return empty;}
}
