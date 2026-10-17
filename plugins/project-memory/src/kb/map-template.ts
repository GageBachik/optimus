/** DESIGN §4.11: the page shell. No external script or stylesheet; the inline script only filters by data-* attributes, routes the
 *  edge overlay from the measured positions of the HTML parts, highlights neighbours and fills the side panel.
 *  Placeholders __META__, __FILTERS__, __BOARD__, __EDGES__ and __DATA__ are filled by generateMap.
 *
 *  Visual concept: a lit schematic. Each domain is a board; the four columns are the stages a result passes through; findings are
 *  LEDs mounted on the part they are about (colour = state); concepts are the bus rail on the right; relations are copper traces.
 *  One load sequence (boards settle → traces draw → LEDs light); afterwards motion only answers an action. */
export const TEMPLATE = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>Knowledge bank</title>
<style>
:root { color-scheme: light dark;
  --bg:#eef1ec; --board:#f9faf7; --line:#d3dad4; --ink:#141c18; --muted:#5f6d66; --faint:#97a39b; --hover:#eef2ee;
  --trace:#a06f33; --trace-lit:#5f3c0f; --code:#e7ebe6; --scrim:rgba(20,28,24,.35);
  --reproduced:#1f9e5f; --observed:#2f7fd6; --unverified:#c98a12; --conflicting:#d2423f;
  --ease:cubic-bezier(.2,0,0,1); --stagger:25ms; --dim:.42; }
@media (prefers-color-scheme: dark) { :root {
  --bg:#0b1210; --board:#111b17; --line:#1f2d27; --ink:#e4ebe6; --muted:#8a9a92; --faint:#56645e; --hover:#162320;
  --trace:#9c7a4a; --trace-lit:#ecc482; --code:#0c1411; --scrim:rgba(0,0,0,.5);
  --reproduced:#39d98a; --observed:#5fb3ff; --unverified:#f5b942; --conflicting:#ff6b6b; --dim:.3; } }

* { box-sizing:border-box }
html, body { height:100% }
body { margin:0; background:var(--bg); color:var(--ink); font:14px/1.45 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
  display:grid; grid-template-rows:auto minmax(0,1fr); grid-template-columns:auto minmax(0,1fr) auto; grid-template-areas:"top top top" "filters board panel"; overflow:hidden }
button { font:inherit; color:inherit; background:none; border:0; padding:0; cursor:pointer; text-align:left }
:focus-visible { outline:2px solid var(--ink); outline-offset:2px; border-radius:6px }
h1, h2, h3, p { margin:0 }
code, .id { font:12px/1.4 ui-monospace, "SF Mono", Menlo, Consolas, monospace }

/* top bar */
.top { grid-area:top; display:flex; align-items:center; gap:14px 20px; padding:12px 22px; border-bottom:1px solid var(--line); background:var(--board) }
.brand { display:flex; align-items:baseline; gap:12px; flex-wrap:wrap; min-width:0 }
.brand h1 { font-size:17px; font-weight:600; letter-spacing:-.01em; white-space:nowrap }
.brand h1::before { content:""; display:inline-block; width:9px; height:9px; border-radius:50%; margin-right:10px; vertical-align:1px; background:var(--reproduced); box-shadow:0 0 8px 1px color-mix(in srgb, var(--reproduced) 70%, transparent) }
.meta { color:var(--muted); font-size:13px }
.spacer { flex:1 }
#search { width:min(300px, 40vw); padding:7px 11px; border:1px solid var(--line); border-radius:8px; background:var(--bg); color:var(--ink); font:inherit; font-size:13px }
#search::placeholder { color:var(--faint) }
.top .tool { padding:7px 12px; border:1px solid var(--line); border-radius:8px; font-size:13px; white-space:nowrap; transition:background .15s }
.top .tool:hover { background:var(--hover) }
.top .tool[aria-expanded="true"] { background:var(--hover); border-color:var(--muted) }

/* filters rail / drawer */
#filters { grid-area:filters; width:0; overflow:hidden; border-right:1px solid transparent; background:var(--board); transition:width .25s var(--ease) }
body.filters-open #filters { width:250px; overflow:auto; border-right-color:var(--line) }
#filters .in { width:250px; padding:18px 20px 32px }
#filters fieldset { border:0; padding:0; margin:0 0 16px } #filters legend { font-weight:600; padding:0; margin-bottom:6px; font-size:13px }
#filters label { display:flex; gap:8px; align-items:flex-start; cursor:pointer; padding:3px 0; font-size:13px; overflow-wrap:anywhere }
#filters input[type="checkbox"] { margin:3px 0 0; accent-color:var(--ink) }
#filters select { width:100%; margin-top:2px; padding:5px 8px; border:1px solid var(--line); border-radius:6px; background:var(--bg); color:var(--ink); font:inherit; font-size:13px }
.none { color:var(--faint); font-size:13px }
.legend { display:grid; grid-template-columns:auto 1fr; gap:6px 10px; align-items:center; font-size:13px; color:var(--muted) }
.legend svg { width:38px; height:12px; display:block } .legend .led { display:block; margin:0 auto; transform:none; opacity:1 }
#scrim { display:none; position:fixed; inset:0; background:var(--scrim); z-index:8 }

/* board */
.board { grid-area:board; position:relative; overflow:auto; padding:22px 26px 48px; scroll-behavior:smooth }
.layout { display:grid; grid-template-columns:minmax(0,1fr) 250px; gap:28px 48px; align-items:start; position:relative }
/* parts sit above the traces, so a trace disappears under a component instead of running over its text */
.node, .rail li, .lane > header, .col h3, .rail > header, .loose h3, .empty { position:relative; z-index:3 }
.lanes { display:grid; gap:18px; min-width:0 }
.lane { background:var(--board); border:1px solid var(--line); border-radius:12px; padding:14px 18px 18px; min-width:0 }
.lane > header { display:flex; align-items:baseline; gap:12px; flex-wrap:wrap; margin-bottom:12px }
.lane h2 { font-size:15px; font-weight:600 } .lane .count { color:var(--muted); font-size:13px }
.cols { display:grid; grid-template-columns:repeat(4, minmax(0,1fr)); gap:10px 22px }
.col h3 { font-size:12px; font-weight:500; color:var(--muted); padding-bottom:6px; margin-bottom:8px; border-bottom:1px solid var(--line) }
.col .parts { display:grid; gap:8px; align-content:start }
.node { position:relative; border:1px solid var(--line); border-radius:8px; background:var(--bg); transition:border-color .15s, background .15s, opacity .18s, transform .18s }
.node:hover, .node.near { border-color:var(--muted) }
.node .part { display:block; width:100%; padding:8px 10px; font-weight:500; font-size:13px; line-height:1.35; overflow-wrap:anywhere; border-radius:8px }
.node .part > span, .badge > span { display:-webkit-box; -webkit-box-orient:vertical; -webkit-line-clamp:3; overflow:hidden }
.findings { list-style:none; margin:0; padding:0 8px 8px }
.badge { display:flex; gap:8px; align-items:flex-start; width:100%; padding:4px 4px 4px 2px; border-radius:6px; font-size:12px; line-height:1.35; color:var(--muted); transition:opacity .18s, color .15s }
.badge:hover, .badge.near, .badge.selected { color:var(--ink) }
.badge span { overflow-wrap:anywhere }
.badge .led { margin-top:3px }
.led { flex:none; display:inline-block; width:10px; height:10px; border-radius:50%; background:var(--c, var(--faint));
  box-shadow:0 0 0 2px var(--board), 0 0 9px 1px color-mix(in srgb, var(--c, var(--faint)) 70%, transparent);
  transform:scale(.3); opacity:0; transition:transform .35s var(--ease) calc(.9s + var(--i,0)*40ms), opacity .25s ease-out calc(.9s + var(--i,0)*40ms) }
body.ready .led { transform:none; opacity:1 }
[data-state="reproduced"] .led { --c:var(--reproduced) } [data-state="observed"] .led { --c:var(--observed) }
[data-state="unverified"] .led { --c:var(--unverified) } [data-state="conflicting"] .led { --c:var(--conflicting) }
[data-expired="1"] .led, [data-superseded="1"] .led { background:repeating-linear-gradient(45deg, var(--c) 0 2px, var(--board) 2px 4px); box-shadow:0 0 0 2px var(--board), 0 0 0 1px var(--c) }
.loose { grid-column:1 / -1; padding:4px 4px 0; display:grid; gap:4px }
.loose h3 { font-size:12px; font-weight:500; color:var(--muted); margin:6px 0 2px }
.empty { color:var(--faint); font-size:13px; padding:4px 0 }
.selected { outline:2px solid var(--ink); outline-offset:2px; border-radius:8px }

/* concept rail */
.rail { background:var(--board); border:1px solid var(--line); border-radius:12px; padding:14px 16px 16px; min-width:0 }
.rail .findings { padding:0 6px 8px 28px }
.rail > header { margin-bottom:10px } .rail h2 { font-size:15px; font-weight:600 } .rail .hint { color:var(--muted); font-size:12px; margin-top:4px }
.rail ul { list-style:none; margin:0; padding:0; display:grid; gap:2px }
.concept { display:flex; gap:10px; align-items:flex-start; width:100%; padding:6px 8px; border-radius:8px; font-size:13px; line-height:1.35; transition:background .15s, opacity .18s }
.concept:hover, .concept.near { background:var(--hover) }
.concept .hub { flex:none; width:10px; height:10px; border-radius:50%; margin-top:4px; background:var(--ink); border:1.5px solid var(--ink) }
.concept.hollow .hub { background:var(--board) } .concept.multi { font-weight:600 }
.concept .lanes-n { margin-left:auto; color:var(--muted); font-weight:400; font-size:12px; white-space:nowrap }

/* traces */
.wires { position:absolute; left:0; top:0; pointer-events:none; overflow:visible; z-index:2 }
.edge path.vis { fill:none; stroke:var(--trace); stroke-width:1.3; stroke-linecap:round; opacity:.6; transition:stroke .15s, stroke-width .15s, opacity .18s }
.edge path.hit { fill:none; stroke:transparent; stroke-width:10; pointer-events:stroke; cursor:pointer }
.edge[data-motion="draw"] path.vis { stroke-dasharray:var(--len, 1); stroke-dashoffset:var(--len, 1); transition:stroke-dashoffset .7s var(--ease) calc(.3s + var(--i,0)*var(--stagger)), stroke .15s, stroke-width .15s, opacity .18s }
body.ready .edge[data-motion="draw"] path.vis { stroke-dashoffset:0 }
.edge[data-motion="fade"] { opacity:0; transition:opacity .5s ease-out calc(.4s + var(--i,0)*var(--stagger)) } body.ready .edge[data-motion="fade"] { opacity:1 }
.edge[data-type="discovered_in"] path.vis { stroke-dasharray:2 4 }
.edge[data-type="transfer"] path.vis { stroke-dasharray:7 5 }
.edge[data-type="transfer"][data-state="confirmed_provisional"] path.vis { stroke:var(--reproduced) }
.edge[data-type="transfer"][data-state="confirmed"] path.vis { stroke:var(--reproduced); stroke-dasharray:none; stroke-width:2; opacity:.9 }
.edge[data-type="transfer"][data-state="refuted"] path.vis { stroke:var(--conflicting) }
.edge[data-type="supersedes"] path.vis { opacity:.25 } .edge[data-type="conflicts_with"] path.vis { stroke:var(--conflicting); stroke-dasharray:1 4 }
.edge text { font-size:11px; fill:var(--muted); paint-order:stroke; stroke:var(--bg); stroke-width:4px; stroke-linejoin:round }
.edge text.x { font-size:15px; font-weight:700; fill:var(--conflicting) }
.edge.lit path.vis, .edge:hover path.vis, .edge.selected path.vis { stroke:var(--trace-lit); stroke-width:2.2; opacity:1 }
.edge[data-type="transfer"][data-state="refuted"].lit path.vis, .edge[data-type="transfer"][data-state="confirmed"].lit path.vis { stroke-width:2.6 }
.edge.selected { outline:none }
.edge:focus-visible path.vis { stroke:var(--trace-lit); stroke-width:2.6 }
body.focus .edge:not(.lit):not(.selected) { opacity:.12 }
body.focus .node:not(.near):not(.selected):not(:has(.selected)), body.focus .badge:not(.near):not(.selected), body.focus .concept:not(.near):not(.selected) { opacity:var(--dim) }
body.focus .node:has(.badge.near) { opacity:1 }
.dim { opacity:.25 !important }
.off { display:none !important }

/* load sequence */
.lane, .rail { opacity:0; transform:translateY(10px); transition:opacity .45s var(--ease) calc(var(--i,0)*60ms), transform .45s var(--ease) calc(var(--i,0)*60ms) }
body.ready .lane, body.ready .rail { opacity:1; transform:none }

/* inspector */
#panel { grid-area:panel; width:380px; overflow:auto; border-left:1px solid var(--line); background:var(--board); padding:20px 22px 40px }
#panel .in { opacity:0; transform:translateX(10px); transition:opacity .22s var(--ease), transform .22s var(--ease) }
#panel .in.show { opacity:1; transform:none }
#panel h2 { font-size:16px; font-weight:600; line-height:1.3; overflow-wrap:anywhere; margin-right:36px }
#panel .kind { color:var(--muted); margin-top:4px; font-size:13px } #panel .id { color:var(--faint); overflow-wrap:anywhere; display:block; margin-top:2px }
#panel h3 { font-size:12px; font-weight:500; color:var(--muted); margin:18px 0 6px; padding-bottom:4px; border-bottom:1px solid var(--line) }
#panel dl { display:grid; grid-template-columns:max-content minmax(0,1fr); gap:4px 14px; margin:10px 0 0; font-size:13px } #panel dt { color:var(--muted) } #panel dd { margin:0; overflow-wrap:anywhere }
#panel ul { margin:0; padding:0; list-style:none; display:grid; gap:4px; font-size:13px }
#panel li.rel { display:flex; gap:8px; align-items:baseline; padding:5px 8px; margin:0 -8px; border-radius:6px; cursor:pointer; transition:background .15s } #panel li.rel:hover { background:var(--hover) }
#panel li.rel .arrow { color:var(--faint); flex:none } #panel li.rel .type { color:var(--muted) } #panel li.rel .props { color:var(--faint); font-size:12px }
.cmd { display:flex; gap:8px; align-items:stretch; margin:6px 0 } .cmd code { flex:1; background:var(--code); border:1px solid var(--line); padding:7px 9px; border-radius:6px; overflow-wrap:anywhere; user-select:all }
.cmd button { flex:none; padding:0 11px; border:1px solid var(--line); border-radius:6px; font-size:12px; min-width:64px; text-align:center; transition:background .15s, color .15s } .cmd button:hover { background:var(--hover) }
.cmd button.done { background:var(--ink); color:var(--board); border-color:var(--ink) }
#panel .placeholder { color:var(--muted); font-size:13px; line-height:1.55 } #panel .placeholder kbd { font:inherit; color:var(--ink) }
#panel .close { display:none; position:absolute; right:14px; top:12px; width:32px; height:32px; border-radius:50%; text-align:center; line-height:30px; font-size:18px; color:var(--muted) }
#panel .close:hover { background:var(--hover); color:var(--ink) }

/* medium: rail wraps below the lanes, filters become a drawer */
@media (max-width: 1279px) { body.filters-open #filters { position:fixed; left:0; top:0; bottom:0; z-index:9; box-shadow:0 0 40px var(--scrim) } body.filters-open #scrim { display:block } }
@media (max-width: 1099px) {
  .layout { grid-template-columns:minmax(0,1fr) }
  body { grid-template-columns:auto minmax(0,1fr); grid-template-areas:"top top" "filters board" }
  #panel { position:fixed; left:0; right:0; bottom:0; width:auto; max-height:72vh; border-left:0; border-top:1px solid var(--line); border-radius:16px 16px 0 0; box-shadow:0 -12px 40px var(--scrim); z-index:7; transform:translateY(102%); transition:transform .28s var(--ease); padding:18px 20px calc(28px + env(safe-area-inset-bottom)) }
  #panel.open { transform:none } #panel .close { display:block } #panel .in { transform:none }
}
@media (max-width: 720px) {
  .top { padding:10px 14px; gap:10px } .brand .meta { display:none } #search { width:auto; flex:1; min-width:0 }
  .board { padding:14px 12px 120px } .lanes { gap:14px } .lane { padding:12px 14px 14px; border-radius:10px }
  .cols { grid-template-columns:1fr !important; gap:10px } .col.is-empty { display:none } .col h3 { border:0; padding:0; margin-bottom:4px }
  .edge:not(.lit):not(.selected) { display:none } /* on a phone the traces appear for the part you touch, not all at once */
}
.cols > .empty { grid-column:1 / -1 }
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after { transition:none !important; animation:none !important; scroll-behavior:auto !important }
  .lane, .rail, .led { opacity:1; transform:none } .edge[data-motion="draw"] path.vis { stroke-dashoffset:0 } .edge[data-motion="fade"] { opacity:1 }
}
</style>
</head>
<body>
<header class="top">
  <div class="brand"><h1>Knowledge bank</h1><p class="meta">__META__</p></div>
  <span class="spacer"></span>
  <input id="search" type="search" placeholder="Search parts and concepts" aria-label="Search parts and concepts" autocomplete="off">
  <button class="tool" id="filters-toggle" type="button" aria-expanded="false" aria-controls="filters">Filters</button>
</header>
<aside id="filters"><div class="in">
__FILTERS__
<fieldset><legend>Legend</legend><div class="legend">
<i class="led" style="--c:var(--reproduced)"></i><span>reproduced</span>
<i class="led" style="--c:var(--observed)"></i><span>observed</span>
<i class="led" style="--c:var(--unverified)"></i><span>unverified</span>
<i class="led" style="--c:var(--conflicting)"></i><span>conflicting</span>
<i class="led" style="--c:var(--observed); background:repeating-linear-gradient(45deg, var(--observed) 0 2px, var(--board) 2px 4px); box-shadow:0 0 0 1px var(--observed)"></i><span>past valid_to or superseded</span>
<svg viewBox="0 0 38 12"><path d="M1 6H37" stroke="var(--trace)" stroke-width="1.5" stroke-linecap="round"/></svg><span>about</span>
<svg viewBox="0 0 38 12"><path d="M1 6H37" stroke="var(--trace)" stroke-width="1.5" stroke-dasharray="2 4" stroke-linecap="round"/></svg><span>discovered in</span>
<svg viewBox="0 0 38 12"><path d="M1 6H37" stroke="var(--trace)" stroke-width="1.5" stroke-dasharray="7 5" stroke-linecap="round"/></svg><span>transfer proposed</span>
<svg viewBox="0 0 38 12"><path d="M1 6H37" stroke="var(--reproduced)" stroke-width="2" stroke-linecap="round"/></svg><span>transfer confirmed</span>
<svg viewBox="0 0 38 12"><path d="M1 6H37" stroke="var(--conflicting)" stroke-width="1.5" stroke-dasharray="7 5" stroke-linecap="round"/><text x="19" y="10" text-anchor="middle" font-size="11" font-weight="700" fill="var(--conflicting)">×</text></svg><span>transfer refuted</span>
<svg viewBox="0 0 38 12"><path d="M1 6H37" stroke="var(--trace)" stroke-width="1.5" stroke-linecap="round"/><text x="19" y="4" text-anchor="middle" font-size="7" fill="var(--muted)">gate</text></svg><span>validated in, labelled with the gate</span>
<svg viewBox="0 0 38 12"><path d="M1 6H37" stroke="var(--trace)" stroke-width="1.5" stroke-linecap="round" opacity=".3"/></svg><span>supersedes</span>
</div></fieldset>
</div></aside>
<div id="scrim"></div>
<main class="board" id="board">
<div class="layout">
__BOARD__
</div>
<svg class="wires">__EDGES__</svg>
</main>
<aside id="panel" aria-live="polite"><button class="close" type="button" aria-label="Close">×</button><div class="in show placeholder">Select a part, an LED, a concept or a trace to inspect it. Hover anything to light up what it connects to.<br><br>Type in the search box to find a part by name. <kbd>Esc</kbd> clears the selection.</div></aside>
<script id="data" type="application/json">__DATA__</script>
<script>
(() => {
  const data = JSON.parse(document.getElementById('data').textContent);
  const $ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const byId = (id) => document.querySelector('[data-id="' + CSS.escape(id) + '"]:not(.edge)');
  const board = document.getElementById('board'), wires = document.querySelector('.wires'), panel = document.getElementById('panel'), body = document.body;
  const small = matchMedia('(max-width: 720px)'), narrow = matchMedia('(max-width: 1099px)'), wide = matchMedia('(min-width: 1280px)');
  const edges = $('.edge');
  const adj = new Map();
  for (const e of edges) { const { src, dst, id } = e.dataset; (adj.get(src) ?? adj.set(src, []).get(src)).push({ e, other: dst }); (adj.get(dst) ?? adj.set(dst, []).get(dst)).push({ e, other: src }); }

  // --- filters ---------------------------------------------------------------------------------------------------------------
  const checked = (name) => new Set($('input[data-filter="' + name + '"]:checked').map((i) => i.value));
  function apply() {
    const dom = checked('domain'), st = checked('state'), axes = { environment: checked('environment'), subject: checked('subject') };
    const gateMin = Number(document.getElementById('gate-min').value), validToday = document.getElementById('valid-today').checked;
    const hasEv = document.getElementById('has-evidence').checked, proposed = document.getElementById('show-proposed').checked;
    const hidden = new Set();
    const axisOk = (el) => Object.keys(axes).every((k) => { const v = el.dataset[k]; return !v || v.split('|').some((x) => axes[k].has(x)); });
    for (const l of $('.lane')) { const off = !dom.has(l.dataset.domain); l.classList.toggle('off', off); if (off) for (const e of $('[data-id]', l)) hidden.add(e.dataset.id); }
    for (const n of $('.node')) { const off = hidden.has(n.dataset.id) || !axisOk(n); n.classList.toggle('off', off); if (off) hidden.add(n.dataset.id); }
    for (const b of $('.badge')) {
      const d = b.dataset;
      const off = hidden.has(d.id) || !dom.has(d.domain) || !st.has(d.state) || Number(d.gateRank) < gateMin || (validToday && d.validToday !== '1')
        || (hasEv && d.evidence !== '1') || !axisOk(b) || (d.attach && hidden.has(d.attach));
      b.classList.toggle('off', off); if (off) hidden.add(d.id);
    }
    for (const e of edges) { const d = e.dataset; e.classList.toggle('off', hidden.has(d.src) || hidden.has(d.dst) || (d.type === 'transfer' && d.state === 'proposed' && !proposed)); }
    layout();
  }
  function search(q) {
    q = q.trim().toLowerCase();
    for (const el of $('.node, .badge, .concept')) el.classList.toggle('dim', !!q && !el.textContent.toLowerCase().includes(q));
  }

  // --- traces: routed from the measured HTML parts ------------------------------------------------------------------------------
  function rect(el) { const b = board.getBoundingClientRect(), r = el.getBoundingClientRect(); const x = r.left - b.left + board.scrollLeft, y = r.top - b.top + board.scrollTop; return { l: x, r: x + r.width, t: y, b: y + r.height, cx: x + r.width / 2, cy: y + r.height / 2 }; }
  const visible = (el) => !!el && el.getClientRects().length > 0;
  // Traces to the concept rail run as a bus in the gutter between the lanes and the rail: out of the part, along the bus, into the hub.
  function bus(a, b, x) {
    const p = [a.r, a.cy], q = [b.l, b.cy], r = 10, s = Math.sign(q[1] - p[1]);
    if (Math.abs(q[1] - p[1]) < 2 * r + 2) return { p, q, d: 'M' + p + 'L' + q, mid: [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2] };
    return { p, q, d: 'M' + p + 'H' + (x - r) + 'Q' + [x, p[1]] + ' ' + [x, p[1] + s * r] + 'V' + (q[1] - s * r) + 'Q' + [x, q[1]] + ' ' + [x + r, q[1]] + 'H' + q[0], mid: [x, (p[1] + q[1]) / 2] };
  }
  // Two parts in the same column: a bracket out of their right edges, so the relation reads as a connection and not a stub.
  function bracket(a, b) {
    const p = [a.r, a.cy], q = [b.r, b.cy], r = 10, s = Math.sign(q[1] - p[1]), x = Math.max(a.r, b.r) + 16;
    return { p, q, d: 'M' + p + 'H' + (x - r) + 'Q' + [x, p[1]] + ' ' + [x, p[1] + s * r] + 'V' + (q[1] - s * r) + 'Q' + [x, q[1]] + ' ' + [x - r, q[1]] + 'H' + q[0], mid: [x, (p[1] + q[1]) / 2] };
  }
  function route(a, b, gutter) {
    if (gutter && b.l >= a.r + 6) return bus(a, b, gutter);
    const overlapX = Math.min(a.r, b.r) - Math.max(a.l, b.l) > 0, apart = b.t >= a.b - 2 || a.t >= b.b - 2;
    if (overlapX && apart && Math.abs(b.cy - a.cy) > 24) return bracket(a, b);
    if (b.l >= a.r + 6) { const p = [a.r, a.cy], q = [b.l, b.cy], dx = Math.max(28, (q[0] - p[0]) / 2); return { p, q, d: 'M' + p + 'C' + [p[0] + dx, p[1]] + ' ' + [q[0] - dx, q[1]] + ' ' + q, mid: [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2] }; }
    if (a.l >= b.r + 6) { const p = [a.l, a.cy], q = [b.r, b.cy], dx = Math.max(28, (p[0] - q[0]) / 2); return { p, q, d: 'M' + p + 'C' + [p[0] - dx, p[1]] + ' ' + [q[0] + dx, q[1]] + ' ' + q, mid: [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2] }; }
    if (b.t >= a.b - 2 || a.t >= b.b - 2) { const down = b.t >= a.b - 2, p = down ? [a.cx, a.b] : [a.cx, a.t], q = down ? [b.cx, b.t] : [b.cx, b.b], dy = Math.max(20, Math.abs(q[1] - p[1]) / 2) * (down ? 1 : -1); return { p, q, d: 'M' + p + 'C' + [p[0], p[1] + dy] + ' ' + [q[0], q[1] - dy] + ' ' + q, mid: [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2] }; }
    return null; // one part sits inside the other (an LED on its own part): the mounting already shows the relation
  }
  let drawn = false;
  function layout() {
    wires.setAttribute('width', board.scrollWidth); wires.setAttribute('height', board.scrollHeight);
    wires.style.width = board.scrollWidth + 'px'; wires.style.height = board.scrollHeight + 'px';
    let i = 0;
    const lanesR = rect(board.querySelector('.lanes')), railEl = board.querySelector('.rail'), railR = railEl ? rect(railEl) : null;
    const gutterOk = railR && railR.l >= lanesR.r + 30, hubs = $('.concept');
    const busX = (concept) => gutterOk ? lanesR.r + 10 + (hubs.indexOf(concept) % 4) * 7 : 0;
    for (const e of edges) {
      let a = byId(e.dataset.src), b = byId(e.dataset.dst);
      const ok = !e.classList.contains('off') && visible(a) && visible(b);
      if (ok && a.classList.contains('concept') && !b.classList.contains('concept')) [a, b] = [b, a]; // draw concept traces from the part side
      const r = ok ? route(rect(a), rect(b), b.classList.contains('concept') && !a.classList.contains('concept') ? busX(b) : 0) : null;
      e.style.display = r ? '' : 'none';
      if (!r) continue;
      for (const p of $('path', e)) p.setAttribute('d', r.d);
      const vis = e.querySelector('path.vis'); vis.style.setProperty('--len', vis.getTotalLength().toFixed(1));
      const gate = e.querySelector('text.gate'); if (gate) { gate.setAttribute('x', r.q[0] - 8); gate.setAttribute('y', r.q[1] - 10); gate.setAttribute('text-anchor', 'end'); }
      const x = e.querySelector('text.x'); if (x) { x.setAttribute('x', r.mid[0]); x.setAttribute('y', r.mid[1] + 5); x.setAttribute('text-anchor', 'middle'); }
      if (!drawn) e.style.setProperty('--i', i++);
    }
    if (!drawn) { body.style.setProperty('--stagger', Math.max(6, Math.min(25, 600 / Math.max(1, i))) + 'ms'); }
  }

  // --- neighbourhood highlight --------------------------------------------------------------------------------------------------
  let selected = null;
  function highlight(id) {
    for (const el of $('.near, .lit')) el.classList.remove('near', 'lit');
    body.classList.toggle('focus', !!id);
    if (!id) return;
    const self = byId(id); if (self) self.classList.add('near');
    for (const { e, other } of adj.get(id) ?? []) { e.classList.add('lit'); const o = byId(other); if (o) o.classList.add('near'); }
    const edge = edges.find((e) => e.dataset.id === id);
    if (edge) { edge.classList.add('lit'); for (const k of ['src', 'dst']) { const o = byId(edge.dataset[k]); if (o) o.classList.add('near'); } }
  }

  // --- inspector -----------------------------------------------------------------------------------------------------------------
  const metric = (k, vs) => { if (!k.startsWith('metric:')) return null; const [v, unit, better, base] = vs[0].split('|'); return k.slice(7) + ' ' + v + (unit ? ' ' + unit : '') + (better ? ', ' + better + ' is better' : '') + (base ? ', baseline ' + base : ''); };
  function show(id) {
    const it = data.items[id]; if (!it) return;
    for (const e of $('.selected')) e.classList.remove('selected');
    const el = document.querySelector('[data-id="' + CSS.escape(id) + '"]'); if (el) el.classList.add('selected');
    selected = id; highlight(id);
    const box = document.createElement('div'); box.className = 'in';
    const add = (tag, text, cls, parent = box) => { const e = document.createElement(tag); if (text != null) e.textContent = text; if (cls) e.className = cls; parent.appendChild(e); return e; };
    add('h2', it.title); add('p', it.kind + (it.domain ? ' in ' + it.domain : '') + (it.project ? ', project ' + it.project : ''), 'kind'); add('span', it.id, 'id');
    const attrs = Object.entries(it.attrs);
    if (attrs.length) { const dl = add('dl'); for (const [k, vs] of attrs) { const m = metric(k, vs); add('dt', m ? 'metric' : k.replace(/^facet:/, ''), null, dl); add('dd', m ?? vs.join(', '), null, dl); } }
    if (it.evidence.length) { add('h3', 'Evidence'); const ul = add('ul'); for (const e of it.evidence) add('li', e, null, ul); }
    if (it.rels.length) {
      add('h3', 'Relations'); const ul = add('ul');
      for (const r of it.rels) { const li = add('li', null, 'rel', ul); add('span', r.dir === 'out' ? '→' : '←', 'arrow', li); const t = add('span', null, null, li); add('span', r.type.replace(/_/g, ' ') + ' ', 'type', t); t.appendChild(document.createTextNode(r.other)); if (r.props) add('span', ' ' + r.props, 'props', t); li.onclick = () => { show(r.otherId); const o = byId(r.otherId); if (o) o.scrollIntoView({ block: 'nearest', inline: 'nearest' }); }; }
    }
    if (it.commands.length) {
      add('h3', 'Commands');
      for (const c of it.commands) { const row = add('div', null, 'cmd'); add('code', c, null, row); const b = add('button', 'Copy', null, row); b.type = 'button';
        b.onclick = async () => { try { await navigator.clipboard.writeText(c); b.textContent = 'Copied'; b.classList.add('done'); setTimeout(() => { b.textContent = 'Copy'; b.classList.remove('done'); }, 1200); } catch { b.textContent = 'Select and copy'; } }; }
    }
    const old = panel.querySelector('.in'); if (old) old.remove();
    panel.appendChild(box); requestAnimationFrame(() => box.classList.add('show'));
    panel.classList.add('open'); panel.scrollTop = 0;
  }
  function clear() {
    for (const e of $('.selected')) e.classList.remove('selected');
    selected = null; highlight(null); panel.classList.remove('open');
  }

  // --- wiring ----------------------------------------------------------------------------------------------------------------------
  const target = (ev) => ev.target.closest && ev.target.closest('[data-id]');
  document.addEventListener('click', (ev) => { const t = target(ev); if (t) { show(t.dataset.id); return; } if (ev.target.closest('#panel, #filters, .top')) return; clear(); });
  document.addEventListener('keydown', (ev) => {
    if (ev.key === 'Escape') { clear(); setFilters(false); return; }
    if (ev.key !== 'Enter' && ev.key !== ' ') return; const t = target(ev); if (t && t.classList.contains('edge')) { ev.preventDefault(); show(t.dataset.id); }
  });
  board.addEventListener('pointerover', (ev) => { const t = target(ev); if (t) highlight(t.dataset.id); });
  board.addEventListener('pointerout', (ev) => { const t = target(ev); if (t && !(ev.relatedTarget && ev.relatedTarget.closest && ev.relatedTarget.closest('[data-id]') === t)) highlight(selected); });
  board.addEventListener('focusin', (ev) => { const t = target(ev); if (t) highlight(t.dataset.id); });
  board.addEventListener('focusout', () => highlight(selected));
  panel.querySelector('.close').addEventListener('click', clear);
  for (const i of $('#filters input, #filters select')) i.addEventListener('change', apply);
  document.getElementById('search').addEventListener('input', (ev) => search(ev.target.value));
  const toggle = document.getElementById('filters-toggle');
  function setFilters(open) { body.classList.toggle('filters-open', open); toggle.setAttribute('aria-expanded', String(open)); }
  toggle.addEventListener('click', () => setFilters(!body.classList.contains('filters-open')));
  document.getElementById('scrim').addEventListener('click', () => setFilters(false));
  setFilters(wide.matches);
  new ResizeObserver(() => layout()).observe(board.querySelector('.layout'));
  addEventListener('resize', layout);
  $('.lane, .rail').forEach((el, i) => el.style.setProperty('--i', i));
  $('.led').forEach((el, i) => el.style.setProperty('--i', i));
  apply();
  requestAnimationFrame(() => requestAnimationFrame(() => { body.classList.add('ready'); setTimeout(() => { drawn = true; }, 1500); }));
})();
</script>
</body>
</html>
`;
