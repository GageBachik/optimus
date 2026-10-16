import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
process.env.PROJECT_MEMORY_HOME = mkdtempSync(path.join(tmpdir(), 'pm-')); process.env.PROJECT_MEMORY_BANK = mkdtempSync(path.join(tmpdir(), 'bank-'));
const { openDb } = await import('../../src/kb/db.js');
const { installTemplate, conceptNoteId } = await import('../../src/kb/templates.js');
const { loadTemplate } = await import('../../src/kb/templates-yaml.js');
const { kbWrite } = await import('../../src/kb/write.js');
const { compareConcept, resolveConceptRef } = await import('../../src/kb/compare.js');
const { buildProjectBrief } = await import('../../src/kb/brief.js');
const bank = process.env.PROJECT_MEMORY_BANK!, now = '2026-10-16T00:00:00Z';
test('kb_compare: gate rank first even over a better metric (paper −0.5% above in-sample −4%/−1%), then the metric in its better direction (−4% above −1%, Review Focus 5); brief shows the block', () => {
  const db = openDb(); installTemplate(db, loadTemplate('templates/trading.yaml'));
  const t = kbWrite(db, bank, { kind: 'target', title: 'IBKR × ES', domain: 'trading', facets: { environment: 'IBKR', subject: 'ES' } }, now);
  const approach = (title: string, risk: string, project: string) => kbWrite(db, bank, { kind: 'approach', title, domain: 'trading', project, facets: { risk } }, now).id;
  const finding = (title: string, ap: string, gate: string, maxdd: number, project: string) => kbWrite(db, bank, {
    kind: 'finding', title, domain: 'trading', project, tags: ['risk sizing'], attrs: { gate, valid_from: '2026-10-01', state: 'observed' },
    metrics: [{ name: 'maxdd', value: maxdd, unit: 'pct', better: 'lower' }], evidence: [{ kind: 'commit', ref: title }],
    rels: [{ type: 'about', dst: ap, props: { facet_key: 'risk' } }, { type: 'validated_in', dst: t.id, props: { gate } }],
  }, now).id;
  const shallow = finding('shallow drawdown', approach('ES fixed', 'fixed-fractional', 'es'), 'in-sample', -1, 'es');
  const deep = finding('deep drawdown', approach('ES kelly', 'half-kelly', 'es'), 'in-sample', -4, 'es');
  const gated = finding('paper traded', approach('SPY vol', 'vol-target', 'spy'), 'paper', -0.5, 'spy');
  const rows = compareConcept(db, conceptNoteId('risk sizing'));
  assert.deepEqual(rows.map((r) => r.findingId), [gated, deep, shallow]);
  assert.deepEqual(rows[1], { findingId: deep, approachValue: 'half-kelly', gate: 'in-sample', gateRank: 0, metric: 'maxdd', value: -4, unit: 'pct', better: 'lower', target: 'IBKR × ES', validFrom: '2026-10-01', state: 'observed', project: 'es' });
  assert.equal(rows[0].gateRank, 2);
  assert.equal(resolveConceptRef(db, 'position sizing'), conceptNoteId('risk sizing')); // alias and id both resolve
  assert.equal(resolveConceptRef(db, conceptNoteId('risk sizing')), conceptNoteId('risk sizing'));
  const brief = buildProjectBrief(db, { project_id: 'spy', domain: 'trading', facets: { risk: 'vol-target' } }, []);
  assert.ok(brief.includes('## Comparison: risk sizing by risk'), brief);
  const lines = brief.split('\n'), at = (id: string) => lines.findIndex((l) => l.includes(`[${id}]`) && l.startsWith('- risk='));
  assert.ok(at(gated) >= 0 && at(gated) < at(deep) && at(deep) < at(shallow), brief);
  assert.ok(!buildProjectBrief(db, { project_id: 'x', domain: 'trading', facets: { entry: 'breakout' } }, []).includes('## Comparison'));
});
