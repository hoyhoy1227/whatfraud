import type {ReactNode} from 'react';

export function messageSentences(text:string){
  return text.split(/\n+|(?<=[.!?。！？])\s+/u).map(part=>part.trim()).filter(Boolean);
}

export function ChatBubbles({text,speaker='',children,showSender=true}:{text:string;speaker?:string;children?:ReactNode;showSender?:boolean}){
  const parts=messageSentences(text);
  return <div className={'message-group'+(speaker==='나'?' outgoing':'')} data-person={speaker}>
    {showSender&&speaker&&speaker!=='나'&&<div className="message-sender"><span className="avatar" data-person={speaker} aria-hidden="true">{speaker.slice(0,1)}</span><small>{speaker}</small></div>}
    {parts.map((part,index)=><div className={'bubble'+(speaker==='나'?' mine':'')} key={index}><p>{part}</p>{index===parts.length-1&&children}</div>)}
  </div>;
}
