import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
process.env.OPTIMUS_HOME = mkdtempSync(path.join(tmpdir(), 'pm-'));
const { openDb, upsertNote, setAttrs, addRel, getAttrs, getRels } = await import('../../src/kb/db.js');
const { noteId, ulid } = await import('../../src/kb/ids.js');
const now = '2026-09-01T00:00:00Z';
test('schema, attrs, rels, FTS search, FTS update removes old terms', () => {
  const db = openDb(); const id = noteId('finding'); assert.match(id, /^f_[0-9a-hjkmnp-tv-z]{26}$/);
  upsertNote(db, { id, kind: 'finding', domain: 'trading', project: 'es', title: 'Fixed-fractional beat fixed lot', body: 'OOS Sharpe 1.4 vs 0.9', created_at: now, updated_at: now, deleted_at: null, device_id: 'mac' });
  setAttrs(db, id, { state: 'reproduced', gate: 'out-of-sample', gate_rank: '1' });
  addRel(db, { id: ulid(), src: id, type: 'about', dst: 'c_risk', props: {}, created_at: now, deleted_at: null });
  assert.deepEqual(getAttrs(db, id).state, ['reproduced']); assert.equal(getRels(db, id, 'out')[0].dst, 'c_risk');
  const q = db.sql.prepare('SELECT note_id FROM note_fts WHERE note_fts MATCH ?');
  assert.equal((q.get('sharpe') as any).note_id, id);
  upsertNote(db, { id, kind: 'finding', domain: 'trading', project: 'es', title: 'Fixed-fractional beat fixed lot', body: 'drawdown 6% vs 11%', created_at: now, updated_at: now, deleted_at: null, device_id: 'mac' });
  assert.equal(q.get('sharpe'), undefined); assert.equal((q.get('drawdown') as any).note_id, id);
  assert.equal((db.sql.prepare('SELECT COUNT(*) AS n FROM rank_weights').get() as any).n, 10);
});
test('ulid is 26 chars and time-ordered', () => { const a = ulid(), b = ulid(); assert.equal(a.length, 26); assert.ok(b >= a); });
test('kindOfId maps prefixes and rejects unknown ones', async () => {
  const { kindOfId, evidenceId } = await import('../../src/kb/ids.js');
  assert.equal(kindOfId(noteId('concept')), 'concept'); assert.equal(kindOfId(evidenceId('ab'.repeat(32))), 'evidence');
  assert.throws(() => kindOfId('l_' + 'a'.repeat(26)), /unknown id prefix/);
});
