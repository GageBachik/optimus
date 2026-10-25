import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
process.env.OPTIMUS_HOME = mkdtempSync(path.join(tmpdir(), 'pm-')); process.env.OPTIMUS_BANK = mkdtempSync(path.join(tmpdir(), 'bank-'));
const { openDb, upsertNote, getNote } = await import('../../src/kb/db.js');
const { conceptNoteId } = await import('../../src/kb/templates.js');
const { normalizeName } = await import('../../src/kb/normalize.js');
const { resolveConcept, conceptIdFor } = await import('../../src/kb/concepts.js');
const { conceptIds } = await import('../../src/kb/rank.js');
const bank = process.env.OPTIMUS_BANK!, now = '2026-10-25T08:00:00Z';

test('an occupied id slot is never retitled (2026-10-25): a concept minted under the old normaliser keeps its id and title, and a new name that derives that slot today gets its own id', () => {
  const db = openDb();
  // "ibs" was minted when the plural strip made ibs → ib, so its id is the slot "IB" derives under the three-letter rule.
  const drifted = conceptNoteId('IB'); assert.notEqual(drifted, conceptNoteId('ibs'), 'the premise: the two names derive different slots now');
  upsertNote(db, { id: drifted, kind: 'concept', domain: null, project: null, title: 'ibs', body: '', created_at: now, updated_at: now, deleted_at: null, device_id: 't' });
  db.sql.prepare('INSERT OR REPLACE INTO alias(name_norm, concept_id) VALUES(?,?)').run(normalizeName('ibs'), drifted); // what kb rebuild writes
  assert.deepEqual(conceptIds(db, ['IB']), [], 'a name whose slot belongs to another concept maps to nothing, not to the occupant');
  assert.deepEqual(conceptIds(db, ['ibs']), [drifted]);
  const ib = resolveConcept(db, bank, 'IB', now);
  assert.equal(ib.how, 'new'); assert.notEqual(ib.conceptId, drifted); assert.match(ib.conceptId, /^c_[a-z0-9]{26}$/);
  assert.equal(getNote(db, drifted)!.title, 'ibs', 'the IBS concept keeps its title'); assert.equal(getNote(db, ib.conceptId)!.title, 'IB');
  assert.equal(resolveConcept(db, bank, 'ibs', now).conceptId, drifted, 'the drifted concept still resolves by title');
  assert.equal(resolveConcept(db, bank, 'IB', now).conceptId, ib.conceptId, 'the new concept resolves by its alias row');
  assert.deepEqual(conceptIds(db, ['IB']), [ib.conceptId]);
  assert.equal(conceptIdFor(db, 'IB'), ib.conceptId, 'the derived id is deterministic, so the other machine mints the same note');
  assert.equal(conceptIdFor(db, 'kelly fraction'), conceptNoteId('kelly fraction'), 'a free slot is used as before');
  db.sql.close();
});
