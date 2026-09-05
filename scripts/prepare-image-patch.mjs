// One-time mechanical patch preparation in GitHub CI, never a runtime mutation.
import {readFile,readdir,writeFile} from 'node:fs/promises';
import {join,resolve} from 'node:path';
const root=resolve(process.argv[2]??'');
if(root!=='/tmp/whatfraud-image-patch')throw new Error('unexpected patch directory');
let boxCount=0,icnsCount=0;
for(const file of await readdir(root,{recursive:true})){
 if(!/\.(cjs|mjs)$/.test(file))continue;
 const path=join(root,file), source=await readFile(path,'utf8');
 let patched=source.replaceAll('    if (!box) break;\n    if (box.name === boxName)', '    if (!box) break;\n    if (!Number.isSafeInteger(box.size) || box.size < 8 || currentOffset + box.size > input.length) throw new TypeError("Invalid image box length");\n    if (box.name === boxName)');
 if(patched!==source)boxCount++;
 const next=patched.replace(/(      const imageHeader = readImageHeader\d*\(input, imageOffset\);)/g,'$1\n      if (imageHeader[1] < 8 || imageOffset + imageHeader[1] > Math.min(fileLength, inputLength)) throw new TypeError("Invalid ICNS entry length");');
 if(next!==patched)icnsCount++;
 if(next!==source)await writeFile(path,next);
}
if(boxCount<4||icnsCount<4)throw new Error('expected parser copies missing');
console.log('Patched bounded box readers: '+boxCount+', ICNS readers: '+icnsCount);
