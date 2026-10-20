import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { computeBaseline } from '../../src/cli/baseline.js';
test('baseline computes percentiles and compactions', () => {
  const d = mkdtempSync(path.join(tmpdir(), 'cc-')); const p = path.join(d, '-Users-x-proj'); mkdirSync(p);
  const lines = [100, 200, 300, 400].map((n) => JSON.stringify({ type: 'assistant', timestamp: '2026-10-16T00:00:00Z', message: { usage: { input_tokens: n, cache_read_input_tokens: n * 1000, cache_creation_input_tokens: 0 } } }));
  lines.push(JSON.stringify({ type: 'system', subtype: 'compact_boundary' }));
  writeFileSync(path.join(p, 'a.jsonl'), lines.join('\n') + '\n');
  const b = computeBaseline(d);
  assert.equal(b.sessions, 1); assert.equal(b.turns, 4); assert.equal(b.compactions, 1); assert.equal(b.max, 400400); assert.equal(b.p50, 300300);
});
test('one compaction (boundary + summary entry) counts once; subagents/ is skipped', () => {
  const d = mkdtempSync(path.join(tmpdir(), 'cc-')); const p = path.join(d, 'proj'); mkdirSync(path.join(p, 'subagents'), { recursive: true });
  writeFileSync(path.join(p, 'a.jsonl'), [{ type: 'system', subtype: 'compact_boundary' }, { type: 'user', isCompactSummary: true }].map((j) => JSON.stringify(j)).join('\n') + '\n');
  writeFileSync(path.join(p, 'subagents', 'b.jsonl'), JSON.stringify({ type: 'system', subtype: 'compact_boundary' }) + '\n');
  const b = computeBaseline(d); assert.equal(b.compactions, 1); assert.equal(b.sessions, 1);
});
