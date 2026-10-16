import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, utimesSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
process.env.PROJECT_MEMORY_HOME = mkdtempSync(path.join(tmpdir(), 'pm-'));
const { storeBlob, readBlob, gcBlobs } = await import('../../src/offload/blobs.js');
const { redactSensitive } = await import('../../src/lib/redaction.js');
test('redaction masks an Anthropic key and an uppercase API_KEY=, counts both', () => {
  const r = redactSensitive('key sk-ant-oat01-abcdefghijklmnopqrstuvwxyz0123456789 and API_KEY=ZZZZZZZZZZZZZZZZZZZZZZ');
  assert.equal(r.count, 2); assert.ok(!r.text.includes('sk-ant-oat01')); assert.ok(!r.text.includes('ZZZZZZZZZZZZZZZZZZZZZZ'));
});
test('storeBlob is content-addressed; readBlob pages exactly', () => {
  const text = Array.from({ length: 500 }, (_, i) => `line ${i} ${'x'.repeat(40)}`).join('\n');
  const a = storeBlob(text, { tool: 'Bash', sessionId: 's1' }); const b = storeBlob(text, { tool: 'Bash', sessionId: 's1' });
  assert.equal(a.id, b.id); assert.equal(a.created, true); assert.equal(b.created, false);
  const page = readBlob(a.id16, 0, 100); assert.equal(page.text, text.slice(0, 100)); assert.equal(page.next, 100);
  const tail = readBlob(a.id, text.length - 10, 100); assert.equal(tail.text, text.slice(-10)); assert.equal(tail.next, null);
});
test('a stored blob never contains the secret; Bearer form redacts (review focus 5)', () => {
  const r = redactSensitive('AUTH: Bearer abcdefghijklmnopqrstuvwxyz012345'); assert.equal(r.count, 1);
  const s = storeBlob(r.text, { tool: 'Bash', sessionId: 's1' }); assert.ok(!readBlob(s.id).text.includes('abcdefghijklmnopqrstuvwxyz012345'));
});
test('gcBlobs drops blobs past the age limit, then oldest-first past the byte cap', () => {
  const dir = path.join(process.env.PROJECT_MEMORY_HOME!, 'blobs');
  const old = storeBlob('old blob', { tool: 'Bash', sessionId: 's2' }); const t = Date.now() / 1000 - 30 * 86400;
  utimesSync(path.join(dir, old.id), t, t);
  const before = readdirSync(dir).filter((f) => f.length === 64).length;
  assert.equal(gcBlobs(14).removed, 1);
  assert.equal(gcBlobs(14, 0).removed, before - 1);
  assert.equal(readdirSync(dir).filter((f) => f.length === 64).length, 0);
});
