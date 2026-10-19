import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync, appendFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
process.env.PROJECT_MEMORY_HOME = mkdtempSync(path.join(tmpdir(), 'pm-'));
const { readTranscript } = await import('../../src/lib/transcript.js');
const { extractTaskState, renderTaskState } = await import('../../src/compaction/task-state.js');
const { preCompact } = await import('../../src/hooks/pre-compact.js');
const { loadState } = await import('../../src/lib/session-state.js');
const fx = 'tests/fixtures/transcript-small.jsonl';
test('task-state extracts the record; bare small integers are not exact values', () => {
  const ts = extractTaskState(readTranscript(fx).entries, ['snapshot abc']);
  assert.match(ts.goalFirst, /Fix the ES backtest/); assert.match(ts.goalLatest, /Sharpe/);
  assert.ok(ts.constraints.some((c) => /must never exceed 2%/.test(c))); assert.ok(ts.decisions.some((d) => /fixed-fractional 0.5%/.test(d)));
  assert.deepEqual(ts.files.map((f) => f.path), ['/w/sizing.py']); assert.ok(ts.commands.some((c) => c.cmd.startsWith('pytest')));
  assert.equal(ts.tests[0].lastLine, '4 passed in 1.2s'); assert.deepEqual(ts.openItems, ['re-run walk-forward on NQ']);
  assert.ok(ts.errors.some((e) => /FileNotFoundError/.test(e)));
  assert.ok(ts.exactValues.some((v) => v.includes('30001'))); assert.ok(!ts.exactValues.some((v) => /\b4\b/.test(v) && !/30001|0\.5%/.test(v)));
  assert.ok(ts.exactValues.some((v) => v.includes('0.5%'))); // a % unit is followed by a non-word char, so it must not need a trailing \b
  assert.ok(renderTaskState(ts).startsWith('## Goal'));
});
test('harness user entries (skill body, task-notification, compact summary, command output) are not the goal or constraints', () => {
  const u = (text: string, extra: object = {}) => ({ type: 'user', ...extra, message: { role: 'user', content: text } });
  const ts = extractTaskState([
    u('Refactor the parser, never touch the lexer'),
    u('# Workflow authoring reference\nYou must always load this skill', { isMeta: true }),
    u('<task-notification>\n<result>Subagent says: never ship on Friday</result>', { origin: { kind: 'task-notification' } }),
    u('This session is being continued... must only use X', { isCompactSummary: true }),
    u('<local-command-stdout>Compacted, always</local-command-stdout>'),
    u('<command-name>/compact</command-name>\n<command-message>compact</command-message>\n<command-args></command-args>'),
  ] as any, []);
  assert.equal(ts.goalFirst, 'Refactor the parser, never touch the lexer'); assert.equal(ts.goalLatest, ts.goalFirst);
  assert.deepEqual(ts.constraints, ['Refactor the parser, never touch the lexer']);
  const cmd = extractTaskState([u('<command-name>/fix</command-name>\n<command-args>the flaky test</command-args>')] as any, []);
  assert.equal(cmd.goalLatest, 'the flaky test');
});
test('two PreCompact calls snapshot the delta (review focus 4); subagent PreCompact is ignored', async () => {
  const tp = path.join(process.env.PROJECT_MEMORY_HOME!, 't.jsonl'); writeFileSync(tp, readFileSync(fx, 'utf8'));
  await preCompact({ session_id: 'pc1', transcript_path: tp, cwd: '/tmp', hook_event_name: 'PreCompact', trigger: 'auto' });
  appendFileSync(tp, '{"type":"user","timestamp":"2026-10-16T10:02:00Z","message":{"role":"user","content":[{"type":"text","text":"next"}]}}\n');
  await preCompact({ session_id: 'pc1', transcript_path: tp, cwd: '/tmp', hook_event_name: 'PreCompact', trigger: 'manual' });
  const s = loadState('pc1'); assert.equal(s.snapshots.length, 2); assert.equal(s.snapshots[1].from, s.snapshots[0].to); assert.ok(s.snapshots[1].to > s.snapshots[1].from);
  assert.ok(existsSync(path.join(process.env.PROJECT_MEMORY_HOME!, 'sessions', 'pc1', 'main', 'task-state.json')));
  await preCompact({ session_id: 'pc1', transcript_path: tp, cwd: '/tmp', hook_event_name: 'PreCompact', trigger: 'auto', agent_id: 'sub1' });
  assert.equal(loadState('pc1').snapshots.length, 2);
});
test('secrets in the transcript are redacted in the snapshot blob and the task-state files (DESIGN §1 rule 10)', async () => {
  const secret = 'AKIA' + 'ABCDEFGHIJKLMNOP';
  const tp = path.join(process.env.PROJECT_MEMORY_HOME!, 's.jsonl');
  writeFileSync(tp, JSON.stringify({ type: 'user', timestamp: '2026-10-16T11:00:00Z', message: { role: 'user', content: [{ type: 'text', text: `deploy with "${secret}" and never log it` }] } }) + '\n');
  await preCompact({ session_id: 'pc2', transcript_path: tp, cwd: '/tmp', hook_event_name: 'PreCompact', trigger: 'auto' });
  const { readBlob } = await import('../../src/offload/blobs.js');
  const dir = path.join(process.env.PROJECT_MEMORY_HOME!, 'sessions', 'pc2', 'main');
  for (const text of [readBlob(loadState('pc2').snapshots[0].id).text, readFileSync(path.join(dir, 'task-state.md'), 'utf8'), readFileSync(path.join(dir, 'task-state.json'), 'utf8')]) {
    assert.ok(!text.includes(secret)); assert.ok(text.includes('[REDACTED:aws]'));
  }
});
