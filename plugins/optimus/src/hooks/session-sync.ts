import type { HookInput } from '../lib/run-hook.js';
import { gcBlobs } from '../offload/blobs.js';
import { spawnKbSync } from '../lib/kb-sync.js';
import { log } from '../lib/log.js';

// DESIGN §3.1: the async SessionStart hook (every source) spawns `kb sync` detached, then GCs blobs.
export async function sessionSync(_input: HookInput): Promise<undefined> {
  spawnKbSync();
  log('info', 'blob gc', gcBlobs());
  return undefined;
}
export const handler = sessionSync;
