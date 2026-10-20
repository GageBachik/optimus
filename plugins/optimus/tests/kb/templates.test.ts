import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
process.env.OPTIMUS_HOME = mkdtempSync(path.join(tmpdir(), 'pm-'));
const { openDb } = await import('../../src/kb/db.js');
const { loadTemplate } = await import('../../src/kb/templates-yaml.js');
const { installTemplate, validateApproachFacets, gateRank, templateFor, conceptNoteId } = await import('../../src/kb/templates.js');
const { loadProjectConfig } = await import('../../src/kb/project.js');
test('templates install as rows; validation uses them; seed aliases resolve; concept ids deterministic', () => {
  const db = openDb(); installTemplate(db, loadTemplate('templates/trading.yaml')); installTemplate(db, loadTemplate('templates/gen-l1.yaml'));
  assert.equal(templateFor(db, 'trading')!.gates[1], 'out-of-sample'); assert.equal(gateRank(db, 'gen-l1', 'local-validator'), 1);
  assert.throws(() => gateRank(db, 'trading', 'mainnet'), /allowed gates/); assert.throws(() => validateApproachFacets(db, 'trading', { colour: 'blue' }), /allowed facet keys: why, entry, risk/);
  assert.ok((db.sql.prepare(`SELECT COUNT(*) AS n FROM note WHERE kind='concept'`).get() as any).n >= 8);
  assert.equal((db.sql.prepare('SELECT concept_id FROM alias WHERE name_norm=?').get('posit-size') as any).concept_id, conceptNoteId('risk sizing'));
  assert.equal(conceptNoteId('Risk Sizing'), conceptNoteId('risk-sizings'));
});
test('.kb.json without project_id or domain is ignored', () => {
  const d = mkdtempSync(path.join(tmpdir(), 'proj-')); writeFileSync(path.join(d, '.kb.json'), JSON.stringify({ domain: 'trading' }));
  assert.equal(loadProjectConfig(d), null);
  writeFileSync(path.join(d, '.kb.json'), JSON.stringify({ project_id: 'es-meanrev', domain: 'trading', relies_on: ['risk sizing'] }));
  assert.equal(loadProjectConfig(d)!.project_id, 'es-meanrev');
});
