import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
process.env.PROJECT_MEMORY_HOME = mkdtempSync(path.join(tmpdir(), 'pm-'));
const { openDb, upsertNote } = await import('../../src/kb/db.js');
const { kbFind } = await import('../../src/kb/find.js');
test('punctuation-heavy text never throws; 200 common words return quickly (review focus 4)', () => {
  const db = openDb(); const now = '2026-10-16T00:00:00Z';
  for (let i = 0; i < 2000; i++) upsertNote(db, { id: `f_${String(i).padStart(26, '0')}`, kind: 'finding', domain: 'trading', project: 'p', title: `note ${i} risk sizing`, body: 'the with and of a to in '.repeat(20), created_at: now, updated_at: now, deleted_at: null, device_id: 'mac' });
  assert.doesNotThrow(() => kbFind(db, { text: 'risk-sizing: what?! (urgent) "quoted"' }));
  const t = Date.now(); const r = kbFind(db, { text: 'the with and of a to in '.repeat(25) }); assert.ok(Date.now() - t < 1000); assert.ok(r.length <= 20);
  assert.equal(kbFind(db, { text: 'sizing', project: 'nope' }).length, 0);
});
test('kind, domain and concept (by alias name) filter; deleted notes never appear', async () => {
  const { addRel, softDeleteNote } = await import('../../src/kb/db.js');
  const db = openDb(); const now = '2026-10-17T00:00:00Z';
  const base = { domain: 'ios', project: 'q', body: 'state owner', created_at: now, updated_at: now, deleted_at: null, device_id: 'mac' };
  upsertNote(db, { ...base, id: 'c_swiftui-state-ownership0000', kind: 'concept', title: 'swiftui state ownership' });
  db.sql.prepare('INSERT INTO alias(name_norm, concept_id) VALUES(?,?)').run('own-state', 'c_swiftui-state-ownership0000');
  for (const id of ['f_a0000000000000000000000000', 'f_b0000000000000000000000000']) { upsertNote(db, { ...base, id, kind: 'finding', title: `finding ${id}` }); addRel(db, { id: `l_${id}`, src: id, type: 'about', dst: 'c_swiftui-state-ownership0000', props: {}, created_at: now, deleted_at: null }); }
  softDeleteNote(db, 'f_b0000000000000000000000000');
  assert.deepEqual(kbFind(db, { concept: 'state owning', kind: 'finding' }).map((h) => h.id), ['f_a0000000000000000000000000']);
  assert.equal(kbFind(db, { text: 'owner', domain: 'ios', kind: 'concept' }).length, 1);
  assert.equal(kbFind(db, { text: 'owner', domain: 'trading' }).length, 0);
});
