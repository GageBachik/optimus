import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, realpathSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
process.env.OPTIMUS_HOME = mkdtempSync(path.join(tmpdir(), 'pm-')); process.env.OPTIMUS_BANK = mkdtempSync(path.join(tmpdir(), 'bank-'));
const { openDb, getNote, getAttrs } = await import('../../src/kb/db.js');
const { importSerena, importClaudeMemory, importCodexMemory } = await import('../../src/kb/import.js');
const { parseNoteFile } = await import('../../src/kb/export.js');
const { installTemplate } = await import('../../src/kb/templates.js');
const { loadTemplate } = await import('../../src/kb/templates-yaml.js');
const { projectMove } = await import('../../src/cli/init.js');
const bank = process.env.OPTIMUS_BANK!;
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

  assert.deepEqual(importSerena(db, bank, [root], home), { files: 2, created: 2, unchanged: 0, moved: 0 });
  const s = db.sql.prepare("SELECT n.id FROM note n JOIN attr a ON a.note_id=n.id WHERE a.key='memory_name' AND a.value='core/architecture'").get() as { id: string };
  assert.match(s.id, /^e_[0-9a-f]{16}$/);
  const sn = getNote(db, s.id)!;
  assert.equal(sn.kind, 'evidence'); assert.equal(sn.project, 'demo'); assert.equal(sn.body, serenaText);
  const sa = getAttrs(db, s.id);
  assert.deepEqual(sa.origin, ['serena']); assert.deepEqual(sa.source_path, [serenaFile]); assert.equal(sa.sha256[0].slice(0, 16), s.id.slice(2));
  assert.equal((db.sql.prepare("SELECT COUNT(*) AS n FROM rel").get() as { n: number }).n, 0, 'no edges inferred from mem: references');
  assert.ok(existsSync(path.join(bank, 'notes', 'evidence', `${s.id}.md`)), 'the note file is exported');

  assert.deepEqual(importClaudeMemory(db, bank, home), { files: 1, created: 1, unchanged: 0, moved: 0 });
  const c = db.sql.prepare("SELECT note_id FROM attr WHERE key='origin' AND value='claude-memory'").get() as { note_id: string };
  assert.match(c.note_id, /^e_[0-9a-f]{16}$/);
  const cn = getNote(db, c.note_id)!, ca = getAttrs(db, c.note_id);
  assert.equal(cn.project, 'demo'); assert.equal(cn.title, 'Prefer small diffs'); assert.equal(cn.body, memText);
  assert.deepEqual(ca.origin_type, ['feedback']); assert.deepEqual(ca.source_dir, [projDir]); assert.deepEqual(ca.source_path, [path.join(projDir, 'memory', 'small-diffs.md')]);

  const before = snapshot(bank);
  assert.deepEqual(importSerena(db, bank, [root], home), { files: 2, created: 0, unchanged: 2, moved: 0 });
  assert.deepEqual(importClaudeMemory(db, bank, home), { files: 1, created: 0, unchanged: 1, moved: 0 });
  assert.deepEqual(snapshot(bank), before, 'a rerun leaves every bank file byte-identical');
  assert.equal(readFileSync(serenaFile, 'utf8'), serenaText); assert.equal(readFileSync(path.join(projDir, 'memory', 'small-diffs.md'), 'utf8'), memText);
});

test('auto-memory project without a transcript: the dashed directory name is resolved against the disk, else kept as is', () => {
  const home = mkdtempSync(path.join(tmpdir(), 'home-')), repo = realpathSync.native(mkdtempSync(path.join(tmpdir(), 'my-repo.x-'))); // the long path: Claude Code encodes process.cwd(), never an 8.3 short name
  put(path.join(home, '.claude', 'projects', repo.replace(/[^A-Za-z0-9]/g, '-'), 'memory', 'a.md'), 'no frontmatter\n');
  put(path.join(home, '.claude', 'projects', '-no-such-place-here', 'memory', 'b.md'), '---\nname: B\ntype: project\n---\nold-style type key\n');
  const db = openDb(path.join(process.env.OPTIMUS_HOME!, 'b.sqlite'));
  assert.deepEqual(importClaudeMemory(db, bank, home), { files: 2, created: 2, unchanged: 0, moved: 0 });
  const rows = db.sql.prepare("SELECT n.project, n.title, (SELECT value FROM attr WHERE note_id=n.id AND key='origin_type') AS t FROM note n ORDER BY n.title").all() as any[];
  assert.deepEqual(rows.map((r) => ({ ...r })), [{ project: '-no-such-place-here', title: 'B', t: 'project' }, { project: path.basename(repo), title: 'a', t: null }]);
});

test('copies of a project\'s Serena memories (a git worktree, an archived tree) are imported once, under the repository, shallowest path first', () => {
  const root = mkdtempSync(path.join(tmpdir(), 'root-')), home = mkdtempSync(path.join(tmpdir(), 'home-'));
  const repo = path.join(root, 'repo'); mkdirSync(path.join(repo, '.git'), { recursive: true }); // a repository root
  put(path.join(repo, '.serena', 'memories', 'a.md'), 'v1\n'); put(path.join(repo, '.serena', 'memories', 'c.md'), 'c v2\n');
  const wt = path.join(repo, '.claude', 'worktrees', 'wt'); put(path.join(wt, '.git'), `gitdir: ${path.join(repo, '.git', 'worktrees', 'wt')}\n`); // a linked worktree: .git is a file
  put(path.join(wt, '.serena', 'memories', 'a.md'), 'v1\n'); put(path.join(wt, '.serena', 'memories', 'b.md'), 'only in the worktree\n');
  const snap = path.join(repo, 'out', 'archive', 'run1'); put(path.join(snap, '.serena', 'memories', 'a.md'), 'v1\n'); put(path.join(snap, '.serena', 'memories', 'c.md'), 'c v1\n'); // an archived tree inside the repo, no .git
  const db = openDb(path.join(process.env.OPTIMUS_HOME!, 'c.sqlite'));
  assert.deepEqual(importSerena(db, bank, [root], home), { files: 6, created: 4, unchanged: 2, moved: 0 }); // a once, b, c v2, c v1
  const rows = db.sql.prepare("SELECT n.project, n.title, n.body, (SELECT value FROM attr WHERE note_id=n.id AND key='source_path') AS src FROM note n ORDER BY n.title, n.body").all() as any[];
  assert.deepEqual(rows.map((r) => [r.project, r.title, r.body]), [['repo', 'a', 'v1\n'], ['repo', 'b', 'only in the worktree\n'], ['repo', 'c', 'c v1\n'], ['repo', 'c', 'c v2\n']]);
  assert.equal(rows[0].src, path.join(repo, '.serena', 'memories', 'a.md'), 'the repository\'s own copy owns the note, not the worktree that readdir lists first');
});

test('auto-memory: the home directory and a scratch folder under a hidden directory are no project; a subfolder of a repository belongs to the repository', () => {
  const home = realpathSync.native(mkdtempSync(path.join(tmpdir(), 'home-'))), repo = path.join(home, 'projects', 'repo'); mkdirSync(path.join(repo, '.git'), { recursive: true });
  const proj = (cwd: string, name: string) => { const d = path.join(home, '.claude', 'projects', cwd.replace(/[^A-Za-z0-9]/g, '-')); put(path.join(d, 'memory', `${name}.md`), `${name}\n`); put(path.join(d, 't.jsonl'), JSON.stringify({ type: 'user', cwd }) + '\n'); };
  proj(home, 'h'); proj(path.join(repo, 'research', 'run'), 'r'); proj(path.join(home, '.t3', 'scratch', '2026-10-19-watch-a-video'), 's'); // a chat scratch folder under a hidden directory
  const db = openDb(path.join(process.env.OPTIMUS_HOME!, 'd.sqlite'));
  assert.deepEqual(importClaudeMemory(db, bank, home), { files: 3, created: 3, unchanged: 0, moved: 0 });
  assert.deepEqual((db.sql.prepare('SELECT project, title FROM note ORDER BY title').all() as any[]).map((r) => [r.project, r.title]), [[null, 'h'], ['repo', 'r'], [null, 's']]);
});

test('Codex memories: rollout summaries (project from their cwd), ad-hoc notes and the memory summary become evidence notes; derived files are skipped', () => {
  const home = mkdtempSync(path.join(tmpdir(), 'home-')), repo = path.join(home, 'projects', 'repo'), mem = path.join(home, '.codex', 'memories');
  put(path.join(repo, '.kb.json'), JSON.stringify({ project_id: 'demo', domain: 'trading' }));
  put(path.join(mem, 'rollout_summaries', '2026-09-07T13-35-45-muog-bridge.md'), `thread_id: 01a0-thread\nupdated_at: 2026-09-04T17:35:47+00:00\nrollout_path: x\ncwd: \\\\?\\${repo}\n\n# The bridge was integrated\n\nBody.\n`);
  put(path.join(mem, 'rollout_summaries', '2026-09-27T04-25-28-T3yv-leverage.md'), `thread_id: t2\ncwd: ${path.join(home, 'Documents', 'Codex', '2026-09-27', 't')}\n\n# Leverage research\n`);
  put(path.join(mem, 'extensions', 'ad_hoc', 'notes', '2026-09-07T234251Z-digest.md'), '# Weekly digest checkpoint\n\nProject: `' + repo + '`. Source task: x.\n');
  put(path.join(mem, 'extensions', 'ad_hoc', 'instructions.md'), 'not a memory\n');
  put(path.join(mem, 'memory_summary.md'), 'v1\n\n## User Profile\n');
  put(path.join(mem, 'raw_memories.md'), '# Raw Memories\n'); put(path.join(mem, 'MEMORY.md'), '# Task Group\n'); put(path.join(mem, 'phase2_workspace_diff.md'), '# diff\n'); put(path.join(mem, 'skills', 's', 'SKILL.md'), '---\nname: s\n---\n');
  const db = openDb(path.join(process.env.OPTIMUS_HOME!, 'e.sqlite'));
  assert.deepEqual(importCodexMemory(db, bank, home), { files: 4, created: 4, unchanged: 0, moved: 0 });
  const rows = db.sql.prepare("SELECT n.project, n.domain, n.title, (SELECT value FROM attr WHERE note_id=n.id AND key='memory_name') AS name, (SELECT value FROM attr WHERE note_id=n.id AND key='thread_id') AS thread FROM note n ORDER BY n.title").all() as any[];
  assert.deepEqual(rows.map((r) => ({ ...r })), [
    { project: null, domain: null, title: 'Leverage research', name: 'rollout_summaries/2026-09-27T04-25-28-T3yv-leverage', thread: 't2' },
    { project: 'demo', domain: 'trading', title: 'The bridge was integrated', name: 'rollout_summaries/2026-09-07T13-35-45-muog-bridge', thread: '01a0-thread' },
    { project: 'demo', domain: 'trading', title: 'Weekly digest checkpoint', name: 'ad_hoc/2026-09-07T234251Z-digest', thread: null },
    { project: null, domain: null, title: 'memory_summary', name: 'memory_summary', thread: null },
  ]);
  const bridge = (db.sql.prepare("SELECT id FROM note WHERE title='The bridge was integrated'").get() as any).id, ba = getAttrs(db, bridge);
  assert.deepEqual(ba.origin, ['codex']); assert.deepEqual(ba.cwd, [repo]);
  assert.deepEqual(importCodexMemory(db, bank, home), { files: 4, created: 0, unchanged: 4, moved: 0 });
});

test('a workspace root directly under the home (~/projects, Desktop, …) is no project, like the home: its Serena memories and the auto-memory of sessions started there carry none', () => {
  const home = realpathSync.native(mkdtempSync(path.join(tmpdir(), 'home-'))), projects = path.join(home, 'projects'), repo = path.join(projects, 'repo');
  mkdirSync(path.join(repo, '.git'), { recursive: true });
  put(path.join(projects, '.serena', 'memories', 'w.md'), 'a note about the whole workspace\n'); put(path.join(repo, '.serena', 'memories', 'r.md'), 'a repo note\n');
  put(path.join(home, 'Desktop', '.serena', 'memories', 'd.md'), 'a desktop note\n');
  const projDir = path.join(home, '.claude', 'projects', projects.replace(/[^A-Za-z0-9]/g, '-')); // a session started in ~/projects
  put(path.join(projDir, 'memory', 'm.md'), 'auto-memory of a session started in the workspace root\n'); put(path.join(projDir, 't.jsonl'), JSON.stringify({ type: 'user', cwd: projects }) + '\n');
  const db = openDb(path.join(process.env.OPTIMUS_HOME!, 'f.sqlite'));
  assert.deepEqual(importSerena(db, bank, [projects, path.join(home, 'Desktop')], home), { files: 3, created: 3, unchanged: 0, moved: 0 });
  assert.deepEqual(importClaudeMemory(db, bank, home), { files: 1, created: 1, unchanged: 0, moved: 0 });
  assert.deepEqual((db.sql.prepare('SELECT project, title FROM note ORDER BY title').all() as any[]).map((r) => [r.project, r.title]), [[null, 'd'], [null, 'm'], ['repo', 'r'], [null, 'w']]);
});

test('re-import after the attribution changed (a .kb.json appeared) moves the existing note: project and domain updated, re-exported, counted as moved', () => {
  const root = mkdtempSync(path.join(tmpdir(), 'root-')), home = mkdtempSync(path.join(tmpdir(), 'home-')), repo = path.join(root, 'repo'), t0 = '2026-10-24T00:00:00Z', t1 = '2026-10-24T01:00:00Z';
  mkdirSync(path.join(repo, '.git'), { recursive: true }); put(path.join(repo, '.serena', 'memories', 'm.md'), 'a memory\n');
  const db = openDb(path.join(process.env.OPTIMUS_HOME!, 'g.sqlite'));
  assert.deepEqual(importSerena(db, bank, [root], home, t0), { files: 1, created: 1, unchanged: 0, moved: 0 });
  const id = (db.sql.prepare('SELECT id FROM note').get() as { id: string }).id;
  assert.deepEqual([getNote(db, id)!.project, getNote(db, id)!.domain], ['repo', null], 'filed under the repository directory at first');
  put(path.join(repo, '.kb.json'), JSON.stringify({ project_id: 'demo', domain: 'trading' }));
  assert.deepEqual(importSerena(db, bank, [root], home, t1), { files: 1, created: 0, unchanged: 0, moved: 1 });
  const n = getNote(db, id)!; assert.equal(n.project, 'demo'); assert.equal(n.domain, 'trading'); assert.equal(n.updated_at, t1); assert.equal(n.body, 'a memory\n'); assert.deepEqual(getAttrs(db, id).origin, ['serena']);
  const file = parseNoteFile(readFileSync(path.join(bank, 'notes', 'evidence', `${id}.md`), 'utf8')).note; assert.equal(file.project, 'demo'); assert.equal(file.domain, 'trading');
});

test('a true re-import (same files, same attribution) reports unchanged, moves nothing and rewrites no bank file', () => {
  const root = mkdtempSync(path.join(tmpdir(), 'root-')), home = mkdtempSync(path.join(tmpdir(), 'home-')), repo = path.join(root, 'repo');
  put(path.join(repo, '.kb.json'), JSON.stringify({ project_id: 'demo', domain: 'trading' })); put(path.join(repo, '.serena', 'memories', 'm.md'), 'a memory\n');
  const db = openDb(path.join(process.env.OPTIMUS_HOME!, 'h.sqlite'));
  importSerena(db, bank, [root], home, '2026-10-24T00:00:00Z');
  const before = snapshot(bank), row = { ...(db.sql.prepare('SELECT project, domain, updated_at FROM note').get() as object) };
  assert.deepEqual(importSerena(db, bank, [root], home, '2026-10-24T01:00:00Z'), { files: 1, created: 0, unchanged: 1, moved: 0 });
  assert.deepEqual(snapshot(bank), before); assert.deepEqual({ ...(db.sql.prepare('SELECT project, domain, updated_at FROM note').get() as object) }, row);
});

test('a computed domain of null never undoes one set by hand: after kb project move, re-importing a repository without .kb.json keeps the domain', () => {
  const root = mkdtempSync(path.join(tmpdir(), 'root-')), home = mkdtempSync(path.join(tmpdir(), 'home-')), repo = path.join(root, 'repo'), t1 = '2026-10-24T01:00:00Z';
  mkdirSync(path.join(repo, '.git'), { recursive: true }); put(path.join(repo, '.serena', 'memories', 'm.md'), 'a memory\n');
  const db = openDb(path.join(process.env.OPTIMUS_HOME!, 'i.sqlite')); installTemplate(db, loadTemplate('templates/trading.yaml'));
  importSerena(db, bank, [root], home, '2026-10-24T00:00:00Z');
  assert.equal(projectMove(db, bank, root, { domain: 'trading', id: 'repo' }, t1).total, 1); // from a folder with no .kb.json, by id
  assert.deepEqual(importSerena(db, bank, [root], home, '2026-10-24T02:00:00Z'), { files: 1, created: 0, unchanged: 1, moved: 0 });
  const n = db.sql.prepare("SELECT project, domain, updated_at FROM note WHERE kind='evidence'").get() as any; assert.equal(n.project, 'repo'); assert.equal(n.domain, 'trading'); assert.equal(n.updated_at, t1);
});

test('two repositories holding the same memory text: the first in walk order owns the note and the later copy never moves it, on this run or the next', () => {
  const root = mkdtempSync(path.join(tmpdir(), 'root-')), home = mkdtempSync(path.join(tmpdir(), 'home-'));
  for (const r of ['a', 'b']) { mkdirSync(path.join(root, r, '.git'), { recursive: true }); put(path.join(root, r, '.serena', 'memories', 'm.md'), 'the same text in two repositories\n'); }
  const db = openDb(path.join(process.env.OPTIMUS_HOME!, 'j.sqlite')), owner = () => (db.sql.prepare('SELECT project FROM note').get() as any).project;
  assert.deepEqual(importSerena(db, bank, [root], home), { files: 2, created: 1, unchanged: 1, moved: 0 }); assert.equal(owner(), 'a');
  assert.deepEqual(importSerena(db, bank, [root], home), { files: 2, created: 0, unchanged: 2, moved: 0 }); assert.equal(owner(), 'a');
});

test('only the recorded source re-attributes a note: a copy of the old text in a snapshot folder, after the original changed, moves nothing', () => {
  const root = mkdtempSync(path.join(tmpdir(), 'root-')), home = mkdtempSync(path.join(tmpdir(), 'home-')), repo = path.join(root, 'a');
  mkdirSync(path.join(repo, '.git'), { recursive: true }); put(path.join(repo, '.serena', 'memories', 'm.md'), 'the memory, first version\n');
  const db = openDb(path.join(process.env.OPTIMUS_HOME!, 'k.sqlite'));
  assert.deepEqual(importSerena(db, bank, [root], home), { files: 1, created: 1, unchanged: 0, moved: 0 });
  const id = (db.sql.prepare('SELECT id FROM note').get() as { id: string }).id;
  put(path.join(repo, '.serena', 'memories', 'm.md'), 'the memory, revised\n'); // the original moves on …
  put(path.join(root, 'snap', 'src', '.serena', 'memories', 'm.md'), 'the memory, first version\n'); // … and a snapshot (no .git) keeps the old text
  assert.deepEqual(importSerena(db, bank, [root], home), { files: 2, created: 1, unchanged: 1, moved: 0 });
  assert.equal(getNote(db, id)!.project, 'a', 'the old revision stays with the repository, not the snapshot folder "src"');
  assert.deepEqual((db.sql.prepare('SELECT project FROM note ORDER BY id').all() as any[]).map((r) => r.project), ['a', 'a']);
});

test('the same text as a Serena memory of one repository and an auto-memory of a session in another: whichever importer runs second leaves the note where the first filed it', () => {
  const root = realpathSync.native(mkdtempSync(path.join(tmpdir(), 'root-'))), home = mkdtempSync(path.join(tmpdir(), 'home-')), text = 'carry rule: hold to settlement\n';
  for (const r of ['odds', 'backtester']) mkdirSync(path.join(root, r, '.git'), { recursive: true });
  put(path.join(root, 'odds', '.serena', 'memories', 'carry.md'), text);
  const projDir = path.join(home, '.claude', 'projects', path.join(root, 'backtester').replace(/[^A-Za-z0-9]/g, '-'));
  put(path.join(projDir, 'memory', 'carry.md'), text); put(path.join(projDir, 't.jsonl'), JSON.stringify({ type: 'user', cwd: path.join(root, 'backtester') }) + '\n');
  const db = openDb(path.join(process.env.OPTIMUS_HOME!, 'l.sqlite')), owner = () => (db.sql.prepare('SELECT project FROM note').get() as any).project;
  assert.deepEqual(importSerena(db, bank, [root], home), { files: 1, created: 1, unchanged: 0, moved: 0 }); assert.equal(owner(), 'odds');
  assert.deepEqual(importClaudeMemory(db, bank, home), { files: 1, created: 0, unchanged: 1, moved: 0 }); assert.equal(owner(), 'odds');
  assert.deepEqual(importSerena(db, bank, [root], home), { files: 1, created: 0, unchanged: 1, moved: 0 }); assert.equal(owner(), 'odds');
});

test('a walk from the home skips its application-data folders (AppData, Library) and still reaches a project at the top level of the home', () => {
  const home = mkdtempSync(path.join(tmpdir(), 'home-'));
  put(path.join(home, 'AppData', 'Local', 'Temp', 'root-x', 'repo', '.serena', 'memories', 'fixture.md'), 'a test fixture\n');
  put(path.join(home, 'Library', 'Caches', 'tool', '.serena', 'memories', 'cache.md'), 'a cached copy\n');
  mkdirSync(path.join(home, 'odds', '.git'), { recursive: true }); put(path.join(home, 'odds', '.serena', 'memories', 'o.md'), 'an odds memory\n');
  const db = openDb(path.join(process.env.OPTIMUS_HOME!, 'm.sqlite'));
  assert.deepEqual(importSerena(db, bank, [home], home), { files: 1, created: 1, unchanged: 0, moved: 0 });
  assert.deepEqual((db.sql.prepare('SELECT project, title FROM note').all() as any[]).map((r) => [r.project, r.title]), [['odds', 'o']]);
});

test('a Serena memory inside a Codex workspace (~/Documents/Codex/<date>/<letter>) has no project, as the Codex importer already ruled for its cwd', () => {
  const home = mkdtempSync(path.join(tmpdir(), 'home-')), ws = path.join(home, 'Documents', 'Codex', '2026-09-27', 't');
  put(path.join(ws, '.serena', 'memories', 'research', 'leaps.md'), 'research handoff\n');
  put(path.join(home, 'Documents', 'thesis', '.serena', 'memories', 'n.md'), 'a Documents project of its own\n');
  const db = openDb(path.join(process.env.OPTIMUS_HOME!, 'n.sqlite'));
  assert.deepEqual(importSerena(db, bank, [home], home), { files: 2, created: 2, unchanged: 0, moved: 0 });
  assert.deepEqual((db.sql.prepare('SELECT project, title FROM note ORDER BY title').all() as any[]).map((r) => [r.project, r.title]), [['thesis', 'n'], [null, 'research/leaps']]);
});
