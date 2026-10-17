import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, existsSync, readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import path from 'node:path';
process.env.PROJECT_MEMORY_HOME = mkdtempSync(path.join(tmpdir(), 'pm-')); process.env.PROJECT_MEMORY_BANK = mkdtempSync(path.join(tmpdir(), 'bank-'));
const { openDb } = await import('../../src/kb/db.js');
const { installTemplate, conceptNoteId } = await import('../../src/kb/templates.js');
const { loadTemplate } = await import('../../src/kb/templates-yaml.js');
const { kbWrite } = await import('../../src/kb/write.js');
const { graphData, generateMap } = await import('../../src/kb/map.js');
const bank = process.env.PROJECT_MEMORY_BANK!, now = '2026-10-16T00:00:00Z', today = new Date('2026-10-16T12:00:00Z');

test('map: one lane per domain, a data-state badge per finding, data-type per edge, no external resources, exact commands for the panel', () => {
  const db = openDb(); for (const t of ['trading', 'gen-l1']) installTemplate(db, loadTemplate(`templates/${t}.yaml`));
  const theme = kbWrite(db, bank, { kind: 'theme', title: 'mean reversion', domain: 'trading', project: 'es' }, now);
  const a1 = kbWrite(db, bank, { kind: 'approach', title: 'ES 2-sigma', domain: 'trading', project: 'es', facets: { risk: 'fixed-fractional' }, tags: ['risk sizing'], rels: [{ type: 'under', dst: theme.id }] }, now);
  const a2 = kbWrite(db, bank, { kind: 'approach', title: 'SPY trend', domain: 'trading', project: 'spy', facets: { risk: 'fixed-lot' }, tags: ['risk sizing'] }, now);
  const target = kbWrite(db, bank, { kind: 'target', title: 'IBKR × ES', domain: 'trading', facets: { environment: 'IBKR', subject: 'ES' } }, now);
  const x = kbWrite(db, bank, { kind: 'experiment', title: 'walk-forward 2019-2025', domain: 'trading', project: 'es', method: 'walk-forward', objective: 'sharpe', rels: [{ type: 'tests', dst: a1.id }, { type: 'on', dst: target.id }] }, now);
  const f1 = kbWrite(db, bank, { kind: 'finding', title: 'fixed-fractional beat fixed lot', domain: 'trading', project: 'es', tags: ['risk sizing'], attrs: { state: 'reproduced', gate: 'out-of-sample', valid_from: '2026-09-01' },
    metrics: [{ name: 'sharpe', value: 1.4, better: 'higher', baseline: 0.9 }], evidence: [{ kind: 'commit', ref: 'abc123' }],
    rels: [{ type: 'about', dst: a1.id, props: { facet_key: 'risk' } }, { type: 'discovered_in', dst: x.id }, { type: 'validated_in', dst: target.id, props: { gate: 'out-of-sample' } }] }, now);
  const tid = f1.transfers[0]; assert.ok(tid, 'f1 proposes a transfer to SPY trend');
  const g1 = kbWrite(db, bank, { kind: 'approach', title: 'slim matcher', domain: 'gen-l1', project: 'genibook', tags: ['heap ceiling'] }, now);
  const f2 = kbWrite(db, bank, { kind: 'finding', title: 'PRICE_NIBBLES 32 OOMs on a GTC partial fill', domain: 'gen-l1', project: 'genibook', tags: ['heap ceiling'], attrs: { state: 'observed', gate: 'local-validator', valid_to: '2026-01-01' },
    evidence: [{ kind: 'commit', ref: 'def456' }], rels: [{ type: 'about', dst: g1.id }] }, now);
  const guess = kbWrite(db, bank, { kind: 'finding', title: 'a guess', domain: 'trading', project: 'es', tags: ['risk sizing cap rules'] }, now); // no evidence → unverified; near-name → pending merge
  const pid = (db.sql.prepare('SELECT id FROM pending_merge WHERE resolved IS NULL').get() as { id: string }).id;

  const g = graphData(db, today);
  assert.deepEqual(g.lanes.map((l) => l.domain), ['gen-l1', 'trading']);
  const lane = g.lanes[1];
  assert.deepEqual(lane.columns.approach.map((n) => n.id), [a1.id, a2.id], 'rows by insertion order');
  assert.equal(lane.columns.theme[0].x, 0); assert.equal(lane.columns.approach[0].x, 220); assert.equal(lane.columns.experiment[0].x, 440); assert.equal(lane.columns.target[0].x, 660);
  assert.equal(lane.columns.approach[1].y - lane.columns.approach[0].y, 28); assert.equal(lane.columns.approach[0].y, lane.columns.theme[0].y);
  assert.deepEqual(lane.columns.target[0].environment, ['IBKR']);
  const hub = g.concepts.find((c) => c.id === conceptNoteId('risk sizing'))!;
  assert.equal(hub.x, 880); assert.equal(hub.lanes, 1); assert.equal(hub.pending, pid);
  assert.equal(g.concepts.find((c) => c.id === conceptNoteId('heap ceiling'))!.pending, null);
  const b1 = g.findings.find((b) => b.id === f1.id)!;
  assert.equal(b1.attach, a1.id); assert.equal(b1.state, 'reproduced'); assert.equal(b1.gateRank, 1); assert.deepEqual(b1.environment, ['IBKR']); assert.deepEqual(b1.subject, ['ES']);
  assert.equal(b1.validToday, true); assert.equal(b1.expired, false); assert.deepEqual(b1.evidence, ['commit: abc123']);
  const b2 = g.findings.find((b) => b.id === f2.id)!;
  assert.equal(b2.expired, true); assert.equal(b2.validToday, false); assert.equal(b2.attach, g1.id);
  assert.equal(g.findings.find((b) => b.id === guess.id)!.state, 'unverified');
  assert.ok(g.edges.some((e) => e.id === tid && e.type === 'transfer' && e.src === f1.id && e.dst === a2.id && e.props.state === 'proposed'));
  assert.ok(!g.edges.some((e) => e.type === 'backed_by'), 'evidence notes are not drawn');

  const out = path.join(process.env.PROJECT_MEMORY_HOME!, 'out', 'map.html');
  assert.equal(generateMap(db, out, today), out);
  const html = readFileSync(out, 'utf8');
  assert.equal(html.match(/class="lane"/g)!.length, 2);
  const badges = html.match(/<button class="badge"[^>]*>/g)!; assert.equal(badges.length, 3);
  for (const [id, state] of [[f1.id, 'reproduced'], [f2.id, 'observed'], [guess.id, 'unverified']]) assert.ok(badges.some((b) => b.includes(`data-id="${id}"`) && b.includes(`data-state="${state}"`)), `${id} ${state}`);
  assert.ok(badges.find((b) => b.includes(f2.id))!.includes('data-expired="1"'), 'past valid_to is hatched');
  const edges = html.match(/<g class="edge"[^>]*>/g)!; assert.ok(edges.length >= 7, `${edges.length} edges`);
  for (const e of edges) assert.match(e, / data-type="[a-z_]+"/);
  assert.ok(edges.some((e) => e.includes(`data-id="${tid}"`) && e.includes('data-type="transfer"') && e.includes('data-state="proposed"')));
  assert.ok(html.includes('>out-of-sample</text>'), 'validated_in edge is labeled with the gate');
  assert.ok(!/https?:\/\//.test(html), 'no http(s) substrings'); assert.ok(!/<script[^>]*\ssrc=/.test(html)); assert.ok(!/<link\s/.test(html));
  for (const cmd of [`kb transfer ${tid} confirm`, `kb transfer ${tid} refute`, `kb concepts accept ${pid}`, `kb retract ${f1.id}`, `kb set ${f1.id} valid_to`]) assert.ok(html.includes(cmd), cmd);
  for (const f of ['domain', 'environment', 'subject', 'state']) assert.ok(html.includes(`data-filter="${f}"`), f);
  for (const id of ['gate-min', 'valid-today', 'has-evidence', 'show-proposed', 'panel']) assert.ok(html.includes(`id="${id}"`), id);
  for (const id of ['search', 'filters-toggle', 'panel-toggle', 'show-traces', 'show-text', 'board', 'canvas', 'zoom-fit', 'zoom-focus', 'zoom-in', 'zoom-out']) assert.ok(html.includes(`id="${id}"`), id);
  assert.ok(html.includes('<svg class="wires">'), 'trace overlay present');
  const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1]); assert.ok(scripts.length >= 2, 'inline scripts present');
  for (const src of scripts) assert.doesNotThrow(() => new Function(src), 'the inline script must parse'); // a stray comment once swallowed a line and blanked the page
  for (const e of edges) assert.match(e, / data-motion="(draw|fade)"/);
  assert.ok(html.includes(`data-attach="${a1.id}"`) && new RegExp(`<div class="node" data-id="${a1.id}"[^>]*>(?:(?!</div>).)*class="badge"`, 's').test(html), 'attached finding is mounted inside its approach');
  assert.ok(/class="rail"/.test(html) && html.includes('class="concept multi hollow"') === false, 'rail rendered');
  assert.ok(html.includes(`<section class="lane" data-domain="trading">`), 'lane section');
});

test('map: an attached finding whose domain has no lane still gets a Domain checkbox', () => {
  const db = openDb();
  const a = db.sql.prepare("SELECT id FROM note WHERE kind = 'approach' AND title = 'SPY trend'").get() as { id: string };
  const f = kbWrite(db, bank, { kind: 'finding', title: 'no-domain finding', rels: [{ type: 'about', dst: a.id }] }, now);
  const out = path.join(process.env.PROJECT_MEMORY_HOME!, 'out', 'map2.html'); generateMap(db, out, today);
  const html = readFileSync(out, 'utf8');
  const dom = html.match(new RegExp(`<button class="badge"[^>]*data-id="${f.id}"[^>]*>`))![0].match(/data-domain="([^"]*)"/)![1];
  assert.ok(html.includes(`data-filter="domain" value="${dom}"`), `a domain box for ${dom}`);
});

test('kb map writes <stateDir>/map.html and prints its path', () => {
  const r = spawnSync(process.execPath, ['dist/kb.js', 'map'], { encoding: 'utf8' });
  const file = path.join(process.env.PROJECT_MEMORY_HOME!, 'map.html');
  assert.equal(r.status, 0, r.stderr); assert.equal(r.stdout.trim(), file); assert.ok(existsSync(file));
});
