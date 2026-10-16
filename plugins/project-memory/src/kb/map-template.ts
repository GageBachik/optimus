/** DESIGN §4.11: the page shell. No external script or stylesheet; the inline script only filters by data-* attributes and fills the side panel.
 *  Placeholders __META__, __FILTERS__, __SVG__ and __DATA__ are filled by generateMap. */
export const TEMPLATE = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Knowledge bank map</title>
<style>
:root { --bg:#f6f6f3; --fg:#1b1b1b; --muted:#6b6b6b; --lane:#ffffff; --lane-line:#dcdcd6; --node:#eef1f5; --node-stroke:#9aa3ad; --edge:#767676; --panel:#ffffff;
  --green:#2e9e5b; --blue:#3b7dd8; --amber:#d99a1e; --red:#d1403f; --accent:#3b7dd8; --hatch:#444; --code:#f0f0ec; }
@media (prefers-color-scheme: dark) { :root { --bg:#141518; --fg:#e6e6e6; --muted:#9a9a9a; --lane:#1c1e22; --lane-line:#2c2f35; --node:#262a31; --node-stroke:#5b6572; --edge:#a0a0a0; --panel:#1c1e22;
  --green:#4cc27a; --blue:#6aa1ea; --amber:#e6b24a; --red:#e86a69; --accent:#6aa1ea; --hatch:#cfcfcf; --code:#23262c; } }
* { box-sizing:border-box }
body { margin:0; height:100vh; display:flex; background:var(--bg); color:var(--fg); font:13px/1.4 system-ui, -apple-system, "Segoe UI", sans-serif }
h1 { font-size:15px; margin:0 0 2px } h2 { font-size:14px; margin:0 0 4px; overflow-wrap:anywhere } h3 { font-size:12px; margin:12px 0 4px; color:var(--muted); text-transform:uppercase; letter-spacing:.04em }
.muted { color:var(--muted); font-size:12px; overflow-wrap:anywhere }
#filters { width:230px; flex:none; overflow:auto; padding:14px 16px; border-right:1px solid var(--lane-line) }
#filters fieldset { border:0; padding:0; margin:0 0 12px } #filters legend { font-weight:600; padding:0; margin-bottom:4px }
#filters label { display:block; cursor:pointer; overflow-wrap:anywhere } #filters select { width:100%; margin-top:2px }
main { flex:1; overflow:auto; padding:8px 16px }
svg { display:block; font:12px system-ui, -apple-system, sans-serif }
text.col { font-size:11px; font-weight:600; fill:var(--muted); text-transform:uppercase; letter-spacing:.06em }
.lane rect.bg { fill:var(--lane); stroke:var(--lane-line) } .lane text.label { font-weight:700; fill:var(--fg) }
.node { cursor:pointer } .node rect { fill:var(--node); stroke:var(--node-stroke) } .node text { fill:var(--fg) }
.node.selected rect, .badge.selected circle, .concept.selected circle { stroke:var(--accent); stroke-width:2.5 }
.badge { cursor:pointer } .badge circle { stroke:var(--lane); stroke-width:1 } .badge text { fill:var(--fg) }
.badge[data-state="reproduced"] circle.fill { fill:var(--green) } .badge[data-state="observed"] circle.fill { fill:var(--blue) }
.badge[data-state="unverified"] circle.fill { fill:var(--amber) } .badge[data-state="conflicting"] circle.fill { fill:var(--red) }
.badge circle.hatch { fill:url(#hatch); stroke:none } #hatch line { stroke:var(--hatch); stroke-width:1.5 }
.concept { cursor:pointer } .concept circle { fill:var(--fg); stroke:var(--fg); stroke-width:1.5 } .concept.hollow circle { fill:var(--lane) }
.concept text { fill:var(--fg) } .concept.multi text { font-weight:700 }
.edge line.vis { stroke:var(--edge); stroke-width:1.2; opacity:.75 } .edge line.hit { stroke:transparent; stroke-width:10; cursor:pointer }
.edge[data-type="discovered_in"] line.vis { stroke-dasharray:2 3 }
.edge[data-type="transfer"] line.vis { stroke-dasharray:6 4 }
.edge[data-type="transfer"][data-state="confirmed_provisional"] line.vis { stroke:var(--green) }
.edge[data-type="transfer"][data-state="confirmed"] line.vis { stroke:var(--green); stroke-dasharray:none; stroke-width:2 }
.edge[data-type="transfer"][data-state="refuted"] line.vis { stroke:var(--red) }
.edge[data-type="supersedes"] line.vis { opacity:.3 } .edge[data-type="conflicts_with"] line.vis { stroke:var(--red); stroke-dasharray:1 3 }
.edge text { font-size:10px; fill:var(--muted); paint-order:stroke; stroke:var(--lane); stroke-width:3px } .edge text.x { font-size:14px; font-weight:700; fill:var(--red) }
.off { display:none }
#panel { width:330px; flex:none; overflow:auto; padding:14px 16px; border-left:1px solid var(--lane-line); background:var(--panel) }
#panel dl { display:grid; grid-template-columns:max-content 1fr; gap:2px 10px; margin:4px 0 } #panel dt { color:var(--muted) } #panel dd { margin:0; overflow-wrap:anywhere }
#panel ul { margin:4px 0; padding-left:18px } #panel li.rel { cursor:pointer } #panel li.rel:hover { color:var(--accent) }
.cmd { display:flex; gap:6px; align-items:flex-start; margin:4px 0 } .cmd code { flex:1; background:var(--code); padding:4px 6px; border-radius:4px; font-size:12px; overflow-wrap:anywhere; user-select:all }
.cmd button { font-size:11px; cursor:pointer }
.legend span { display:inline-block; width:10px; height:10px; border-radius:50%; margin-right:4px; vertical-align:middle }
</style>
</head>
<body>
<aside id="filters">
<h1>Knowledge bank map</h1>
<div class="muted">__META__</div>
__FILTERS__
<fieldset class="legend"><legend>Legend</legend>
<div><span style="background:var(--green)"></span>reproduced <span style="background:var(--blue)"></span>observed</div>
<div><span style="background:var(--amber)"></span>unverified <span style="background:var(--red)"></span>conflicting</div>
<div class="muted">hatched: past valid_to or superseded</div>
<div class="muted">edges: about solid · discovered_in dotted · transfer dashed (green confirmed, red refuted) · validated_in labeled with the gate · supersedes faded</div>
<div class="muted">concept hubs: bold when touched from two or more lanes, hollow when a merge is pending</div>
</fieldset>
</aside>
<main>__SVG__</main>
<aside id="panel"><div class="muted">Click a node, badge, concept hub or edge.</div></aside>
<script id="data" type="application/json">__DATA__</script>
<script>
(() => {
  const data = JSON.parse(document.getElementById('data').textContent);
  const $ = (s, r = document) => Array.from(r.querySelectorAll(s));
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
    for (const e of $('.edge')) { const d = e.dataset; e.classList.toggle('off', hidden.has(d.src) || hidden.has(d.dst) || (d.type === 'transfer' && d.state === 'proposed' && !proposed)); }
  }
  const panel = document.getElementById('panel');
  function show(id) {
    const it = data.items[id]; if (!it) return;
    for (const e of $('.selected')) e.classList.remove('selected');
    const el = document.querySelector('[data-id="' + CSS.escape(id) + '"]'); if (el) el.classList.add('selected');
    panel.replaceChildren();
    const add = (tag, text, cls, parent = panel) => { const e = document.createElement(tag); if (text != null) e.textContent = text; if (cls) e.className = cls; parent.appendChild(e); return e; };
    add('h2', it.title); add('div', it.kind + ' · ' + it.id, 'muted');
    const where = [it.domain && 'domain ' + it.domain, it.project && 'project ' + it.project].filter(Boolean).join(' · '); if (where) add('div', where, 'muted');
    const attrs = Object.entries(it.attrs); if (attrs.length) { const dl = add('dl'); for (const [k, vs] of attrs) { add('dt', k, null, dl); add('dd', vs.join(', '), null, dl); } }
    if (it.evidence.length) { add('h3', 'Evidence'); const ul = add('ul'); for (const e of it.evidence) add('li', e, null, ul); }
    if (it.rels.length) { add('h3', 'Relations'); const ul = add('ul'); for (const r of it.rels) { const li = add('li', (r.dir === 'out' ? '→ ' : '← ') + r.type + ' ' + r.other + (r.props ? ' ' + r.props : ''), 'rel', ul); li.onclick = () => show(r.otherId); } }
    if (it.commands.length) { add('h3', 'Commands'); for (const c of it.commands) { const row = add('div', null, 'cmd'); add('code', c, null, row); const b = add('button', 'copy', null, row); b.onclick = () => { try { navigator.clipboard.writeText(c); } catch {} }; } }
  }
  const target = (ev) => ev.target.closest && ev.target.closest('[data-id]');
  document.addEventListener('click', (ev) => { const t = target(ev); if (t) show(t.dataset.id); });
  document.addEventListener('keydown', (ev) => { if (ev.key !== 'Enter' && ev.key !== ' ') return; const t = target(ev); if (t) { ev.preventDefault(); show(t.dataset.id); } });
  for (const i of $('#filters input, #filters select')) i.addEventListener('change', apply);
  apply();
})();
</script>
</body>
</html>
`;
