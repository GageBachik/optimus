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

test('drafts: narration with numbers is not a claim; measurements are', async () => {
  const { isClaim } = await import('../../src/compaction/drafts.js');
  assert.equal(isClaim("I'll raise the window from 200K to 300K"), false); assert.equal(isClaim('All in, pushed as 36c6b30, 107 of 107 tests'), false);
  assert.equal(isClaim('Did the 2% stop help?'), false); assert.equal(isClaim('Fixed-fractional 0.5% beat fixed lot: Sharpe 1.4 vs 0.9'), true);
  assert.equal(isClaim('crank_scores used 15.0k CU per 25-validator batch'), true); assert.equal(isClaim('Walk-forward on 255 days: 17% win rate'), true);
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
  assert.equal(writeDrafts(key, { ...spec, records: [] })!.count, 2, 'an empty pass keeps what is already drafted'); // v1.4: the file merges across turns and agents
});

test('values come from result tables and from the reports subagents returned', () => {
  const entries: any[] = [
    u('run the experiments'),
    { type: 'assistant', message: { role: 'assistant', content: [{ type: 'tool_use', id: 'w1', name: 'Workflow', input: { script: 'x' } }] } },
    { type: 'user', message: { role: 'user', content: [{ type: 'tool_result', tool_use_id: 'w1', content: 'Momentum 12-1 on BTC: Sharpe 0.9, max drawdown 72.5% over 2013-2026.' }] } },
    a('Results:\n| Strategy | Sharpe | MaxDD |\n|---|---|---|\n| 12-1 momentum | 0.9 | 72.5% |\n| buy and hold | 1.1 | 83% |'),
  ];
  const ts = extractTaskState(entries, []);
  assert.ok(ts.exactValues.some((v) => v === '12-1 momentum · 0.9 · 72.5%'), JSON.stringify(ts.exactValues));
  assert.ok(ts.exactValues.some((v) => /Sharpe 0.9, max drawdown 72.5%/.test(v)), 'workflow report mined');
  assert.ok(!ts.exactValues.some((v) => /^-+/.test(v)), 'separator row skipped');
  const spec = buildDrafts({ project_id: 'es', domain: 'trading' }, ts, '', new Date('2026-10-19T12:00:00Z'));
  assert.ok(spec.records.some((r) => /Sharpe 0.9/.test(r.title)));
});
