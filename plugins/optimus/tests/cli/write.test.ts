import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import path from 'node:path';
process.env.OPTIMUS_HOME = mkdtempSync(path.join(tmpdir(), 'pm-')); process.env.OPTIMUS_BANK = mkdtempSync(path.join(tmpdir(), 'bank-'));
const { openDb, getRels } = await import('../../src/kb/db.js');
const { installTemplate } = await import('../../src/kb/templates.js');
const { loadTemplate } = await import('../../src/kb/templates-yaml.js');

test('kb write: bulk records from a JSON file, @key relations, per-record errors reported', () => {
  const db = openDb(); installTemplate(db, loadTemplate('templates/trading.yaml')); db.sql.close();
  const spec = path.join(process.env.OPTIMUS_HOME!, 'spec.json');
  writeFileSync(spec, JSON.stringify({ defaults: { domain: 'trading', project: 'es' }, records: [
    { key: 'a', kind: 'approach', title: 'ES 2-sigma', facets: { risk: 'fixed-fractional' }, tags: ['risk sizing'] },
    { key: 't', kind: 'target', title: 'IBKR × ES', facets: { environment: 'IBKR', subject: 'ES' } },
    { kind: 'finding', title: 'fixed-fractional beat fixed lot', attrs: { state: 'observed', gate: 'in-sample' }, evidence: [{ kind: 'path', ref: 'README.md' }], rels: [{ type: 'about', dst: '@a' }, { type: 'validated_in', dst: '@t', props: { gate: 'in-sample' } }] },
    { kind: 'approach', title: 'bad facets', facets: { nope: 'x' } },
  ] }));
  const r = spawnSync(process.execPath, ['dist/kb.js', 'write', spec], { encoding: 'utf8' });
  assert.equal(r.status, 1, r.stderr); // one record failed
  assert.match(r.stdout, /created  a_\S+  approach  ES 2-sigma/); assert.match(r.stdout, /created  f_\S+  finding  fixed-fractional beat fixed lot/);
  assert.match(r.stdout, /error    approach  bad facets: unknown facet keys nope/); assert.match(r.stdout, /3 written, 1 failed/);
  const db2 = openDb(); const f = db2.sql.prepare("SELECT id FROM note WHERE kind='finding'").get() as { id: string };
  const rels = getRels(db2, f.id).map((l) => l.type).sort(); assert.deepEqual(rels.filter((t) => t === 'about' || t === 'validated_in'), ['about', 'validated_in']); db2.sql.close();
});

test('kb write on a draft file: records are marked written in place and a second run writes nothing twice', () => {
  const db = openDb(); installTemplate(db, loadTemplate('templates/trading.yaml')); db.sql.close();
  const dir = mkdtempSync(path.join(process.env.OPTIMUS_HOME!, 'drafts-')); const file = path.join(dir, 'draft-findings.json');
  const spec = { defaults: { domain: 'trading', project: 'zn' }, records: [
    { kind: 'finding', title: 'ZN month-end settle return was +5.6 bps held-out 2018-2026', body: 'x', attrs: { state: 'observed' }, evidence: [{ kind: 'path', ref: 'README.md' }] },
    { kind: 'finding', title: 'Shuffled cross-validation overstated IC about 5 times', body: 'y', attrs: { state: 'observed' }, evidence: [{ kind: 'path', ref: 'README.md' }] },
  ] };
  writeFileSync(file, JSON.stringify(spec));
  const r1 = spawnSync(process.execPath, ['dist/kb.js', 'write', file], { encoding: 'utf8' }); assert.equal(r1.status, 0, r1.stdout + r1.stderr); assert.match(r1.stdout, /2 written, 0 failed\n$/);
  const marked = JSON.parse(readFileSync(file, 'utf8')) as { records: { written?: string }[] }; assert.ok(marked.records.every((r) => /^f_/.test(r.written ?? '')), JSON.stringify(marked));
  const r2 = spawnSync(process.execPath, ['dist/kb.js', 'write', file], { encoding: 'utf8' }); assert.equal(r2.status, 0, r2.stdout + r2.stderr); assert.match(r2.stdout, /0 written, 0 failed, 2 already recorded/);
  const db2 = openDb(); const n = (db2.sql.prepare("SELECT count(*) AS n FROM note WHERE kind='finding' AND project='zn'").get() as { n: number }).n; db2.sql.close(); assert.equal(n, 2);
});
