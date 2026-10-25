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
/** A bare remote and a clone that is the bank (OPTIMUS_BANK), with `lastSyncAt` a moment ago: the asking stop synced just now. */
function bankWithRemote(noteId: string): { bare: string; c: string; pushed: () => string } {
  const root = mkdtempSync(path.join(tmpdir(), 'git-')); const bare = path.join(root, 'bank.git'); sh(`git init -q --bare ${bare}`, root);
  const c = path.join(root, 'c'); sh(`git clone -q ${bare} c`, root); identity(c); process.env.OPTIMUS_BANK = c;
  putNote(c, noteId); paths.saveConfig({ lastSyncAt: new Date().toISOString() });
  return { bare, c, pushed: () => sh('git rev-list --all --count', bare).trim() };
}
const u = (t: string) => JSON.stringify({ type: 'user', message: { role: 'user', content: t } });
const a = (t: string) => JSON.stringify({ type: 'assistant', message: { role: 'assistant', content: [{ type: 'text', text: t }], usage: { input_tokens: 2, cache_read_input_tokens: 1000 } } });
const tool = (name: string) => JSON.stringify({ type: 'assistant', message: { role: 'assistant', content: [{ type: 'tool_use', id: 't1', name, input: {} }] } });
/** A project folder and a transcript for one turn. */
function turn(lines: string[]): { cwd: string; tp: string } {
  const cwd = mkdtempSync(path.join(tmpdir(), 'demo-')); writeFileSync(path.join(cwd, '.kb.json'), JSON.stringify({ project_id: 'demo', domain: 'prediction-markets' }));
  const tp = path.join(cwd, 'transcript.jsonl'); writeFileSync(tp, lines.join('\n') + '\n'); return { cwd, tp };
}
/** Another process releases the lock after `ms`, as a finishing sync would. */
const releaseLater = (lock: string, ms: number) => spawn(process.execPath, ['-e', `setTimeout(() => require("fs").rmdirSync(process.argv[1]), ${ms})`, lock], { stdio: 'ignore', windowsHide: true }).unref();
const waitForPush = async (pushed: () => string) => { for (let i = 0; i < 600 && pushed() === '0'; i++) await new Promise((res) => setTimeout(res, 100)); }; // 60 s budget, as the session-sync test (a loaded machine)

test('`kb sync --wait` waits for a held lock instead of returning busy, so a note written after the running sync started still ships (2026-10-25)', () => {
  const bank = mkdtempSync(path.join(tmpdir(), 'bank-')); sh('git init -q', bank); identity(bank); putNote(bank, 'f_a');
  const lock = path.join(bank, '.kb-sync.lock'); mkdirSync(lock);
  assert.equal(sync(bank), 'busy', 'the plain sync gives up at once');
  assert.equal(syncWait(bank, 300), 'busy', 'a wait that outlives its budget gives up too');
  assert.ok(existsSync(lock), 'waiting never removes a live lock');
  releaseLater(lock, 700);
  const t0 = Date.now(); const r = syncWait(bank, 10_000);
  assert.equal(r, 'no-remote', 'the waiting sync ran once the lock was released (no remote here, so it stops after committing)');
  assert.ok(Date.now() - t0 >= 500, 'it actually waited');
  assert.equal(sh('git rev-list --count HEAD', bank).trim(), '1', 'the note was committed by the waiting sync');
  assert.ok(!existsSync(lock), 'the lock is released again');
});

test('a Stop that follows a kb_write spawns a sync even seconds after the last one (2026-10-25: a T3 Code thread wrote two findings, the continued stop 14 s after the asking stop\'s sync skipped the sync, and the notes sat uncommitted)', async () => {
  const { c, pushed } = bankWithRemote('f_written_by_the_turn');
  const { cwd, tp } = turn([u('does any of our strategies show autocorrelation?'), a('Synthetic ledger: lag-1 autocorrelation of -0.05 on 3 of 9 strategies.'), tool('mcp__plugin_optimus_optimus__kb_write')]);
  const r = await stop({ session_id: 'w1', cwd, transcript_path: tp, stop_hook_active: true });
  assert.equal(r, undefined, 'the continued stop after a write is not asked');
  await waitForPush(pushed);
  assert.equal(pushed(), '1', 'the write turn\'s sync committed and pushed although the last sync was seconds old');
  assert.match(sh('git log -1 --format=%s', c), /^kb /);
});

test('the spawned sync carries --wait: a Stop after a kb_write still ships the note when another sync holds the lock as it starts (review 2026-10-25: nothing had pinned the wiring)', async () => {
  const { c, pushed } = bankWithRemote('f_written_under_a_held_lock');
  const lock = path.join(c, '.kb-sync.lock'); mkdirSync(lock); releaseLater(lock, 2500); // held long enough for the detached dist/kb.js to start and find it
  const { cwd, tp } = turn([u('record it'), a('Synthetic: two of five ledgers.'), tool('mcp__plugin_optimus_optimus__kb_write')]);
  await stop({ session_id: 'w2', cwd, transcript_path: tp, stop_hook_active: true });
  await waitForPush(pushed);
  assert.equal(pushed(), '1', 'a sync that found the lock held waited for it instead of returning busy');
});

test('a Stop whose own transcript shows no write still syncs when the bank holds an uncommitted change (review 2026-10-25: a subagent\'s kb_write, a kb_link re-export or a CLI write never appears in the main transcript)', async () => {
  const { pushed } = bankWithRemote('f_written_by_a_subagent');
  const { cwd, tp } = turn([u('summarise what the agents found'), a('Done; the agents recorded their results themselves.')]);
  const r = await stop({ session_id: 'w3', cwd, transcript_path: tp });
  assert.equal(r, undefined, 'nothing measured, nothing asked');
  await waitForPush(pushed);
  assert.equal(pushed(), '1', 'the dirty bank was synced although the turn wrote nothing itself and the last sync was seconds old');
});
