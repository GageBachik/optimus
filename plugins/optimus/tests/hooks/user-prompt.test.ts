import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
process.env.OPTIMUS_HOME = mkdtempSync(path.join(tmpdir(), 'pm-')); process.env.OPTIMUS_BANK = mkdtempSync(path.join(tmpdir(), 'bank-'));
const { openDb, upsertNote } = await import('../../src/kb/db.js');
const { installTemplate, conceptNoteId } = await import('../../src/kb/templates.js');
const { loadTemplate } = await import('../../src/kb/templates-yaml.js');
const { kbWrite } = await import('../../src/kb/write.js');
const { userPrompt } = await import('../../src/hooks/user-prompt.js');
const { sessionStart } = await import('../../src/hooks/session-start.js');
const bank = process.env.OPTIMUS_BANK!, now = '2026-10-16T00:00:00Z';
const cwd = mkdtempSync(path.join(tmpdir(), 'spy-'));
writeFileSync(path.join(cwd, '.kb.json'), JSON.stringify({ project_id: 'spy', domain: 'trading', facets: { risk: 'fixed-fractional' }, target: { environment: 'ibkr', subject: 'SPY options' }, relies_on: ['risk sizing'] }));
const title = 'Fixed-fractional 0.5% beat fixed 1-lot on ES mean reversion';
{
  const db = openDb(); installTemplate(db, loadTemplate('templates/trading.yaml'));
  const a = kbWrite(db, bank, { kind: 'approach', title: 'ES 2-sigma', domain: 'trading', project: 'es', facets: { risk: 'fixed-fractional' }, tags: ['risk sizing'] }, now);
  kbWrite(db, bank, { kind: 'finding', title, domain: 'trading', project: 'es', tags: ['risk sizing'], attrs: { state: 'reproduced', gate: 'out-of-sample', valid_from: '2026-09-01' }, evidence: [{ kind: 'commit', ref: 'abc123' }], rels: [{ type: 'about', dst: a.id, props: { facet_key: 'risk' } }] }, now);
  // One open synonym question: a second concept whose merge into "risk sizing" is pending.
  const parity = conceptNoteId('risk parity');
  upsertNote(db, { id: parity, kind: 'concept', domain: null, project: null, title: 'risk parity', body: '', created_at: now, updated_at: now, deleted_at: null, device_id: 'mac' });
  db.sql.prepare('INSERT INTO pending_merge(id, a, b, score, reason, created_at, resolved) VALUES(?,?,?,?,?,?,NULL)').run('pm1', parity, conceptNoteId('risk sizing'), 0.6, 'dice', now);
  db.sql.close();
}
const prompt = 'Should we revisit risk sizing for the SPY book?';
test('a prompt naming a known concept gets a recall brief once; the same prompt again, an unrelated prompt, or no .kb.json gets nothing', async () => {
  const r: any = await userPrompt({ session_id: 'u1', cwd, prompt });
  const t = r.hookSpecificOutput.additionalContext; assert.equal(r.hookSpecificOutput.hookEventName, 'UserPromptSubmit');
  assert.ok(t.length <= 9000); assert.ok(t.includes(title), t); assert.ok(t.includes('[f_')); assert.ok(t.includes('evidence: commit: abc123'));
  assert.equal(await userPrompt({ session_id: 'u1', cwd, prompt }), undefined);
  assert.equal(await userPrompt({ session_id: 'u1', cwd, prompt: 'hello there' }), undefined);
  assert.equal(await userPrompt({ session_id: 'u1', cwd: tmpdir(), prompt }), undefined);
});
test('startup in a .kb.json project appends the bank sections; synonym questions once per session; briefed findings are not recalled again', async () => {
  const s: any = await sessionStart({ session_id: 'u2', source: 'startup', cwd });
  const t = s.hookSpecificOutput.additionalContext;
  assert.ok(t.includes('## Project spy'), t); assert.ok(t.includes('## Pending concept questions')); assert.ok(/node "[^"]+\/dist\/kb\.js" concepts accept pm1/.test(t), t);
  assert.ok(t.indexOf('## Pending concept questions') < t.indexOf('## Relevant findings')); assert.ok(t.includes(title)); assert.ok(t.length <= 9000);
  const again: any = await sessionStart({ session_id: 'u2', source: 'clear', cwd });
  assert.ok(!again.hookSpecificOutput.additionalContext.includes('## Pending concept questions')); assert.ok(again.hookSpecificOutput.additionalContext.includes(title));
  assert.equal(await userPrompt({ session_id: 'u2', cwd, prompt }), undefined);
});
test('recall is own-domain first, then every domain (2026-10-25), and ignores paths: a trading brief lists its own risk-sizing finding before the Solana one, which names its domain; a domain with nothing about the concept is shown the others\'; a path naming a project is not a mention', async () => {
  { const db = openDb(); installTemplate(db, loadTemplate('templates/solana.yaml'));
    kbWrite(db, bank, { kind: 'finding', title: 'Risk sizing on Solana perps: 0.25% per trade survived 3 liquidation cascades', domain: 'solana', project: 'sol-perps', tags: ['risk sizing'], attrs: { state: 'observed' }, evidence: [{ kind: 'path', ref: 'README.md' }] }, now);
    db.sql.close(); }
  const d2 = mkdtempSync(path.join(tmpdir(), 'spy2-')); writeFileSync(path.join(d2, '.kb.json'), JSON.stringify({ project_id: 'spy2', domain: 'trading' }));
  const r: any = await userPrompt({ session_id: 'u9', cwd: d2, prompt: 'Should we revisit risk sizing for the SPY book?' });
  const t = r.hookSpecificOutput.additionalContext; assert.ok(t.includes(title), t);
  assert.ok(t.includes('Solana perps'), 'same concept, other domain: shown after the own domain\'s findings (the owner: never reintroduce what is solved elsewhere)\n' + t);
  assert.ok(t.indexOf(title) < t.indexOf('Solana perps'), 'own domain first\n' + t);
  const lines = t.split('\n'); assert.match(lines.find((l: string) => l.includes('Solana perps'))!, /domain solana/, 'a finding from another domain names it');
  assert.doesNotMatch(lines.find((l: string) => l.includes(title))!, /domain trading/, 'an own-domain finding does not');
  const d3 = mkdtempSync(path.join(tmpdir(), 'tool-')); writeFileSync(path.join(d3, '.kb.json'), JSON.stringify({ project_id: 'toolx', domain: 'tooling' }));
  const r3: any = await userPrompt({ session_id: 'u10', cwd: d3, prompt: 'Should we revisit risk sizing for the bot?' });
  assert.ok(r3 && /Solana perps|Fixed-fractional/.test(r3.hookSpecificOutput.additionalContext), 'a settled domain with nothing about the concept is shown what the others measured');
  const d4 = mkdtempSync(path.join(tmpdir(), 'guess-')); writeFileSync(path.join(d4, '.kb.json'), JSON.stringify({ project_id: 'guessy', domain: 'tooling', auto: { registered: '2026-10-20', confidence: 'low', reason: 'empty folder', decided: '2026-10-20' } }));
  const r3b: any = await userPrompt({ session_id: 'u10b', cwd: d4, prompt: 'Should we revisit risk sizing for the bot?' });
  assert.ok(r3b && /Solana perps|Fixed-fractional/.test(r3b.hookSpecificOutput.additionalContext), 'so is an unconfirmed guess');
  const r4: any = await userPrompt({ session_id: 'u11', cwd: d2, prompt: 'open /Users/loser/projects/es/notes.md and summarise it for me' });
  assert.equal(r4, undefined, 'a path containing the project name "es" is not a mention of that project');
  const r4w: any = await userPrompt({ session_id: 'u11w', cwd: d2, prompt: 'open C:\\Users\\loser\\projects\\es\\notes.md and summarise it for me' });
  assert.equal(r4w, undefined, 'a Windows path containing the project name "es" is not a mention either');
  const r5: any = await userPrompt({ session_id: 'u12', cwd: d2, prompt: 'what did the es project conclude about sizing' });
  assert.ok(r5 && r5.hookSpecificOutput.additionalContext.includes('Knowledge bank on es'), 'a project named in prose still is');
});

test('v1.5: harness-injected user turns (task notifications, slash-command records, command output, system reminders) are not prompts', async () => {
  const notice = '<task-notification>\n<task-id>w1</task-id>\n<summary>Workflow done</summary>\n<result>risk sizing scripts for the agents: 4 agents ran the scripts</result>\n</task-notification>';
  assert.equal(await userPrompt({ session_id: 'h1', cwd, prompt: notice }), undefined, 'no brief for a notification, even one naming a concept');
  assert.equal(await userPrompt({ session_id: 'h1', cwd, prompt: '<command-name>/effort</command-name> <command-args></command-args>' }), undefined);
  assert.equal(await userPrompt({ session_id: 'h1', cwd, prompt: '[SYSTEM NOTIFICATION - NOT USER INPUT]\nrisk sizing' }), undefined);
  const d = mkdtempSync(path.join(tmpdir(), 'notice-')); writeFileSync(path.join(d, '.kb.json'), JSON.stringify({ project_id: 'notice', domain: 'trading', auto: { registered: '2026-10-20', confidence: 'low', reason: 'folder name' } }));
  await userPrompt({ session_id: 'h2', cwd: d, prompt: '<task-notification><result>the agents ran the scripts and hooks for the plugin api server</result></task-notification>' });
  assert.equal(JSON.parse(readFileSync(path.join(d, '.kb.json'), 'utf8')).domain, 'trading', 'a notification never settles or re-files a folder');
  const r: any = await userPrompt({ session_id: 'h2', cwd, prompt: 'Should we revisit risk sizing for the SPY book?' });
  assert.ok(r && r.hookSpecificOutput.additionalContext.includes('Knowledge bank on risk sizing'), 'a typed prompt still briefs');
});

test('v1.5: a two-word phrase of the prompt that appears in a finding title recalls that finding even when it carries no tags', async () => {
  { const db = openDb(); kbWrite(db, bank, { kind: 'finding', title: 'Cover screen reports an 84pt trailing-only safe-area inset on the Duo simulator', domain: 'trading', project: 'duo-desk', attrs: { state: 'observed' }, evidence: [{ kind: 'path', ref: 'README.md' }] }, now); db.sql.close(); }
  const r: any = await userPrompt({ session_id: 'tp1', cwd, prompt: 'Lay out the cover screen of the notes app so the toolbar clears the camera' });
  const t = r.hookSpecificOutput.additionalContext; assert.ok(/Knowledge bank on .*"cover screen"/.test(t) && /84pt trailing-only/.test(t), t);
  const r2: any = await userPrompt({ session_id: 'tp2', cwd, prompt: 'Lay out the home screen so the toolbar clears the camera' });
  assert.ok(!r2 || !/84pt trailing-only/.test(r2.hookSpecificOutput.additionalContext), 'a single shared word ("screen") is not a match');
});

test('when the bank query throws, the last successful brief cached in state.json is injected (DESIGN §3.1)', async () => {
  const first: any = await userPrompt({ session_id: 'u3', cwd, prompt });
  writeFileSync(path.join(process.env.OPTIMUS_HOME!, 'kb.sqlite'), 'not a database');
  const cached: any = await userPrompt({ session_id: 'u3', cwd, prompt: 'anything at all' });
  assert.equal(cached.hookSpecificOutput.additionalContext, first.hookSpecificOutput.additionalContext);
});
test('a malformed .kb.json degrades to no .kb.json: the phase-1 startup brief still appears and userPrompt injects nothing', async () => {
  const bad = mkdtempSync(path.join(tmpdir(), 'bad-')); writeFileSync(path.join(bad, '.kb.json'), '{bad json');
  const s: any = await sessionStart({ session_id: 'u4', source: 'startup', cwd: bad });
  assert.ok(s.hookSpecificOutput.additionalContext.includes('No .kb.json here'), s.hookSpecificOutput.additionalContext);
  assert.equal(await userPrompt({ session_id: 'u4', cwd: bad, prompt }), undefined);
});
