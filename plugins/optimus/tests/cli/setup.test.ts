import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
process.env.OPTIMUS_HOME = mkdtempSync(path.join(tmpdir(), 'pm-'));
const { setup, defaultDeviceId } = await import('../../src/cli/setup.js');
test('setup writes autoCompactWindow with a backup and persists deviceId', () => {
  const home = mkdtempSync(path.join(tmpdir(), 'home-')); mkdirSync(path.join(home, '.claude'));
  writeFileSync(path.join(home, '.claude', 'settings.json'), JSON.stringify({ theme: 'dark' }));
  setup(home, { device: 'Mac Mini.local', print: () => {} });
  const s = JSON.parse(readFileSync(path.join(home, '.claude', 'settings.json'), 'utf8'));
  assert.equal(s.autoCompactWindow, 333000); assert.equal(s.theme, 'dark');
  assert.ok(readdirSync(path.join(home, '.claude')).some((f) => f.startsWith('settings.json.bak-')));
  assert.equal(JSON.parse(readFileSync(path.join(process.env.OPTIMUS_HOME!, 'config.json'), 'utf8')).deviceId, 'mac-mini');
  assert.equal(defaultDeviceId('Gages-MacBook-Pro.local'), 'gages-macbook-pro');
});
test('kb doctor prints no ExperimentalWarning from the FTS5 probe', async () => {
  const { spawnSync } = await import('node:child_process');
  const home = mkdtempSync(path.join(tmpdir(), 'home-'));
  const r = spawnSync(process.execPath, [path.join(import.meta.dirname, '..', '..', 'dist', 'kb.js'), 'doctor'], { encoding: 'utf8', env: { ...process.env, HOME: home, OPTIMUS_HOME: path.join(home, '.pm') } });
  assert.match(r.stdout, /PASS\s+sqlite-fts5/); assert.doesNotMatch(r.stderr, /ExperimentalWarning/);
});

test('setup --append-claude-md appends LF text even from a CRLF checkout (Windows, core.autocrlf=true)', () => {
  const home = mkdtempSync(path.join(tmpdir(), 'home-')); mkdirSync(path.join(home, '.claude')); writeFileSync(path.join(home, '.claude', 'CLAUDE.md'), '# mine\n');
  setup(home, { device: 'x', appendClaudeMd: true, print: () => {} });
  const t = readFileSync(path.join(home, '.claude', 'CLAUDE.md'), 'utf8');
  assert.ok(t.includes('## Compaction instructions (optimus)')); assert.ok(!t.includes('\r'), 'no CR in the appended block');
});
