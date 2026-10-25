import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { type Db } from './db.js';
import { templateFor, type Template } from './templates.js';
import { type ProjectConfig } from './project.js';
import { paths } from '../lib/paths.js';

/** DESIGN §4.13, the knowledge build: `kb build` prepares and checks the work of a build session, and does none of its thinking. `manifest` lists a
 *  project's imported memories (every device) and repo documents in shards for extractor agents; `brief` prints the extractor's or the reviewer's
 *  instructions with the words of the project's own domain template; `validate` refuses any record of a `kb write` spec that the template, the
 *  finding rules or the cited sources do not support. Ported from the scratch scripts of the 2026-10-24 Windows build (HANDOFF, open item 11). */

export const STATES = ['unverified', 'observed', 'reproduced', 'conflicting'];
export const MEMORY_ORIGINS = ['serena', 'claude-memory', 'codex'];
export const SHARD_SIZE = 36, DOC_LIMIT = 40, DOC_MIN_BYTES = 100, DOC_MAX_BYTES = 400_000, DOC_DEPTH = 2;
/** Directories a repo walk never enters (plus every hidden directory and any `backup*`). */
export const DOC_SKIP = new Set(['node_modules', '.git', '.claude', '.serena', 'out', 'backups', '__pycache__', 'logs', 'cache', 'data']);
const DOC_EXT = /\.(md|txt|toml|json)$/i, DOC_SKIP_NAME = /^(package-lock|res_|log_)/;
/** READMEs, playbooks, briefs and design notes come first; the rest in name order; at most DOC_LIMIT files. */
const DOC_FIRST = /readme|playbook|brief|handoff|edges|schemas|research_pipeline|context|design|decisions|results|findings/i;
const NARRATION = /\b(?:I'll|I'm|I've|we'll|we're|let me|let's|pushed|committed|now|verifying|checking|today|yesterday|tomorrow|you(?:r|'d|'re|'ll|'ve)?|meanwhile|loading|waiting|in the background|(?:is|are|still) running)\b|^(?:I|we|say|still|then|next)\b|\?/i;
const HEADINGS = ['## Claim', '## Why it matters', '## Applies when / does not establish', '## Evidence'];
const KINDS = ['approach', 'target', 'finding', 'theme', 'experiment'];
const fwd = (p: string) => p.replace(/\\/g, '/');

export type Vocabulary = { facets: string[]; gates: string[]; methods: string[]; states: string[]; environment: string; subject: string };
export type ManifestNote = { id: string; title: string; origin: string; device: string; bytes: number; source_path: string | null; bank_file: string };
export type ManifestDoc = { file: string; bytes: number };
export type Shard = { project: string; domain: string; repo: string; shard: string; notes: ManifestNote[]; docs: ManifestDoc[]; docs_note: string; vocabulary: Vocabulary };
export type BuildProject = { project: string; domain: string; repo: string };
export type Role = 'extractor' | 'reviewer';
type Rel = { type?: string; dst?: unknown; props?: Record<string, unknown> };
type Rec = { key?: string; kind?: string; title?: unknown; facets?: Record<string, unknown>; method?: string; rels?: Rel[]; attrs?: Record<string, unknown>; tags?: unknown; metrics?: unknown[]; evidence?: { kind?: string; ref?: string }[]; body?: unknown };
export type Spec = { defaults?: { domain?: string; project?: string }; records?: Rec[] };
export type ValidateResult = { problems: string[]; records: number; approaches: number; targets: number; findings: number; keptFindings: number; fixed: Spec };

/** The words a shard's extractor may use: the template's facets, gates (weakest first), methods and axes, plus the finding states (CONTEXT.md). */
export const vocabularyOf = (t: Template): Vocabulary => ({ facets: t.facets, gates: t.gates, methods: t.methods, states: STATES, environment: t.environment, subject: t.subject });
export function vocabularyFor(db: Db, domain: string): Vocabulary {
  const t = templateFor(db, domain); if (!t) throw new Error(`no template for domain ${domain} in the index (kb rebuild installs the bank's templates)`);
  return vocabularyOf(t);
}

/** The nearest `.kb.json` at or above `cwd` and the folder holding it (the same eight-level walk as loadProjectConfig). */
export function findProjectConfig(cwd: string): { dir: string; config: ProjectConfig } | null {
  let dir = path.resolve(cwd);
  for (let i = 0; i < 8; i++) {
    const f = path.join(dir, '.kb.json');
    if (existsSync(f)) { try { const c = JSON.parse(readFileSync(f, 'utf8')); if (c && typeof c.project_id === 'string' && typeof c.domain === 'string') return { dir, config: c }; } catch { /* malformed: no project here */ } return null; }
    const up = path.dirname(dir); if (up === dir) break; dir = up;
  }
  return null;
}
/** The project a build is about: `--project` or the `.kb.json` found walking up from the folder (or from `--repo`); the repo is `--repo`, else that
 *  `.kb.json`'s folder when it names the project, else the folder itself; the domain is that `.kb.json`'s, else the one the project's notes carry. */
export function resolveBuildProject(db: Db, cwd: string, opts: { project?: string; repo?: string } = {}): BuildProject {
  const found = findProjectConfig(opts.repo ?? cwd);
  const project = opts.project ?? found?.config.project_id;
  if (!project) throw new Error(`no .kb.json at or above ${path.resolve(opts.repo ?? cwd)}; pass --project <id>`);
  const matches = found && found.config.project_id === project ? found : null;
  const repo = path.resolve(opts.repo ?? matches?.dir ?? cwd);
  const indexed = (db.sql.prepare('SELECT domain, COUNT(*) AS n FROM note WHERE project=? AND domain IS NOT NULL AND deleted_at IS NULL GROUP BY domain ORDER BY n DESC, domain LIMIT 1').get(project) as { domain: string } | undefined)?.domain;
  const domain = matches?.config.domain ?? indexed;
  if (!domain) throw new Error(`no domain known for project ${project}: run from its folder (.kb.json) or pass --repo <dir>`);
  return { project, domain, repo };
}

/** A project's imported memories from every device: evidence notes with origin serena, claude-memory or codex, oldest first. */
export function memoriesOf(db: Db, bank: string, project: string): ManifestNote[] {
  const rows = db.sql.prepare(`SELECT n.id, n.title, n.device_id, LENGTH(n.body) AS bytes,
    (SELECT value FROM attr WHERE note_id=n.id AND key='origin') AS origin, (SELECT value FROM attr WHERE note_id=n.id AND key='source_path') AS source_path
    FROM note n WHERE n.kind='evidence' AND n.deleted_at IS NULL AND n.project=? AND (SELECT value FROM attr WHERE note_id=n.id AND key='origin') IN (${MEMORY_ORIGINS.map(() => '?').join(',')}) ORDER BY n.created_at, n.id`)
    .all(project, ...MEMORY_ORIGINS) as { id: string; title: string; device_id: string; bytes: number; origin: string; source_path: string | null }[];
  return rows.map((r) => ({ id: r.id, title: r.title, origin: r.origin, device: r.device_id, bytes: r.bytes, source_path: r.source_path, bank_file: fwd(path.join(bank, 'notes', 'evidence', `${r.id}.md`)) }));
}

/** The repo's documents an extractor reads beside the memories: Markdown, text, TOML and JSON files of 100 B to 400 KB, two directory levels
 *  deep, skipping dependencies, VCS and tool state, outputs, logs, caches, data and backups; READMEs and playbooks first; at most 40 files. */
export function repoDocs(repo: string): ManifestDoc[] {
  const found: ManifestDoc[] = [];
  const walk = (d: string, depth: number) => {
    let es; try { es = readdirSync(d, { withFileTypes: true }); } catch { return; }
    for (const e of es) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) { if (depth < DOC_DEPTH && !DOC_SKIP.has(e.name) && !e.name.startsWith('.') && !e.name.startsWith('backup')) walk(p, depth + 1); }
      else if (DOC_EXT.test(e.name) && !DOC_SKIP_NAME.test(e.name)) { try { const s = statSync(p); if (s.size > DOC_MIN_BYTES && s.size < DOC_MAX_BYTES) found.push({ file: fwd(p), bytes: s.size }); } catch { /* unreadable */ } }
    }
  };
  if (existsSync(repo)) walk(repo, 0);
  const score = (f: ManifestDoc) => (DOC_FIRST.test(f.file) ? 0 : 1);
  return found.sort((a, b) => score(a) - score(b) || a.file.localeCompare(b.file)).slice(0, DOC_LIMIT);
}

/** One shard per `shardSize` memories (at least one shard, so a project with no memories still gets its documents); the repo documents go to shard 1. */
export function buildManifest(db: Db, bank: string, p: BuildProject, shardSize = SHARD_SIZE): Shard[] {
  if (!Number.isInteger(shardSize) || shardSize < 1) throw new Error('--shard needs a whole number of memories per shard, at least 1');
  const vocabulary = vocabularyFor(db, p.domain), notes = memoriesOf(db, bank, p.project), docs = repoDocs(p.repo), repo = fwd(p.repo);
  const n = Math.max(1, Math.ceil(notes.length / shardSize)), shards: Shard[] = [];
  for (let i = 0; i < n; i++) shards.push({ project: p.project, domain: p.domain, repo, shard: `${i + 1}/${n}`, notes: notes.slice(i * shardSize, (i + 1) * shardSize), docs: i === 0 ? docs : [], docs_note: i === 0 ? '' : 'repo docs were given to shard 1 of this project', vocabulary });
  return shards;
}
export const shardLine = (s: Shard) => `${s.project.padEnd(24)} ${s.shard.padEnd(5)} notes ${String(s.notes.length).padStart(3)} bytes ${String(s.notes.reduce((a, b) => a + b.bytes, 0)).padStart(7)} docs ${String(s.docs.length).padStart(2)} ${s.docs.slice(0, 3).map((x) => path.basename(x.file)).join(',')}`;

/** `--keys`: a file holding an earlier shard's spec (its records' keys) or a JSON array of keys, else a comma-separated list. */
export function parseKeys(arg: string | undefined): string[] {
  if (!arg) return [];
  if (existsSync(arg)) {
    const j = JSON.parse(readFileSync(arg, 'utf8'));
    if (Array.isArray(j)) return j.map(String);
    return ((j?.records ?? []) as Rec[]).map((r) => r.key).filter((k): k is string => typeof k === 'string' && k.length > 0);
  }
  return arg.split(',').map((s) => s.trim()).filter(Boolean);
}

const norm = (s: string) => String(s).replace(/\s+/g, ' ').replace(/[“”]/g, '"').replace(/[‘’]/g, "'").replace(/\*\*/g, '').trim().toLowerCase();
/** The checks the scratch validator ran on 2026-10-24, with the vocabulary from the project's template. Findings that fail are left out of `fixed`
 *  (approaches, targets, themes and experiments stay, failing or not, as the script kept them), and rels to a dropped key are stripped. */
export function validateSpec(spec: Spec, vocab: Vocabulary, opts: { extKeys?: string[]; project?: string; readSource?: (ref: string) => string | null } = {}): ValidateResult {
  const facets = new Set(vocab.facets), gates = new Set(vocab.gates), states = new Set(vocab.states), methods = new Set(vocab.methods);
  const extKeys = opts.extKeys ?? [], problems: string[] = [], keys = new Map<string, string>(extKeys.map((k) => [k, 'external'])), keep: Rec[] = [];
  const recs = Array.isArray(spec.records) ? spec.records : [];
  if (!spec.defaults?.domain || !spec.defaults?.project) problems.push('spec.defaults needs domain and project');
  if (opts.project && spec.defaults?.project && spec.defaults.project !== opts.project) problems.push(`spec.defaults.project ${spec.defaults.project} is not ${opts.project}`);
  const cache = new Map<string, string | null>();
  const readSource = (ref: string) => { if (cache.has(ref)) return cache.get(ref)!; let t: string | null = null; try { t = opts.readSource ? opts.readSource(ref) : existsSync(ref) && statSync(ref).isFile() ? readFileSync(ref, 'utf8') : null; } catch { t = null; } cache.set(ref, t); return t; };
  recs.forEach((r, i) => {
    const where = `#${i} ${r.kind} "${String(r.title ?? '').slice(0, 70)}"`, bad = (m: string) => problems.push(`${where}: ${m}`);
    let ok = true;
    if (!KINDS.includes(r.kind ?? '')) { bad(`kind ${r.kind}`); ok = false; }
    if (typeof r.title !== 'string' || r.title.length < 12 || r.title.length > 220) { bad('title length (12-220)'); ok = false; }
    if (r.key) { if (keys.has(r.key)) { bad('duplicate key'); ok = false; } keys.set(r.key, r.kind ?? ''); }
    for (const [k, v] of Object.entries(r.facets ?? {})) {
      if (r.kind === 'target' ? !['environment', 'subject'].includes(k) : !facets.has(k)) { bad(`facet ${k} not in the template (${r.kind === 'target' ? 'environment, subject' : vocab.facets.join(', ')})`); ok = false; }
      if (typeof v !== 'string' || !v) { bad(`facet ${k} empty`); ok = false; }
    }
    if (r.kind === 'target' && (!r.facets?.environment || !r.facets?.subject)) { bad('target needs facets.environment and facets.subject'); ok = false; }
    if (r.kind === 'finding' && r.facets) { bad('facets belong on approaches and targets, not findings'); ok = false; }
    if (r.kind === 'experiment' && r.method && !methods.has(r.method)) { bad(`method ${r.method} not in the template (${vocab.methods.join(', ')})`); ok = false; }
    for (const l of r.rels ?? []) {
      if (typeof l.dst !== 'string') { bad('rel without dst'); ok = false; continue; }
      if (l.dst.startsWith('@') && !keys.has(l.dst.slice(1))) { bad(`rel to unknown or later key ${l.dst}`); ok = false; }
      if (l.type === 'about' && typeof l.props?.facet_key === 'string' && !facets.has(l.props.facet_key)) { bad(`about facet_key ${l.props.facet_key}`); ok = false; }
      if (l.type === 'validated_in' && typeof l.props?.gate === 'string' && !gates.has(l.props.gate)) { bad(`validated_in gate ${l.props.gate}`); ok = false; }
      if (l.type === 'transfer') { bad('transfers are proposed by kb write itself'); ok = false; }
    }
    if (r.kind === 'finding') {
      const a = (r.attrs ?? {}) as Record<string, unknown>, title = String(r.title ?? '');
      if (!states.has(String(a.state))) { bad(`attrs.state ${a.state} (${vocab.states.join('|')})`); ok = false; }
      if (a.gate !== undefined && !gates.has(String(a.gate))) { bad(`attrs.gate ${a.gate} (${vocab.gates.join('|')})`); ok = false; }
      if (a.valid_from !== undefined && !/^\d{4}-\d{2}-\d{2}$/.test(String(a.valid_from))) { bad('valid_from not YYYY-MM-DD'); ok = false; }
      if (!/\d/.test(title)) { bad('a finding title carries a number'); ok = false; }
      if (NARRATION.test(title)) { bad('title reads as narration, advice or a question'); ok = false; }
      if (!Array.isArray(r.tags) || r.tags.length < 1 || r.tags.length > 5) { bad('1-5 tags'); ok = false; }
      for (const m of (r.metrics ?? []) as { name?: unknown; value?: unknown; better?: unknown }[]) {
        if (typeof m?.name !== 'string' || !/^[a-z][a-z0-9_]*$/.test(m.name) || typeof m.value !== 'number' || !['higher', 'lower'].includes(String(m.better))) { bad(`metric ${JSON.stringify(m)} (snake_case name, numeric value, better higher|lower)`); ok = false; }
      }
      const ev = r.evidence ?? [];
      if (!ev.length) { bad('no evidence'); ok = false; }
      for (const e of ev) {
        if (!['path', 'commit', 'url'].includes(e.kind ?? '')) { bad(`evidence kind ${e.kind}`); ok = false; }
        if (e.kind === 'path' && !readSource(String(e.ref))) { bad(`evidence path does not exist on this machine: ${e.ref}`); ok = false; }
      }
      const body = String(r.body ?? '');
      for (const h of HEADINGS) if (!body.includes(h)) { bad(`body lacks ${h}`); ok = false; }
      const quotes = [...body.matchAll(/^> (.+)$/gm)].map((m) => m[1]);
      if (!quotes.length) { bad('body has no "> quote" line copied from the source'); ok = false; }
      else {
        const sources = ev.filter((e) => e.kind === 'path').map((e) => readSource(String(e.ref))).filter((t): t is string => !!t).map(norm);
        const missing = quotes.filter((q) => { const n = norm(q).replace(/^…|…$/g, '').replace(/\.\.\.$/, '').trim(); const probe = n.length > 60 ? n.slice(0, 60) : n; return !sources.some((s) => s.includes(probe)); });
        if (missing.length) { bad(`quoted line not found verbatim in the cited path evidence: "${missing[0].slice(0, 70)}"`); ok = false; }
      }
    }
    if (ok || r.kind !== 'finding') keep.push(r); else if (r.key) keys.delete(r.key);
  });
  const kept = new Set([...extKeys, ...keep.map((r) => r.key).filter((k): k is string => !!k)]);
  const fixedRecords = keep.map((r) => (r.rels ? { ...r, rels: r.rels.filter((l) => typeof l.dst !== 'string' || !l.dst.startsWith('@') || kept.has(l.dst.slice(1))) } : r));
  const count = (k: string) => recs.filter((r) => r.kind === k).length;
  const fixed: Spec = { ...spec, defaults: { ...(spec.defaults ?? {}), ...(opts.project && !spec.defaults?.project ? { project: opts.project } : {}) }, records: fixedRecords };
  return { problems, records: recs.length, approaches: count('approach'), targets: count('target'), findings: count('finding'), keptFindings: keep.filter((r) => r.kind === 'finding').length, fixed };
}
export const validateSummary = (file: string, r: ValidateResult) => `${file}: ${r.records} records (${r.approaches} approaches, ${r.targets} targets, ${r.findings} findings); ${r.problems.length} problem(s); ${r.keptFindings} findings pass`;

/** The rules `kb build validate` enforces, as the briefs state them. */
export function validatorRules(v: Vocabulary): string[] {
  return [
    `kinds approach, target, finding, theme, experiment; titles of 12-220 characters; a key (a1, t1, ...) is defined once`,
    `approach facets only from the template: ${v.facets.join(', ')}; a target's facets are exactly environment and subject; a finding carries no facets`,
    `an experiment's method is one of ${v.methods.length ? v.methods.join(', ') : '(the template names none)'}`,
    `a rel's dst is a note id or @key defined earlier in the file (or passed with --keys from an earlier shard); about.props.facet_key is a template facet; validated_in.props.gate is a template gate; no transfer rels (kb write proposes those)`,
    `a finding's attrs.state is ${v.states.join('|')}; attrs.gate is ${v.gates.join('|')}; valid_from is YYYY-MM-DD`,
    `a finding's title carries a number and is not narration, advice or a question (no "I'll", "pushed", "now", "you", "?")`,
    `a finding has 1-5 tags; each metric has a snake_case name, a numeric value and better higher|lower (unit and baseline optional)`,
    `a finding has at least one evidence entry of kind path, commit or url, and every path exists on this machine`,
    `a finding's body carries the headings ${HEADINGS.join(', ')} and at least one "> quote" line that appears verbatim (whitespace and bold ignored) in a cited path file`,
  ];
}

const TRADING_GATES = 'Gates for trading: a backtest on the fitting period is in-sample; a holdout, walk-forward or forward test is out-of-sample; paper trading is paper; small live accounts are live-small; live is live.';
/** Worked examples for trading projects only (the words of any other domain come from its template). Synthetic: an invented strategy on an
 *  invented instrument with invented numbers, in the shape the real builds used. The owner's own records stay in the private bank. */
const TRADING_EXAMPLES = `## Worked examples (synthetic: an invented strategy, instrument and numbers, in the shape the build records)

An approach (facets are the trading template's keys):

title: "Moonfade: short the opening gap on XYZ micro futures after a 2-bar confirmation, 1.5x ATR stop, flat by 11:00"
facets: why="opening gaps on XYZ filled 61% of mornings in the fitting years", entry="sell at the close of the second bar against the gap", risk="1.5x ATR stop, one contract per $4,000", exit="gap fill or 11:00 flat", horizon=intraday, instrument_class=futures
tags: [gap fade]
body: The gap-fade arm of the example harness: two 1-minute bars against the gap direction, one contract per $4,000 of equity, stop at 1.5x the 20-day ATR, out at the fill or at 11:00 (.serena/memories/moonfade-design.md).

A target (facets are exactly environment and subject: platform x instrument):

title: Demo replay × XYZ micro futures
facets: environment="Demo replay", subject="XYZ micro futures"
body: Minute bars 2019-2024 from the demo vendor replayed through the harness's fill model and its walk-forward gate (.serena/memories/replay-setup.md).

A finding (one dated, evidenced, declarative claim with the number in the title):

title: Moonfade 2019-2024 in-sample refresh on 2024-03-02: 1.7 ticks per contract after costs over 640 fills; the earlier 2.4-tick figure counted fills before the cost model landed (a1b2c3d)
attrs: state=observed, gate=in-sample, valid_from=2024-03-02
metrics: [{ name: net_ticks_per_contract, value: 1.7, unit: ticks, better: higher, baseline: 2.4 }]
tags: [gap fade, transaction cost model, data quality]
rels: about @approach (facet_key exit); validated_in @target (gate in-sample)
evidence: [{ kind: path, ref: <home>/.claude/projects/<dashed-cwd>/memory/moonfade-costs.md }]
body:
## Claim
Moonfade 2019-2024 in-sample refresh on 2024-03-02: 1.7 ticks per contract after costs over 640 fills; the earlier 2.4-tick figure counted fills before the cost model landed (a1b2c3d)

## Why it matters
The headline number drifted by 0.7 ticks without anyone noticing because only the unit suites ran between refreshes; the end-to-end replay must run every phase and a baseline is refreshed only with written provenance.

## Applies when / does not establish
Deterministic 2019-2024 in-sample replay (scripts/replay_moonfade.py); the 1.7 ticks include the cost model, not an out-of-sample result, and the replay still swallows a vendor timeout silently.

## Evidence
> net 1.7 ticks/contract after costs over 640 fills; the 2.4 figure predates the cost model (a1b2c3d)

<home>/.claude/projects/<dashed-cwd>/memory/moonfade-costs.md

Another finding title, for the register (a two-part claim with a holdout):

"Moonfade's 2-bar confirmation halves false starts (18% to 9% in the 2022-2024 holdout) but costs 0.6 ticks of entry slippage: net 1.1 ticks per contract out of sample against 1.7 in sample, and 0 of 12 confirmation lengths beat it"
metrics: false_start_rate 0.09 lower (baseline 0.18); net_ticks_per_contract_oos 1.1 higher (baseline 1.7); entry_slippage_ticks 0.6 lower
`;

/** The spec skeleton an extractor fills, with the template's own facet keys, gates and axes. */
export function specSkeleton(p: { project: string; domain: string }, v: Vocabulary): string {
  const gate = v.gates[0] ?? '<gate>', facet = v.facets[0] ?? '<facet>';
  const skeleton = { defaults: { domain: p.domain, project: p.project }, records: [
    { key: 'a1', kind: 'approach', title: '<name: one line saying what the approach, strategy or design is>', facets: Object.fromEntries(v.facets.map((f) => [f, `<${f.replace(/_/g, ' ')}: the value this approach takes, or omit the key>`])), tags: ['<concept>'], body: '<one paragraph, citing the source memory or document path>' },
    { key: 't1', kind: 'target', title: '<environment> × <subject>', facets: { environment: `<${v.environment}, where it ran>`, subject: `<${v.subject}, what it acted on>` }, body: '<what runs there>' },
    { kind: 'finding', title: '<one declarative claim with the number(s)>', tags: ['<2-4 concept words a future prompt would use>'], attrs: { state: 'observed', gate, valid_from: 'YYYY-MM-DD' },
      metrics: [{ name: 'snake_case_name', value: 1.23, unit: '<unit or omit>', better: 'higher', baseline: 1.0 }],
      rels: [{ type: 'about', dst: '@a1', props: { facet_key: facet } }, { type: 'validated_in', dst: '@t1', props: { gate } }],
      evidence: [{ kind: 'path', ref: '<absolute path of the source memory file, or of the bank note file (bank_file) when the original is on another machine, or of a repo document>' }],
      body: '## Claim\n<the title>\n\n## Why it matters\n<...>\n\n## Applies when / does not establish\n<scope; what it does not show>\n\n## Evidence\n> <a line copied verbatim from the cited source>\n\n<the cited path>' },
  ] };
  return JSON.stringify(skeleton, null, 2);
}

function vocabularyBlock(p: BuildProject, v: Vocabulary): string {
  return [`## Vocabulary (the ${p.domain} template in the bank; nothing outside it passes)`,
    `- approach facets: ${v.facets.join(', ')}`,
    `- gates, weakest first: ${v.gates.join(' < ')}${p.domain === 'trading' ? `. ${TRADING_GATES}` : '. Pick the gate the evidence actually passed, never a stronger one.'}`,
    `- experiment methods: ${v.methods.length ? v.methods.join(', ') : '(none in this template)'}`,
    `- finding states: ${v.states.join(' | ')} (observed: one measurement in the source; reproduced: the source shows it twice or on two setups; conflicting: sources disagree; unverified: a claim without its number)`,
    `- target axes: environment = ${v.environment} (where it ran), subject = ${v.subject} (what it acted on)`].join('\n');
}

/** `kb build brief`: the extractor's or the reviewer's instructions for one project, in the words of its domain template. */
export function buildBrief(db: Db, p: BuildProject, role: Role = 'extractor'): string {
  const v = vocabularyFor(db, p.domain), cli = paths.kbCli(), rules = validatorRules(v).map((r) => `- ${r}`).join('\n');
  if (role === 'reviewer') {
    return [`# Knowledge build, reviewer brief: project ${p.project} (domain ${p.domain}, repo ${fwd(p.repo)})`, '',
      `You review the extractor shards of one project before anything reaches the bank. The judgement is yours; ${cli} build validate checks shape and quotes, ${cli} write records. Ops-heavy memories (session logs, plans, superseded numbers) commonly lose two thirds of their candidates at this step and merge a dozen more: expect to drop and merge.`, '',
      '## What to do',
      `1. Merge: concatenate the shard specs in shard order into one spec (defaults.domain ${p.domain}, defaults.project ${p.project}). Keys stay unique across shards (a rel to an earlier shard's key resolves once the files are one). An approach or target two shards both wrote is one record: keep one key, repoint the rels.`,
      '2. Refute: for every finding, open the cited path and find the quote and the number. Drop a claim the source does not carry, a number the source states differently, a superseded figure (a later memory gives a newer number for the same thing), an ops log, a plan, a to-do, a worktree duplicate. The quote is copied, not paraphrased; the title restates the source, not what one would advise.',
      "3. Deduplicate: the same claim from several memories is one finding with the strongest gate the sources support, every evidence path, the latest valid_from; copies of a memory (git worktrees, archived trees) are one source.",
      `4. Enrich the repo's .kb.json: from the approaches and targets, set facets (one value per facet key where the project has a settled answer: ${v.facets.join(', ')}), target {environment, subject} and relies_on (the concept names the project's findings are tagged with), so the start-up brief ranks by them. Keep project_id and domain as they are.`,
      `5. Validate, then record: ${cli} build validate <merged.json> (--fix drops the failing findings and strips rels to them; approaches and targets stay), then ${cli} write <merged.json>, then ${cli} sync. A large batch is rehearsed against a temporary bank first (OPTIMUS_HOME and OPTIMUS_BANK pointed at empty folders, ${cli} init --bank).`, '',
      vocabularyBlock(p, v), '', '## Rules the validator enforces', rules, ''].join('\n');
  }
  return [`# Knowledge build, extractor brief: project ${p.project} (domain ${p.domain}, repo ${fwd(p.repo)})`, '',
    `You are one extractor in a knowledge build. Your shard of the manifest (${cli} build manifest) lists imported memories (evidence notes in the bank; source_path is the original file where it exists on this machine, bank_file the note that holds the same text) and, for shard 1, the repository's documents. Read every one in full. Write one ${cli} write spec (JSON) for this project: the approaches the memories describe, the targets they ran on, and every dated, evidenced, numbered claim as a finding. The thinking is yours; ${cli} build validate checks the shape and the quotes before a reviewer merges the shards.`, '',
    '## What to record',
    `- approach: one record per strategy or design the project tried. The title names it in one line; the facets are the ${p.domain} template's keys (${v.facets.join(', ')}): fill the keys the source supports, omit the rest, never invent a key. Tag it with the concepts it relies on.`,
    `- target: where it ran, as ${v.environment} × ${v.subject}; the facets are exactly environment and subject.`,
    `- finding: one declarative claim with the number(s) in the title, dated (attrs.valid_from), with its state and gate, 1-5 tags (concept words a future prompt would use), metrics (snake_case name, numeric value, better higher|lower, unit and baseline when the source gives them), rels about @approach (props.facet_key: the facet the claim is about) and validated_in @target (props.gate), evidence (the memory's source_path, else its bank_file, else a repo document) and a body with the four headings ${HEADINGS.join(', ')}, the last with at least one "> quote" line copied verbatim from a cited path.`,
    '- Not findings: ops logs, plans, to-do lists, superseded numbers, narration ("I\'ll", "pushed", "now"), advice and questions. A claim whose title has no number is not a finding here; a claim whose number is not in the source is not a finding anywhere.', '',
    vocabularyBlock(p, v), '',
    `## The spec file (${cli} write reads it)`, specSkeleton(p, v), '',
    '## Rules the validator enforces', rules, '',
    '## Shards and keys',
    "Keys (a1, t1, ...) are local to your file; a rel's @key points at a key defined earlier in the same file or in an earlier shard of this project (the reviewer passes --keys <earlier shard spec> when validating yours). Do not repeat another shard's approaches when you know their keys; otherwise write your own and let the reviewer merge.", '',
    ...(p.domain === 'trading' ? [TRADING_EXAMPLES] : []),
    '## Commands', `${cli} build validate <spec.json> [--keys <earlier-shard.json>] [--fix]   (exit 0 when every record passes; one line per failure)`, ''].join('\n');
}
