import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import { paths } from '../lib/paths.js';
import type { Kind } from './ids.js';
export type NoteRow = { id: string; kind: Kind; domain: string | null; project: string | null; title: string; body: string; created_at: string; updated_at: string; deleted_at: string | null; device_id: string };
export type RelRow = { id: string; src: string; type: string; dst: string; props: Record<string, unknown>; created_at: string; deleted_at: string | null };
export type Db = { sql: DatabaseSync; file: string };
const DDL = `
CREATE TABLE IF NOT EXISTS note(id TEXT PRIMARY KEY, kind TEXT NOT NULL, domain TEXT, project TEXT, title TEXT NOT NULL, body TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL, updated_at TEXT NOT NULL, deleted_at TEXT, device_id TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS attr(note_id TEXT NOT NULL, key TEXT NOT NULL, value TEXT NOT NULL, PRIMARY KEY(note_id, key, value));
CREATE INDEX IF NOT EXISTS attr_kv ON attr(key, value);
CREATE TABLE IF NOT EXISTS rel(id TEXT PRIMARY KEY, src TEXT NOT NULL, type TEXT NOT NULL, dst TEXT NOT NULL, props TEXT NOT NULL DEFAULT '{}', created_at TEXT NOT NULL, deleted_at TEXT);
CREATE INDEX IF NOT EXISTS rel_src ON rel(src, type); CREATE INDEX IF NOT EXISTS rel_dst ON rel(dst, type);
CREATE TABLE IF NOT EXISTS alias(name_norm TEXT PRIMARY KEY, concept_id TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS pending_merge(id TEXT PRIMARY KEY, a TEXT NOT NULL, b TEXT NOT NULL, score REAL NOT NULL, reason TEXT NOT NULL, created_at TEXT NOT NULL, resolved TEXT);
CREATE TABLE IF NOT EXISTS rank_weights(key TEXT PRIMARY KEY, value REAL NOT NULL);
CREATE TABLE IF NOT EXISTS meta(key TEXT PRIMARY KEY, value TEXT NOT NULL);
CREATE VIRTUAL TABLE IF NOT EXISTS note_fts USING fts5(note_id UNINDEXED, title, body, tokenize='porter unicode61');`;
const WEIGHTS: [string, number][] = [['facet_value', 3], ['facet_key', 1], ['environment', 2], ['subject', 2], ['gate_rank', 1], ['recency', 1], ['transfer_confirmed', 2], ['transfer_refuted', -2], ['conflict', -3], ['expired_factor', 0.5]];
export function openDb(file = path.join(paths.stateDir(), 'kb.sqlite')): Db {
  const sql = new DatabaseSync(file); sql.exec('PRAGMA journal_mode=WAL; PRAGMA busy_timeout=3000; PRAGMA foreign_keys=ON;'); sql.exec(DDL);
  const ins = sql.prepare('INSERT OR IGNORE INTO rank_weights(key, value) VALUES (?, ?)'); for (const [k, v] of WEIGHTS) ins.run(k, v);
  return { sql, file };
}
export function deviceId(): string { return process.env.PROJECT_MEMORY_DEVICE ?? paths.config().deviceId ?? 'unknown'; }
export function upsertNote(db: Db, n: NoteRow): void {
  db.sql.prepare(`INSERT INTO note(id,kind,domain,project,title,body,created_at,updated_at,deleted_at,device_id) VALUES(?,?,?,?,?,?,?,?,?,?)
    ON CONFLICT(id) DO UPDATE SET kind=excluded.kind, domain=excluded.domain, project=excluded.project, title=excluded.title, body=excluded.body, updated_at=excluded.updated_at, deleted_at=excluded.deleted_at, device_id=excluded.device_id`)
    .run(n.id, n.kind, n.domain, n.project, n.title, n.body, n.created_at, n.updated_at, n.deleted_at, n.device_id);
  reindexFts(db, n.id);
}
export function setAttrs(db: Db, noteId: string, attrs: Record<string, string | string[]>): void {
  db.sql.prepare('DELETE FROM attr WHERE note_id=?').run(noteId);
  const ins = db.sql.prepare('INSERT OR IGNORE INTO attr(note_id,key,value) VALUES(?,?,?)');
  for (const [k, v] of Object.entries(attrs)) for (const val of Array.isArray(v) ? v : [v]) ins.run(noteId, k, String(val));
}
export function addRel(db: Db, r: RelRow): void { db.sql.prepare('INSERT OR REPLACE INTO rel(id,src,type,dst,props,created_at,deleted_at) VALUES(?,?,?,?,?,?,?)').run(r.id, r.src, r.type, r.dst, JSON.stringify(r.props ?? {}), r.created_at, r.deleted_at); }
export function softDeleteNote(db: Db, id: string, at = new Date().toISOString()): void { db.sql.prepare('UPDATE note SET deleted_at=?, updated_at=? WHERE id=?').run(at, at, id); reindexFts(db, id); }
export function getNote(db: Db, id: string): NoteRow | null { return (db.sql.prepare('SELECT * FROM note WHERE id=?').get(id) as NoteRow | undefined) ?? null; }
export function getAttrs(db: Db, id: string): Record<string, string[]> { const out: Record<string, string[]> = {}; for (const r of db.sql.prepare('SELECT key, value FROM attr WHERE note_id=? ORDER BY key, value').all(id) as any[]) (out[r.key] ??= []).push(r.value); return out; }
export function getRels(db: Db, id: string, dir: 'out' | 'in' | 'both' = 'out'): RelRow[] {
  const where = dir === 'out' ? 'src=?' : dir === 'in' ? 'dst=?' : '(src=? OR dst=?)'; const args = dir === 'both' ? [id, id] : [id];
  return (db.sql.prepare(`SELECT * FROM rel WHERE ${where} AND deleted_at IS NULL ORDER BY created_at`).all(...args) as any[]).map((r) => ({ ...r, props: JSON.parse(r.props) }));
}
export function reindexFts(db: Db, noteId: string): void {
  const n = getNote(db, noteId); db.sql.prepare('DELETE FROM note_fts WHERE note_id=?').run(noteId);
  if (n && !n.deleted_at) db.sql.prepare('INSERT INTO note_fts(note_id,title,body) VALUES(?,?,?)').run(noteId, n.title, n.body);
}
