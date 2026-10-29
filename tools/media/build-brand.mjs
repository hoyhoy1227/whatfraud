// Deterministic typography artwork; pass a local sharp module path if not installed.
import {pathToFileURL} from 'node:url';
import {copyFile} from 'node:fs/promises';
const {default:sharp}=await import(process.argv[2]?pathToFileURL(process.argv[2]).href:'sharp');
await sharp('public/committee-thumbnail.svg').png().toFile('public/committee-og.png');
await copyFile('public/committee-og.png','public/og.png');
await copyFile('public/committee-icon.svg','public/favicon.svg');
await sharp('public/committee-thumbnail.svg').jpeg({quality:90}).toFile('public/screenshot.jpeg');
