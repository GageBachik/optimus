import path from 'node:path';
import type { HookInput } from '../lib/run-hook.js';
import { paths } from '../lib/paths.js';
import { fitBrief } from '../lib/budget.js';
import { readJson } from '../lib/atomic.js';
import { log } from '../lib/log.js';
import { loadState, saveState } from '../lib/session-state.js';
import { loadTaskState, recallPointers } from '../compaction/task-state.js';
import { PREAMBLE, buildRestoreBrief, type Audit } from '../compaction/restore-brief.js';
import { openDb } from '../kb/db.js';
import { loadProjectConfig } from '../kb/project.js';
import { lastSessionSection, pendingQuestions, projectBrief } from '../kb/brief.js';
import { DEFAULT_LEXICON, autoRegister, autoLine, knownDomains, loadLexicon, type AutoRegistered, type Lexicon } from '../kb/auto-register.js';

/** The bank's domain lexicon for registration and the known-domain list; the built-in words when the bank is unreachable. */
function lexicon(): Lexicon {
  try { const db = openDb(); try { return loadLexicon(db); } finally { db.sql.close(); } } catch (e) { log('warn', 'bank unavailable; built-in domain lexicon', String(e)); return DEFAULT_LEXICON; }
}

const out = (additionalContext: string) => ({ hookSpecificOutput: { hookEventName: 'SessionStart' as const, additionalContext } });
/** Marker in state.briefed: the synonym questions were shown in this session (DESIGN §3.6: once per session). */
const QUESTIONS_SHOWN = 'concept-questions';

// DESIGN §3.11 / §3.6: last session (10) + project card (9); with a .kb.json the bank sections follow, and only the findings fitBrief kept in the text count as briefed.
export function buildStartupBrief(cwd: string, sessionId = 'unknown', auto: AutoRegistered | null = null, lex: Lexicon = DEFAULT_LEXICON): string {
  const cfg = loadProjectConfig(cwd);
  const text = startupText(cwd, sessionId, cfg);
  return auto ? `${autoLine(auto, knownDomains(lex))}\n\n${text}` : text;
}
function startupText(cwd: string, sessionId: string, cfg: ReturnType<typeof loadProjectConfig>): string {
  if (cfg) {
    try {
      const state = loadState(sessionId), db = openDb();
      try {
        const { text, findings } = projectBrief(db, cfg, state.briefed.includes(QUESTIONS_SHOWN) ? [] : pendingQuestions(db, 3));
        state.briefed = [...new Set([...state.briefed, QUESTIONS_SHOWN, ...findings.filter((f) => text.includes(`[${f.id}]`)).map((f) => f.id)])]; saveState(sessionId, state);
        return text;
      } finally { db.sql.close(); }
    } catch (e) { log('warn', 'bank brief failed; phase-1 brief only', String(e)); }
  }
  const hint = cfg ? 'The knowledge bank did not answer (see hooks.log).' : `No .kb.json here; ${paths.kbCli()} project init --domain <d> registers this repo.`;
  const card = `Project memory active for ${path.basename(cwd) || 'this project'}. Large tool outputs are offloaded; recall(id) reopens them exactly. ${hint}`;
  return fitBrief(PREAMBLE, [...lastSessionSection(paths.projectKey(cwd)), { title: 'Project', priority: 9, items: [card] }]).text;
}

// DESIGN §3.1: main agent only. resume and fork inject nothing: the transcript already carries the context and re-injecting breaks the cache.
export async function sessionStart(input: HookInput) {
  if (input.agent_id) return undefined;
  const source = String(input.source ?? ''), sessionId = String(input.session_id ?? 'unknown');
  if (source === 'startup' || source === 'clear') {
    const cwd = String(input.cwd ?? ''); let auto: AutoRegistered | null = null; const lex = lexicon();
    try { auto = autoRegister(cwd, undefined, lex); } catch (e) { log('warn', 'auto-register failed', String(e)); }
    return out(buildStartupBrief(cwd, sessionId, auto, lex));
  }
  if (source !== 'compact') return undefined;
  const ts = loadTaskState(sessionId, String(input.transcript_path ?? ''));
  if (ts) return out(buildRestoreBrief(ts, readJson<Audit>(path.join(paths.sessionDir(sessionId), 'audit.json'))));
  return out(fitBrief('Context was compacted. No task-state record was found for this session.', [{ title: 'Pointers', priority: 1, items: recallPointers(loadState(sessionId)) }]).text);
}
export const handler = sessionStart;
