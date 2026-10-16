import { spawnSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { paths } from '../lib/paths.js';
import { openDb } from '../kb/db.js';
import { installTemplate } from '../kb/templates.js';
import { rebuild } from '../kb/export.js';
import { gitIdentity } from '../kb/sync.js';
import { loadTemplate } from '../kb/templates-yaml.js';
import type { ProjectConfig } from '../kb/project.js';
/** The shipped templates; resolved next to dist/kb.js (`../templates`) or src/cli (`../../templates`). */
function shippedTemplatesDir(): string {
  const here = path.dirname(fileURLToPath(import.meta.url));
  return [path.join(here, '..', 'templates'), path.join(here, '..', '..', 'templates')].find(existsSync) ?? path.join(here, '..', 'templates');
}
function git(cwd: string, ...args: string[]): string {
  const r = spawnSync('git', args, { cwd, encoding: 'utf8', timeout: 60_000 });
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
/** DESIGN §4.5 `kb project init --domain <d> [--id <id>]`: writes (or updates) `.kb.json` in cwd, keeping other fields. */
export function projectInit(cwd: string, opts: { domain: string; id?: string }): ProjectConfig {
  const file = path.join(cwd, '.kb.json');
  const prev = existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : {};
  const c: ProjectConfig = { ...prev, project_id: opts.id ?? prev.project_id ?? path.basename(path.resolve(cwd)).toLowerCase(), domain: opts.domain };
  writeFileSync(file, JSON.stringify(c, null, 2) + '\n'); return c;
}
