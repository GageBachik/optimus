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
export type Graph = { lanes: Lane[]; concepts: ConceptNode[]; findings: Badge[]; edges: Edge[]; gates: string[] };

export const COLUMNS = ['theme', 'approach', 'experiment', 'target'] as const;
const COL_W = 220, ROW_H = 28, NODE_W = 170, BADGE_STEP = 14, HEADER = 28, LANE_PAD = 50, LANE_GAP = 12, CONCEPT_COL = 4, NO_DOMAIN = '(no domain)';
const colX = (c: number) => c * COL_W;
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
  const attachOf = (f: NoteRow) => { const about = outOf(f.id, 'about').map((r) => r.dst); return about.find((d) => laneNoteIds.has(d)) ?? about.find((d) => conceptIds.has(d)) ?? null; };
  const laneOf = (n: NoteRow) => n.domain ?? NO_DOMAIN;
  const loose = new Map<string, NoteRow[]>();
  for (const f of findingNotes) if (!attachOf(f)) (loose.get(laneOf(f)) ?? loose.set(laneOf(f), []).get(laneOf(f))!).push(f);
  const domains = [...new Set([...liveNotes(db, ['domain']).map((d) => d.domain ?? d.title), ...laneNotes.map(laneOf), ...findingNotes.map(laneOf)])].sort();

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
  return { lanes, concepts, findings, edges, gates: Array.from(gates, (g) => g ?? '') };
}

const esc = (s: unknown) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
const clip = (s: string, n = 26) => (s.length > n ? s.slice(0, n - 1) + '…' : s);
const attr = (k: string, v: unknown) => ` ${k}="${esc(v)}"`;
const list = (k: string, vs: string[]) => (vs.length ? attr(k, vs.join('|')) : ''); // ponytail: `|` separates values; a facet value containing `|` would split
const flag = (b: boolean) => (b ? '1' : '0');

type Item = { id: string; kind: string; title: string; domain: string | null; project: string | null; attrs: Record<string, string[]>; evidence: string[]; rels: { dir: 'in' | 'out'; type: string; other: string; otherId: string; props: string }[]; commands: string[] };

function renderSvg(g: Graph): string {
  const all = new Map<string, { l: [number, number]; r: [number, number]; title: string }>();
  for (const l of g.lanes) for (const c of COLUMNS) for (const n of l.columns[c]) all.set(n.id, { l: [n.x, n.y], r: [n.x + NODE_W, n.y], title: n.title });
  for (const c of g.concepts) all.set(c.id, { l: [c.x + 1, c.y], r: [c.x + 15, c.y], title: c.title });
  for (const b of g.findings) all.set(b.id, { l: [b.x - 6, b.y], r: [b.x + 6, b.y], title: b.title });
  const width = colX(CONCEPT_COL) + 260, height = Math.max(g.lanes.at(-1) ? g.lanes.at(-1)!.top + g.lanes.at(-1)!.height : HEADER, HEADER + LANE_PAD + g.concepts.length * ROW_H) + 16;
  const out: string[] = [`<svg width="${width + 32}" height="${height}"><defs><pattern id="hatch" width="4" height="4" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="4"></line></pattern></defs><g transform="translate(16,0)">`];
  for (const [i, label] of ['Theme', 'Approach', 'Experiment', 'Target', 'Concept'].entries()) out.push(`<text class="col" x="${colX(i)}" y="18">${label}</text>`);
  for (const l of g.lanes) {
    out.push(`<g class="lane"${attr('data-domain', l.domain)}><rect class="bg" x="-12" y="${l.top}" width="${width + 8}" height="${l.height}" rx="6"></rect><text class="label" x="0" y="${l.top + 20}">${esc(l.domain)}</text>`);
    for (const c of COLUMNS) for (const n of l.columns[c])
      out.push(`<g class="node"${attr('data-id', n.id)}${attr('data-kind', n.kind)}${list('data-environment', n.environment)}${list('data-subject', n.subject)} tabindex="0" role="button"><rect x="${n.x}" y="${n.y - 11}" width="${NODE_W}" height="22" rx="4"></rect><text x="${n.x + 6}" y="${n.y + 4}">${esc(clip(n.title))}</text><title>${esc(n.title)}</title></g>`);
    out.push('</g>');
  }
  for (const e of g.edges) {
    const a = all.get(e.src)!, b = all.get(e.dst)!, [p, q] = a.l[0] < b.l[0] ? [a.r, b.l] : a.l[0] > b.l[0] ? [a.l, b.r] : [a.r, b.r];
    const mx = (p[0] + q[0]) / 2, my = (p[1] + q[1]) / 2, state = typeof e.props.state === 'string' ? e.props.state : '', gate = typeof e.props.gate === 'string' ? e.props.gate : '';
    const line = (cls: string) => `<line class="${cls}" x1="${p[0]}" y1="${p[1]}" x2="${q[0]}" y2="${q[1]}"></line>`;
    out.push(`<g class="edge"${attr('data-id', e.id)}${attr('data-type', e.type)}${attr('data-src', e.src)}${attr('data-dst', e.dst)}${state ? attr('data-state', state) : ''}${gate ? attr('data-gate', gate) : ''} tabindex="0" role="button">${line('vis')}${line('hit')}`
      + (e.type === 'validated_in' && gate ? `<text x="${q[0] - 6}" y="${q[1] - 12}" text-anchor="end">${esc(gate)}</text>` : '') // at the target end: the midpoint is the experiment column
      + (e.type === 'transfer' && state === 'refuted' ? `<text class="x" x="${mx}" y="${my + 5}" text-anchor="middle">×</text>` : '')
      + `<title>${esc(`${e.type}: ${a.title} → ${b.title}`)}</title></g>`);
  }
  for (const b of g.findings) {
    const hatched = b.expired || b.superseded;
    out.push(`<g class="badge"${attr('data-id', b.id)}${attr('data-state', b.state)}${attr('data-domain', b.domain ?? NO_DOMAIN)}${attr('data-gate-rank', b.gateRank)}${attr('data-valid-today', flag(b.validToday))}${attr('data-evidence', flag(b.evidence.length > 0))}${attr('data-expired', flag(b.expired))}${attr('data-superseded', flag(b.superseded))}${b.attach ? attr('data-attach', b.attach) : ''}${list('data-environment', b.environment)}${list('data-subject', b.subject)} tabindex="0" role="button">`
      + `<circle class="fill" cx="${b.x}" cy="${b.y}" r="6"></circle>${hatched ? `<circle class="hatch" cx="${b.x}" cy="${b.y}" r="6"></circle>` : ''}`
      + (b.attach ? '' : `<text x="${b.x + 12}" y="${b.y + 4}">${esc(clip(b.title, 40))}</text>`) + `<title>${esc(`${b.title} (${b.state})`)}</title></g>`);
  }
  for (const c of g.concepts)
    out.push(`<g class="concept${c.lanes >= 2 ? ' multi' : ''}${c.pending ? ' hollow' : ''}"${attr('data-id', c.id)}${attr('data-lanes', c.lanes)}${attr('data-pending', flag(!!c.pending))} tabindex="0" role="button"><circle cx="${c.x + 8}" cy="${c.y}" r="7"></circle><text x="${c.x + 22}" y="${c.y + 4}">${esc(clip(c.title, 30))}</text><title>${esc(c.title)}</title></g>`);
  out.push('</g></svg>');
  return out.join('\n');
}

function renderFilters(g: Graph): string {
  const box = (name: string, v: string, label = v, checked = true) => `<label><input type="checkbox"${attr('data-filter', name)}${attr('value', v)}${checked ? ' checked' : ''}> ${esc(label)}</label>`;
  const group = (legend: string, name: string, values: string[]) => `<fieldset><legend>${legend}</legend>${values.length ? values.map((v) => box(name, v)).join('') : '<div class="muted">none</div>'}</fieldset>`;
  const targets = g.lanes.flatMap((l) => l.columns.target);
  const distinct = (xs: string[]) => [...new Set(xs)].sort();
  const states = distinct(['unverified', 'observed', 'reproduced', 'conflicting', ...g.findings.map((b) => b.state)]);
  return [
    group('Domain', 'domain', g.lanes.map((l) => l.domain)),
    group('Environment', 'environment', distinct(targets.flatMap((t) => t.environment))),
    group('Subject', 'subject', distinct(targets.flatMap((t) => t.subject))),
    group('State', 'state', states),
    `<fieldset><legend>Gate ≥</legend><select id="gate-min"><option value="-1">any</option>${g.gates.map((name, i) => `<option value="${i}">${esc(`${i}: ${name}`)}</option>`).join('')}</select></fieldset>`,
    `<fieldset><legend>Findings</legend><label><input type="checkbox" id="valid-today"> valid today</label><label><input type="checkbox" id="has-evidence"> has evidence</label><label><input type="checkbox" id="show-proposed" checked> show proposed transfers</label></fieldset>`,
  ].join('\n');
}

/** Side-panel data: every drawn element and edge by id, with the exact commands DESIGN §4.11 says to show. */
function items(db: Db, g: Graph): Record<string, Item> {
  const titles = new Map<string, string>();
  for (const l of g.lanes) for (const c of COLUMNS) for (const n of l.columns[c]) titles.set(n.id, n.title);
  for (const n of [...g.concepts, ...g.findings]) titles.set(n.id, n.title);
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
    META: esc(`generated ${today.toISOString().slice(0, 10)} · ${g.lanes.length} lanes · ${g.concepts.length} concepts · ${g.findings.length} findings · ${g.edges.length} edges`),
    FILTERS: renderFilters(g), SVG: renderSvg(g),
    DATA: JSON.stringify({ items: items(db, g) }).replace(/</g, '\\u003c'), // `</script>` can never close the data block
  };
  const html = TEMPLATE.replace(/__(META|FILTERS|SVG|DATA)__/g, (_, k: string) => parts[k]);
  mkdirSync(path.dirname(outFile), { recursive: true }); writeFileSync(outFile, html);
  return outFile;
}
