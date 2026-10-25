import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

// 2026-10-24, Windows: the Stop hook's detached `kb sync` has no console, so every git it spawned opened a terminal window on the
// owner's desktop (add, commit, fetch, rebase, push: a burst of windows after a turn). Node's `windowsHide: true` creates the child
// with no window. This test reads the source so a new spawn cannot forget it; a child that must show a window says so in a comment
// on the same line (`// window wanted`).
const SRC = path.resolve(import.meta.dirname, '..', '..', 'src');
const files = (dir: string): string[] => readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? files(path.join(dir, e.name)) : e.name.endsWith('.ts') ? [path.join(dir, e.name)] : []));

/** The argument text of a call, from its opening parenthesis to the matching one. */
function callArgs(text: string, open: number): string {
  let depth = 0;
  for (let i = open; i < text.length; i++) {
    const ch = text[i];
    if (ch === '(' || ch === '[' || ch === '{') depth++;
    else if (ch === ')' || ch === ']' || ch === '}') { depth--; if (depth === 0) return text.slice(open, i + 1); }
  }
  return text.slice(open);
}

test('every child process the plugin spawns is created with windowsHide: true', () => {
  const misses: string[] = [];
  for (const file of files(SRC)) {
    const text = readFileSync(file, 'utf8');
    const re = /(?<![.\w])(spawn|spawnSync|exec|execSync|execFile|execFileSync|fork)\(/g; // bare calls only: `re.exec(` and `db.sql.exec(` are not processes
    for (let m = re.exec(text); m; m = re.exec(text)) {
      const lineStart = text.lastIndexOf('\n', m.index) + 1, lineEnd = text.indexOf('\n', m.index);
      const line = text.slice(lineStart, lineEnd < 0 ? undefined : lineEnd);
      if (/^\s*(\/\/|\*|import )/.test(line) || line.includes('window wanted')) continue;
      const args = callArgs(text, m.index + m[0].length - 1);
      if (!args.includes('windowsHide: true')) misses.push(`${path.relative(SRC, file)}:${text.slice(0, m.index).split('\n').length} ${m[1]}(…)`);
    }
  }
  assert.deepEqual(misses, [], 'spawns without windowsHide');
});
