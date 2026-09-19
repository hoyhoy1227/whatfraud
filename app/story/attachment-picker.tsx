'use client';
import {useState} from 'react';
import {attachmentLabel,attachmentText} from './one-shot';
export default function AttachmentPicker({value,onChange,options,disabled=false}:{value:string;onChange:(value:string)=>void;options:string[];disabled?:boolean}){
 const [open,setOpen]=useState(false);
 const items=options.filter(id=>id!=='none');
 return <div className="attachment-picker"><button type="button" disabled={disabled} aria-expanded={open} onClick={()=>setOpen(!open)}>＋ 기록 첨부</button>{open&&<fieldset disabled={disabled}><legend>이 대화에 함께 보낼 기록</legend>{items.length?items.map(id=><button type="button" key={id} aria-pressed={value===id} onClick={()=>{onChange(id);setOpen(false);}}>{attachmentLabel[id as keyof typeof attachmentLabel]}</button>):<p>아직 첨부할 기록이 없습니다. 기록 없이도 보낼 수 있습니다.</p>}<button type="button" onClick={()=>setOpen(false)}>닫기</button></fieldset>}{value!=='none'&&<div className="attachment-preview"><small>{attachmentText[value as keyof typeof attachmentText]}</small><button type="button" disabled={disabled} aria-label="첨부 제거" onClick={()=>onChange('none')}>×</button></div>}</div>;
}
