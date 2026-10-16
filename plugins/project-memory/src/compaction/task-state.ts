import { type TranscriptEntry, blocks, textOf } from '../lib/transcript.js';
export type TaskState = { goalFirst: string; goalLatest: string; constraints: string[]; decisions: string[]; files: { path: string; action: string; at: string }[]; commands: { cmd: string; at: string }[]; tests: { cmd: string; lastLine: string }[]; openItems: string[]; errors: string[]; exactValues: string[]; pointers: string[] };
const cap = (s: string, n: number) => (s.length > n ? s.slice(0, n - 1) + '…' : s);
const uniq = <T,>(a: T[]) => [...new Set(a)];
const TEST_RE = /\b(pytest|vitest|jest|cargo test|npm test|pnpm test|node --test|go test|bun test)\b/;
// DESIGN §3.4 exact values. `%` sits outside the trailing \b: a word boundary never follows `%` before a space or full stop.
const VALUE_RE = /\b\d+(?:\.\d+)?\s?(?:%|(?:ms|s|K|M|GB|MB|KB|tokens|bps)\b)|\b\d{4,}(?:\.\d+)?\b|\b[0-9a-f]{7,40}\b/g;

export function extractTaskState(entries: TranscriptEntry[], pointers: string[]): TaskState {
  const users = entries.filter((e) => e.type === 'user' && textOf(e));
  const assistants = entries.filter((e) => e.type === 'assistant');
  const constraints: string[] = [], decisions: string[] = [], files = new Map<string, { action: string; at: string }>(), commands: { cmd: string; at: string }[] = [], tests: { cmd: string; lastLine: string }[] = [], errors: string[] = [], values: string[] = [];
  let openItems: string[] = [];
  for (const u of users) for (const line of textOf(u).split('\n')) if (/\b(must|never|always|only|don't|do not)\b/i.test(line)) constraints.push(cap(line.trim(), 200));
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
  const recent = assistants.slice(-20).map(textOf).join('\n');
  for (const line of recent.split('\n')) if (/(Error|error:|Traceback|panic|FAIL)/.test(line)) errors.push(cap(line.trim(), 200));
  for (const m of recent.matchAll(VALUE_RE)) values.push(m[0]);
  const lastAt = new Map(commands.map((c) => [c.cmd, c.at]));
  return {
    goalFirst: cap(users[0] ? textOf(users[0]) : '', 600), goalLatest: cap(users.at(-1) ? textOf(users.at(-1)!) : '', 600),
    constraints: uniq(constraints).slice(0, 12), decisions: uniq(decisions).slice(0, 12),
    files: [...files.entries()].map(([path, v]) => ({ path, ...v })).slice(-40),
    commands: uniq(commands.map((c) => c.cmd)).slice(-20).map((cmd) => ({ cmd, at: lastAt.get(cmd)! })),
    tests: tests.slice(-10), openItems: openItems.slice(0, 20), errors: uniq(errors).slice(-10), exactValues: uniq(values).slice(-40), pointers,
  };
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
