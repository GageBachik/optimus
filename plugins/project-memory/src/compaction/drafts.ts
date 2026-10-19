import path from 'node:path';
import { existsSync } from 'node:fs';
import type { TaskState } from './task-state.js';
import type { ProjectConfig } from '../kb/project.js';
import { paths } from '../lib/paths.js';
import { writeFileAtomic } from '../lib/atomic.js';

/** A `kb write` spec drafted from a session's value lines: one finding per distinct sentence that states a number, backed by the transcript and
 *  the files the session touched. Nothing is written to the bank until a person runs `kb write <file>`, so a draft is a review step, not a habit. */
export type DraftSpec = { defaults: { domain: string; project: string }; records: { kind: 'finding'; title: string; body: string; attrs: Record<string, string>; evidence: { kind: 'transcript' | 'path'; ref: string }[] }[] };
const MAX_DRAFTS = 8;
const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9%$.]+/g, ' ').trim();
// A draft is an impersonal claim with a measurement in it. Narration ("I'll raise the window from 200K to 300K") has numbers too; the
// first run on a working session drafted eight lines of it. Measurement: a %, a $ figure, a unit, or a metric word. Narration: a person.
const MEASURE_RE = /%|\$\d|\b\d+(?:\.\d+)?\s?(?:x|ms|s|K|M|GB|MB|KB|tokens|bps|fills|trades|days|bars)\b|\b(?:sharpe|drawdown|win rate|pnl|p50|p90|p99|latency|throughput|hit rate|accuracy|error rate|compute units|cu)\b/i;
const NARRATION_RE = /\b(?:I|I'll|I'm|I've|I'd|we|we'll|we're|you|you'll|your|let me|let's|say|pushed|committed|watcher|re-armed|next:)\b|`|\?\s*$/i;
export const isClaim = (line: string) => MEASURE_RE.test(line) && !NARRATION_RE.test(line);
export function buildDrafts(cfg: ProjectConfig, ts: TaskState, transcriptPath: string, today = new Date()): DraftSpec {
  const day = today.toISOString().slice(0, 10);
  const files = ts.files.map((f) => f.path).filter((p) => existsSync(p)).slice(-3);
  const evidence: DraftSpec['records'][number]['evidence'] = [...(transcriptPath && existsSync(transcriptPath) ? [{ kind: 'transcript' as const, ref: transcriptPath }] : []), ...files.map((ref) => ({ kind: 'path' as const, ref }))];
  const seen = new Set<string>(); const records: DraftSpec['records'] = [];
  for (const line of ts.exactValues) {
    const title = line.replace(/\*\*/g, '').replace(/[.;:,]+$/, '').trim(); if (title.length < 24 || !isClaim(title)) continue;
    const k = norm(title); if (seen.has(k)) continue; seen.add(k);
    records.push({ kind: 'finding', title: title.slice(0, 120), body: `## Claim\n${title}\n\n## Evidence\nDrafted by project-memory from the session transcript on ${day}; the numbers are as the session stated them, not re-measured. Edit the title into a claim, add a gate, or delete this record before running kb write.`, attrs: { state: 'observed', valid_from: day }, evidence });
    if (records.length >= MAX_DRAFTS) break;
  }
  return { defaults: { domain: cfg.domain, project: cfg.project_id }, records };
}
export const draftsFile = (projectKey: string) => path.join(paths.projectDir(projectKey), 'draft-findings.json');
/** Writes the spec (or removes a stale one when there is nothing to draft) and returns what the last-session record should carry. */
export function writeDrafts(projectKey: string, spec: DraftSpec): { file: string; count: number } | undefined {
  const file = draftsFile(projectKey);
  if (!spec.records.length) return undefined;
  writeFileAtomic(file, JSON.stringify(spec, null, 2) + '\n');
  return { file, count: spec.records.length };
}
