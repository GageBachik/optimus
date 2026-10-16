import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
process.env.PROJECT_MEMORY_HOME = mkdtempSync(path.join(tmpdir(), 'pm-')); process.env.PROJECT_MEMORY_BANK = mkdtempSync(path.join(tmpdir(), 'bank-'));
const { openDb, getNote, getAttrs } = await import('../../src/kb/db.js');
const { importSerena, importClaudeMemory } = await import('../../src/kb/import.js');
const bank = process.env.PROJECT_MEMORY_BANK!;
const snapshot = (dir: string) => Object.fromEntries((readdirSync(dir, { recursive: true }) as string[]).sort().filter((f) => !f.startsWith('.git')).map((f) => { try { return [f, readFileSync(path.join(dir, f), 'utf8')]; } catch { return [f, null]; } }));
const put = (file: string, text: string) => { mkdirSync(path.dirname(file), { recursive: true }); writeFileSync(file, text); };

test('Serena and auto-memory files become evidence notes: content-hash ids, project from .kb.json, idempotent, originals untouched', () => {
  const root = mkdtempSync(path.join(tmpdir(), 'root-')), home = mkdtempSync(path.join(tmpdir(), 'home-'));
  const repo = path.join(root, 'some-dir', 'repo-on-disk');
  put(path.join(repo, '.kb.json'), JSON.stringify({ project_id: 'demo', domain: 'trading' }));
  const serenaFile = path.join(repo, '.serena', 'memories', 'core', 'architecture.md'), serenaText = '# Architecture\n\nSee mem:core/other for more.\r\n';
  put(serenaFile, serenaText);
  put(path.join(root, 'node_modules', 'pkg', '.serena', 'memories', 'skip.md'), 'never imported');
  put(path.join(home, '.serena', 'memories', 'global', 'style.md'), 'global style note\n');
  const projDir = path.join(home, '.claude', 'projects', repo.replace(/[^A-Za-z0-9]/g, '-'));
  const memText = '---\nname: Prefer small diffs\ndescription: keep changes small\nmetadata:\n  type: feedback\n---\n\nSmall diffs review faster.\n';
  put(path.join(projDir, 'memory', 'small-diffs.md'), memText);
  put(path.join(projDir, 'memory', 'MEMORY.md'), '- [Prefer small diffs](small-diffs.md)\n');
  put(path.join(projDir, 'abc.jsonl'), JSON.stringify({ type: 'mode', mode: 'normal' }) + '\n' + JSON.stringify({ type: 'user', cwd: repo }) + '\n');
  const db = openDb();

  assert.deepEqual(importSerena(db, bank, [root], home), { files: 2, created: 2, unchanged: 0 });
  const s = db.sql.prepare("SELECT n.id FROM note n JOIN attr a ON a.note_id=n.id WHERE a.key='memory_name' AND a.value='core/architecture'").get() as { id: string };
  assert.match(s.id, /^e_[0-9a-f]{16}$/);
  const sn = getNote(db, s.id)!;
  assert.equal(sn.kind, 'evidence'); assert.equal(sn.project, 'demo'); assert.equal(sn.body, serenaText);
  const sa = getAttrs(db, s.id);
  assert.deepEqual(sa.origin, ['serena']); assert.deepEqual(sa.source_path, [serenaFile]); assert.equal(sa.sha256[0].slice(0, 16), s.id.slice(2));
  assert.equal((db.sql.prepare("SELECT COUNT(*) AS n FROM rel").get() as { n: number }).n, 0, 'no edges inferred from mem: references');
  assert.ok(existsSync(path.join(bank, 'notes', 'evidence', `${s.id}.md`)), 'the note file is exported');

  assert.deepEqual(importClaudeMemory(db, bank, home), { files: 1, created: 1, unchanged: 0 });
  const c = db.sql.prepare("SELECT note_id FROM attr WHERE key='origin' AND value='claude-memory'").get() as { note_id: string };
  assert.match(c.note_id, /^e_[0-9a-f]{16}$/);
  const cn = getNote(db, c.note_id)!, ca = getAttrs(db, c.note_id);
  assert.equal(cn.project, 'demo'); assert.equal(cn.title, 'Prefer small diffs'); assert.equal(cn.body, memText);
  assert.deepEqual(ca.origin_type, ['feedback']); assert.deepEqual(ca.source_dir, [projDir]); assert.deepEqual(ca.source_path, [path.join(projDir, 'memory', 'small-diffs.md')]);

  const before = snapshot(bank);
  assert.deepEqual(importSerena(db, bank, [root], home), { files: 2, created: 0, unchanged: 2 });
  assert.deepEqual(importClaudeMemory(db, bank, home), { files: 1, created: 0, unchanged: 1 });
  assert.deepEqual(snapshot(bank), before, 'a rerun leaves every bank file byte-identical');
  assert.equal(readFileSync(serenaFile, 'utf8'), serenaText); assert.equal(readFileSync(path.join(projDir, 'memory', 'small-diffs.md'), 'utf8'), memText);
});

test('auto-memory project without a transcript: the dashed directory name is resolved against the disk, else kept as is', () => {
  const home = mkdtempSync(path.join(tmpdir(), 'home-')), repo = mkdtempSync(path.join(tmpdir(), 'my-repo.x-'));
  put(path.join(home, '.claude', 'projects', repo.replace(/[^A-Za-z0-9]/g, '-'), 'memory', 'a.md'), 'no frontmatter\n');
  put(path.join(home, '.claude', 'projects', '-no-such-place-here', 'memory', 'b.md'), '---\nname: B\ntype: project\n---\nold-style type key\n');
  const db = openDb(path.join(process.env.PROJECT_MEMORY_HOME!, 'b.sqlite'));
  assert.deepEqual(importClaudeMemory(db, bank, home), { files: 2, created: 2, unchanged: 0 });
  const rows = db.sql.prepare("SELECT n.project, n.title, (SELECT value FROM attr WHERE note_id=n.id AND key='origin_type') AS t FROM note n ORDER BY n.title").all() as any[];
  assert.deepEqual(rows.map((r) => ({ ...r })), [{ project: '-no-such-place-here', title: 'B', t: 'project' }, { project: path.basename(repo), title: 'a', t: null }]);
});
