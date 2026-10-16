import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
const home = mkdtempSync(path.join(tmpdir(), 'pm-')); const env = { ...process.env, PROJECT_MEMORY_HOME: home };
const run = (input: string) => spawnSync(process.execPath, ['--disable-warning=ExperimentalWarning', 'dist/hook.js', 'user-prompt'], { input, encoding: 'utf8', env, timeout: 5000 });
test('empty stdin → exit 0, no stdout, under 3 s', () => { const t = Date.now(); const r = run(''); assert.equal(r.status, 0); assert.equal(r.stdout, ''); assert.ok(Date.now() - t < 3000); });
test('truncated JSON → exit 0, no stdout, parse error logged', () => {
  const r = run('{"session_id": "abc", "cwd": '); assert.equal(r.status, 0); assert.equal(r.stdout, '');
  const logPath = path.join(home, 'logs', 'hooks.log'); assert.ok(existsSync(logPath)); assert.match(readFileSync(logPath, 'utf8'), /parse/i);
});
