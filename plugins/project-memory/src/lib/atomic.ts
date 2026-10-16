import { writeFileSync, readFileSync, renameSync, realpathSync, existsSync, statSync, chmodSync, unlinkSync } from 'node:fs';
import path from 'node:path';
import { randomBytes } from 'node:crypto';
/** A JSON file's parsed content, or null when it is missing or unreadable (a half-written or corrupt record is treated as absent). */
export function readJson<T>(filePath: string): T | null { try { return JSON.parse(readFileSync(filePath, 'utf8')); } catch { return null; } }
export function writeFileAtomic(filePath: string, data: string | Buffer): void {
  const dir = realpathSync(path.dirname(filePath)); const target = path.join(dir, path.basename(filePath));
  const tmp = path.join(dir, `.${path.basename(filePath)}.tmp-${process.pid}-${randomBytes(4).toString('hex')}`);
  const mode = existsSync(target) ? statSync(target).mode & 0o777 : undefined;
  writeFileSync(tmp, data, 'utf8'); if (mode !== undefined) chmodSync(tmp, mode);
  let lastErr: unknown;
  for (let i = 0; i < 5; i++) { try { renameSync(tmp, target); return; } catch (e: any) { lastErr = e; if (!['EPERM', 'EBUSY', 'ENOENT'].includes(e?.code)) break; Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 20); } }
  try { unlinkSync(tmp); } catch {} throw lastErr;
}
