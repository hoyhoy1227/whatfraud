import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
await import('./test-image-parser.mjs');
const result=spawnSync('pnpm',['audit','--json'],{encoding:'utf8',timeout:60000,maxBuffer:8*1024*1024});
assert.ifError(result.error);
const report=JSON.parse(result.stdout);
assert.ok(report.metadata?.vulnerabilities && report.advisories && typeof report.advisories==='object','audit response missing expected metadata');
assert.ok(result.status===0||result.status===1,'audit execution failed');
const allowed=new Set(['GHSA-w3rx-r6r6-pgpr','GHSA-5p2g-fcmc-qvqq']);
const workspace=readFileSync('pnpm-workspace.yaml','utf8');
assert.ok(workspace.includes('image-size@2.0.2')&&workspace.includes('patches/image-size@2.0.2.patch'),'required pinned parser patch is missing');
const remaining=[],mitigated=[];
for(const advisory of Object.values(report.advisories)){
 const id=advisory.github_advisory_id??String(advisory.url??'').split('/').at(-1);
 if(advisory.module_name==='image-size'&&allowed.has(id))mitigated.push(id);
 else remaining.push({id,package:advisory.module_name,severity:advisory.severity});
}
console.log(JSON.stringify({unmitigated:remaining,locallyMitigated:[...new Set(mitigated)]}));
assert.equal(remaining.length,0,'unmitigated dependency advisories remain');
console.log('Dependency gate passed. Version-based image-size advisories remain visible above; they are mitigated by the tested committed patch, not an upstream release.');
