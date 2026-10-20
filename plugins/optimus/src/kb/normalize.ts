/** DESIGN §4.7: deterministic name normalization (no model). */
const STOP = new Set('a an and are as at be by for from has have in is it its of on or that the this to was were will with'.split(' '));

// Porter (1980) stemmer, the standard five steps.
const isCons = (w: string, i: number): boolean => { const c = w[i]; if ('aeiou'.includes(c)) return false; return c === 'y' ? i === 0 || !isCons(w, i - 1) : true; };
/** m in [C](VC)^m[V] for w. */
function measure(w: string): number { let m = 0, i = 0; const n = w.length; while (i < n && isCons(w, i)) i++; while (i < n) { while (i < n && !isCons(w, i)) i++; if (i >= n) break; while (i < n && isCons(w, i)) i++; m++; } return m; }
const hasVowel = (w: string) => [...w].some((_, i) => !isCons(w, i));
const doubleCons = (w: string) => w.length >= 2 && w.at(-1) === w.at(-2) && isCons(w, w.length - 1);
const cvc = (w: string) => { const n = w.length; return n >= 3 && isCons(w, n - 3) && !isCons(w, n - 2) && isCons(w, n - 1) && !'wxy'.includes(w[n - 1]); };
/** If w ends with one of the [suffix, replacement] pairs (first match only) and the stem satisfies cond, replace it. */
function rule(w: string, pairs: [string, string][], cond: (stem: string) => boolean): string {
  for (const [s, r] of pairs) if (w.endsWith(s)) { const stem = w.slice(0, -s.length); return cond(stem) ? stem + r : w; }
  return w;
}
const P = (s: string): [string, string][] => s.split(' ').map((p) => p.split('>') as [string, string]);
const STEP2 = P('ational>ate tional>tion enci>ence anci>ance izer>ize bli>ble alli>al entli>ent eli>e ousli>ous ization>ize ation>ate ator>ate alism>al iveness>ive fulness>ful ousness>ous aliti>al iviti>ive biliti>ble logi>log');
const STEP3 = P('icate>ic ative> alize>al iciti>ic ical>ic ful> ness>');
const STEP4 = 'al ance ence er ic able ible ant ement ment ent ion ou ism ate iti ous ive ize'.split(' ');
export function stem(word: string): string {
  let w = word; if (w.length <= 2) return w;
  // 1a
  if (w.endsWith('sses') || w.endsWith('ies')) w = w.slice(0, -2); else if (w.endsWith('s') && !w.endsWith('ss')) w = w.slice(0, -1);
  // 1b
  if (w.endsWith('eed')) { if (measure(w.slice(0, -3)) > 0) w = w.slice(0, -1); }
  else { const suf = w.endsWith('ed') ? 2 : w.endsWith('ing') ? 3 : 0; const base = w.slice(0, -suf);
    if (suf && hasVowel(base)) { w = base;
      if (w.endsWith('at') || w.endsWith('bl') || w.endsWith('iz')) w += 'e';
      else if (doubleCons(w) && !'lsz'.includes(w.at(-1)!)) w = w.slice(0, -1);
      else if (measure(w) === 1 && cvc(w)) w += 'e'; } }
  // 1c
  if (w.endsWith('y') && hasVowel(w.slice(0, -1))) w = w.slice(0, -1) + 'i';
  // 2, 3
  w = rule(w, STEP2, (s) => measure(s) > 0); w = rule(w, STEP3, (s) => measure(s) > 0);
  // 4 (longest match first; 'ion' only after s or t)
  const s4 = STEP4.filter((s) => w.endsWith(s)).sort((a, b) => b.length - a.length)[0];
  if (s4) { const st = w.slice(0, -s4.length); if (measure(st) > 1 && (s4 !== 'ion' || /[st]$/.test(st))) w = st; }
  // 5a, 5b
  if (w.endsWith('e')) { const st = w.slice(0, -1); const m = measure(st); if (m > 1 || (m === 1 && !cvc(st))) w = st; }
  if (measure(w) > 1 && doubleCons(w) && w.endsWith('l')) w = w.slice(0, -1);
  return w;
}
/** Lowercased, split on space/-/_/camelCase, punctuation stripped, stopwords dropped, Porter-stemmed, sorted, deduped. */
export function tokens(name: string): string[] {
  const parts = name.replace(/([a-z0-9])([A-Z])/g, '$1 $2').toLowerCase().split(/[\s\-_]+/).map((t) => t.replace(/[^a-z0-9]/g, ''));
  return [...new Set(parts.filter((t) => t && !STOP.has(t)).map(stem))].sort();
}
export const normalizeName = (name: string): string => tokens(name).join('-');
/** Sørensen–Dice coefficient of two token sets. */
export function dice(a: string[], b: string[]): number {
  const A = new Set(a), B = new Set(b); if (!A.size && !B.size) return 0;
  let shared = 0; for (const t of A) if (B.has(t)) shared++;
  return (2 * shared) / (A.size + B.size);
}
