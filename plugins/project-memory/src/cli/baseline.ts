import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
export type Baseline = { sessions: number; turns: number; p50: number; p90: number; p99: number; max: number; compactions: number; cacheReadShare: number };
/** Context-per-turn statistics over every main-session transcript (`*.jsonl`, `subagents/` excluded) under `projectsDir` (DESIGN §3.10). */
export function computeBaseline(projectsDir: string): Baseline {
  const files: string[] = [];
  const walk = (d: string) => { for (const f of readdirSync(d)) { const p = path.join(d, f); if (statSync(p).isDirectory()) { if (f !== 'subagents') walk(p); } else if (f.endsWith('.jsonl')) files.push(p); } };
  walk(projectsDir);
  const ctx: number[] = []; let compactions = 0, cacheRead = 0, total = 0;
  // A compaction writes both a compact_boundary and an isCompactSummary entry: count the larger of the two per file, not their sum.
  for (const f of files) { let boundaries = 0, summaries = 0; for (const line of readFileSync(f, 'utf8').split('\n')) {
    if (!line) continue; let j: any; try { j = JSON.parse(line); } catch { continue; }
    if (j.type === 'assistant' && j.message?.usage) { const u = j.message.usage; const c = (u.input_tokens ?? 0) + (u.cache_read_input_tokens ?? 0) + (u.cache_creation_input_tokens ?? 0); if (c > 0) { ctx.push(c); cacheRead += u.cache_read_input_tokens ?? 0; total += c; } }
    if (j.subtype === 'compact_boundary') boundaries++; if (j.isCompactSummary) summaries++;
  } compactions += Math.max(boundaries, summaries); }
  ctx.sort((a, b) => a - b); const pct = (p: number) => (ctx.length ? ctx[Math.min(ctx.length - 1, Math.floor(ctx.length * p))] : 0);
  return { sessions: files.length, turns: ctx.length, p50: pct(0.5), p90: pct(0.9), p99: pct(0.99), max: ctx.at(-1) ?? 0, compactions, cacheReadShare: total ? cacheRead / total : 0 };
}
