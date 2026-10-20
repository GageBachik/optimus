import { createHash } from 'node:crypto';
import { closeSync, existsSync, openSync, readdirSync, readFileSync, readSync, statSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { parse } from 'yaml';
import { type Db, upsertNote, setAttrs, getNote, deviceId } from './db.js';
import { exportNote } from './export.js';
import { evidenceId } from './ids.js';
import { loadProjectConfig } from './project.js';
import { redactSensitive } from '../lib/redaction.js';

export type ImportResult = { files: number; created: number; unchanged: number };
type Source = { file: string; title: string; project: string | null; domain: string | null; attrs: Record<string, string> };

const sha256 = (b: Buffer) => createHash('sha256').update(b).digest('hex');
const projectOf = (dir: string) => { const c = loadProjectConfig(dir); return { project: c?.project_id ?? path.basename(dir), domain: c?.domain ?? null }; };
/** Every `*.md` under `dir`, as paths relative to it, sorted. */
const mdFiles = (dir: string) => (readdirSync(dir, { recursive: true }) as string[]).filter((f) => f.endsWith('.md') && statSync(path.join(dir, f)).isFile()).sort();

/** DESIGN §4.10: one evidence note per file, id `e_<sha256 first 16 hex>` of the file's bytes; a note that already exists is left as it is.
 *  The body is the file's text, redacted (DESIGN §1 rule 10; a file with no secret is stored exactly). No git call, no edges, originals only read. */
function importSources(db: Db, bankDir: string, sources: Source[], now: string): ImportResult {
  let created = 0;
  for (const s of sources) {
    const bytes = readFileSync(s.file), sha = sha256(bytes), id = evidenceId(sha);
    if (getNote(db, id)) continue;
    upsertNote(db, { id, kind: 'evidence', domain: s.domain, project: s.project, title: redactSensitive(s.title).text, body: redactSensitive(bytes.toString('utf8')).text, created_at: now, updated_at: now, deleted_at: null, device_id: deviceId() });
    setAttrs(db, id, { ...s.attrs, source_path: s.file, sha256: sha }); exportNote(db, bankDir, id); created++;
  }
  return { files: sources.length, created, unchanged: sources.length - created };
}

/** Each `.serena/memories` directory under `dir`, skipping node_modules, .git and `~/.cache` (Ruling R6) and never following symlinks. */
function serenaDirs(dir: string, skip: string, out: string[] = []): string[] {
  let entries; try { entries = readdirSync(dir, { withFileTypes: true }); } catch { return out; }
  for (const e of entries) {
    const p = path.join(dir, e.name);
    if (!e.isDirectory() || e.name === 'node_modules' || e.name === '.git' || p === skip) continue;
    if (e.name === '.serena') { if (existsSync(path.join(p, 'memories'))) out.push(path.join(p, 'memories')); }
    else serenaDirs(p, skip, out);
  }
  return out;
}

/** DESIGN §4.10 Serena: `<root>/**\/.serena/memories/**\/*.md` plus `~/.serena/memories/global/**\/*.md`. Project = the repo's `.kb.json`
 *  project_id, else the repo directory name; global memories belong to no project. A file reached twice is imported once. */
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
  if (existsSync(global)) add(global, { project: null, domain: null });
  for (const root of roots) for (const memDir of serenaDirs(path.resolve(root), path.join(home, '.cache'))) add(memDir, projectOf(path.dirname(path.dirname(memDir))));
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
  return dashed.startsWith('-') ? walk(path.sep, dashed.slice(1)) : null;
}

/** DESIGN §4.10 auto-memory: `~/.claude/projects/<dashed-cwd>/memory/*.md` except MEMORY.md. Project = `.kb.json` project_id of the cwd
 *  (from the transcripts, else the directory name resolved on disk), else the cwd's basename, else the dashed directory name. */
export function importClaudeMemory(db: Db, bankDir: string, home = os.homedir(), now = new Date().toISOString()): ImportResult {
  const projects = path.join(home, '.claude', 'projects'), sources: Source[] = [];
  for (const d of existsSync(projects) ? readdirSync(projects).sort() : []) {
    const projDir = path.join(projects, d), memDir = path.join(projDir, 'memory');
    if (!existsSync(memDir)) continue;
    const files = readdirSync(memDir).filter((f) => f.endsWith('.md') && f !== 'MEMORY.md' && statSync(path.join(memDir, f)).isFile()).sort();
    if (!files.length) continue;
    const cwd = transcriptCwd(projDir) ?? resolveDashed(d), owner = cwd ? projectOf(cwd) : { project: d, domain: null };
    for (const f of files) {
      const file = path.join(memDir, f), fm = frontmatter(readFileSync(file, 'utf8'));
      const type = fm.metadata?.type ?? fm.type; // older files carry `type` at the top level
      sources.push({ file, title: typeof fm.name === 'string' && fm.name ? fm.name : f.slice(0, -3), ...owner,
        attrs: { origin: 'claude-memory', source_dir: projDir, ...(typeof type === 'string' ? { origin_type: type } : {}) } });
    }
  }
  return importSources(db, bankDir, sources, now);
}

function frontmatter(text: string): Record<string, any> {
  const m = /^---\r?\n([\s\S]*?)\r?\n---\r?\n/.exec(text); if (!m) return {};
  try { const fm = parse(m[1]); return fm && typeof fm === 'object' ? fm : {}; } catch { return {}; }
}
