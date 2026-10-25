import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
process.env.OPTIMUS_HOME = mkdtempSync(path.join(tmpdir(), 'pm-')); process.env.OPTIMUS_BANK = mkdtempSync(path.join(tmpdir(), 'bank-'));
const { openDb, getRels, getAttrs } = await import('../../src/kb/db.js');
const { installTemplate } = await import('../../src/kb/templates.js');
const { loadTemplate } = await import('../../src/kb/templates-yaml.js');
const { kbWrite, agrees, kbLink, setTransfer, retractNote, setAttr } = await import('../../src/kb/write.js');
const bank = process.env.OPTIMUS_BANK!, now = '2026-10-16T00:00:00Z';
test('transfer proposed; baseline-agreeing finding confirms provisionally; disagreeing one conflicts; no baseline → stays proposed', () => {
  const db = openDb(); installTemplate(db, loadTemplate('templates/trading.yaml'));
  const a1 = kbWrite(db, bank, { kind: 'approach', title: 'ES 2-sigma', domain: 'trading', project: 'es', facets: { risk: 'fixed-fractional' }, tags: ['risk sizing'] }, now);
  const a2 = kbWrite(db, bank, { kind: 'approach', title: 'SPY trend', domain: 'trading', project: 'spy', facets: { risk: 'fixed-lot' }, tags: ['risk sizing'] }, now);
  const f1 = kbWrite(db, bank, { kind: 'finding', title: 'fixed-fractional beat fixed lot', domain: 'trading', project: 'es', tags: ['risk sizing'], attrs: { state: 'reproduced', gate: 'out-of-sample' }, metrics: [{ name: 'sharpe', value: 1.4, better: 'higher', baseline: 0.9 }], evidence: [{ kind: 'commit', ref: 'abc123' }], rels: [{ type: 'about', dst: a1.id, props: { facet_key: 'risk' } }] }, now);
  assert.equal(f1.transfers.length, 1); const t = getRels(db, f1.id).find((r) => r.type === 'transfer')!; assert.equal(t.dst, a2.id); assert.equal(t.props.state, 'proposed');
  assert.deepEqual(getAttrs(db, a1.id)['facet:risk'], ['fixed-fractional']);
  kbWrite(db, bank, { kind: 'finding', title: 'also better on SPY', domain: 'trading', project: 'spy', tags: ['risk sizing'], attrs: { state: 'observed', gate: 'in-sample' }, metrics: [{ name: 'sharpe', value: 1.1, better: 'higher', baseline: 0.8 }], evidence: [{ kind: 'commit', ref: 'def456' }], rels: [{ type: 'about', dst: a2.id, props: { facet_key: 'risk' } }] }, now);
  assert.equal(getRels(db, f1.id).find((r) => r.type === 'transfer')!.props.state, 'confirmed_provisional');
  const f3 = kbWrite(db, bank, { kind: 'finding', title: 'worse on SPY options', domain: 'trading', project: 'spy', tags: ['risk sizing'], attrs: { state: 'observed', gate: 'in-sample' }, metrics: [{ name: 'sharpe', value: 0.7, better: 'higher', baseline: 0.9 }], evidence: [{ kind: 'commit', ref: '789' }], rels: [{ type: 'about', dst: a2.id, props: { facet_key: 'risk' } }] }, now);
  assert.deepEqual(getAttrs(db, f3.id).state, ['conflicting']);
  assert.equal(agrees({ metrics: [{ name: 'sharpe', value: 1.4, better: 'higher' }] } as any, { metrics: [{ name: 'sharpe', value: 1.1, better: 'higher' }] } as any), null);
  const noEvidence = kbWrite(db, bank, { kind: 'finding', title: 'guess', domain: 'trading', project: 'es', attrs: { state: 'reproduced', gate: 'in-sample' } }, now);
  assert.deepEqual(getAttrs(db, noEvidence.id).state, ['unverified']);
});

test('R4 revert; a person\'s verdict is final; kb_link; retract soft-deletes; set refreshes gate_rank; R5 facet checks', () => {
  const db = openDb(path.join(process.env.OPTIMUS_HOME!, 'b.sqlite')); installTemplate(db, loadTemplate('templates/trading.yaml'));
  const bank2 = mkdtempSync(path.join(tmpdir(), 'bank-'));
  const a1 = kbWrite(db, bank2, { kind: 'approach', title: 'A', domain: 'trading', project: 'es', facets: { risk: 'fixed-fractional' }, tags: ['risk sizing'] }, now);
  const a2 = kbWrite(db, bank2, { kind: 'approach', title: 'B', domain: 'trading', project: 'spy', facets: { risk: 'fixed-lot' }, tags: ['risk sizing'] }, now); // v1.7: a candidate shares a concept, a facet key alone admits nobody
  const f = (project: string, value: number, baseline: number) => kbWrite(db, bank2, { kind: 'finding', title: `${project} ${value}`, domain: 'trading', project, tags: ['risk sizing'], attrs: { gate: 'in-sample' }, metrics: [{ name: 'sharpe', value, better: 'higher', baseline }], evidence: [{ kind: 'commit', ref: `${project}${value}` }], rels: [{ type: 'about', dst: project === 'es' ? a1.id : a2.id, props: { facet_key: 'risk' } }] }, now);
  const f1 = f('es', 1.4, 0.9);
  const state = () => getRels(db, f1.id).find((r) => r.type === 'transfer')!.props.state, tid = () => getRels(db, f1.id).find((r) => r.type === 'transfer')!.id;
  f('spy', 1.1, 0.8); assert.equal(state(), 'confirmed_provisional');
  const f3 = f('spy', 0.7, 0.9); assert.equal(state(), 'proposed', 'R4: a disagreement reverts the provisional verdict');
  assert.ok(getRels(db, f1.id).some((r) => r.type === 'conflicts_with' && r.dst === f3.id)); assert.deepEqual(getAttrs(db, f1.id).state, ['conflicting']);
  setTransfer(db, bank2, tid(), 'confirmed'); const f4 = f('spy', 0.5, 0.9); assert.equal(state(), 'confirmed', 'confirmed is never touched by the rule');
  assert.ok(!getRels(db, f4.id).some((r) => r.type === 'conflicts_with'));
  assert.match(readFileSync(path.join(bank2, 'notes', 'finding', `${f1.id}.md`), 'utf8'), /state: confirmed\n/);
  const { rel_id } = kbLink(db, bank2, { src: f4.id, type: 'supersedes', dst: f3.id }); assert.ok(getRels(db, f4.id).some((r) => r.id === rel_id && r.type === 'supersedes'));
  assert.throws(() => kbLink(db, bank2, { src: f4.id, type: 'about', dst: 'a_nope' }), /no note a_nope/);
  retractNote(db, bank2, f3.id); assert.match(readFileSync(path.join(bank2, 'notes', 'finding', `${f3.id}.md`), 'utf8'), /deleted_at: /); assert.throws(() => retractNote(db, bank2, f3.id), /no note/);
  const f5 = f('es', 1.5, 0.9); assert.ok(getRels(db, f5.id).some((r) => r.type === 'conflicts_with' && r.dst === f4.id)); assert.ok(!getRels(db, f5.id).some((r) => r.dst === f3.id), 'a retracted finding judges nobody');
  setAttr(db, bank2, f1.id, 'gate', 'live'); assert.deepEqual(getAttrs(db, f1.id).gate_rank, ['4']); assert.throws(() => setAttr(db, bank2, f1.id, 'gate', 'mainnet'), /allowed gates/);
  assert.throws(() => kbWrite(db, bank2, { kind: 'target', title: 'T', domain: 'trading', facets: { risk: 'x' } }, now), /environment and subject/);
  assert.throws(() => kbWrite(db, bank2, { kind: 'approach', title: 'C', domain: 'trading', facets: { colour: 'blue' } }, now), /allowed facet keys/);
  const t = kbWrite(db, bank2, { kind: 'target', title: 'IBKR × ES', domain: 'trading', facets: { environment: 'IBKR' }, attrs: { 'facet:subject': 'ES' } }, now);
  assert.deepEqual(getAttrs(db, t.id), { 'facet:environment': ['IBKR'], 'facet:subject': ['ES'] });
  const again = kbWrite(db, bank2, { kind: 'finding', id: f1.id, title: 'A renamed', attrs: { valid_to: '2027-01-01' } }, now); assert.equal(again.created, false);
  assert.deepEqual(getAttrs(db, f1.id).gate, ['live'], 'attrs merge over an existing note'); assert.equal(state(), 'confirmed', 'rels survive a re-write');
});

test('fix round 1: only user-authored kinds are writable; transfers cannot be forged; rel props are redacted', () => {
  const db = openDb(path.join(process.env.OPTIMUS_HOME!, 'c.sqlite')); installTemplate(db, loadTemplate('templates/trading.yaml'));
  const bank3 = mkdtempSync(path.join(tmpdir(), 'bank-'));
  for (const kind of ['concept', 'evidence', 'domain', 'template', 'report'] as const)
    assert.throws(() => kbWrite(db, bank3, { kind, title: 'risk sizing' }, now), /kb_write writes/, kind);
  const a = kbWrite(db, bank3, { kind: 'approach', title: 'A', domain: 'trading', project: 'es' }, now);
  const f = kbWrite(db, bank3, { kind: 'finding', title: 'F', domain: 'trading', project: 'spy', evidence: [{ kind: 'commit', ref: 'x1' }] }, now);
  assert.throws(() => kbLink(db, bank3, { src: f.id, type: 'transfer', dst: a.id, props: { state: 'confirmed' } }), /transfers are proposed by kb_write/);
  assert.throws(() => kbWrite(db, bank3, { kind: 'finding', title: 'G', domain: 'trading', project: 'spy', rels: [{ type: 'transfer', dst: a.id, props: { state: 'confirmed' } }] }, now), /transfers are proposed by kb_write/);
  assert.ok(!getRels(db, f.id).some((r) => r.type === 'transfer'));
  const key = 'sk_live_' + 'b'.repeat(24);
  const { rel_id } = kbLink(db, bank3, { src: f.id, type: 'uses', dst: a.id, props: { objective: `token: ${'c'.repeat(20)}`, nested: { k: key } } });
  kbWrite(db, bank3, { kind: 'finding', id: f.id, title: 'F', rels: [{ type: 'about', dst: a.id, props: { note: `Bearer ${'d'.repeat(20)}` } }] }, now);
  const file = readFileSync(path.join(bank3, 'notes', 'finding', `${f.id}.md`), 'utf8');
  assert.ok(!file.includes('c'.repeat(20)) && !file.includes(key) && !file.includes('d'.repeat(20)), file);
  assert.ok(!JSON.stringify(getRels(db, f.id)).includes(key));
  assert.ok(getRels(db, f.id).some((r) => r.id === rel_id), 'the rel id is computed from the redacted props');
});

test('a rel keeps the id an import of its file derives after a state change (DESIGN §4.3), so a command copied from another machine resolves', async () => {
  const { parseNoteFile, relId } = await import('../../src/kb/export.js');
  const db = openDb(path.join(process.env.OPTIMUS_HOME!, 'rekey.sqlite')); installTemplate(db, loadTemplate('templates/trading.yaml'));
  const bank3 = mkdtempSync(path.join(tmpdir(), 'bank-'));
  const a1 = kbWrite(db, bank3, { kind: 'approach', title: 'A', domain: 'trading', project: 'es', facets: { risk: 'fixed-fractional' }, tags: ['risk sizing'] }, now);
  kbWrite(db, bank3, { kind: 'approach', title: 'B', domain: 'trading', project: 'spy', facets: { risk: 'fixed-lot' }, tags: ['risk sizing'] }, now);
  const f1 = kbWrite(db, bank3, { kind: 'finding', title: 'F', domain: 'trading', project: 'es', tags: ['risk sizing'], attrs: { gate: 'in-sample' }, metrics: [{ name: 'sharpe', value: 1.4, better: 'higher', baseline: 0.9 }], evidence: [{ kind: 'commit', ref: 'r1' }], rels: [{ type: 'about', dst: a1.id, props: { facet_key: 'risk' } }] }, now);
  const local = () => getRels(db, f1.id).find((r) => r.type === 'transfer')!;
  const imported = () => parseNoteFile(readFileSync(path.join(bank3, 'notes', 'finding', `${f1.id}.md`), 'utf8')).rels.find((r) => r.type === 'transfer')!;
  const next = setTransfer(db, bank3, f1.transfers[0], 'confirmed');
  assert.equal(local().props.state, 'confirmed'); assert.equal(next, local().id); assert.equal(local().id, imported().id);
  assert.notEqual(next, f1.transfers[0]); assert.throws(() => setTransfer(db, bank3, f1.transfers[0], 'refuted'), /no transfer/);
  assert.equal(relId('s', 't', 'd', { b: 1, a: 2 }), relId('s', 't', 'd', { a: 2, b: 1 }), 'props key order does not change the id');
});

test('v1.7 transfers (2026-10-24): a candidate must share a concept, a facet key alone admits nobody; ranked by shared concepts, rarity, facet key; cut at MAX_PROPOSALS with a straddling tie group dropped whole', async () => {
  const { MAX_PROPOSALS, transferCandidates } = await import('../../src/kb/write.js');
  const db = openDb(path.join(process.env.OPTIMUS_HOME!, 'rank.sqlite')); installTemplate(db, loadTemplate('templates/trading.yaml'));
  const bank4 = mkdtempSync(path.join(tmpdir(), 'bank-'));
  const approach = (title: string, project: string, tags: string[], facets?: Record<string, string>) => kbWrite(db, bank4, { kind: 'approach', title, domain: 'trading', project, tags, facets }, now).id;
  const own = approach('ES 2-sigma', 'es', ['risk sizing'], { risk: 'fixed-fractional' });
  const both = approach('both concepts', 'p-both', ['risk sizing', 'kalshi api']);
  const rare = approach('rare concept only', 'p-rare', ['kalshi api']);
  const hubKey = approach('hub concept, same facet key', 'p-hubkey', ['risk sizing'], { risk: 'fixed-lot' });
  const hubA = approach('hub concept A', 'p-huba', ['risk sizing']);
  const hubB = approach('hub concept B', 'p-hubb', ['risk sizing']);
  const facetOnly = approach('facet key only', 'p-facet', [], { risk: 'kelly' });
  const sameProject = approach('same project', 'es', ['risk sizing', 'kalshi api']);
  assert.ok(hubA < hubB, 'ulids are monotonic, so the id tie-break is creation order');
  const finding = (title: string, tags: string[]) => kbWrite(db, bank4, { kind: 'finding', title, domain: 'trading', project: 'es', tags, attrs: { gate: 'in-sample' }, evidence: [{ kind: 'commit', ref: title }], rels: [{ type: 'about', dst: own, props: { facet_key: 'risk' } }] }, now);
  const dsts = (f: { id: string; transfers: string[] }) => { const rels = getRels(db, f.id).filter((r) => r.type === 'transfer'); return f.transfers.map((t) => rels.find((r) => r.id === t)!.dst); };
  // risk sizing is touched by six approaches, kalshi api by three: both (2 shared) > rare (rarer) > hubKey (carries facet:risk) > hubA = hubB, a tie straddling the cut, dropped whole.
  const f1 = finding('fixed-fractional beat fixed lot on Kalshi', ['risk sizing', 'kalshi api']);
  assert.equal(MAX_PROPOSALS, 4);
  assert.deepEqual(transferCandidates(db, f1.id).map((c) => [c.id, c.shared, c.rarity, c.facetKey]), [[both, 2, [3, 6], false], [rare, 1, [3], false], [hubKey, 1, [6], true]]);
  assert.deepEqual(dsts(f1), [both, rare, hubKey], 'proposals follow the ranking, best first');
  for (const [name, id] of Object.entries({ facetOnly, hubA, hubB, sameProject, own })) assert.ok(!dsts(f1).includes(id), `${name} gets no proposal`);
  for (const t of getRels(db, f1.id).filter((r) => r.type === 'transfer')) assert.equal(t.props.state, 'proposed');
  // A candidate set that fits under the cut is proposed whole, equals included.
  const f2 = finding('hub concept only', ['risk sizing']);
  assert.deepEqual(dsts(f2), [hubKey, both, hubA, hubB], 'the facet key ranks first among four equal sharers; the rest follow by id and all fit');
  const f3 = finding('rare concept only', ['kalshi api']);
  assert.deepEqual(dsts(f3), [both, rare]);
  // Five equal candidates and nothing to rank them by: none is proposed, rather than four picked by creation order.
  approach('hub concept C', 'p-hubc', ['risk sizing']);
  const f4 = finding('hub concept again', ['risk sizing']);
  assert.deepEqual(dsts(f4), [hubKey], 'hubKey still stands out by its facet key; the five-way tie behind it straddles the cut and is dropped');
  // A re-write of f1 proposes nothing new: the ranking is stable and existing proposals are never duplicated.
  const again = kbWrite(db, bank4, { kind: 'finding', id: f1.id, title: 'renamed' }, now);
  assert.deepEqual(again.transfers, []); assert.equal(getRels(db, f1.id).filter((r) => r.type === 'transfer').length, 3);
});
