import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import path from 'node:path';
process.env.OPTIMUS_HOME = mkdtempSync(path.join(tmpdir(), 'pm-')); process.env.OPTIMUS_BANK = mkdtempSync(path.join(tmpdir(), 'bank-'));
const { openDb, getNote } = await import('../../src/kb/db.js');
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
