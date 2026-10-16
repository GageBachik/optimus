import path from 'node:path';
import type { HookInput } from '../lib/run-hook.js';
import { paths } from '../lib/paths.js';
import { writeFileAtomic } from '../lib/atomic.js';
import { log } from '../lib/log.js';
import { loadTaskState } from '../compaction/task-state.js';
import { auditSummary } from '../compaction/audit.js';

// DESIGN §3.5: main agent only. Diff the native summary against the PreCompact record; the omissions are what the restore brief re-injects first.
export async function postCompact(input: HookInput): Promise<undefined> {
  if (input.agent_id) return undefined;
  const summary = String(input.compact_summary ?? '');
  if (!summary) return undefined;
  const sessionId = String(input.session_id ?? 'unknown');
  const ts = loadTaskState(sessionId, String(input.transcript_path ?? ''));
  if (!ts) return undefined;
  const audit = auditSummary(summary, ts);
  writeFileAtomic(path.join(paths.sessionDir(sessionId), 'audit.json'), JSON.stringify({ ...audit, summary_chars: summary.length, at: new Date().toISOString() }, null, 2) + '\n');
  log('info', 'post-compact audit written', { sessionId, present: audit.present.length, missing: audit.missing.length });
  return undefined;
}
export const handler = postCompact;
