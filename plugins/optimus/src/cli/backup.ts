import { copyFileSync, existsSync, readFileSync } from 'node:fs';
import { writeFileAtomic } from '../lib/atomic.js';
/** Copies `file` to `<file>.bak-<ISO timestamp>` when it exists. */
export function backupFile(file: string): void { if (existsSync(file)) copyFileSync(file, `${file}.bak-${new Date().toISOString().replace(/[:.]/g, '-')}`); }
/** Backs `file` up, then writes `value` as pretty JSON atomically. */
export function backupAndWriteJson(file: string, value: unknown): void { backupFile(file); writeFileAtomic(file, JSON.stringify(value, null, 2) + '\n'); }
/** Re-reads `file` at write time (Claude Code rewrites ~/.claude.json while running; a plan-time snapshot would clobber its changes), applies `mutate`, then backs up and writes. */
export function editJson(file: string, mutate: (j: any) => void): void { const j = existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : {}; mutate(j); backupAndWriteJson(file, j); }
