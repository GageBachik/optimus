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
