import path from 'node:path';
import type { HookInput } from '../lib/run-hook.js';
import { charSafePrefix } from '../lib/budget.js';
import { paths } from '../lib/paths.js';
import { loadProjectConfig } from '../kb/project.js';

// DESIGN §3.1: pointer brief ≤ 1,500 chars: project id, bank location, how to recall, how to kb_brief.
export async function subagentStart(input: HookInput) {
  const cwd = String(input.cwd ?? ''), proj = loadProjectConfig(cwd)?.project_id ?? (path.basename(cwd) || 'this project');
  const text = `Project memory: project ${proj}. Offloaded tool outputs and pre-compaction snapshots reopen with recall(id). Knowledge bank at ${paths.bankDir()}: kb_brief({ project: "${proj}" }) returns the ranked findings brief for this project; kb_find searches it. Keep your own context small: summarize what you read, do not paste large outputs back. (agent_type: ${String(input.agent_type ?? 'unknown')})`;
  return { hookSpecificOutput: { hookEventName: 'SubagentStart' as const, additionalContext: charSafePrefix(text, 1500) } };
}
export const handler = subagentStart;
