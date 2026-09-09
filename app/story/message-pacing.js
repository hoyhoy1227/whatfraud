// One cancellable timer per visible message; no catch-up burst after a pause.
export function messageDelay(text, reduced=false) {
  return reduced ? 0 : Math.min(1600, Math.max(650, 450 + text.length * 22));
}
export function scheduleMessage(text,reduced,reveal,schedule=setTimeout,clear=clearTimeout,speaker='') {
  let live=true;
  const timer=schedule(()=>{if(live)reveal();},messageDelay(text,reduced)*(speaker==='준호'?0.85:speaker==='회복 지원 상담'?1.15:1));
  return ()=>{live=false;clear(timer);};
}
