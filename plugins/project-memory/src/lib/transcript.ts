// Adapted from claude-mem src/shared/transcript-parser.ts — Copyright 2026 Alex Newman — Apache-2.0 — modified.
import { openSync, readSync, fstatSync, closeSync } from 'node:fs';
export type TranscriptEntry = { type: 'user' | 'assistant' | 'system' | string; timestamp?: string; message?: { role?: string; content?: unknown; usage?: Record<string, number> }; [k: string]: unknown };

export function readTranscript(path: string, fromOffset = 0): { entries: TranscriptEntry[]; toOffset: number } {
  const fd = openSync(path, 'r');
  try {
    const size = fstatSync(fd).size;
    if (fromOffset >= size) return { entries: [], toOffset: size };
    const buf = Buffer.alloc(size - fromOffset);
    readSync(fd, buf, 0, buf.length, fromOffset);
    // Cut at the last newline in bytes, so a half-written trailing line (or a split multi-byte char) waits for the next read.
    const lastNl = buf.lastIndexOf(0x0a);
    const complete = lastNl >= 0 ? buf.subarray(0, lastNl + 1) : buf.subarray(0, 0);
    const entries: TranscriptEntry[] = [];
    for (const line of complete.toString('utf8').split('\n')) { if (!line.trim()) continue; try { entries.push(JSON.parse(line)); } catch { /* unparsable line: skip */ } }
    return { entries, toOffset: fromOffset + complete.length };
  } finally { closeSync(fd); }
}

export function blocks(e: TranscriptEntry): any[] { const c = e.message?.content; return Array.isArray(c) ? c : typeof c === 'string' ? [{ type: 'text', text: c }] : []; }
export function textOf(e: TranscriptEntry): string { return blocks(e).filter((b) => b?.type === 'text').map((b) => String(b.text)).join('\n').replace(/<system-reminder>[\s\S]*?<\/system-reminder>/g, '').trim(); }

export function lastAssistantText(entries: TranscriptEntry[]): string | null {
  for (let i = entries.length - 1; i >= 0; i--) { const e = entries[i]; if (e.type !== 'assistant') continue; const t = textOf(e); if (t) return t; }
  const tools = entries.flatMap(blocks).filter((b) => b?.type === 'tool_use').map((b) => b.name).slice(-5);
  return tools.length ? `[Session ended mid-task. Last tools used: ${tools.join(', ')}]` : null;
}
