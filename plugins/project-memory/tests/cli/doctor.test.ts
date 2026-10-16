import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
const { installedPlugins } = await import('../../src/cli/doctor.js');

test('doctor looks at the folder Claude Code runs a plugin from: a directory marketplace in place, any other source the cache copy', () => {
  const home = mkdtempSync(path.join(tmpdir(), 'home-')), dir = path.join(home, '.claude', 'plugins'), repo = path.join(home, 'repo');
  mkdirSync(path.join(repo, '.claude-plugin'), { recursive: true }); mkdirSync(dir, { recursive: true });
  writeFileSync(path.join(repo, '.claude-plugin', 'marketplace.json'), JSON.stringify({ plugins: [{ name: 'project-memory', source: './plugins/project-memory' }] }));
  writeFileSync(path.join(dir, 'known_marketplaces.json'), JSON.stringify({ 'project-memory': { source: { source: 'directory', path: repo }, installLocation: repo }, other: { source: { source: 'github', repo: 'x/y' } } }));
  writeFileSync(path.join(dir, 'installed_plugins.json'), JSON.stringify({ version: 2, plugins: { 'project-memory@project-memory': [{ installPath: '/cache/pm' }], 'tool@other': [{ installPath: '/cache/tool' }] } }));
  assert.deepEqual(installedPlugins(home), [{ name: 'project-memory@project-memory', installPath: path.join(repo, 'plugins', 'project-memory') }, { name: 'tool@other', installPath: '/cache/tool' }]);
});
