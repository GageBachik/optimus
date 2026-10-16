import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
test('dist/hook.js exists and exits 0 on an unknown event with empty stdin', () => {
  assert.ok(existsSync('dist/hook.js'), 'run npm run build first');
  const r = spawnSync(process.execPath, ['--disable-warning=ExperimentalWarning', 'dist/hook.js', 'no-such-event'], { input: '', encoding: 'utf8', timeout: 5000 });
  assert.equal(r.status, 0); assert.equal(r.stdout, '');
});
