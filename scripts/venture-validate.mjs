#!/usr/bin/env node
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const records = JSON.parse(await readFile(new URL('../static/venture-deals.seed.json', import.meta.url), 'utf8'));
assert.ok(Array.isArray(records) && records.length > 0, 'Seed data must be a non-empty array.');
const ids = new Set();
for (const record of records) {
  for (const field of ['id', 'company', 'date', 'stage', 'url', 'source']) assert.ok(record[field], `${record.id || 'unknown'} requires ${field}`);
  assert.match(record.date, /^\d{4}-\d{2}-\d{2}$/, `${record.id} must have an ISO date`);
  assert.ok(!ids.has(record.id), `Duplicate id: ${record.id}`);
  ids.add(record.id);
}
console.log(`Validated ${records.length} venture deal records.`);
