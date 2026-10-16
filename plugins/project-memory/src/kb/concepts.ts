import { appendFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { type Db, upsertNote, getNote, getAttrs, setAttrs, softDeleteNote, deviceId } from './db.js';
import { exportNote } from './export.js';
import { ulid } from './ids.js';
import { normalizeName, tokens, dice } from './normalize.js';
import { conceptNoteId } from './templates.js';
import { redactSensitive } from '../lib/redaction.js';

export type Resolution = { conceptId: string; how: 'exact' | 'alias' | 'auto-alias' | 'pending' | 'new'; score?: number };
type Concept = { id: string; title: string };
type PendingRow = { id: string; a: string; b: string; score: number; resolved: string | null };

const concepts = (db: Db) => db.sql.prepare(`SELECT id, title FROM note WHERE kind='concept' AND deleted_at IS NULL ORDER BY id`).all() as Concept[];
const log = (bankDir: string, line: string) => { mkdirSync(bankDir, { recursive: true }); appendFileSync(path.join(bankDir, 'concept-merges.md'), line + '\n'); };
const touch = (db: Db, id: string, now: string) => db.sql.prepare('UPDATE note SET updated_at=? WHERE id=?').run(now, id);

/** Adds `name` as an alias of concept `id`: alias row + `alias` attr (so it syncs, DESIGN §4.3). */
function addAlias(db: Db, id: string, names: string[], now: string): void {
  const attrs = getAttrs(db, id), title = normalizeName(getNote(db, id)!.title);
  const ins = db.sql.prepare('INSERT OR REPLACE INTO alias(name_norm, concept_id) VALUES(?,?)');
  for (const n of names) { ins.run(normalizeName(n), id); if (normalizeName(n) !== title) attrs.alias = [...new Set([...(attrs.alias ?? []), n])]; }
  setAttrs(db, id, attrs); touch(db, id, now);
}

function createConcept(db: Db, name: string, now: string): string {
  const id = conceptNoteId(name);
  upsertNote(db, { id, kind: 'concept', domain: null, project: null, title: name, body: '', created_at: now, updated_at: now, deleted_at: null, device_id: deviceId() });
  db.sql.prepare('INSERT OR REPLACE INTO alias(name_norm, concept_id) VALUES(?,?)').run(normalizeName(name), id);
  return id;
}

/** DESIGN §4.7, in order: exact title → alias table → Dice over stemmed tokens (auto-alias | pending | new). */
export function resolveConcept(db: Db, bankDir: string, tag: string, now: string): Resolution {
  tag = redactSensitive(tag).text; // DESIGN principle 10: a tag becomes a note title, an alias and a concept-merges.md line, all synced
  const norm = normalizeName(tag), all = concepts(db);
  const exact = all.find((c) => normalizeName(c.title) === norm); if (exact) return { conceptId: exact.id, how: 'exact' };
  const hit = db.sql.prepare(`SELECT a.concept_id AS id FROM alias a JOIN note n ON n.id=a.concept_id WHERE a.name_norm=? AND n.deleted_at IS NULL`).get(norm) as { id: string } | undefined;
  if (hit) return { conceptId: hit.id, how: 'alias' };
  // Best score per concept over its title and aliases.
  const t = tokens(tag), best = new Map<string, { score: number; shared: number }>();
  for (const c of all) for (const name of [c.title, ...(getAttrs(db, c.id).alias ?? [])]) {
    const u = tokens(name), score = dice(t, u), shared = u.filter((x) => t.includes(x)).length;
    if (score > (best.get(c.id)?.score ?? -1)) best.set(c.id, { score, shared });
  }
  const ranked = [...best.entries()].sort((x, y) => y[1].score - x[1].score);
  const [top] = ranked;
  if (top && top[1].score >= 0.8 && top[1].shared >= 2 && ranked.filter(([, s]) => s.score >= 0.8).length === 1) {
    const [id, { score }] = top;
    addAlias(db, id, [tag], now); exportNote(db, bankDir, id);
    log(bankDir, `- ${now.slice(0, 10)} auto-merged "${tag}" into ${getNote(db, id)!.title} (dice ${score.toFixed(2)}) · undo: kb concepts split "${norm}"`);
    return { conceptId: id, how: 'auto-alias', score };
  }
  const id = createConcept(db, tag, now); exportNote(db, bankDir, id);
  if (top && top[1].score >= 0.5) {
    const tie = ranked.filter(([, s]) => s.score === top[1].score).length > 1;
    db.sql.prepare('INSERT INTO pending_merge(id, a, b, score, reason, created_at, resolved) VALUES(?,?,?,?,?,?,NULL)')
      .run(ulid(), id, top[0], top[1].score, tie ? 'dice tie' : 'dice', now);
    return { conceptId: id, how: 'pending', score: top[1].score };
  }
  return { conceptId: id, how: 'new' };
}

// pendingQuestions lives in brief.ts: the startup hook needs it, and this module reaches `yaml` through export.ts.

function openPending(db: Db, id: string): PendingRow {
  const p = db.sql.prepare('SELECT * FROM pending_merge WHERE id=?').get(id) as PendingRow | undefined;
  if (!p) throw new Error(`no pending merge ${id}`);
  if (p.resolved) throw new Error(`pending merge ${id} is already ${p.resolved}`);
  return p;
}

/** a becomes an alias of b: names move, `about`/`relies_on` rels re-point to b, a is soft-deleted; every touched note is re-exported. */
export function acceptMerge(db: Db, bankDir: string, id: string, now = new Date().toISOString()): void {
  const p = openPending(db, id), a = getNote(db, p.a)!, b = getNote(db, p.b)!;
  addAlias(db, b.id, [a.title, ...(getAttrs(db, a.id).alias ?? [])], now);
  const srcs = (db.sql.prepare(`SELECT DISTINCT src FROM rel WHERE dst=? AND type IN ('about','relies_on') AND deleted_at IS NULL`).all(a.id) as { src: string }[]).map((r) => r.src);
  db.sql.prepare(`UPDATE rel SET dst=? WHERE dst=? AND type IN ('about','relies_on') AND deleted_at IS NULL`).run(b.id, a.id);
  softDeleteNote(db, a.id, now);
  db.sql.prepare('UPDATE pending_merge SET resolved=? WHERE id=?').run('accepted', id);
  for (const n of [a.id, b.id, ...srcs]) { touch(db, n, now); exportNote(db, bankDir, n); }
  log(bankDir, `- ${now.slice(0, 10)} merged "${a.title}" into ${b.title} (accepted ${id}) · undo: kb concepts split "${normalizeName(a.title)}"`);
}

export function rejectMerge(db: Db, id: string): void {
  openPending(db, id); db.sql.prepare('UPDATE pending_merge SET resolved=? WHERE id=?').run('rejected', id);
}

/** Undo of an alias: the name leaves its concept and becomes a concept of its own, so the next tag with it resolves `exact`. */
export function splitAlias(db: Db, bankDir: string, nameNorm: string, now = new Date().toISOString()): string {
  const row = db.sql.prepare('SELECT concept_id FROM alias WHERE name_norm=?').get(nameNorm) as { concept_id: string } | undefined;
  if (!row) throw new Error(`no alias ${nameNorm}`);
  const owner = getNote(db, row.concept_id)!;
  if (normalizeName(owner.title) === nameNorm) throw new Error(`"${nameNorm}" is the title of ${owner.id}, not an alias`);
  const attrs = getAttrs(db, owner.id), names = attrs.alias ?? [];
  const name = names.find((n) => normalizeName(n) === nameNorm) ?? nameNorm.replace(/-/g, ' ');
  attrs.alias = names.filter((n) => normalizeName(n) !== nameNorm); if (!attrs.alias.length) delete attrs.alias;
  setAttrs(db, owner.id, attrs); touch(db, owner.id, now); exportNote(db, bankDir, owner.id);
  const id = createConcept(db, name, now); exportNote(db, bankDir, id);
  log(bankDir, `- ${now.slice(0, 10)} split "${name}" out of ${owner.title} into ${id}`);
  return id;
}
