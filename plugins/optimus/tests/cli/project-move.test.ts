import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import path from 'node:path';
process.env.OPTIMUS_HOME = mkdtempSync(path.join(tmpdir(), 'pm-')); process.env.OPTIMUS_BANK = mkdtempSync(path.join(tmpdir(), 'bank-'));
const { openDb, getNote, getAttrs } = await import('../../src/kb/db.js');
const { installTemplate } = await import('../../src/kb/templates.js');
const { loadTemplate } = await import('../../src/kb/templates-yaml.js');
const { kbWrite, retractNote } = await import('../../src/kb/write.js');
const { parseNoteFile } = await import('../../src/kb/export.js');
const { projectMove } = await import('../../src/cli/init.js');
const bank = process.env.OPTIMUS_BANK!, now = '2026-10-24T00:00:00Z', later = '2026-10-24T01:00:00Z';
const kb = (cwd: string, ...a: string[]) => spawnSync(process.execPath, [path.resolve('dist/kb.js'), ...a], { encoding: 'utf8', cwd, env: process.env });
const snapshot = (dir: string) => Object.fromEntries((readdirSync(dir, { recursive: true }) as string[]).sort().map((f) => { try { return [f, readFileSync(path.join(dir, f), 'utf8')]; } catch { return [f, null]; } }));
const folder = (cfg: object) => { const d = mkdtempSync(path.join(tmpdir(), 'odds-')); writeFileSync(path.join(d, '.kb.json'), JSON.stringify(cfg, null, 2) + '\n'); return d; };
const rows = (db: ReturnType<typeof openDb>, sql: string) => (db.sql.prepare(sql).all() as any[]).map((r) => ({ ...r }));
/** A fresh index with trading and ios installed; project `odds` has one note of every writable kind plus the finding's evidence and a retracted finding; a `spy` approach sits beside it. */
function seed(name: string) {
  const db = openDb(path.join(process.env.OPTIMUS_HOME!, `${name}.sqlite`));
  for (const t of ['trading', 'ios']) installTemplate(db, loadTemplate(`templates/${t}.yaml`));
  const w = (rec: Omit<Parameters<typeof kbWrite>[2], 'domain' | 'project'>) => kbWrite(db, bank, { domain: 'trading', project: 'odds', ...rec }, now).id;
  const ids = { project: w({ kind: 'project', title: 'odds' }), approach: w({ kind: 'approach', title: 'carry15' }), experiment: w({ kind: 'experiment', title: 'sweep' }), target: w({ kind: 'target', title: 'live' }),
    finding: w({ kind: 'finding', title: 'carry beats flat', attrs: { state: 'observed' }, evidence: [{ kind: 'commit', ref: 'abc123' }] }) };
  const evidence = (db.sql.prepare("SELECT id FROM note WHERE kind='evidence' AND project='odds'").get() as { id: string }).id;
  const retracted = w({ kind: 'finding', title: 'withdrawn' }); retractNote(db, bank, retracted, now);
  const spy = kbWrite(db, bank, { kind: 'approach', title: 'spy trend', domain: 'trading', project: 'spy' }, now).id;
  return { db, ids: { ...ids, evidence }, retracted, spy };
}

test('kb project move sets the domain on every live note of the project, whatever its kind, re-exports each, and leaves other projects and retracted notes alone', () => {
  const { db, ids, retracted, spy } = seed('a'), cwd = folder({ project_id: 'odds', domain: 'trading' });
  const r = projectMove(db, bank, cwd, { domain: 'ios' }, later);
  assert.equal(r.project_id, 'odds'); assert.equal(r.total, 6);
  assert.deepEqual(r.moved, { approach: 1, evidence: 1, experiment: 1, finding: 1, project: 1, target: 1 });
  for (const id of Object.values(ids)) {
    const n = getNote(db, id)!; assert.equal(n.domain, 'ios', id); assert.equal(n.updated_at, later, id);
    assert.equal(parseNoteFile(readFileSync(path.join(bank, 'notes', n.kind, `${id}.md`), 'utf8')).note.domain, 'ios', `${id} is re-exported, so kb sync ships it`);
  }
  assert.equal(getNote(db, spy)!.domain, 'trading'); assert.equal(getNote(db, spy)!.updated_at, now, 'another project is untouched');
  assert.equal(getNote(db, retracted)!.domain, 'trading', 'a retracted note is not moved');
  assert.match(readFileSync(path.join(process.env.OPTIMUS_HOME!, 'logs', 'hooks.log'), 'utf8'), /"msg":"project moved"/);
  db.sql.close();
});

test('kb project move refuses a domain that is not installed, naming kb domain new, and writes nothing', () => {
  { const db = openDb(); installTemplate(db, loadTemplate('templates/trading.yaml')); kbWrite(db, bank, { kind: 'approach', title: 'a', domain: 'trading', project: 'odds' }, now); db.sql.close(); }
  const cwd = folder({ project_id: 'odds', domain: 'trading', auto: { confidence: 'low', reason: 'empty folder' } }), before = readFileSync(path.join(cwd, '.kb.json'), 'utf8'), bankBefore = snapshot(bank);
  const r = kb(cwd, 'project', 'move', '--domain', 'prop-firm');
  assert.equal(r.status, 1, r.stdout + r.stderr); assert.match(r.stderr, /unknown domain prop-firm/); assert.match(r.stderr, /kb domain new prop-firm/);
  assert.equal(readFileSync(path.join(cwd, '.kb.json'), 'utf8'), before, '.kb.json untouched'); assert.deepEqual(snapshot(bank), bankBefore, 'bank untouched');
  const db = openDb(); assert.deepEqual(rows(db, "SELECT domain FROM note WHERE project='odds'"), [{ domain: 'trading' }]); db.sql.close();
});

test('.kb.json here or above is rewritten with the new domain as a hand-set choice: the auto record is dropped, every other key kept', () => {
  const { db } = seed('c');
  const cwd = folder({ project_id: 'odds', domain: 'trading', facets: { risk: 'fixed-fractional' }, relies_on: ['risk sizing'], auto: { registered: '2026-10-20', confidence: 'low', reason: 'empty folder', decided: '2026-10-20' } });
  mkdirSync(path.join(cwd, 'src')); // run from a subfolder: the nearest .kb.json above is the one rewritten
  const r = projectMove(db, bank, path.join(cwd, 'src'), { domain: 'ios' }, later);
  assert.equal(r.file, path.join(cwd, '.kb.json'));
  assert.deepEqual(JSON.parse(readFileSync(r.file!, 'utf8')), { project_id: 'odds', domain: 'ios', facets: { risk: 'fixed-fractional' }, relies_on: ['risk sizing'] });
  db.sql.close();
});

test('a second kb project move changes nothing: no note touched, the bank and .kb.json byte-identical', () => {
  const { db } = seed('d'), cwd = folder({ project_id: 'odds', domain: 'trading', auto: { confidence: 'low', reason: 'empty folder' } });
  projectMove(db, bank, cwd, { domain: 'ios' }, later);
  const bankBefore = snapshot(bank), cfgBefore = readFileSync(path.join(cwd, '.kb.json'), 'utf8'), notesBefore = rows(db, "SELECT id, domain, updated_at FROM note WHERE project='odds' ORDER BY id");
  const r = projectMove(db, bank, cwd, { domain: 'ios' }, '2026-10-24T02:00:00Z');
  assert.equal(r.total, 0); assert.deepEqual(r.moved, {}); assert.equal(r.file, path.join(cwd, '.kb.json'));
  assert.deepEqual(snapshot(bank), bankBefore); assert.equal(readFileSync(path.join(cwd, '.kb.json'), 'utf8'), cfgBefore);
  assert.deepEqual(rows(db, "SELECT id, domain, updated_at FROM note WHERE project='odds' ORDER BY id"), notesBefore);
  db.sql.close();
});

test('--id names the project from any folder (the bank, say): an unrelated .kb.json there is left alone, and without it a folder with no .kb.json is refused', () => {
  const { db, ids } = seed('e'), other = folder({ project_id: 'spy', domain: 'trading' });
  const r = projectMove(db, bank, other, { domain: 'ios', id: 'odds' }, later);
  assert.equal(r.project_id, 'odds'); assert.equal(r.total, 6); assert.equal(r.file, null);
  assert.deepEqual(JSON.parse(readFileSync(path.join(other, '.kb.json'), 'utf8')), { project_id: 'spy', domain: 'trading' });
  assert.equal(getNote(db, ids.approach)!.domain, 'ios');
  assert.throws(() => projectMove(db, bank, mkdtempSync(path.join(tmpdir(), 'bare-')), { domain: 'ios' }, later), /pass --id <project>/);
  db.sql.close();
});

test('a finding gate the new ladder does not list refuses the move before anything is written; --gate <old>=<new> relabels it with the new rank, re-exports, and a rerun changes nothing', () => {
  const { db } = seed('f'), cwd = folder({ project_id: 'odds', domain: 'trading' });
  const w = (title: string, gate: string) => kbWrite(db, bank, { kind: 'finding', title, domain: 'trading', project: 'odds', attrs: { state: 'observed', gate } }, now).id;
  const paper = w('paper run held', 'paper'), live = w('live run held', 'live'), live2 = w('second live run', 'live');
  const gateOf = (id: string) => { const a = getAttrs(db, id); return [a.gate[0], a.gate_rank[0]]; };
  assert.deepEqual(gateOf(paper), ['paper', '2']); assert.deepEqual(gateOf(live), ['live', '4']);
  const bankBefore = snapshot(bank), cfgBefore = readFileSync(path.join(cwd, '.kb.json'), 'utf8');
  assert.throws(() => projectMove(db, bank, cwd, { domain: 'ios' }, later), /3 findings of odds carry a gate ios does not list \(live, paper; its ladder is simulator < device < testflight < app-store-review < app-store-live\); nothing moved\. Pass --gate <old>=<new>/);
  assert.throws(() => projectMove(db, bank, cwd, { domain: 'ios', gates: { paper: 'simulator' } }, later), /2 findings of odds carry a gate ios does not list \(live;/);
  assert.throws(() => projectMove(db, bank, cwd, { domain: 'ios', gates: { paper: 'simulator', live: 'sim' } }, later), /\(sim;/, 'a mapping onto a name the ladder lacks is refused the same way');
  assert.deepEqual(snapshot(bank), bankBefore, 'bank untouched'); assert.equal(readFileSync(path.join(cwd, '.kb.json'), 'utf8'), cfgBefore, '.kb.json untouched');
  assert.equal(getNote(db, paper)!.domain, 'trading'); assert.deepEqual(gateOf(paper), ['paper', '2']);
  const r = projectMove(db, bank, cwd, { domain: 'ios', gates: { paper: 'simulator', live: 'device' } }, later);
  assert.equal(r.relabeled, 3); assert.equal(r.moved.finding, 4, 'the gate-less seed finding moves too');
  assert.deepEqual(gateOf(paper), ['simulator', '0']); assert.deepEqual(gateOf(live), ['device', '1']); assert.deepEqual(gateOf(live2), ['device', '1']);
  const text = readFileSync(path.join(bank, 'notes', 'finding', `${live}.md`), 'utf8');
  assert.match(text, /^domain: ios$/m); assert.match(text, /^  gate: device$/m); assert.match(text, /^  gate_rank: "1"$/m);
  assert.match(readFileSync(path.join(process.env.OPTIMUS_HOME!, 'logs', 'hooks.log'), 'utf8'), /"msg":"project moved".*"relabeled":3/);
  const bankAfter = snapshot(bank), again = projectMove(db, bank, cwd, { domain: 'ios', gates: { paper: 'simulator', live: 'device' } }, '2026-10-24T02:00:00Z');
  assert.equal(again.total, 0); assert.equal(again.relabeled, 0); assert.deepEqual(snapshot(bank), bankAfter);
  const u = kb(cwd, 'project', 'move', '--domain', 'ios', '--gate', 'paper');
  assert.equal(u.status, 2); assert.match(u.stderr, /\[--gate <old>=<new>\]\.\.\./);
  db.sql.close();
});

test('a gate name both ladders list keeps its name and takes the new ladder\'s rank', () => {
  const { db } = seed('g'), cwd = folder({ project_id: 'odds', domain: 'trading' });
  installTemplate(db, { domain: 'ladder', facets: ['lens'], methods: ['replay'], gates: ['paper', 'in-sample', 'live'], environment: 'dataset', subject: 'mechanism', seed_concepts: [] });
  const f = kbWrite(db, bank, { kind: 'finding', title: 'in-sample edge', domain: 'trading', project: 'odds', attrs: { state: 'observed', gate: 'in-sample' } }, now).id;
  assert.deepEqual([getAttrs(db, f).gate[0], getAttrs(db, f).gate_rank[0]], ['in-sample', '0']);
  const r = projectMove(db, bank, cwd, { domain: 'ladder' }, later);
  assert.equal(r.relabeled, 1); assert.deepEqual([getAttrs(db, f).gate[0], getAttrs(db, f).gate_rank[0]], ['in-sample', '1']);
  assert.match(readFileSync(path.join(bank, 'notes', 'finding', `${f}.md`), 'utf8'), /^  gate_rank: "1"$/m);
  db.sql.close();
});
