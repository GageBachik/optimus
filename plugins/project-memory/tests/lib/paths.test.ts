import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
test('stateDir honours PROJECT_MEMORY_HOME; sessionDir is per agent; bankDir honours PROJECT_MEMORY_BANK', async () => {
  process.env.PROJECT_MEMORY_HOME = mkdtempSync(path.join(tmpdir(), 'pm-')); process.env.PROJECT_MEMORY_BANK = '/tmp/some-bank';
  const { paths } = await import('../../src/lib/paths.js');
  assert.equal(paths.stateDir(), process.env.PROJECT_MEMORY_HOME);
  assert.ok(paths.sessionDir('abc').endsWith(path.join('sessions', 'abc', 'main')));
  assert.ok(paths.sessionDir('abc', 'a1').endsWith(path.join('sessions', 'abc', 'a1')));
  assert.equal(paths.bankDir(), path.normalize('/tmp/some-bank'));
  const d = mkdtempSync(path.join(tmpdir(), 'proj-')); assert.match(paths.projectKey(d), /^[0-9a-f]{16}$/);
  writeFileSync(path.join(d, '.kb.json'), JSON.stringify({ project_id: 'es-meanrev', domain: 'trading' })); assert.equal(paths.projectKey(path.join(d, 'sub')), 'es-meanrev');
});
test('projectKey ignores a trailing slash; a null config.json reads as {}', async () => {
  const { paths } = await import('../../src/lib/paths.js');
  assert.equal(paths.projectKey('/a/b'), paths.projectKey('/a/b/'));
  writeFileSync(paths.configPath(), 'null'); assert.deepEqual(paths.config(), {});
});
