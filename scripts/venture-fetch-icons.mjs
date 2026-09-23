#!/usr/bin/env node
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const dataset = path.join(root, 'static', 'venture-deals.seed.json');
const iconDirectory = path.join(root, 'static');
const records = JSON.parse(await readFile(dataset, 'utf8'));
await mkdir(iconDirectory, { recursive: true });

function filename(record) { return `venture-icon-${record.id.replace(/[^a-z0-9-]/gi, '-')}.jpg`; }
async function fetchIcon(record) {
  if (!record.domain) return false;
  const response = await fetch(`https://www.google.com/s2/favicons?domain=${encodeURIComponent(record.domain)}&sz=64`);
  if (!response.ok) throw new Error(`${response.status}`);
  const output = filename(record);
  await writeFile(path.join(iconDirectory, output), Buffer.from(await response.arrayBuffer()));
  record.iconPath = output;
  return true;
}

let completed = 0;
for (const record of records) {
  try { if (await fetchIcon(record)) completed += 1; }
  catch (error) { console.warn(`No icon for ${record.company}: ${error.message}`); }
}
await writeFile(dataset, `${JSON.stringify(records, null, 2)}\n`);
console.log(`Cached ${completed} favicons in ${iconDirectory}.`);
