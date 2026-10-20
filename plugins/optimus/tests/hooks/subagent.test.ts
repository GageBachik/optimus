import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
process.env.OPTIMUS_HOME = mkdtempSync(path.join(tmpdir(), 'pm-')); process.env.OPTIMUS_BANK = mkdtempSync(path.join(tmpdir(), 'bank-'));
const { openDb } = await import('../../src/kb/db.js');
const { installTemplate } = await import('../../src/kb/templates.js');
const { loadTemplate } = await import('../../src/kb/templates-yaml.js');
const { kbWrite } = await import('../../src/kb/write.js');
const { subagentStart } = await import('../../src/hooks/subagent-start.js');
const { subagentStop } = await import('../../src/hooks/subagent-stop.js');
const { paths } = await import('../../src/lib/paths.js');
const bank = process.env.OPTIMUS_BANK!, now = '2026-10-19T00:00:00Z';
const cwd = mkdtempSync(path.join(tmpdir(), 'proj-')); writeFileSync(path.join(cwd, '.kb.json'), JSON.stringify({ project_id: 'es', domain: 'trading' }));

test('a subagent gets the project card, the top findings and the instruction to record, under 3,000 chars', async () => {
  const db = openDb(); installTemplate(db, loadTemplate('templates/trading.yaml'));
  const f = kbWrite(db, bank, { kind: 'finding', title: 'fixed-fractional beat fixed lot', domain: 'trading', project: 'other', attrs: { state: 'observed', gate: 'in-sample' }, evidence: [{ kind: 'commit', ref: 'abc' }] }, now); db.sql.close();
  const r: any = await subagentStart({ session_id: 's', agent_id: 'a1', agent_type: 'general-purpose', cwd });
  const t = r.hookSpecificOutput.additionalContext as string;
  assert.ok(t.includes('project es, domain trading')); assert.ok(t.includes(`[${f.id}]`), 'top finding present'); assert.ok(t.includes('kb_write({ kind: "finding"')); assert.ok(t.length <= 3000);
});

test('a finished subagent leaves draft findings from its own transcript, merged with what is already drafted', async () => {
  const line = (text: string) => JSON.stringify({ type: 'assistant', message: { role: 'assistant', content: [{ type: 'text', text }] } });
  const tp = path.join(cwd, 'agent1.jsonl'); writeFileSync(tp, [line('Walk-forward on 255 days: 17% win rate and Sharpe 1.4.')].join('\n') + '\n');
  await subagentStop({ session_id: 's', agent_id: 'a1', cwd, agent_transcript_path: tp });
  const file = path.join(paths.projectDir(paths.projectKey(cwd)), 'draft-findings.json');
  assert.equal(JSON.parse(readFileSync(file, 'utf8')).records.length, 1);
  const tp2 = path.join(cwd, 'agent2.jsonl'); writeFileSync(tp2, [line('Walk-forward on 255 days: 17% win rate and Sharpe 1.4.'), line('Slippage at 2 bps cut PnL by $4,120 over 593 fills.')].join('\n') + '\n');
  await subagentStop({ session_id: 's', agent_id: 'a2', cwd, agent_transcript_path: tp2 });
  const recs = JSON.parse(readFileSync(file, 'utf8')).records; assert.equal(recs.length, 2, 'same sentence once, new one added');
  await subagentStop({ session_id: 's', agent_id: 'a3', cwd, agent_transcript_path: path.join(cwd, 'missing.jsonl') }); // no transcript: no change, no throw
  assert.equal(JSON.parse(readFileSync(file, 'utf8')).records.length, 2);
});
