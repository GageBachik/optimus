import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
process.env.OPTIMUS_HOME = mkdtempSync(path.join(tmpdir(), 'pm-'));
const { offload } = await import('../../src/offload/offload.js');
const { readBlob } = await import('../../src/offload/blobs.js');
const big = Array.from({ length: 800 }, (_, i) => `line ${i} ${'y'.repeat(50)}`).join('\n'); // ~46K chars
const fx = (name: string, fill: Record<string, string>) => JSON.parse(Object.entries(fill).reduce((s, [k, v]) => s.split(k).join(JSON.stringify(v).slice(1, -1)), readFileSync(`tests/fixtures/${name}`, 'utf8')));
test('Bash stdout over threshold → head+tail placeholder, shape preserved, original recallable', () => {
  const u = offload(fx('posttooluse-bash.json', { '@@BIG@@': big }))!.hookSpecificOutput.updatedToolOutput as any;
  assert.equal(u.stderr, ''); assert.equal(u.interrupted, false);
  assert.ok(u.stdout.startsWith('line 0 ')); assert.ok(u.stdout.trimEnd().endsWith('line 799 ' + 'y'.repeat(50)));
  assert.match(u.stdout, /…\[\d+ lines offloaded · id [0-9a-f]{16} · recall\(id="[0-9a-f]{16}", offset=0\) pages the full [\d,]+ chars\]…/);
  const id16 = u.stdout.match(/id ([0-9a-f]{16})/)![1]; let full = ''; for (let o: number | null = 0; o !== null;) { const pg = readBlob(id16, o, 32768); full += pg.text; o = pg.next; } assert.equal(full, big); // pages: readBlob clamps to 32,768 (DESIGN §3.3)
});
test('ambiguous MCP shape left untouched (review focus 1); below threshold untouched', () => {
  assert.equal(offload(fx('posttooluse-mcp-blocks.json', { '@@BIG@@': big, '@@BIG2@@': big.replace(/y/g, 'z') })), undefined);
  assert.equal(offload(fx('posttooluse-bash.json', { '@@BIG@@': 'small' })), undefined);
});
test('identical output twice in the same agent → short pointer; a subagent gets the full placeholder (review focus 6)', () => {
  offload(fx('posttooluse-bash.json', { '@@BIG@@': big }));
  const second = offload(fx('posttooluse-bash.json', { '@@BIG@@': big }))!; assert.match((second.hookSpecificOutput.updatedToolOutput as any).stdout, /same output as earlier/);
  const sub = offload({ ...fx('posttooluse-bash.json', { '@@BIG@@': big }), agent_id: 'a1' })!; assert.ok((sub.hookSpecificOutput.updatedToolOutput as any).stdout.startsWith('line 0 '));
});
test('determinism: same input → byte-identical placeholder in a fresh home', () => {
  const a = JSON.stringify(offload(fx('posttooluse-bash.json', { '@@BIG@@': big, 's-fixture': 's-det' })));
  process.env.OPTIMUS_HOME = mkdtempSync(path.join(tmpdir(), 'pm-'));
  const b = JSON.stringify(offload(fx('posttooluse-bash.json', { '@@BIG@@': big, 's-fixture': 's-det' })));
  assert.equal(a, b);
});
test('field over 1,000,000 chars left untouched: redaction would reduce it to a bare marker', () => {
  const huge = Array.from({ length: 20000 }, (_, i) => `line ${i} ${'y'.repeat(50)}`).join('\n'); // ~1.2M chars
  assert.equal(offload(fx('posttooluse-bash.json', { '@@BIG@@': huge })), undefined);
});
test('one 30,000-char line (minified JSON) left untouched: whole-line placeholder would not be shorter', () => {
  assert.equal(offload(fx('posttooluse-mcp-blocks.json', { '@@BIG@@': 'x'.repeat(30000), '@@BIG2@@': 'ok' })), undefined);
});
