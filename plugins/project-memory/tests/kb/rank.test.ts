import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
process.env.PROJECT_MEMORY_HOME = mkdtempSync(path.join(tmpdir(), 'pm-')); process.env.PROJECT_MEMORY_BANK = mkdtempSync(path.join(tmpdir(), 'bank-'));
const { openDb } = await import('../../src/kb/db.js');
const { installTemplate } = await import('../../src/kb/templates.js');
const { loadTemplate } = await import('../../src/kb/templates-yaml.js');
const { kbWrite } = await import('../../src/kb/write.js');
const { rankFindings } = await import('../../src/kb/rank.js');
const bank = process.env.PROJECT_MEMORY_BANK!, now = '2026-10-16T00:00:00Z';
test('facet+environment match outranks a newer unrelated finding; expired is demoted not hidden; superseded is dropped', () => {
  const db = openDb(); installTemplate(db, loadTemplate('templates/trading.yaml'));
  const t = kbWrite(db, bank, { kind: 'target', title: 'IBKR × ES', domain: 'trading', facets: {} , attrs: { 'facet:environment': 'IBKR', 'facet:subject': 'ES' } }, now);
  const a = kbWrite(db, bank, { kind: 'approach', title: 'ES 2-sigma', domain: 'trading', project: 'es', facets: { risk: 'fixed-fractional' }, tags: ['risk sizing'] }, now);
  const strong = kbWrite(db, bank, { kind: 'finding', title: 'strong', domain: 'trading', project: 'es', tags: ['risk sizing'], attrs: { state: 'reproduced', gate: 'out-of-sample', valid_from: '2026-01-01' }, evidence: [{ kind: 'commit', ref: '1' }], rels: [{ type: 'about', dst: a.id, props: { facet_key: 'risk' } }, { type: 'validated_in', dst: t.id, props: { gate: 'out-of-sample' } }] }, now);
  const newer = kbWrite(db, bank, { kind: 'finding', title: 'newer unrelated', domain: 'trading', project: 'es', tags: ['risk sizing'], attrs: { state: 'observed', gate: 'in-sample', valid_from: '2026-10-10' }, evidence: [{ kind: 'commit', ref: '2' }] }, now);
  const expired = kbWrite(db, bank, { kind: 'finding', title: 'expired', domain: 'trading', project: 'es', tags: ['risk sizing'], attrs: { state: 'reproduced', gate: 'live', valid_from: '2025-01-01', valid_to: '2025-12-31' }, evidence: [{ kind: 'commit', ref: '3' }] }, now);
  const old = kbWrite(db, bank, { kind: 'finding', title: 'superseded', domain: 'trading', project: 'es', tags: ['risk sizing'], attrs: { state: 'reproduced', gate: 'live' }, evidence: [{ kind: 'commit', ref: '4' }] }, now);
  kbWrite(db, bank, { kind: 'finding', title: 'replacement', domain: 'trading', project: 'es', tags: ['risk sizing'], attrs: { state: 'reproduced', gate: 'live' }, evidence: [{ kind: 'commit', ref: '5' }], rels: [{ type: 'supersedes', dst: old.id }] }, now);
  const cfg = { project_id: 'spy', domain: 'trading', facets: { risk: 'fixed-fractional' }, target: { environment: 'ibkr', subject: 'SPY options' }, relies_on: ['risk sizing'] };
  const ranked = rankFindings(db, cfg, 10, new Date('2026-10-16'));
  assert.equal(ranked[0].id, strong.id); assert.ok(ranked.some((r) => r.id === expired.id && r.demoted)); assert.ok(!ranked.some((r) => r.id === old.id)); assert.ok(ranked.findIndex((r) => r.id === newer.id) > 0);
  // Pin the scores so a dead term (e.g. gate_rank) fails the test, not just a reordering.
  const score = (title: string) => Number(ranked.find((r) => r.title === title)!.score.toFixed(2));
  assert.deepEqual(['strong', 'replacement', 'expired', 'newer unrelated'].map(score), [6.28, 4, 2, 1]);
});

test('a project that declares nothing yet gets its domain\'s findings as candidates (v1.4)', async () => {
  const { candidateIds } = await import('../../src/kb/rank.js');
  const { openDb } = await import('../../src/kb/db.js');
  const db = openDb();
  const domain = (db.sql.prepare("SELECT domain FROM note WHERE kind='finding' AND deleted_at IS NULL AND domain IS NOT NULL LIMIT 1").get() as { domain: string } | undefined)?.domain;
  if (domain) { assert.ok(candidateIds(db, { project_id: 'fresh', domain }).length > 0); assert.equal(candidateIds(db, { project_id: 'fresh', domain: 'no-such-domain' }).length, 0); }
  db.sql.close();
});
