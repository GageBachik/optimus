import path from 'node:path';
import type { HookInput } from '../lib/run-hook.js';
import { charSafePrefix } from '../lib/budget.js';

// DESIGN §3.1: pointer brief ≤ 1,500 chars. Phase 2 appends the bank location and how to kb_brief.
export async function subagentStart(input: HookInput) {
  const proj = path.basename(String(input.cwd ?? '')) || 'this project';
  const text = `Project memory: project ${proj}. Offloaded tool outputs and pre-compaction snapshots reopen with recall(id). Keep your own context small: summarize what you read, do not paste large outputs back. (agent_type: ${String(input.agent_type ?? 'unknown')})`;
  return { hookSpecificOutput: { hookEventName: 'SubagentStart' as const, additionalContext: charSafePrefix(text, 1500) } };
}
export const handler = subagentStart;
