import { existsSync } from 'node:fs';
import { spawn, spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { paths } from './paths.js';
import { log } from './log.js';
/** dist/kb.js next to the bundled dist/hook.js, or ../../dist/kb.js when running from src/lib under tsx. */
function kbJs(): string | undefined {
  const here = path.dirname(fileURLToPath(import.meta.url));
  return [path.join(here, 'kb.js'), path.join(here, '..', '..', 'dist', 'kb.js')].find(existsSync);
}
/** DESIGN §3.1/§4.4: hooks run `kb sync` detached. sync() itself lives in dist/kb.js — its re-import path pulls in yaml, which must stay out of the hook bundle.
 *  `--wait`: a sync spawned while another holds the lock waits for it instead of returning `busy`, so notes written after the running sync's
 *  commit step still ship (a Stop that follows a kb_write can land seconds after the asking Stop's sync started). */
/** A change in the bank that no sync has committed yet: a subagent's kb_write (its tool calls are in the agent transcript, not the main
 *  one), a kb_link re-export, a CLI set/retract/transfer/project move, a sync that gave up waiting. The Stop hook asks this when the turn's
 *  own transcript shows no write and the last sync is recent (review 2026-10-25). 50-100 ms on a 3,900-file bank; a spawn failure counts
 *  as clean, so the 60-second rule still applies. */
export function bankDirty(): boolean {
  const bank = paths.bankDir(); if (!existsSync(path.join(bank, '.git'))) return false;
  const r = spawnSync('git', ['status', '--porcelain', '--untracked-files=all'], { cwd: bank, encoding: 'utf8', timeout: 10_000, windowsHide: true });
  return r.status === 0 && r.stdout.trim().length > 0;
}
export function spawnKbSync(): void {
  if (!existsSync(path.join(paths.bankDir(), '.git'))) return; // no bank repo yet: nothing to sync
  const kb = kbJs(); if (!kb) { log('warn', 'kb sync not spawned: dist/kb.js not found'); return; }
  spawn(process.execPath, [kb, 'sync', '--quiet', '--wait'], { detached: true, stdio: 'ignore', windowsHide: true }).on('error', (e) => log('error', 'kb sync spawn failed', String(e))).unref();
}
