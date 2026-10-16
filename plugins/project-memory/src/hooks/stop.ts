import path from 'node:path';
import { appendFileSync, existsSync } from 'node:fs';
import type { HookInput } from '../lib/run-hook.js';
import { paths } from '../lib/paths.js';
import { writeFileAtomic } from '../lib/atomic.js';
import { redactJson } from '../lib/redaction.js';
import { readTranscript } from '../lib/transcript.js';
import { loadState } from '../lib/session-state.js';
import { type LastSession, type TaskState, extractTaskState, recallPointers } from '../compaction/task-state.js';

// DESIGN §3.1 / §3.11: main agent only; writes the last-session record and one usage sample. No report files.
export async function stop(input: HookInput): Promise<undefined> {
  if (input.agent_id) return undefined;
  const sessionId = String(input.session_id ?? 'unknown'); const cwd = String(input.cwd ?? ''); const tp = String(input.transcript_path ?? '');
  const at = new Date().toISOString();
  const entries = tp && existsSync(tp) ? readTranscript(tp, 0).entries : [];
  // No transcript: keep the previous last-session record rather than overwrite it with an empty one.
  if (entries.length) {
    const taskState: TaskState = JSON.parse(JSON.stringify(extractTaskState(entries, recallPointers(loadState(sessionId))), redactJson));
    const last: LastSession = { at, sessionId, cwd, taskState };
    writeFileAtomic(path.join(paths.projectDir(paths.projectKey(cwd)), 'last-session.json'), JSON.stringify(last) + '\n');
  }
  // Ruling R2: a turn without usage fields (or no transcript) still gets a line with nulls, so the measurement never skips a turn silently.
  const u = [...entries].reverse().find((e) => e.type === 'assistant' && e.message?.usage)?.message?.usage ?? {};
  appendFileSync(path.join(paths.stateDir(), 'metrics.jsonl'), JSON.stringify({ at, session: sessionId, input: u.input_tokens ?? null, cache_read: u.cache_read_input_tokens ?? null, cache_create: u.cache_creation_input_tokens ?? null }) + '\n');
  return undefined;
}
export const handler = stop;
