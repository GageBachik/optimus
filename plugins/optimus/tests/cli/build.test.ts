import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import path from 'node:path';
process.env.OPTIMUS_HOME = mkdtempSync(path.join(tmpdir(), 'pm-')); process.env.OPTIMUS_BANK = mkdtempSync(path.join(tmpdir(), 'bank-'));
const { openDb } = await import('../../src/kb/db.js');
const { installTemplate } = await import('../../src/kb/templates.js');
const { loadTemplate } = await import('../../src/kb/templates-yaml.js');
const { importSerena } = await import('../../src/kb/import.js');
const bank = process.env.OPTIMUS_BANK!, home = process.env.OPTIMUS_HOME!;
const kb = (cwd: string, ...a: string[]) => spawnSync(process.execPath, [path.resolve('dist/kb.js'), ...a], { encoding: 'utf8', cwd, env: process.env });
const put = (file: string, text: string) => { mkdirSync(path.dirname(file), { recursive: true }); writeFileSync(file, text); };

// A registered project with one imported memory and a README, as a build session finds it.
const root = mkdtempSync(path.join(tmpdir(), 'root-')), repo = path.join(root, 'repo'), mem = path.join(repo, '.serena', 'memories', 'result.md');
const LINE = 'The grid over 12 dwell values kept 0.4c per contract at a 30 s dwell.';
put(path.join(repo, '.kb.json'), JSON.stringify({ project_id: 'demo', domain: 'trading' })); put(mem, `${LINE}\n`); put(path.join(repo, 'README.md'), 'r'.repeat(200));
{ const db = openDb(); installTemplate(db, loadTemplate('templates/trading.yaml')); importSerena(db, bank, [root], mkdtempSync(path.join(tmpdir(), 'home-'))); db.sql.close(); }
const finding = (title: string) => ({ kind: 'finding', title, tags: ['dwell'], attrs: { state: 'observed', gate: 'live', valid_from: '2026-10-01' }, evidence: [{ kind: 'path', ref: mem }],
  body: `## Claim\n${title}\n\n## Why it matters\nx\n\n## Applies when / does not establish\ny\n\n## Evidence\n> ${LINE}\n\n${mem}` });

test('kb build with no subcommand prints its usage; an unknown subcommand exits 2', () => {
  const r = kb(repo, 'build'); assert.equal(r.status, 0); assert.match(r.stdout, /^usage: kb build manifest \[--project <id>\] \[--repo <dir>\] \[--shard <n>\] \[--out <file>\]\n\s+kb build brief \[--project <id>\] \[--role extractor\|reviewer\]\n\s+kb build validate <spec\.json> \[--keys <keys\.json>\] \[--fix\] \[--out <file>\] \[--project <id>\]\n$/);
  const u = kb(repo, 'build', 'shards'); assert.equal(u.status, 2); assert.match(u.stdout, /^usage: kb build manifest/);
  assert.match(kb(repo).stdout, /kb build manifest \[--project <id>\] \[--repo <dir>\] \[--shard <n>\] \[--out <file>\] \| kb build brief \[--project <id>\] \[--role extractor\|reviewer\] \| kb build validate <spec\.json>/, 'the main usage lists it');
});

test('kb build manifest: from the project folder, to stdout as JSON, or to --out with one summary line per shard', () => {
  const r = kb(repo, 'build', 'manifest'); assert.equal(r.status, 0, r.stderr);
  const shards = JSON.parse(r.stdout); assert.equal(shards.length, 1); assert.equal(shards[0].project, 'demo'); assert.equal(shards[0].domain, 'trading'); assert.equal(shards[0].notes.length, 1); assert.equal(shards[0].notes[0].source_path, mem);
  assert.deepEqual(shards[0].docs.map((d: { file: string }) => path.basename(d.file)), ['README.md']); assert.deepEqual(shards[0].vocabulary.gates, ['in-sample', 'out-of-sample', 'paper', 'live-small', 'live']);
  const out = path.join(home, 'manifest.json'), w = kb(path.join(repo, '.serena'), 'build', 'manifest', '--out', out, '--shard', '1'); assert.equal(w.status, 0, w.stderr);
  assert.match(w.stdout, /^demo\s+1\/1\s+notes\s+1 bytes\s+\d+ docs\s+1 README\.md\nwrote /); assert.equal(JSON.parse(readFileSync(out, 'utf8'))[0].shard, '1/1');
  assert.equal(kb(repo, 'build', 'manifest', '--shard', 'x').status, 1, 'a shard size that is not a number');
  assert.match(kb(repo, 'build', 'manifest', '--project').stderr, /--project needs a value/);
});

test('kb build brief: the extractor brief by default, the reviewer brief with --role reviewer, and --project from anywhere', () => {
  const e = kb(repo, 'build', 'brief'); assert.equal(e.status, 0, e.stderr); assert.match(e.stdout, /^# Knowledge build, extractor brief: project demo \(domain trading/); assert.match(e.stdout, /instrument_class/);
  const r = kb(home, 'build', 'brief', '--project', 'demo', '--role', 'reviewer'); assert.equal(r.status, 0, r.stderr); assert.match(r.stdout, /^# Knowledge build, reviewer brief: project demo \(domain trading/);
  const bad = kb(repo, 'build', 'brief', '--role', 'editor'); assert.equal(bad.status, 2); assert.match(bad.stderr, /--role is extractor or reviewer/);
});

test('kb build validate: exit 1 with one line per failure naming the record index, title and reason; exit 0 when every record passes', () => {
  const spec = path.join(home, 'spec.json');
  writeFileSync(spec, JSON.stringify({ defaults: { domain: 'trading', project: 'demo' }, records: [finding('A 30 s dwell kept 0.4c per contract over the 12-value grid'), finding('The dwell grid is still running'), { kind: 'target', title: 'Kalshi live only one facet', facets: { environment: 'Kalshi live' } }] }));
  const r = kb(home, 'build', 'validate', spec); assert.equal(r.status, 1, r.stdout + r.stderr);
  assert.equal(r.stdout, `${spec}: 3 records (0 approaches, 1 targets, 2 findings); 3 problem(s); 1 findings pass\n  - #1 finding "The dwell grid is still running": a finding title carries a number\n  - #1 finding "The dwell grid is still running": title reads as narration, advice or a question\n  - #2 target "Kalshi live only one facet": target needs facets.environment and facets.subject\n`);
  writeFileSync(spec, JSON.stringify({ defaults: { domain: 'trading', project: 'demo' }, records: [finding('A 30 s dwell kept 0.4c per contract over the 12-value grid')] }));
  const ok = kb(home, 'build', 'validate', spec); assert.equal(ok.status, 0, ok.stdout + ok.stderr); assert.match(ok.stdout, /1 records \(0 approaches, 0 targets, 1 findings\); 0 problem\(s\); 1 findings pass\n$/);
  assert.equal(kb(home, 'build', 'validate').status, 2, 'no spec file');
});

test('kb build validate --fix rewrites the spec without the failing findings (or to --out) and exits 0 when what remains passes', () => {
  const spec = path.join(home, 'fix.json'), out = path.join(home, 'fixed.json');
  const records = [{ key: 'a1', kind: 'approach', title: 'dwell before joining the favourite side', tags: ['dwell'] }, finding('A 30 s dwell kept 0.4c per contract over the 12-value grid'), finding('Is a 30 s dwell enough?')];
  writeFileSync(spec, JSON.stringify({ defaults: { domain: 'trading', project: 'demo' }, records }));
  const r = kb(home, 'build', 'validate', spec, '--fix', '--out', out); assert.equal(r.status, 0, r.stdout + r.stderr); assert.match(r.stdout, /wrote .*fixed\.json: 1 of 2 findings kept\n$/);
  assert.deepEqual(JSON.parse(readFileSync(out, 'utf8')).records.map((x: { title: string }) => x.title), records.slice(0, 2).map((x) => x.title)); assert.equal(JSON.parse(readFileSync(spec, 'utf8')).records.length, 3, 'the input is untouched when --out is given');
  const inPlace = kb(home, 'build', 'validate', spec, '--fix'); assert.equal(inPlace.status, 0, inPlace.stdout); assert.equal(JSON.parse(readFileSync(spec, 'utf8')).records.length, 2, 'without --out the spec is rewritten in place');
});

test('kb build validate --fix still exits 1 when a kept record (an approach or target) fails, since kb write would refuse it', () => {
  const spec = path.join(home, 'fix-approach.json');
  writeFileSync(spec, JSON.stringify({ defaults: { domain: 'trading', project: 'demo' }, records: [{ kind: 'approach', title: 'an approach with a bad facet', facets: { nope: 'x' } }] }));
  const r = kb(home, 'build', 'validate', spec, '--fix'); assert.equal(r.status, 1, r.stdout); assert.match(r.stdout, /facet nope not in the template/); assert.ok(existsSync(spec));
});

test('kb build validate --keys <earlier shard spec> resolves that shard\'s keys', () => {
  const first = path.join(home, 'shard1.json'), second = path.join(home, 'shard2.json');
  writeFileSync(first, JSON.stringify({ defaults: { domain: 'trading', project: 'demo' }, records: [{ key: 'a1', kind: 'approach', title: 'dwell before joining the favourite side' }] }));
  writeFileSync(second, JSON.stringify({ defaults: { domain: 'trading', project: 'demo' }, records: [{ ...finding('A 30 s dwell kept 0.4c per contract over the 12-value grid'), rels: [{ type: 'about', dst: '@a1', props: { facet_key: 'entry' } }] }] }));
  const alone = kb(home, 'build', 'validate', second); assert.equal(alone.status, 1); assert.match(alone.stdout, /rel to unknown or later key @a1/);
  const withKeys = kb(home, 'build', 'validate', second, '--keys', first); assert.equal(withKeys.status, 0, withKeys.stdout + withKeys.stderr);
});
