import { copyFileSync, existsSync } from 'node:fs';
import { writeFileAtomic } from '../lib/atomic.js';
/** Copies `file` to `<file>.bak-<ISO timestamp>` when it exists. */
export function backupFile(file: string): void { if (existsSync(file)) copyFileSync(file, `${file}.bak-${new Date().toISOString().replace(/[:.]/g, '-')}`); }
/** Backs `file` up, then writes `value` as pretty JSON atomically. */
export function backupAndWriteJson(file: string, value: unknown): void { backupFile(file); writeFileAtomic(file, JSON.stringify(value, null, 2) + '\n'); }
