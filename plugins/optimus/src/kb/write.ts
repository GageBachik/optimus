import { createHash } from 'node:crypto';
import { type Db, upsertNote, setAttrs, addRel, getNote, getAttrs, getRels, softDeleteNote, deviceId } from './db.js';
import { exportNote, relId, rekeyRel } from './export.js';
import { type Kind, noteId, evidenceId, kindOfId } from './ids.js';
import { resolveConcept } from './concepts.js';
import { validateApproachFacets, gateRank } from './templates.js';
import { redactSensitive, redactJson } from '../lib/redaction.js';

export type Metric = { name: string; value: number; unit?: string; better: 'higher' | 'lower'; baseline?: number };
export type Evidence = { kind: 'commit' | 'path' | 'transcript' | 'url'; ref: string; sha256?: string };
export type WriteRecord = {
  kind: Kind; id?: string; title: string; body?: string; domain?: string; project?: string;
  attrs?: Record<string, string | string[]>; rels?: { type: string; dst: string; props?: Record<string, unknown> }[];
  tags?: string[]; facets?: Record<string, string>; metrics?: Metric[]; method?: string; objective?: string; trials?: number; evidence?: Evidence[];
};
export type WriteResult = { id: string; created: boolean; concepts: { tag: string; conceptId: string; how: string }[]; transfers: string[]; questions: number };
export type FindingLite = { metrics: Metric[] };

const red = (s: string) => redactSensitive(s).text; // DESIGN §1 rule 10: redacted before anything is stored
const sha256 = (s: string) => createHash('sha256').update(s).digest('hex');
const touch = (db: Db, id: string, now: string) => db.sql.prepare('UPDATE note SET updated_at=? WHERE id=?').run(now, id);
const TARGET_FACETS = ['environment', 'subject']; // Ruling R5
/** A live note, or an error naming the id. */
const must = (db: Db, id: string) => { const n = getNote(db, id); if (!n || n.deleted_at) throw new Error(`no note ${id}`); return n; };
/** The kinds an agent authors. Concept ids are deterministic (resolveConcept, via `tags`), evidence ids are content hashes (the `evidence` field),
 *  domain and template notes come from installTemplate, and no tool produces a report in phases 1–2 (DESIGN §4.1, §4.3). */
export const WRITABLE_KINDS = ['project', 'theme', 'approach', 'experiment', 'target', 'finding'] as const satisfies readonly Kind[];
/** A caller-supplied relation: never a transfer (DESIGN §4.8: proposed by kb_write, settled only by `kb transfer`), props redacted (rule 10). */
function userRel(type: string, props: Record<string, unknown> = {}): Record<string, unknown> {
  if (type === 'transfer') throw new Error('transfers are proposed by kb_write and settled by kb transfer');
  return JSON.parse(JSON.stringify(props, redactJson));
}

/** Attr `metric:<name>` = `<value>|<unit>|<better>|<baseline or ''>` (DESIGN §4.2). */
export function metricsOf(attrs: Record<string, string[]>): Metric[] {
  return Object.entries(attrs).filter(([k]) => k.startsWith('metric:')).map(([k, [v]]) => {
    const [value, unit, better, baseline] = v.split('|');
    return { name: k.slice(7), value: Number(value), unit: unit || undefined, better: better === 'lower' ? 'lower' : 'higher', baseline: baseline ? Number(baseline) : undefined };
  });
}
const metricAttr = (m: Metric) => `${m.value}|${m.unit ?? ''}|${m.better}|${m.baseline ?? ''}`;

/** DESIGN §4.8, the only judgment-like step, kept mechanical: for every metric name both findings carry with a baseline on both,
 *  compare sign((value − baseline) · dir), dir = −1 for lower-is-better. Any opposite non-zero pair → false; else any equal non-zero pair → true;
 *  no such pair (missing metric, missing baseline, or a zero move) → null, no verdict. */
export function agrees(a: FindingLite, b: FindingLite): boolean | null {
  const move = (m: Metric) => Math.sign((m.value - m.baseline!) * (m.better === 'lower' ? -1 : 1));
  let verdict: boolean | null = null;
  for (const m of a.metrics) {
    const n = b.metrics.find((x) => x.name === m.name);
    if (!n || m.baseline === undefined || n.baseline === undefined) continue;
    const sa = move(m), sb = move(n);
    if (!sa || !sb) continue;
    if (sa !== sb) return false;
    verdict = true;
  }
  return verdict;
}

/** DESIGN §4.8 (v1.7, 2026-10-24): at most this many transfers are proposed per finding. Measured on the bank the day the rule changed (829 findings,
 *  281 approaches): 620 findings have a concept-sharing candidate, 511 have more than four, and only 164 of the 8,881 (finding, candidate) pairs share
 *  two concepts (never more than five such candidates on one finding), so four slots always hold every strong candidate and cut the hub-concept tail. */
export const MAX_PROPOSALS = 4;
export type TransferCandidate = { id: string; shared: number; rarity: number[]; facetKey: boolean };
/** The order of proposals: more shared concepts; then rarer shared concepts (how many live approaches touch each, fewest first, compared one by one);
 *  then carrying the facet key the finding is `about` (the v1.4 facet path, kept only as this tie-breaker); then id. Zero means the index cannot tell two apart. */
export function compareCandidates(a: TransferCandidate, b: TransferCandidate, withId = true): number {
  if (a.shared !== b.shared) return b.shared - a.shared;
  for (let i = 0; i < a.rarity.length; i++) if (a.rarity[i] !== b.rarity[i]) return a.rarity[i] - b.rarity[i];
  if (a.facetKey !== b.facetKey) return a.facetKey ? -1 : 1;
  return withId ? (a.id < b.id ? -1 : a.id > b.id ? 1 : 0) : 0;
}
/** DESIGN §4.8 (v1.7): the approaches in other projects a finding's transfers go to, best first. A candidate must be `about` (or `relies_on`) one of the
 *  finding's concepts: sharing a facet key no longer admits anyone (with six keys per template nearly every approach of the domain qualified, which
 *  proposed ~12 transfers per finding on the 2026-10-24 build). The list is cut at MAX_PROPOSALS, and a run of candidates the index cannot tell apart
 *  that straddles the cut is dropped whole: picking among equals by id sent every hub concept's proposals to whichever approaches were written first
 *  (measured: 473 of 511 capped findings tied at the boundary; 609 of their 2,263 picks landed on the three oldest-imported projects). */
export function transferCandidates(db: Db, findingId: string): TransferCandidate[] {
  const f = must(db, findingId), about = getRels(db, findingId).filter((r) => r.type === 'about');
  const concepts = about.map((r) => r.dst).filter((d) => kindOfId(d) === 'concept');
  const own = new Set(about.map((r) => r.dst).filter((d) => kindOfId(d) === 'approach'));
  const keys = [...new Set(about.flatMap((r) => (typeof r.props.facet_key === 'string' ? [r.props.facet_key] : [])))];
  const touching = `FROM rel r JOIN note n ON n.id=r.src WHERE r.dst=? AND r.type IN ('relies_on','about') AND r.deleted_at IS NULL AND n.kind='approach' AND n.deleted_at IS NULL`;
  const byConcept = db.sql.prepare(`SELECT DISTINCT r.src AS id ${touching} AND n.project IS NOT NULL AND n.project IS NOT ?`);
  const popularity = db.sql.prepare(`SELECT count(DISTINCT r.src) AS n ${touching}`);
  const hasKey = db.sql.prepare('SELECT 1 FROM attr WHERE note_id=? AND key=?');
  const cand = new Map<string, TransferCandidate>();
  for (const c of concepts) {
    const pop = (popularity.get(c) as { n: number }).n;
    for (const { id } of byConcept.all(c, f.project) as { id: string }[]) {
      if (own.has(id)) continue;
      const e = cand.get(id) ?? { id, shared: 0, rarity: [], facetKey: false }; e.shared++; e.rarity.push(pop); cand.set(id, e);
    }
  }
  for (const e of cand.values()) { e.rarity.sort((a, b) => a - b); e.facetKey = keys.some((k) => hasKey.get(e.id, `facet:${k}`) !== undefined); }
  const ranked = [...cand.values()].sort((a, b) => compareCandidates(a, b));
  let n = Math.min(MAX_PROPOSALS, ranked.length);
  while (n > 0 && n < ranked.length && compareCandidates(ranked[n - 1], ranked[n], false) === 0) n--;
  return ranked.slice(0, n);
}
/** DESIGN §4.8: a finding proposes a `transfer{state: proposed}` to each of its transferCandidates; one per approach, never a second. Returns the new rel ids, best first. */
export function proposeTransfers(db: Db, bankDir: string, findingId: string, now = new Date().toISOString()): string[] {
  const existing = new Set(getRels(db, findingId).filter((r) => r.type === 'transfer').map((r) => r.dst));
  const made: string[] = [];
  for (const { id: dst } of transferCandidates(db, findingId)) {
    if (existing.has(dst)) continue;
    const props = { state: 'proposed' }, id = relId(findingId, 'transfer', dst, props);
    addRel(db, { id, src: findingId, type: 'transfer', dst, props, created_at: now, deleted_at: null }); made.push(id);
  }
  if (made.length) { touch(db, findingId, now); exportNote(db, bankDir, findingId); }
  return made;
}

export type TransferPrune = { finding: string; proposed: number; withdraw: string[] };
/** `kb transfers prune`: for every live finding, the `proposed` transfers that transferCandidates would not propose today. A settled transfer
 *  (confirmed, refuted, or the rule's own confirmed_provisional) is never listed; findings with nothing to withdraw are left out. */
export function planTransferPrune(db: Db): TransferPrune[] {
  const rows = db.sql.prepare(`SELECT t.src AS finding, t.id, t.dst, t.props FROM rel t JOIN note f ON f.id=t.src
    WHERE t.type='transfer' AND t.deleted_at IS NULL AND f.kind='finding' AND f.deleted_at IS NULL ORDER BY t.src, t.id`).all() as { finding: string; id: string; dst: string; props: string }[];
  const plan: (TransferPrune & { keep: Set<string> })[] = []; let cur: (typeof plan)[number] | undefined;
  for (const r of rows) {
    if ((JSON.parse(r.props) as { state?: string }).state !== 'proposed') continue;
    if (!cur || cur.finding !== r.finding) { cur = { finding: r.finding, proposed: 0, withdraw: [], keep: new Set(transferCandidates(db, r.finding).map((c) => c.id)) }; plan.push(cur); }
    cur.proposed++; if (!cur.keep.has(r.dst)) cur.withdraw.push(r.id);
  }
  return plan.filter((p) => p.withdraw.length).map(({ finding, proposed, withdraw }) => ({ finding, proposed, withdraw }));
}
/** `kb transfers prune --apply`: soft-deletes the planned rels (`deleted_at`, as a retracted note is), then touches and re-exports each finding; the
 *  file no longer lists the rel, and an import replaces a note's rels with the file's, which is how the withdrawal reaches every machine (DESIGN §4.3). */
export function pruneTransfers(db: Db, bankDir: string, plan: TransferPrune[], now = new Date().toISOString()): { withdrawn: number; findings: number } {
  const del = db.sql.prepare('UPDATE rel SET deleted_at=? WHERE id=? AND deleted_at IS NULL');
  let withdrawn = 0;
  for (const p of plan) { for (const id of p.withdraw) withdrawn += Number(del.run(now, id).changes); touch(db, p.finding, now); exportNote(db, bankDir, p.finding); }
  return { withdrawn, findings: plan.length };
}

/** DESIGN §4.8 + Ruling R4: every transfer into this finding's project whose source finding shares a concept with it is judged by `agrees`:
 *  true → confirmed_provisional; false → a confirmed_provisional reverts to proposed and both findings get `conflicts_with` + attr state=conflicting;
 *  null → untouched. confirmed and refuted were set by a person and are never touched. */
export function applyProvisionalVerdicts(db: Db, bankDir: string, findingId: string, now = new Date().toISOString()): void {
  const g = must(db, findingId); if (!g.project) return;
  const concepts = getRels(db, findingId).filter((r) => r.type === 'about' && kindOfId(r.dst) === 'concept').map((r) => r.dst);
  if (!concepts.length) return;
  // A retracted source finding (deleted_at set) no longer judges anyone.
  const rows = db.sql.prepare(`SELECT DISTINCT t.id, t.src, t.props FROM rel t JOIN note a ON a.id=t.dst JOIN note s ON s.id=t.src AND s.deleted_at IS NULL
    JOIN rel c ON c.src=t.src AND c.type='about' AND c.deleted_at IS NULL
    WHERE t.type='transfer' AND t.deleted_at IS NULL AND t.src<>? AND a.project=? AND c.dst IN (${concepts.map(() => '?').join(',')}) ORDER BY t.id`)
    .all(findingId, g.project, ...concepts) as { id: string; src: string; props: string }[];
  const mine: FindingLite = { metrics: metricsOf(getAttrs(db, findingId)) };
  const setState = (t: { id: string; props: string }, state: string) => rekeyRel(db, t.id, { props: { ...JSON.parse(t.props), state } });
  const touched = new Set<string>();
  for (const t of rows) {
    const state = (JSON.parse(t.props) as { state?: string }).state;
    if (state !== 'proposed' && state !== 'confirmed_provisional') continue;
    const v = agrees({ metrics: metricsOf(getAttrs(db, t.src)) }, mine);
    if (v === null) continue;
    if (v) { if (state === 'proposed') { setState(t, 'confirmed_provisional'); touched.add(t.src); } continue; }
    if (state === 'confirmed_provisional') setState(t, 'proposed');
    for (const [x, y] of [[t.src, findingId], [findingId, t.src]]) {
      addRel(db, { id: relId(x, 'conflicts_with', y, {}), src: x, type: 'conflicts_with', dst: y, props: {}, created_at: now, deleted_at: null });
      setAttrs(db, x, { ...getAttrs(db, x), state: 'conflicting' });
    }
    touched.add(t.src); touched.add(findingId);
  }
  for (const id of touched) { touch(db, id, now); exportNote(db, bankDir, id); }
}

/** DESIGN §4.5 `kb_write`: validates, then upserts the note (attrs merged over an existing note's, rels only ever added), resolves tags to concepts,
 *  writes evidence notes, exports, and for a finding proposes transfers and applies provisional verdicts. No git call anywhere (DESIGN §4.4). */
export function kbWrite(db: Db, bankDir: string, rec: WriteRecord, now = new Date().toISOString()): WriteResult {
  if (!(WRITABLE_KINDS as readonly Kind[]).includes(rec.kind)) throw new Error(`kb_write writes ${WRITABLE_KINDS.join(', ')}, not ${rec.kind}`);
  const id = rec.id ?? noteId(rec.kind);
  if (kindOfId(id) !== rec.kind) throw new Error(`id ${id} is not a ${rec.kind}`);
  const prev = getNote(db, id), domain = rec.domain ?? prev?.domain ?? null, project = rec.project ?? prev?.project ?? null, facets = rec.facets ?? {};
  // Everything that can be refused is refused before the first write.
  if (Object.keys(facets).length) {
    if (rec.kind === 'approach') { if (!domain) throw new Error('facets need a domain'); validateApproachFacets(db, domain, facets); }
    else if (rec.kind === 'target') { const bad = Object.keys(facets).filter((k) => !TARGET_FACETS.includes(k)); if (bad.length) throw new Error(`a target's facets are environment and subject, not ${bad.join(', ')}`); }
    else throw new Error(`facets belong on an approach or a target, not a ${rec.kind}`);
  }
  const attrs: Record<string, string[]> = prev ? getAttrs(db, id) : {};
  for (const [k, v] of Object.entries(rec.attrs ?? {})) attrs[k] = (Array.isArray(v) ? v : [v]).map(red);
  if (attrs.gate) { if (!domain) throw new Error('gate needs a domain'); attrs.gate_rank = [String(gateRank(db, domain, attrs.gate[0]))]; }
  const rels = (rec.rels ?? []).map((r) => ({ type: r.type, dst: must(db, r.dst).id, props: userRel(r.type, r.props) }));
  upsertNote(db, { id, kind: rec.kind, domain, project, title: red(rec.title), body: red(rec.body ?? prev?.body ?? ''), created_at: prev?.created_at ?? now, updated_at: now, deleted_at: null, device_id: deviceId() });
  for (const [k, v] of Object.entries(facets)) attrs[`facet:${k}`] = [red(v)];
  for (const m of rec.metrics ?? []) attrs[`metric:${m.name}`] = [metricAttr(m)];
  if (rec.method !== undefined) attrs.method = [red(rec.method)];
  if (rec.objective !== undefined) attrs.objective = [red(rec.objective)];
  if (rec.trials !== undefined) attrs.trials = [String(rec.trials)];
  const concepts = (rec.tags ?? []).map((tag) => { const r = resolveConcept(db, bankDir, tag, now); return { tag, conceptId: r.conceptId, how: r.how }; });
  const rel = (type: string, dst: string, props: Record<string, unknown> = {}) => addRel(db, { id: relId(id, type, dst, props), src: id, type, dst, props, created_at: now, deleted_at: null });
  for (const c of concepts) rel('about', c.conceptId);
  for (const r of rels) rel(r.type, r.dst, r.props);
  for (const e of rec.evidence ?? []) {
    const eid = evidenceId(e.sha256 ?? sha256(`${e.kind}|${e.ref}`));
    if (!getNote(db, eid)) {
      upsertNote(db, { id: eid, kind: 'evidence', domain, project, title: red(`${e.kind}: ${e.ref}`), body: '', created_at: now, updated_at: now, deleted_at: null, device_id: deviceId() });
      setAttrs(db, eid, { origin: e.kind, ref: red(e.ref), ...(e.sha256 ? { sha256: e.sha256 } : {}) }); exportNote(db, bankDir, eid);
    }
    rel('backed_by', eid);
  }
  // CONTEXT.md: a Finding with no Evidence stays unverified, whatever state it claims.
  if (rec.kind === 'finding' && !getRels(db, id).some((r) => r.type === 'backed_by')) attrs.state = ['unverified'];
  setAttrs(db, id, attrs); exportNote(db, bankDir, id);
  const transfers = rec.kind === 'finding' ? proposeTransfers(db, bankDir, id, now) : [];
  if (rec.kind === 'finding') applyProvisionalVerdicts(db, bankDir, id, now);
  return { id, created: !prev, concepts, transfers, questions: (db.sql.prepare('SELECT COUNT(*) AS n FROM pending_merge WHERE resolved IS NULL').get() as { n: number }).n };
}

/** DESIGN §4.5 `kb_link`: one relation between two live notes; the src note is re-exported. */
export function kbLink(db: Db, bankDir: string, l: { src: string; type: string; dst: string; props?: Record<string, unknown> }, now = new Date().toISOString()): { rel_id: string } {
  must(db, l.src); must(db, l.dst);
  const props = userRel(l.type, l.props), rel_id = relId(l.src, l.type, l.dst, props);
  addRel(db, { id: rel_id, src: l.src, type: l.type, dst: l.dst, props, created_at: now, deleted_at: null });
  touch(db, l.src, now); exportNote(db, bankDir, l.src);
  return { rel_id };
}

/** DESIGN §4.8: `kb transfer <id> confirm|refute` is the only path to a final state. The id is a hash of the props (§4.3), so the
 *  settled transfer gets a new id, the one every machine derives from the file; it is returned. */
export function setTransfer(db: Db, bankDir: string, transferId: string, state: 'confirmed' | 'refuted', now = new Date().toISOString()): string {
  const t = db.sql.prepare(`SELECT src, props FROM rel WHERE id=? AND type='transfer' AND deleted_at IS NULL`).get(transferId) as { src: string; props: string } | undefined;
  if (!t) throw new Error(`no transfer ${transferId}`);
  const next = rekeyRel(db, transferId, { props: { ...JSON.parse(t.props), state } });
  touch(db, t.src, now); exportNote(db, bankDir, t.src);
  return next;
}

/** `kb retract <id>`: soft-deletes the note; the exported `deleted_at` is how the retraction syncs (DESIGN §4.3) and ranking drops it (§4.6). */
export function retractNote(db: Db, bankDir: string, id: string, now = new Date().toISOString()): void { must(db, id); softDeleteNote(db, id, now); exportNote(db, bankDir, id); }

/** `kb set <id> <attr> <value>`: replaces that attr's values with the one value; `gate` also refreshes `gate_rank`. */
export function setAttr(db: Db, bankDir: string, id: string, key: string, value: string, now = new Date().toISOString()): void {
  const n = must(db, id), attrs = getAttrs(db, id); attrs[key] = [red(value)];
  if (key === 'gate') { if (!n.domain) throw new Error('gate needs a domain'); attrs.gate_rank = [String(gateRank(db, n.domain, value))]; }
  setAttrs(db, id, attrs); touch(db, id, now); exportNote(db, bankDir, id);
}
