import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, existsSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
process.env.OPTIMUS_HOME = mkdtempSync(path.join(tmpdir(), 'pm-'));
process.env.OPTIMUS_BANK = mkdtempSync(path.join(tmpdir(), 'bank-')); // not a git repo: stop's kb sync spawn stays a no-op, and the real bank is never touched
const { handler: sub } = await import('../../src/hooks/subagent-start.js');
const { handler: stop } = await import('../../src/hooks/stop.js');
const { handler: end } = await import('../../src/hooks/session-end.js');
test('subagent pointer is short and names recall', async () => {
  const r: any = await sub({ session_id: 's', cwd: '/w/genibook', agent_id: 'a1', agent_type: 'general-purpose' });
  assert.ok(r.hookSpecificOutput.additionalContext.length <= 1500); assert.match(r.hookSpecificOutput.additionalContext, /recall\(id\)/); assert.match(r.hookSpecificOutput.additionalContext, /genibook/);
  assert.match(r.hookSpecificOutput.additionalContext, /kb_brief\(\{ project: "genibook" \}\)/); assert.ok(r.hookSpecificOutput.additionalContext.includes(process.env.OPTIMUS_BANK ?? 'knowledge-bank'));
});
test('stop appends a metrics line (main only); session-end removes the session dir', async () => {
  await stop({ session_id: 's2', cwd: '/w', transcript_path: 'tests/fixtures/transcript-small.jsonl', last_assistant_message: 'done' });
  await stop({ session_id: 's2', cwd: '/w', transcript_path: 'tests/fixtures/transcript-small.jsonl', last_assistant_message: 'sub', agent_id: 'a9' });
  const m = readFileSync(path.join(process.env.OPTIMUS_HOME!, 'metrics.jsonl'), 'utf8').trim().split('\n'); assert.equal(m.length, 1);
  const { paths } = await import('../../src/lib/paths.js');
  const ls = JSON.parse(readFileSync(path.join(paths.projectDir(paths.projectKey('/w')), 'last-session.json'), 'utf8')); assert.equal(ls.sessionId, 's2'); assert.match(ls.taskState.goalFirst, /Fix the ES backtest/);
  const s2 = path.join(process.env.OPTIMUS_HOME!, 'sessions', 's2');
  await end({ session_id: 's2', cwd: '/w', agent_id: 'a9' }); assert.ok(existsSync(s2), "a subagent's SessionEnd leaves the main agent's session state in place (DESIGN §3.1)");
  await end({ session_id: 's2', cwd: '/w' }); assert.ok(!existsSync(s2));
});

test('v1.6: a turn that stated a measurement and recorded nothing is asked once to record it; a turn that called kb_write, or a continued stop, is not', async () => {
  const { mkdtempSync: mk, writeFileSync: wf } = await import('node:fs');
  const cwd = mk(path.join(tmpdir(), 'rec-')); wf(path.join(cwd, '.kb.json'), JSON.stringify({ project_id: 'es', domain: 'trading' }));
  const u = (t: string) => JSON.stringify({ type: 'user', message: { role: 'user', content: t } });
  const a = (t: string) => JSON.stringify({ type: 'assistant', message: { role: 'assistant', content: [{ type: 'text', text: t }], usage: { input_tokens: 2, cache_read_input_tokens: 1000 } } });
  const tool = (name: string) => JSON.stringify({ type: 'assistant', message: { role: 'assistant', content: [{ type: 'tool_use', id: 't1', name, input: {} }] } });
  const tp = path.join(cwd, 'transcript.jsonl');
  wf(tp, [u('run the walk-forward'), a('Walk-forward on 255 days: 17% win rate, worst day -$83,636, Sharpe 1.4 on 23 fills.')].join('\n') + '\n');
  const r1: any = await stop({ session_id: 'rec1', cwd, transcript_path: tp });
  assert.equal(r1?.decision, 'block'); assert.match(r1.reason, /^Optimus: before finishing, record/); assert.match(r1.reason, /17% win rate, worst day -\$83,636/); assert.match(r1.reason, /kb_write\(\{ kind: "finding"/);
  const r2 = await stop({ session_id: 'rec1', cwd, transcript_path: tp, stop_hook_active: true });
  assert.equal(r2, undefined, 'the continued stop is never asked again');
  const r3 = await stop({ session_id: 'rec1', cwd, transcript_path: tp });
  assert.equal(r3, undefined, 'the same statements are not asked about twice: they are in the log now');
  wf(tp, [u('now the next idea'), a('Fixed-fractional 0.5% beat fixed lot: Sharpe 1.4 vs 0.9 over 2019-2025.'), tool('mcp__plugin_optimus_optimus__kb_write')].join('\n') + '\n', { flag: 'a' });
  const r4 = await stop({ session_id: 'rec1', cwd, transcript_path: tp });
  assert.equal(r4, undefined, 'a turn that recorded its own finding is not asked');
  wf(tp, [u('and one more'), a('Slippage model at 2 bps cut PnL by $4,120 on 593 fills.')].join('\n') + '\n', { flag: 'a' });
  const r5: any = await stop({ session_id: 'rec1', cwd, transcript_path: tp });
  assert.equal(r5?.decision, 'block'); assert.match(r5.reason, /Slippage model at 2 bps/); assert.ok(!/17% win rate/.test(r5.reason), 'only this turn\'s new statements are listed');
});

test('v1.6: the final message of a turn is judged even when the transcript file does not hold it yet (Claude Code starts Stop before the flush); a flushed message is not listed twice', async () => {
  const { mkdtempSync: mk, writeFileSync: wf } = await import('node:fs');
  const cwd = mk(path.join(tmpdir(), 'late-')); wf(path.join(cwd, '.kb.json'), JSON.stringify({ project_id: 'late', domain: 'tooling' }));
  const u = (t: string) => JSON.stringify({ type: 'user', message: { role: 'user', content: t } });
  const a = (t: string) => JSON.stringify({ type: 'assistant', message: { role: 'assistant', content: [{ type: 'text', text: t }], usage: { input_tokens: 2, cache_read_input_tokens: 1000 } } });
  const tool = (name: string) => JSON.stringify({ type: 'assistant', message: { role: 'assistant', content: [{ type: 'tool_use', id: 't1', name, input: {} }] } });
  const tp = path.join(cwd, 'transcript.jsonl');
  const first = 'A 3e8-iteration empty loop in Node takes 1878 ms wall-clock on this machine.';
  wf(tp, [u('time the loop'), tool('Bash')].join('\n') + '\n'); // the final text is not in the file yet
  const r1: any = await stop({ session_id: 'late1', cwd, transcript_path: tp, last_assistant_message: first });
  assert.equal(r1?.decision, 'block'); assert.match(r1.reason, /1878 ms wall-clock/);
  const second = 'The same loop sorted takes 2,410 ms wall-clock on this machine.';
  wf(tp, [a(first), u('and the sorted one?'), a(second)].join('\n') + '\n', { flag: 'a' }); // this time the file holds the final message
  const r2: any = await stop({ session_id: 'late1', cwd, transcript_path: tp, last_assistant_message: second });
  assert.equal(r2?.decision, 'block'); assert.match(r2.reason, /2,410 ms/);
  assert.equal((r2.reason.match(/^- /gm) ?? []).length, 1, 'one candidate: the flushed message is not counted twice, the first turn\'s statement is in the log');
});

test('v1.6 (first Windows live session): Stop waits up to a second for the late flush, so the metrics line carries the turn\'s own usage and the turn is logged as judged', async () => {
  const { mkdtempSync: mk, writeFileSync: wf, appendFileSync: af } = await import('node:fs');
  const cwd = mk(path.join(tmpdir(), 'flush-')); wf(path.join(cwd, '.kb.json'), JSON.stringify({ project_id: 'flush', domain: 'tooling' }));
  const u = (t: string) => JSON.stringify({ type: 'user', message: { role: 'user', content: t } });
  const a = (t: string, cr: number) => JSON.stringify({ type: 'assistant', message: { role: 'assistant', content: [{ type: 'text', text: t }], usage: { input_tokens: 2, cache_read_input_tokens: cr } } });
  const tool = (name: string, cr: number) => JSON.stringify({ type: 'assistant', message: { role: 'assistant', content: [{ type: 'tool_use', id: 't1', name, input: {} }], usage: { input_tokens: 2, cache_read_input_tokens: cr } } });
  const tp = path.join(cwd, 'transcript.jsonl'), last = 'The suite finished with 136 tests, 136 passes and 0 failures in 25,157 ms on this machine.';
  wf(tp, [u('run the suite'), tool('Bash', 16388)].join('\n') + '\n');
  setTimeout(() => af(tp, a(last, 43123) + '\n'), 300); // Claude Code flushes the final message a moment after starting the hook
  const r: any = await stop({ session_id: 'flush1', cwd, transcript_path: tp, last_assistant_message: last });
  assert.equal(r?.decision, 'block'); assert.match(r.reason, /136 tests/);
  const lines = readFileSync(path.join(process.env.OPTIMUS_HOME!, 'metrics.jsonl'), 'utf8').trim().split('\n'), m = JSON.parse(lines[lines.length - 1]);
  assert.equal(m.session, 'flush1'); assert.equal(m.cache_read, 43123, 'the flushed final message\'s usage, not the tool call\'s');
  assert.match(readFileSync(path.join(process.env.OPTIMUS_HOME!, 'logs', 'hooks.log'), 'utf8'), /"msg":"stop: turn judged".*"project":"flush".*"asked":true/);
});
