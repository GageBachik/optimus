export type Section = { title: string; priority: number; items: string[] };

export function charSafePrefix(s: string, n: number): string {
  if (s.length <= n) return s;
  let end = Math.max(0, n);
  const c = s.charCodeAt(end - 1);
  if (c >= 0xd800 && c <= 0xdbff) end--;
  return s.slice(0, end);
}

function render(preamble: string, sections: Section[], dropped: number): string {
  const parts = [preamble.trim()];
  for (const s of sections) {
    if (!s.items.length) continue;
    parts.push(`## ${s.title}`);
    for (const it of s.items) parts.push(`- ${it}`);
  }
  if (dropped) parts.push(`[${dropped} items omitted]`);
  return parts.join('\n');
}

export function fitBrief(preamble: string, sections: Section[], limitChars = 9000): { text: string; dropped: number; truncated: boolean } {
  const work = sections.map((s) => ({ ...s, items: [...s.items] })).sort((a, b) => b.priority - a.priority);
  let dropped = 0, truncated = false, text = render(preamble, work, 0);
  while (text.length > limitChars) {
    const nonEmpty = work.filter((s) => s.items.length);
    const only = nonEmpty[0];
    if (nonEmpty.length === 1 && only && only.items.length === 1) {
      const item = only.items[0] ?? '';
      const over = text.length - limitChars + 20;
      only.items[0] = charSafePrefix(item, Math.max(0, item.length - over)) + ' [brief truncated]';
      truncated = true;
      text = render(preamble, work, dropped);
      break;
    }
    const victim = [...work].reverse().find((s) => s.items.length);
    if (!victim) break;
    victim.items.pop();
    dropped++;
    text = render(preamble, work, dropped);
  }
  if (text.length > limitChars) { text = charSafePrefix(text, limitChars - 20) + '\n[brief truncated]'; truncated = true; }
  return { text, dropped, truncated };
}
