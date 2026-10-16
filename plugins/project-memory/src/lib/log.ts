import { appendFileSync } from 'node:fs';
import path from 'node:path';
import { paths } from './paths.js';
export function log(level: 'info' | 'warn' | 'error', msg: string, data?: unknown): void {
  try { appendFileSync(path.join(paths.logsDir(), 'hooks.log'), JSON.stringify({ t: new Date().toISOString(), level, msg, data }) + '\n', 'utf8'); } catch {}
}
