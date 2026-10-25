import { createHash } from 'node:crypto';
import { closeSync, existsSync, openSync, readdirSync, readFileSync, readSync, statSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { parse } from 'yaml';
import { type Db, upsertNote, setAttrs, getNote, getAttrs, deviceId } from './db.js';
import { exportNote } from './export.js';
import { evidenceId } from './ids.js';
import { loadProjectConfig } from './project.js';
import { WORKSPACE_ROOTS } from './auto-register.js';
import { redactSensitive } from '../lib/redaction.js';

/** `moved` (2026-10-24): existing notes whose project or domain the attribution computed now differs from; see importSources. */
export type ImportResult = { files: number; created: number; unchanged: number; moved: number };
type Source = { file: string; title: string; project: string | null; domain: string | null; attrs: Record<string, string> };

const sha256 = (b: Buffer) => createHash('sha256').update(b).digest('hex');
const none = { project: null, domain: null };
/** The project a directory belongs to: its `.kb.json` (walking up) gives id and domain; else the enclosing git repository's directory name, so a
 *  linked worktree (`.git` is a file), an archived tree or a research subfolder inside a repository belongs to the repository; else the directory's
 *  own name. The home directory is no project (auto-register never files it either), nor is a workspace root directly under it (`~/projects`, Desktop, …:
 *  on 2026-10-24, 48 memories whose cwd or `.serena` folder was `~/projects` had been filed under a project named `projects`), nor a folder under one
 *  of its hidden directories; the walk stops at the home. */
function projectOf(dir: string, home: string): { project: string | null; domain: string | null } {
  const d = path.resolve(dir), top = path.resolve(home);
  if (d === top) return none;
  const c = loadProjectConfig(d); if (c) return { project: c.project_id, domain: c.domain };
  const rel = path.relative(top, d);
  if (rel && !rel.startsWith('..') && !path.isAbsolute(rel)) {
    if (WORKSPACE_ROOTS.includes(rel)) return none; // ~/projects, Desktop, … hold projects and are not one, as auto-register rules
    if (rel.split(path.sep).some((s) => s.startsWith('.'))) return none; // a folder under a hidden directory of the home (~/.t3/scratch/<chat>, ~/.claude/…) is scratch, not a project
  }
  for (let p = d, i = 0; i < 16 && p !== top; i++) {
    try { if (statSync(path.join(p, '.git')).isDirectory()) return { project: path.basename(p), domain: null }; } catch { /* no .git here */ }
    const up = path.dirname(p); if (up === p) break; p = up;
  }
  return { project: path.basename(d), domain: null };
}
/** Every `*.md` under `dir`, as paths relative to it, sorted. */
const mdFiles = (dir: string) => (readdirSync(dir, { recursive: true }) as string[]).filter((f) => f.endsWith('.md') && statSync(path.join(dir, f)).isFile()).sort();
/** The same file: resolved paths, compared without case on Windows (a launcher's `c:\` and the on-disk `C:\` name one file). */
const samePath = (a: string | undefined, b: string) => a !== undefined && (process.platform === 'win32' ? path.resolve(a).toLowerCase() === path.resolve(b).toLowerCase() : path.resolve(a) === path.resolve(b));

/** DESIGN §4.10: one evidence note per file, id `e_<sha256 first 16 hex>` of the file's bytes. The body is the file's text, redacted (DESIGN §1
 *  rule 10; a file with no secret is stored exactly). A note that exists keeps its text and attrs, but its `project`/`domain` follow the attribution
 *  computed now (2026-10-24: a corrected rule had no way to reach the 48 notes the old one misfiled) when, and only when, the file walked is the
 *  note's recorded `source_path`: a different project, or a set domain that differs, is written, `updated_at` touched and the note re-exported,
 *  counted as `moved`; a null computed domain never undoes one set by `kb project move`; a retracted note stays as it is. Any other copy of the
 *  same text leaves the note alone: the first run of the rule without this test moved eight notes wrongly, an auto-memory to the repository whose
 *  `.serena` held the same text (and the other importer would have moved it back), and a memory whose original had since changed to the snapshot
 *  folder still holding the old text. A note without a `source_path` (the other machine's older imports) never moves here. No git call, no edges,
 *  originals only read. */
function importSources(db: Db, bankDir: string, sources: Source[], now: string): ImportResult {
  let created = 0, moved = 0; const owned = new Set<string>();
  const move = db.sql.prepare('UPDATE note SET project=?, domain=?, updated_at=? WHERE id=?');
  for (const s of sources) {
    const bytes = readFileSync(s.file), sha = sha256(bytes), id = evidenceId(sha);
    if (owned.has(id)) continue; owned.add(id);
    const n = getNote(db, id);
    if (n) {
      if (n.deleted_at || !samePath(getAttrs(db, id).source_path?.[0], s.file)) continue;
      const domain = n.project === s.project ? (s.domain ?? n.domain) : s.domain;
      if (n.project === s.project && n.domain === domain) continue;
      move.run(s.project, domain, now, id); exportNote(db, bankDir, id); moved++; continue;
    }
    upsertNote(db, { id, kind: 'evidence', domain: s.domain, project: s.project, title: redactSensitive(s.title).text, body: redactSensitive(bytes.toString('utf8')).text, created_at: now, updated_at: now, deleted_at: null, device_id: deviceId() });
    setAttrs(db, id, { ...s.attrs, source_path: s.file, sha256: sha }); exportNote(db, bankDir, id); created++;
  }
  return { files: sources.length, created, unchanged: sources.length - created - moved, moved };
}

/** Each `.serena/memories` directory under `dir`, skipping node_modules, .git, `~/.cache` (Ruling R6) and the home's application-data folders
 *  (`~/AppData`, `~/Library`: on 2026-10-24 a walk from the home found 225 of its 377 memory folders under `AppData\Local\Temp`, this suite's
 *  own fixtures and scratch clones, and imported 20 of them as evidence of projects named `demo`, `repo`, `a`), never following symlinks. */
function serenaDirs(dir: string, skip: string[], out: string[] = []): string[] {
  let entries; try { entries = readdirSync(dir, { withFileTypes: true }); } catch { return out; }
  for (const e of entries) {
    const p = path.join(dir, e.name);
    if (!e.isDirectory() || e.name === 'node_modules' || e.name === '.git' || skip.some((s) => samePath(s, p))) continue;
    if (e.name === '.serena') { if (existsSync(path.join(p, 'memories'))) out.push(path.join(p, 'memories')); }
    else serenaDirs(p, skip, out);
  }
  return out;
}

/** DESIGN §4.10 Serena: `<root>/**\/.serena/memories/**\/*.md` plus `~/.serena/memories/global/**\/*.md`. Project = the repo's `.kb.json`
 *  project_id, else the repo directory name; global memories belong to no project. A file reached twice is imported once. Memory directories are
 *  taken shallowest first: a repository's own memories come before the copies inside it (git worktrees under `.claude/worktrees`, archived trees,
 *  snapshots), so an identical copy is skipped by its hash and a copy-only revision is filed under the repository, never under the copy's folder. */
export function importSerena(db: Db, bankDir: string, roots: string[], home = os.homedir(), now = new Date().toISOString()): ImportResult {
  const sources: Source[] = [], seen = new Set<string>();
  const add = (memDir: string, owner: { project: string | null; domain: string | null }) => {
    for (const rel of mdFiles(memDir)) {
      const file = path.join(memDir, rel); if (seen.has(file)) continue; seen.add(file);
      const name = rel.slice(0, -3).split(path.sep).join('/');
      sources.push({ file, title: name, ...owner, attrs: { origin: 'serena', memory_name: name } });
    }
  };
  const global = path.join(home, '.serena', 'memories', 'global');
  if (existsSync(global)) add(global, none);
  const depth = (p: string) => p.split(path.sep).length, byDepth = (a: string, b: string) => depth(a) - depth(b) || (a < b ? -1 : a > b ? 1 : 0);
  const skip = ['.cache', 'AppData', 'Library'].map((d) => path.join(home, d));
  for (const root of roots) for (const memDir of serenaDirs(path.resolve(root), skip).sort(byDepth)) add(memDir, projectOf(path.dirname(path.dirname(memDir)), home));
  return importSources(db, bankDir, sources, now);
}

/** The `cwd` of the first transcript line that carries one (the very first line of a transcript usually does not), reading at most 1 MB per file. */
function transcriptCwd(projDir: string): string | null {
  for (const f of readdirSync(projDir).filter((f) => f.endsWith('.jsonl')).sort()) {
    const buf = Buffer.alloc(1 << 20), fd = openSync(path.join(projDir, f), 'r');
    let n; try { n = readSync(fd, buf, 0, buf.length, 0); } finally { closeSync(fd); }
    for (const line of buf.subarray(0, n).toString('utf8').split('\n')) {
      try { const cwd = JSON.parse(line).cwd; if (typeof cwd === 'string' && cwd) return cwd; } catch { /* a partial or non-JSON line */ }
    }
  }
  return null;
}

/** Claude Code names a project directory after its cwd with every non-alphanumeric character replaced by `-`; this finds a directory on disk
 *  with that encoding (the encoding is lossy, so it searches), or null. */
function resolveDashed(dashed: string): string | null {
  const enc = (s: string) => s.replace(/[^A-Za-z0-9]/g, '-');
  const walk = (dir: string, rest: string): string | null => {
    if (!rest) return dir;
    let names: string[]; try { names = readdirSync(dir, { withFileTypes: true }).filter((e) => e.isDirectory() || e.isSymbolicLink()).map((e) => e.name); } catch { return null; }
    for (const name of names.filter((n) => rest === enc(n) || rest.startsWith(enc(n) + '-')).sort((a, b) => b.length - a.length)) {
      const r = walk(path.join(dir, name), rest.slice(enc(name).length + 1)); if (r) return r;
    }
    return null;
  };
  const drive = /^([A-Za-z])--(.+)$/.exec(dashed); // Windows: a drive path (C: and a separator) encodes as C--…
  if (drive) return walk(`${drive[1]}:\\`, drive[2]);
  return dashed.startsWith('-') ? walk(path.sep, dashed.slice(1)) : null;
}

/** DESIGN §4.10 auto-memory: `~/.claude/projects/<dashed-cwd>/memory/*.md` except MEMORY.md. Project = `.kb.json` project_id of the cwd
 *  (from the transcripts, else the directory name resolved on disk), else the cwd's repository or basename, else the dashed directory name. */
export function importClaudeMemory(db: Db, bankDir: string, home = os.homedir(), now = new Date().toISOString()): ImportResult {
  const projects = path.join(home, '.claude', 'projects'), sources: Source[] = [];
  for (const d of existsSync(projects) ? readdirSync(projects).sort() : []) {
    const projDir = path.join(projects, d), memDir = path.join(projDir, 'memory');
    if (!existsSync(memDir)) continue;
    const files = readdirSync(memDir).filter((f) => f.endsWith('.md') && f !== 'MEMORY.md' && statSync(path.join(memDir, f)).isFile()).sort();
    if (!files.length) continue;
    const cwd = transcriptCwd(projDir) ?? resolveDashed(d), owner = cwd ? projectOf(cwd, home) : { project: d, domain: null };
    for (const f of files) {
      const file = path.join(memDir, f), fm = frontmatter(readFileSync(file, 'utf8'));
      const type = fm.metadata?.type ?? fm.type; // older files carry `type` at the top level
      sources.push({ file, title: typeof fm.name === 'string' && fm.name ? fm.name : f.slice(0, -3), ...owner,
        attrs: { origin: 'claude-memory', source_dir: projDir, ...(typeof type === 'string' ? { origin_type: type } : {}) } });
    }
  }
  return importSources(db, bankDir, sources, now);
}

/** A Codex path may carry the Windows extended-length prefix `\\?\`. */
const plainPath = (p: string) => p.trim().replace(/^\\\\\?\\/, '');
/** DESIGN §4.10 Codex: `~/.codex/memories/rollout_summaries/*.md` (one per Codex thread, header lines `thread_id:` and `cwd:`, the `# ` heading is its
 *  title), `extensions/ad_hoc/notes/*.md` (a "Project: `<dir>`" line names the project when there is one) and `memory_summary.md` (the user profile,
 *  no project). The project comes from the cwd by the same rules as the other importers; a cwd under `~/Documents/Codex` is Codex's own scratch
 *  workspace and has no project. `MEMORY.md`, `raw_memories.md` and `phase2_workspace_diff.md` are derived from the summaries and skipped; `skills/`
 *  are not memories. */
export function importCodexMemory(db: Db, bankDir: string, home = os.homedir(), now = new Date().toISOString()): ImportResult {
  const mem = path.join(home, '.codex', 'memories'), sources: Source[] = [];
  if (!existsSync(mem)) return { files: 0, created: 0, unchanged: 0, moved: 0 };
  const scratch = path.resolve(home, 'Documents', 'Codex');
  const ownerOf = (cwd: string | undefined) => { if (!cwd) return none; const c = path.resolve(plainPath(cwd)); return c === scratch || c.startsWith(scratch + path.sep) ? none : projectOf(c, home); };
  const heading = (t: string, fallback: string) => /^# (.+)$/m.exec(t)?.[1].trim() || fallback;
  const field = (t: string, key: string) => new RegExp(`^${key}: (.+)$`, 'm').exec(t)?.[1].trim();
  const list = (dir: string) => (existsSync(dir) ? readdirSync(dir).filter((f) => f.endsWith('.md') && statSync(path.join(dir, f)).isFile()).sort() : []);
  const summaries = path.join(mem, 'rollout_summaries');
  for (const f of list(summaries)) {
    const file = path.join(summaries, f), t = readFileSync(file, 'utf8'), cwd = field(t, 'cwd'), thread = field(t, 'thread_id');
    sources.push({ file, title: heading(t, f.slice(0, -3)), ...ownerOf(cwd), attrs: { origin: 'codex', memory_name: `rollout_summaries/${f.slice(0, -3)}`, ...(thread ? { thread_id: thread } : {}), ...(cwd ? { cwd: plainPath(cwd) } : {}) } });
  }
  const notes = path.join(mem, 'extensions', 'ad_hoc', 'notes');
  for (const f of list(notes)) {
    const file = path.join(notes, f), t = readFileSync(file, 'utf8'), project = /^Project: `([^`]+)`/m.exec(t)?.[1];
    sources.push({ file, title: heading(t, f.slice(0, -3)), ...ownerOf(project), attrs: { origin: 'codex', memory_name: `ad_hoc/${f.slice(0, -3)}` } });
  }
  const summary = path.join(mem, 'memory_summary.md');
  if (existsSync(summary)) sources.push({ file: summary, title: 'memory_summary', ...none, attrs: { origin: 'codex', memory_name: 'memory_summary' } });
  return importSources(db, bankDir, sources, now);
}

function frontmatter(text: string): Record<string, any> {
  const m = /^---\r?\n([\s\S]*?)\r?\n---\r?\n/.exec(text); if (!m) return {};
  try { const fm = parse(m[1]); return fm && typeof fm === 'object' ? fm : {}; } catch { return {}; }
}
