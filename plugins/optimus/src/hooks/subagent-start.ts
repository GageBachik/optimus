import path from 'node:path';
import type { HookInput } from '../lib/run-hook.js';
import { charSafePrefix } from '../lib/budget.js';
import { paths } from '../lib/paths.js';
import { log } from '../lib/log.js';
import { loadProjectConfig } from '../kb/project.js';
import { openDb } from '../kb/db.js';
import { rankFindings } from '../kb/rank.js';
import { findingLine } from '../kb/brief.js';
import { templateFor } from '../kb/templates.js';

const SUBAGENT_FINDINGS = 5, CAP = 3000;
/** DESIGN §3.1 (v1.4): a subagent gets the project card, the top findings for the project and the instruction to record what it
 *  measures, in at most 3,000 chars (was a 1,500-char pointer brief: a workflow's experiment agents never saw a finding and never wrote one). */
export async function subagentStart(input: HookInput) {
  const cwd = String(input.cwd ?? ''), cfg = loadProjectConfig(cwd), proj = cfg?.project_id ?? (path.basename(cwd) || 'this project');
  const lines = [`Project memory: project ${proj}${cfg ? `, domain ${cfg.domain}` : ''}. Offloaded tool outputs and pre-compaction snapshots reopen with recall(id). kb_brief({ project: "${proj}" }) returns the full brief; kb_find searches the bank at ${paths.bankDir()}. Keep your own context small: summarize what you read, do not paste large outputs back. (agent_type: ${String(input.agent_type ?? 'unknown')})`];
  if (cfg) {
    let gates: string[] = [];
    try {
      const db = openDb();
      try {
        const top = rankFindings(db, cfg, SUBAGENT_FINDINGS); if (top.length) lines.push('Findings that apply here:', ...top.map((f) => `- ${findingLine(f, cfg)}`));
        gates = templateFor(db, cfg.domain)?.gates ?? [];
      } finally { db.sql.close(); }
    } catch (e) { log('warn', 'subagent brief: findings skipped', String(e)); }
    // v1.5: tags and a gate, so a later prompt can recall the finding by concept and ranking can tell how far it was validated — findings
    // recorded without either (a whole build session's worth) were reachable only through the domain list.
    const gate = gates.length ? `, gate: "<one of ${gates.join(' | ')}>"` : '';
    lines.push(`If you measure a number or learn why something failed, record it before you finish: kb_write({ kind: "finding", title: "<one claim with the number>", domain: "${cfg.domain}", project: "${proj}", tags: ["<2-3 concept words a future prompt would use>"], attrs: { state: "observed"${gate} }, metrics: [...], evidence: [{ kind: "path", ref: "<file>" }] }). One call per result; the orchestrator will not do it for you.`);
  }
  return { hookSpecificOutput: { hookEventName: 'SubagentStart' as const, additionalContext: charSafePrefix(lines.join('\n'), CAP) } };
}
export const handler = subagentStart;
