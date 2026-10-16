import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
process.env.PROJECT_MEMORY_HOME = mkdtempSync(path.join(tmpdir(), 'pm-'));
const { setup, defaultDeviceId } = await import('../../src/cli/setup.js');
test('setup writes autoCompactWindow with a backup and persists deviceId', () => {
  const home = mkdtempSync(path.join(tmpdir(), 'home-')); mkdirSync(path.join(home, '.claude'));
  writeFileSync(path.join(home, '.claude', 'settings.json'), JSON.stringify({ theme: 'dark' }));
  setup(home, { device: 'Mac Mini.local', print: () => {} });
  const s = JSON.parse(readFileSync(path.join(home, '.claude', 'settings.json'), 'utf8'));
  assert.equal(s.autoCompactWindow, 200000); assert.equal(s.theme, 'dark');
  assert.ok(readdirSync(path.join(home, '.claude')).some((f) => f.startsWith('settings.json.bak-')));
  assert.equal(JSON.parse(readFileSync(path.join(process.env.PROJECT_MEMORY_HOME!, 'config.json'), 'utf8')).deviceId, 'mac-mini');
  assert.equal(defaultDeviceId('Gages-MacBook-Pro.local'), 'gages-macbook-pro');
});
