import { type Db, getAttrs, getNote, getRels } from './db.js';
import type { ProjectConfig } from './project.js';
import { normalizeName } from './normalize.js';
import { conceptNoteId } from './templates.js';

export type Candidate = {
  id: string; title: string; project: string | null; updated_at: string;
  attrs: Record<string, string[]>;
  /** `facet:<key>` values of the approaches the finding is `about`, merged by key. */
  facets: Record<string, string[]>;
  /** `facet:environment` / `facet:subject` values of the targets it is `validated_in`. */
  target: { environment: string[]; subject: string[] };
  transfers: { confirmed: number; refuted: number }; conflicts: number;
  /** Titles of the evidence notes it is `backed_by` (`<kind>: <ref>`). */
  evidence: string[];
};
export type Ranked = Candidate & { score: number; demoted: boolean };

const NOT_SUPERSEDED = `NOT EXISTS (SELECT 1 FROM rel s JOIN note m ON m.id=s.src AND m.deleted_at IS NULL WHERE s.type='supersedes' AND s.dst=n.id AND s.deleted_at IS NULL)`;
/** DESIGN §4.6: deleted and superseded findings are dropped, not demoted. `n` is the finding row. */
const LIVE_FINDING = `n.kind='finding' AND n.deleted_at IS NULL AND ${NOT_SUPERSEDED}`;
const marks = (xs: unknown[]) => xs.map(() => '?').join(',');
const ids = (rows: unknown[]) => (rows as { id: string }[]).map((r) => r.id);
const cmp = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

/** Concept ids for names: the alias table (a concept's own title is in it too), else the deterministic id the name would get (§4.7). */
export function conceptIds(db: Db, names: string[]): string[] {
  const q = db.sql.prepare('SELECT concept_id FROM alias WHERE name_norm=?');
  return [...new Set(names.map((n) => (q.get(normalizeName(n)) as { concept_id: string } | undefined)?.concept_id ?? conceptNoteId(n)))];
}
/** Live, non-superseded findings `about` any of the concepts. */
export function findingsAbout(db: Db, concepts: string[]): string[] {
  if (!concepts.length) return [];
  return ids(db.sql.prepare(`SELECT DISTINCT n.id FROM rel r JOIN note n ON n.id=r.src WHERE r.type='about' AND r.deleted_at IS NULL AND r.dst IN (${marks(concepts)}) AND ${LIVE_FINDING}`).all(...concepts));
}
/** Live, non-superseded findings recorded in any of the projects. */
export function findingsIn(db: Db, projects: string[]): string[] {
  if (!projects.length) return [];
  return ids(db.sql.prepare(`SELECT n.id FROM note n WHERE n.project IN (${marks(projects)}) AND ${LIVE_FINDING}`).all(...projects));
}

/** DESIGN §4.6 candidates for the asking project: `about` a relied-on concept, `about` an approach sharing a facet key with `cfg.facets`,
 *  or `validated_in` a target whose environment or subject equals `cfg.target`'s after normalizeName on both sides. */
export function candidateIds(db: Db, cfg: ProjectConfig): string[] {
  const out = new Set(findingsAbout(db, conceptIds(db, cfg.relies_on ?? [])));
  const keys = Object.keys(cfg.facets ?? {}).map((k) => `facet:${k}`);
  if (keys.length) for (const id of ids(db.sql.prepare(`SELECT DISTINCT n.id FROM rel r JOIN note n ON n.id=r.src JOIN note ap ON ap.id=r.dst AND ap.kind='approach' AND ap.deleted_at IS NULL
    JOIN attr a ON a.note_id=ap.id AND a.key IN (${marks(keys)}) WHERE r.type='about' AND r.deleted_at IS NULL AND ${LIVE_FINDING}`).all(...keys))) out.add(id);
  const want = { environment: cfg.target?.environment, subject: cfg.target?.subject };
  if (want.environment || want.subject) {
    const axes = db.sql.prepare(`SELECT a.note_id AS id, a.key, a.value FROM attr a JOIN note t ON t.id=a.note_id AND t.kind='target' AND t.deleted_at IS NULL WHERE a.key IN ('facet:environment','facet:subject')`).all() as { id: string; key: string; value: string }[];
    const targets = [...new Set(axes.filter((r) => { const w = want[r.key.slice(6) as keyof typeof want]; return w && normalizeName(w) === normalizeName(r.value); }).map((r) => r.id))];
    if (targets.length) for (const id of ids(db.sql.prepare(`SELECT DISTINCT n.id FROM rel r JOIN note n ON n.id=r.src WHERE r.type='validated_in' AND r.deleted_at IS NULL AND r.dst IN (${marks(targets)}) AND ${LIVE_FINDING}`).all(...targets))) out.add(id);
  }
  return [...out];
}

/** Hydrates findings (live ones only) with what the score and the brief line need. */
export function loadCandidates(db: Db, findingIds: Iterable<string>): Candidate[] {
  const note = db.sql.prepare('SELECT id, title, project, updated_at FROM note WHERE id=? AND deleted_at IS NULL');
  const out: Candidate[] = [];
  for (const id of new Set(findingIds)) {
    const n = note.get(id) as Pick<Candidate, 'id' | 'title' | 'project' | 'updated_at'> | undefined; if (!n) continue;
    const rels = getRels(db, id, 'both');
    const c: Candidate = { ...n, attrs: getAttrs(db, id), facets: {}, target: { environment: [], subject: [] }, transfers: { confirmed: 0, refuted: 0 }, conflicts: 0, evidence: [] };
    for (const r of rels) {
      if (r.type === 'conflicts_with') { c.conflicts++; continue; }
      if (r.src !== id) continue; // other incoming relations say nothing about this finding's fit
      if (r.type === 'transfer') { if (r.props.state === 'confirmed') c.transfers.confirmed++; else if (r.props.state === 'refuted') c.transfers.refuted++; }
      else if (r.type === 'about' && r.dst.startsWith('a_')) { for (const [k, v] of Object.entries(getAttrs(db, r.dst))) if (k.startsWith('facet:')) (c.facets[k.slice(6)] ??= []).push(...v); }
      else if (r.type === 'validated_in') { const a = getAttrs(db, r.dst); c.target.environment.push(...(a['facet:environment'] ?? [])); c.target.subject.push(...(a['facet:subject'] ?? [])); }
      else if (r.type === 'backed_by') c.evidence.push(getNote(db, r.dst)?.title ?? r.dst);
    }
    out.push(c);
  }
  return out;
}

/** 1 when `valid_from` is within 90 days of today, decaying linearly to 0 at 365 days; 0 without a valid_from (DESIGN §4.6). */
function recency(validFrom: string | undefined, today: Date): number {
  const days = (today.getTime() - Date.parse(validFrom ?? '')) / 86_400_000;
  if (Number.isNaN(days)) return 0;
  return days <= 90 ? 1 : days >= 365 ? 0 : (365 - days) / 275;
}
const expired = (c: Candidate, today: Date): boolean => { const to = c.attrs.valid_to?.[0]; return !!to && Date.parse(to) < today.getTime(); };
/** Weights are rows of `rank_weights` (seeded by openDb), never literals. */
export function loadWeights(db: Db): Record<string, number> {
  return Object.fromEntries((db.sql.prepare('SELECT key, value FROM rank_weights').all() as { key: string; value: number }[]).map((r) => [r.key, r.value]));
}
/** DESIGN §4.6, term by term. Facet values compare identical; environment and subject after normalizeName. */
export function scoreFinding(c: Candidate, cfg: ProjectConfig, w: Record<string, number>, today: Date): number {
  let s = 0;
  for (const [k, v] of Object.entries(cfg.facets ?? {})) { const have = c.facets[k]; if (have) s += have.includes(v) ? w.facet_value : w.facet_key; }
  for (const axis of ['environment', 'subject'] as const) { const want = cfg.target?.[axis]; if (want && c.target[axis].some((x) => normalizeName(x) === normalizeName(want))) s += w[axis]; }
  s += w.gate_rank * Number(c.attrs.gate_rank?.[0] ?? 0);
  s += w.recency * recency(c.attrs.valid_from?.[0], today);
  s += w.transfer_confirmed * c.transfers.confirmed + w.transfer_refuted * c.transfers.refuted;
  if (c.conflicts) s += w.conflict;
  return expired(c, today) ? s * w.expired_factor : s;
}
/** Scores and sorts: score desc, then `updated_at` desc, then id. */
export function rankCandidates(db: Db, cands: Candidate[], cfg: ProjectConfig, today = new Date()): Ranked[] {
  const w = loadWeights(db);
  return cands.map((c) => ({ ...c, score: scoreFinding(c, cfg, w, today), demoted: expired(c, today) }))
    .sort((a, b) => b.score - a.score || cmp(b.updated_at, a.updated_at) || cmp(a.id, b.id));
}
export const candidateFindings = (db: Db, cfg: ProjectConfig): Candidate[] => loadCandidates(db, candidateIds(db, cfg));
export const rankFindings = (db: Db, cfg: ProjectConfig, limit: number, today = new Date()): Ranked[] => rankCandidates(db, candidateFindings(db, cfg), cfg, today).slice(0, limit);
