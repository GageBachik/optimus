/** DESIGN §4.11: the page shell. No external script or stylesheet; the inline script only filters by data-* attributes, routes the
 *  trace overlay from the measured positions of the HTML parts, highlights neighbours and fills the inspector.
 *  Placeholders __META__, __FILTERS__, __BOARD__, __EDGES__ and __DATA__ are filled by generateMap.
 *
 *  Visual system (after cathrynlavery/diagram-design): dark paper, hairline borders, no shadows, a 4 px grid, one accent colour used
 *  only for the focal element (the selection and its traces), serif title, sans names, mono for technical labels. Connectors are
 *  orthogonal with rounded elbows, fan out along a shared edge, and are drawn behind the parts. One reveal on load; afterwards motion
 *  only answers an action. Findings are LEDs on the part they are about (colour = state); concepts are a rail on the left; relations
 *  are traces. */
export const TEMPLATE = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>Knowledge bank</title>
<style>
:root { color-scheme:dark;
  --paper:#232634; --paper-2:#2d3142; --paper-3:#373b4e; --ink:#f5f5f5; --muted:#bfc0c0; --soft:#8d909b; --rule:#3f4357; --rule-solid:#5b6078;
  --accent:#f08a59; --accent-tint:rgba(240,138,89,.14); --dim:.35;
  --reproduced:#7bd389; --observed:#7aaef5; --unverified:#e6c062; --conflicting:#ef6f6f;
  --sans:system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; --serif:"Iowan Old Style", "Palatino Linotype", Palatino, "Book Antiqua", Georgia, serif;
  --mono:ui-monospace, "SF Mono", Menlo, Consolas, monospace; --ease:cubic-bezier(.2,0,0,1); --stagger:25ms; }

* { box-sizing:border-box }
html, body { height:100% }
body { margin:0; background:var(--paper); color:var(--ink); font:14px/1.45 var(--sans); display:grid; grid-template-rows:auto minmax(0,1fr); grid-template-columns:minmax(0,1fr) auto; grid-template-areas:"top top" "board panel"; overflow:hidden }
button { font:inherit; color:inherit; background:none; border:0; padding:0; cursor:pointer; text-align:left }
:focus-visible { outline:2px solid var(--accent); outline-offset:2px; border-radius:6px }
h1, h2, h3, p { margin:0 }
.eyebrow { font:500 11px/1.4 var(--mono); letter-spacing:.14em; text-transform:uppercase; color:var(--soft) }
code, .id { font:12px/1.4 var(--mono) }

/* top bar */
.top { grid-area:top; display:flex; align-items:center; gap:16px; padding:12px 24px; border-bottom:1px solid var(--rule); background:var(--paper) }
.brand { min-width:0 } .brand .eyebrow { white-space:nowrap; overflow:hidden; text-overflow:ellipsis } .brand h1 { font:400 24px/1.1 var(--serif); letter-spacing:-.01em; margin-top:2px; white-space:nowrap }
.spacer { flex:1 }
#search { width:min(280px, 36vw); padding:8px 12px; border:1px solid var(--rule); border-radius:8px; background:var(--paper-2); color:var(--ink); font:inherit; font-size:13px }
#search::placeholder { color:var(--soft) }
.tool { padding:8px 12px; border:1px solid var(--rule); border-radius:8px; font-size:13px; white-space:nowrap; transition:background .15s, border-color .15s }
.tool:hover { background:var(--paper-2) } .tool[aria-expanded="true"], .tool[aria-pressed="true"] { background:var(--paper-2); border-color:var(--rule-solid) }

/* filters drawer (left, over the board) */
#filters { position:fixed; left:0; top:0; bottom:0; width:288px; z-index:9; background:var(--paper-2); border-right:1px solid var(--rule); overflow:auto; padding:20px 24px 32px; transform:translateX(-100%); transition:transform .25s var(--ease) }
body.filters-open #filters { transform:none }
#scrim { display:none; position:fixed; inset:0; background:rgba(0,0,0,.45); z-index:8 } body.filters-open #scrim { display:block }
#filters .head { display:flex; align-items:center; justify-content:space-between; margin-bottom:20px } #filters .head h2 { font:400 20px/1.1 var(--serif) }
.close { width:32px; height:32px; border-radius:50%; text-align:center; line-height:30px; font-size:18px; color:var(--muted); transition:background .15s } .close:hover { background:var(--paper-3); color:var(--ink) }
#filters fieldset { border:0; padding:0; margin:0 0 20px } #filters legend { padding:0; margin-bottom:8px }
#filters label { display:flex; gap:10px; align-items:flex-start; padding:4px 0; font-size:13px; cursor:pointer; overflow-wrap:anywhere }
#filters input[type="checkbox"] { margin:2px 0 0; accent-color:var(--accent) }
#filters select { width:100%; margin-top:4px; padding:6px 8px; border:1px solid var(--rule); border-radius:6px; background:var(--paper); color:var(--ink); font:inherit; font-size:13px }
.none { color:var(--soft); font-size:13px }
.legend { display:grid; grid-template-columns:40px 1fr; gap:8px 12px; align-items:center; font-size:13px; color:var(--muted) }
.legend svg { width:40px; height:12px; display:block } .legend .led { display:block; margin:0 auto; opacity:1 }

/* board */
.board { grid-area:board; position:relative; overflow:auto; padding:24px 24px 48px }
.layout { display:grid; grid-template-columns:232px minmax(0,1fr); gap:24px 72px; align-items:start; position:relative }
.rail { background:var(--paper-2); border:1px solid var(--rule); border-radius:10px; padding:16px; min-width:0 }
.rail > header { margin-bottom:12px } .rail h2 { font:600 15px/1.3 var(--sans) } .rail .hint { color:var(--soft); font-size:12px; margin-top:4px }
.rail ul { list-style:none; margin:0; padding:0; display:grid; gap:2px }
.concept { display:flex; gap:12px; align-items:center; width:100%; padding:6px 0 6px 8px; border-radius:6px; font-size:13px; line-height:1.35; transition:background .15s, opacity .18s }
.concept:hover, .concept.near { background:var(--paper-3) }
.concept > span:first-child { flex:1; min-width:0; overflow-wrap:anywhere }
.concept .n { color:var(--soft); font:500 11px var(--mono); letter-spacing:.06em; white-space:nowrap }
.concept .hub { flex:none; width:8px; height:8px; border-radius:50%; background:var(--ink); border:1.5px solid var(--ink) }
.concept.hollow .hub { background:transparent } .concept.multi { font-weight:600 }
.rail .findings { padding:0 16px 8px 8px }
.lanes { display:grid; gap:16px; min-width:0 }
.stages { display:grid; gap:0 40px; padding:0 17px } .stages .eyebrow { padding-bottom:4px }
.lane { background:var(--paper-2); border:1px solid var(--rule); border-radius:10px; padding:16px; min-width:0 }
.lane > header { display:flex; align-items:baseline; gap:12px; flex-wrap:wrap; margin-bottom:12px } .lane h2 { font:600 15px/1.3 var(--sans) }
.cols { display:grid; gap:12px 40px }
.col .parts { display:grid; gap:8px; align-content:start } .col .stage-sm { display:none }
.node { position:relative; border:1px solid var(--rule-solid); border-radius:6px; background:var(--paper); transition:border-color .15s, opacity .18s }
.node[data-kind="target"] { background:transparent; border-style:dashed } .node[data-kind="theme"] { background:var(--paper-3) }
.node:hover, .node.near { border-color:var(--muted) }
.node .part { display:block; width:100%; padding:8px 12px; font-weight:500; font-size:13px; line-height:1.35; border-radius:6px }
.node .part > span, .badge > span { display:-webkit-box; -webkit-box-orient:vertical; -webkit-line-clamp:3; overflow:hidden; overflow-wrap:anywhere }
.findings { list-style:none; margin:0; padding:0 8px 8px }
.findings li.hidden-more { display:none } .expanded > .findings li.hidden-more, li.expanded > .findings li.hidden-more { display:block }
.more { padding:4px 4px 2px 20px; letter-spacing:.08em; color:var(--soft) } .more:hover { color:var(--ink) }
body.quiet .edge:not(.lit):not(.selected) { display:none }
.badge { display:flex; gap:8px; align-items:flex-start; width:100%; padding:4px; border-radius:6px; font-size:12px; line-height:1.35; color:var(--muted); transition:color .15s, opacity .18s }
.badge:hover, .badge.near, .badge.selected { color:var(--ink) }
.badge .led { margin-top:4px }
.led { flex:none; display:inline-block; width:8px; height:8px; border-radius:50%; background:var(--c, var(--soft)); border:1px solid var(--paper-2); opacity:0; transition:opacity .3s ease-out calc(.9s + var(--i,0)*40ms) }
body.ready .led { opacity:1 }
[data-state="reproduced"] .led { --c:var(--reproduced) } [data-state="observed"] .led { --c:var(--observed) }
[data-state="unverified"] .led { --c:var(--unverified) } [data-state="conflicting"] .led { --c:var(--conflicting) }
[data-expired="1"] .led, [data-superseded="1"] .led { background:repeating-linear-gradient(45deg, var(--c) 0 2px, var(--paper-2) 2px 4px); border-color:var(--c) }
.loose { grid-column:1 / -1 } .loose .eyebrow { margin:8px 0 4px }
.empty { grid-column:1 / -1; color:var(--soft); font-size:13px }
.selected { outline:2px solid var(--accent); outline-offset:2px; border-radius:6px }

/* traces: drawn behind the parts */
.wires { position:absolute; left:0; top:0; pointer-events:none; overflow:visible; z-index:2 }
.node, .rail li, .lane > header, .stages, .loose .eyebrow, .empty { position:relative; z-index:3 }
.edge path.vis { fill:none; stroke:var(--muted); stroke-width:1.25; stroke-linecap:round; stroke-linejoin:round; opacity:.45; transition:stroke .15s, stroke-width .15s, opacity .18s }
.edge path.hit { fill:none; stroke:transparent; stroke-width:10; pointer-events:stroke; cursor:pointer }
.edge[data-motion="draw"] path.vis { stroke-dasharray:var(--len, 1); stroke-dashoffset:var(--len, 1); transition:stroke-dashoffset .7s var(--ease) calc(.3s + var(--i,0)*var(--stagger)), stroke .15s, stroke-width .15s, opacity .18s }
body.ready .edge[data-motion="draw"] path.vis { stroke-dashoffset:0 }
.edge[data-motion="fade"] { opacity:0; transition:opacity .5s ease-out calc(.4s + var(--i,0)*var(--stagger)) } body.ready .edge[data-motion="fade"] { opacity:1 }
.edge[data-type="discovered_in"] path.vis { stroke-dasharray:2 4 }
.edge[data-type="transfer"] path.vis { stroke-dasharray:5 4 }
.edge[data-type="transfer"][data-state^="confirmed"] path.vis { stroke:var(--ink); stroke-dasharray:none; stroke-width:1.75; opacity:.8 }
.edge[data-type="transfer"][data-state="refuted"] path.vis { opacity:.3 }
.edge[data-type="supersedes"] path.vis { opacity:.2 } .edge[data-type="conflicts_with"] path.vis { stroke:var(--conflicting); stroke-dasharray:1 4 }
.edge text { font:500 10px var(--mono); letter-spacing:.1em; text-transform:uppercase; fill:var(--soft); paint-order:stroke; stroke:var(--paper-2); stroke-width:4px; stroke-linejoin:round }
.edge text.x { font:700 14px var(--sans); letter-spacing:0; fill:var(--conflicting) }
.edge.lit path.vis, .edge:hover path.vis, .edge.selected path.vis, .edge:focus-visible path.vis { stroke:var(--accent); stroke-width:2; opacity:1 }
.edge.lit text, .edge.selected text { fill:var(--accent) }
.edge.selected, .edge:focus-visible { outline:none }
body.focus .edge:not(.lit):not(.selected) { opacity:.12 }
/* while something is lit, the highlighted traces and their gate labels float above the dimmed parts instead of hiding behind them */
body.focus .wires { z-index:4 } body.focus .edge:not(.lit):not(.selected) path.hit { pointer-events:none }
body.dense .edge.lit path.vis { opacity:.55; stroke-width:1.5 } /* a part with dozens of relations: thinner, quieter lines instead of a solid block */
body.focus .node:not(.near):not(.selected):not(:has(.selected)), body.focus .badge:not(.near):not(.selected), body.focus .concept:not(.near):not(.selected) { opacity:var(--dim) }
body.focus .node:has(.badge.near) { opacity:1 }
.dim { opacity:.25 !important }
.off { display:none !important }

/* the one reveal */
.lane, .rail { opacity:0; transform:translateY(8px); transition:opacity .45s var(--ease) calc(var(--i,0)*60ms), transform .45s var(--ease) calc(var(--i,0)*60ms) }
body.ready .lane, body.ready .rail { opacity:1; transform:none }

/* inspector (right, pushes the board) */
#panel { grid-area:panel; width:0; overflow:hidden; border-left:1px solid transparent; background:var(--paper-2); transition:width .25s var(--ease) }
body.panel-open #panel { width:360px; overflow:auto; border-left-color:var(--rule) }
#panel .in { position:relative; width:360px; padding:20px 24px 40px; opacity:0; transform:translateX(8px); transition:opacity .22s var(--ease), transform .22s var(--ease) }
#panel .in.show { opacity:1; transform:none }
#panel .close { position:absolute; right:16px; top:14px }
#panel h2 { font:600 15px/1.35 var(--sans); overflow-wrap:anywhere; margin-right:40px }
#panel .kind { color:var(--muted); margin-top:4px; font-size:13px } #panel .id { color:var(--soft); display:block; margin-top:4px; overflow-wrap:anywhere }
#panel h3 { margin:20px 0 8px; padding-bottom:6px; border-bottom:1px solid var(--rule) }
#panel dl { display:grid; grid-template-columns:max-content minmax(0,1fr); gap:4px 16px; margin:12px 0 0; font-size:13px } #panel dt { color:var(--muted) } #panel dd { margin:0; overflow-wrap:anywhere }
#panel ul { margin:0; padding:0; list-style:none; display:grid; gap:4px; font-size:13px }
#panel li.rel { display:flex; gap:8px; align-items:baseline; padding:6px 8px; margin:0 -8px; border-radius:6px; cursor:pointer; transition:background .15s } #panel li.rel:hover { background:var(--paper-3) }
#panel li.rel .arrow { color:var(--soft); flex:none } #panel li.rel .type { color:var(--muted) } #panel li.rel .props { color:var(--soft); font-size:12px }
.cmd { display:flex; gap:8px; align-items:stretch; margin:8px 0 } .cmd code { flex:1; background:var(--paper); border:1px solid var(--rule); padding:8px 10px; border-radius:6px; overflow-wrap:anywhere; user-select:all }
.cmd button { flex:none; padding:0 12px; border:1px solid var(--rule); border-radius:6px; font-size:12px; min-width:64px; text-align:center; transition:background .15s, color .15s } .cmd button:hover { background:var(--paper-3) }
.cmd button.done { background:var(--accent); color:var(--paper); border-color:var(--accent) }
#panel .placeholder { color:var(--muted); font-size:13px; line-height:1.55; margin-right:40px } #panel .placeholder kbd { font:inherit; color:var(--ink) }

@media (max-width: 1099px) {
  body { grid-template-columns:minmax(0,1fr); grid-template-areas:"top" "board" }
  .layout { grid-template-columns:minmax(0,1fr); gap:16px } .rail { order:2 }
  #panel { position:fixed; left:0; right:0; bottom:0; width:auto; max-height:72vh; overflow:auto; border-left:0; border-top:1px solid var(--rule); border-radius:12px 12px 0 0; z-index:7; transform:translateY(102%); transition:transform .28s var(--ease) }
  body.panel-open #panel { width:auto; transform:none } #panel .in { width:auto; transform:none; padding-bottom:calc(28px + env(safe-area-inset-bottom)) }
}
@media (max-width: 720px) {
  .top { padding:10px 16px; gap:10px } .brand .eyebrow { display:none } .brand h1 { font-size:20px } #search { width:auto; flex:1; min-width:0 }
  .board { padding:16px 12px 120px } .lanes { gap:12px } .lane { padding:12px }
  .stages { display:none } .cols { grid-template-columns:1fr !important; gap:12px } .col.is-empty { display:none } .col .stage-sm { display:block; margin-bottom:6px }
  .edge:not(.lit):not(.selected) { display:none } /* on a phone the traces appear for the part you touch, not all at once */
}
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after { transition:none !important; animation:none !important }
  .lane, .rail, .led { opacity:1; transform:none } .edge[data-motion="draw"] path.vis { stroke-dashoffset:0 } .edge[data-motion="fade"] { opacity:1 }
}
</style>
</head>
<body>
<header class="top">
  <div class="brand"><p class="eyebrow">__META__</p><h1>Knowledge bank</h1></div>
  <span class="spacer"></span>
  <input id="search" type="search" placeholder="Search parts and concepts" aria-label="Search parts and concepts" autocomplete="off">
  <button class="tool" id="filters-toggle" type="button" aria-expanded="false" aria-controls="filters">Filters</button>
  <button class="tool" id="panel-toggle" type="button" aria-pressed="false" aria-controls="panel">Inspector</button>
</header>
<aside id="filters"><div class="head"><h2>Filters</h2><button class="close" type="button" aria-label="Close filters">×</button></div>
__FILTERS__
</aside>
<div id="scrim"></div>
<main class="board" id="board">
<div class="layout">
__BOARD__
</div>
<svg class="wires">__EDGES__</svg>
</main>
<aside id="panel"><div class="in show"><button class="close" type="button" aria-label="Close inspector">×</button><p class="placeholder">Select a part, an LED, a concept or a trace to inspect it. Hover anything to light up what it connects to.<br><br>Type in the search box to find a part by name. <kbd>Esc</kbd> clears the selection.</p></div></aside>
<script id="data" type="application/json">__DATA__</script>
<script>
(() => {
  const data = JSON.parse(document.getElementById('data').textContent);
  const $ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const byId = (id) => document.querySelector('[data-id="' + CSS.escape(id) + '"]:not(.edge)');
  const board = document.getElementById('board'), wires = document.querySelector('.wires'), panel = document.getElementById('panel'), body = document.body;
  const edges = $('.edge');
  const adj = new Map();
  for (const e of edges) { const { src, dst } = e.dataset; (adj.get(src) ?? adj.set(src, []).get(src)).push({ e, other: dst }); (adj.get(dst) ?? adj.set(dst, []).get(dst)).push({ e, other: src }); }

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
    body.classList.toggle('quiet', !document.getElementById('show-traces').checked);
    layout();
  }
  function search(q) {
    q = q.trim().toLowerCase();
    for (const el of $('.node, .badge, .concept')) el.classList.toggle('dim', !!q && !el.textContent.toLowerCase().includes(q));
  }

  // --- traces: orthogonal, rounded elbows, fanned attach points, routed from the measured parts ----------------------------------
  const R = 8;
  function rect(el) { const b = board.getBoundingClientRect(), r = el.getBoundingClientRect(); const l = r.left - b.left + board.scrollLeft, t = r.top - b.top + board.scrollTop; return { l, t, r: l + r.width, b: t + r.height, w: r.width, h: r.height, cx: l + r.width / 2, cy: t + r.height / 2 }; }
  const visible = (el) => !!el && el.getClientRects().length > 0;
  const sgn = (v) => (v < 0 ? -1 : 1);
  // horizontal → vertical → horizontal through x = mx (or straight when the ends share a row)
  function elbowH(p, q, mx) {
    const dy = q[1] - p[1]; if (Math.abs(dy) < 1) return 'M' + p + 'L' + q;
    const r = Math.min(R, Math.abs(dy) / 2, Math.abs(mx - p[0]), Math.abs(q[0] - mx)), sx1 = sgn(mx - p[0]), sx2 = sgn(q[0] - mx), sy = sgn(dy);
    return 'M' + p + 'H' + (mx - sx1 * r) + 'Q' + [mx, p[1]] + ' ' + [mx, p[1] + sy * r] + 'V' + (q[1] - sy * r) + 'Q' + [mx, q[1]] + ' ' + [mx + sx2 * r, q[1]] + 'H' + q[0];
  }
  // vertical → horizontal → vertical through y = my
  function elbowV(p, q, my) {
    const dx = q[0] - p[0]; if (Math.abs(dx) < 1) return 'M' + p + 'L' + q;
    const r = Math.min(R, Math.abs(dx) / 2, Math.abs(my - p[1]), Math.abs(q[1] - my)), sy1 = sgn(my - p[1]), sy2 = sgn(q[1] - my), sx = sgn(dx);
    return 'M' + p + 'V' + (my - sy1 * r) + 'Q' + [p[0], my] + ' ' + [p[0] + sx * r, my] + 'H' + (q[0] - sx * r) + 'Q' + [q[0], my] + ' ' + [q[0], my + sy2 * r] + 'V' + q[1];
  }
  let drawn = false;
  function layout() {
    wires.setAttribute('width', board.scrollWidth); wires.setAttribute('height', board.scrollHeight);
    wires.style.width = board.scrollWidth + 'px'; wires.style.height = board.scrollHeight + 'px';
    const lanesEl = board.querySelector('.lanes'), railEl = board.querySelector('.rail');
    const lanesR = rect(lanesEl), railR = railEl && visible(railEl) ? rect(railEl) : null, hubs = $('.concept');
    const busOk = !!railR && lanesR.l >= railR.r + 40;
    const items = [];
    for (const e of edges) {
      let a = byId(e.dataset.src), b = byId(e.dataset.dst);
      const ok = !e.classList.contains('off') && visible(a) && visible(b);
      if (!ok) { e.style.display = 'none'; continue; }
      if (a.classList.contains('concept') && !b.classList.contains('concept')) [a, b] = [b, a]; // part first, concept second
      const A = rect(a), B = rect(b), toConcept = b.classList.contains('concept') && !a.classList.contains('concept');
      const overlapX = Math.min(A.r, B.r) - Math.max(A.l, B.l) > 0, apart = B.t >= A.b - 2 || A.t >= B.b - 2;
      let kind, sa, sb;
      if (toConcept && busOk) { kind = 'bus'; sa = 'left'; sb = 'right'; }
      else if (B.l >= A.r + 8) { kind = 'h'; sa = 'right'; sb = 'left'; }
      else if (A.l >= B.r + 8) { kind = 'h'; sa = 'left'; sb = 'right'; }
      else if (overlapX && apart && Math.abs(B.cy - A.cy) > 24) { kind = 'bracket'; sa = 'right'; sb = 'right'; }
      else if (apart) { kind = 'v'; sa = B.t >= A.b - 2 ? 'bottom' : 'top'; sb = sa === 'bottom' ? 'top' : 'bottom'; }
      else { e.style.display = 'none'; continue; } // one part sits inside the other (an LED on its own part): the mounting shows the relation
      e.style.display = '';
      items.push({ e, a, b, A, B, kind, sa, sb, hub: toConcept ? hubs.indexOf(b) : -1 });
    }
    // fan: every connector on a shared edge gets its own attach point, ordered by where the other end is so fans do not cross
    const groups = new Map();
    const put = (el, side, it, end) => { const k = el.dataset.id + '|' + side; (groups.get(k) ?? groups.set(k, []).get(k)).push({ it, end }); };
    for (const it of items) { put(it.a, it.sa, it, 'A'); put(it.b, it.sb, it, 'B'); }
    for (const [k, list] of groups) {
      const side = k.split('|')[1], horizontal = side === 'left' || side === 'right';
      const other = (p) => { const O = p.end === 'A' ? p.it.B : p.it.A; return horizontal ? O.cy : O.cx; };
      list.sort((p, q) => other(p) - other(q));
      list.forEach((p, i) => {
        const S = p.end === 'A' ? p.it.A : p.it.B, t = (i + 1) / (list.length + 1);
        const pt = side === 'left' ? [S.l, S.t + S.h * t] : side === 'right' ? [S.r, S.t + S.h * t] : side === 'top' ? [S.l + S.w * t, S.t] : [S.l + S.w * t, S.b];
        if (p.end === 'A') p.it.p = pt; else p.it.q = pt;
      });
    }
    // parallel routes through the same corridor are offset by 12 px, as many abreast as the corridor holds; beyond that they share a line
    const corridors = new Map();
    const span = (it) => it.kind === 'h' ? Math.abs(it.q[0] - it.p[0]) : it.kind === 'v' ? Math.abs(it.q[1] - it.p[1]) : 40;
    for (const it of items) { if (it.kind === 'bus') continue; const k = it.kind + Math.round(it.kind === 'h' ? (it.p[0] + it.q[0]) / 2 : it.kind === 'v' ? (it.p[1] + it.q[1]) / 2 : Math.max(it.A.r, it.B.r)); (corridors.get(k) ?? corridors.set(k, []).get(k)).push(it); }
    for (const list of corridors.values()) { const abreast = Math.max(1, Math.min(list.length, Math.floor((Math.min(...list.map(span)) - 16) / 12))); list.forEach((it, i) => { it.offset = ((i % abreast) - (abreast - 1) / 2) * 12; }); }
    let i = 0;
    for (const it of items) {
      const { e, p, q } = it; let d, mid;
      if (it.kind === 'bus') {
        const x = lanesR.l - 16 - (it.hub % 4) * 12; d = elbowH(p, q, x); mid = [x, (p[1] + q[1]) / 2];
      } else if (it.kind === 'bracket') {
        const x = Math.max(it.A.r, it.B.r) + 16 + (it.offset || 0), sy = sgn(q[1] - p[1]), r = Math.min(R, Math.abs(q[1] - p[1]) / 2);
        d = 'M' + p + 'H' + (x - r) + 'Q' + [x, p[1]] + ' ' + [x, p[1] + sy * r] + 'V' + (q[1] - sy * r) + 'Q' + [x, q[1]] + ' ' + [x - r, q[1]] + 'H' + q[0]; mid = [x, (p[1] + q[1]) / 2];
      } else if (it.kind === 'h') {
        const mx = (p[0] + q[0]) / 2 + (it.offset || 0); d = elbowH(p, q, mx); mid = [mx, (p[1] + q[1]) / 2];
      } else {
        const my = (p[1] + q[1]) / 2 + (it.offset || 0); d = elbowV(p, q, my); mid = [(p[0] + q[0]) / 2, my];
      }
      for (const path of $('path', e)) path.setAttribute('d', d);
      const vis = e.querySelector('path.vis'); vis.style.setProperty('--len', vis.getTotalLength().toFixed(1));
      const gate = e.querySelector('text.gate'); if (gate) { const end = sgn(q[0] - p[0]); gate.setAttribute('x', q[0] - end * 8); gate.setAttribute('y', q[1] - 8); gate.setAttribute('text-anchor', end > 0 ? 'end' : 'start'); }
      const x = e.querySelector('text.x'); if (x) { x.setAttribute('x', mid[0]); x.setAttribute('y', mid[1] + 5); x.setAttribute('text-anchor', 'middle'); }
      if (!drawn) e.style.setProperty('--i', i++);
    }
    if (!drawn) body.style.setProperty('--stagger', Math.max(6, Math.min(25, 600 / Math.max(1, i))) + 'ms');
  }

  // --- neighbourhood highlight --------------------------------------------------------------------------------------------------
  let selected = null;
  function highlight(id, expand = false) { // a selection may unfold collapsed findings; a hover never shifts the layout
    for (const el of $('.near, .lit')) el.classList.remove('near', 'lit');
    body.classList.toggle('focus', !!id);
    if (!id) return;
    const self = byId(id); if (self) self.classList.add('near');
    for (const { e, other } of adj.get(id) ?? []) { e.classList.add('lit'); const o = byId(other); if (o) o.classList.add('near'); }
    if (expand) for (const b of $('.badge.near, .badge.selected')) { const li = b.closest('li.hidden-more'); if (li) { const box = li.parentElement.parentElement; box.classList.add('expanded'); const m = box.querySelector('.more'); if (m) m.textContent = 'fewer'; } }
    body.classList.toggle('dense', $('.edge.lit').length > 12);
    const edge = edges.find((e) => e.dataset.id === id);
    if (edge) { edge.classList.add('lit'); for (const k of ['src', 'dst']) { const o = byId(edge.dataset[k]); if (o) o.classList.add('near'); } }
  }

  // --- inspector -----------------------------------------------------------------------------------------------------------------
  const panelBtn = document.getElementById('panel-toggle');
  function openPanel(open) { body.classList.toggle('panel-open', open); panelBtn.setAttribute('aria-pressed', String(open)); }
  const metric = (k, vs) => { if (!k.startsWith('metric:')) return null; const [v, unit, better, base] = vs[0].split('|'); return k.slice(7) + ' ' + v + (unit ? ' ' + unit : '') + (better ? ', ' + better + ' is better' : '') + (base ? ', baseline ' + base : ''); };
  function show(id) {
    const it = data.items[id]; if (!it) return;
    for (const e of $('.selected')) e.classList.remove('selected');
    const el = document.querySelector('[data-id="' + CSS.escape(id) + '"]'); if (el) el.classList.add('selected');
    selected = id; highlight(id, true);
    const box = document.createElement('div'); box.className = 'in';
    const add = (tag, text, cls, parent = box) => { const e = document.createElement(tag); if (text != null) e.textContent = text; if (cls) e.className = cls; parent.appendChild(e); return e; };
    const close = add('button', '×', 'close'); close.type = 'button'; close.setAttribute('aria-label', 'Close inspector'); close.onclick = clear;
    add('h2', it.title); add('p', it.kind + (it.domain ? ' in ' + it.domain : '') + (it.project ? ', project ' + it.project : ''), 'kind'); add('span', it.id, 'id');
    const attrs = Object.entries(it.attrs);
    if (attrs.length) { const dl = add('dl'); for (const [k, vs] of attrs) { const m = metric(k, vs); add('dt', m ? 'metric' : k.replace(/^facet:/, ''), null, dl); add('dd', m ?? vs.join(', '), null, dl); } }
    if (it.evidence.length) { add('h3', 'Evidence', 'eyebrow'); const ul = add('ul'); for (const e of it.evidence) add('li', e, null, ul); }
    if (it.rels.length) {
      add('h3', 'Relations', 'eyebrow'); const ul = add('ul');
      for (const r of it.rels) { const li = add('li', null, 'rel', ul); add('span', r.dir === 'out' ? '→' : '←', 'arrow', li); const t = add('span', null, null, li); add('span', r.type.replace(/_/g, ' ') + ' ', 'type', t); t.appendChild(document.createTextNode(r.other)); if (r.props) add('span', ' ' + r.props, 'props', t); li.onclick = () => { show(r.otherId); const o = byId(r.otherId); if (o) o.scrollIntoView({ block: 'nearest', inline: 'nearest' }); }; }
    }
    if (it.commands.length) {
      add('h3', 'Commands', 'eyebrow');
      for (const c of it.commands) { const row = add('div', null, 'cmd'); add('code', c, null, row); const b = add('button', 'Copy', null, row); b.type = 'button';
        b.onclick = async () => { try { await navigator.clipboard.writeText(c); b.textContent = 'Copied'; b.classList.add('done'); setTimeout(() => { b.textContent = 'Copy'; b.classList.remove('done'); }, 1200); } catch { b.textContent = 'Select and copy'; } }; }
    }
    const old = panel.querySelector('.in'); if (old) old.remove();
    panel.appendChild(box); requestAnimationFrame(() => box.classList.add('show'));
    openPanel(true); panel.scrollTop = 0;
  }
  const placeholder = panel.querySelector('.in');
  function clear() {
    for (const e of $('.selected')) e.classList.remove('selected');
    selected = null; highlight(null); openPanel(false);
    const cur = panel.querySelector('.in'); if (cur !== placeholder) { if (cur) cur.remove(); panel.appendChild(placeholder); }
  }

  // --- wiring ----------------------------------------------------------------------------------------------------------------------
  const target = (ev) => ev.target.closest && ev.target.closest('[data-id]');
  document.addEventListener('click', (ev) => {
    const more = ev.target.closest && ev.target.closest('.more');
    if (more) { const box = more.closest('.node, li'); const open = box.classList.toggle('expanded'); more.textContent = open ? 'fewer' : more.dataset.label; return; }
    const t = target(ev); if (t) { show(t.dataset.id); return; } if (ev.target.closest('#panel, #filters, .top')) return; if (selected) clear();
  });
  for (const m of $('.more')) m.dataset.label = m.textContent;
  document.addEventListener('keydown', (ev) => {
    if (ev.key === 'Escape') { if (body.classList.contains('filters-open')) setFilters(false); else clear(); return; }
    if (ev.key !== 'Enter' && ev.key !== ' ') return; const t = target(ev); if (t && t.classList.contains('edge')) { ev.preventDefault(); show(t.dataset.id); }
  });
  board.addEventListener('pointerover', (ev) => { const t = target(ev); if (t) highlight(t.dataset.id); });
  board.addEventListener('pointerout', (ev) => { const t = target(ev); if (t && !(ev.relatedTarget && ev.relatedTarget.closest && ev.relatedTarget.closest('[data-id]') === t)) highlight(selected); });
  board.addEventListener('focusin', (ev) => { const t = target(ev); if (t) highlight(t.dataset.id); });
  board.addEventListener('focusout', () => highlight(selected));
  panel.querySelector('.close').addEventListener('click', clear);
  panelBtn.addEventListener('click', () => openPanel(!body.classList.contains('panel-open')));
  for (const i of $('#filters input, #filters select')) i.addEventListener('change', apply);
  document.getElementById('search').addEventListener('input', (ev) => search(ev.target.value));
  const filtersBtn = document.getElementById('filters-toggle');
  function setFilters(open) { body.classList.toggle('filters-open', open); filtersBtn.setAttribute('aria-expanded', String(open)); }
  filtersBtn.addEventListener('click', () => setFilters(!body.classList.contains('filters-open')));
  document.getElementById('scrim').addEventListener('click', () => setFilters(false));
  document.querySelector('#filters .close').addEventListener('click', () => setFilters(false));
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
