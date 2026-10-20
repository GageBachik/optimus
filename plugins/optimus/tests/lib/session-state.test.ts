import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
process.env.OPTIMUS_HOME = mkdtempSync(path.join(tmpdir(), 'pm-'));
const { loadState, saveState } = await import('../../src/lib/session-state.js');
const { writeFileAtomic } = await import('../../src/lib/atomic.js');
test('state defaults, round-trips per agent, survives corruption', () => {
  const s = loadState('s1'); assert.deepEqual(s.seenBlobs, [] as string[]);
  s.seenBlobs.push('abc'); saveState('s1', s);
  assert.deepEqual(loadState('s1').seenBlobs, ['abc']); assert.deepEqual(loadState('s1', 'a1').seenBlobs, []);
  writeFileSync(path.join(process.env.OPTIMUS_HOME!, 'sessions', 's1', 'main', 'state.json'), '{not json');
  assert.deepEqual(loadState('s1').seenBlobs, []);
});
test('writeFileAtomic writes LF content', () => { const f = path.join(mkdtempSync(path.join(tmpdir(), 'pm-')), 'x.txt'); writeFileAtomic(f, 'hello\n'); assert.equal(readFileSync(f, 'utf8'), 'hello\n'); });
test('deleteSession removes every agent of the session', async () => {
  const { deleteSession } = await import('../../src/lib/session-state.js');
  const { existsSync } = await import('node:fs');
  const s = loadState('s2'); s.seenBlobs.push('x'); saveState('s2', s); saveState('s2', s, 'a1');
  deleteSession('s2');
  assert.equal(existsSync(path.join(process.env.OPTIMUS_HOME!, 'sessions', 's2')), false);
});
