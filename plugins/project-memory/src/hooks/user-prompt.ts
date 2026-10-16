import type { HookInput } from '../lib/run-hook.js';
import { log } from '../lib/log.js';
import { loadState, saveState } from '../lib/session-state.js';
import { openDb } from '../kb/db.js';
import { loadProjectConfig } from '../kb/project.js';
import { buildRecallBrief } from '../kb/brief.js';

// DESIGN §3.1 UserPromptSubmit: recall brief for the concepts and projects the prompt names that this agent has not been briefed on;
// if the bank query throws, the last successful brief cached in state.json is injected instead. Nothing without a .kb.json.
export async function userPrompt(input: HookInput) {
  const prompt = String(input.prompt ?? ''), cfg = prompt.trim() ? loadProjectConfig(String(input.cwd ?? '')) : null;
  if (!cfg) return undefined;
  const sessionId = String(input.session_id ?? 'unknown'), agentId = input.agent_id ? String(input.agent_id) : 'main';
  const state = loadState(sessionId, agentId);
  let text: string | null = null;
  try {
    const db = openDb();
    try { text = buildRecallBrief(db, cfg, prompt, state); } finally { db.sql.close(); }
    if (text) { state.lastBrief = text; saveState(sessionId, state, agentId); }
  } catch (e) { log('warn', 'recall brief failed; injecting the cached brief', String(e)); text = state.lastBrief ?? null; }
  return text ? { hookSpecificOutput: { hookEventName: 'UserPromptSubmit' as const, additionalContext: text } } : undefined;
}
export const handler = userPrompt;
