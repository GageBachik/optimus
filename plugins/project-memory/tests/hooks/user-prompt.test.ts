import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
process.env.PROJECT_MEMORY_HOME = mkdtempSync(path.join(tmpdir(), 'pm-')); process.env.PROJECT_MEMORY_BANK = mkdtempSync(path.join(tmpdir(), 'bank-'));
const { openDb, upsertNote } = await import('../../src/kb/db.js');
const { installTemplate, conceptNoteId } = await import('../../src/kb/templates.js');
const { loadTemplate } = await import('../../src/kb/templates-yaml.js');
const { kbWrite } = await import('../../src/kb/write.js');
const { userPrompt } = await import('../../src/hooks/user-prompt.js');
const { sessionStart } = await import('../../src/hooks/session-start.js');
const bank = process.env.PROJECT_MEMORY_BANK!, now = '2026-10-16T00:00:00Z';
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
  assert.ok(t.includes('## Project spy'), t); assert.ok(t.includes('## Pending concept questions')); assert.ok(/node \S+\/dist\/kb\.js concepts accept pm1/.test(t), t);
  assert.ok(t.indexOf('## Pending concept questions') < t.indexOf('## Relevant findings')); assert.ok(t.includes(title)); assert.ok(t.length <= 9000);
  const again: any = await sessionStart({ session_id: 'u2', source: 'clear', cwd });
  assert.ok(!again.hookSpecificOutput.additionalContext.includes('## Pending concept questions')); assert.ok(again.hookSpecificOutput.additionalContext.includes(title));
  assert.equal(await userPrompt({ session_id: 'u2', cwd, prompt }), undefined);
});
test('v1.5 recall is domain-first and ignores paths: a solana finding about the same concept stays out of a trading brief; a path naming a project is not a mention', async () => {
  { const db = openDb(); installTemplate(db, loadTemplate('templates/solana.yaml'));
    kbWrite(db, bank, { kind: 'finding', title: 'Risk sizing on Solana perps: 0.25% per trade survived 3 liquidation cascades', domain: 'solana', project: 'sol-perps', tags: ['risk sizing'], attrs: { state: 'observed' }, evidence: [{ kind: 'path', ref: 'README.md' }] }, now);
    db.sql.close(); }
  const d2 = mkdtempSync(path.join(tmpdir(), 'spy2-')); writeFileSync(path.join(d2, '.kb.json'), JSON.stringify({ project_id: 'spy2', domain: 'trading' }));
  const r: any = await userPrompt({ session_id: 'u9', cwd: d2, prompt: 'Should we revisit risk sizing for the SPY book?' });
  const t = r.hookSpecificOutput.additionalContext; assert.ok(t.includes(title), t); assert.ok(!t.includes('Solana perps'), 'same concept, other domain: left out while the own domain has findings\n' + t);
  const d3 = mkdtempSync(path.join(tmpdir(), 'tool-')); writeFileSync(path.join(d3, '.kb.json'), JSON.stringify({ project_id: 'toolx', domain: 'tooling' }));
  const r3: any = await userPrompt({ session_id: 'u10', cwd: d3, prompt: 'Should we revisit risk sizing for the bot?' });
  assert.equal(r3, undefined, 'a known domain with nothing about the concept: nothing is injected, never other domains');
  const d4 = mkdtempSync(path.join(tmpdir(), 'guess-')); writeFileSync(path.join(d4, '.kb.json'), JSON.stringify({ project_id: 'guessy', domain: 'tooling', auto: { registered: '2026-10-20', confidence: 'low', reason: 'empty folder', decided: '2026-10-20' } }));
  const r3b: any = await userPrompt({ session_id: 'u10b', cwd: d4, prompt: 'Should we revisit risk sizing for the bot?' });
  assert.ok(r3b && /Solana perps|Fixed-fractional/.test(r3b.hookSpecificOutput.additionalContext), 'an unconfirmed guess may be wrong: other domains are offered');
  const r4: any = await userPrompt({ session_id: 'u11', cwd: d2, prompt: 'open /Users/loser/projects/es/notes.md and summarise it for me' });
  assert.equal(r4, undefined, 'a path containing the project name "es" is not a mention of that project');
  const r5: any = await userPrompt({ session_id: 'u12', cwd: d2, prompt: 'what did the es project conclude about sizing' });
  assert.ok(r5 && r5.hookSpecificOutput.additionalContext.includes('Knowledge bank on es'), 'a project named in prose still is');
});

test('when the bank query throws, the last successful brief cached in state.json is injected (DESIGN §3.1)', async () => {
  const first: any = await userPrompt({ session_id: 'u3', cwd, prompt });
  writeFileSync(path.join(process.env.PROJECT_MEMORY_HOME!, 'kb.sqlite'), 'not a database');
  const cached: any = await userPrompt({ session_id: 'u3', cwd, prompt: 'anything at all' });
  assert.equal(cached.hookSpecificOutput.additionalContext, first.hookSpecificOutput.additionalContext);
});
test('a malformed .kb.json degrades to no .kb.json: the phase-1 startup brief still appears and userPrompt injects nothing', async () => {
  const bad = mkdtempSync(path.join(tmpdir(), 'bad-')); writeFileSync(path.join(bad, '.kb.json'), '{bad json');
  const s: any = await sessionStart({ session_id: 'u4', source: 'startup', cwd: bad });
  assert.ok(s.hookSpecificOutput.additionalContext.includes('No .kb.json here'), s.hookSpecificOutput.additionalContext);
  assert.equal(await userPrompt({ session_id: 'u4', cwd: bad, prompt }), undefined);
});
