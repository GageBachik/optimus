import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
process.env.OPTIMUS_HOME = mkdtempSync(path.join(tmpdir(), 'pm-'));
const { offload } = await import('../../src/offload/offload.js');
const out = Array.from({ length: 240 }, (_, i) => `line ${i} ${'y'.repeat(44)}`).join('\n'); // ~12.5K chars
const input = (tool: string, resp: unknown) => ({ hook_event_name: 'PostToolUse', session_id: 's', tool_name: tool, tool_input: { command: 'x' }, tool_response: resp } as any);
test('shell output offloads from 10K chars; a search result of the same size keeps the 20K threshold', () => {
  assert.ok(offload(input('Bash', { stdout: out, stderr: '', interrupted: false })), 'Bash at 12.5K is offloaded');
  assert.equal(offload(input('Grep', { output: out })), undefined, 'Grep at 12.5K is left alone');
});
