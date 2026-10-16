import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { liveSettings, PROBE_MJS, START_MARKER, END_MARKER, evaluate, userTexts } from '../../src/cli/live-test.js';
test('live settings register dist/hook.js for the four plugin events and a 12,000-char SessionStart test hook', () => {
  const s = liveSettings('/x/dist/hook.js', '/t/probe.mjs', '/t/events.jsonl').hooks;
  const args = (ev: string, matcher?: string) => s[ev].find((e) => e.matcher === matcher)!.hooks[0].args;
  assert.deepEqual(args('PostToolUse', 'Bash').slice(1), ['/x/dist/hook.js', 'post-tool-use']);
  assert.equal(args('SubagentStart')[2], 'subagent-start'); assert.equal(args('PreCompact')[2], 'pre-compact'); assert.equal(args('PostCompact')[2], 'post-compact');
  assert.deepEqual(args('SessionStart', 'startup'), ['/t/probe.mjs', 'brief', '/t/events.jsonl']);
  const d = mkdtempSync(path.join(tmpdir(), 'pm-live-')); const probe = path.join(d, 'probe.mjs'); writeFileSync(probe, PROBE_MJS);
  const r = spawnSync(process.execPath, [probe, 'brief', path.join(d, 'events.jsonl')], { input: JSON.stringify({ hook_event_name: 'SessionStart', source: 'startup' }), encoding: 'utf8' });
  const ctx: string = JSON.parse(r.stdout).hookSpecificOutput.additionalContext;
  assert.ok(ctx.length >= 12000, `brief is ${ctx.length} chars`); assert.ok(ctx.startsWith(START_MARKER)); assert.ok(ctx.endsWith(END_MARKER + '.'));
  assert.equal(JSON.parse(readFileSync(path.join(d, 'events.jsonl'), 'utf8')).ev, 'SessionStart');
});
test('evaluate reads the markers from user-role texts before the compaction, the model reply and the hook event order', () => {
  const entries = [
    { type: 'user', message: { content: [{ type: 'tool_result', content: '1\n2\n…[4955 lines offloaded · id 0123456789abcdef · recall(id="0123456789abcdef", offset=0) pages the full 23,892 chars]…\n4999\n5000' }] } },
    { type: 'user', message: { content: [{ type: 'tool_result', content: [{ type: 'text', text: 'Async agent launched successfully. You will be notified when it completes.' }] }] } },
    { type: 'user', origin: { kind: 'task-notification' }, message: { content: '<task-notification><result>Project memory: project x. Offloaded tool outputs reopen with recall(id).</result></task-notification>' } },
    { type: 'assistant', message: { content: [{ type: 'text', text: 'recall(id) lines offloaded · id' }] } },
    { type: 'system', subtype: 'compact_boundary' },
    { type: 'user', isCompactSummary: true, message: { content: 'summary repeating recall(id) and lines offloaded · id' } },
  ];
  const texts = userTexts(entries as any); assert.equal(texts.length, 3, 'assistant text and post-compaction entries never count');
  const events = [{ ev: 'SessionStart', source: 'startup' }, { ev: 'PreCompact' }, { ev: 'PostCompact' }, { ev: 'SessionStart', source: 'compact' }];
  assert.deepEqual(evaluate({ result: 'SAW_START=yes\nSAW_END=no\nDONE', texts, events, auditExists: true }), { postToolUseReplaced: true, subagentBriefSeen: true, capTruncates: true, auditWritten: true, auditBeforeRestore: true });
  assert.deepEqual(evaluate({ result: 'SAW_START=yes\nSAW_END=yes', texts: texts.slice(1, 2), events: [events[0], events[1], events[3], events[2]], auditExists: true }), { postToolUseReplaced: false, subagentBriefSeen: false, capTruncates: false, auditWritten: true, auditBeforeRestore: false });
  assert.equal(evaluate({ result: '', texts: [], events, auditExists: false }).auditWritten, false);
});
