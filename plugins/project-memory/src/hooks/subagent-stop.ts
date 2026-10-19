import { existsSync } from 'node:fs';
import type { HookInput } from '../lib/run-hook.js';
import { paths } from '../lib/paths.js';
import { readTranscript } from '../lib/transcript.js';
import { log } from '../lib/log.js';
import { loadProjectConfig } from '../kb/project.js';
import { extractTaskState } from '../compaction/task-state.js';
import { buildDrafts, writeDrafts } from '../compaction/drafts.js';

/** DESIGN §3.11 (v1.4): when a subagent finishes, the measurements in its own transcript become draft findings in the project's draft file,
 *  so experiments run by a workflow's agents are not lost when only their one-paragraph report reaches the main agent. */
export async function subagentStop(input: HookInput): Promise<undefined> {
  const cwd = String(input.cwd ?? ''), tp = String(input.agent_transcript_path ?? '');
  const cfg = loadProjectConfig(cwd); if (!cfg || !tp || !existsSync(tp)) return undefined;
  try {
    const ts = extractTaskState(readTranscript(tp, 0).entries, []);
    const w = writeDrafts(paths.projectKey(cwd), buildDrafts(cfg, ts, tp));
    if (w) log('info', 'subagent drafts merged', { agent: String(input.agent_id ?? ''), count: w.count });
  } catch (e) { log('warn', 'subagent drafts failed', String(e)); }
  return undefined;
}
export const handler = subagentStop;
