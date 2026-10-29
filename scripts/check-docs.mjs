import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const files = execFileSync('git', ['ls-files', '-z'], { encoding: 'utf8' }).split('\0').filter(Boolean);
const tracked = new Set(files);
const markdown = files.filter(file => /\.md$/i.test(file));
const errors = [];
const sources = new Map();
const anchors = new Map();
let checkedLinks = 0;

function describe(file) {
  return JSON.stringify(file.length > 120 ? `${file.slice(0,117)}...` : file);
}

function prose(source) {
  let fence = null;
  return source.split(/\r?\n/).map(line => {
    const marker = line.match(/^ {0,3}(`{3,}|~{3,})/);
    if (marker) {
      if (!fence) fence = marker[1];
      else if (marker[1][0] === fence[0] && marker[1].length >= fence.length) fence = null;
      return '';
    }
    return fence ? '' : line;
  }).join('\n');
}

for (const file of files) {
  const controlCharacter = [...file].some(character => character.codePointAt(0) < 32 || character.codePointAt(0) === 127);
  if (controlCharacter || file.split('/').some(part => Buffer.byteLength(part, 'utf8') > 255)) {
    errors.push(`Invalid tracked filename: ${describe(file)}`);
  }
}

for (const file of markdown) {
  try {
    const source = new TextDecoder('utf-8', { fatal:true }).decode(readFileSync(file));
    if (source.includes('\ufffd')) errors.push(`Replacement character in ${describe(file)}`);
    const text = prose(source);
    if (!/^#\s+\S/m.test(text)) errors.push(`Missing document title: ${describe(file)}`);
    sources.set(file, text);
    const ids = new Set();
    for (const [,title] of text.matchAll(/^ {0,3}#{1,6}\s+(.+?)\s*#*\s*$/gm)) {
      const slug = title.toLowerCase().replace(/<[^>]+>/g, '').replace(/[^\p{L}\p{N}\p{M}_\-\s]/gu, '').replace(/ /g, '-');
      let id = slug;
      for (let suffix = 1; ids.has(id); suffix++) id = `${slug}-${suffix}`;
      ids.add(id);
    }
    anchors.set(file, ids);
  } catch (error) {
    errors.push(`Cannot read UTF-8 Markdown ${describe(file)}: ${error.message}`);
  }
}

for (const [file,source] of sources) {
  for (const [,raw] of source.matchAll(/!?\[[^\]\n]*\]\((<[^>]+>|[^)\n]+)\)/g)) {
    const target = raw.startsWith('<') ? raw.slice(1,-1) : raw.split(/\s+["']/)[0];
    if (/^[a-z][a-z\d+.-]*:/i.test(target) || target.startsWith('//')) continue;
    try {
      const [name,fragment] = target.split('#');
      const destination = name ? path.posix.normalize(path.posix.join(path.posix.dirname(file), decodeURIComponent(name))) : file;
      const directory = [...tracked].some(item => item.startsWith(destination.replace(/\/$/, '') + '/'));
      if (!tracked.has(destination) && !directory) {
        errors.push(`Missing local target in ${describe(file)}: ${describe(target)}`);
        continue;
      }
      if (fragment && anchors.has(destination) && !anchors.get(destination).has(decodeURIComponent(fragment))) {
        errors.push(`Missing heading in ${describe(file)}: ${describe(target)}`);
      }
      checkedLinks++;
    } catch (error) {
      errors.push(`Invalid local link in ${describe(file)}: ${error.message}`);
    }
  }
}

if (errors.length) {
  console.error(`Documentation checks failed:\n${errors.map(error => `- ${error}`).join('\n')}`);
  process.exitCode = 1;
} else {
  console.log(`Documentation checks passed: ${markdown.length} UTF-8 documents, ${checkedLinks} local links, valid tracked filenames.`);
}
