import path from 'node:path';
// Never import write.ts, concepts.ts or export.ts here: they reach `yaml`, which the hook bundle refuses (esbuild guard).
import type { Db } from './db.js';
import type { ProjectConfig } from './project.js';
import { normalizeName, tokens } from './normalize.js';
import { type Candidate, type Ranked, findingsAboutIn, findingsIn, loadCandidates, rankCandidates, rankFindings } from './rank.js';
import { comparisonSections } from './compare.js';
import { fitBrief, type Section } from '../lib/budget.js';
import { readJson } from '../lib/atomic.js';
import { paths } from '../lib/paths.js';
import type { SessionState } from '../lib/session-state.js';
import type { LastSession } from '../compaction/task-state.js';
import { pendingDrafts } from '../compaction/drafts.js';
import { PREAMBLE } from '../compaction/restore-brief.js';

/** Findings per brief before fitBrief trims; ~200 chars a line. */
// v1.4: six at startup and five per prompt. Twenty filled the 9,000-character cap and were never read (two live sessions, zero citations).
const TOP_FINDINGS = 6, RECALL_FINDINGS = 5;
const MEMORY_TITLES = 40;
/** kb_write's evidence origins (write.ts `Evidence.kind`); any other origin was written by an importer (DESIGN §4.10), i.e. is an imported memory. */
const WRITE_ORIGINS = ['commit', 'path', 'transcript', 'url'];

/** DESIGN §3.11 layer 1: where the last session in this project left off (priority 10); nothing when no record exists. */
export function lastSessionSection(projectKey: string): Section[] {
  const last = readJson<LastSession>(path.join(paths.projectDir(projectKey), 'last-session.json'));
  if (!last) return [];
  const t = last.taskState;
  // v1.5: the count comes from the draft file itself, not the last-session record, so a `kb write` run between turns stops the line.
  const drafts = pendingDrafts(projectKey);
  return [{ title: 'Last session in this project', priority: 10, items: [
    `When: ${last.at} (session ${last.sessionId}, in ${last.cwd})`, `Goal: ${t.goalFirst}`, `Latest: ${t.goalLatest}`,
    ...(drafts ? [`Draft findings waiting for review: ${drafts.count} — review ${drafts.file}, then record them with: ${paths.kbCli()} write ${drafts.file}`] : []),
    ...t.openItems.map((o) => `Open: ${o}`), ...t.decisions, ...t.files.map((f) => `${f.path} (${f.action})`), ...t.pointers,
  ] }];
}

/** DESIGN §4.7: the open synonym questions, one line each with the accept/reject commands; the startup brief shows at most 3, `kb concepts review` all. */
export function pendingQuestions(db: Db, max = 3): string[] {
  const rows = db.sql.prepare(`SELECT p.id, a.title AS at, b.title AS bt FROM pending_merge p JOIN note a ON a.id=p.a JOIN note b ON b.id=p.b
    WHERE p.resolved IS NULL ORDER BY p.score DESC, p.created_at, p.id LIMIT ?`).all(max) as { id: string; at: string; bt: string }[];
  return rows.map((r) => `Merge "${r.at}" into "${r.bt}"? ${paths.kbCli()} concepts accept ${r.id} | ${paths.kbCli()} concepts reject ${r.id}`);
}

/** DESIGN §4.6 partial credit made visible: which target axis or facet of the asking project differs from the finding's, and (§4.8) the pending transfer into it. */
function fitNotes(f: Candidate, cfg: ProjectConfig): string[] {
  const out: string[] = [], theirs = (xs: string[]) => [...new Set(xs)].join('/');
  for (const axis of ['environment', 'subject'] as const) {
    const want = cfg.target?.[axis], have = f.target[axis];
    if (want && have.length && !have.some((x) => normalizeName(x) === normalizeName(want))) out.push(`your ${axis} differs: ${want} vs ${theirs(have)}`);
  }
  for (const [k, v] of Object.entries(cfg.facets ?? {})) { const have = f.facets[k]; if (have && !have.includes(v)) out.push(`your ${k} differs: ${v} vs ${theirs(have)}`); }
  for (const p of f.proposals) if (p.project === cfg.project_id) out.push(`transfer ${p.state}: ${paths.kbCli()} transfer ${p.id} confirm|refute`);
  return out;
}
/** DESIGN §3.6: one line per finding, ending with its id and evidence pointer; given the asking project's config, the fit notes follow. */
export function findingLine(f: Candidate & { demoted?: boolean }, cfg?: ProjectConfig): string {
  const a = f.attrs;
  const meta = [a.state?.[0] ?? 'unverified', a.gate?.[0] && `gate ${a.gate[0]}`, a.valid_from?.[0] ?? f.updated_at.slice(0, 10), f.project && `project ${f.project}`, f.demoted && `expired ${a.valid_to?.[0]}`].filter(Boolean).join(', ');
  const notes = cfg ? fitNotes(f, cfg) : [];
  return `${f.title} (${meta}) [${f.id}] evidence: ${f.evidence.join('; ') || 'none'}${notes.length ? ` — ${notes.join('; ')}` : ''}`;
}

function projectCard(cfg: ProjectConfig): Section {
  const t = cfg.target, facets = Object.entries(cfg.facets ?? {}).map(([k, v]) => `${k}=${v}`);
  const parts = [`Domain ${cfg.domain}`, t?.environment || t?.subject ? `target ${t.environment ?? '?'} × ${t.subject ?? '?'}` : '', facets.length ? `facets ${facets.join(', ')}` : '', cfg.relies_on?.length ? `relies on ${cfg.relies_on.join(', ')}` : ''];
  return { title: `Project ${cfg.project_id}`, priority: 9, items: [`${parts.filter(Boolean).join('; ')}. Large tool outputs are offloaded; recall(id) reopens them exactly. kb_brief({ project: "${cfg.project_id}" }) re-reads this brief; kb_find searches the bank.`] };
}

export type ProjectBrief = { text: string; findings: Ranked[] };
/** DESIGN §3.6 startup brief: last session (10) → project card (9) → synonym questions (8) → top findings (7) → comparison blocks (6, §4.9) →
 *  imported memories (1). The memories section leads with the kb_find call so fitBrief, which trims from the end, drops titles before it. */
export function projectBrief(db: Db, cfg: ProjectConfig, questions: string[], limit = 9000, today = new Date()): ProjectBrief {
  const findings = rankFindings(db, cfg, TOP_FINDINGS, today);
  const memories = (db.sql.prepare(`SELECT n.title FROM note n WHERE n.kind='evidence' AND n.project=? AND n.deleted_at IS NULL
    AND NOT EXISTS (SELECT 1 FROM attr a WHERE a.note_id=n.id AND a.key='origin' AND a.value IN (${WRITE_ORIGINS.map(() => '?').join(',')}))
    ORDER BY n.updated_at DESC, n.id LIMIT ?`).all(cfg.project_id, ...WRITE_ORIGINS, MEMORY_TITLES) as { title: string }[]).map((m) => m.title);
  const sections: Section[] = [
    ...lastSessionSection(cfg.project_id), projectCard(cfg),
    { title: 'Pending concept questions', priority: 8, items: questions.slice(0, 3) },
    { title: 'Relevant findings', priority: 7, items: findings.map((f) => findingLine(f, cfg)) },
    ...comparisonSections(db, cfg),
    { title: 'Imported memories for this project', priority: 1, items: memories.length ? [`kb_find({ project: "${cfg.project_id}", kind: "evidence", text: "…" }) opens any of them`, ...memories] : [] },
  ];
  return { text: fitBrief(PREAMBLE, sections, limit).text, findings };
}
export const buildProjectBrief = (db: Db, cfg: ProjectConfig, questions: string[], limit = 9000): string => projectBrief(db, cfg, questions, limit).text;

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
/** DESIGN §3.6 recall brief: findings about the concepts the prompt names (alias table, matched as stemmed tokens) or recorded in the projects it
 *  names, minus the ids this agent was already briefed on; null when nothing is new. Marks the shown ids on `state`; the caller saves it. */
export function buildRecallBrief(db: Db, cfg: ProjectConfig, prompt: string, state: SessionState, today = new Date()): string | null {
  const words = new Set(tokens(prompt)); if (!words.size) return null;
  // ponytail: bag-of-tokens match (every stemmed token of the alias occurs somewhere in the prompt); add adjacency if briefs get noisy.
  const aliases = db.sql.prepare('SELECT a.name_norm, a.concept_id, n.title FROM alias a JOIN note n ON n.id=a.concept_id AND n.deleted_at IS NULL').all() as { name_norm: string; concept_id: string; title: string }[];
  const hits = aliases.filter((a) => a.name_norm && a.name_norm.split('-').every((t) => words.has(t)));
  // v1.5: a path in the prompt names folders, not projects ("/Users/loser/projects/x" matched the bogus import projects "loser" and
  // "projects" on every prompt); only projects with findings count, and never the asking project itself.
  const prose = prompt.replace(/\S*\/\S+/g, ' ');
  const projects = (db.sql.prepare("SELECT DISTINCT project FROM note WHERE kind='finding' AND project IS NOT NULL AND deleted_at IS NULL").all() as { project: string }[])
    .map((r) => r.project).filter((p) => p !== cfg.project_id && new RegExp(`\\b${escapeRe(p)}\\b`, 'i').test(prose));
  const names = [...new Set([...hits.map((h) => h.title), ...projects])];
  if (!names.length) return null;
  const fresh = [...new Set([...findingsAboutIn(db, [...new Set(hits.map((h) => h.concept_id))], cfg.domain), ...findingsIn(db, projects)])].filter((id) => !state.briefed.includes(id));
  if (!fresh.length) return null;
  const ranked = rankCandidates(db, loadCandidates(db, fresh), cfg, today).slice(0, RECALL_FINDINGS);
  state.briefed.push(...ranked.map((r) => r.id));
  return fitBrief(PREAMBLE, [{ title: `Knowledge bank on ${names.join(', ')}`, priority: 7, items: ranked.map((f) => findingLine(f, cfg)) }]).text;
}
