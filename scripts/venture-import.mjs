#!/usr/bin/env node
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';

const [input, ...flags] = process.argv.slice(2);
const replace = flags.includes('--replace');
const root = path.resolve(import.meta.dirname, '..');
const target = path.join(root, 'arc', 'venture', 'deals.json');

if (!input || flags.some((flag) => flag !== '--replace')) {
  console.error('Usage: node scripts/venture-import.mjs <deals.json> [--replace]');
  process.exit(1);
}

const required = ['id', 'company', 'date', 'stage', 'url', 'source'];
function validate(records) {
  if (!Array.isArray(records)) throw new Error('The import must be a JSON array.');
  const ids = new Set();
  records.forEach((record, index) => {
    const missing = required.filter((field) => !record[field]);
    if (missing.length) throw new Error(`Record ${index + 1} is missing: ${missing.join(', ')}.`);
    if (ids.has(record.id)) throw new Error(`Duplicate id in import: ${record.id}.`);
    ids.add(record.id);
  });
}

const incoming = JSON.parse(await readFile(path.resolve(input), 'utf8'));
validate(incoming);
let existing = [];
try { existing = JSON.parse(await readFile(target, 'utf8')); } catch (error) { if (error.code !== 'ENOENT') throw error; }
validate(existing);
const merged = replace ? incoming : [...new Map([...existing, ...incoming].map((record) => [record.id, record])).values()];
merged.sort((a, b) => b.date.localeCompare(a.date) || a.company.localeCompare(b.company));
await mkdir(path.dirname(target), { recursive: true });
const temporary = `${target}.${process.pid}.tmp`;
await writeFile(temporary, `${JSON.stringify(merged, null, 2)}\n`);
await rename(temporary, target);
console.log(`${replace ? 'Replaced' : 'Merged'} ${incoming.length} records. Stored ${merged.length} records in ${target}.`);
