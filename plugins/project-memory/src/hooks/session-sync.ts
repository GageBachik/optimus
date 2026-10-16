import type { HookInput } from '../lib/run-hook.js';
import { gcBlobs } from '../offload/blobs.js';
import { log } from '../lib/log.js';

// Phase 1: blob GC only. Phase 2 spawns `kb sync` detached before it.
export async function sessionSync(_input: HookInput): Promise<undefined> {
  log('info', 'blob gc', gcBlobs());
  return undefined;
}
export const handler = sessionSync;
