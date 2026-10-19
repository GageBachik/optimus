import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, existsSync, readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import path from 'node:path';
process.env.PROJECT_MEMORY_HOME = mkdtempSync(path.join(tmpdir(), 'pm-')); process.env.PROJECT_MEMORY_BANK = mkdtempSync(path.join(tmpdir(), 'bank-'));
const { extractTaskState } = await import('../../src/compaction/task-state.js');
const { buildDrafts, writeDrafts } = await import('../../src/compaction/drafts.js');
const { lastSessionSection } = await import('../../src/kb/brief.js');
const { paths } = await import('../../src/lib/paths.js');
const { openDb } = await import('../../src/kb/db.js');
const { installTemplate } = await import('../../src/kb/templates.js');
const { loadTemplate } = await import('../../src/kb/templates-yaml.js');
const a = (text: string) => ({ type: 'assistant', message: { role: 'assistant', content: [{ type: 'text', text }] } });
const call = (i: number) => ({ type: 'assistant', message: { role: 'assistant', content: [{ type: 'tool_use', id: `t${i}`, name: 'Bash', input: { command: `echo ${i}` } }] } });
const u = (text: string) => ({ type: 'user', message: { role: 'user', content: text } });

test('values survive a tail of tool-only turns and keep their sentence', () => {
  const entries = [u('backtest the gap fade'), a('Walk-forward on 255 days: 17% win rate, worst day -$83,636, Sharpe 1.4 on 23 fills.\nNext I will run rank30.'), ...Array.from({ length: 30 }, (_, i) => call(i))];
  const ts = extractTaskState(entries as any, []);
  assert.equal(ts.exactValues.length, 1); assert.match(ts.exactValues[0], /17% win rate, worst day -\$83,636, Sharpe 1.4 on 23 fills/);
});

test('drafts: one finding per distinct value line, written as a kb write spec that kb write accepts', () => {
  const cwd = mkdtempSync(path.join(tmpdir(), 'proj-')); writeFileSync(path.join(cwd, '.kb.json'), JSON.stringify({ project_id: 'es', domain: 'trading' }));
  const tp = path.join(cwd, 'transcript.jsonl'); writeFileSync(tp, '');
  const ts = extractTaskState([u('go'), a('Fixed-fractional 0.5% beat fixed lot: Sharpe 1.4 vs 0.9 over 2019-2025.'), a('Fixed-fractional 0.5% beat fixed lot: Sharpe 1.4 vs 0.9 over 2019-2025.'), a('Slippage model at 2 bps cut PnL by $4,120 on 593 fills.'), a('ok')] as any, []);
  const spec = buildDrafts({ project_id: 'es', domain: 'trading' }, ts, tp, new Date('2026-10-19T12:00:00Z'));
  assert.equal(spec.records.length, 2); assert.equal(spec.records[0].attrs.state, 'observed'); assert.equal(spec.records[0].evidence[0].kind, 'transcript');
  const key = paths.projectKey(cwd); const w = writeDrafts(key, spec)!; assert.equal(w.count, 2); assert.ok(existsSync(w.file));
  const sec = lastSessionSection(key); assert.deepEqual(sec, []); // no last-session record yet: the drafts line rides on it
  const db = openDb(); installTemplate(db, loadTemplate('templates/trading.yaml')); db.sql.close();
  const r = spawnSync(process.execPath, ['dist/kb.js', 'write', w.file], { encoding: 'utf8' });
  assert.equal(r.status, 0, r.stdout + r.stderr); assert.match(r.stdout, /2 written, 0 failed/);
  assert.equal(writeDrafts(key, { ...spec, records: [] }), undefined, 'nothing to draft, nothing written');
});
