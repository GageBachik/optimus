import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
test('dist/hook.js exists and exits 0 on an unknown event with empty stdin', () => {
  assert.ok(existsSync('dist/hook.js'), 'run npm run build first');
  const r = spawnSync(process.execPath, ['--disable-warning=ExperimentalWarning', 'dist/hook.js', 'no-such-event'], { input: '', encoding: 'utf8', timeout: 5000 });
  assert.equal(r.status, 0); assert.equal(r.stdout, '');
});
test('a hook result larger than the stdout pipe buffer arrives complete (stdout is flushed before exit)', () => {
  // An MCP result: one dominant block that is offloaded, plus a second large block that stays and makes the re-serialised output ~95 KB (> the 64 KB pipe buffer).
  const fx = readFileSync('tests/fixtures/posttooluse-mcp-blocks.json', 'utf8').replace('@@BIG@@', ('y'.repeat(99) + '\\n').repeat(2000)).replace('@@BIG2@@', 'z'.repeat(90_000));
  const env = { ...process.env, PROJECT_MEMORY_HOME: mkdtempSync(path.join(tmpdir(), 'pm-')) };
  const r = spawnSync(process.execPath, ['--disable-warning=ExperimentalWarning', 'dist/hook.js', 'post-tool-use'], { input: fx, encoding: 'utf8', timeout: 10_000, env, maxBuffer: 16 * 1024 * 1024 });
  assert.equal(r.status, 0);
  assert.ok(r.stdout.length > 64 * 1024, `output is ${r.stdout.length} chars; the test needs more than the pipe buffer`);
  const out = JSON.parse(r.stdout); // truncated output does not parse
  assert.equal(out.hookSpecificOutput.updatedToolOutput[1].text.length, 90_000);
  assert.match(out.hookSpecificOutput.updatedToolOutput[0].text, /recall/);
});
