import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';

// Current tracked tree only; report rule and path, never matching secret values.
const paths = execFileSync('git', ['ls-files', '-z'], { encoding: 'utf8' }).split('\0').filter(Boolean);
const failures = [];
const patterns = [
  ['Google key', /AIza[0-9A-Za-z_-]{35}/],
  ['GitHub token', /(?:gh[pousr]_[0-9A-Za-z]{30,}|github_pat_[0-9A-Za-z_]{40,})/],
  ['OpenAI key', /sk-(?:proj-)?[0-9A-Za-z_-]{40,}/],
  ['AWS access key', /(?:AKIA|ASIA)[0-9A-Z]{16}/],
  ['private key', /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/],
];
for (const path of paths) {
  if (/(^|\/)\.env(?:\.|$)/.test(path) && !path.endsWith('.env.example')) failures.push(path + ': tracked environment file');
  if (/\.(?:pem|p12|pfx|key)$/.test(path)) failures.push(path + ': private credential file');
  const bytes = await readFile(path);
  if (bytes.includes(0) || /\.(?:png|jpg|jpeg|webp|ico|woff2?)$/.test(path)) continue;
  const text = bytes.toString('utf8');
  for (const [name, pattern] of patterns) if (pattern.test(text)) failures.push(path + ': ' + name);
  if (path.endsWith('.env.example')) {
    for (const line of text.split('\n')) {
      if (/^\s*\w*(?:KEY|TOKEN|SECRET|PASSWORD)\w*\s*=\s*\S+/.test(line)) failures.push(path + ': nonempty secret example');
    }
  }
  if (path.startsWith('.github/workflows/')) {
    for (const match of text.matchAll(/uses:\s+([^\s#]+)/g)) {
      if (!/^[\w.-]+\/[\w./-]+@[a-f0-9]{40}$/.test(match[1])) failures.push(path + ': action is not commit-pinned');
    }
    if (/pull_request_target|permissions:\s*write-all/.test(text)) failures.push(path + ': privileged workflow');
  }
}
assert.equal(failures.length, 0, 'Security baseline failed:\n' + failures.join('\n'));
console.log('Security baseline passed: tracked-tree secret patterns and workflow pins (not a full security audit).');
