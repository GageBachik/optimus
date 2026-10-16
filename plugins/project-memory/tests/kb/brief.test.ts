import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
process.env.PROJECT_MEMORY_HOME = mkdtempSync(path.join(tmpdir(), 'pm-')); process.env.PROJECT_MEMORY_BANK = mkdtempSync(path.join(tmpdir(), 'bank-'));
const { openDb, upsertNote, setAttrs } = await import('../../src/kb/db.js');
const { buildProjectBrief } = await import('../../src/kb/brief.js');
type Db = ReturnType<typeof openDb>;
const cfg = { project_id: 'spy', domain: 'trading' };
/** An imported-memory evidence note; `i` orders updated_at so newest-first is observable. */
const memory = (db: Db, id: string, title: string, i: number, origin = 'serena') => {
  const at = `2026-10-${String(1 + Math.floor(i / 24)).padStart(2, '0')}T${String(i % 24).padStart(2, '0')}:00:00Z`;
  upsertNote(db, { id: `e_${id.padEnd(26, '0').slice(0, 26)}`, kind: 'evidence', domain: 'trading', project: 'spy', title, body: 'text', created_at: at, updated_at: at, deleted_at: null, device_id: 'mac' });
  setAttrs(db, `e_${id.padEnd(26, '0').slice(0, 26)}`, { origin });
};
test('cold start: imported memory titles plus the kb_find call that opens them, no findings needed (DESIGN §3.11 layer 2)', () => {
  const db = openDb();
  memory(db, 'overview', 'project_overview', 0); memory(db, 'commands', 'suggested_commands', 1);
  memory(db, 'kbwrite', 'commit: abc123', 2, 'commit'); // kb_write evidence is not an imported memory
  const t = buildProjectBrief(db, cfg, []);
  assert.ok(t.includes('## Imported memories for this project'), t); assert.ok(t.includes('- project_overview')); assert.ok(t.includes('- suggested_commands'));
  assert.ok(t.includes('kb_find({ project: "spy", kind: "evidence"')); assert.ok(!t.includes('commit: abc123')); assert.ok(!t.includes('## Relevant findings'));
  assert.ok(t.includes('## Project spy')); assert.ok(t.length <= 9000);
});
test('60 imported notes: at most 40 titles, newest first, under 9,000 chars', () => {
  const db = openDb(path.join(process.env.PROJECT_MEMORY_HOME!, 'b.sqlite'));
  for (let i = 0; i < 60; i++) memory(db, `m${i}`, `memory_${i}`, i);
  const lines = buildProjectBrief(db, cfg, []).split('\n'), titles = lines.filter((l) => /^- memory_\d+$/.test(l));
  assert.equal(titles.length, 40); assert.ok(titles.includes('- memory_59')); assert.ok(!titles.includes('- memory_19'));
  assert.ok(lines.join('\n').length <= 9000);
});
