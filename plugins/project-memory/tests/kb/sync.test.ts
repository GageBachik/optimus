import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, existsSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { execSync } from 'node:child_process';
process.env.PROJECT_MEMORY_HOME = mkdtempSync(path.join(tmpdir(), 'pm-'));
const { sync } = await import('../../src/kb/sync.js');
const { sessionSync } = await import('../../src/hooks/session-sync.js');
const { withoutGitIdentity } = await import('../fixtures/git-identity.js');
const sh = (cmd: string, cwd: string) => execSync(cmd, { cwd, stdio: 'pipe' }).toString();
test('two clones sync different notes cleanly; a rebase conflict aborts and is logged (review focus 2)', () => {
  const root = mkdtempSync(path.join(tmpdir(), 'git-')); const bare = path.join(root, 'bank.git'); sh(`git init -q --bare ${bare}`, root);
  const a = path.join(root, 'a'), b = path.join(root, 'b'); sh(`git clone -q ${bare} a && git clone -q ${bare} b`, root);
  for (const c of [a, b]) { sh('git config user.email t@t && git config user.name t', c); }
  writeFileSync(path.join(a, 'n1.md'), 'one\n'); assert.equal(sync(a), 'ok');
  writeFileSync(path.join(b, 'n2.md'), 'two\n'); assert.equal(sync(b), 'ok'); assert.ok(existsSync(path.join(b, 'n1.md')));
  assert.equal(sync(a), 'ok'); assert.ok(existsSync(path.join(a, 'n2.md')));
  writeFileSync(path.join(a, 'n1.md'), 'A\n'); assert.equal(sync(a), 'ok');
  writeFileSync(path.join(b, 'n1.md'), 'B\n'); assert.equal(sync(b), 'failed');
  assert.equal(readFileSync(path.join(b, 'n1.md'), 'utf8'), 'B\n'); // local commit intact
  assert.ok(sh('git status --porcelain', b).trim() === '', 'rebase aborted cleanly');
  assert.match(readFileSync(path.join(process.env.PROJECT_MEMORY_HOME!, 'logs', 'hooks.log'), 'utf8'), /rebase conflict/);
});
test('session-sync spawns a detached `kb sync` that commits and pushes the bank (DESIGN §3.1 async hook)', async () => {
  const root = mkdtempSync(path.join(tmpdir(), 'git-')); const bare = path.join(root, 'bank.git'); sh(`git init -q --bare ${bare}`, root);
  const c = path.join(root, 'c'); sh(`git clone -q ${bare} c`, root); sh('git config user.email t@t && git config user.name t', c);
  writeFileSync(path.join(c, 'n.md'), 'n\n'); process.env.PROJECT_MEMORY_BANK = c;
  await sessionSync({});
  const pushed = () => sh('git rev-list --all --count', bare).trim();
  for (let i = 0; i < 150 && pushed() === '0'; i++) await new Promise((r) => setTimeout(r, 100));
  assert.equal(pushed(), '1');
  assert.ok(JSON.parse(readFileSync(path.join(process.env.PROJECT_MEMORY_HOME!, 'config.json'), 'utf8')).lastSyncAt);
});
test('sync commits and rebases on a machine with no git identity (fallback identity, not `failed (git commit failed)` every minute)', () => withoutGitIdentity(() => {
  const root = mkdtempSync(path.join(tmpdir(), 'git-')); const bare = path.join(root, 'bank.git'); sh(`git init -q --bare ${bare}`, root);
  const a = path.join(root, 'a'), b = path.join(root, 'b'); sh(`git clone -q ${bare} a && git clone -q ${bare} b`, root);
  writeFileSync(path.join(a, 'n1.md'), 'one\n'); assert.equal(sync(a), 'ok');
  writeFileSync(path.join(b, 'n2.md'), 'two\n'); assert.equal(sync(b), 'ok'); // rebase onto a's commit needs a committer identity too
  assert.equal(sh('git rev-list --all --count', bare).trim(), '2');
}));
