import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
process.env.OPTIMUS_HOME = mkdtempSync(path.join(tmpdir(), 'pm-')); process.env.OPTIMUS_BANK = mkdtempSync(path.join(tmpdir(), 'bank-'));
const { openDb, upsertNote, setAttrs } = await import('../../src/kb/db.js');
const { installTemplate, templateFor } = await import('../../src/kb/templates.js');
const { loadTemplate } = await import('../../src/kb/templates-yaml.js');
const { importSerena } = await import('../../src/kb/import.js');
const { buildManifest, buildBrief, repoDocs, resolveBuildProject, validateSpec, parseKeys, vocabularyFor, SHARD_SIZE, DOC_LIMIT } = await import('../../src/kb/build.js');
const bank = process.env.OPTIMUS_BANK!;
const put = (file: string, text: string) => { mkdirSync(path.dirname(file), { recursive: true }); writeFileSync(file, text); };
const fwd = (p: string) => p.replace(/\\/g, '/');

// One invented project on disk (a made-up strategy on a made-up instrument): a repo with a .kb.json, three Serena memories, documents at three
// depths, and files the document walk must skip.
const root = mkdtempSync(path.join(tmpdir(), 'root-')), home = mkdtempSync(path.join(tmpdir(), 'home-')), repo = path.join(root, 'demo-repo');
const MEM = 'Moonfade kept 1.7 ticks per contract after costs over 640 simulated fills at a 2-bar confirmation.';
const mem1 = path.join(repo, '.serena', 'memories', 'moonfade.md');
put(path.join(repo, '.kb.json'), JSON.stringify({ project_id: 'demo', domain: 'trading' }));
put(mem1, `# Moonfade\n\n${MEM}\n`); put(path.join(repo, '.serena', 'memories', 'second.md'), 'second memory with enough words to count\n'); put(path.join(repo, '.serena', 'memories', 'third.md'), 'third memory, a different text again\n');
put(path.join(repo, 'README.md'), 'r'.repeat(200)); put(path.join(repo, 'docs', 'notes.md'), 'n'.repeat(150)); put(path.join(repo, 'docs', 'deep', 'deeper.md'), 'd'.repeat(150)); put(path.join(repo, 'docs', 'deep', 'too', 'far.md'), 'f'.repeat(150));
put(path.join(repo, 'tiny.md'), 'short'); put(path.join(repo, 'node_modules', 'pkg', 'README.md'), 'm'.repeat(200)); put(path.join(repo, 'package-lock.json'), '{}'.padEnd(200, ' ')); put(path.join(repo, 'src', 'a.ts'), 'code'.repeat(50)); put(path.join(repo, 'backup-2026', 'old.md'), 'o'.repeat(200));
const db = openDb(); installTemplate(db, loadTemplate('templates/trading.yaml')); installTemplate(db, loadTemplate('templates/ios.yaml'));
importSerena(db, bank, [root], home);
const demo = { project: 'demo', domain: 'trading', repo };
const trading = templateFor(db, 'trading')!;
/** An evidence note as an importer on another machine would have synced it. */
const evidence = (id: string, project: string, origin: string, device: string, at: string) => { upsertNote(db, { id, kind: 'evidence', domain: 'trading', project, title: id, body: 'text of ' + id, created_at: at, updated_at: at, deleted_at: null, device_id: device }); setAttrs(db, id, { origin, source_path: `/elsewhere/${id}.md` }); };

test('manifest: a project\'s imported memories and repo documents in the scratch manifest\'s shape, plus the domain and its template\'s vocabulary', () => {
  const shards = buildManifest(db, bank, demo);
  assert.equal(shards.length, 1); const s = shards[0];
  assert.deepEqual(Object.keys(s), ['project', 'domain', 'repo', 'shard', 'notes', 'docs', 'docs_note', 'vocabulary']);
  assert.equal(s.project, 'demo'); assert.equal(s.domain, 'trading'); assert.equal(s.repo, fwd(repo)); assert.equal(s.shard, '1/1'); assert.equal(s.docs_note, '');
  assert.equal(s.notes.length, 3);
  const note = s.notes.find((n) => n.source_path === mem1)!;
  assert.deepEqual(Object.keys(note), ['id', 'title', 'origin', 'device', 'bytes', 'source_path', 'bank_file']);
  assert.match(note.id, /^e_[0-9a-f]{16}$/); assert.equal(note.title, 'moonfade'); assert.equal(note.origin, 'serena'); assert.equal(typeof note.device, 'string'); assert.equal(note.bytes, `# Moonfade\n\n${MEM}\n`.length);
  assert.equal(note.bank_file, fwd(path.join(bank, 'notes', 'evidence', `${note.id}.md`)));
  assert.deepEqual(s.vocabulary, { facets: trading.facets, gates: trading.gates, methods: trading.methods, states: ['unverified', 'observed', 'reproduced', 'conflicting'], environment: 'platform', subject: 'instrument' });
});

test('manifest: shards hold at most n memories and the repo documents go to shard 1 only', () => {
  const shards = buildManifest(db, bank, demo, 2);
  assert.deepEqual(shards.map((s) => [s.shard, s.notes.length, s.docs.length, s.docs_note]), [['1/2', 2, 3, ''], ['2/2', 1, 0, 'repo docs were given to shard 1 of this project']]);
  assert.deepEqual(new Set(shards.flatMap((s) => s.notes.map((n) => n.id))).size, 3, 'every memory is in exactly one shard');
});

test('manifest: the default shard is 36 memories', () => {
  for (let i = 0; i < 37; i++) evidence(`e_many${String(i).padStart(12, '0')}`, 'many', 'codex', 'mac', `2026-10-01T00:${String(i).padStart(2, '0')}:00.000Z`);
  assert.equal(SHARD_SIZE, 36);
  assert.deepEqual(buildManifest(db, bank, { project: 'many', domain: 'trading', repo: path.join(root, 'none') }).map((s) => s.notes.length), [36, 1]);
});

test('manifest: memories imported on another device are listed with that device', () => {
  evidence('e_otherdevice0001', 'other', 'claude-memory', 'other-mac', '2026-10-02T00:00:00.000Z');
  const [s] = buildManifest(db, bank, { project: 'other', domain: 'trading', repo: path.join(root, 'none') });
  assert.deepEqual(s.notes.map((n) => [n.id, n.origin, n.device, n.source_path]), [['e_otherdevice0001', 'claude-memory', 'other-mac', '/elsewhere/e_otherdevice0001.md']]);
});

test('manifest: evidence that is not an imported memory (a kb_write path or commit) is not a memory', () => {
  evidence('e_pathevidence001', 'other', 'path', 'other-mac', '2026-10-03T00:00:00.000Z');
  const [s] = buildManifest(db, bank, { project: 'other', domain: 'trading', repo: path.join(root, 'none') });
  assert.deepEqual(s.notes.map((n) => n.id), ['e_otherdevice0001']);
});

test('manifest: a project with no memories still gets one shard with its documents', () => {
  const [s, ...rest] = buildManifest(db, bank, { project: 'fresh', domain: 'trading', repo });
  assert.equal(rest.length, 0); assert.equal(s.shard, '1/1'); assert.deepEqual(s.notes, []); assert.equal(s.docs.length, 3);
});

test('documents: READMEs first, two directory levels deep, skipping tool state, dependencies, backups, lockfiles, code and files under 100 bytes', () => {
  assert.deepEqual(repoDocs(repo).map((d) => path.relative(repo, d.file).split(path.sep).join('/')), ['README.md', 'docs/deep/deeper.md', 'docs/notes.md']);
});

test('documents: at most 40 files', () => {
  const big = mkdtempSync(path.join(tmpdir(), 'big-')); for (let i = 0; i < 45; i++) put(path.join(big, `note-${String(i).padStart(2, '0')}.md`), 'x'.repeat(150));
  assert.equal(DOC_LIMIT, 40); assert.equal(repoDocs(big).length, 40);
});

test('project resolution: the .kb.json found walking up names the project and its domain, and its folder is the repo', () => {
  assert.deepEqual(resolveBuildProject(db, path.join(repo, 'docs', 'deep')), { project: 'demo', domain: 'trading', repo });
});

test('project resolution: --project outside its folder takes the domain the project\'s notes carry, and --repo is kept', () => {
  const elsewhere = mkdtempSync(path.join(tmpdir(), 'else-'));
  assert.deepEqual(resolveBuildProject(db, elsewhere, { project: 'other', repo: path.join(root, 'none') }), { project: 'other', domain: 'trading', repo: path.join(root, 'none') });
  assert.throws(() => resolveBuildProject(db, elsewhere), /no \.kb\.json at or above/);
  assert.throws(() => resolveBuildProject(db, elsewhere, { project: 'nobody' }), /no domain known for project nobody/);
});

test('brief (extractor): the template\'s facets, gate order, axes, the spec skeleton and the validator rules', () => {
  const b = buildBrief(db, demo, 'extractor');
  for (const f of trading.facets) assert.ok(b.includes(f), f);
  assert.ok(b.includes(trading.gates.join(' < ')), 'gates weakest first'); assert.ok(b.includes('environment = platform') && b.includes('subject = instrument'), 'axes');
  assert.ok(b.includes('"defaults": {') && b.includes('"project": "demo"') && b.includes('"instrument_class":'), 'skeleton with the template keys');
  assert.ok(b.includes('## Rules the validator enforces') && b.includes('verbatim'), 'rules');
});

test('brief: the synthetic worked examples illustrate trading only; another domain shows its own facet names', () => {
  const ios = templateFor(db, 'ios')!, t = buildBrief(db, demo, 'extractor');
  assert.ok(t.includes('## Worked examples (synthetic') && t.includes('Moonfade'), 'trading carries the examples, declared synthetic');
  for (const h of ['## Claim', '## Why it matters', '## Applies when / does not establish', '## Evidence', '> net 1.7 ticks']) assert.ok(t.includes(h), `the example finding shows ${h}`);
  const b = buildBrief(db, { project: 'app', domain: 'ios', repo }, 'extractor');
  assert.ok(!b.includes('Worked examples') && !b.includes('Moonfade') && !b.includes('instrument_class') && !b.includes('in-sample'), 'no trading words in an ios brief');
  for (const f of ios.facets) assert.ok(b.includes(f), f);
  assert.ok(b.includes(ios.gates.join(' < ')));
});

test('brief (reviewer): merge the shards, refute what the cited source does not carry, deduplicate, enrich .kb.json, then validate and write', () => {
  const b = buildBrief(db, demo, 'reviewer');
  for (const s of ['1. Merge', '2. Refute', '3. Deduplicate', '4. Enrich the repo\'s .kb.json', 'relies_on', 'target {environment, subject}', 'build validate', '--keys', ' write <merged.json>', 'in-sample < out-of-sample']) assert.ok(b.includes(s), s);
  assert.ok(!b.includes('"defaults": {'), 'no skeleton: the reviewer merges specs, it does not write new ones');
});

// A spec that passes every rule (the same invented strategy); the cases below each break one.
const good = () => ({ defaults: { domain: 'trading', project: 'demo' }, records: [
  { key: 'a1', kind: 'approach', title: 'Moonfade: short the opening gap on XYZ micro futures after a 2-bar confirmation', facets: { risk: '1.5x ATR stop', horizon: 'intraday' }, tags: ['gap fade'], body: `From ${fwd(mem1)}` },
  { key: 't1', kind: 'target', title: 'Demo replay × XYZ micro futures', facets: { environment: 'Demo replay', subject: 'XYZ micro futures' }, body: 'Minute bars replayed.' },
  { kind: 'finding', title: 'Moonfade kept 1.7 ticks per contract after costs over 640 simulated fills', tags: ['gap fade', 'transaction cost model'], attrs: { state: 'observed', gate: 'in-sample', valid_from: '2024-03-02' },
    metrics: [{ name: 'net_ticks_per_contract', value: 1.7, unit: 'ticks', better: 'higher' }],
    rels: [{ type: 'about', dst: '@a1', props: { facet_key: 'risk' } }, { type: 'validated_in', dst: '@t1', props: { gate: 'in-sample' } }],
    evidence: [{ kind: 'path', ref: mem1 }],
    body: `## Claim\nMoonfade kept 1.7 ticks per contract.\n\n## Why it matters\nThe edge survives the cost model.\n\n## Applies when / does not establish\nIn-sample replay only; says nothing out of sample.\n\n## Evidence\n> ${MEM}\n\n${fwd(mem1)}` },
] as any[] });
const vocab = vocabularyFor(db, 'trading');

test('validate: a spec that follows every rule passes with no problems', () => {
  const r = validateSpec(good(), vocab);
  assert.deepEqual(r.problems, []); assert.deepEqual([r.records, r.approaches, r.targets, r.findings, r.keptFindings], [3, 1, 1, 1, 1]);
});

test('validate: a quote that is not verbatim in the cited path fails', () => {
  const s = good(), altered = MEM.replace('1.7 ticks per contract', '2.4 ticks per contract'); s.records[2].body = s.records[2].body.replace(MEM, altered);
  assert.deepEqual(validateSpec(s, vocab).problems, [`#2 finding "${s.records[2].title.slice(0, 70)}": quoted line not found verbatim in the cited path evidence: "${altered.slice(0, 70)}"`]);
});

test('validate: a verbatim quote survives different whitespace, bold marks and a trailing ellipsis', () => {
  const s = good(); s.records[2].body = s.records[2].body.replace(`> ${MEM}`, '> Moonfade  kept **1.7 ticks** per contract after costs over 640 simulated fills at a…');
  assert.deepEqual(validateSpec(s, vocab).problems, []);
});

// [what is wrong, how the good spec is broken, the reason reported, problems expected (1 unless the break trips a second rule, as the script also did)]
const cases: [string, (s: any) => void, RegExp, number?][] = [
  ['a finding title without a number', (s) => { s.records[2].title = 'Moonfade kept a small edge per contract after costs'; }, /a finding title carries a number/],
  ['a finding title that narrates', (s) => { s.records[2].title = 'I pushed the Moonfade fix, 1.7 ticks per contract now'; }, /narration, advice or a question/],
  ['a finding title that asks a question', (s) => { s.records[2].title = 'Does Moonfade keep 1.7 ticks per contract?'; }, /narration, advice or a question/],
  ['a finding title that advises', (s) => { s.records[2].title = 'You should size Moonfade at 1.7 ticks per contract'; }, /narration, advice or a question/],
  ['a finding with no tags', (s) => { s.records[2].tags = []; }, /1-5 tags/],
  ['a finding with six tags', (s) => { s.records[2].tags = ['a', 'b', 'c', 'd', 'e', 'f']; }, /1-5 tags/],
  ['a metric whose name is not snake_case', (s) => { s.records[2].metrics[0].name = 'Ticks Per Contract'; }, /snake_case name, numeric value, better higher\|lower/],
  ['a metric whose value is a string', (s) => { s.records[2].metrics[0].value = '1.7'; }, /snake_case name, numeric value/],
  ['a metric whose better is neither higher nor lower', (s) => { s.records[2].metrics[0].better = 'up'; }, /better higher\|lower/],
  ['a state outside unverified|observed|reproduced|conflicting', (s) => { s.records[2].attrs.state = 'confirmed'; }, /attrs\.state confirmed \(unverified\|observed\|reproduced\|conflicting\)/],
  ['a gate outside the template', (s) => { s.records[2].attrs.gate = 'backtest'; }, /attrs\.gate backtest \(in-sample\|out-of-sample\|paper\|live-small\|live\)/],
  ['a valid_from that is not YYYY-MM-DD', (s) => { s.records[2].attrs.valid_from = '02/03/2024'; }, /valid_from not YYYY-MM-DD/],
  ['a body missing one of the four headings', (s) => { s.records[2].body = s.records[2].body.replace('## Why it matters', '## Why'); }, /body lacks ## Why it matters/],
  ['a body with no quote line', (s) => { s.records[2].body = s.records[2].body.replace('> ', ''); }, /body has no "> quote" line/],
  ['a finding with no evidence', (s) => { s.records[2].evidence = []; }, /no evidence/, 2], // and its quote has no source to be found in
  ['an evidence path that does not exist on this machine', (s) => { s.records[2].evidence.push({ kind: 'path', ref: path.join(repo, 'nope.md') }); }, /evidence path does not exist on this machine/],
  ['an evidence kind outside path, commit and url', (s) => { s.records[2].evidence.push({ kind: 'transcript', ref: 'x' }); }, /evidence kind transcript/],
  ['facets on a finding', (s) => { s.records[2].facets = { risk: 'x' }; }, /facets belong on approaches and targets, not findings/],
  ['an approach facet outside the template', (s) => { s.records[0].facets = { nope: 'x' }; }, /facet nope not in the template \(why, entry, risk, exit, horizon, instrument_class\)/],
  ['an empty facet value', (s) => { s.records[0].facets.risk = ''; }, /facet risk empty/],
  ['a target whose facets are not exactly environment and subject', (s) => { s.records[1].facets.platform = 'Demo'; }, /facet platform not in the template \(environment, subject\)/],
  ['a target missing one of its two facets', (s) => { s.records[1].facets = { environment: 'Demo replay' }; }, /target needs facets\.environment and facets\.subject/],
  ['a rel to a key defined later or never', (s) => { s.records[2].rels[0].dst = '@zz'; }, /rel to unknown or later key @zz/],
  ['a rel without a dst', (s) => { s.records[2].rels[0] = { type: 'about' }; }, /rel without dst/],
  ['an about rel whose facet_key is outside the template', (s) => { s.records[2].rels[0].props.facet_key = 'nope'; }, /about facet_key nope/],
  ['a validated_in rel whose gate is outside the template', (s) => { s.records[2].rels[1].props.gate = 'backtest'; }, /validated_in gate backtest/],
  ['a transfer rel', (s) => { s.records[2].rels.push({ type: 'transfer', dst: '@a1' }); }, /transfers are proposed by kb write itself/],
  ['a duplicate key', (s) => { s.records.push({ key: 'a1', kind: 'approach', title: 'a second approach under the key a1' }); }, /duplicate key/],
  ['a title shorter than 12 characters', (s) => { s.records[0].title = 'short'; }, /title length \(12-220\)/],
  ['a kind outside approach, target, finding, theme and experiment', (s) => { s.records[0].kind = 'concept'; }, /kind concept/],
  ['an experiment method outside the template', (s) => { s.records.push({ kind: 'experiment', title: 'grid over confirmation lengths 1-12', method: 'guess' }); }, /method guess not in the template \(grid-search, random-search, walk-forward, bayesian, monte-carlo, bootstrap\)/],
  ['a spec without defaults', (s) => { s.defaults = {}; }, /spec\.defaults needs domain and project/],
];
for (const [name, mutate, reason, count = 1] of cases) test(`validate rejects ${name}`, () => {
  const s = good(); mutate(s); const r = validateSpec(s, vocab);
  assert.equal(r.problems.length, count, r.problems.join('\n')); assert.match(r.problems[0], reason);
});

test('validate: a failure line names the record index, its kind and title, then the reason', () => {
  const s = good(); s.records[2].tags = [];
  assert.deepEqual(validateSpec(s, vocab).problems, [`#2 finding "${s.records[2].title.slice(0, 70)}": 1-5 tags`]); // the title is cut at 70 characters
});

test('validate: --keys resolves a key an earlier shard of the same project defined', () => {
  const earlier = path.join(process.env.OPTIMUS_HOME!, 'shard1.json'); writeFileSync(earlier, JSON.stringify(good()));
  const s = good(); s.records.splice(0, 2); // this shard relies on a1 and t1 from shard 1
  assert.match(validateSpec(s, vocab).problems.join('\n'), /unknown or later key @a1/);
  assert.deepEqual(validateSpec(s, vocab, { extKeys: parseKeys(earlier) }).problems, []);
});

test('parseKeys: a comma-separated list or a JSON array file, besides an earlier shard\'s spec', () => {
  assert.deepEqual(parseKeys('a1, t1,,x'), ['a1', 't1', 'x']);
  const arr = path.join(process.env.OPTIMUS_HOME!, 'keys.json'); writeFileSync(arr, '["a9","t9"]'); assert.deepEqual(parseKeys(arr), ['a9', 't9']);
  assert.deepEqual(parseKeys(undefined), []);
});

test('validate --fix: failing findings are dropped and rels to their keys stripped; approaches and targets stay even when they fail', () => {
  const s = good();
  s.records.push({ key: 'f2', kind: 'finding', title: 'a claim with no number in it at all', tags: ['x'], attrs: { state: 'observed' }, evidence: [{ kind: 'path', ref: mem1 }], body: s.records[2].body });
  s.records.push({ kind: 'approach', title: 'an approach with a bad facet key', facets: { nope: 'x' }, rels: [{ type: 'supersedes', dst: '@f2' }, { type: 'about', dst: '@a1' }] });
  const r = validateSpec(s, vocab);
  assert.deepEqual(r.problems.map((p) => p.replace(/^#(\d+) \w+ "[^"]*": /, '#$1 ')), ['#3 a finding title carries a number', '#4 facet nope not in the template (why, entry, risk, exit, horizon, instrument_class)', '#4 rel to unknown or later key @f2']);
  assert.deepEqual([r.findings, r.keptFindings], [2, 1]);
  assert.deepEqual(r.fixed.records!.map((x) => x.title), [s.records[0].title, s.records[1].title, s.records[2].title, 'an approach with a bad facet key']);
  assert.deepEqual(r.fixed.records![3].rels, [{ type: 'about', dst: '@a1' }], 'the rel to the dropped key is stripped, the one to a kept key stays');
  assert.deepEqual(r.fixed.defaults, s.defaults);
});

test('validate: --project cross-checks the spec\'s project and fills it in when the spec has none', () => {
  assert.deepEqual(validateSpec(good(), vocab, { project: 'other' }).problems, ['spec.defaults.project demo is not other']);
  const s: any = good(); delete s.defaults.project; const r = validateSpec(s, vocab, { project: 'demo' });
  assert.deepEqual(r.problems, ['spec.defaults needs domain and project']); assert.deepEqual(r.fixed.defaults, { domain: 'trading', project: 'demo' });
});
