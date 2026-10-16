import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
process.env.PROJECT_MEMORY_HOME = mkdtempSync(path.join(tmpdir(), 'pm-'));
const { openDb, upsertNote, setAttrs, addRel, getAttrs, getRels } = await import('../../src/kb/db.js');
const { exportNote, importAll, importFile, rebuild } = await import('../../src/kb/export.js');
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
