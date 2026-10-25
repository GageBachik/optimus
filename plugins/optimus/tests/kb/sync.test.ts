import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, existsSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { execSync } from 'node:child_process';
process.env.OPTIMUS_HOME = mkdtempSync(path.join(tmpdir(), 'pm-'));
const { sync } = await import('../../src/kb/sync.js');
const { openDb, getNote } = await import('../../src/kb/db.js');
const { sessionSync } = await import('../../src/hooks/session-sync.js');
const { withoutGitIdentity } = await import('../fixtures/git-identity.js');
const sh = (cmd: string, cwd: string) => execSync(cmd, { cwd, stdio: 'pipe' }).toString();
const note = (body: string) => `---\nid: f_t\nkind: finding\ntitle: T\ncreated_at: 2026-01-01T00:00:00.000Z\nupdated_at: 2026-01-01T00:00:00.000Z\ndevice_id: t\n---\n${body}`;
const putNote = (bank: string, body: string) => { mkdirSync(path.join(bank, 'notes', 'finding'), { recursive: true }); writeFileSync(path.join(bank, 'notes', 'finding', 'f_t.md'), note(body)); };
test('two clones sync different notes cleanly; a rebase conflict aborts and is logged; the doctor\'s recovery path re-indexes the resolved note (review focus 2)', () => {
  const root = mkdtempSync(path.join(tmpdir(), 'git-')); const bare = path.join(root, 'bank.git'); sh(`git init -q --bare ${bare}`, root);
  const a = path.join(root, 'a'), b = path.join(root, 'b'); sh(`git clone -q ${bare} a && git clone -q ${bare} b`, root);
  for (const c of [a, b]) { sh('git config user.email t@t && git config user.name t && git config core.autocrlf false', c); }
  putNote(a, 'one\n'); assert.equal(sync(a), 'ok');
  writeFileSync(path.join(b, 'n2.md'), 'two\n'); assert.equal(sync(b), 'ok'); assert.ok(existsSync(path.join(b, 'notes', 'finding', 'f_t.md')));
  assert.equal(sync(a), 'ok'); assert.ok(existsSync(path.join(a, 'n2.md')));
  putNote(a, 'A\n'); assert.equal(sync(a), 'ok');
  putNote(b, 'B\n'); assert.equal(sync(b), 'failed');
  assert.equal(readFileSync(path.join(b, 'notes', 'finding', 'f_t.md'), 'utf8'), note('B\n')); // local commit intact
  assert.ok(sh('git status --porcelain', b).trim() === '', 'rebase aborted cleanly');
  const hl = readFileSync(path.join(process.env.OPTIMUS_HOME!, 'logs', 'hooks.log'), 'utf8'); assert.match(hl, /rebase conflict/); assert.match(hl, /"msg":"sync: ok"/, 'a clean sync leaves a line too');
  // `kb doctor`: "resolve with git in <bank>, then kb sync". The hand resolution moves HEAD before the next sync starts; that sync must still re-index what it pulled in.
  sh('git pull --rebase -q || true', b); assert.ok(existsSync(path.join(b, '.git', 'rebase-merge')), 'the hand pull stops on the conflict');
  putNote(b, 'R\n'); sh('git add -A && git -c core.editor=true rebase --continue', b);
  assert.equal(sync(b), 'ok');
  const db = openDb(); try { assert.equal(getNote(db, 'f_t')?.body, 'R\n', 'the resolved note is in the index after the sync that pushed it'); } finally { db.sql.close(); }
  assert.equal(sync(a), 'ok'); assert.equal(readFileSync(path.join(a, 'notes', 'finding', 'f_t.md'), 'utf8'), note('R\n'));
});
test('session-sync spawns a detached `kb sync` that commits and pushes the bank (DESIGN §3.1 async hook)', async () => {
  const root = mkdtempSync(path.join(tmpdir(), 'git-')); const bare = path.join(root, 'bank.git'); sh(`git init -q --bare ${bare}`, root);
  const c = path.join(root, 'c'); sh(`git clone -q ${bare} c`, root); sh('git config user.email t@t && git config user.name t && git config core.autocrlf false', c);
  writeFileSync(path.join(c, 'n.md'), 'n\n'); process.env.OPTIMUS_BANK = c;
  await sessionSync({});
  const pushed = () => sh('git rev-list --all --count', bare).trim();
  for (let i = 0; i < 600 && pushed() === '0'; i++) /* 60 s: a loaded machine (parallel test files, a concurrent import) failed 15 s twice on 2026-10-24 */ await new Promise((r) => setTimeout(r, 100));
  assert.equal(pushed(), '1');
  assert.ok(JSON.parse(readFileSync(path.join(process.env.OPTIMUS_HOME!, 'config.json'), 'utf8')).lastSyncAt);
});
test('sync commits and rebases on a machine with no git identity (fallback identity, not `failed (git commit failed)` every minute)', () => withoutGitIdentity(() => {
  const root = mkdtempSync(path.join(tmpdir(), 'git-')); const bare = path.join(root, 'bank.git'); sh(`git init -q --bare ${bare}`, root);
  const a = path.join(root, 'a'), b = path.join(root, 'b'); sh(`git clone -q ${bare} a && git clone -q ${bare} b`, root);
  writeFileSync(path.join(a, 'n1.md'), 'one\n'); assert.equal(sync(a), 'ok');
  writeFileSync(path.join(b, 'n2.md'), 'two\n'); assert.equal(sync(b), 'ok'); // rebase onto a's commit needs a committer identity too
  assert.equal(sh('git rev-list --all --count', bare).trim(), '2');
}));

test('sync settles an add/add conflict on an identical concept note created on both machines (remote copy kept) and still aborts when the two copies differ', () => {
  const root = mkdtempSync(path.join(tmpdir(), 'git-')); const bare = path.join(root, 'bank.git'); sh(`git init -q --bare ${bare}`, root);
  const a = path.join(root, 'a'), b = path.join(root, 'b'); sh(`git clone -q ${bare} a && git clone -q ${bare} b`, root);
  for (const c of [a, b]) sh('git config user.email t@t && git config user.name t && git config core.autocrlf false', c);
  const concept = (dev: string, at: string, attrs = 'attrs: {}') => `---\n${attrs}\ncreated_at: ${at}\ndevice_id: ${dev}\ndomain: null\nid: c_drawdown000000000000000000\nkind: concept\nproject: null\nrels: []\ntitle: drawdown\nupdated_at: ${at}\n---\n`;
  const put = (bank: string, text: string) => { mkdirSync(path.join(bank, 'notes', 'concept'), { recursive: true }); writeFileSync(path.join(bank, 'notes', 'concept', 'c_drawdown000000000000000000.md'), text); };
  const mac = concept('mac', '2026-10-25T02:54:50.845Z');
  put(a, mac); assert.equal(sync(a), 'ok');
  put(b, concept('pc', '2026-10-25T03:47:04.651Z')); assert.equal(sync(b), 'ok', 'identical apart from timestamps and device: settled, not failed');
  assert.equal(readFileSync(path.join(b, 'notes', 'concept', 'c_drawdown000000000000000000.md'), 'utf8'), mac, 'the remote copy is kept');
  assert.equal(sh('git rev-list --all --count', bare).trim(), '1', 'b\'s commit became empty once the remote copy was kept, so git dropped it; nothing was lost');
  assert.equal(sh('git rev-parse HEAD', b).trim(), sh('git rev-parse HEAD', a).trim());
  assert.match(readFileSync(path.join(process.env.OPTIMUS_HOME!, 'logs', 'hooks.log'), 'utf8'), /settled identical concept notes/);
  // copies that differ in substance (an alias each) are a conflict for a person
  put(a, concept('mac', '2026-10-25T02:54:50.845Z', 'attrs:\n  alias: dd')); assert.equal(sync(a), 'ok');
  put(b, concept('pc', '2026-10-25T03:47:04.651Z', 'attrs:\n  alias: max dd')); assert.equal(sync(b), 'failed');
  assert.ok(!existsSync(path.join(b, '.git', 'rebase-merge')), 'the rebase was aborted, the local commit stays');
});
