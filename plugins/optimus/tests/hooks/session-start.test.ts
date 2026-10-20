import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, mkdirSync, existsSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
process.env.OPTIMUS_HOME = mkdtempSync(path.join(tmpdir(), 'pm-'));
const { sessionStart } = await import('../../src/hooks/session-start.js');
test('resume/fork/subagent → nothing; compact → restore brief from task-state.json; startup → short card', async () => {
  assert.equal(await sessionStart({ session_id: 'x', source: 'resume', cwd: '/w/proj' }), undefined);
  assert.equal(await sessionStart({ session_id: 'x', source: 'fork', cwd: '/w/proj' }), undefined);
  assert.equal(await sessionStart({ session_id: 'x', source: 'compact', cwd: '/w/proj', agent_id: 'a1' }), undefined);
  const dir = path.join(process.env.OPTIMUS_HOME!, 'sessions', 'x', 'main'); mkdirSync(dir, { recursive: true });
  writeFileSync(path.join(dir, 'task-state.json'), JSON.stringify({ goalFirst: 'build it', goalLatest: 'test it', constraints: [], decisions: [], files: [], commands: [], tests: [], openItems: ['ship'], errors: [], exactValues: [], pointers: [] }));
  const c: any = await sessionStart({ session_id: 'x', source: 'compact', cwd: '/w/proj' });
  assert.equal(c.hookSpecificOutput.hookEventName, 'SessionStart'); assert.ok(c.hookSpecificOutput.additionalContext.includes('build it')); assert.ok(c.hookSpecificOutput.additionalContext.length <= 9000);
  const s: any = await sessionStart({ session_id: 'y', source: 'startup', cwd: '/w/proj' }); assert.ok(s.hookSpecificOutput.additionalContext.includes('proj')); assert.ok(s.hookSpecificOutput.additionalContext.length < 500, 'short card (the runnable kb path is ~70 chars of it)');
});
test('startup in a project with a last-session record shows where it left off, with no command (DESIGN §3.11)', async () => {
  const { paths } = await import('../../src/lib/paths.js');
  const dir = paths.projectDir(paths.projectKey('/w/proj2'));
  writeFileSync(path.join(dir, 'last-session.json'), JSON.stringify({ at: '2026-10-16T18:40:00Z', sessionId: 'old', cwd: '/w/proj2', taskState: { goalFirst: 'wire the offload hook', goalLatest: 'fix the tail test', constraints: [], decisions: ['Decision: threshold 20000'], files: [{ path: '/w/proj2/src/offload.ts', action: 'Edit', at: '' }], commands: [], tests: [], openItems: ['run the live test'], errors: [], exactValues: [], pointers: [] } }));
  const s: any = await sessionStart({ session_id: 'z', source: 'startup', cwd: '/w/proj2' });
  const t = s.hookSpecificOutput.additionalContext; assert.ok(t.includes('Last session in this project')); assert.ok(t.includes('2026-10-16')); assert.ok(t.includes('run the live test')); assert.ok(t.includes('offload.ts')); assert.ok(t.length <= 9000);
});
test('postCompact writes audit.json for the main agent only; the compact brief then re-injects the omissions (DESIGN §3.5)', async () => {
  const { postCompact } = await import('../../src/hooks/post-compact.js');
  const auditPath = path.join(process.env.OPTIMUS_HOME!, 'sessions', 'x', 'main', 'audit.json');
  assert.equal(await postCompact({ session_id: 'x', cwd: '/w/proj', compact_summary: 'We decided to build it.', agent_id: 'a2' }), undefined);
  assert.ok(!existsSync(auditPath));
  assert.equal(await postCompact({ session_id: 'x', cwd: '/w/proj', compact_summary: 'We decided to build it.' }), undefined);
  assert.deepEqual(JSON.parse(readFileSync(auditPath, 'utf8')).missing, ['ship']);
  const c: any = await sessionStart({ session_id: 'x', source: 'compact', cwd: '/w/proj' });
  const t = c.hookSpecificOutput.additionalContext; assert.ok(t.includes('## Omitted by compaction')); assert.ok(t.indexOf('## Open items') < t.indexOf('## Omitted by compaction'));
  // A second compaction whose PostCompact never writes (or runs after SessionStart) must not reuse the old audit.
  const { preCompact } = await import('../../src/hooks/pre-compact.js');
  await preCompact({ session_id: 'x', cwd: '/w/proj', transcript_path: path.join(import.meta.dirname, '..', 'fixtures', 'transcript-small.jsonl') });
  assert.ok(!existsSync(auditPath));
  const c2: any = await sessionStart({ session_id: 'x', source: 'compact', cwd: '/w/proj' });
  assert.ok(!c2.hookSpecificOutput.additionalContext.includes('## Omitted by compaction'));
});
