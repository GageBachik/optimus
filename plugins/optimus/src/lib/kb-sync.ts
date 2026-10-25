import { existsSync } from 'node:fs';
import { spawn } from 'node:child_process';
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
export function spawnKbSync(): void {
  if (!existsSync(path.join(paths.bankDir(), '.git'))) return; // no bank repo yet: nothing to sync
  const kb = kbJs(); if (!kb) { log('warn', 'kb sync not spawned: dist/kb.js not found'); return; }
  spawn(process.execPath, [kb, 'sync', '--quiet', '--wait'], { detached: true, stdio: 'ignore', windowsHide: true }).on('error', (e) => log('error', 'kb sync spawn failed', String(e))).unref();
}
