import path from 'node:path';
import { appendFileSync, existsSync } from 'node:fs';
import type { HookInput } from '../lib/run-hook.js';
import { paths } from '../lib/paths.js';
import { writeFileAtomic } from '../lib/atomic.js';
import { redactJson } from '../lib/redaction.js';
import { readTranscript, textOf, type TranscriptEntry } from '../lib/transcript.js';
import { loadState } from '../lib/session-state.js';
import { spawnKbSync } from '../lib/kb-sync.js';
import { log } from '../lib/log.js';
import { type LastSession, type TaskState, extractTaskState, recallPointers } from '../compaction/task-state.js';
import { buildDrafts, draftKey, existingDraftKeys, writeDrafts, type DraftSpec } from '../compaction/drafts.js';
import { loadProjectConfig, type ProjectConfig } from '../kb/project.js';

const MAX_ASK = 8;
/** Index of the last prompt the user typed: a user entry whose text is not a harness record (isMeta, or text that opens with "<" or "["). */
function lastPromptIndex(entries: TranscriptEntry[]): number {
  for (let i = entries.length - 1; i >= 0; i--) {
    const e = entries[i]; if (e.type !== 'user' || e.isMeta) continue;
    const c = e.message?.content;
    const text = typeof c === 'string' ? c : Array.isArray(c) ? c.filter((x: any) => x?.type === 'text').map((x: any) => String(x.text ?? '')).join('\n') : '';
    if (text.trim() && !/^\s*[<[]/.test(text)) return i;
  }
  return 0;
}
/** Claude Code starts the Stop hook before the turn's final assistant message has always reached the transcript file (2026-10-24, a
 *  headless session: its one measured sentence was not in the file at hook time, so nothing was asked and the metrics line carried the
 *  previous message's usage). The hook input carries that message; when the file's last assistant text is not it yet, it is appended as one
 *  more entry so the turn is judged whole. */
function withLastMessage(entries: TranscriptEntry[], last: unknown): TranscriptEntry[] {
  if (typeof last !== 'string' || !last.trim()) return entries;
  const prev = [...entries].reverse().find((e) => e.type === 'assistant' && textOf(e));
  if (prev && textOf(prev) === last.trim()) return entries;
  return [...entries, { type: 'assistant', message: { role: 'assistant', content: [{ type: 'text', text: last }] } }];
}
const wroteFindings = (turn: TranscriptEntry[]) => turn.some((e) => e.type === 'assistant' && Array.isArray(e.message?.content) && (e.message!.content as any[]).some((b) => b?.type === 'tool_use' && /kb_write$/.test(String(b.name ?? ''))));
const askText = (cfg: ProjectConfig, ask: DraftSpec['records']) => [
  `Optimus: before finishing, record what this turn established. For each candidate below that is a durable, reusable result (a measurement, the cause of a failure, a limit that was hit), call kb_write({ kind: "finding", title: "<one claim with the number>", domain: "${cfg.domain}", project: "${cfg.project_id}", tags: ["<2-3 concept words a future prompt would use>"], attrs: { state: "observed" }, evidence: [{ kind: "path", ref: "<file>" }] }). Skip narration, definitions, dated prices and advice. Then finish; this request is not repeated for these statements.`,
  ...ask.map((r) => `- ${r.title}`),
].join('\n');

// DESIGN §3.1 / §3.11: main agent only; writes the last-session record and one usage sample; runs `kb sync` when the last one is older than 60 s.
// v1.6: the session records its own findings. The turn's measured statements are drafted into the project's log, and when the turn recorded
// nothing itself, the hook asks the session once (decision "block" with the candidates) to judge and write the durable ones. The log is
// never something a person has to process by hand.
export async function stop(input: HookInput) {
  if (input.agent_id) return undefined;
  const sessionId = String(input.session_id ?? 'unknown'); const cwd = String(input.cwd ?? ''); const tp = String(input.transcript_path ?? '');
  const at = new Date().toISOString();
  const entries = tp && existsSync(tp) ? withLastMessage(readTranscript(tp, 0).entries, input.last_assistant_message) : [];
  let cfg: ProjectConfig | null = null, ask: DraftSpec['records'] = [];
  // No transcript: keep the previous last-session record rather than overwrite it with an empty one.
  if (entries.length) {
    const taskState: TaskState = JSON.parse(JSON.stringify(extractTaskState(entries, recallPointers(loadState(sessionId))), redactJson));
    cfg = loadProjectConfig(cwd);
    let drafts: LastSession['drafts'];
    if (cfg) {
      const key = paths.projectKey(cwd), turn = entries.slice(lastPromptIndex(entries));
      const turnState: TaskState = JSON.parse(JSON.stringify(extractTaskState(turn, []), redactJson));
      const spec = buildDrafts(cfg, turnState, tp), known = existingDraftKeys(key);
      const fresh = spec.records.filter((r) => !known.has(draftKey(r.title)));
      drafts = writeDrafts(key, spec);
      if (fresh.length && !input.stop_hook_active && !wroteFindings(turn)) ask = fresh.slice(0, MAX_ASK);
    }
    const last: LastSession = { at, sessionId, cwd, taskState, ...(drafts ? { drafts } : {}) };
    writeFileAtomic(path.join(paths.projectDir(paths.projectKey(cwd)), 'last-session.json'), JSON.stringify(last) + '\n');
  }
  // Ruling R2: a turn without usage fields (or no transcript) still gets a line with nulls, so the measurement never skips a turn silently.
  const u = [...entries].reverse().find((e) => e.type === 'assistant' && e.message?.usage)?.message?.usage ?? {};
  appendFileSync(path.join(paths.stateDir(), 'metrics.jsonl'), JSON.stringify({ at, session: sessionId, input: u.input_tokens ?? null, cache_read: u.cache_read_input_tokens ?? null, cache_create: u.cache_creation_input_tokens ?? null }) + '\n');
  // DESIGN §4.4: sync when the last one is older than 60 s; never synced (unparsable date) counts as 0.
  if (Date.now() - (Date.parse(paths.config().lastSyncAt ?? '') || 0) > 60_000) spawnKbSync();
  if (cfg && ask.length) { log('info', 'stop: asked the session to record', { project: cfg.project_id, candidates: ask.length }); return { decision: 'block' as const, reason: askText(cfg, ask) }; }
  return undefined;
}
export const handler = stop;
