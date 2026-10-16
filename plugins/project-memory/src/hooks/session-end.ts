import path from 'node:path';
import { existsSync, readFileSync } from 'node:fs';
import type { HookInput } from '../lib/run-hook.js';
import { paths } from '../lib/paths.js';
import { storeBlob } from '../offload/blobs.js';
import { deleteSession } from '../lib/session-state.js';

// DESIGN §3.1: synchronous, milliseconds of work (plugin SessionEnd hooks share a 1.5 s budget).
export async function sessionEnd(input: HookInput): Promise<undefined> {
  const sessionId = String(input.session_id ?? 'unknown'); const ts = path.join(paths.sessionDir(sessionId), 'task-state.md');
  if (existsSync(ts)) storeBlob(readFileSync(ts, 'utf8'), { tool: 'task-state', sessionId });
  deleteSession(sessionId);
  return undefined;
}
export const handler = sessionEnd;
