import path from 'node:path';
import type { TaskState } from './task-state.js';

// DESIGN §3.5: an item is present when its key token appears in the native compact summary (case-insensitive):
// a file's basename, a command's first two tokens, an open item's first six words, an error's first eight words, an exact value itself.
export function auditSummary(summary: string, ts: TaskState): { present: string[]; missing: string[] } {
  const s = summary.toLowerCase(); const present: string[] = [], missing: string[] = [];
  const check = (label: string, key: string) => { (key && s.includes(key.toLowerCase()) ? present : missing).push(label); };
  for (const f of ts.files) check(path.basename(f.path), path.basename(f.path));
  for (const c of ts.commands) check(c.cmd, c.cmd.split(/\s+/).slice(0, 2).join(' '));
  for (const o of ts.openItems) check(o, o.split(/\s+/).slice(0, 6).join(' '));
  for (const e of ts.errors) check(e, e.split(/\s+/).slice(0, 8).join(' '));
  for (const v of ts.exactValues) check(v, v);
  return { present, missing };
}
