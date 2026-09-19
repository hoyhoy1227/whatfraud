'use client';

import {useCallback,useEffect,useRef,useState} from 'react';

export type GameEffect='tap'|'message'|'transfer'|'result';
const STORAGE_KEY='fraud-committee:audio:v1';
const DEFAULT_MUSIC=.28,DEFAULT_EFFECTS=.45;
const clamp=(value:number)=>Math.max(0,Math.min(1,value));

type AudioWindow=Window&typeof globalThis&{webkitAudioContext?:typeof AudioContext};

export function useGameAudio(active:boolean,paused:boolean){
 const [musicVolume,setMusicVolumeState]=useState(DEFAULT_MUSIC);
 const [effectsVolume,setEffectsVolumeState]=useState(DEFAULT_EFFECTS);
 const [visible,setVisible]=useState(true);
 const [hydrated,setHydrated]=useState(false);
 const music=useRef<HTMLAudioElement|null>(null);
 const context=useRef<AudioContext|null>(null);

 useEffect(()=>{
  let live=true;
  const track=new Audio('/audio/main-ost.wav');
  track.loop=true;track.preload='metadata';music.current=track;
  let saved:{music?:unknown;effects?:unknown}|null=null;
  try{
   saved=JSON.parse(localStorage.getItem(STORAGE_KEY)??'null') as {music?:unknown;effects?:unknown}|null;
  }catch{/* Keep safe defaults when local preferences are unavailable. */}
  queueMicrotask(()=>{
   if(!live)return;
   if(saved&&typeof saved.music==='number')setMusicVolumeState(clamp(saved.music));
   if(saved&&typeof saved.effects==='number')setEffectsVolumeState(clamp(saved.effects));
   setHydrated(true);
  });
  const onVisibility=()=>setVisible(!document.hidden);
  document.addEventListener('visibilitychange',onVisibility);
  return()=>{live=false;document.removeEventListener('visibilitychange',onVisibility);track.pause();music.current=null;void context.current?.close();context.current=null;};
 },[]);

 useEffect(()=>{
  if(!hydrated)return;
  try{localStorage.setItem(STORAGE_KEY,JSON.stringify({music:musicVolume,effects:effectsVolume}));}catch{/* Audio preferences are optional. */}
 },[hydrated,musicVolume,effectsVolume]);

 useEffect(()=>{
  const track=music.current;if(!track)return;
  track.volume=musicVolume;
  if(active&&!paused&&visible&&musicVolume>0)void track.play().catch(()=>{/* A later player gesture will unlock playback. */});
  else track.pause();
 },[active,paused,visible,musicVolume]);

 const ensureContext=useCallback(()=>{
  if(typeof window==='undefined')return null;
  const Constructor=window.AudioContext||(window as AudioWindow).webkitAudioContext;
  if(!Constructor)return null;
  context.current??=new Constructor();
  if(context.current.state==='suspended')void context.current.resume();
  return context.current;
 },[]);

 const playEffect=useCallback((effect:GameEffect)=>{
  if(effectsVolume<=0)return;
  const audio=ensureContext();if(!audio)return;
  const presets:Record<GameEffect,Array<[number,number,number,OscillatorType]>>={
   tap:[[520,.035,.12,'triangle']],
   message:[[660,.12,.13,'sine'],[880,.16,.11,'sine']],
   transfer:[[330,.1,.12,'triangle'],[494,.18,.13,'sine']],
   result:[[392,.18,.1,'sine'],[523,.22,.11,'sine'],[659,.3,.1,'sine']]
  };
  const start=audio.currentTime+.005;
  presets[effect].forEach(([frequency,duration,level,wave],index)=>{
   const oscillator=audio.createOscillator(),gain=audio.createGain(),at=start+index*.075;
   oscillator.type=wave;oscillator.frequency.setValueAtTime(frequency,at);
   gain.gain.setValueAtTime(.0001,at);gain.gain.exponentialRampToValueAtTime(Math.max(.0001,level*effectsVolume),at+.012);gain.gain.exponentialRampToValueAtTime(.0001,at+duration);
   oscillator.connect(gain).connect(audio.destination);oscillator.start(at);oscillator.stop(at+duration+.02);
  });
 },[effectsVolume,ensureContext]);

 useEffect(()=>{
  const onClick=(event:MouseEvent)=>{
   const button=(event.target as Element|null)?.closest<HTMLButtonElement>('button:not(:disabled)');
   if(!button)return;
   const requested=button.dataset.sfx as GameEffect|undefined;
   playEffect(requested&&['tap','message','transfer','result'].includes(requested)?requested:'tap');
  };
  document.addEventListener('click',onClick);
  return()=>document.removeEventListener('click',onClick);
 },[playEffect]);

 const startMusic=useCallback((restart=false)=>{
  ensureContext();const track=music.current;if(!track||musicVolume<=0)return;
  if(restart)track.currentTime=0;track.volume=musicVolume;void track.play().catch(()=>{});
 },[ensureContext,musicVolume]);

 return {
  musicVolume,effectsVolume,
  setMusicVolume:(value:number)=>setMusicVolumeState(clamp(value)),
  setEffectsVolume:(value:number)=>setEffectsVolumeState(clamp(value)),
  startMusic,playEffect
 };
}
