import { createHash } from 'node:crypto';
import { existsSync, readFileSync, appendFileSync, readdirSync, statSync, unlinkSync } from 'node:fs';
import path from 'node:path';
import { paths } from '../lib/paths.js';
import { writeFileAtomic } from '../lib/atomic.js';
import { redactSensitive } from '../lib/redaction.js';
export type BlobMeta = { id: string; tool: string; chars: number; lines: number; head: string; sessionId: string; createdAt: string; command?: string };
export function storeBlob(text: string, meta: { tool: string; sessionId: string; command?: string }) {
  const id = createHash('sha256').update(text, 'utf8').digest('hex'); const file = path.join(paths.blobsDir(), id); const created = !existsSync(file);
  const lines = text.split('\n').length;
  if (created) { writeFileAtomic(file, text); const m: BlobMeta = { id, tool: meta.tool, chars: text.length, lines, head: text.slice(0, 96).replace(/\s+/g, ' '), sessionId: meta.sessionId, createdAt: new Date().toISOString(), command: meta.command === undefined ? undefined : redactSensitive(meta.command).text.slice(0, 120) }; appendFileSync(path.join(paths.blobsDir(), 'index.jsonl'), JSON.stringify(m) + '\n', 'utf8'); }
  return { id, id16: id.slice(0, 16), created, chars: text.length, lines };
}
export function resolveBlobId(idOrPrefix: string): string | null {
  if (idOrPrefix.length === 64) return existsSync(path.join(paths.blobsDir(), idOrPrefix)) ? idOrPrefix : null;
  return readdirSync(paths.blobsDir()).find((f) => f.length === 64 && f.startsWith(idOrPrefix)) ?? null;
}
export function readBlob(idOrPrefix: string, offset = 0, limit = 8192) {
  const id = resolveBlobId(idOrPrefix); if (!id) throw new Error(`unknown blob ${idOrPrefix} (looked in ${paths.blobsDir()})`);
  const text = readFileSync(path.join(paths.blobsDir(), id), 'utf8'); const lim = Math.max(1, Math.min(limit, 32768)); const start = Math.max(0, Math.min(offset, text.length));
  return { id, total: text.length, offset: start, text: text.slice(start, start + lim), next: start + lim < text.length ? start + lim : null };
}
export function gcBlobs(maxAgeDays = 14, maxBytes = 500 * 1024 * 1024): { removed: number } {
  const dir = paths.blobsDir(); const now = Date.now(); let removed = 0;
  const files = readdirSync(dir).filter((f) => f.length === 64).map((f) => ({ f, st: statSync(path.join(dir, f)) }));
  const kept = files.filter(({ f, st }) => { if (now - st.mtimeMs <= maxAgeDays * 864e5) return true; unlinkSync(path.join(dir, f)); removed++; return false; });
  let total = kept.reduce((n, x) => n + x.st.size, 0);
  for (const { f, st } of kept.sort((a, b) => a.st.mtimeMs - b.st.mtimeMs)) { if (total <= maxBytes) break; unlinkSync(path.join(dir, f)); total -= st.size; removed++; }
  return { removed };
}
