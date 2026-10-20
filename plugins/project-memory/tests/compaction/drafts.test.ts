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
  // v1.5: kb write marked both as recorded, so the next pass has nothing pending, yet the file keeps them so they are never drafted again
  assert.equal(writeDrafts(key, { ...spec, records: [] }), undefined); assert.equal((JSON.parse(readFileSync(w.file, 'utf8')).records as { written?: string }[]).filter((r) => r.written).length, 2);
  assert.equal(writeDrafts(key, spec), undefined, 'the same two sentences drafted again are recognised as recorded');
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

test('drafts v1.5: a claim may say "I" mid-sentence; correlation, signed decimals and "N times" are measurements; workflow path boilerplate is never a value', async () => {
  const { isClaim } = await import('../../src/compaction/drafts.js');
  assert.equal(isClaim('On the S&P 500 index it earned about 11% a year after costs, under all 16 ways I tried of defining "high VIX."'), true);
  assert.equal(isClaim('Stocks and bonds currently move together. Their one-year correlation is +0.35, the highest since 1997.'), true);
  assert.equal(isClaim('On real ES data it promised about 5 times more than it delivered out of sample.'), true);
  assert.equal(isClaim('I turned every testable idea from the five digests into a backtest on 16 years of ES data.'), false);
  assert.equal(isClaim('Still inventorying: found ES 1-minute bars back to 2010 and 4,200 option surfaces.'), false);
  const entries: any[] = [
    u('run it'),
    { type: 'assistant', message: { role: 'assistant', content: [{ type: 'tool_use', id: 'w2', name: 'Workflow', input: { script: 'x' } }] } },
    { type: 'user', message: { role: 'user', content: [{ type: 'tool_result', tool_use_id: 'w2', content: 'Workflow started.\nTranscript dir: /Users/x/.claude/projects/p/subagents/workflows/wf_1344b0b0-3a5\nScript file: /Users/x/.claude/projects/p/workflows/scripts/quant-digest-wf_1344b0b0-3a5.js\n(Edit this file with Write/Edit and re-invoke Workflow with {scriptPath: "/Users/x/wf_1344b0b0-3a5.js"})\nES 5-day mean reversion earned 11.1% a year net on high-VIX days 1991-2026.' }] } },
    a('[{"type":"text","text":"Spawned successfully. (This tool result is internal metadata — never quote it, agent id 0a1b2c3d4e5f)"}]'),
  ];
  const ts = extractTaskState(entries, []);
  assert.ok(ts.exactValues.some((v) => /11\.1% a year/.test(v)), JSON.stringify(ts.exactValues));
  assert.ok(!ts.exactValues.some((v) => /^(Transcript dir|Script file|\(Edit this file)|internal metadata/.test(v)), JSON.stringify(ts.exactValues));
});

test('drafts v1.5: a recorded draft stays in the file as written, is never drafted again, and the brief counts only the pending ones', async () => {
  const { pendingDrafts, draftsFile } = await import('../../src/compaction/drafts.js');
  const cwd = mkdtempSync(path.join(tmpdir(), 'proj-')); writeFileSync(path.join(cwd, '.kb.json'), JSON.stringify({ project_id: 'zn', domain: 'trading' }));
  const key = paths.projectKey(cwd);
  const long = 'Stocks and bonds currently move together. Their one-year correlation is +0.35, the highest since 1997. In periods like this a 60/40 ES/ZN mix loses most of its diversification.';
  const ts = extractTaskState([u('go'), a(long), a('ZN month-end settle return was +5.6 bps held-out 2018-2026.')] as any, []);
  const spec = buildDrafts({ project_id: 'zn', domain: 'trading' }, ts, '', new Date('2026-10-20T00:00:00Z'));
  assert.equal(spec.records.length, 2);
  const t = spec.records[0].title; assert.ok(t.length <= 121 && t.endsWith('…') && long.startsWith(t.slice(0, -1)) && long[t.length - 1] === ' ', 'cut at a word boundary: ' + t);
  assert.equal(writeDrafts(key, spec)!.count, 2);
  // kb write marks the first one as recorded
  const file = draftsFile(key); const d = JSON.parse(readFileSync(file, 'utf8')); d.records[0].written = 'f_test'; writeFileSync(file, JSON.stringify(d));
  assert.deepEqual(pendingDrafts(key), { file, count: 1 });
  // the next turn drafts the same two sentences again: the recorded one is not re-added, the pending one is kept once
  const again = writeDrafts(key, spec)!; assert.equal(again.count, 1);
  const d2 = JSON.parse(readFileSync(file, 'utf8')) as { records: { title: string; written?: string }[] };
  assert.equal(d2.records.length, 2); assert.equal(d2.records.filter((r) => r.written).length, 1);
  // the brief line reads the file, not the last-session record
  writeFileSync(path.join(paths.projectDir(key), 'last-session.json'), JSON.stringify({ at: 'now', sessionId: 's', cwd, taskState: { goalFirst: 'g', goalLatest: 'l', openItems: [], decisions: [], files: [], pointers: [] }, drafts: { file, count: 2 } }));
  const items = lastSessionSection(key)[0].items; assert.ok(items.some((i) => i.startsWith('Draft findings waiting for review: 1 ')), items.join('\n'));
  d2.records.forEach((r) => (r.written = r.written ?? 'f_test2')); writeFileSync(file, JSON.stringify(d2));
  assert.equal(pendingDrafts(key), undefined); assert.ok(!lastSessionSection(key)[0].items.some((i) => i.startsWith('Draft findings')), 'no line once everything is recorded');
  assert.equal(writeDrafts(key, spec), undefined, 'nothing pending: the Stop hook carries no drafts line');
});

test('drafts v1.5: a record written with the old mid-word title still counts as recorded for the same sentence cut at a word', async () => {
  const { pendingDrafts, draftsFile } = await import('../../src/compaction/drafts.js');
  const cwd = mkdtempSync(path.join(tmpdir(), 'proj-')); writeFileSync(path.join(cwd, '.kb.json'), JSON.stringify({ project_id: 'spx', domain: 'trading' }));
  const key = paths.projectKey(cwd);
  const long = 'On the S&P 500 index it earned about 11% a year after costs, in both 1991–2009 and 2010–2026, and under all 16 ways I tried of defining high VIX.';
  const legacy = { kind: 'finding', title: long.slice(0, 120), body: 'x', attrs: { state: 'observed' }, evidence: [], written: 'f_legacy' };
  writeFileSync(draftsFile(key), JSON.stringify({ defaults: { domain: 'trading', project: 'spx' }, records: [legacy] }));
  const ts = extractTaskState([u('go'), a(long)] as any, []);
  const spec = buildDrafts({ project_id: 'spx', domain: 'trading' }, ts, '', new Date('2026-10-20T00:00:00Z'));
  assert.equal(spec.records.length, 1); assert.notEqual(spec.records[0].title, legacy.title, 'the new title is cut at a word, the legacy one mid-word');
  assert.equal(writeDrafts(key, spec), undefined, 'recognised as the recorded sentence'); assert.equal(pendingDrafts(key), undefined);
});
