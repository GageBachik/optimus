import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, existsSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
process.env.PROJECT_MEMORY_HOME = mkdtempSync(path.join(tmpdir(), 'pm-'));
const { handler: sub } = await import('../../src/hooks/subagent-start.js');
const { handler: stop } = await import('../../src/hooks/stop.js');
const { handler: end } = await import('../../src/hooks/session-end.js');
test('subagent pointer is short and names recall', async () => {
  const r: any = await sub({ session_id: 's', cwd: '/w/genibook', agent_id: 'a1', agent_type: 'general-purpose' });
  assert.ok(r.hookSpecificOutput.additionalContext.length <= 1500); assert.match(r.hookSpecificOutput.additionalContext, /recall\(id\)/); assert.match(r.hookSpecificOutput.additionalContext, /genibook/);
  assert.match(r.hookSpecificOutput.additionalContext, /kb_brief\(\{ project: "genibook" \}\)/); assert.ok(r.hookSpecificOutput.additionalContext.includes(process.env.PROJECT_MEMORY_BANK ?? 'knowledge-bank'));
});
test('stop appends a metrics line (main only); session-end removes the session dir', async () => {
  await stop({ session_id: 's2', cwd: '/w', transcript_path: 'tests/fixtures/transcript-small.jsonl', last_assistant_message: 'done' });
  await stop({ session_id: 's2', cwd: '/w', transcript_path: 'tests/fixtures/transcript-small.jsonl', last_assistant_message: 'sub', agent_id: 'a9' });
  const m = readFileSync(path.join(process.env.PROJECT_MEMORY_HOME!, 'metrics.jsonl'), 'utf8').trim().split('\n'); assert.equal(m.length, 1);
  const { paths } = await import('../../src/lib/paths.js');
  const ls = JSON.parse(readFileSync(path.join(paths.projectDir(paths.projectKey('/w')), 'last-session.json'), 'utf8')); assert.equal(ls.sessionId, 's2'); assert.match(ls.taskState.goalFirst, /Fix the ES backtest/);
  await end({ session_id: 's2', cwd: '/w' }); assert.ok(!existsSync(path.join(process.env.PROJECT_MEMORY_HOME!, 'sessions', 's2')));
});
