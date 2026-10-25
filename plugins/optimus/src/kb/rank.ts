import { type Db, getAttrs, getNote, getRels } from './db.js';
import type { ProjectConfig } from './project.js';
import { normalizeName } from './normalize.js';
import { conceptNoteId } from './templates.js';

export type Candidate = {
  id: string; title: string; project: string | null; domain: string | null; updated_at: string;
  attrs: Record<string, string[]>;
  /** `facet:<key>` values of the approaches the finding is `about`, merged by key. */
  facets: Record<string, string[]>;
  /** `facet:environment` / `facet:subject` values of the targets it is `validated_in`. */
  target: { environment: string[]; subject: string[] };
  transfers: { confirmed: number; refuted: number }; conflicts: number;
  /** Transfers still awaiting a person (`proposed` or `confirmed_provisional`), with the project of the approach each points at. */
  proposals: { id: string; state: string; project: string | null }[];
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

/** Concept ids for names: the alias table (a concept's own title is in it too), else the deterministic id the name would get (§4.7) —
 *  unless that slot holds a concept of another name (the four concepts minted before the 2026-10-25 normaliser change: "ibs" at c_ib…),
 *  in which case the name maps to nothing rather than to the occupant. */
export function conceptIds(db: Db, names: string[]): string[] {
  const q = db.sql.prepare('SELECT concept_id FROM alias WHERE name_norm=?'), title = db.sql.prepare('SELECT title FROM note WHERE id=?');
  const slot = (n: string) => { const id = conceptNoteId(n), t = (title.get(id) as { title: string } | undefined)?.title; return t === undefined || normalizeName(t) === normalizeName(n) ? id : undefined; };
  return [...new Set(names.map((n) => (q.get(normalizeName(n)) as { concept_id: string } | undefined)?.concept_id ?? slot(n)))].filter((id): id is string => !!id);
}
/** Live, non-superseded findings `about` any of the concepts. */
export function findingsAbout(db: Db, concepts: string[]): string[] {
  if (!concepts.length) return [];
  return ids(db.sql.prepare(`SELECT DISTINCT n.id FROM rel r JOIN note n ON n.id=r.src WHERE r.type='about' AND r.deleted_at IS NULL AND r.dst IN (${marks(concepts)}) AND ${LIVE_FINDING}`).all(...concepts));
}
/** Own domain first, then every other domain (2026-10-25). v1.5 showed the own domain only once a domain was settled, after an iPhone
 *  session was shown Solana and poker "testing" findings, five per prompt, and cited none; the owner overruled it when the trading
 *  domains were split: "the whole point is not to have to reintroduce the same thing over and over once it's solved somewhere else" — a
 *  prop-firm session that names autocorrelation must see what trading measured about it. Nothing related still means nothing injected;
 *  the caller's cap per prompt and this order bound the noise, and the brief names the domain of a finding from another one. */
export function findingsAboutIn(db: Db, concepts: string[], domain: string | undefined): string[] {
  if (!concepts.length) return [];
  const all = findingsAbout(db, concepts);
  if (!domain) return all;
  const own = new Set(ids(db.sql.prepare(`SELECT DISTINCT n.id FROM rel r JOIN note n ON n.id=r.src WHERE r.type='about' AND r.deleted_at IS NULL AND r.dst IN (${marks(concepts)}) AND n.domain=? AND ${LIVE_FINDING}`).all(...concepts, domain)));
  return [...all.filter((id) => own.has(id)), ...all.filter((id) => !own.has(id))];
}
const STOP = new Set(['the', 'and', 'for', 'with', 'that', 'this', 'from', 'into', 'your', 'have', 'will', 'make', 'like', 'want', 'just', 'then', 'also', 'about', 'what', 'when', 'where', 'which', 'there', 'their', 'them', 'they', 'been', 'were', 'some', 'more', 'very', 'over', 'under', 'after', 'before', 'each', 'every', 'should', 'would', 'could', 'please', 'need', 'only', 'does', 'did', 'can', 'not', 'but', 'you', 'our', 'its', 'are', 'was', 'use', 'using', 'add', 'now', 'let', 'get']);
/** v1.5: two-word phrases of the prompt matched against finding titles in the project's domain (porter-stemmed FTS), so a finding
 *  recorded without tags — "Cover screen reports an 84pt trailing-only safe-area inset" — is still recalled by a prompt that says
 *  "cover screen". Phrases, not single words: "screen" alone would match half the domain. */
export function findingsByTitlePhrase(db: Db, prompt: string, domain: string | undefined, limit = 3): { ids: string[]; phrases: string[] } {
  const toks = prompt.toLowerCase().replace(/\S*[\\/]\S+/g, ' ').split(/[^a-z0-9]+/).filter((t) => t.length >= 3 && !STOP.has(t));
  const phrases = [...new Set(toks.slice(0, -1).map((t, i) => `${t} ${toks[i + 1]}`))].slice(0, 80);
  // 2026-10-25: the project's own domain first, then any other (the same rule as findingsAboutIn); before, other domains were never searched.
  // Own and other are bucketed across every phrase: when the cap counted both, three foreign hits on an early phrase ended the loop before
  // a later phrase could reach the own domain's finding (found in review the same day; the old domain filter had made that impossible).
  const q = db.sql.prepare(`SELECT n.id, n.domain FROM note_fts f JOIN note n ON n.id=f.note_id WHERE note_fts MATCH ? AND ${LIVE_FINDING} ORDER BY CASE WHEN n.domain=? THEN 0 ELSE 1 END, n.id LIMIT ?`);
  const own: string[] = [], other: string[] = [], hit: string[] = [];
  for (const p of phrases) {
    const rows = q.all(`title:"${p}"`, domain ?? null, limit) as { id: string; domain: string | null }[];
    if (rows.length) hit.push(p);
    for (const r of rows) if (!own.includes(r.id) && !other.includes(r.id)) (domain && r.domain === domain ? own : other).push(r.id);
    if ((domain ? own : other).length >= limit) break;
  }
  return { ids: [...own, ...other].slice(0, limit), phrases: hit };
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
  // v1.4: a project that declares nothing yet (just registered: no facets, no target, no relies_on) still gets its domain's findings,
  // ranked by gate and recency; otherwise a new project's startup brief is empty until the first prompt names a concept.
  // v1.5: not while the domain is still a low-confidence guess — an empty folder guessed as tooling was shown six tooling findings from
  // unrelated projects. The first prompt that settles the domain brings that domain's findings instead (user-prompt hook).
  if (!out.size && cfg.domain && cfg.auto?.confidence !== 'low') for (const id of ids(db.sql.prepare(`SELECT n.id FROM note n WHERE n.domain=? AND ${LIVE_FINDING}`).all(cfg.domain))) out.add(id);
  return [...out];
}

/** Hydrates findings (live ones only) with what the score and the brief line need. */
export function loadCandidates(db: Db, findingIds: Iterable<string>): Candidate[] {
  const note = db.sql.prepare('SELECT id, title, project, domain, updated_at FROM note WHERE id=? AND deleted_at IS NULL');
  const out: Candidate[] = [];
  for (const id of new Set(findingIds)) {
    const n = note.get(id) as Pick<Candidate, 'id' | 'title' | 'project' | 'domain' | 'updated_at'> | undefined; if (!n) continue;
    const rels = getRels(db, id, 'both');
    const c: Candidate = { ...n, attrs: getAttrs(db, id), facets: {}, target: { environment: [], subject: [] }, transfers: { confirmed: 0, refuted: 0 }, conflicts: 0, proposals: [], evidence: [] };
    for (const r of rels) {
      if (r.type === 'conflicts_with') { c.conflicts++; continue; }
      if (r.src !== id) continue; // other incoming relations say nothing about this finding's fit
      if (r.type === 'transfer') {
        if (r.props.state === 'confirmed') c.transfers.confirmed++; else if (r.props.state === 'refuted') c.transfers.refuted++;
        else c.proposals.push({ id: r.id, state: String(r.props.state), project: getNote(db, r.dst)?.project ?? null });
      }
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
  s += w.recency * recency(c.attrs.valid_from?.[0] ?? c.updated_at, today); // v1.5: a finding written without valid_from (every agent-recorded one) is as recent as its last write, not ageless
  s += w.transfer_confirmed * c.transfers.confirmed + w.transfer_refuted * c.transfers.refuted;
  if (c.conflicts) s += w.conflict;
  return expired(c, today) ? s * w.expired_factor : s;
}
/** Scores and sorts: score desc, then `updated_at` desc, then id. v1.5: a project that declares nothing yet (no facets, target or relies_on)
 *  is served newest-first within its domain, then by score — gate rank alone let year-old TestFlight findings of a dead app outrank last
 *  week's from a sibling app. Two notes with the same title (import artefacts) count once. */
export function rankCandidates(db: Db, cands: Candidate[], cfg: ProjectConfig, today = new Date()): Ranked[] {
  const w = loadWeights(db), bare = !Object.keys(cfg.facets ?? {}).length && !cfg.target?.environment && !cfg.target?.subject && !cfg.relies_on?.length;
  const rec = (c: Candidate) => recency(c.attrs.valid_from?.[0] ?? c.updated_at, today);
  const ranked = cands.map((c) => ({ ...c, score: scoreFinding(c, cfg, w, today), demoted: expired(c, today) }))
    .sort((a, b) => (bare ? rec(b) - rec(a) : 0) || b.score - a.score || cmp(b.updated_at, a.updated_at) || cmp(a.id, b.id));
  const seen = new Set<string>();
  return ranked.filter((c) => { const k = c.title.toLowerCase().replace(/[^a-z0-9%$.]+/g, ' ').trim(); if (seen.has(k)) return false; seen.add(k); return true; });
}
export const candidateFindings = (db: Db, cfg: ProjectConfig): Candidate[] => loadCandidates(db, candidateIds(db, cfg));
/** The top `limit` findings for a brief. v1.5: the project's own findings and other projects' are interleaved (own, other, own, …, each in
 *  rank order), so a session's fresh findings cannot crowd every cross-project one out of a five-slot card — a second Duo app's agents
 *  saw only what their sibling agents had recorded in the last hour, and not the Duo inset recorded the day before. */
export function rankFindings(db: Db, cfg: ProjectConfig, limit: number, today = new Date()): Ranked[] {
  const ranked = rankCandidates(db, candidateFindings(db, cfg), cfg, today);
  // Only a project that declares nothing needs forced cross-project slots. One with facets and a target has a real relevance score, and
  // forcing slots there handed an investment-strategy brief three findings about a Solana market-maker bot that merely shared a facet key.
  const bare = !Object.keys(cfg.facets ?? {}).length && !cfg.target?.environment && !cfg.target?.subject && !cfg.relies_on?.length;
  if (!bare) return ranked.slice(0, limit);
  const own = ranked.filter((f) => f.project === cfg.project_id), other = ranked.filter((f) => f.project !== cfg.project_id);
  const out: Ranked[] = [];
  for (let i = 0; out.length < limit && (i < own.length || i < other.length); i++) {
    if (i < own.length) out.push(own[i]);
    if (out.length < limit && i < other.length) out.push(other[i]);
  }
  return out;
}
