import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFileSync,readdirSync} from 'node:fs';
import {dirname,join} from 'node:path';
import {spawnSync} from 'node:child_process';
const req=createRequire(import.meta.resolve('vinext'));
const entry=req.resolve('image-size'),root=dirname(entry);
let boxes=0,icons=0;
for(const file of readdirSync(root,{recursive:true}).filter(file=>/\.(cjs|mjs)$/.test(file))){
 const source=readFileSync(join(root,file),'utf8');
 if(source.includes('if (box.name === boxName)')){
  assert.ok(source.includes('box.size < 8 || currentOffset + box.size > input.length'),'every compiled box parser must be bounded: '+file);boxes++;
 }
 if(/const imageHeader = readImageHeader\d*\(input, imageOffset\)/.test(source)){
  assert.ok(source.includes('imageHeader[1] < 8 || imageOffset + imageHeader[1] > Math.min(fileLength, inputLength)'),'every compiled ICNS parser must be bounded: '+file);icons++;
 }
}
assert.ok(boxes>=4&&icons>=4);
const testSource=String.raw`
const assert=require('node:assert/strict'),{pathToFileURL}=require('node:url');
(async()=>{
const imported=await import(pathToFileURL(process.argv[1].replace(/cjs$/,'mjs')));
const cjs=require(process.argv[1]);
const icns=Buffer.alloc(16);icns.write('icns');icns.writeUInt32BE(16,4);icns.write('icp4',8);
const heif=Buffer.alloc(32);heif.writeUInt32BE(24,0);heif.write('ftyp',4);heif.write('heic',8);heif.write('meta',28);
const jxl=Buffer.alloc(44);jxl.writeUInt32BE(12,0);jxl.write('JXL ',4);jxl.writeUInt32BE(20,12);jxl.write('ftyp',16);jxl.write('jxl ',20);jxl.write('jxlp',36);
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/l9sAAAAASUVORK5CYII=','base64');
for(const api of [cjs,imported]){
 for(const input of [icns,heif,jxl])assert.throws(()=>api.imageSize(input),/Invalid/);
 assert.equal(api.imageSize(png).width,1);
 assert.equal(api.imageSize(png).height,1);
}
})().catch(error=>{console.error(error.message);process.exitCode=1;});
`;
const child=spawnSync(process.execPath,['-e',testSource,entry],{timeout:4000,encoding:'utf8'});
assert.ifError(child.error);assert.equal(child.status,0,child.stderr);
console.log('Image parser mitigation passed: all compiled copies, malformed ICNS/HEIF/JXL terminate, PNG preserved, CJS and ESM.');
