import { type Db, getAttrs, getNote, getRels } from './db.js';
import type { ProjectConfig } from './project.js';
import { conceptIds, findingsAbout } from './rank.js';
import type { Section } from '../lib/budget.js';

export type CompareRow = {
  findingId: string; approachValue: string | null; gate: string | null; gateRank: number; metric: string | null; value: number | null;
  unit: string | null; better: 'higher' | 'lower' | null; target: string | null; validFrom: string | null; state: string | null; project: string | null;
};

const live = (db: Db, id: string) => { const n = getNote(db, id); return n && !n.deleted_at ? n : undefined; };
/** A concept id as given, else the concept a title or alias names (§4.7). */
export const resolveConceptRef = (db: Db, ref: string): string => {
  if (ref.startsWith('c_') && live(db, ref)) return ref;
  const id = conceptIds(db, [ref])[0]; // undefined since 2026-10-25 when the name's slot holds a concept of another name
  if (!id) throw new Error(`no concept named "${ref}"`);
  return id;
};

/** DESIGN §4.9: one row per live finding `about` the concept. approachValue = the `facet:<facet_key>` attr of the approach it is `about`
 *  (only that key when `facetKey` is given); metric = its first `metric:*` attr (`<value>|<unit>|<better>|<baseline>`); target = the title of
 *  the target it is `validated_in`. Sorted by gateRank desc (no gate = −1), then value·dir desc with dir = −1 for lower-is-better, so a
 *  −4% max drawdown ranks above −1%; rows without a value last, then by id. */
export function compareConcept(db: Db, conceptId: string, facetKey?: string): CompareRow[] {
  const rows = findingsAbout(db, [conceptId]).map((id): CompareRow => {
    const a = getAttrs(db, id), rels = getRels(db, id);
    let approachValue: string | null = null, target: string | null = null;
    for (const r of rels) {
      const key = r.props.facet_key;
      if (approachValue === null && r.type === 'about' && r.dst.startsWith('a_') && typeof key === 'string' && (facetKey === undefined || key === facetKey) && live(db, r.dst))
        approachValue = getAttrs(db, r.dst)[`facet:${key}`]?.[0] ?? null;
      if (target === null && r.type === 'validated_in') target = live(db, r.dst)?.title ?? null;
    }
    const mk = Object.keys(a).find((k) => k.startsWith('metric:'));
    const [v, unit, better] = mk ? a[mk][0].split('|') : [];
    const value = v !== undefined && v !== '' && Number.isFinite(Number(v)) ? Number(v) : null;
    return {
      findingId: id, approachValue, gate: a.gate?.[0] ?? null, gateRank: a.gate_rank ? Number(a.gate_rank[0]) : -1,
      metric: mk ? mk.slice(7) : null, value, unit: unit || null, better: better === 'higher' || better === 'lower' ? better : null,
      target, validFrom: a.valid_from?.[0] ?? null, state: a.state?.[0] ?? null, project: getNote(db, id)?.project ?? null,
    };
  });
  const score = (r: CompareRow) => (r.value === null ? -Infinity : r.value * (r.better === 'lower' ? -1 : 1));
  return rows.sort((x, y) => y.gateRank - x.gateRank || score(y) - score(x) || (x.findingId < y.findingId ? -1 : 1));
}

/** One brief or CLI line; `key` names the facet when the caller knows it. */
export function compareLine(r: CompareRow, key?: string): string {
  const metric = r.metric ? `${r.metric} ${r.value ?? '?'}${r.unit ? ` ${r.unit}` : ''}${r.better ? ` (${r.better} is better)` : ''}` : 'no metric';
  const meta = [r.gate && `gate ${r.gate}`, r.target && `target ${r.target}`, r.state, r.validFrom, r.project && `project ${r.project}`].filter(Boolean).join(', ');
  return `${key ? `${key}=${r.approachValue}` : r.approachValue ?? '(no approach facet)'}: ${metric} (${meta}) [${r.findingId}]`;
}

/** DESIGN §3.6/§4.9 startup comparison block (priority 6): per concept and per facet key the project declares, when two or more live findings
 *  about that concept are `about` approaches carrying that key. */
export function comparisonSections(db: Db, cfg: ProjectConfig): Section[] {
  const keys = Object.keys(cfg.facets ?? {}); if (!keys.length) return [];
  const pairs = db.sql.prepare(`SELECT DISTINCT c.dst AS concept, json_extract(p.props, '$.facet_key') AS key, n.title FROM rel p
    JOIN rel c ON c.src=p.src AND c.type='about' AND c.deleted_at IS NULL AND c.dst LIKE 'c\\_%' ESCAPE '\\'
    JOIN note n ON n.id=c.dst AND n.deleted_at IS NULL
    WHERE p.type='about' AND p.deleted_at IS NULL AND p.dst LIKE 'a\\_%' ESCAPE '\\' AND json_extract(p.props, '$.facet_key') IN (${keys.map(() => '?').join(',')})
    ORDER BY n.title, key`).all(...keys) as { concept: string; key: string; title: string }[];
  const out: Section[] = [];
  for (const p of pairs) {
    const rows = compareConcept(db, p.concept, p.key).filter((r) => r.approachValue !== null);
    if (rows.length >= 2) out.push({ title: `Comparison: ${p.title} by ${p.key}`, priority: 6, items: rows.map((r) => compareLine(r, p.key)) });
  }
  return out;
}
