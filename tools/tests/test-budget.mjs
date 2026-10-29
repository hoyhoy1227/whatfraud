import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFile, readdir } from 'node:fs/promises';
import ts from 'typescript';
const db = new DatabaseSync(':memory:');
for (const path of (await readdir('drizzle')).filter(path=>path.endsWith('.sql')).sort()) db.exec(await readFile('drizzle/'+path,'utf8'));
const source = (await readFile('app/api/ai-budget.ts','utf8')).replace("await import('cloudflare:workers')", "await Promise.resolve(globalThis.__testCloudflare)");
const js = ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const uri='data:text/javascript;base64,'+Buffer.from(js).toString('base64');
const modules = await Promise.all([import(uri+'#isolate-a'),import(uri+'#isolate-b')]);
globalThis.__testCloudflare={env:{DB:{prepare:sql=>({bind:(...args)=>({first:async()=>db.prepare(sql).get(...args)})})}}};
const originalNow=Date.now;
let now=1_800_000_000_000;
Date.now=()=>now;
try {
  const burst=await Promise.all(Array.from({length:40},(_,i)=>modules[i%2].reserveSharedBudget()));
  assert.equal(burst.filter(result=>result==='allowed').length,20,'independent modules must share the atomic minute cap');
  for(let minute=1;minute<12;minute++){
    now+=60_000;
    const results=await Promise.all(Array.from({length:20},()=>modules[0].reserveSharedBudget()));
    assert.equal(results.filter(result=>result==='allowed').length,20);
  }
  now+=60_000;
  assert.equal(await modules[1].reserveSharedBudget(),'exhausted','daily budget survives module restart');
  assert.equal(db.prepare('SELECT day_count FROM ai_budget WHERE id=1').get().day_count,240);
  now+=86_400_000;
  assert.equal(await modules[1].reserveSharedBudget(),'allowed');
  assert.equal(db.prepare('SELECT COUNT(*) AS count FROM ai_budget').get().count,1,'storage remains bounded without player data');
  globalThis.__testCloudflare={env:{}};
  assert.equal(await modules[0].reserveSharedBudget(),'unavailable');
  globalThis.__testCloudflare={env:{DB:{prepare:()=>{throw new Error('offline')}}}};
  assert.equal(await modules[1].reserveSharedBudget(),'unavailable');
  globalThis.__testCloudflare={env:{DB:{prepare:()=>({bind:()=>({first:()=>new Promise(()=>{})})})}}};
  assert.equal(await modules[0].reserveSharedBudget(),'unavailable');
  console.log('Shared budget tests passed: atomic concurrent reserve, UTC day rollover, restart, missing/offline/stalled DB, bounded storage.');
} finally {Date.now=originalNow;db.close();delete globalThis.__testCloudflare;}
