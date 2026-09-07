// One cancellable timer per visible message; no catch-up burst after a pause.
export function messageDelay(text, reduced=false) {
  return reduced ? 0 : Math.min(1600, Math.max(650, 450 + text.length * 22));
}
export function scheduleMessage(text,reduced,reveal,schedule=setTimeout,clear=clearTimeout) {
  let live=true;
  const timer=schedule(()=>{if(live)reveal();},messageDelay(text,reduced));
  return ()=>{live=false;clear(timer);};
}
