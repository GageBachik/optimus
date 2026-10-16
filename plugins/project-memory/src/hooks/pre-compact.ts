import path from 'node:path';
import type { HookInput } from '../lib/run-hook.js';
import { readTranscript } from '../lib/transcript.js';
import { type TaskState, extractTaskState, renderTaskState, recallPointers } from '../compaction/task-state.js';
import { storeBlob } from '../offload/blobs.js';
import { loadState, saveState } from '../lib/session-state.js';
import { writeFileAtomic } from '../lib/atomic.js';
import { redactJson } from '../lib/redaction.js';
import { paths } from '../lib/paths.js';
import { log } from '../lib/log.js';

// DESIGN §3.4: main agent only; never returns a decision (a block would cancel compaction).
export async function preCompact(input: HookInput): Promise<undefined> {
  if (input.agent_id) return undefined;
  const sessionId = String(input.session_id ?? 'unknown'); const tp = String(input.transcript_path ?? '');
  if (!tp) return undefined;
  const state = loadState(sessionId);
  const delta = readTranscript(tp, state.lastSnapshotOffset);
  const text = delta.entries.map((e) => JSON.stringify(e, redactJson)).join('\n');
  if (text) {
    const blob = storeBlob(text, { tool: 'snapshot', sessionId });
    state.snapshots.push({ id: blob.id16, from: state.lastSnapshotOffset, to: delta.toOffset, at: new Date().toISOString() });
    state.lastSnapshotOffset = delta.toOffset;
  }
  // Always rebuilt from the whole transcript, never from a previous record (DESIGN §3.4: no summary-of-summary).
  const ts: TaskState = JSON.parse(JSON.stringify(extractTaskState(readTranscript(tp, 0).entries, recallPointers(state)), redactJson));
  const dir = paths.sessionDir(sessionId);
  writeFileAtomic(path.join(dir, 'task-state.md'), renderTaskState(ts));
  writeFileAtomic(path.join(dir, 'task-state.json'), JSON.stringify(ts) + '\n');
  saveState(sessionId, state);
  log('info', 'pre-compact snapshot written', { sessionId, trigger: input.trigger, snapshots: state.snapshots.length });
  return undefined;
}
export const handler = preCompact;
