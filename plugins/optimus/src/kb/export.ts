import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { parse, stringify } from 'yaml';
import { writeFileAtomic } from '../lib/atomic.js';
import { type Db, type NoteRow, type RelRow, upsertNote, setAttrs, getNote, getAttrs, getRels, addRel } from './db.js';
import type { Kind } from './ids.js';
import { normalizeName } from './normalize.js';
import { installTemplate } from './templates.js';
import { loadTemplate } from './templates-yaml.js';

const sha256 = (s: string) => createHash('sha256').update(s).digest('hex');
/** Code-point order, like yaml's sortMapEntries; localeCompare would make the file depend on the host locale. */
const cmp = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);
/** DESIGN §4.3: `l_` + 26 chars of sha256(src|type|dst|props), so two machines importing the same file produce the same row. */
/** Props keys are hashed in code-point order: the file stores them sorted, so a local row and its import agree whatever order the caller used. */
export const relId = (src: string, type: string, dst: string, props: Record<string, unknown>) =>
  `l_${sha256(`${src}|${type}|${dst}|${JSON.stringify(Object.fromEntries(Object.entries(props).sort(([a], [b]) => cmp(a, b))))}`).slice(0, 26)}`;
/** Changes a rel's dst and/or props and re-derives its id (DESIGN §4.3), so the row keeps the id every other machine derives from the file.
 *  INSERT OR REPLACE folds it into an identical rel that already exists. Returns the new id. */
export function rekeyRel(db: Db, id: string, change: { dst?: string; props?: Record<string, unknown> }): string {
  const r = db.sql.prepare('SELECT * FROM rel WHERE id=?').get(id) as (Omit<RelRow, 'props'> & { props: string }) | undefined;
  if (!r) throw new Error(`no rel ${id}`);
  const dst = change.dst ?? r.dst, props = change.props ?? JSON.parse(r.props), next = relId(r.src, r.type, dst, props);
  db.sql.prepare('DELETE FROM rel WHERE id=?').run(id);
  addRel(db, { ...r, id: next, dst, props });
  return next;
}

/** DESIGN §4.3: a pure function of the rows — sorted keys, rels sorted by (type, dst), single values as scalars, LF only. */
export function renderNoteFile(n: NoteRow, attrs: Record<string, string[]>, rels: RelRow[]): string {
  const fm: Record<string, unknown> = {
    id: n.id, kind: n.kind, domain: n.domain, project: n.project, title: n.title, created_at: n.created_at, updated_at: n.updated_at, device_id: n.device_id,
    ...(n.deleted_at ? { deleted_at: n.deleted_at } : {}),
    attrs: Object.fromEntries(Object.entries(attrs).map(([k, v]) => [k, v.length === 1 ? v[0] : v])),
    rels: [...rels].sort((a, b) => cmp(a.type, b.type) || cmp(a.dst, b.dst))
      .map((r) => ({ type: r.type, dst: r.dst, ...(Object.keys(r.props ?? {}).length ? { props: r.props } : {}) })),
  };
  return `---\n${stringify(fm, { sortMapEntries: true, lineWidth: 0 })}---\n${n.body.replace(/\r\n?/g, '\n')}`;
}

export function parseNoteFile(raw: string): { note: NoteRow; attrs: Record<string, string[]>; rels: RelRow[] } {
  const text = raw.replace(/\r\n/g, '\n'); // a note checked out or saved with CRLF (Windows) is the LF file it was rendered as
  const end = text.indexOf('\n---\n', 3);
  if (!text.startsWith('---\n') || end < 0) throw new Error('note file has no frontmatter');
  const fm = parse(text.slice(4, end + 1)) ?? {};
  const note: NoteRow = { id: fm.id, kind: fm.kind as Kind, domain: fm.domain ?? null, project: fm.project ?? null, title: fm.title, body: text.slice(end + 5),
    created_at: fm.created_at, updated_at: fm.updated_at, deleted_at: fm.deleted_at ?? null, device_id: fm.device_id };
  if (typeof note.id !== 'string' || typeof note.kind !== 'string' || typeof note.title !== 'string') throw new Error('note frontmatter needs id, kind and title');
  const attrs = Object.fromEntries(Object.entries(fm.attrs ?? {}).map(([k, v]) => [k, (Array.isArray(v) ? v : [v]).map(String)]));
  const rels: RelRow[] = (fm.rels ?? []).map((r: { type: string; dst: string; props?: Record<string, unknown> }) => {
    const props = r.props ?? {};
    return { id: relId(note.id, r.type, r.dst, props), src: note.id, type: r.type, dst: r.dst, props, created_at: note.created_at, deleted_at: null };
  });
  return { note, attrs, rels };
}

const noteFile = (bankDir: string, n: NoteRow) => path.join(bankDir, 'notes', n.kind, `${n.id}.md`);

export function exportNote(db: Db, bankDir: string, id: string): string {
  const n = getNote(db, id); if (!n) throw new Error(`no note ${id}`);
  const file = noteFile(bankDir, n); mkdirSync(path.dirname(file), { recursive: true });
  writeFileAtomic(file, renderNoteFile(n, getAttrs(db, id), getRels(db, id, 'out')));
  return file;
}

/** Exports every note, deleted ones included (their `deleted_at` is how a deletion syncs). */
export function exportAll(db: Db, bankDir: string): number {
  const ids = (db.sql.prepare('SELECT id FROM note ORDER BY id').all() as { id: string }[]).map((r) => r.id);
  for (const id of ids) exportNote(db, bankDir, id);
  return ids.length;
}

/** The file is the truth: the note's attrs and outgoing rels are replaced by the file's. */
export function importFile(db: Db, file: string): NoteRow {
  const { note, attrs, rels } = parseNoteFile(readFileSync(file, 'utf8'));
  upsertNote(db, note); db.sql.prepare('UPDATE note SET created_at=? WHERE id=?').run(note.created_at, note.id); // upsert keeps the old created_at
  setAttrs(db, note.id, attrs);
  db.sql.prepare('DELETE FROM rel WHERE src=?').run(note.id);
  const ins = db.sql.prepare('INSERT OR REPLACE INTO rel(id,src,type,dst,props,created_at,deleted_at) VALUES(?,?,?,?,?,?,?)');
  for (const r of rels) ins.run(r.id, r.src, r.type, r.dst, JSON.stringify(r.props), r.created_at, null);
  // A deleted concept (e.g. merged away) owns no aliases; a live one takes its names over, so file order never decides who owns an alias.
  if (note.kind === 'concept' && note.deleted_at) db.sql.prepare('DELETE FROM alias WHERE concept_id=?').run(note.id);
  else if (note.kind === 'concept') {
    const alias = db.sql.prepare('INSERT OR REPLACE INTO alias(name_norm, concept_id) VALUES(?,?)');
    for (const a of [note.title, ...(attrs.alias ?? [])]) alias.run(normalizeName(a), note.id);
  }
  return note;
}

/** Imports every `notes/<kind>/*.md`, skipping files whose sha256 matches the `meta` row `file:<relative path>`. Caller owns the transaction. */
function importNotes(db: Db, bankDir: string): { imported: number; unchanged: number } {
  const notes = path.join(bankDir, 'notes'); let imported = 0, unchanged = 0;
  if (!existsSync(notes)) return { imported, unchanged };
  const getMeta = db.sql.prepare('SELECT value FROM meta WHERE key=?');
  const setMeta = db.sql.prepare('INSERT OR REPLACE INTO meta(key, value) VALUES(?,?)');
  for (const kind of readdirSync(notes, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name).sort()) {
    for (const f of readdirSync(path.join(notes, kind)).filter((f) => f.endsWith('.md')).sort()) {
      const file = path.join(notes, kind, f), key = `file:notes/${kind}/${f}`, hash = sha256(readFileSync(file, 'utf8'));
      if ((getMeta.get(key) as { value: string } | undefined)?.value === hash) { unchanged++; continue; }
      try { importFile(db, file); } catch (e) { throw new Error(`${file}: ${(e as Error).message}`, { cause: e }); }
      setMeta.run(key, hash); imported++;
    }
  }
  return { imported, unchanged };
}

function inTransaction<T>(db: Db, fn: () => T): T {
  db.sql.exec('BEGIN');
  try { const r = fn(); db.sql.exec('COMMIT'); return r; } catch (e) { db.sql.exec('ROLLBACK'); throw e; }
}

/** Installs every `templates/*.yaml` of the bank (idempotent: upsert + attrs). v1.5: sync runs it too, so a domain created on one machine
 *  (or a yaml dropped into the bank by hand) is a domain on every machine after the next pull, not only after `kb rebuild`. */
export function installBankTemplates(db: Db, bankDir: string): number {
  const dir = path.join(bankDir, 'templates'); if (!existsSync(dir)) return 0;
  const files = readdirSync(dir).filter((f) => f.endsWith('.yaml')).sort();
  for (const f of files) installTemplate(db, loadTemplate(path.join(dir, f)));
  return files.length;
}

/** All-or-nothing: one bad file aborts the import and leaves the index as it was. */
export function importAll(db: Db, bankDir: string): { imported: number; unchanged: number } {
  return inTransaction(db, () => { installBankTemplates(db, bankDir); return importNotes(db, bankDir); });
}

/** Drops the rebuildable index (notes, attrs, rels, aliases, FTS, file hashes), reinstalls the bank's templates, then imports every note file, all in one transaction. */
export function rebuild(db: Db, bankDir: string): { imported: number; unchanged: number } {
  return inTransaction(db, () => {
    db.sql.exec(`DELETE FROM note; DELETE FROM attr; DELETE FROM rel; DELETE FROM alias; DELETE FROM note_fts; DELETE FROM meta WHERE key LIKE 'file:%';`);
    installBankTemplates(db, bankDir);
    return importNotes(db, bankDir);
  });
}
