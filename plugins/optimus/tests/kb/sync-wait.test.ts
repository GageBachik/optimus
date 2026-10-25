import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { execSync, spawn } from 'node:child_process';
process.env.OPTIMUS_HOME = mkdtempSync(path.join(tmpdir(), 'pm-'));
const { sync, syncWait } = await import('../../src/kb/sync.js');
const { stop } = await import('../../src/hooks/stop.js');
const { paths } = await import('../../src/lib/paths.js');
const sh = (cmd: string, cwd: string) => execSync(cmd, { cwd, stdio: 'pipe' }).toString();
const note = (id: string) => `---\nid: ${id}\nkind: finding\ntitle: T ${id}\ncreated_at: 2026-01-01T00:00:00.000Z\nupdated_at: 2026-01-01T00:00:00.000Z\ndevice_id: t\n---\nbody\n`;
const putNote = (bank: string, id: string) => { mkdirSync(path.join(bank, 'notes', 'finding'), { recursive: true }); writeFileSync(path.join(bank, 'notes', 'finding', `${id}.md`), note(id)); };
const identity = (repo: string) => sh('git config user.email t@t && git config user.name t && git config core.autocrlf false', repo);

test('`kb sync --wait` waits for a held lock instead of returning busy, so a note written after the running sync started still ships (2026-10-25)', () => {
  const bank = mkdtempSync(path.join(tmpdir(), 'bank-')); sh('git init -q', bank); identity(bank); putNote(bank, 'f_a');
  const lock = path.join(bank, '.kb-sync.lock'); mkdirSync(lock);
  assert.equal(sync(bank), 'busy', 'the plain sync gives up at once');
  assert.equal(syncWait(bank, 300), 'busy', 'a wait that outlives its budget gives up too');
  assert.ok(existsSync(lock), 'waiting never removes a live lock');
  // Another process releases the lock after 700 ms, as a finishing sync would.
  spawn(process.execPath, ['-e', 'setTimeout(() => require("fs").rmdirSync(process.argv[1]), 700)', lock], { stdio: 'ignore', windowsHide: true }).unref();
  const t0 = Date.now(); const r = syncWait(bank, 10_000);
  assert.equal(r, 'no-remote', 'the waiting sync ran once the lock was released (no remote here, so it stops after committing)');
  assert.ok(Date.now() - t0 >= 500, 'it actually waited');
  assert.equal(sh('git rev-list --count HEAD', bank).trim(), '1', 'the note was committed by the waiting sync');
  assert.ok(!existsSync(lock), 'the lock is released again');
});

test('a Stop that follows a kb_write spawns a sync even seconds after the last one (2026-10-25: a T3 Code thread wrote two findings, the continued stop 14 s after the asking stop\'s sync skipped the sync, and the notes sat uncommitted)', async () => {
  const root = mkdtempSync(path.join(tmpdir(), 'git-')); const bare = path.join(root, 'bank.git'); sh(`git init -q --bare ${bare}`, root);
  const c = path.join(root, 'c'); sh(`git clone -q ${bare} c`, root); identity(c); process.env.OPTIMUS_BANK = c;
  putNote(c, 'f_written_by_the_turn');
  paths.saveConfig({ lastSyncAt: new Date().toISOString() }); // the asking stop synced a moment ago
  const cwd = mkdtempSync(path.join(tmpdir(), 'odds-')); writeFileSync(path.join(cwd, '.kb.json'), JSON.stringify({ project_id: 'odds', domain: 'prediction-markets' }));
  const u = (t: string) => JSON.stringify({ type: 'user', message: { role: 'user', content: t } });
  const a = (t: string) => JSON.stringify({ type: 'assistant', message: { role: 'assistant', content: [{ type: 'text', text: t }], usage: { input_tokens: 2, cache_read_input_tokens: 1000 } } });
  const tool = (name: string) => JSON.stringify({ type: 'assistant', message: { role: 'assistant', content: [{ type: 'tool_use', id: 't1', name, input: {} }] } });
  const tp = path.join(cwd, 'transcript.jsonl');
  writeFileSync(tp, [u('does any of our strategies show autocorrelation?'), a('Daily-marked ledgers show lag-1 autocorrelation of -0.08 on 7 of 15 strategies.'), tool('mcp__plugin_optimus_optimus__kb_write')].join('\n') + '\n');
  const r = await stop({ session_id: 'w1', cwd, transcript_path: tp, stop_hook_active: true });
  assert.equal(r, undefined, 'the continued stop after a write is not asked');
  const pushed = () => sh('git rev-list --all --count', bare).trim();
  for (let i = 0; i < 600 && pushed() === '0'; i++) await new Promise((res) => setTimeout(res, 100)); // 60 s budget, as the session-sync test (a loaded machine)
  assert.equal(pushed(), '1', 'the write turn\'s sync committed and pushed although the last sync was seconds old');
  assert.match(sh('git log -1 --format=%s', c), /^kb /);
});
