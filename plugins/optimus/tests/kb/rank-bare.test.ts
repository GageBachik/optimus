import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
process.env.OPTIMUS_HOME = mkdtempSync(path.join(tmpdir(), 'pm-')); process.env.OPTIMUS_BANK = mkdtempSync(path.join(tmpdir(), 'bank-'));
const { openDb } = await import('../../src/kb/db.js');
const { installTemplate } = await import('../../src/kb/templates.js');
const { loadTemplate } = await import('../../src/kb/templates-yaml.js');
const { kbWrite } = await import('../../src/kb/write.js');
const { rankFindings } = await import('../../src/kb/rank.js');
const { paths } = await import('../../src/lib/paths.js');

test('v1.5: a project that declares nothing is served newest-first within its domain, an agent-recorded finding without valid_from counts as recent, and a duplicated title appears once', () => {
  const db = openDb(); installTemplate(db, loadTemplate('templates/ios.yaml')); const bank = paths.bankDir();
  const old = { kind: 'finding' as const, title: 'Upload failed ITMS-90022 until all icon sizes were set', domain: 'ios', project: 'old-app', attrs: { state: 'observed', gate: 'testflight', valid_from: '2026-03-28' }, evidence: [{ kind: 'path' as const, ref: 'README.md' }] };
  kbWrite(db, bank, old, '2026-03-28T00:00:00Z'); kbWrite(db, bank, { ...old, project: 'old-app-import' }, '2026-03-29T00:00:00Z'); // the same title imported twice
  kbWrite(db, bank, { kind: 'finding', title: 'Cover screen reports an 84pt trailing-only safe-area inset on the Duo simulator', domain: 'ios', project: 'duo-game', attrs: { state: 'observed' }, evidence: [{ kind: 'path', ref: 'README.md' }] }, '2026-10-19T00:00:00Z');
  const top = rankFindings(db, { project_id: 'two-trees', domain: 'ios' }, 5, new Date('2026-10-20T00:00:00Z'));
  assert.equal(top.length, 2, 'duplicate title counted once: ' + top.map((f) => f.title).join(' | '));
  assert.match(top[0].title, /84pt trailing-only/, 'the recent ungated finding leads for a bare project');
  // a project with facets keeps the score order (gate rank counts)
  const scored = rankFindings(db, { project_id: 'two-trees', domain: 'ios', facets: { ui_framework: 'swiftui' } }, 5, new Date('2026-10-20T00:00:00Z'));
  assert.equal(scored.length, 2);
  db.sql.close();
});

test('v1.5: the top findings interleave the project\'s own with other projects\', so a session\'s fresh findings cannot crowd every cross-project one out', () => {
  const db = openDb(); const bank = paths.bankDir(); const ev = [{ kind: 'path' as const, ref: 'README.md' }];
  for (let i = 0; i < 6; i++) kbWrite(db, bank, { kind: 'finding', title: `Own finding number ${i} measured ${10 + i} ms`, domain: 'ios', project: 'two-trees', attrs: { state: 'observed' }, evidence: ev }, `2026-10-20T10:0${i}:00Z`);
  const top = rankFindings(db, { project_id: 'two-trees', domain: 'ios' }, 5, new Date('2026-10-20T12:00:00Z'));
  const own = top.filter((f) => f.project === 'two-trees').length, other = top.length - own;
  assert.equal(top.length, 5); assert.equal(own, 3); assert.equal(other, 2, top.map((f) => f.project + ': ' + f.title.slice(0, 40)).join(' | '));
  assert.ok(top.some((f) => /84pt trailing-only/.test(f.title)), 'the sibling app\'s inset finding keeps a slot');
  db.sql.close();
});
