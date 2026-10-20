import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
process.env.OPTIMUS_HOME = mkdtempSync(path.join(tmpdir(), 'pm-')); process.env.OPTIMUS_BANK = mkdtempSync(path.join(tmpdir(), 'bank-'));
const { openDb, upsertNote, setAttrs } = await import('../../src/kb/db.js');
const { buildProjectBrief } = await import('../../src/kb/brief.js');
type Db = ReturnType<typeof openDb>;
const cfg = { project_id: 'spy', domain: 'trading' };
/** An imported-memory evidence note; `i` orders updated_at so newest-first is observable. */
const memory = (db: Db, id: string, title: string, i: number, origin = 'serena') => {
  const at = `2026-10-${String(1 + Math.floor(i / 24)).padStart(2, '0')}T${String(i % 24).padStart(2, '0')}:00:00Z`;
  upsertNote(db, { id: `e_${id.padEnd(26, '0').slice(0, 26)}`, kind: 'evidence', domain: 'trading', project: 'spy', title, body: 'text', created_at: at, updated_at: at, deleted_at: null, device_id: 'mac' });
  setAttrs(db, `e_${id.padEnd(26, '0').slice(0, 26)}`, { origin });
};
test('cold start: imported memory titles plus the kb_find call that opens them, no findings needed (DESIGN §3.11 layer 2)', () => {
  const db = openDb();
  memory(db, 'overview', 'project_overview', 0); memory(db, 'commands', 'suggested_commands', 1);
  memory(db, 'kbwrite', 'commit: abc123', 2, 'commit'); // kb_write evidence is not an imported memory
  const t = buildProjectBrief(db, cfg, []);
  assert.ok(t.includes('## Imported memories for this project'), t); assert.ok(t.includes('- project_overview')); assert.ok(t.includes('- suggested_commands'));
  assert.ok(t.includes('kb_find({ project: "spy", kind: "evidence"')); assert.ok(!t.includes('commit: abc123')); assert.ok(!t.includes('## Relevant findings'));
  assert.ok(t.includes('## Project spy')); assert.ok(t.length <= 9000);
});
test('60 imported notes: at most 40 titles, newest first, under 9,000 chars', () => {
  const db = openDb(path.join(process.env.OPTIMUS_HOME!, 'b.sqlite'));
  for (let i = 0; i < 60; i++) memory(db, `m${i}`, `memory_${i}`, i);
  const lines = buildProjectBrief(db, cfg, []).split('\n'), titles = lines.filter((l) => /^- memory_\d+$/.test(l));
  assert.equal(titles.length, 40); assert.ok(titles.includes('- memory_59')); assert.ok(!titles.includes('- memory_19'));
  assert.ok(lines.join('\n').length <= 9000);
});
test('a finding from another project says how its target and facets differ from mine and carries the pending transfer command (DESIGN §4.6 partial credit, §4.8, §8)', async () => {
  const { installTemplate } = await import('../../src/kb/templates.js');
  const { loadTemplate } = await import('../../src/kb/templates-yaml.js');
  const { kbWrite } = await import('../../src/kb/write.js');
  const db = openDb(path.join(process.env.OPTIMUS_HOME!, 'c.sqlite')); installTemplate(db, loadTemplate('templates/trading.yaml'));
  const bank = mkdtempSync(path.join(tmpdir(), 'bank-')), now = '2026-10-16T00:00:00Z';
  const spx = kbWrite(db, bank, { kind: 'target', title: 'Databento backtest × SPX 0DTE options', domain: 'trading', facets: { environment: 'Databento backtest', subject: 'SPX 0DTE options' } }, now);
  const mix = kbWrite(db, bank, { kind: 'approach', title: 'best mix at 1x', domain: 'trading', project: 'options-0dte', facets: { risk: 'size-for-target' }, tags: ['risk sizing'] }, now);
  kbWrite(db, bank, { kind: 'approach', title: 'YoloLottery', domain: 'trading', project: 'yolo', facets: { risk: 'all-in' }, tags: ['risk sizing'] }, now);
  const f = kbWrite(db, bank, { kind: 'finding', title: 'doubling the best mix lifts P(touch -10%) from 6.7% to 27.6%', domain: 'trading', project: 'options-0dte', tags: ['risk sizing'], attrs: { state: 'reproduced', gate: 'out-of-sample' }, evidence: [{ kind: 'path', ref: 'results.md' }], rels: [{ type: 'about', dst: mix.id, props: { facet_key: 'risk' } }, { type: 'validated_in', dst: spx.id, props: { gate: 'out-of-sample' } }] }, now);
  assert.equal(f.transfers.length, 1);
  const yolo = { project_id: 'yolo', domain: 'trading', facets: { risk: 'all-in' }, target: { environment: 'Schwab paper', subject: 'SPY 0DTE options' }, relies_on: ['risk sizing'] };
  const line = buildProjectBrief(db, yolo, []).split('\n').find((l) => l.includes(f.id))!;
  assert.ok(line.includes('your subject differs: SPY 0DTE options vs SPX 0DTE options'), line);
  assert.ok(line.includes('your environment differs: Schwab paper vs Databento backtest'), line);
  assert.ok(line.includes('your risk differs: all-in vs size-for-target'), line);
  assert.ok(new RegExp(`transfer proposed: (node \\S+/kb\\.js|kb) transfer ${f.transfers[0]} confirm\\|refute`).test(line), line);
  // The project that made the finding sees neither a difference nor a transfer line.
  const options = { project_id: 'options-0dte', domain: 'trading', facets: { risk: 'size-for-target' }, target: { environment: 'Databento backtest', subject: 'SPX 0DTE options' }, relies_on: ['risk sizing'] };
  const mine = buildProjectBrief(db, options, []).split('\n').find((l) => l.includes(f.id))!;
  assert.ok(!mine.includes('differs') && !/kb(\.js)? transfer/.test(mine), mine);
});
