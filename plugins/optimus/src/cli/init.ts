import { spawnSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { paths } from '../lib/paths.js';
import { log } from '../lib/log.js';
import { openDb, type Db } from '../kb/db.js';
import { installTemplate, installedDomains } from '../kb/templates.js';
import { exportNote, rebuild } from '../kb/export.js';
import { gitIdentity } from '../kb/sync.js';
import { loadTemplate } from '../kb/templates-yaml.js';
import type { ProjectConfig } from '../kb/project.js';
/** The shipped templates; resolved next to dist/kb.js (`../templates`) or src/cli (`../../templates`). */
function shippedTemplatesDir(): string {
  const here = path.dirname(fileURLToPath(import.meta.url));
  return [path.join(here, '..', 'templates'), path.join(here, '..', '..', 'templates')].find(existsSync) ?? path.join(here, '..', 'templates');
}
function git(cwd: string, ...args: string[]): string {
  const r = spawnSync('git', args, { cwd, encoding: 'utf8', timeout: 60_000, windowsHide: true });
  if (r.status !== 0) throw new Error(`git ${args.join(' ')} failed: ${(r.stderr || r.error?.message || '').trim()}`);
  return r.stdout;
}
/** Installs every `templates/*.yaml` of the bank into the index. */
function installBankTemplates(bank: string): string[] {
  const dir = path.join(bank, 'templates'); if (!existsSync(dir)) return [];
  const db = openDb(); const files = readdirSync(dir).filter((f) => f.endsWith('.yaml')).sort();
  for (const f of files) installTemplate(db, loadTemplate(path.join(dir, f)));
  db.sql.close(); return files;
}
/** DESIGN §4.3/§4.4 `kb init [--bank <dir>] [--clone <url>]`. Re-running on an existing bank only commits files it creates; user edits stay uncommitted. */
export function initBank(opts: { bank?: string; clone?: string; print?: (line: string) => void } = {}): void {
  const print = opts.print ?? ((l: string) => process.stdout.write(l + '\n'));
  const bank = path.resolve(opts.bank ?? paths.bankDir());
  const written: string[] = []; // bank-relative files this run created; the only ones it commits
  if (opts.clone) {
    mkdirSync(path.dirname(bank), { recursive: true }); git(path.dirname(bank), 'clone', '-q', opts.clone, bank);
    mkdirSync(path.join(bank, 'notes'), { recursive: true });
    print(`cloned ${opts.clone} into ${bank}`);
  } else {
    mkdirSync(bank, { recursive: true });
    if (!existsSync(path.join(bank, '.git'))) {
      // Never sweep an unrelated directory into git.
      if (readdirSync(bank).length) throw new Error(`${bank} is not empty and not a git repository; pick an empty directory or an existing bank`);
      git(bank, 'init', '-q', '-b', 'main');
    }
    if (!existsSync(path.join(bank, '.gitattributes'))) { writeFileSync(path.join(bank, '.gitattributes'), '* text=auto eol=lf\n'); written.push('.gitattributes'); }
    for (const d of ['templates', 'notes']) mkdirSync(path.join(bank, d), { recursive: true });
    const src = shippedTemplatesDir();
    for (const f of readdirSync(src).filter((f) => f.endsWith('.yaml'))) {
      if (existsSync(path.join(bank, 'templates', f))) continue;
      copyFileSync(path.join(src, f), path.join(bank, 'templates', f)); written.push(`templates/${f}`);
    }
  }
  const installed = installBankTemplates(bank);
  // DESIGN §4.4: a second machine "clones and rebuilds", so the clone's notes are indexed before its first session.
  if (opts.clone) { const db = openDb(); try { print(`index rebuilt from the clone: ${rebuild(db, bank).imported} notes`); } finally { db.sql.close(); } }
  paths.saveConfig({ bankDir: bank });
  print(`templates installed: ${installed.join(', ') || 'none'}`); print(`bankDir: ${bank} (${paths.configPath()})`);
  if (written.length) {
    // `--only` with explicit paths: other staged or dirty user work is left alone.
    git(bank, 'add', '--', ...written); git(bank, ...gitIdentity(bank), 'commit', '-q', '-m', 'kb init', '--only', '--', ...written); print('initial commit written');
  }
}
/** DESIGN §4.5 `kb project init --domain <d> [--id <id>]`: writes (or updates) `.kb.json` in cwd, keeping other fields. v1.5: the automatic
 *  guess record (`auto`) is dropped — a domain set by hand is final, and the first-prompt settle only moves a low automatic guess. */
export function projectInit(cwd: string, opts: { domain: string; id?: string }): ProjectConfig {
  const file = path.join(cwd, '.kb.json');
  const { auto: _auto, ...prev } = existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : {};
  const c: ProjectConfig = { ...prev, project_id: opts.id ?? prev.project_id ?? path.basename(path.resolve(cwd)).toLowerCase(), domain: opts.domain };
  writeFileSync(file, JSON.stringify(c, null, 2) + '\n'); return c;
}

export type ProjectMove = { project_id: string; domain: string; file: string | null; moved: Record<string, number>; total: number };
/** The nearest `.kb.json` at or above cwd (8 levels), parsed; null when there is none. A file that is not JSON is an error, not a guess. */
function nearestKbJson(cwd: string): { file: string; cfg: Record<string, unknown> } | null {
  let dir = path.resolve(cwd);
  for (let i = 0; i < 8; i++) {
    const file = path.join(dir, '.kb.json');
    if (existsSync(file)) { try { return { file, cfg: JSON.parse(readFileSync(file, 'utf8')) }; } catch (e) { throw new Error(`${file} is not valid JSON: ${(e as Error).message}`); } }
    const up = path.dirname(dir); if (up === dir) break; dir = up;
  }
  return null;
}
/** DESIGN §4.5 `kb project move --domain <d> [--id <project>]` (2026-10-24): moves a whole project into another domain. `project init --domain`
 *  rewrites only `.kb.json`, and every note the project already has keeps its old domain (the brief and the map keep filing it there), so this
 *  sets `domain` on every live note with `project = id`, whatever its kind, touches `updated_at` and re-exports each: the bank files change and
 *  `kb sync` ships them. A note already in the domain is left alone, so a second run changes nothing. The domain must be installed (`kb domain
 *  new` creates one). The `.kb.json` here or above is rewritten as a hand-set choice (its `auto` record dropped, every other key kept) when it
 *  names the moved project; `--id` names the project from anywhere else (the bank, say) and leaves an unrelated `.kb.json` alone. */
export function projectMove(db: Db, bankDir: string, cwd: string, opts: { domain: string; id?: string }, now = new Date().toISOString()): ProjectMove {
  const found = nearestKbJson(cwd), local = typeof found?.cfg.project_id === 'string' ? (found.cfg.project_id as string) : undefined;
  const id = opts.id ?? local;
  if (!id) throw new Error(found ? `${found.file} has no project_id; pass --id <project>` : 'no .kb.json here or above; run this in the project folder or pass --id <project>');
  const domains = installedDomains(db);
  if (!domains.includes(opts.domain)) throw new Error(`unknown domain ${opts.domain} (installed: ${domains.join(', ') || 'none'}); a new kind of project needs kb domain new ${opts.domain} --facets a,b,c --gates g1,g2,g3 [--keywords w1,w2] first`);
  const rows = db.sql.prepare('SELECT id, kind FROM note WHERE project=? AND deleted_at IS NULL AND (domain IS NULL OR domain<>?) ORDER BY kind, id').all(id, opts.domain) as { id: string; kind: string }[];
  const upd = db.sql.prepare('UPDATE note SET domain=?, updated_at=? WHERE id=?'), moved: Record<string, number> = {};
  for (const r of rows) { upd.run(opts.domain, now, r.id); exportNote(db, bankDir, r.id); moved[r.kind] = (moved[r.kind] ?? 0) + 1; }
  let file: string | null = null;
  if (found && local === id) {
    const { auto: _auto, ...rest } = found.cfg, next = JSON.stringify({ ...rest, domain: opts.domain }, null, 2) + '\n';
    if (readFileSync(found.file, 'utf8') !== next) writeFileSync(found.file, next);
    file = found.file;
  }
  log('info', 'project moved', { project: id, domain: opts.domain, file, moved, total: rows.length });
  return { project_id: id, domain: opts.domain, file, moved, total: rows.length };
}
