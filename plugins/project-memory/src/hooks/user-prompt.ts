import type { HookInput } from '../lib/run-hook.js';
import { log } from '../lib/log.js';
import { loadState, saveState } from '../lib/session-state.js';
import { openDb } from '../kb/db.js';
import { loadProjectConfig } from '../kb/project.js';
import { buildRecallBrief } from '../kb/brief.js';
import { settleFromPrompt, settledLine } from '../kb/auto-register.js';

// DESIGN §3.1 UserPromptSubmit: recall brief for the concepts and projects the prompt names that this agent has not been briefed on;
// if the bank query throws, the last successful brief cached in state.json is injected instead. Nothing without a .kb.json.
export async function userPrompt(input: HookInput) {
  const prompt = String(input.prompt ?? ''), cwd = String(input.cwd ?? '');
  let settled = null as ReturnType<typeof settleFromPrompt>;
  if (prompt.trim() && !input.agent_id) { try { settled = settleFromPrompt(cwd, prompt); } catch (e) { log('warn', 'settle from prompt failed', String(e)); } }
  const cfg = prompt.trim() ? loadProjectConfig(cwd) : null;
  if (!cfg) return undefined;
  const sessionId = String(input.session_id ?? 'unknown'), agentId = input.agent_id ? String(input.agent_id) : 'main';
  const state = loadState(sessionId, agentId);
  let text: string | null = null;
  try {
    const db = openDb();
    try { text = buildRecallBrief(db, cfg, prompt, state); } finally { db.sql.close(); }
    if (text) { state.lastBrief = text; saveState(sessionId, state, agentId); }
  } catch (e) { log('warn', 'recall brief failed; injecting the cached brief', String(e)); text = state.lastBrief ?? null; }
  if (settled) text = `${settledLine(settled)}\n\n${text ?? ''}`.trim();
  return text ? { hookSpecificOutput: { hookEventName: 'UserPromptSubmit' as const, additionalContext: text } } : undefined;
}
export const handler = userPrompt;
