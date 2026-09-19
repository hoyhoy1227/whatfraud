import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {dirname,resolve} from 'node:path';

const source=process.argv[2];
const destination=resolve(process.argv[3]??'public/audio/main-ost.wav');
const targetRate=32000;

if(!source)throw new Error('Usage: node scripts/prepare-audio.mjs <source.wav> [destination.wav]');

const input=await readFile(resolve(source));
if(input.toString('ascii',0,4)!=='RIFF'||input.toString('ascii',8,12)!=='WAVE')throw new Error('Only RIFF/WAVE input is supported.');

let format=null,dataOffset=0,dataSize=0;
for(let offset=12;offset+8<=input.length;){
 const id=input.toString('ascii',offset,offset+4),size=input.readUInt32LE(offset+4);
 if(id==='fmt ')format={code:input.readUInt16LE(offset+8),channels:input.readUInt16LE(offset+10),rate:input.readUInt32LE(offset+12),bits:input.readUInt16LE(offset+22)};
 if(id==='data'){dataOffset=offset+8;dataSize=Math.min(size,input.length-dataOffset);break;}
 offset+=8+size+(size%2);
}
if(!format||!dataOffset)throw new Error('Required WAV chunks were not found.');
if(format.code!==1||format.bits!==16||![1,2].includes(format.channels))throw new Error('Only mono/stereo 16-bit PCM WAV is supported.');

const inputFrames=Math.floor(dataSize/(format.channels*2));
const outputFrames=Math.floor(inputFrames*targetRate/format.rate);
const pcm=Buffer.alloc(outputFrames*format.channels*2);
for(let frame=0;frame<outputFrames;frame++){
 const sourceFrame=frame*format.rate/targetRate;
 const first=Math.floor(sourceFrame),second=Math.min(inputFrames-1,first+1),mix=sourceFrame-first;
 for(let channel=0;channel<format.channels;channel++){
  const a=input.readInt16LE(dataOffset+(first*format.channels+channel)*2);
  const b=input.readInt16LE(dataOffset+(second*format.channels+channel)*2);
  pcm.writeInt16LE(Math.max(-32768,Math.min(32767,Math.round(a+(b-a)*mix))),(frame*format.channels+channel)*2);
 }
}

const output=Buffer.alloc(44+pcm.length);
output.write('RIFF',0);output.writeUInt32LE(36+pcm.length,4);output.write('WAVE',8);
output.write('fmt ',12);output.writeUInt32LE(16,16);output.writeUInt16LE(1,20);
output.writeUInt16LE(format.channels,22);output.writeUInt32LE(targetRate,24);
output.writeUInt32LE(targetRate*format.channels*2,28);output.writeUInt16LE(format.channels*2,32);output.writeUInt16LE(16,34);
output.write('data',36);output.writeUInt32LE(pcm.length,40);pcm.copy(output,44);

await mkdir(dirname(destination),{recursive:true});
await writeFile(destination,output);
console.log(`Prepared ${destination}: ${format.channels}ch ${targetRate}Hz, ${(outputFrames/targetRate).toFixed(1)}s, ${output.length} bytes`);
