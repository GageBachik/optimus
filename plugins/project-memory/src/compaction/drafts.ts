import path from 'node:path';
import { existsSync, readFileSync } from 'node:fs';
import type { TaskState } from './task-state.js';
import type { ProjectConfig } from '../kb/project.js';
import { paths } from '../lib/paths.js';
import { writeFileAtomic } from '../lib/atomic.js';

/** A `kb write` spec drafted from a session's value lines: one finding per distinct sentence that states a number, backed by the transcript and
 *  the files the session touched. Nothing is written to the bank until a person runs `kb write <file>`, so a draft is a review step, not a habit. */
export type DraftSpec = { defaults: { domain: string; project: string }; records: { kind: 'finding'; title: string; body: string; attrs: Record<string, string>; evidence: { kind: 'transcript' | 'path'; ref: string }[]; written?: string }[] };
const MAX_DRAFTS = 8;
// The first 100 normalised characters: a title cut at a word (v1.5) and the same sentence cut at 120 characters (earlier records) must
// match, or a recorded draft comes back as pending the turn after it was written (seen on quant-research, 2026-10-20).
const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9%$.]+/g, ' ').trim().slice(0, 100);
// A draft is an impersonal claim with a measurement in it. Narration ("I'll raise the window from 200K to 300K") has numbers too; the
// first run on a working session drafted eight lines of it. Measurement: a %, a $ figure, a unit, or a metric word. Narration: a person.
// v1.5 (first real session, quant-research): a signed decimal ("correlation is +0.35"), "5 times", "a year" and the word correlation are
// measurements too; and a bare "I" counts as narration only at the start of the line ("I turned every idea into a backtest"), not inside a
// claim ("under all 16 ways I tried of defining high VIX").
const MEASURE_RE = /%|\$\d|[+−-]\d+\.\d+|\b\d+(?:\.\d+)?\s?(?:x|times|fold|ms|s|K|M|GB|MB|KB|tokens|bps|fills|trades|days|years|bars)\b|\b(?:a year|per year|sharpe|drawdown|win rate|pnl|p50|p90|p99|latency|throughput|hit rate|accuracy|error rate|correlation|compute units|cu)\b/i;
const NARRATION_RE = /\b(?:I'll|I'm|I've|I'd|we'll|we're|you'll|let me|let's|pushed|committed|watcher|re-armed|next:)\b|^(?:I|we|you|your|say|still|now|then|next)\b|`|\?\s*$/i;
export const isClaim = (line: string) => MEASURE_RE.test(line) && !NARRATION_RE.test(line);
export function buildDrafts(cfg: ProjectConfig, ts: TaskState, transcriptPath: string, today = new Date()): DraftSpec {
  const day = today.toISOString().slice(0, 10);
  const files = ts.files.map((f) => f.path).filter((p) => existsSync(p)).slice(-3);
  const evidence: DraftSpec['records'][number]['evidence'] = [...(transcriptPath && existsSync(transcriptPath) ? [{ kind: 'transcript' as const, ref: transcriptPath }] : []), ...files.map((ref) => ({ kind: 'path' as const, ref }))];
  const seen = new Set<string>(); const records: DraftSpec['records'] = [];
  for (const line of ts.exactValues) {
    const title = line.replace(/\*\*/g, '').replace(/[.;:,]+$/, '').trim(); if (title.length < 24 || !isClaim(title)) continue;
    const k = norm(title); if (seen.has(k)) continue; seen.add(k);
    records.push({ kind: 'finding', title: shortTitle(title), body: `## Claim\n${title}\n\n## Evidence\nDrafted by project-memory from the session transcript on ${day}; the numbers are as the session stated them, not re-measured. Edit the title into a claim, add a gate, or delete this record before running kb write.`, attrs: { state: 'observed', valid_from: day }, evidence });
    if (records.length >= MAX_DRAFTS) break;
  }
  return { defaults: { domain: cfg.domain, project: cfg.project_id }, records };
}
/** A bank title is a claim, so a long line is cut at a word, never mid-word; the body carries the whole line. */
const shortTitle = (s: string) => (s.length <= 120 ? s : s.slice(0, 120).replace(/\s+\S*$/, '') + '…');
export const draftsFile = (projectKey: string) => path.join(paths.projectDir(projectKey), 'draft-findings.json');
const MAX_FILE = 20, MAX_WRITTEN = 40;
const readDrafts = (file: string): DraftSpec['records'] => { try { return existsSync(file) ? ((JSON.parse(readFileSync(file, 'utf8')) as DraftSpec).records ?? []) : []; } catch { return []; } };
/** Merges the spec into the project's draft file (the main agent and every subagent add to the same file; same sentence once; newest
 *  pending kept up to 20). v1.5: a record `kb write` has recorded stays in the file with its `written` id (up to 40), so the same
 *  sentence is never drafted or written twice; `count` is the records still waiting for review, undefined when none are. */
export function writeDrafts(projectKey: string, spec: DraftSpec): { file: string; count: number } | undefined {
  const file = draftsFile(projectKey), prev = readDrafts(file);
  const seen = new Set<string>(); const pending: DraftSpec['records'] = [], written: DraftSpec['records'] = [];
  for (const r of [...prev.filter((p) => p.written), ...spec.records, ...prev.filter((p) => !p.written)]) {
    const k = norm(r.title); if (seen.has(k)) continue; seen.add(k);
    if (r.written) { if (written.length < MAX_WRITTEN) written.push(r); } else if (pending.length < MAX_FILE) pending.push(r);
  }
  if (!pending.length && !written.length) return undefined;
  writeFileAtomic(file, JSON.stringify({ ...spec, records: [...pending, ...written] }, null, 2) + '\n');
  return pending.length ? { file, count: pending.length } : undefined;
}
/** The drafts still waiting for review in the project's file, for the brief's one line; undefined when there are none. */
export const pendingDrafts = (projectKey: string): { file: string; count: number } | undefined => {
  const file = draftsFile(projectKey), count = readDrafts(file).filter((r) => !r.written).length;
  return count ? { file, count } : undefined;
};
