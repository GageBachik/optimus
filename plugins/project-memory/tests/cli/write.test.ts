import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import path from 'node:path';
process.env.PROJECT_MEMORY_HOME = mkdtempSync(path.join(tmpdir(), 'pm-')); process.env.PROJECT_MEMORY_BANK = mkdtempSync(path.join(tmpdir(), 'bank-'));
const { openDb, getRels } = await import('../../src/kb/db.js');
const { installTemplate } = await import('../../src/kb/templates.js');
const { loadTemplate } = await import('../../src/kb/templates-yaml.js');

test('kb write: bulk records from a JSON file, @key relations, per-record errors reported', () => {
  const db = openDb(); installTemplate(db, loadTemplate('templates/trading.yaml')); db.sql.close();
  const spec = path.join(process.env.PROJECT_MEMORY_HOME!, 'spec.json');
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
