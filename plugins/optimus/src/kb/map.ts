import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { type Db, type NoteRow, type RelRow, getAttrs, getNote } from './db.js';
import type { Kind } from './ids.js';
import { paths } from '../lib/paths.js';
import { TEMPLATE } from './map-template.js';

export type Node = { id: string; kind: Kind; title: string; domain: string | null; project: string | null; attrs: Record<string, string[]>; x: number; y: number; environment: string[]; subject: string[] };
export type ConceptNode = Node & { lanes: number; pending: string | null };
export type Badge = Node & { attach: string | null; state: string; gateRank: number; validToday: boolean; expired: boolean; superseded: boolean; evidence: string[] };
export type Edge = { id: string; type: string; src: string; dst: string; props: Record<string, unknown> };
export type Column = (typeof COLUMNS)[number];
export type Lane = { domain: string; columns: Record<Column, Node[]>; top: number; height: number };
export type Memory = { id: string; title: string; domain: string | null; project: string | null; origin: string; attrs: Record<string, string[]>; excerpt: string };
export type Graph = { lanes: Lane[]; concepts: ConceptNode[]; findings: Badge[]; edges: Edge[]; gates: string[]; memories: Memory[] };

export const COLUMNS = ['theme', 'approach', 'experiment', 'target'] as const;
const COL_W = 220, ROW_H = 28, NODE_W = 170, BADGE_STEP = 14, HEADER = 28, LANE_PAD = 50, LANE_GAP = 12, CONCEPT_COL = 4, NO_DOMAIN = '(no domain)';
const colX = (c: number) => c * COL_W;
const MEMORY_ORIGINS = new Set(['serena', 'claude-memory', 'codex']);
const axes = (attrs: Record<string, string[]>) => ({ environment: attrs['facet:environment'] ?? [], subject: attrs['facet:subject'] ?? [] });
const liveNotes = (db: Db, kinds: readonly string[]) => db.sql.prepare(`SELECT * FROM note WHERE kind IN (${kinds.map(() => '?').join(',')}) AND deleted_at IS NULL ORDER BY created_at, id`).all(...kinds) as NoteRow[];

/** DESIGN §4.11: one lane per domain, columns Theme → Approach → Experiment → Target at x = column × 220, rows in insertion order at
 *  y = lane offset + row × 28; concept hubs in a fifth column; finding badges attach to the approach (or other lane node) they are `about`,
 *  else to their concept, else sit in a loose row of their domain's lane. Only relations between drawn elements become edges. */
export function graphData(db: Db, today = new Date()): Graph {
  const todayStr = today.toISOString().slice(0, 10);
  const liveIds = new Set((db.sql.prepare('SELECT id FROM note WHERE deleted_at IS NULL').all() as { id: string }[]).map((r) => r.id));
  const rels = (db.sql.prepare('SELECT * FROM rel WHERE deleted_at IS NULL ORDER BY created_at, id').all() as (Omit<RelRow, 'props'> & { props: string })[])
    .map((r) => ({ ...r, props: JSON.parse(r.props) as Record<string, unknown> })).filter((r) => liveIds.has(r.src) && liveIds.has(r.dst));
  const outOf = (id: string, type: string) => rels.filter((r) => r.src === id && r.type === type);
  const laneNotes = liveNotes(db, COLUMNS), findingNotes = liveNotes(db, ['finding']), conceptNotes = liveNotes(db, ['concept']);
  const laneNoteIds = new Set(laneNotes.map((n) => n.id)), conceptIds = new Set(conceptNotes.map((n) => n.id));
  // Imported memories (Serena, Claude Code auto-memory, Codex) are evidence notes: listed per project under their domain's lane, never drawn as parts
  // (2026-10-24: a second machine imported 276 of them and its projects were invisible on the map).
  const memories: Memory[] = liveNotes(db, ['evidence']).flatMap((n) => {
    const a = getAttrs(db, n.id), origin = a.origin?.[0] ?? ''; if (!MEMORY_ORIGINS.has(origin)) return [];
    const { sha256: _sha, ...attrs } = a;
    return [{ id: n.id, title: n.title, domain: n.domain, project: n.project, origin, attrs, excerpt: n.body.replace(/\s+/g, ' ').trim().slice(0, 240) }];
  });
  const attachOf = (f: NoteRow) => { const about = outOf(f.id, 'about').map((r) => r.dst); return about.find((d) => laneNoteIds.has(d)) ?? about.find((d) => conceptIds.has(d)) ?? null; };
  const laneOf = (n: NoteRow) => n.domain ?? NO_DOMAIN;
  const loose = new Map<string, NoteRow[]>();
  for (const f of findingNotes) if (!attachOf(f)) (loose.get(laneOf(f)) ?? loose.set(laneOf(f), []).get(laneOf(f))!).push(f);
  const domains = [...new Set([...liveNotes(db, ['domain']).map((d) => d.domain ?? d.title), ...laneNotes.map(laneOf), ...findingNotes.map(laneOf), ...memories.map((m) => m.domain ?? NO_DOMAIN)])].sort();

  const node = (n: NoteRow, x: number, y: number): Node => { const attrs = getAttrs(db, n.id); return { id: n.id, kind: n.kind, title: n.title, domain: n.domain, project: n.project, attrs, x, y, ...axes(attrs) }; };
  const nodeById = new Map<string, Node>(), looseRow = new Map<string, number>();
  const lanes: Lane[] = []; let top = HEADER;
  for (const domain of domains) {
    const columns = { theme: [], approach: [], experiment: [], target: [] } as Record<Column, Node[]>, offset = top + LANE_PAD;
    for (const n of laneNotes.filter((n) => laneOf(n) === domain)) { const col = columns[n.kind as Column]; const nd = node(n, colX(COLUMNS.indexOf(n.kind as Column)), offset + col.length * ROW_H); col.push(nd); nodeById.set(nd.id, nd); }
    const nodeRows = Math.max(1, ...COLUMNS.map((c) => columns[c].length)), rows = nodeRows + (loose.get(domain)?.length ?? 0);
    looseRow.set(domain, offset + nodeRows * ROW_H);
    const height = LANE_PAD + rows * ROW_H;
    lanes.push({ domain, columns, top, height }); top += height + LANE_GAP;
  }

  const pending = db.sql.prepare('SELECT id FROM pending_merge WHERE resolved IS NULL AND (a=? OR b=?) ORDER BY created_at, id');
  const concepts = conceptNotes.map((c, i): ConceptNode => {
    const touching = rels.filter((r) => r.dst === c.id && (r.type === 'about' || r.type === 'relies_on')).map((r) => getNote(db, r.src)?.domain ?? NO_DOMAIN);
    return { ...node(c, colX(CONCEPT_COL), HEADER + LANE_PAD + i * ROW_H), lanes: new Set(touching).size, pending: (pending.get(c.id, c.id) as { id: string } | undefined)?.id ?? null };
  });
  const conceptById = new Map(concepts.map((c) => [c.id, c]));

  const perAnchor = new Map<string, number>(), looseUsed = new Map<string, number>();
  const findings = findingNotes.map((f): Badge => {
    const attach = attachOf(f), attrs = getAttrs(db, f.id), from = attrs.valid_from?.[0]?.slice(0, 10), to = attrs.valid_to?.[0]?.slice(0, 10);
    let x: number, y: number;
    if (attach) {
      const a = nodeById.get(attach) ?? conceptById.get(attach)!, k = perAnchor.get(attach) ?? 0; perAnchor.set(attach, k + 1);
      // Right of a lane node, left of a concept hub (its label sits to the right).
      // ponytail: badges run outwards from the anchor and overlap the neighbouring column after ~3 per node; wrap rows if a node ever carries more.
      x = conceptById.has(attach) ? a.x - 10 - k * BADGE_STEP : a.x + NODE_W + 8 + k * BADGE_STEP; y = a.y;
    } else { const d = laneOf(f), k = looseUsed.get(d) ?? 0; looseUsed.set(d, k + 1); x = colX(1) + 8; y = looseRow.get(d)! + k * ROW_H; }
    const targets = outOf(f.id, 'validated_in').map((r) => nodeById.get(r.dst)).filter((t): t is Node => !!t);
    return {
      id: f.id, kind: f.kind, title: f.title, domain: f.domain, project: f.project, attrs, x, y, attach,
      environment: [...new Set(targets.flatMap((t) => t.environment))], subject: [...new Set(targets.flatMap((t) => t.subject))],
      state: attrs.state?.[0] ?? 'unverified', gateRank: Number(attrs.gate_rank?.[0] ?? -1),
      validToday: (!from || from <= todayStr) && (!to || to >= todayStr), expired: !!to && to < todayStr,
      superseded: rels.some((r) => r.type === 'supersedes' && r.dst === f.id),
      evidence: outOf(f.id, 'backed_by').map((r) => getNote(db, r.dst)?.title ?? r.dst),
    };
  });

  const drawn = new Set([...nodeById.keys(), ...conceptById.keys(), ...findings.map((b) => b.id)]);
  const edges = rels.filter((r) => drawn.has(r.src) && drawn.has(r.dst)).map(({ id, type, src, dst, props }) => ({ id, type, src, dst, props }));
  const gates: string[] = [];
  for (const r of db.sql.prepare(`SELECT DISTINCT key, value FROM attr WHERE key LIKE 'gate:%'`).all() as { key: string; value: string }[]) {
    const i = Number(r.key.slice(5)); if (!Number.isInteger(i)) continue;
    gates[i] = gates[i] ? (gates[i].split(' / ').includes(r.value) ? gates[i] : `${gates[i]} / ${r.value}`) : r.value;
  }
  return { lanes, concepts, findings, edges, gates: Array.from(gates, (g) => g ?? ''), memories };
}

const esc = (s: unknown) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
const attr = (k: string, v: unknown) => ` ${k}="${esc(v)}"`;
const list = (k: string, vs: string[]) => (vs.length ? attr(k, vs.join('|')) : ''); // ponytail: `|` separates values; a facet value containing `|` would split
const flag = (b: boolean) => (b ? '1' : '0');

type Item = { id: string; kind: string; title: string; domain: string | null; project: string | null; attrs: Record<string, string[]>; evidence: string[]; rels: { dir: 'in' | 'out'; type: string; other: string; otherId: string; props: string }[]; commands: string[] };

const SHOW = 2, QUIET_ABOVE = 60; // above this many relations the traces wait for a hover or a selection // findings shown per part before the "more" row
const LABEL: Record<Column, string> = { theme: 'Theme', approach: 'Approach', experiment: 'Experiment', target: 'Target' };
const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? '' : 's'}`;
function titlesOf(g: Graph): Map<string, string> {
  const titles = new Map<string, string>();
  for (const l of g.lanes) for (const c of COLUMNS) for (const n of l.columns[c]) titles.set(n.id, n.title);
  for (const n of [...g.concepts, ...g.findings]) titles.set(n.id, n.title);
  return titles;
}

/** The boards: HTML so the parts reflow at any width. The concept rail comes first (it sits to the left of the lanes, where the
 *  bus runs), then one <section class="lane"> per domain. Stages nobody has used yet are left out everywhere, and a shared header
 *  row names the ones in use; an LED per finding is mounted on the part it is about (or in a loose row of its lane). */
function renderBoard(g: Graph): string {
  const byAttach = new Map<string, Badge[]>(), loose = new Map<string, Badge[]>();
  for (const b of g.findings) { const m = b.attach ? byAttach : loose, k = b.attach ?? (b.domain ?? NO_DOMAIN); (m.get(k) ?? m.set(k, []).get(k)!).push(b); }
  const badge = (b: Badge) => `<li><button class="badge" type="button"${attr('data-id', b.id)}${attr('data-state', b.state)}${attr('data-domain', b.domain ?? NO_DOMAIN)}${attr('data-gate-rank', b.gateRank)}${attr('data-valid-today', flag(b.validToday))}${attr('data-evidence', flag(b.evidence.length > 0))}${attr('data-expired', flag(b.expired))}${attr('data-superseded', flag(b.superseded))}${b.attach ? attr('data-attach', b.attach) : ''}${list('data-environment', b.environment)}${list('data-subject', b.subject)}${attr('title', `${b.title} (${b.state})`)}><i class="led"></i><span>${esc(b.title)}</span></button></li>`;
  // ponytail: the first two findings show, the rest sit behind a "+N more" row; the row's count is static (state filters do not recount it)
  const findings = (bs: Badge[]) => bs.length ? `<ul class="findings">${bs.map((b, i) => (i < SHOW ? badge(b) : badge(b).replace('<li>', '<li class="hidden-more">'))).join('')}${bs.length > SHOW ? `<li class="more-row"><button class="more eyebrow" type="button">+${bs.length - SHOW} more</button></li>` : ''}</ul>` : '';
  const node = (n: Node) => `<div class="node"${attr('data-id', n.id)}${attr('data-kind', n.kind)}${n.project ? attr('data-project', n.project) : ''}${list('data-environment', n.environment)}${list('data-subject', n.subject)}><button class="part" type="button"${attr('title', n.title)}><span>${esc(n.title)}</span>${n.project ? `<em class="proj">${esc(n.project)}</em>` : ''}</button>${findings(byAttach.get(n.id) ?? [])}</div>`;
  const used = COLUMNS.filter((c) => g.lanes.some((l) => l.columns[c].length));
  // a stage's width grows with the square root of its part count, so a lane with 200 approaches and 50 targets reads as 2:1, not 4:1
  const template = (l: Lane) => used.map((c) => `minmax(0,${Math.max(0.6, Math.sqrt(l.columns[c].length)).toFixed(2)}fr)`).join(' ') || '1fr';
  const out: string[] = ['<aside class="rail"><header><h2>Concepts</h2><p class="hint">Shared across domains. Bold: two or more domains. Hollow: merge pending.</p></header><ul>'];
  for (const c of g.concepts) out.push(`<li><button class="concept${c.lanes >= 2 ? ' multi' : ''}${c.pending ? ' hollow' : ''}" type="button"${attr('data-id', c.id)}${attr('data-lanes', c.lanes)}${attr('data-pending', flag(!!c.pending))}><span>${esc(c.title)}</span>${c.lanes >= 2 ? `<span class="n">${c.lanes}×</span>` : ''}<i class="hub"></i></button>${findings(byAttach.get(c.id) ?? [])}</li>`);
  if (!g.concepts.length) out.push('<li class="none">No concepts yet. Tags on findings become concepts.</li>');
  out.push('</ul></aside>', '<div class="lanes">');
  for (const l of g.lanes) {
    const parts = COLUMNS.reduce((n, c) => n + l.columns[c].length, 0), findings = g.findings.filter((b) => (b.domain ?? NO_DOMAIN) === l.domain).length, lo = loose.get(l.domain) ?? [], mem = g.memories.filter((m) => (m.domain ?? NO_DOMAIN) === l.domain);
    out.push(`<section class="lane"${attr('data-domain', l.domain)}><header><h2 title="Fold or unfold this domain">${esc(l.domain)}</h2><span class="eyebrow">${plural(parts, 'part')} · ${plural(findings, 'finding')}${mem.length ? ` · ${mem.length} ${mem.length === 1 ? 'memory' : 'memories'}` : ''}</span></header><div class="cols" style="grid-template-columns:${template(l)}">`);
    for (const c of used) { const ns = l.columns[c]; out.push(`<div class="col${ns.length ? '' : ' is-empty'}"${attr('data-col', c)}><h3 class="eyebrow stage">${LABEL[c]}</h3><div class="parts">${ns.map(node).join('')}</div></div>`); }
    if (lo.length) out.push(`<div class="loose"><h3 class="eyebrow">Unattached</h3><ul class="findings">${lo.map(badge).join('')}</ul></div>`);
    if (mem.length) out.push(renderMemories(mem));
    if (!parts && !lo.length && !mem.length) out.push('<p class="empty">Nothing here yet.</p>');
    out.push('</div></section>');
  }
  out.push('</div>');
  return out.join('\n');
}

/** Imported memories per project: a folded list under the lane with counts by origin in the summary; each title opens the inspector, the excerpt feeds the search. */
function renderMemories(mem: Memory[]): string {
  const byProject = new Map<string, Memory[]>();
  for (const m of mem) { const k = m.project ?? '(no project)'; (byProject.get(k) ?? byProject.set(k, []).get(k)!).push(m); }
  const cmp = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);
  const groups = [...byProject.entries()].sort((a, b) => b[1].length - a[1].length || cmp(a[0], b[0]));
  const origins = (ms: Memory[]) => { const c = new Map<string, number>(); for (const m of ms) c.set(m.origin, (c.get(m.origin) ?? 0) + 1); return [...c.entries()].sort((a, b) => b[1] - a[1] || cmp(a[0], b[0])).map(([o, n]) => `${n} ${o}`).join(' · '); };
  const item = (m: Memory) => `<li><button class="memory" type="button"${attr('data-id', m.id)}${m.project ? attr('data-project', m.project) : ''}${attr('data-excerpt', m.excerpt)}${attr('title', m.attrs.source_path?.[0] ?? m.title)}>${esc(m.title)}</button></li>`;
  return `<div class="memories"><h3 class="eyebrow">Memories · imported from Serena, Claude Code and Codex</h3>${groups.map(([p, ms]) => `<details class="mem-project"${attr('data-project', p)}><summary><span class="proj-name">${esc(p)}</span><span class="n">${ms.length}</span><span class="origins">${esc(origins(ms))}</span></summary><ul>${[...ms].sort((a, b) => cmp(a.title, b.title)).map(item).join('')}</ul></details>`).join('')}</div>`;
}

/** The trace overlay: one <g class="edge"> per relation between drawn elements, with its type, state and gate as data attributes.
 *  Geometry is left empty; the script sets the path once it has measured the parts. Solid traces draw themselves on load, patterned
 *  ones fade in (a dash pattern cannot also carry the draw animation). */
function renderEdges(g: Graph): string {
  const titles = titlesOf(g);
  return g.edges.map((e) => {
    const state = typeof e.props.state === 'string' ? e.props.state : '', gate = typeof e.props.gate === 'string' ? e.props.gate : '';
    const patterned = e.type === 'discovered_in' || e.type === 'conflicts_with' || (e.type === 'transfer' && state !== 'confirmed');
    return `<g class="edge"${attr('data-id', e.id)}${attr('data-type', e.type)}${attr('data-src', e.src)}${attr('data-dst', e.dst)}${state ? attr('data-state', state) : ''}${gate ? attr('data-gate', gate) : ''}${attr('data-motion', patterned ? 'fade' : 'draw')} tabindex="0" role="button"><path class="vis"></path><path class="hit"></path>`
      + (e.type === 'validated_in' && gate ? `<text class="gate">${esc(gate)}</text>` : '')
      + (e.type === 'transfer' && state === 'refuted' ? '<text class="x">×</text>' : '')
      + `<title>${esc(`${e.type}: ${titles.get(e.src) ?? e.src} → ${titles.get(e.dst) ?? e.dst}`)}</title></g>`;
  }).join('\n');
}

function renderFilters(g: Graph): string {
  const box = (name: string, v: string, label = v, checked = true) => `<label><input type="checkbox"${attr('data-filter', name)}${attr('value', v)}${checked ? ' checked' : ''}> ${esc(label)}</label>`;
  const group = (legend: string, name: string, values: string[], on: (v: string) => boolean = () => true) => `<fieldset><legend class="eyebrow">${legend}</legend>${values.length ? values.map((v) => box(name, v, v, on(v))).join('') : '<div class="none">none</div>'}</fieldset>`;
  const targets = g.lanes.flatMap((l) => l.columns.target);
  const distinct = (xs: string[]) => [...new Set(xs)].sort();
  const states = distinct(['unverified', 'observed', 'reproduced', 'conflicting', ...g.findings.map((b) => b.state)]);
  // a domain with nothing in it starts unchecked: the map shows what is in use
  const used = new Set(g.lanes.filter((l) => COLUMNS.some((c) => l.columns[c].length) || g.findings.some((b) => (b.domain ?? NO_DOMAIN) === l.domain) || g.memories.some((m) => (m.domain ?? NO_DOMAIN) === l.domain)).map((l) => l.domain));
  return [
    group('Domain', 'domain', g.lanes.map((l) => l.domain), (d) => used.has(d)),
    group('Environment', 'environment', distinct(targets.flatMap((t) => t.environment))),
    group('Subject', 'subject', distinct(targets.flatMap((t) => t.subject))),
    group('State', 'state', states),
    `<fieldset><legend class="eyebrow">Gate ≥</legend><select id="gate-min"><option value="-1">any</option>${g.gates.map((name, i) => `<option value="${i}">${esc(`${i}: ${name}`)}</option>`).join('')}</select></fieldset>`,
    `<fieldset><legend class="eyebrow">Findings</legend><label><input type="checkbox" id="valid-today"> valid today</label><label><input type="checkbox" id="has-evidence"> has evidence</label><label><input type="checkbox" id="show-proposed" checked> show proposed transfers</label></fieldset>`,
    `<fieldset><legend class="eyebrow">Detail</legend><label><input type="checkbox" id="show-text"> finding text on every part (otherwise only where you drill in)</label><label><input type="checkbox" id="show-traces"${g.edges.length <= QUIET_ABOVE ? ' checked' : ''}> every trace at rest (${g.edges.length}); otherwise traces follow your hover or selection</label></fieldset>`,
    `<fieldset><legend class="eyebrow">Legend</legend><div class="legend">${renderLegend(g)}</div></fieldset>`,
  ].join('\n');
}

/** Legend rows only for what the data uses: states present among the findings, relation types and transfer states present among the edges. */
function renderLegend(g: Graph): string {
  const rows: string[] = [];
  const led = (c: string, label: string, hatched = false) => rows.push(`<i class="led" style="--c:var(--${c})${hatched ? `;background:repeating-linear-gradient(45deg, var(--${c}) 0 2px, var(--paper-2) 2px 4px);border-color:var(--${c})` : ''}"></i><span>${label}</span>`);
  const line = (stroke: string, label: string, extra = '') => rows.push(`<svg viewBox="0 0 40 12"><path d="M1 6H39" ${stroke} stroke-linecap="round"></path>${extra}</svg><span>${label}</span>`);
  for (const s of ['reproduced', 'observed', 'unverified', 'conflicting']) if (g.findings.some((b) => b.state === s)) led(s, s);
  if (g.findings.some((b) => b.expired || b.superseded)) led('observed', 'past valid_to or superseded', true);
  const types = new Set(g.edges.map((e) => e.type)), transfer = new Set(g.edges.filter((e) => e.type === 'transfer').map((e) => String(e.props.state ?? '')));
  const plain = 'stroke="var(--muted)" stroke-width="1.5"';
  if (types.has('about')) line(plain, 'about');
  if (types.has('discovered_in')) line(`${plain} stroke-dasharray="2 4"`, 'discovered in');
  if (types.has('validated_in')) line(plain, 'validated in, labelled with the gate', '<text x="20" y="4" text-anchor="middle" font-size="6" fill="var(--soft)" font-family="ui-monospace, monospace" letter-spacing="1">GATE</text>');
  if (transfer.has('proposed')) line(`${plain} stroke-dasharray="5 4"`, 'transfer proposed');
  if (transfer.has('confirmed') || transfer.has('confirmed_provisional')) line('stroke="var(--ink)" stroke-width="1.75"', 'transfer confirmed');
  if (transfer.has('refuted')) line(`${plain} stroke-dasharray="5 4" opacity=".5"`, 'transfer refuted', '<text x="20" y="10" text-anchor="middle" font-size="11" font-weight="700" fill="var(--conflicting)">×</text>');
  if (types.has('supersedes')) line(`${plain} opacity=".3"`, 'supersedes');
  if (types.has('conflicts_with')) line('stroke="var(--conflicting)" stroke-width="1.5" stroke-dasharray="1 4"', 'conflicts with');
  for (const t of [...types].filter((t) => !['about', 'discovered_in', 'validated_in', 'transfer', 'supersedes', 'conflicts_with'].includes(t)).sort()) line(plain, t.replace(/_/g, ' '));
  return rows.length ? rows.join('\n') : '<div class="none">nothing drawn yet</div>';
}

/** Side-panel data: every drawn element and edge by id, with the exact commands DESIGN §4.11 says to show. */
function items(db: Db, g: Graph): Record<string, Item> {
  const titles = titlesOf(g);
  const relsOf = (id: string) => g.edges.filter((e) => e.src === id || e.dst === id).map((e) => {
    const dir = e.src === id ? 'out' as const : 'in' as const, otherId = dir === 'out' ? e.dst : e.src;
    return { dir, type: e.type, other: titles.get(otherId) ?? otherId, otherId, props: Object.keys(e.props).length ? JSON.stringify(e.props) : '' };
  });
  const transferCommands = (relId: string) => [`kb transfer ${relId} confirm`, `kb transfer ${relId} refute`];
  const out: Record<string, Item> = {};
  const put = (n: Node, evidence: string[], commands: string[]) => { out[n.id] = { id: n.id, kind: n.kind, title: n.title, domain: n.domain, project: n.project, attrs: n.attrs, evidence, rels: relsOf(n.id), commands }; };
  for (const l of g.lanes) for (const c of COLUMNS) for (const n of l.columns[c]) put(n, [], [`kb retract ${n.id}`]);
  for (const c of g.concepts) put(c, [], [...(c.pending ? [`kb concepts accept ${c.pending}`, `kb concepts reject ${c.pending}`] : []), `kb retract ${c.id}`]);
  for (const b of g.findings) put(b, b.evidence, [...g.edges.filter((e) => e.type === 'transfer' && e.src === b.id).flatMap((e) => transferCommands(e.id)), `kb retract ${b.id}`, `kb set ${b.id} valid_to <date>`]);
  for (const m of g.memories) out[m.id] = { id: m.id, kind: 'evidence', title: m.title, domain: m.domain, project: m.project, attrs: { ...m.attrs, ...(m.excerpt ? { excerpt: [m.excerpt] } : {}) }, evidence: [], rels: [], commands: [`kb retract ${m.id}`] };
  for (const e of g.edges) {
    const title = `${e.type}: ${titles.get(e.src) ?? e.src} → ${titles.get(e.dst) ?? e.dst}`, attrs = Object.fromEntries(Object.entries(e.props).map(([k, v]) => [k, [String(v)]]));
    out[e.id] = { id: e.id, kind: 'relation', title, domain: getNote(db, e.src)?.domain ?? null, project: null, attrs, evidence: [], rels: [{ dir: 'out', type: 'src', other: titles.get(e.src) ?? e.src, otherId: e.src, props: '' }, { dir: 'out', type: 'dst', other: titles.get(e.dst) ?? e.dst, otherId: e.dst, props: '' }], commands: e.type === 'transfer' ? transferCommands(e.id) : [] };
  }
  return out;
}

/** DESIGN §4.11: writes the self-contained page (inline JSON, inline script, no external resource) and returns its path. */
export function generateMap(db: Db, outFile = path.join(paths.stateDir(), 'map.html'), today = new Date()): string {
  const g = graphData(db, today);
  const parts: Record<string, string> = {
    META: esc(`Generated ${today.toISOString().slice(0, 10)} · ${plural(g.lanes.length, 'domain')} · ${plural(g.concepts.length, 'concept')} · ${plural(g.findings.length, 'finding')} · ${plural(g.edges.length, 'relation')} · ${g.memories.length} memories`),
    FILTERS: renderFilters(g), BOARD: renderBoard(g), EDGES: renderEdges(g),
    DATA: JSON.stringify({ items: items(db, g) }).replace(/</g, '\\u003c'), // `</script>` can never close the data block
  };
  const html = TEMPLATE.replace(/__(META|FILTERS|BOARD|EDGES|DATA)__/g, (_, k: string) => parts[k]);
  mkdirSync(path.dirname(outFile), { recursive: true }); writeFileSync(outFile, html);
  return outFile;
}
