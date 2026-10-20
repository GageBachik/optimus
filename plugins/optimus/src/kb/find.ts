import type { Db } from './db.js';
import type { Kind } from './ids.js';
import { normalizeName } from './normalize.js';

export type FindArgs = { text?: string; kind?: Kind; project?: string; domain?: string; concept?: string; limit?: number };
export type FindHit = { id: string; kind: Kind; title: string; snippet: string };

/** DESIGN §4.5: each whitespace token double-quoted (inner quotes doubled), max 40, implicit AND — punctuation can never reach FTS5 syntax. */
const ftsQuery = (text: string) => text.split(/\s+/).filter(Boolean).slice(0, 40).map((t) => `"${t.replaceAll('"', '""')}"`).join(' ');

/** Plain full-text search plus filters over live notes, newest first. `concept` is a concept id, title or alias. */
export function kbFind(db: Db, a: FindArgs): FindHit[] {
  const where = ['n.deleted_at IS NULL'], params: (string | number)[] = [];
  const q = a.text ? ftsQuery(a.text) : '';
  if (q) { where.push('note_fts MATCH ?'); params.push(q); }
  for (const k of ['kind', 'project', 'domain'] as const) if (a[k] !== undefined) { where.push(`n.${k} = ?`); params.push(a[k]!); }
  if (a.concept !== undefined) {
    const hit = db.sql.prepare('SELECT concept_id FROM alias WHERE name_norm=?').get(normalizeName(a.concept)) as { concept_id: string } | undefined;
    where.push(`EXISTS (SELECT 1 FROM rel r WHERE r.src = n.id AND r.type = 'about' AND r.dst = ? AND r.deleted_at IS NULL)`); params.push(hit?.concept_id ?? a.concept);
  }
  params.push(Math.max(1, Math.min(a.limit ?? 20, 100)));
  const snippet = q ? `snippet(note_fts, 2, '', '', '…', 16)` : `substr(n.body, 1, 120)`;
  const from = q ? 'note_fts f JOIN note n ON n.id = f.note_id' : 'note n';
  return db.sql.prepare(`SELECT n.id, n.kind, n.title, ${snippet} AS snippet FROM ${from} WHERE ${where.join(' AND ')} ORDER BY n.updated_at DESC, n.id LIMIT ?`).all(...params) as FindHit[];
}
