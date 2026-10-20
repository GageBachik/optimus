import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, existsSync, readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import path from 'node:path';
process.env.PROJECT_MEMORY_HOME = mkdtempSync(path.join(tmpdir(), 'pm-')); process.env.PROJECT_MEMORY_BANK = mkdtempSync(path.join(tmpdir(), 'bank-'));
const { openDb } = await import('../../src/kb/db.js');
const { installTemplate, templateFor, installedDomains } = await import('../../src/kb/templates.js');
const { loadTemplate } = await import('../../src/kb/templates-yaml.js');
const { loadLexicon } = await import('../../src/kb/auto-register.js');
const { importAll } = await import('../../src/kb/export.js');
const bank = process.env.PROJECT_MEMORY_BANK!;
const kb = (cwd: string, ...a: string[]) => spawnSync(process.execPath, [path.resolve('dist/kb.js'), ...a], { encoding: 'utf8', cwd, env: process.env });

test('kb domain new: refuses before kb init, then writes the template, installs it, normalises the lists, files the folder, and refuses collisions', () => {
  const proj = mkdtempSync(path.join(tmpdir(), 'ps4-'));
  writeFileSync(path.join(proj, '.kb.json'), JSON.stringify({ project_id: 'track-smack', domain: 'tooling', auto: { registered: '2026-10-20', confidence: 'low', reason: 'empty folder' } }));
  const early = kb(proj, 'domain', 'new', 'console', '--facets', 'a,b', '--gates', 'x,y'); assert.equal(early.status, 1); assert.match(early.stderr, /run kb init first/);
  assert.ok(!existsSync(path.join(bank, 'templates', 'console.yaml')), 'nothing written into a folder that is not a bank');
  mkdirSync(path.join(bank, '.git'), { recursive: true }); mkdirSync(path.join(bank, 'templates'), { recursive: true }); // enough of a bank for the command
  { const db = openDb(); installTemplate(db, loadTemplate('templates/gen-l1.yaml')); db.sql.close(); }
  const r = kb(proj, 'domain', 'new', 'console', '--facets', 'Engine,sdk,Input Method,distribution', '--gates', 'devkit,testkit,cert,store-live', '--keywords', 'ps4,PS5,playstation 4,unreal engine,node.js', '--environment', 'platform', '--subject', 'title');
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.match(r.stdout, /created domain console/); assert.match(r.stdout, /gates    devkit < testkit < cert < store-live/); assert.match(r.stdout, /filed project track-smack under console/);
  const file = path.join(bank, 'templates', 'console.yaml'); assert.ok(existsSync(file)); assert.match(readFileSync(file, 'utf8'), /domain: console/);
  const db = openDb(); const t = templateFor(db, 'console')!;
  assert.deepEqual(t.facets, ['engine', 'sdk', 'input_method', 'distribution'], 'facets are snake_case');
  assert.deepEqual(t.keywords, ['console', 'ps4', 'ps5', 'playstation', '4', 'unreal', 'engine'], 'keywords are single tokens; node.js is dropped');
  assert.ok(loadLexicon(db).console.includes('playstation')); db.sql.close();
  const cfg = JSON.parse(readFileSync(path.join(proj, '.kb.json'), 'utf8')); assert.equal(cfg.domain, 'console'); assert.equal(cfg.auto.confidence, 'high');
  const again = kb(proj, 'domain', 'new', 'console', '--facets', 'a,b', '--gates', 'x,y'); assert.equal(again.status, 1); assert.match(again.stderr, /exists/);
  const collide = kb(proj, 'domain', 'new', 'gen-l10', '--facets', 'a,b', '--gates', 'x,y'); assert.equal(collide.status, 1); assert.match(collide.stderr, /collides with the installed domain gen-l1/);
  assert.ok(!existsSync(path.join(bank, 'templates', 'gen-l10.yaml')), 'a refused name leaves no file');
  const db2 = openDb(); assert.deepEqual(templateFor(db2, 'gen-l1')!.gates, loadTemplate('templates/gen-l1.yaml').gates, 'gen-l1 untouched'); db2.sql.close();
  for (const bad of ['Bad Name', 'trailing-', 'a-name-that-is-far-too-long-for-the-index']) { const b = kb(proj, 'domain', 'new', bad, '--facets', 'a,b', '--gates', 'x,y'); assert.equal(b.status, 1, bad); assert.match(b.stderr, /name:/); }
  const thin = kb(proj, 'domain', 'new', 'thin', '--facets', 'a', '--gates', 'x,y'); assert.equal(thin.status, 1); assert.match(thin.stderr, /at least two/);
});

test('a template that arrives by sync (importAll) is installed too, so the new domain exists on the other machine without kb rebuild', () => {
  writeFileSync(path.join(bank, 'templates', 'hardware.yaml'), 'domain: hardware\nfacets: [board, firmware]\nmethods: []\ngates: [bench, field]\nenvironment: board\nsubject: device\nkeywords: arduino, esp32, pcb\nseed_concepts: []\n');
  const db = openDb(); assert.ok(!installedDomains(db).includes('hardware'));
  importAll(db, bank);
  assert.ok(installedDomains(db).includes('hardware')); assert.deepEqual(templateFor(db, 'hardware')!.keywords, ['arduino', 'esp32', 'pcb'], 'a scalar keywords line is split into tokens');
  db.sql.close();
});
