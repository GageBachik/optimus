import { existsSync, mkdirSync, rmdirSync, statSync } from 'node:fs';
import { spawnSync, type SpawnSyncReturns } from 'node:child_process';
import path from 'node:path';
import { paths } from '../lib/paths.js';
import { log } from '../lib/log.js';
import { type Db, openDb, deviceId } from './db.js';
import { importAll } from './export.js';

export type SyncResult = 'ok' | 'busy' | 'no-remote' | 'failed';
const LOCK = '.kb-sync.lock', LOCK_STALE_MS = 10 * 60_000;
/** DESIGN §4.4: every git call is spawnSync with a 60-second timeout. */
const git = (cwd: string, ...args: string[]) => spawnSync('git', args, { cwd, encoding: 'utf8', timeout: 60_000 });
/** `-c` identity for commit/rebase when git cannot form one (no user.name/email and autodetect refused); never overrides a configured identity. */
export const gitIdentity = (cwd: string): string[] => git(cwd, 'var', 'GIT_COMMITTER_IDENT').status === 0 ? [] : ['-c', 'user.name=optimus', '-c', `user.email=kb@${deviceId()}`];
const errText = (r: SpawnSyncReturns<string>) => (r.error?.message || r.stderr || `exit ${r.status}`).trim();

/** mkdir lock in the bank; one older than 10 minutes belongs to a dead process and is taken over. Empty directories are invisible to `git add -A`. */
function lock(bank: string): boolean {
  const dir = path.join(bank, LOCK);
  for (let i = 0; i < 2; i++) {
    try { mkdirSync(dir); return true; } catch (e: any) { if (e?.code !== 'EEXIST') throw e; }
    try { if (Date.now() - statSync(dir).mtimeMs < LOCK_STALE_MS) return false; rmdirSync(dir); log('warn', 'sync: removed stale lock', dir); } catch { return false; }
  }
  return false;
}

/** The git steps of DESIGN §4.4. `reason` is what `kb doctor` shows after `failed`. */
function steps(db: Db, bank: string): { result: SyncResult; reason?: string } {
  const fail = (step: string, r: SpawnSyncReturns<string>) => { log('error', `sync: ${step} failed`, { bank, detail: errText(r) }); return { result: 'failed' as const, reason: `${step} failed` }; };
  let r = git(bank, 'add', '-A'); if (r.status !== 0) return fail('git add', r);
  const id = gitIdentity(bank);
  r = git(bank, ...id, 'commit', '-q', '-m', `kb ${deviceId()} ${new Date().toISOString()}`); if (r.status !== 0 && r.status !== 1) return fail('git commit', r); // 1 = nothing to commit
  const remote = git(bank, 'remote').stdout.split('\n')[0].trim(); if (!remote) return { result: 'no-remote' };
  // `pull --rebase` in its two halves: a fresh bank's remote branch may not exist yet (first push), and `pull` needs tracking info a hand-added remote lacks.
  r = git(bank, 'fetch', '-q', remote); if (r.status !== 0) return fail('git fetch', r);
  const branch = git(bank, 'symbolic-ref', '--short', '-q', 'HEAD').stdout.trim(), upstream = `refs/remotes/${remote}/${branch}`;
  const before = git(bank, 'rev-parse', '--verify', '-q', 'HEAD').stdout.trim(); // '' on an unborn branch: a clone of an empty remote with nothing written yet
  if (git(bank, 'rev-parse', '--verify', '-q', upstream).status === 0) {
    r = before ? git(bank, ...id, 'rebase', '-q', upstream) : git(bank, 'reset', '-q', '--hard', upstream); // unborn: adopt the remote branch
    if (r.status !== 0) { git(bank, 'rebase', '--abort'); log('warn', 'sync: rebase conflict, aborted; local commit intact', { bank, detail: errText(r) }); return { result: 'failed', reason: 'rebase conflict' }; }
  } else if (!before) return { result: 'ok' }; // nothing here, nothing there
  r = git(bank, 'push', '-q', '-u', remote, branch); if (r.status !== 0) return fail('git push', r);
  // Re-index unconditionally: HEAD may have moved before this sync started (a hand-resolved rebase, the `kb doctor` recovery path), and importAll skips files whose hash is unchanged.
  try { const im = importAll(db, bank); if (im.imported) log('info', 'sync: re-imported after pull', im); } catch (e) { log('error', 'sync: import after pull failed', String(e)); return { result: 'failed', reason: 'import failed' }; }
  return { result: 'ok' };
}

function record(db: Db, result: SyncResult, reason?: string): SyncResult {
  paths.saveConfig({ lastSyncAt: new Date().toISOString() });
  db.sql.prepare('INSERT OR REPLACE INTO meta(key, value) VALUES(?, ?)').run('lastSyncResult', reason ? `${result} (${reason})` : result);
  return result;
}

/** DESIGN §4.4: the one sync, under the bank's directory lock. `busy` records nothing (the running sync will). */
export function sync(bankDir: string): SyncResult {
  const bank = path.resolve(bankDir), db = openDb();
  try {
    if (!existsSync(path.join(bank, '.git'))) { log('warn', 'sync: bank is not a git repository', bank); return record(db, 'failed', 'not a git repository'); }
    if (!lock(bank)) return 'busy';
    try { const { result, reason } = steps(db, bank); return record(db, result, reason); } finally { try { rmdirSync(path.join(bank, LOCK)); } catch {} }
  } finally { db.sql.close(); }
}
