import path from 'node:path';
import type { HookInput } from '../lib/run-hook.js';
import { paths } from '../lib/paths.js';
import { fitBrief, type Section } from '../lib/budget.js';
import { readJson } from '../lib/atomic.js';
import { loadState } from '../lib/session-state.js';
import { type LastSession, loadTaskState, recallPointers } from '../compaction/task-state.js';
import { PREAMBLE, buildRestoreBrief, type Audit } from '../compaction/restore-brief.js';

const out = (additionalContext: string) => ({ hookSpecificOutput: { hookEventName: 'SessionStart' as const, additionalContext } });

// DESIGN §3.11: where the last session in this project left off (priority 10), then the one-line project card (9). Phase 2 appends the bank sections.
export function buildStartupBrief(cwd: string): string {
  const sections: Section[] = [];
  const last = readJson<LastSession>(path.join(paths.projectDir(paths.projectKey(cwd)), 'last-session.json'));
  if (last) {
    const t = last.taskState;
    sections.push({ title: 'Last session in this project', priority: 10, items: [
      `When: ${last.at} (session ${last.sessionId}, in ${last.cwd})`, `Goal: ${t.goalFirst}`, `Latest: ${t.goalLatest}`,
      ...t.openItems.map((o) => `Open: ${o}`), ...t.decisions, ...t.files.map((f) => `${f.path} (${f.action})`), ...t.pointers,
    ] });
  }
  sections.push({ title: 'Project', priority: 9, items: [`Project memory active for ${path.basename(cwd) || 'this project'}. Large tool outputs are offloaded; recall(id) reopens them exactly. Knowledge-bank briefs arrive in phase 2.`] });
  return fitBrief(PREAMBLE, sections).text;
}

// DESIGN §3.1: main agent only. resume and fork inject nothing: the transcript already carries the context and re-injecting breaks the cache.
export async function sessionStart(input: HookInput) {
  if (input.agent_id) return undefined;
  const source = String(input.source ?? '');
  if (source === 'startup' || source === 'clear') return out(buildStartupBrief(String(input.cwd ?? '')));
  if (source !== 'compact') return undefined;
  const sessionId = String(input.session_id ?? 'unknown');
  const ts = loadTaskState(sessionId, String(input.transcript_path ?? ''));
  if (ts) return out(buildRestoreBrief(ts, readJson<Audit>(path.join(paths.sessionDir(sessionId), 'audit.json'))));
  return out(fitBrief('Context was compacted. No task-state record was found for this session.', [{ title: 'Pointers', priority: 1, items: recallPointers(loadState(sessionId)) }]).text);
}
export const handler = sessionStart;
