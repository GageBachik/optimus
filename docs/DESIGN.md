# Project Memory — Design Specification

Version 1.0 · 16 October 2026 · Status: **approved for implementation** (all decisions taken; see §12).
Companion documents: `CONTEXT.md` (glossary, binding), `docs/adr/0001–0003` (hard-to-reverse decisions), `docs/superpowers/plans/` (phased implementation plans), `claudedocs/design/*.html` (the visual brief and deep dive), `claudedocs/probes/` (live measurements this spec rests on), `claudedocs/research_handoff-verification_2026-10-16.md` (what the original handoff got wrong).

---

## 0. Purpose in one paragraph

One Claude Code plugin, written in TypeScript for Node 24, that does two things Claude Code does not do: (1) **keeps the active session's working context small and high-value while making everything else recoverable** (offload large tool results, snapshot before native compaction, audit the summary after, re-brief the main agent and every subagent), and (2) **gives Gage one knowledge bank shared across his MacBook Pro, Windows PC and always-on Mac mini** in which a discovery made in one project reaches every other project where it applies, across platforms and domains, with a map he can read and steer. It uses only documented Claude Code extension points so it keeps working when Claude Code updates.

## 1. Rules (binding)

1. **No harness hijack.** Hooks, MCP tools, the plugin manifest, skills, and settings keys only. No `ANTHROPIC_BASE_URL` proxy. No rewriting of conversation history. Native compaction stays on. (ADR-0001, ADR-0002.)
2. **Only what Claude Code lacks.** If Claude Code covers most of a tool's job, that tool is dropped, not wrapped. Serena, context-mode, agentmemory, claude-mem, billion-context and Trilium are quarries; the exact mechanisms lifted and their licenses are in §11.
3. **Zero model calls in any hot path.** Hooks and tools are deterministic. No background summarizer. (A future opt-in summarizer may only run as a non-bare `claude -p` on a small model; never the Messages API or the Agent SDK with the subscription token.)
4. **Never emit `additionalContext` from PreToolUse or PostToolUse** (it rewrites the cached prompt prefix on every tool call; claude-code issue #83913). Offload uses `updatedToolOutput` with a deterministic replacement.
5. **Every injected string is measured and fitted under 9,000 characters** (Claude Code's cap is 10,000; over it the whole string is silently replaced by a file path and a 2,000-character preview; confirmed live).
6. **Hooks are exec-form `node` with no shell**, dependency-free bundles, exit 0 always, stdin read as UTF-8 with an idle timeout, diagnostics to a log file never stdout.
7. **Node ≥ 24.15.0** on every machine (`node:sqlite` with FTS5 is built in and warning-free from 24.15).
8. **Markdown is the human-readable truth of the bank; SQLite is a rebuildable index; git is the sync.** (ADR-0003.)
9. **Nothing in the plugin opens a network connection except git** (to the bank remote). No telemetry, no outbound events.
10. **Secrets are redacted before anything is stored**, defaults on, patterns extended for broker and exchange keys.

## 2. Architecture

```
┌───────────────────────── each machine (Mac, Windows, Mac mini) ─────────────────────────┐
│  Claude Code 2.1.x (unchanged)                                                            │
│   ├─ hooks (exec-form node, dist/hook.js <event>)                                         │
│   │    SessionStart · UserPromptSubmit · PostToolUse · PreCompact · PostCompact           │
│   │    SubagentStart · Stop · SessionEnd                                                  │
│   ├─ MCP server (dist/mcp.js, stdio): recall · kb_find · kb_write · kb_link · kb_brief ·  │
│   │    kb_compare                                                                         │
│   └─ skill: kb (how and when to record a finding, run compare, confirm a transfer)        │
│                                                                                           │
│  ~/.project-memory/            local state, never synced                                  │
│   ├─ blobs/<sha256>            offloaded tool outputs, snapshots (GC: 14 days / 500 MB)   │
│   ├─ sessions/<session_id>/    state.json, task-state.md, snapshots, audit.json, reports  │
│   ├─ kb.sqlite                 index + FTS5, rebuilt from the bank repo on demand         │
│   ├─ map.html                  generated lane map (open from disk)                        │
│   └─ logs/                     hook and tool logs                                         │
│                                                                                           │
│  ~/knowledge-bank/  (git repo; the bank)                                                  │
│   ├─ templates/<domain>.yaml   facet keys, method vocab, gate ladder, target axes         │
│   ├─ notes/<kind>/<id>.md      one note per file, YAML frontmatter = attrs + relations    │
│   ├─ evidence/...              byte-identical copies of imported memory files             │
│   ├─ concept-merges.md         log of automatic alias merges with undo commands           │
│   └─ .gitattributes            * text=auto eol=lf                                         │
└───────────────────────────────────────────────────────────────────────────────────────────┘
                 git push / pull over SSH (macOS Remote Login on the Mac mini, over Tailscale)
┌───────────── Mac mini ─────────────┐
│  bare repo  ~/bank.git             │   (optional later: nightly consolidation job)
└────────────────────────────────────┘
```

Two halves share the local state directory and the `kb.sqlite` index, and nothing else.

## 3. The session half (context management)

### 3.1 Hook table

| Event | Matcher | Mode | Timeout | Does | Output |
|---|---|---|---|---|---|
| SessionStart | `startup` | sync | 10 s | Project card + top findings brief (phase 2); pending synonym questions (≤ 3 lines) | `additionalContext` ≤ 9,000 chars |
| SessionStart | `clear` | sync | 10 s | Same as startup | same |
| SessionStart | `compact` | sync | 10 s | Restore brief: task-state record + audit omissions + recall pointers | same |
| SessionStart | `resume` | — | — | **Nothing is registered.** The transcript already carries prior context; re-injecting breaks the cache. | — |
| SessionStart | `startup\|clear\|compact\|resume` | **async** | 120 s | `git pull --rebase` the bank, re-import changed files, rebuild FTS; GC blobs | none |
| UserPromptSubmit | — | sync | 5 s | Recall brief when the prompt touches a known concept/project/ticker not yet briefed this session; stale-brief fallback; 300 ms query budget | `additionalContext` ≤ 9,000 chars, often empty |
| PostToolUse | `Bash\|Read\|Grep\|Glob\|WebFetch\|WebSearch\|mcp__.*` | sync | 10 s | Offload: if the largest text field of `tool_response` ≥ 8,000 chars (configurable), redact, store as blob, replace with deterministic placeholder; dedup-to-reference for repeats | `updatedToolOutput` (shape-preserving) or nothing |
| PreCompact | — | sync | 30 s | Snapshot the transcript since the last snapshot into a blob; write `task-state.md` | nothing; **never `block`** |
| PostCompact | — | sync | 15 s | Diff `compact_summary` against `task-state.md`; write `audit.json` (omissions) | nothing |
| SubagentStart | — | sync | 5 s | Pointer brief ≤ 1,500 chars: project id, bank location, how to `recall`, how to `kb_brief` | `additionalContext` |
| Stop | — | **async** | 30 s | Save `last_assistant_message` as `sessions/<id>/reports/<n>.md`; append usage sample from the transcript to `metrics.jsonl` | none |
| SessionEnd | — | async | 30 s | Move snapshots to blobs with TTL; delete `sessions/<id>/state.json` | none |

Matchers for SessionStart are three separate entries, not one regular expression, so each branch is explicit. No PreToolUse hook is registered at all.

### 3.2 Offload (PostToolUse)

Input: hook JSON with `tool_name`, `tool_input`, `tool_response`, `session_id`, `transcript_path`, `cwd`.

Algorithm:
1. Find the largest string field in `tool_response` (Bash: `stdout`; Read: `file.content`; Grep/Glob: `content` or the string itself; MCP: text blocks). If none ≥ `offload.thresholdChars` (default 8,000) → exit 0 with no output.
2. If the tool call is inside the protected recent zone (the last 3 tool calls of the current turn are never offloaded; configurable `offload.keepRecentCalls`) → no output. (The zone is computed from `sessions/<id>/state.json` which PostToolUse updates.)
3. `redact(text)` (§3.7) → `redacted`.
4. `sha256(redacted)` → `id` (16 hex chars shown). Write `blobs/<sha256>` atomically if absent (`atomic.ts`). Append `{id, tool, chars, head, session_id, created_at}` to `blobs/index.jsonl` (one JSON per line; filename-as-key means re-delivery is idempotent).
5. If `id` was already shown in this session (state.json `seen[]`) → replacement = short pointer:
   `[same output as earlier · id <id16> · <chars> chars · recall(id="<id16>") for the exact text]`
   else → replacement = first `offload.headLines` (default 40) lines + `\n…\n[offloaded <chars> chars (<lines> lines) · id <id16> · recall(id="<id16>", offset=0) returns exact 8 KB pages · stored locally, not sent anywhere]`
6. Replace **only** that field, preserving every other field and the object shape; emit `{"hookSpecificOutput":{"hookEventName":"PostToolUse","updatedToolOutput":<object>}}`.
7. Never touch `tool_input`. Never emit `additionalContext`. If anything throws or the 2-second internal deadline passes → exit 0 with no output (the original result stands).

Determinism: identical input produces byte-identical output, so a rebuilt history matches the live turn and the prompt cache is unaffected. Acceptance test measures `cache_read_input_tokens` vs `cache_creation_input_tokens` over a scripted 6-turn session with the hook on and off.

### 3.3 Recall (MCP tool)

`recall({ id: string, offset?: number, limit?: number })` → `{ id, total_chars, offset, text, next_offset | null }`. Default page 8,192 chars, hard max 32,768. Exact bytes from the blob (already redacted). Unknown id → clear error naming the blob directory. Guarded by a per-agent FloodGuard (copied from context-mode) so parallel subagents cannot flood their own windows. Snapshots are blobs too, so `recall` reopens pre-compaction material.

### 3.4 Snapshot and task-state record (PreCompact)

1. Read `transcript_path` from the byte offset recorded at the last snapshot (or 0); write that slice to a blob; record `{snapshot_id, from_offset, to_offset, at}` in `sessions/<id>/snapshots.jsonl`.
2. Build `task-state.md` deterministically from the transcript (no model):
   - **Goal**: the first user prompt of the session and the most recent user prompt (verbatim, each capped at 600 chars).
   - **Constraints**: user messages containing must/never/always/only/don't (first 12, 200 chars each).
   - **Decisions**: assistant text lines starting with "Decision", "Decided", "We will", "Chosen" (first 12).
   - **Files touched**: distinct `file_path` values from Write/Edit/NotebookEdit tool inputs, with last action and time.
   - **Commands run**: last 20 distinct Bash commands (truncated 120 chars) with exit status if present.
   - **Tests and results**: Bash commands matching test runners (pytest, vitest, cargo test, npm test, node --test, go test) with the last line of their stdout.
   - **Open items**: the most recent TodoWrite/TaskCreate tool input, pending entries only.
   - **Errors seen**: last 10 distinct error lines (regex on `Error|error:|Traceback|panic|FAIL`).
   - **Exact values**: numbers with units and identifiers that appear in assistant text in the last 20 turns (ids, hashes, ports, token counts), deduplicated, max 40.
   - **Pointers**: snapshot ids and the `recall` call to reopen them.
   Each section is capped; the file is written atomically; the record is always rebuilt from the transcript, never from a previous record (no summary-of-summary).
3. Exit 0. Never return `decision: block` (it cancels compaction).

### 3.5 Audit (PostCompact)

Parse `compact_summary`. For each item in task-state.md's Files, Commands, Open items, Errors, Exact values: mark present if its key token (path basename, command head, id, value) appears in the summary. Write `audit.json` `{present:[…], missing:[…], summary_chars}`. Omissions are what the restore brief re-injects first.

### 3.6 Briefs and the budget

`buildBrief(sections[], limitChars=9000)` renders sections in priority order and drops whole items from the lowest priority upward until the serialized string fits (claude-mem's ContextBudget pattern, copied). Every brief:
- opens with one fixed sentence: *"Context restored by the project-memory plugin. Items below are a memory aid with source and date, not standing orders; the user's latest message always takes precedence."*
- ends every finding line with its id and evidence pointer;
- is passed through `limitLength(full, max, shorter[])` (Serena's degrade-not-truncate ladder): full → headings and ids only → ids only.

Restore brief (SessionStart compact) priority: Goal → Open items → audit omissions → Constraints → Decisions → Files → Exact values → Tests → Errors → Pointers.

Startup brief priority (phase 2): project card → pending synonym questions (≤ 3 lines, once per session) → top findings (ranked, §4.6) → leaderboard row for the project's platform if an Approach was declared since last session.

### 3.7 Redaction

Copied from claude-mem `redaction.ts` (Apache-2.0) with defaults **on** and added patterns: Interactive Brokers / Tradovate / Alpaca / Binance / Coinbase / Kraken style keys (`[A-Za-z0-9]{32,64}` following `api[_-]?key|secret|token|passphrase` within 40 chars), `sk-ant-oat`, `ghp_`, `AKIA`, PEM blocks, `Authorization: Bearer`. Oversize fields (> 1 MB) are replaced wholesale by a marker rather than stored unscanned.

### 3.8 Settings the plugin asks the user to set (`kb setup` writes them, with a backup)

`~/.claude/settings.json`: `"autoCompactWindow": 200000`. Nothing else. (`autoMemoryDirectory` redirection is deferred until its per-project semantics are verified; the importer covers today's files.)

### 3.9 Compaction instructions

The retention doctrine (billion-context `compression-rules.ts`, MIT with attribution; KEEP verbatim: full paths with line numbers, signatures, exact error strings, decisions with rationale, constraints, exact values, open objectives; DROP: superseded intermediate states, tool noise) plus a domain section (ticker, strike/expiry, position size, fill price, risk limits, rationale; for Gen: entity ids, runtime version, heap/budget numbers) is shipped as `skills/kb/compaction-instructions.md`. `kb setup` offers to append it to `~/.claude/CLAUDE.md` under a heading, and the restore brief carries the same checklist regardless, so the design does not depend on whether the native compactor reads it (unverified).

### 3.10 Measurement

`kb doctor --baseline` reads `~/.claude/projects/**/*.jsonl` usage fields and prints: sessions, turns, context per turn p50/p90/p99/max, compactions per week, cache-read share. Baseline on 2026-10-16: p50 336K, p90 613K, max 966K, 2 compactions in 5,427 turns. Targets after phase 1 on real work: p50 < 200K, compactions actually occurring, zero unresolved audit omissions in a forced-compaction test, cache-read share unchanged with offload on.

## 4. The knowledge half (the bank)

### 4.1 Nouns and relations

Binding definitions are in `CONTEXT.md`. Kinds: `domain`, `template`, `project`, `theme`, `approach`, `experiment`, `target`, `concept`, `finding`, `evidence`, `report`. Relation types: `in_domain`, `under`, `has_facet` (approach/target → facet value, props `{key}`), `relies_on`, `tests`, `on`, `at`, `in`, `uses` (props `{method, objective}`), `about` (props `{facet_key?}`), `discovered_in`, `validated_in` (props `{gate}`), `transfer` (props `{state: proposed|confirmed_provisional|confirmed|refuted}`), `supersedes`, `conflicts_with`, `backed_by`, `summarizes`.

### 4.2 Storage: SQLite index (per machine, rebuildable)

```sql
CREATE TABLE note(id TEXT PRIMARY KEY, kind TEXT NOT NULL, domain TEXT, project TEXT, title TEXT NOT NULL,
  body TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL, updated_at TEXT NOT NULL, deleted_at TEXT,
  device_id TEXT NOT NULL, change_id TEXT NOT NULL);
CREATE TABLE attr(note_id TEXT NOT NULL, key TEXT NOT NULL, value TEXT NOT NULL,
  PRIMARY KEY(note_id, key, value));
CREATE TABLE rel(id TEXT PRIMARY KEY, src TEXT NOT NULL, type TEXT NOT NULL, dst TEXT NOT NULL,
  props TEXT NOT NULL DEFAULT '{}', created_at TEXT NOT NULL, deleted_at TEXT);
CREATE INDEX rel_src ON rel(src, type); CREATE INDEX rel_dst ON rel(dst, type);
CREATE INDEX attr_kv ON attr(key, value);
CREATE TABLE alias(name_norm TEXT PRIMARY KEY, concept_id TEXT NOT NULL, created_at TEXT NOT NULL, source TEXT NOT NULL);
CREATE TABLE pending_merge(id TEXT PRIMARY KEY, a TEXT NOT NULL, b TEXT NOT NULL, score REAL NOT NULL, reason TEXT NOT NULL, created_at TEXT NOT NULL, resolved TEXT);
CREATE TABLE rank_weights(key TEXT PRIMARY KEY, value REAL NOT NULL);
CREATE TABLE change_log(seq INTEGER PRIMARY KEY AUTOINCREMENT, entity TEXT NOT NULL, entity_id TEXT NOT NULL,
  change_id TEXT NOT NULL, device_id TEXT NOT NULL, changed_at TEXT NOT NULL, erased INTEGER NOT NULL DEFAULT 0);
CREATE VIRTUAL TABLE note_fts USING fts5(title, body, content='', tokenize='porter unicode61');
CREATE TABLE fts_map(rowid INTEGER PRIMARY KEY, note_id TEXT UNIQUE NOT NULL);
```
Finding fields are attrs: `state`, `gate`, `gate_rank`, `valid_from`, `valid_to`, `metric:<name>` (value as `<number>|<unit>|higher|lower`). A view `finding_v(id, title, project, domain, state, gate_rank, valid_from, valid_to)` pivots them for ranking SQL. Templates are notes of kind `template` whose attrs enumerate `facet`, `method`, `gate:<rank>`, `env_axis`, `subject_axis`. Adding a domain is inserts only.

### 4.3 Storage: the bank repository (truth)

- `templates/<domain>.yaml`: `domain`, `facets: [..]`, `methods: [..]`, `gates: [..]` (ordered), `environment: <label>`, `subject: <label>`, `seed_concepts: [{name, aliases}]`.
- `notes/<kind>/<id>.md`:
  ```
  ---
  id: f_01jcx9h2k7m4q8r3t6v9w2y5z8
  kind: finding
  domain: trading
  project: es-meanrev
  title: Fixed-fractional 0.5% beat fixed 1-lot on ES mean reversion
  created_at: 2026-09-01T14:02:11Z
  updated_at: 2026-09-01T14:02:11Z
  device_id: macbook-pro
  attrs:
    state: reproduced
    gate: out-of-sample
    gate_rank: 1
    valid_from: 2026-09-01
    metric:sharpe: 1.4|ratio|higher
  rels:
    - { type: about, dst: c_risk_sizing }
    - { type: about, dst: a_es_2sigma, props: { facet_key: risk } }
    - { type: validated_in, dst: t_ibkr_es, props: { gate: out-of-sample } }
    - { type: discovered_in, dst: x_e12 }
    - { type: backed_by, dst: e_3f9a1c2b4d5e6f70 }
  ---
  ## Claim
  …
  ## Why it matters
  ## Applies when / does not establish
  ## Evidence
  ```
- Relations reference ids, never titles, so renames never rot links.
- Ids: one-letter kind prefix + `_` + 26-char lowercase ULID (time-sortable). Imported evidence: `e_<sha256 first 16 hex>` (deterministic, dedupes across machines).
- Filenames are the id; all lowercase ASCII; total path < 200 chars.
- Import = parse every file, upsert rows, rebuild FTS; export = write the file from rows. Round trip is byte-stable (sorted keys, LF).

### 4.4 Sync

- Write path (`kb_write`, `kb_link`, importer): SQL transaction → export that note's file → spawn detached `git add -A && git commit -q -m "<kind> <id>" && git push -q` (stdio ignored, `unref()`); failures are logged and retried at the next SessionStart async hook.
- Read path (SessionStart async): `git pull --rebase --autostash`; on conflict in a note file the merge driver (`kb merge-driver`, registered in `.gitattributes`) keeps the side with the later `updated_at`, logs the resolution to `logs/merges.log`, and `kb doctor` reports it. Changed files are detected by content hash and re-imported; FTS rebuilt incrementally.
- Remote: `git@<mini-tailscale-name>:bank.git` (bare repo; macOS Remote Login; keys in the agent on Windows). Interim private GitHub remote is one `git remote set-url` away.
- `kb.sqlite`, `blobs/`, `map.html` are never in git and never in iCloud/OneDrive.

### 4.5 Tools (one stdio MCP server) and CLI

| Tool | Input | Output |
|---|---|---|
| `recall` | `{id, offset?, limit?}` | exact blob page |
| `kb_find` | `{query, limit?}` where query uses the Trilium-style subset: free text, `#key=value`, `#key>=n`, `~type.key=value`, `kind:finding`, `project:x`, `AND/OR/NOT`, `orderBy`, `limit` | `[{id, kind, title, snippet, attrs}]` |
| `kb_write` | one record: `{kind, title, body?, domain?, project?, attrs?, rels?, tags?}` | `{id, created|updated, concept_resolutions:[…], transfers_proposed:[…], questions_queued:n}` |
| `kb_link` | `{src, type, dst, props?}` or `{transfer_id, state}` | `{rel_id}` |
| `kb_brief` | `{project?, task?, limit?}` | the ranked brief text + items |
| `kb_compare` | `{concept?: id, facet_key?: string, environment?: string}` | leaderboard rows |

CLI `kb` (same bundle): `init`, `setup`, `doctor [--baseline]`, `cleanup [--apply]`, `import serena|claude-memory|all`, `export`, `sync`, `rebuild`, `map`, `concepts review`, `transfer <id> confirm|refute`, `merge-driver`.

### 4.6 Ranking (a sort, weights in `rank_weights`)

For a candidate finding F against the asking project P (declared in `.kb.json`: `project_id, domain, facets, target:{environment, subject}, relies_on[]`):
`+3` per facet value identical, `+1` per shared facet key with a different value, `+2` environment match, `+2` subject match, `+gate_rank`, `+1` if `valid_from` within 90 days decaying linearly to 0 at 365, `+2` per confirmed transfer of findings about the same concept, `−2` per refuted, `−3` if `conflicts_with` non-empty, `×0.5` if past `valid_to` (demoted, hatched on the map; never hidden), dropped if superseded or deleted. Ties by `updated_at` desc.

### 4.7 Concept grouping (no model)

`normalize(name)`: lowercase → strip punctuation → split on space/`-`/`_`/camelCase → porter-stem each token → drop stopwords → sort → join with `-`.
On every tag: exact normalized match or alias hit → attach silently. Else compute Dice overlap of stemmed token sets against all concept names and aliases: `≥ 0.8` with exactly one candidate and ≥ 2 shared tokens → auto-alias (log line in `concept-merges.md` with `kb concepts split <alias>` as the undo); `0.5–0.8` or a tie → `pending_merge` row; `< 0.5` → new concept. Second signal: two concepts co-occurring on findings sharing a facet key three or more times → `pending_merge`. Questions surface only at SessionStart (max 3 lines) or via `kb concepts review`. Seed concepts with aliases from `templates/*.yaml` at `kb init`.

### 4.8 Transfers

`kb_write` of a finding about concept C creates a `transfer{state: proposed}` relation toward every approach in another project that `relies_on` C or shares a facet key with the finding's approach. A later finding in the target project about C: metrics agree in direction → `confirmed_provisional`; disagree → both findings `conflicts_with` each other and the transfer stays proposed. `kb transfer <id> confirm|refute` sets the final state. Transfer verdicts feed ranking (§4.6).

### 4.9 Leaderboard (`kb_compare`)

Group experiments by `(domain, environment, method, objective)` where environment matches the asking project's platform and the approach shares at least one facet key: rows `method · objective · runs · highest gate · median improvement over baseline · wins (times the run produced the top metric among siblings) · total trials · last date`, sorted by gate rank, wins, recency; the same rows for other environments shown beside; a method top-ranked elsewhere but never run here becomes a proposed transfer.

### 4.10 Importers

- Serena: `~/projects/**/.serena/memories/**/*.md` and `~/.serena/memories/global/**/*.md` → evidence notes (`e_<sha>`), body = exact text, attrs `origin: serena`, `source_path`, `project` (from the repo), `sha256`; `mem:name` references (anchored regex) → `rel about` edges between evidence notes. Originals are never modified.
- Claude Code auto-memory: `~/.claude/projects/<dashed-cwd>/memory/*.md` (skip `MEMORY.md`), frontmatter `name/description/metadata.type` → attrs; `type` maps to `origin_type`; same evidence kind.
- Nothing is promoted to a finding automatically; a finding is written by the working agent via `kb_write` or by Gage via the skill.

### 4.11 The map

`kb map` writes `~/.project-memory/map.html` (self-contained; d3-force from cdnjs pinned to an exact version; inline JSON): swimlane per domain; columns Theme → Approach → Experiment → Target; finding badges clipped to their `about` node, colored by state (green reproduced, blue observed, amber unverified, red conflicting, hatched past `valid_to` or superseded); concept hubs in a fifth column, bold when touched from ≥ 2 lanes, hollow when a pending merge exists; edge styles about solid, discovered_in dotted, transfer dashed (proposed) / solid green (confirmed) / red cross (refuted), validated_in labeled with the gate, supersedes faded; filters by domain, platform, instrument, state, gate ≥, valid today, has evidence, show proposed transfers. Read-only; every node shows its id and the exact `kb …` command to paste for each steering action.

### 4.12 Templates shipped

`templates/trading.yaml`, `templates/gen-l1.yaml`, `templates/ios.yaml` as in the deep dive (facets, methods, gates, axes, 3–4 seed concepts each incl. `risk-sizing`, `autocorrelation`, `transaction-cost-model`, `heap-ceiling`, `per-activation-work-budget`, `block-quantisation`, `idempotency`, `swiftui-state-ownership`).

## 5. Plugin packaging and install

- One private git repo `project-memory` is both marketplace and plugin: `.claude-plugin/marketplace.json` lists `plugins/project-memory` (relative source), so it loads **in place**: `git pull` + `/reload-plugins` is the update. Added once per machine with `/plugin marketplace add <local clone path>` then `/plugin install project-memory@project-memory`.
- `plugins/project-memory/.claude-plugin/plugin.json`, `hooks/hooks.json` (exec form, `${CLAUDE_PLUGIN_ROOT}/dist/hook.js`), `.mcp.json` (`node ${CLAUDE_PLUGIN_ROOT}/dist/mcp.js`), `skills/kb/SKILL.md`, `dist/` committed (esbuild bundles, no runtime `node_modules`), `THIRD_PARTY_NOTICES.md`.
- Windows: exec-form only; `path.normalize` on every path; `.gitattributes` LF; bank and state outside iCloud/OneDrive; Node ≥ 24.15; same drive-letter spelling when launching Claude.

## 6. Machine cleanup (`kb cleanup`)

Reports, and with `--apply` performs (each edited file backed up as `<file>.bak-<timestamp>`):
- Disable and uninstall `agentmemory@agentmemory` (12 hooks to a dead `localhost:3111`); remove its MCP entry from `~/.claude.json`; remove `~/.agentmemory` (after copying its single 143 KB backup into `~/.project-memory/imports/`).
- Uninstall `claude-supermemory@supermemory-plugins` (already disabled).
- Retire `context-mode@context-mode` once phase 1's offload passes its acceptance test (its PreToolUse Agent rewrite collides with subagent briefs; its sandbox routing is replaced by transparent offload). Until then it stays and our plugin registers no PreToolUse hook.
- Remove the Serena MCP registration after `kb import serena` has run (originals untouched).
- Flag MCP entries whose command cannot start (e.g. `morphllm-fast-apply` pointing at `/home/`), and list MCP servers and plugins with no tool calls in the last 30 days of transcripts, for Gage to confirm.
- Leave RTK, superpowers, codex, vercel, ponytail, i-have-adhd, watch, gen-skills untouched.
- The Obsidian "Engineering" vault is not used by the plugin; it is left in place (Gage: delete or reuse at will).

## 7. Doctor (`kb doctor`)

Prints one line per check with pass/warn/fail: Node ≥ 24.15; `node:sqlite` has FTS5 (`pragma compile_options`); git present; bank repo clean/ahead/behind and last pull/push; `kb.sqlite` size and row counts; blobs size and oldest; pending merges; hooks registered by this plugin (reads the active settings and plugin cache); competing hooks (any other plugin with a PreToolUse `Agent` matcher, SubagentStart, or SessionStart injecting > 5,000 chars); `autoCompactWindow` value; last 10 merge resolutions; `--baseline` metrics (§3.10); `--live` runs the marker test (spawns `claude -p` headless with a temporary project settings file) to prove PostToolUse replacement, SubagentStart injection and the 10K cap on this machine.

## 8. Acceptance (what "done" means)

Phase 1: a real session's median context drops below 200K; a forced `/compact` produces a `task-state.md`, an `audit.json`, and a restore brief with zero unresolved omissions; `recall` reopens an offloaded output byte-exactly; cache-read share with offload on is within 5 points of off; `kb doctor --live` passes on this Mac; nothing in `~/.claude/settings.json` changed except `autoCompactWindow`.
Phase 2: the risk-sizing finding written in the options repo surfaces in the futures repo's SessionStart brief on the other machine as a proposed transfer with its evidence pointer; `kb transfer confirm` turns the map edge solid; the genibook heap-ceiling finding reaches gen-clob-explorer the same way; `kb compare` prints a leaderboard; the 213 Serena and 547 auto-memory files are present as evidence and searchable; `git log` on the mini shows both machines' commits; `kb doctor` is clean on both.
Phase 3: all of phase 1 and 2 pass on the Windows PC.

## 9. Risks and mitigations

| Risk | Mitigation |
|---|---|
| Interactive mode differs from headless tests | `kb doctor --live` plus a documented 5-minute interactive check before relying on any route |
| Unknown `tool_response` shapes | Offload only replaces when it finds one dominant string field; otherwise leaves the result untouched; fixtures for Bash, Read, Grep, WebFetch, one MCP tool |
| Compactor ignores CLAUDE.md instructions | Restore brief carries the KEEP checklist regardless |
| False concept merges | Auto-merge only at ≥ 0.8 with ≥ 2 shared stemmed tokens and a single candidate; every merge logged with an undo |
| Git conflicts on the same note | One file per note; LWW merge driver by `updated_at`; doctor reports every resolution |
| Windows exec-form regressions | Pin Claude Code ≥ 2.1.299; `kb doctor --live` on the PC on day one |
| Blob store growth | 14-day TTL and 500 MB cap with GC in the SessionStart async hook; doctor prints sizes |

## 10. Deferred (explicitly)

Proxy-based server-side context editing; history folding; background LLM summarizer; `autoMemoryDirectory` redirection; a hub HTTP service on the mini; embeddings; one-way export into Trilium or an Obsidian canvas; mobile viewer.

## 11. Provenance of lifted code (see `THIRD_PARTY_NOTICES.md`)

| From | What | License | Mode |
|---|---|---|---|
| claude-mem | `ContextBudget.ts` (95 LOC), `redaction.ts` (~150), dedup (`normalize/tfidfCosine/idf/idfVeto/nearDuplicate`, ~195), `transcript-parser.ts` tail reader (~120) | Apache-2.0 | copy with headers + NOTICE |
| billion-context | `compression-rules.ts` doctrine text (137), `content-store.ts` (143) | MIT + attribution rider | copy with header; README attribution line |
| context-mode | `run-hook.mjs`, `stdin.mjs` (~185), `truncate.ts` (154), `flood-guard.ts` (111); FTS5 recipe constants | Elastic-2.0 | copy with ELv2 text and "modified" notice |
| Serena | memory path convention, `mem:` regex, name scorer, output ladder, hook-state pattern, atomic write | GPL-3.0 (app) | **re-implemented from behaviour; no text copied** |
| Trilium | search grammar cheat-sheet as tool description spec; data-model shape; note-map edge rules | AGPL-3.0 | **re-implemented; grammar copied as specification (51 lines)** |
| Others | inject-don't-recall, bi-temporal fields, write-time reconciliation, three-factor ranking, anchored task-state shape, omission audit | papers / Apache / MIT | ideas only |

## 12. Decisions taken (16 Oct 2026, Gage)

Hooks-only, native compaction kept (ADR-0001/0002) · Trilium rejected for SQLite + Markdown export + git (ADR-0003) · working set 200K · no summarizer · Serena dropped after import · read-only map with pasteable commands · synonym questions at session start ≤ 3 lines plus review command · transfer verdicts automatic-provisional until touched · Concept is the cross-domain carrier · method and objective are two fields · validation on the environment × subject pair with partial credit · findings age by expiry and supersession, demoted not hidden · Mac mini is always awake and on Tailscale · Obsidian vault unused (left alone) · disable/delete unused plugins and MCPs via `kb cleanup` before first start.
