import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { mkdirSync, existsSync, readFileSync, realpathSync, renameSync } from 'node:fs';
import { writeFileAtomic } from './atomic.js';
function ensure(p: string): string { if (!existsSync(p)) mkdirSync(p, { recursive: true }); return p; }
const safe = (s: string) => s.replace(/[^A-Za-z0-9_-]/g, '_');
/** The on-disk spelling of a path (case, 8.3 short names, /var for /private/var), or the resolved path when it does not exist. */
export const canonical = (p: string) => { const r = path.resolve(p); try { return realpathSync.native(r); } catch { return r; } };
/** Short lowercase hostname: `Gages-MacBook-Pro.local` → `gages-macbook-pro` (DESIGN §3.8): the device id `kb setup` records, and what a machine
 *  that skipped setup reports instead of "unknown" (an isolated run on 2026-10-24 stamped its finding device_id: unknown). */
export const defaultDeviceId = (host = os.hostname()) => host.split('.')[0].toLowerCase().replace(/[^a-z0-9]+/g, '-');
export type Config = { bankDir?: string; deviceId?: string; lastSyncAt?: string; offload?: { thresholdChars?: number; headLines?: number; tailLines?: number } };
export const paths = {
  /** `~/.optimus` (or `OPTIMUS_HOME`). The plugin was called project-memory until 2026-10-20: an existing `~/.project-memory` with no `~/.optimus` beside it is renamed once. */
  stateDir(): string {
    if (!process.env.OPTIMUS_HOME) { const home = os.homedir(), old = path.join(home, '.project-memory'), now = path.join(home, '.optimus'); if (existsSync(old) && !existsSync(now)) { try { renameSync(old, now); } catch {} } }
    return ensure(path.normalize(process.env.OPTIMUS_HOME ?? path.join(os.homedir(), '.optimus')));
  },
  blobsDir(): string { return ensure(path.join(this.stateDir(), 'blobs')); },
  sessionDir(sessionId: string, agentId = 'main'): string { return ensure(path.join(this.stateDir(), 'sessions', safe(sessionId), safe(agentId))); },
  logsDir(): string { return ensure(path.join(this.stateDir(), 'logs')); },
  configPath(): string { return path.join(this.stateDir(), 'config.json'); },
  config(): Config { try { const c = JSON.parse(readFileSync(this.configPath(), 'utf8')); return c && typeof c === 'object' && !Array.isArray(c) ? c : {}; } catch { return {}; } },
  saveConfig(patch: Config): void { writeFileAtomic(this.configPath(), JSON.stringify({ ...this.config(), ...patch }, null, 2) + '\n'); }, // the retrying rename: a reader holding config.json open on Windows makes a bare renameSync throw EPERM
  bankDir(): string { return path.normalize(process.env.OPTIMUS_BANK ?? this.config().bankDir ?? path.join(os.homedir(), 'knowledge-bank')); },
  projectKey(cwd: string): string {
    const start = canonical(cwd); let dir = start; // one folder, one key, whatever spelling the launcher used (audit 2026-10-24: drive letter case, GAGEBA~1 for Gage Bachik)
    for (let i = 0; i < 8; i++) { const f = path.join(dir, '.kb.json'); if (existsSync(f)) { try { const id = JSON.parse(readFileSync(f, 'utf8')).project_id; if (typeof id === 'string' && id) return id; } catch {} } const up = path.dirname(dir); if (up === dir) break; dir = up; }
    return createHash('sha256').update(start).digest('hex').slice(0, 16);
  },
  projectDir(key: string): string { return ensure(path.join(this.stateDir(), 'projects', safe(key))); },
  /** v1.5: the runnable kb command for text a session will execute. There is no `kb` on PATH unless the user aliased it (README), so
   *  briefs say `node <plugin>/dist/kb.js`: next to this bundle in dist/, or the plugin's dist/ when running from src/ under tsx. */
  kbCli(): string {
    const here = path.dirname(fileURLToPath(import.meta.url));
    // Quoted, forward slashes: Claude Code's Bash tool on Windows is Git Bash, which strips unquoted backslashes from `node C:\Users\…\kb.js`,
    // and a home folder with a space splits an unquoted path in every shell. Node accepts forward slashes on Windows; on POSIX path.sep is '/'.
    for (const c of [path.join(here, 'kb.js'), path.join(here, '..', '..', 'dist', 'kb.js')]) if (existsSync(c)) return `node "${path.normalize(c).split(path.sep).join('/')}"`;
    return 'kb';
  },
};
