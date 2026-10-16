import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
process.env.PROJECT_MEMORY_HOME = mkdtempSync(path.join(tmpdir(), 'pm-')); process.env.PROJECT_MEMORY_BANK = mkdtempSync(path.join(tmpdir(), 'bank-'));
const { openDb, upsertNote, addRel, getRels, getNote, getAttrs } = await import('../../src/kb/db.js');
const { installTemplate, conceptNoteId } = await import('../../src/kb/templates.js');
const { loadTemplate } = await import('../../src/kb/templates-yaml.js');
const { resolveConcept, acceptMerge, rejectMerge, splitAlias } = await import('../../src/kb/concepts.js');
const { pendingQuestions } = await import('../../src/kb/brief.js');
const bank = process.env.PROJECT_MEMORY_BANK!, now = '2026-10-16T00:00:00Z';
test('alias → silent; exact → silent; strong overlap → auto-alias; weak → pending; else new (review focus 1, 6)', () => {
  const db = openDb(); installTemplate(db, loadTemplate('templates/trading.yaml'));
  const a = resolveConcept(db, bank, 'position sizing', now); assert.equal(a.how, 'alias');
  const b = resolveConcept(db, bank, 'risk sizings', now); assert.equal(b.how, 'exact'); assert.equal(a.conceptId, b.conceptId);
  const c = resolveConcept(db, bank, 'risk sizing rule', now); assert.equal(c.how, 'auto-alias'); assert.equal(c.conceptId, a.conceptId);
  const d = resolveConcept(db, bank, 'risk parity', now); assert.equal(d.how, 'pending'); assert.notEqual(d.conceptId, a.conceptId);
  const e = resolveConcept(db, bank, 'kelly criterion', now); assert.equal(e.how, 'new'); assert.equal(e.conceptId, conceptNoteId('kelly criterion'));
  const q = pendingQuestions(db); assert.equal(q.length, 1); assert.match(q[0], /Merge "risk parity" into "risk sizing"\?/);
});

test('accept re-points about rels and aliases; reject resolves; split undoes an auto-alias', async () => {
  const db = openDb(path.join(process.env.PROJECT_MEMORY_HOME!, 'b.sqlite')); installTemplate(db, loadTemplate('templates/trading.yaml'));
  const risk = conceptNoteId('risk sizing');
  const parity = resolveConcept(db, bank, 'risk parity', now).conceptId;
  upsertNote(db, { id: 'f_01', kind: 'finding', domain: 'trading', project: 'p', title: 'F', body: '', created_at: now, updated_at: now, deleted_at: null, device_id: 'd' });
  addRel(db, { id: 'l_x', src: 'f_01', type: 'about', dst: parity, props: {}, created_at: now, deleted_at: null });
  const id = (db.sql.prepare('SELECT id FROM pending_merge WHERE a=?').get(parity) as { id: string }).id;
  acceptMerge(db, bank, id, now);
  assert.equal(getRels(db, 'f_01')[0].dst, risk);
  const { relId } = await import('../../src/kb/export.js'); assert.equal(getRels(db, 'f_01')[0].id, relId('f_01', 'about', risk, {}), 'a re-pointed rel takes the id an import derives'); assert.ok(getNote(db, parity)!.deleted_at); assert.ok(getAttrs(db, risk).alias.includes('risk parity'));
  assert.equal(resolveConcept(db, bank, 'risk parity', now).how, 'alias'); assert.equal(pendingQuestions(db).length, 0);
  assert.throws(() => rejectMerge(db, id), /already accepted/);
  const auto = resolveConcept(db, bank, 'risk sizing rule', now); assert.equal(auto.how, 'auto-alias');
  assert.match(readFileSync(path.join(bank, 'concept-merges.md'), 'utf8'), /auto-merged "risk sizing rule" into risk sizing \(dice 0\.80\) · undo: kb concepts split "risk-rule-size"/);
  const split = splitAlias(db, bank, 'risk-rule-size', now);
  assert.ok(!getAttrs(db, risk).alias.includes('risk sizing rule'));
  assert.deepEqual(resolveConcept(db, bank, 'risk sizing rule', now), { conceptId: split, how: 'exact' });
});

test('an accepted merge survives a rebuild on another machine: the alias resolves to the live concept, no new auto-merge log line', async () => {
  const { rebuild } = await import('../../src/kb/export.js');
  const bank2 = mkdtempSync(path.join(tmpdir(), 'bank-'));
  const db = openDb(path.join(process.env.PROJECT_MEMORY_HOME!, 'c.sqlite')); installTemplate(db, loadTemplate('templates/trading.yaml'));
  const parity = resolveConcept(db, bank2, 'risk parity', now).conceptId;
  acceptMerge(db, bank2, (db.sql.prepare('SELECT id FROM pending_merge WHERE a=?').get(parity) as { id: string }).id, now);
  const log = readFileSync(path.join(bank2, 'concept-merges.md'), 'utf8');
  const other = openDb(path.join(process.env.PROJECT_MEMORY_HOME!, 'd.sqlite')); rebuild(other, bank2);
  assert.deepEqual(resolveConcept(other, bank2, 'risk parity', now), { conceptId: conceptNoteId('risk sizing'), how: 'alias' });
  assert.equal(readFileSync(path.join(bank2, 'concept-merges.md'), 'utf8'), log);
});

test('a secret inside a tag is redacted before it is stored as a concept', () => {
  const bank3 = mkdtempSync(path.join(tmpdir(), 'bank-'));
  const db = openDb(path.join(process.env.PROJECT_MEMORY_HOME!, 'e.sqlite'));
  const r = resolveConcept(db, bank3, 'api_key=ABCDEFGHIJKLMNOPQRSTUV', now);
  assert.doesNotMatch(getNote(db, r.conceptId)!.title, /ABCDEFGHIJKLMNOPQRSTUV/);
});
