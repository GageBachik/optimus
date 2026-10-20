import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import path from 'node:path';
process.env.PROJECT_MEMORY_HOME = mkdtempSync(path.join(tmpdir(), 'pm-'));
const { initBank, projectInit } = await import('../../src/cli/init.js');
const { openDb, getNote } = await import('../../src/kb/db.js');
const { kbWrite } = await import('../../src/kb/write.js');
const { gateRank } = await import('../../src/kb/templates.js');
const config = () => JSON.parse(readFileSync(path.join(process.env.PROJECT_MEMORY_HOME!, 'config.json'), 'utf8'));
const git = (cwd: string, ...a: string[]) => spawnSync('git', a, { cwd, encoding: 'utf8' }).stdout.trim();
test('kb init creates a committed bank with the five templates installed; --clone rebuilds from it', () => {
  const bank = path.join(mkdtempSync(path.join(tmpdir(), 'bank-')), 'kb');
  initBank({ bank, print: () => {} });
  assert.equal(readFileSync(path.join(bank, '.gitattributes'), 'utf8'), '* text=auto eol=lf\n');
  assert.deepEqual(readdirSync(path.join(bank, 'templates')).sort(), ['gen-l1.yaml', 'ios.yaml', 'solana.yaml', 'tooling.yaml', 'trading.yaml']);
  assert.ok(existsSync(path.join(bank, 'notes'))); assert.equal(git(bank, 'branch', '--show-current'), 'main');
  assert.equal(git(bank, 'rev-list', '--count', 'HEAD'), '1'); assert.equal(git(bank, 'status', '--porcelain'), '');
  assert.equal(config().bankDir, bank); assert.equal(gateRank(openDb(), 'ios', 'testflight'), 2);
  initBank({ bank, print: () => {} }); assert.equal(git(bank, 'rev-list', '--count', 'HEAD'), '1');
  // A note committed to the bank must be in the second machine's index right after `kb init --clone` (DESIGN §4.4: "clones and rebuilds").
  const db = openDb(); const p = kbWrite(db, bank, { kind: 'project', title: 'es', domain: 'trading', project: 'es' }); db.sql.exec('DELETE FROM note'); db.sql.close();
  git(bank, 'add', '-A'); git(bank, '-c', 'user.name=t', '-c', 'user.email=t@t', 'commit', '-q', '-m', 'note');
  const clone = path.join(mkdtempSync(path.join(tmpdir(), 'clone-')), 'kb');
  initBank({ bank: clone, clone: bank, print: () => {} });
  assert.ok(existsSync(path.join(clone, 'templates', 'trading.yaml'))); assert.equal(config().bankDir, clone);
  assert.equal(getNote(openDb(), p.id)?.title, 'es', 'index rebuilt from the clone');
});
test('kb project init writes .kb.json with project_id defaulting to the lowercase basename', () => {
  const dir = path.join(mkdtempSync(path.join(tmpdir(), 'proj-')), 'ES-MeanRev');
  mkdirSync(dir);
  assert.deepEqual(projectInit(dir, { domain: 'trading' }), { project_id: 'es-meanrev', domain: 'trading' });
  assert.deepEqual(JSON.parse(readFileSync(path.join(dir, '.kb.json'), 'utf8')), { project_id: 'es-meanrev', domain: 'trading' });
  assert.equal(projectInit(dir, { domain: 'gen-l1', id: 'genibook' }).project_id, 'genibook');
});
test('kb init never commits unrelated user work and refuses a non-empty non-git directory', () => {
  const bank = path.join(mkdtempSync(path.join(tmpdir(), 'bank-')), 'kb');
  initBank({ bank, print: () => {} });
  writeFileSync(path.join(bank, 'notes', 'mine.md'), 'draft\n'); writeFileSync(path.join(bank, 'templates', 'trading.yaml'), readFileSync(path.join(bank, 'templates', 'trading.yaml'), 'utf8') + '# my edit\n');
  git(bank, 'add', 'notes/mine.md');
  initBank({ bank, print: () => {} });
  assert.equal(git(bank, 'rev-list', '--count', 'HEAD'), '1');
  assert.equal(git(bank, 'status', '--porcelain'), 'A  notes/mine.md\n M templates/trading.yaml');
  const stray = mkdtempSync(path.join(tmpdir(), 'stray-')); writeFileSync(path.join(stray, 'x.txt'), 'x');
  assert.throws(() => initBank({ bank: stray, print: () => {} }), /not empty and not a git repository/);
  assert.ok(!existsSync(path.join(stray, '.git')));
});
test('kb init writes its initial commit on a machine with no git identity', async () => {
  const { withoutGitIdentity } = await import('../fixtures/git-identity.js');
  const bank = path.join(mkdtempSync(path.join(tmpdir(), 'bank-')), 'kb');
  withoutGitIdentity(() => initBank({ bank, print: () => {} }));
  assert.equal(git(bank, 'rev-list', '--count', 'HEAD'), '1');
});

test('v1.5: kb project init on an auto-registered folder drops the guess record, so the hand-set domain is final', async () => {
  const { projectInit } = await import('../../src/cli/init.js');
  const { settleFromPrompt } = await import('../../src/kb/auto-register.js');
  const d = mkdtempSync(path.join(tmpdir(), 'init-auto-'));
  writeFileSync(path.join(d, '.kb.json'), JSON.stringify({ project_id: 'gap-fad', domain: 'tooling', auto: { registered: '2026-10-20', confidence: 'low', reason: 'empty folder', decided: '2026-10-20' } }));
  projectInit(d, { domain: 'trading' });
  const cfg = JSON.parse(readFileSync(path.join(d, '.kb.json'), 'utf8')); assert.equal(cfg.domain, 'trading'); assert.equal(cfg.project_id, 'gap-fad'); assert.equal('auto' in cfg, false);
  assert.equal(settleFromPrompt(d, 'a swift ios iphone app in xcode please'), null, 'never moved again');
});
