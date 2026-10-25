import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readTranscript, blocks, type TranscriptEntry } from '../lib/transcript.js';

/** `auditWritten`: PostCompact wrote audit.json after the forced /compact. `auditBeforeRestore`: it did so before SessionStart(compact) fired (DESIGN §3.5 records which order this Claude Code uses). */
export type LiveResult = { postToolUseReplaced: boolean; subagentBriefSeen: boolean; capTruncates: boolean; auditWritten: boolean; auditBeforeRestore: boolean; wallMs: number; log: string };
export type LiveEvent = { ev?: string; source?: string; transcript_path?: string; tool_name?: string };
type HookEntry = { matcher?: string; hooks: { type: 'command'; command: string; args: string[]; timeout: number }[] };

export const START_MARKER = 'START-MARKER-ALPHA-1111'; export const END_MARKER = 'END-MARKER-OMEGA-9999';
// Ported from the 2026-10-16 hook probes (start, post, sub): `brief` is the 12,000-char SessionStart test hook (DESIGN §1 rule 5: over the 10,000 cap only a 2,000-char preview survives); `log` records the event, with tool_response for PostToolUse so the Read shape is on record.
export const PROBE_MJS = `import fs from 'node:fs';
const raw = fs.readFileSync(0, 'utf8'); let j = {}; try { j = JSON.parse(raw); } catch {}
const [mode, logFile] = process.argv.slice(2);
fs.appendFileSync(logFile, JSON.stringify({ t: new Date().toISOString(), ev: j.hook_event_name, source: j.source, transcript_path: j.transcript_path, tool_name: j.tool_name, tool_response: j.hook_event_name === 'PostToolUse' ? j.tool_response : undefined }) + '\\n');
if (mode === 'brief') process.stdout.write(JSON.stringify({ hookSpecificOutput: { hookEventName: 'SessionStart', additionalContext: '${START_MARKER} begins. ' + 'filler-text-line-to-pad-the-brief-past-the-cap. '.repeat(250) + ' ${END_MARKER}.' } }));
`;
// seq 1 5000 = 23,893 chars: over the 20,000 offload threshold, under Claude Code's 30,000-char Bash read-back window (DESIGN §3.2).
export const PROMPT = `Follow these steps exactly, in order. Do not read any file other than hello.txt and do not run any command other than the one given.
1. Run the Bash command: seq 1 5000
2. Read the file hello.txt with the Read tool.
3. Use the Agent tool once (subagent_type general-purpose) with this prompt: "Do not use any tools. Reply with the complete text of every note mentioning 'Project memory' or 'recall' that you can see in your context, verbatim. If there is none, reply NONE."
4. Reply with exactly these five lines and nothing else:
SAW_START=<yes if the text ${START_MARKER} appears anywhere in your context, else no>
SAW_END=<yes if the text ${END_MARKER} appears anywhere in your context, else no>
BASH_PLACEHOLDER=<yes if the seq output you received contains the words "lines offloaded", else no>
SUBAGENT=<the subagent's reply on one line>
DONE`;

/** Temp-project settings: the plugin's real dist/hook.js for PostToolUse(Bash), SubagentStart, PreCompact, PostCompact; the probe for the oversized startup brief and event logging. */
export function liveSettings(hookJs: string, probe: string, logFile: string): { hooks: Record<string, HookEntry[]> } {
  const plugin = (event: string, timeout: number): HookEntry['hooks'][number] => ({ type: 'command', command: 'node', args: ['--disable-warning=ExperimentalWarning', hookJs, event], timeout });
  const log: HookEntry['hooks'][number] = { type: 'command', command: 'node', args: [probe, 'log', logFile], timeout: 10 };
  return { hooks: {
    SessionStart: [{ matcher: 'startup', hooks: [{ type: 'command', command: 'node', args: [probe, 'brief', logFile], timeout: 10 }] }, { matcher: 'compact|resume', hooks: [log] }],
    PostToolUse: [{ matcher: 'Bash', hooks: [plugin('post-tool-use', 10)] }, { matcher: 'Read', hooks: [log] }],
    SubagentStart: [{ hooks: [plugin('subagent-start', 5)] }],
    PreCompact: [{ hooks: [plugin('pre-compact', 30), log] }],
    PostCompact: [{ hooks: [plugin('post-compact', 15), log] }],
  } };
}
/** Every user-role text the model received before the first compaction: tool results (after PostToolUse replacement) and harness messages such as the task-notification that carries an async subagent's reply. */
export function userTexts(entries: TranscriptEntry[]): string[] {
  const end = entries.findIndex((e) => e.type === 'system' && e.subtype === 'compact_boundary');
  return (end >= 0 ? entries.slice(0, end) : entries).filter((e) => e.type === 'user').flatMap(blocks)
    .map((b) => (b?.type === 'text' ? String(b.text) : b?.type === 'tool_result' ? (typeof b.content === 'string' ? b.content : (Array.isArray(b.content) ? b.content : []).filter((c: any) => c?.type === 'text').map((c: any) => String(c.text)).join('\n')) : ''))
    .filter(Boolean);
}
export function evaluate(a: { result: string; texts: string[]; events: LiveEvent[]; auditExists: boolean }): Omit<LiveResult, 'wallMs' | 'log'> {
  const at = (ev: string, source?: string) => a.events.findIndex((e) => e.ev === ev && (source === undefined || e.source === source));
  const post = at('PostCompact'), restore = at('SessionStart', 'compact');
  return {
    postToolUseReplaced: a.texts.some((t) => t.includes('lines offloaded · id')),
    subagentBriefSeen: a.texts.some((t) => t.includes('recall(id)')),
    capTruncates: /SAW_START=yes/i.test(a.result) && /SAW_END=no/i.test(a.result),
    auditWritten: a.auditExists,
    auditBeforeRestore: a.auditExists && post >= 0 && restore > post,
  };
}
const parse = (s: string): any => { try { return JSON.parse(s); } catch { return null; } };
/** dist/hook.js of this plugin, found from dist/kb.js or src/cli. */
function findHookJs(): string {
  for (let d = path.dirname(fileURLToPath(import.meta.url)); ; d = path.dirname(d)) { const f = path.join(d, 'dist', 'hook.js'); if (existsSync(f)) return f; if (path.dirname(d) === d) throw new Error('dist/hook.js not found; run npm run build'); }
}
/** DESIGN §7 `--live`: two headless claude-haiku-5-5 runs in a temp project (the marker run, then `/compact` resumed into it), with their own OPTIMUS_HOME. The temp dir is kept for inspection (events.jsonl, state/). */
export function runLiveTest(opts: { hookJs?: string; claude?: string } = {}): LiveResult {
  const hookJs = opts.hookJs ?? findHookJs(); const claude = opts.claude ?? 'claude';
  const dir = mkdtempSync(path.join(tmpdir(), 'pm-live-')); const state = path.join(dir, 'state'); const probe = path.join(dir, 'probe.mjs'); const logFile = path.join(dir, 'events.jsonl');
  mkdirSync(path.join(dir, '.claude')); writeFileSync(probe, PROBE_MJS); writeFileSync(path.join(dir, 'hello.txt'), 'hello from the optimus live test\n');
  writeFileSync(path.join(dir, '.claude', 'settings.json'), JSON.stringify(liveSettings(hookJs, probe, logFile), null, 2));
  const { CLAUDECODE: _nested, ...env } = process.env; // env -u CLAUDECODE: a nested claude refuses to start inside a Claude Code session
  const run = (args: string[]) => spawnSync(claude, [...args, '--permission-mode', 'bypassPermissions', '--model', 'claude-haiku-5-5', '--max-turns', '12', '--output-format', 'json', '--setting-sources', 'project'],
    { cwd: dir, env: { ...env, OPTIMUS_HOME: state }, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 600_000, maxBuffer: 64 * 1024 * 1024, windowsHide: true });
  const started = Date.now(); const lines = [`dir: ${dir}`];
  const r1 = run(['-p', PROMPT]); const out1 = r1.stdout ?? '', err1 = (r1.stderr ?? '').trim(); const j1 = parse(out1);
  lines.push(`run1: exit ${r1.status}${r1.error ? ` error: ${r1.error.message}` : ''}${err1 ? ` stderr: ${err1}` : ''}`, `run1 result: ${j1?.result ?? out1.slice(0, 1000)}`);
  if (j1?.session_id) { const r2 = run(['-p', '/compact', '--resume', j1.session_id]); const out2 = r2.stdout ?? '', err2 = (r2.stderr ?? '').trim(); lines.push(`run2 (/compact): exit ${r2.status}${r2.error ? ` error: ${r2.error.message}` : ''}${err2 ? ` stderr: ${err2}` : ''}`, `run2 result: ${parse(out2)?.result ?? out2.slice(0, 1000)}`); }
  const wallMs = Date.now() - started;
  const events: LiveEvent[] = existsSync(logFile) ? readFileSync(logFile, 'utf8').split('\n').map(parse).filter(Boolean) : [];
  const tp = events.find((e) => e.transcript_path)?.transcript_path;
  const texts = tp && existsSync(tp) ? userTexts(readTranscript(tp).entries) : [];
  const auditExists = typeof j1?.session_id === 'string' && existsSync(path.join(state, 'sessions', j1.session_id, 'main', 'audit.json'));
  lines.push(`events: ${events.map((e) => `${e.ev}${e.source ? `(${e.source})` : ''}${e.tool_name ? `(${e.tool_name})` : ''}`).join(' → ') || 'none logged'}`, `audit.json: ${auditExists ? 'present' : 'absent'}`);
  const hooksLog = path.join(state, 'logs', 'hooks.log'); if (existsSync(hooksLog)) lines.push('hooks.log:', readFileSync(hooksLog, 'utf8').trim());
  return { ...evaluate({ result: String(j1?.result ?? ''), texts, events, auditExists }), wallMs, log: lines.join('\n') };
}
