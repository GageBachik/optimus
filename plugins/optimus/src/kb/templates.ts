import { type Db, upsertNote, setAttrs, getAttrs } from './db.js';
import { normalizeName } from './normalize.js';
/** v1.5 `keywords`: the words a folder name or a prompt about this kind of work contains; auto-registration and first-prompt settling read
 *  them from the index, so a template dropped into the bank is also a domain a session can settle to (DESIGN §4.5). */
export type Template = { domain: string; facets: string[]; methods: string[]; gates: string[]; environment: string; subject: string; seed_concepts: { name: string; aliases: string[] }[]; keywords?: string[] };
const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
export const domainNoteId = (domain: string) => `d_${slug(domain).padEnd(26, '0').slice(0, 26)}`;
export const templateNoteId = (domain: string) => `m_${slug(domain).padEnd(26, '0').slice(0, 26)}`;
export const conceptNoteId = (name: string) => `c_${normalizeName(name).replace(/-/g, '').padEnd(26, '0').slice(0, 26)}`;
/** Keywords as the prompt tokenizer sees them: lowercase, split on commas and spaces, only [a-z0-9-]; a YAML scalar "ps4, ps5" works too. */
export const normalizeKeywords = (v: unknown): string[] => [...new Set((Array.isArray(v) ? v : [v]).flatMap((x) => String(x ?? '').toLowerCase().split(/[,\s]+/)).map((s) => s.replace(/^-+|-+$/g, '')).filter((s) => /^[a-z0-9][a-z0-9-]*$/.test(s)))];
/** DESIGN §4.2/§4.3: domain + template notes with enumerating attrs, seed concepts with alias rows and `alias` attrs. */
export function installTemplate(db: Db, t: Template, now = new Date().toISOString()): void {
  const base = { project: null, body: '', created_at: now, updated_at: now, deleted_at: null, device_id: 'init' };
  upsertNote(db, { id: domainNoteId(t.domain), kind: 'domain', domain: t.domain, title: t.domain, ...base });
  upsertNote(db, { id: templateNoteId(t.domain), kind: 'template', domain: t.domain, title: `${t.domain} template`, ...base });
  const keywords = normalizeKeywords(t.keywords ?? []);
  setAttrs(db, templateNoteId(t.domain), { facet: t.facets, method: t.methods, ...Object.fromEntries(t.gates.map((g, i) => [`gate:${i}`, g])), env_axis: t.environment, subject_axis: t.subject, ...(keywords.length ? { keyword: keywords } : {}) });
  const ins = db.sql.prepare('INSERT OR IGNORE INTO alias(name_norm, concept_id) VALUES(?,?)');
  for (const c of t.seed_concepts ?? []) {
    const id = conceptNoteId(c.name), aliases = c.aliases ?? [];
    upsertNote(db, { id, kind: 'concept', domain: null, title: c.name, ...base });
    // A concept seeded by several templates keeps the union of their aliases.
    const attrs = getAttrs(db, id); attrs.alias = [...new Set([...(attrs.alias ?? []), ...aliases])];
    if (attrs.alias.length) setAttrs(db, id, attrs);
    for (const a of [c.name, ...aliases]) ins.run(normalizeName(a), id);
  }
}
export function templateFor(db: Db, domain: string): Template | null {
  // Insertion (rowid) order, not getAttrs' sorted order: facet and method lists keep the yaml order.
  const a: Record<string, string[]> = {};
  for (const r of db.sql.prepare('SELECT key, value FROM attr WHERE note_id=? ORDER BY rowid').all(templateNoteId(domain)) as { key: string; value: string }[]) (a[r.key] ??= []).push(r.value);
  if (!a.facet) return null;
  const gates = Object.entries(a).filter(([k]) => k.startsWith('gate:')).sort(([x], [y]) => Number(x.slice(5)) - Number(y.slice(5))).map(([, v]) => v[0]);
  return { domain, facets: a.facet, methods: a.method ?? [], gates, environment: a.env_axis?.[0] ?? 'environment', subject: a.subject_axis?.[0] ?? 'subject', seed_concepts: [], keywords: a.keyword ?? [] };
}
/** Every domain with a template in the index, in name order. */
export const installedDomains = (db: Db): string[] => (db.sql.prepare("SELECT domain FROM note WHERE kind='template' AND deleted_at IS NULL AND domain IS NOT NULL ORDER BY domain").all() as { domain: string }[]).map((r) => r.domain);
export function validateApproachFacets(db: Db, domain: string, facets: Record<string, string>): void {
  const t = templateFor(db, domain); if (!t) throw new Error(`unknown domain ${domain}`);
  const bad = Object.keys(facets).filter((k) => !t.facets.includes(k));
  if (bad.length) throw new Error(`unknown facet keys ${bad.join(', ')} for ${domain}; allowed facet keys: ${t.facets.join(', ')}`);
}
export function gateRank(db: Db, domain: string, gate: string): number {
  const t = templateFor(db, domain); if (!t) throw new Error(`unknown domain ${domain}`);
  const i = t.gates.indexOf(gate); if (i < 0) throw new Error(`unknown gate ${gate}; allowed gates: ${t.gates.join(' < ')}`); return i;
}
