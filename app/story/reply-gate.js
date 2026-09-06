// Owns request cancellation and ignores responses from a departed scene.
export class ReplyGate {
  constructor(){this.sequence=0;this.pending=null;}
  cancel(){this.sequence++;this.pending?.abort();this.pending=null;}
  async run(work,accept){
    if(this.pending)return false;
    const controller=new AbortController(),sequence=++this.sequence;
    this.pending=controller;
    try {
      const value=await work(controller.signal);
      if(sequence===this.sequence&&!controller.signal.aborted)accept(value);
    }catch(error){if(!controller.signal.aborted)throw error;}
    finally{if(sequence===this.sequence)this.pending=null;}
    return true;
  }
}
