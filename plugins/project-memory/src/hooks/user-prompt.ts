import type { HookInput } from '../lib/run-hook.js';
import { log } from '../lib/log.js';
import { loadState, saveState } from '../lib/session-state.js';
import { openDb, type Db } from '../kb/db.js';
import { loadProjectConfig } from '../kb/project.js';
import { buildRecallBrief } from '../kb/brief.js';
import { DEFAULT_LEXICON, decisionLine, loadLexicon, needsDecision, settleFromPrompt, settledLine } from '../kb/auto-register.js';

// DESIGN §3.1 UserPromptSubmit: recall brief for the concepts and projects the prompt names that this agent has not been briefed on;
// if the bank query throws, the last successful brief cached in state.json is injected instead. Nothing without a .kb.json.
// v1.5: the domain lexicon comes from the bank's templates (built-in words when the bank is unreachable); a low-confidence folder whose
// first substantive prompt did not settle it gets the domain decision line, once per folder (the mark is in .kb.json).
// Claude Code fires UserPromptSubmit for text the harness itself injects as a user turn: background-task notices, slash-command records,
// local command output, system reminders. None is a prompt: on 2026-10-20 a Workflow completion notice settled a trading folder to
// "tooling" because its text said "scripts" and "agents", and such notices briefed, settled and spent the once-per-folder decision for hours.
const HARNESS_RE = /^\s*(?:<task-notification>|<command-name>|<local-command-stdout>|<local-command-caveat>|<system-reminder>|\[SYSTEM NOTIFICATION)/;
export async function userPrompt(input: HookInput) {
  const prompt = String(input.prompt ?? ''), cwd = String(input.cwd ?? '');
  if (!prompt.trim() || HARNESS_RE.test(prompt) || !loadProjectConfig(cwd)) return undefined; // no .kb.json: the bank is not opened at all
  let db: Db | null = null, lex = DEFAULT_LEXICON;
  try { db = openDb(); lex = loadLexicon(db); } catch (e) { log('warn', 'bank unavailable; built-in domain lexicon', String(e)); }
  let head = '';
  if (!input.agent_id) {
    try { const s = settleFromPrompt(cwd, prompt, lex); if (s) head = settledLine(s); else { const d = needsDecision(cwd, prompt, lex); if (d) head = decisionLine(d); } }
    catch (e) { log('warn', 'settle from prompt failed', String(e)); }
  }
  const cfg = loadProjectConfig(cwd); // re-read: a settle may have rewritten the domain, and the brief is for the settled one
  if (!cfg) { db?.sql.close(); return undefined; }
  const sessionId = String(input.session_id ?? 'unknown'), agentId = input.agent_id ? String(input.agent_id) : 'main';
  const state = loadState(sessionId, agentId);
  let text: string | null = null;
  try {
    if (!db) throw new Error('bank unavailable');
    text = buildRecallBrief(db, cfg, prompt, state);
    if (text) { state.lastBrief = text; try { saveState(sessionId, state, agentId); } catch (e) { log('warn', 'session state not saved', String(e)); } }
  } catch (e) { log('warn', 'recall brief failed; injecting the cached brief', String(e)); text = state.lastBrief ?? null; } finally { db?.sql.close(); }
  text = `${head}\n\n${text ?? ''}`.trim();
  return text ? { hookSpecificOutput: { hookEventName: 'UserPromptSubmit' as const, additionalContext: text } } : undefined;
}
export const handler = userPrompt;
