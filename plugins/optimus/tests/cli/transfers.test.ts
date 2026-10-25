import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import path from 'node:path';
process.env.OPTIMUS_HOME = mkdtempSync(path.join(tmpdir(), 'pm-')); process.env.OPTIMUS_BANK = mkdtempSync(path.join(tmpdir(), 'bank-'));
const { openDb, getRels, addRel, getNote } = await import('../../src/kb/db.js');
const { installTemplate } = await import('../../src/kb/templates.js');
const { loadTemplate } = await import('../../src/kb/templates-yaml.js');
const { kbWrite } = await import('../../src/kb/write.js');
const { relId, exportNote, rebuild } = await import('../../src/kb/export.js');
const bank = process.env.OPTIMUS_BANK!, now = '2026-10-16T00:00:00Z';
const kb = (...args: string[]) => spawnSync(process.execPath, ['dist/kb.js', ...args], { encoding: 'utf8' });

test('kb transfers prune: dry run lists what the current rule would not propose and changes nothing; --apply withdraws only proposed transfers, re-exports the notes, keeps settled ones', () => {
  const db = openDb(); installTemplate(db, loadTemplate('templates/trading.yaml'));
  const approach = (title: string, project: string, tags: string[], risk: string) => kbWrite(db, bank, { kind: 'approach', title, domain: 'trading', project, tags, facets: { risk } }, now).id;
  const a1 = approach('ES 2-sigma', 'es', ['risk sizing'], 'fixed-fractional'), a2 = approach('SPY trend', 'spy', ['risk sizing'], 'fixed-lot');
  const facetOnly = approach('QQQ', 'qqq', [], 'kelly'), confirmedTo = approach('IWM', 'iwm', [], 'kelly'), provisionalTo = approach('DIA', 'dia', [], 'kelly');
  const finding = (project: string, about: string) => kbWrite(db, bank, { kind: 'finding', title: `${project} finding`, domain: 'trading', project, tags: ['risk sizing'], attrs: { gate: 'in-sample' }, evidence: [{ kind: 'commit', ref: project }], rels: [{ type: 'about', dst: about, props: { facet_key: 'risk' } }] }, now).id;
  const f = finding('es', a1), g = finding('spy', a2);
  assert.deepEqual(getRels(db, f).filter((r) => r.type === 'transfer').map((r) => r.dst), [a2]);
  // Proposals an earlier rule made from the facet key alone, plus two settled transfers that must survive any prune.
  const legacy = (src: string, dst: string, state: string) => { const props = { state }, id = relId(src, 'transfer', dst, props); addRel(db, { id, src, type: 'transfer', dst, props, created_at: now, deleted_at: null }); return id; };
  const fStale = legacy(f, facetOnly, 'proposed'), gStale = legacy(g, facetOnly, 'proposed'), fConfirmed = legacy(f, confirmedTo, 'confirmed'), fProvisional = legacy(f, provisionalTo, 'confirmed_provisional');
  exportNote(db, bank, f); exportNote(db, bank, g);
  const fFile = path.join(bank, 'notes', 'finding', `${f}.md`);
  assert.ok(readFileSync(fFile, 'utf8').includes(facetOnly));
  db.sql.close();

  const dry = kb('transfers', 'prune'); assert.equal(dry.status, 0, dry.stdout + dry.stderr);
  assert.match(dry.stdout, new RegExp(`^PLAN  ${f}  1 of 2 proposed$`, 'm')); assert.match(dry.stdout, new RegExp(`^PLAN  ${g}  1 of 2 proposed$`, 'm'));
  assert.match(dry.stdout, /2 proposed transfers on 2 findings would be withdrawn; re-run with --apply/);
  const db2 = openDb();
  assert.ok(getRels(db2, f).some((r) => r.id === fStale), 'a dry run withdraws nothing');
  assert.equal(getNote(db2, f)!.updated_at, now, 'a dry run touches nothing'); db2.sql.close();

  const apply = kb('transfers', 'prune', '--apply'); assert.equal(apply.status, 0, apply.stdout + apply.stderr);
  assert.match(apply.stdout, new RegExp(`^DONE  ${f}  1 of 2 proposed$`, 'm')); assert.match(apply.stdout, /withdrew 2 proposed transfers on 2 findings/);
  const db3 = openDb();
  const live = (id: string) => getRels(db3, id).filter((r) => r.type === 'transfer').map((r) => r.id).sort();
  assert.deepEqual(live(f), [fConfirmed, fProvisional, relId(f, 'transfer', a2, { state: 'proposed' })].sort(), 'the stale proposal is gone; the rule\'s own proposal and both settled transfers stay');
  assert.ok(!live(g).includes(gStale));
  const row = db3.sql.prepare('SELECT deleted_at FROM rel WHERE id=?').get(fStale) as { deleted_at: string | null }; assert.ok(row.deleted_at, 'withdrawn by soft delete, the row stays');
  assert.notEqual(getNote(db3, f)!.updated_at, now, 'the finding is touched');
  const file = readFileSync(fFile, 'utf8');
  assert.ok(!file.includes(facetOnly) && file.includes(confirmedTo) && file.includes(provisionalTo), 'the re-exported note drops the withdrawn rel and keeps the settled ones');
  // The file is the truth: an index rebuilt from the bank has no trace of the withdrawn rel, which is how the prune reaches another machine.
  rebuild(db3, bank);
  assert.equal((db3.sql.prepare('SELECT count(*) AS n FROM rel WHERE id=?').get(fStale) as { n: number }).n, 0);
  assert.deepEqual(live(f), [fConfirmed, fProvisional, relId(f, 'transfer', a2, { state: 'proposed' })].sort());
  db3.sql.close();
  const again = kb('transfers', 'prune'); assert.equal(again.status, 0, again.stderr); assert.match(again.stdout, /^nothing to prune/);
});
