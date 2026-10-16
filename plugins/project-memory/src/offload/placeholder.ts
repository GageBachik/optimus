export function buildPlaceholder(a: { text: string; chars: number; lines: number; id16: string; seen: boolean; headLines: number; tailLines: number }): string {
  const n = a.chars.toLocaleString('en-US');
  if (a.seen) return `[same output as earlier · id ${a.id16} · ${n} chars · recall(id="${a.id16}") for the exact text]`;
  // Tail starts after the head so short-line-count outputs are never duplicated.
  const ls = a.text.split('\n'); const head = ls.slice(0, a.headLines).join('\n'); const tail = ls.slice(Math.max(a.headLines, ls.length - a.tailLines)).join('\n');
  return `${head}\n…[${Math.max(0, a.lines - a.headLines - a.tailLines)} lines offloaded · id ${a.id16} · recall(id="${a.id16}", offset=0) pages the full ${n} chars]…\n${tail}`;
}
