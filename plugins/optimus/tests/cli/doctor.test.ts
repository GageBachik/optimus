import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
const { installedPlugins } = await import('../../src/cli/doctor.js');

test('doctor looks at the folder Claude Code runs a plugin from: a directory marketplace in place, any other source the cache copy', () => {
  const home = mkdtempSync(path.join(tmpdir(), 'home-')), dir = path.join(home, '.claude', 'plugins'), repo = path.join(home, 'repo');
  mkdirSync(path.join(repo, '.claude-plugin'), { recursive: true }); mkdirSync(dir, { recursive: true });
  writeFileSync(path.join(repo, '.claude-plugin', 'marketplace.json'), JSON.stringify({ plugins: [{ name: 'optimus', source: './plugins/optimus' }] }));
  writeFileSync(path.join(dir, 'known_marketplaces.json'), JSON.stringify({ 'optimus': { source: { source: 'directory', path: repo }, installLocation: repo }, other: { source: { source: 'github', repo: 'x/y' } } }));
  writeFileSync(path.join(dir, 'installed_plugins.json'), JSON.stringify({ version: 2, plugins: { 'optimus@optimus': [{ installPath: '/cache/pm' }], 'tool@other': [{ installPath: '/cache/tool' }] } }));
  assert.deepEqual(installedPlugins(home), [{ name: 'optimus@optimus', installPath: path.join(repo, 'plugins', 'optimus') }, { name: 'tool@other', installPath: '/cache/tool' }]);
});
test('doctor reports the .kb.json of the working directory (DESIGN §7)', async () => {
  const { spawnSync } = await import('node:child_process');
  const home = mkdtempSync(path.join(tmpdir(), 'home-')), proj = mkdtempSync(path.join(tmpdir(), 'proj-'));
  writeFileSync(path.join(proj, '.kb.json'), JSON.stringify({ project_id: 'es-meanrev', domain: 'trading' }));
  const r = spawnSync(process.execPath, [path.join(import.meta.dirname, '..', '..', 'dist', 'kb.js'), 'doctor'], { cwd: proj, encoding: 'utf8', env: { ...process.env, HOME: home, OPTIMUS_HOME: path.join(home, '.pm') } });
  assert.match(r.stdout, /PASS\s+kb-json\s+project es-meanrev \(domain trading\)/);
});
