import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
process.env.PROJECT_MEMORY_HOME = mkdtempSync(path.join(tmpdir(), 'pm-'));
const { openDb, upsertNote, setAttrs, addRel, getAttrs, getRels } = await import('../../src/kb/db.js');
const kbExport = await import('../../src/kb/export.js');
const { exportNote, importAll, importFile, rebuild } = kbExport;
const { ulid } = await import('../../src/kb/ids.js');
const { conceptNoteId } = await import('../../src/kb/templates.js');
const freshDb = (name: string) => openDb(path.join(process.env.PROJECT_MEMORY_HOME!, `${name}.sqlite`));

test('export → import → export is byte-identical (review focus 3)', () => {
  const bank = mkdtempSync(path.join(tmpdir(), 'bank-'));
  const db = openDb(); const id = 'f_01jcx9h2k7m4q8r3t6v9w2y5z8';
  upsertNote(db, { id, kind: 'finding', domain: 'trading', project: 'es', title: 'T', body: '## Claim\nx\n', created_at: '2026-09-01T00:00:00Z', updated_at: '2026-09-01T00:00:00Z', deleted_at: null, device_id: 'mac' });
  setAttrs(db, id, { state: 'reproduced', 'metric:sharpe': '1.4|ratio|higher', tags: ['a', 'b'] });
  addRel(db, { id: ulid(), src: id, type: 'about', dst: 'c_risk', props: { facet_key: 'risk' }, created_at: '2026-09-01T00:00:00Z', deleted_at: null });
  exportNote(db, bank, id);
  const file = path.join(bank, 'notes', 'finding', `${id}.md`); const first = readFileSync(file, 'utf8');
  const db2 = freshDb('kb2');
  assert.deepEqual(importAll(db2, bank), { imported: 1, unchanged: 0 }); exportNote(db2, bank, id);
  assert.equal(readFileSync(file, 'utf8'), first);
  assert.deepEqual(getAttrs(db2, id).tags, ['a', 'b']); assert.equal(getRels(db2, id)[0].props.facet_key, 'risk');
  assert.ok(!first.includes('\r'));
  assert.deepEqual(importAll(db2, bank), { imported: 0, unchanged: 1 });
  db2.sql.exec(`UPDATE note SET created_at='2030-01-01T00:00:00Z'`); importFile(db2, file); exportNote(db2, bank, id);
  assert.equal(readFileSync(file, 'utf8'), first, 'the file is the truth for created_at');
  assert.deepEqual(rebuild(db2, bank), { imported: 1, unchanged: 0 }); exportNote(db2, bank, id);
  assert.equal(readFileSync(file, 'utf8'), first);
});

test('a concept note round-trips and its alias attr re-creates alias rows in a fresh DB', () => {
  const bank = mkdtempSync(path.join(tmpdir(), 'bank-'));
  const db = freshDb('kb3'); const id = conceptNoteId('risk sizing');
  upsertNote(db, { id, kind: 'concept', domain: null, project: null, title: 'risk sizing', body: '', created_at: '2026-09-01T00:00:00Z', updated_at: '2026-09-01T00:00:00Z', deleted_at: null, device_id: 'mac' });
  setAttrs(db, id, { alias: ['posit-size'] });
  exportNote(db, bank, id);
  const file = path.join(bank, 'notes', 'concept', `${id}.md`); const first = readFileSync(file, 'utf8');
  const db4 = freshDb('kb4'); importAll(db4, bank); exportNote(db4, bank, id);
  assert.equal(readFileSync(file, 'utf8'), first);
  assert.equal((db4.sql.prepare('SELECT concept_id FROM alias WHERE name_norm=?').get('posit-size') as any).concept_id, id);
});

test('rels sort by code point, not the host locale', () => {
  const { renderNoteFile } = kbExport;
  const n = { id: 'f_x', kind: 'finding' as const, domain: null, project: null, title: 't', body: '', created_at: 'c', updated_at: 'u', deleted_at: null, device_id: 'd' };
  const rel = (dst: string) => ({ id: dst, src: 'f_x', type: 'about', dst, props: {}, created_at: 'c', deleted_at: null });
  const out = renderNoteFile(n, {}, [rel('c_z'), rel('c_a'), rel('c_T'), rel('c_t')]);
  assert.deepEqual([...out.matchAll(/dst: (\S+)/g)].map((m) => m[1]), ['c_T', 'c_a', 'c_t', 'c_z']);
});

test('rebuild is atomic: a malformed note file leaves the index untouched and names the file', () => {
  const bank = mkdtempSync(path.join(tmpdir(), 'bank-'));
  const db = freshDb('kb5'); const id = 'f_01jcx9h2k7m4q8r3t6v9w2y5z9';
  upsertNote(db, { id, kind: 'finding', domain: null, project: null, title: 'keep me', body: '', created_at: '2026-09-01T00:00:00Z', updated_at: '2026-09-01T00:00:00Z', deleted_at: null, device_id: 'mac' });
  exportNote(db, bank, id);
  writeFileSync(path.join(bank, 'notes', 'finding', 'f_broken.md'), '<<<<<<< HEAD\nconflict\n');
  assert.throws(() => rebuild(db, bank), /f_broken\.md/);
  assert.equal((db.sql.prepare('SELECT title FROM note WHERE id=?').get(id) as any).title, 'keep me');
});
