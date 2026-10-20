import path from 'node:path';
import { existsSync } from 'node:fs';
import { type TranscriptEntry, blocks, textOf, readTranscript } from '../lib/transcript.js';
import { paths } from '../lib/paths.js';
import { readJson } from '../lib/atomic.js';
import { redactJson } from '../lib/redaction.js';
import { loadState, type SessionState } from '../lib/session-state.js';
export type TaskState = { goalFirst: string; goalLatest: string; constraints: string[]; decisions: string[]; files: { path: string; action: string; at: string }[]; commands: { cmd: string; at: string }[]; tests: { cmd: string; lastLine: string }[]; openItems: string[]; errors: string[]; exactValues: string[]; pointers: string[] };
/** The last-session record (DESIGN §3.11): written by the Stop hook to projects/<key>/last-session.json, shown at the next startup in that project. */
export type LastSession = { at: string; sessionId: string; cwd: string; taskState: TaskState; drafts?: { file: string; count: number } };
const cap = (s: string, n: number) => (s.length > n ? s.slice(0, n - 1) + '…' : s);
const uniq = <T,>(a: T[]) => [...new Set(a)];
const TEST_RE = /\b(pytest|vitest|jest|cargo test|npm test|pnpm test|node --test|go test|bun test)\b/;
// DESIGN §3.4 exact values. `%` sits outside the trailing \b: a word boundary never follows `%` before a space or full stop.
// v1.4: a value is kept with the line that states it (a sentence a draft finding can be made from), and the lines come from the last
// assistant entries that carry text: a tool-calling turn is ten entries without a word, and the old window of 20 entries saw only those.
const VALUE_RE = /\$\d[\d,]*(?:\.\d+)?|\b\d+(?:\.\d+)?\s?(?:%|x\b|(?:ms|s|K|M|GB|MB|KB|tokens|bps|fills|trades|days|bars)\b)|\b\d{4,}(?:\.\d+)?\b|\b[0-9a-f]{7,40}\b/g;
// A markdown table row becomes "a · b · c" (results tables are where a session's numbers usually are); a separator row or code line is skipped.
// Workflow/Agent results open with path boilerplate whose run ids look like hashes ("Transcript dir: …/wf_1344b0b0-3a5"); never a value.
const BOILERPLATE_RE = /^(?:Transcript dir|Script file|To resume|\(Edit this file)\b|internal metadata/;
const valueLine = (line: string) => {
  let t = line.trim(); if (/^\|?[\s:|-]+\|?$/.test(t) || /^`/.test(t) || BOILERPLATE_RE.test(t)) return '';
  if (t.startsWith('|')) t = t.replace(/^\||\|$/g, '').split('|').map((c) => c.trim()).filter(Boolean).join(' · ');
  t = t.replace(/^(?:[>*•\-]\s+|\d+[.)]\s+)+/, '').replace(/\*\*/g, '').replace(/\s+/g, ' ').trim(); // list markers only: "12-1 momentum" keeps its 12-1
  VALUE_RE.lastIndex = 0; return t.length >= 12 && t.length <= 400 && VALUE_RE.test(t) ? cap(t, 160) : '';
};
const REPORT_TOOLS = new Set(['Agent', 'Workflow', 'Task']);

/** What the user actually typed in a user entry; '' for harness records: skill bodies and caveats (isMeta), async subagent replies
 *  (origin task-notification), the post-compaction summary, local command output. A slash command counts as its arguments. */
function promptText(e: TranscriptEntry): string {
  if (e.type !== 'user' || e.isMeta || e.isCompactSummary || (e.origin as any)?.kind === 'task-notification') return '';
  const t = textOf(e);
  if (/^<(task-notification|local-command-)/.test(t)) return '';
  if (t.startsWith('<command-name>')) return /<command-args>([\s\S]*?)<\/command-args>/.exec(t)?.[1].trim() ?? '';
  return t;
}

export function extractTaskState(entries: TranscriptEntry[], pointers: string[]): TaskState {
  const users = entries.map(promptText).filter(Boolean);
  const assistants = entries.filter((e) => e.type === 'assistant');
  const constraints: string[] = [], decisions: string[] = [], files = new Map<string, { action: string; at: string }>(), commands: { cmd: string; at: string }[] = [], tests: { cmd: string; lastLine: string }[] = [], errors: string[] = [], values: string[] = [];
  let openItems: string[] = [];
  for (const u of users) for (const line of u.split('\n')) if (/\b(must|never|always|only|don't|do not)\b/i.test(line)) constraints.push(cap(line.trim(), 200));
  for (const a of assistants) for (const line of textOf(a).split('\n')) if (/^(Decision|Decided|We will|Chosen|Verdict)\b/i.test(line.trim())) decisions.push(cap(line.trim(), 240));
  const results = new Map<string, string>();
  for (const e of entries) for (const b of blocks(e)) if (b?.type === 'tool_result') results.set(String(b.tool_use_id), typeof b.content === 'string' ? b.content : JSON.stringify(b.content));
  for (const e of entries) for (const b of blocks(e)) {
    if (b?.type !== 'tool_use') continue; const at = String(e.timestamp ?? ''); const inp = b.input ?? {};
    if (['Write', 'Edit', 'NotebookEdit', 'MultiEdit'].includes(b.name) && inp.file_path) { const p = String(inp.file_path); files.delete(p); files.set(p, { action: b.name, at }); }
    if (b.name === 'Bash' && inp.command) { const cmd = cap(String(inp.command), 120); commands.push({ cmd, at });
      if (TEST_RE.test(cmd)) { const out = results.get(String(b.id)) ?? ''; const last = out.trim().split('\n').filter(Boolean).pop() ?? ''; tests.push({ cmd, lastLine: cap(last, 160) }); } }
    if ((b.name === 'TodoWrite' || b.name === 'TaskCreate') && Array.isArray(inp.todos)) openItems = inp.todos.filter((t: any) => t.status !== 'completed').map((t: any) => cap(String(t.content ?? t.subject ?? ''), 160));
  }
  const recent = assistants.map(textOf).filter(Boolean).slice(-40).join('\n');
  for (const line of recent.split('\n')) if (/(Error|error:|Traceback|panic|FAIL)/.test(line)) errors.push(cap(line.trim(), 200));
  // Values: the recent assistant text, then the reports subagents and workflows returned (a two-hour experiment run states its numbers there).
  const reports: string[] = [];
  for (const e of entries) for (const b of blocks(e)) if (b?.type === 'tool_use' && REPORT_TOOLS.has(b.name)) { const r = results.get(String(b.id)); if (r) reports.push(r.slice(0, 20000)); }
  for (const line of [...recent.split('\n'), ...reports.slice(-10).join('\n').split('\n')]) { const v = valueLine(line); if (v) values.push(v); }
  const lastAt = new Map(commands.map((c) => [c.cmd, c.at]));
  return {
    goalFirst: cap(users[0] ?? '', 600), goalLatest: cap(users.at(-1) ?? '', 600),
    constraints: uniq(constraints).slice(0, 12), decisions: uniq(decisions).slice(0, 12),
    files: [...files.entries()].map(([path, v]) => ({ path, ...v })).slice(-40),
    commands: uniq(commands.map((c) => c.cmd)).slice(-20).map((cmd) => ({ cmd, at: lastAt.get(cmd)! })),
    tests: tests.slice(-10), openItems: openItems.slice(0, 20), errors: uniq(errors).slice(-10), exactValues: uniq(values).slice(-40), pointers,
  };
}

/** Recall pointers for a brief: every snapshot, then the three most recent offloaded outputs. */
export function recallPointers(state: SessionState): string[] {
  return state.snapshots.map((s) => `snapshot ${s.id} (${s.at}) → recall(id="${s.id}")`)
    .concat(state.seenBlobs.slice(-3).map((b) => `recent offloaded output → recall(id="${b.slice(0, 16)}")`));
}

/** The record PreCompact wrote (already redacted); when it is missing, re-extracted from the transcript (DESIGN §3.5); null when neither exists. */
export function loadTaskState(sessionId: string, transcriptPath: string): TaskState | null {
  const stored = readJson<TaskState>(path.join(paths.sessionDir(sessionId), 'task-state.json'));
  if (stored) return stored;
  if (!transcriptPath || !existsSync(transcriptPath)) return null;
  return JSON.parse(JSON.stringify(extractTaskState(readTranscript(transcriptPath, 0).entries, recallPointers(loadState(sessionId))), redactJson));
}

export function renderTaskState(ts: TaskState): string {
  const sec = (t: string, items: string[]) => (items.length ? `## ${t}\n${items.map((i) => `- ${i}`).join('\n')}\n` : '');
  return [
    `## Goal\n- First: ${ts.goalFirst}\n- Latest: ${ts.goalLatest}\n`,
    sec('Open items', ts.openItems), sec('Constraints', ts.constraints), sec('Decisions', ts.decisions),
    sec('Files', ts.files.map((f) => `${f.path} (${f.action} ${f.at})`)), sec('Exact values', ts.exactValues),
    sec('Tests', ts.tests.map((t) => `${t.cmd} → ${t.lastLine}`)), sec('Commands', ts.commands.map((c) => c.cmd)),
    sec('Errors', ts.errors), sec('Pointers', ts.pointers),
  ].filter(Boolean).join('\n');
}
