import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
const home = mkdtempSync(path.join(tmpdir(), 'pm-')); const env = { ...process.env, OPTIMUS_HOME: home };
const run = (input: string) => spawnSync(process.execPath, ['--disable-warning=ExperimentalWarning', 'dist/hook.js', 'user-prompt'], { input, encoding: 'utf8', env, timeout: 5000 });
test('empty stdin → exit 0, no stdout, under 3 s', () => { const t = Date.now(); const r = run(''); assert.equal(r.status, 0); assert.equal(r.stdout, ''); assert.ok(Date.now() - t < 3000); });
test('truncated JSON → exit 0, no stdout, parse error logged', () => {
  const r = run('{"session_id": "abc", "cwd": '); assert.equal(r.status, 0); assert.equal(r.stdout, '');
  const logPath = path.join(home, 'logs', 'hooks.log'); assert.ok(existsSync(logPath)); assert.match(readFileSync(logPath, 'utf8'), /parse/i);
});
test('unparseable stdin is never written to the log (it can carry the user prompt)', () => {
  const r = run('{"prompt": "sk-SECRET-TOKEN-123'); assert.equal(r.status, 0);
  const log = readFileSync(path.join(home, 'logs', 'hooks.log'), 'utf8'); assert.doesNotMatch(log, /SECRET-TOKEN/); assert.match(log, /"chars":31/);
});
test('parse error message snippet is not logged (V8 "Unexpected token" quotes the input)', () => {
  const r = run('sk-SECRET-TOKEN-123 x'); assert.equal(r.status, 0);
  const log = readFileSync(path.join(home, 'logs', 'hooks.log'), 'utf8'); assert.doesNotMatch(log, /sk-SECRET/); assert.match(log, /"chars":21/);
});
test('PreCompact with a missing transcript → exit 0, no stdout (compaction is never blocked), error logged', () => {
  const r = spawnSync(process.execPath, ['--disable-warning=ExperimentalWarning', 'dist/hook.js', 'pre-compact'], { input: '{"session_id":"mt","transcript_path":"/nonexistent/t.jsonl"}', encoding: 'utf8', env, timeout: 5000 });
  assert.equal(r.status, 0); assert.equal(r.stdout, '');
  assert.match(readFileSync(path.join(home, 'logs', 'hooks.log'), 'utf8'), /handler threw in pre-compact.*ENOENT/);
});
test('partial payload with stdin never closed → still exits after the idle timeout', async () => {
  const { spawn } = await import('node:child_process');
  const c = spawn(process.execPath, ['--disable-warning=ExperimentalWarning', 'dist/hook.js', 'user-prompt'], { env, stdio: ['pipe', 'pipe', 'pipe'] });
  c.stdin.write('{"session_id": "abc"'); const kill = setTimeout(() => c.kill(), 4000);
  const code = await new Promise((r) => c.on('exit', (code, sig) => r(sig ?? code))); clearTimeout(kill); c.stdin.destroy();
  assert.equal(code, 0);
});
