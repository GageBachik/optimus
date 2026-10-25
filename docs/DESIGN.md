# Optimus — Design Specification

Version 1.1 · 16 October 2026 · Status: **approved for implementation, revised after the three-lens review** (all decisions in §12).
Companion documents: `CONTEXT.md` (glossary, binding), `docs/adr/0001–0003` (hard-to-reverse decisions), `docs/HANDOFF.md` (how the plugin is watched in live sessions and what the tests established). The 16 October review, the phased plans, the visual briefs and the live probes this spec rests on are kept outside the public repository.

---

## 0. Purpose in one paragraph

One Claude Code plugin, written in TypeScript for Node 24, that does two things Claude Code does not do: (1) **keeps the active session's working context small and high-value while making everything else recoverable** (offload large tool results, snapshot before native compaction, audit the summary after, re-brief the main agent and every subagent), and (2) **gives Gage one knowledge bank shared across his MacBook Pro, Windows PC and always-on Mac mini** in which a discovery made in one project reaches every other project where it applies, across platforms and domains, with a map he can read and steer. It uses only documented Claude Code extension points so it keeps working when Claude Code updates.

## 1. Rules (binding)

1. **No harness hijack.** Hooks, MCP tools, the plugin manifest, skills, and settings keys only. No `ANTHROPIC_BASE_URL` proxy. No rewriting of conversation history. Native compaction stays on. (ADR-0001, ADR-0002.)
2. **Only what Claude Code lacks.** If Claude Code covers most of a tool's job, that tool is dropped, not wrapped. Serena, context-mode, agentmemory, claude-mem, billion-context and Trilium are quarries; what was lifted and under which license is in §11.
3. **Zero model calls in any hot path.** Hooks and tools are deterministic. No background summarizer. (A future opt-in summarizer may only run as a non-bare `claude -p` on a small model; never the Messages API or the Agent SDK with the subscription token.)
4. **Never emit `additionalContext` from PreToolUse or PostToolUse** (it rewrites the cached prompt prefix on every tool call; claude-code issue #83913). Offload uses `updatedToolOutput` with a deterministic replacement.
5. **Every injected string is measured and fitted under 9,000 characters** (Claude Code's cap is 10,000; over it the whole string is silently replaced by a file path and a 2,000-character preview; confirmed live).
6. **Hooks are exec-form `node` with no shell**, dependency-free bundles, exit 0 always, stdin read as UTF-8 with an idle timeout, diagnostics to a log file never stdout.
7. **Node ≥ 24.4.0** on every machine. `node:sqlite` with FTS5 is present from 24.4 (verified on this Mac); its ExperimentalWarning is silenced by passing `--disable-warning=ExperimentalWarning` as the first argument of every hook and MCP command. `kb doctor` probes FTS5 (hard check) and prints the Node version as information, recommending ≥ 24.15.
8. **Markdown is the human-readable truth of the bank; SQLite is a rebuildable index; git is the sync.** (ADR-0003.)
9. **Nothing in the plugin opens a network connection except git** (to the bank remote). No telemetry, no outbound events.
10. **Secrets are redacted before anything is stored**, defaults on, with the exact patterns in §3.7, which include generic broker and exchange key shapes.

## 2. Architecture

```
┌───────────────────────── each machine (Mac, Windows, Mac mini) ─────────────────────────┐
│  Claude Code 2.1.x (unchanged)                                                            │
│   ├─ hooks (exec-form node, dist/hook.js <event>)                                         │
│   │    SessionStart · UserPromptSubmit · PostToolUse · PreCompact · PostCompact           │
│   │    SubagentStart · Stop · SessionEnd                                                  │
│   ├─ MCP server (dist/mcp.js, stdio, one process per session):                            │
│   │    recall · kb_find · kb_write · kb_link · kb_brief · kb_compare                      │
│   └─ skill: kb (how and when to record a finding, run compare, confirm a transfer)        │
│                                                                                           │
│  ~/.optimus/            local state, never synced                                  │
│   ├─ blobs/<sha256>            offloaded tool outputs, snapshots (GC: 14 days / 500 MB)   │
│   ├─ sessions/<session>/<agent>/   state.json; main agent also task-state.{md,json},      │
│   │                                audit.json                                             │
│   ├─ projects/<key>/last-session.json  where the last session in that project left off   │
│   ├─ kb.sqlite                 index + FTS5, rebuilt from the bank repo on demand         │
│   ├─ map.html                  generated lane map (open from disk)                        │
│   ├─ metrics.jsonl             one usage sample per main-agent Stop                       │
│   ├─ config.json               bankDir, deviceId, lastSyncAt, offload thresholds          │
│   └─ logs/                     hook and tool logs                                         │
│                                                                                           │
│  ~/knowledge-bank/  (git repo; the bank)                                                  │
│   ├─ templates/<domain>.yaml   facet keys, method vocab, gate ladder, target axes         │
│   ├─ notes/<kind>/<id>.md      one note per file, YAML frontmatter = attrs + relations    │
│   │                            (imported memory files live here as evidence notes)        │
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

Plugin hooks also fire inside subagents, with the same `session_id` and an `agent_id`. Every per-session file is therefore keyed by `session_id` **and** `agent_id ?? 'main'`; snapshot, audit, task-state and the restore brief are produced for the main agent only (any input carrying `agent_id` returns nothing from those hooks).

| Event | Matcher | Mode | Timeout | Does | Output |
|---|---|---|---|---|---|
| SessionStart | `startup` | sync | 10 s | Last-session section for this project (§3.11) + project card; phase 2 adds the top findings brief, pending synonym questions (≤ 3 lines) and imported memory titles whenever the project has imported memory notes | `additionalContext` ≤ 9,000 chars |
| SessionStart | `clear` | sync | 10 s | Same as startup | same |
| SessionStart | `compact` | sync | 10 s | Restore brief from `task-state.json` + `audit.json` omissions + recall pointers | same |
| SessionStart | `resume`, `fork` | — | — | **No brief is injected** (the transcript already carries it; re-injecting breaks the cache). Only the async hook below runs. | — |
| SessionStart | `startup\|clear\|compact\|resume\|fork` | **async** | own deadline | Spawn `kb sync` detached (§4.4); GC blobs. Claude Code does not enforce timeouts on async hooks, so every git call carries its own 60-second `spawnSync` timeout. | none |
| UserPromptSubmit | — | sync | 5 s | Recall brief when the prompt touches a known concept or project not yet briefed this session (phase 2); if the bank query throws, the last successful brief cached in `state.json` is injected instead | `additionalContext` ≤ 9,000 chars, often empty |
| PostToolUse | `Bash\|Grep\|Glob\|WebFetch\|WebSearch\|mcp__.*` | sync | 10 s | Offload: if the one dominant text field of `tool_response` ≥ 20,000 chars (configurable), redact, store as blob, replace with a deterministic head-and-tail placeholder; same-agent repeats become a one-line pointer. `Read` is excluded: the model chose that read and has offset/limit. | `updatedToolOutput` (shape-preserving) or nothing |
| PreCompact | — | sync | 30 s | Main agent only. Snapshot the transcript since the last snapshot into a blob; write `task-state.md` and `task-state.json` | nothing; **never `block`** |
| PostCompact | — | sync | 15 s | Main agent only. Diff `compact_summary` against `task-state.json`; write `audit.json` (omissions) | nothing |
| SubagentStart | — | sync | 5 s | Pointer brief ≤ 1,500 chars: project id, bank location, how to `recall`, how to `kb_brief` | `additionalContext` |
| Stop | — | **async** | — | Main agent only. Rebuild the task-state record from the transcript and write `projects/<key>/last-session.json` (§3.11); append a usage sample to `metrics.jsonl`; phase 2: run `kb sync` if the last sync is older than 60 s. No report files. | none |
| SessionEnd | — | **sync** | shared 1.5 s | Store `task-state.md` as a blob if present; delete `sessions/<id>/`. Milliseconds of work: plugin SessionEnd hooks share a 1.5-second budget that per-hook timeouts cannot raise, and async hooks are killed at exit. | none |

Matchers for SessionStart are separate entries, not one regular expression, so each branch is explicit. No PreToolUse hook is registered at all.

### 3.2 Offload (PostToolUse)

Input: hook JSON with `tool_name`, `tool_input`, `tool_response`, `session_id`, `agent_id?`, `transcript_path`, `cwd`.

Algorithm:
1. Find the largest string field anywhere in `tool_response` (Bash: `stdout`; Grep/Glob: `content` or the string itself; MCP: a text block). If there is no string, or the largest is shorter than twice the second largest (ambiguous shape), or it is below `offload.thresholdChars` (default 20,000) → exit 0 with no output. For Bash the hook only ever sees between the threshold and Claude Code's read-back window (`BASH_MAX_OUTPUT_LENGTH`, default 30,000 characters); larger outputs are already file-offloaded natively and arrive as a short message the hook leaves alone.
2. Recent-zone protection (never offloading the last few calls of a turn) is **deferred**: PostToolUse cannot see the rest of the turn. Instead the restore brief's Pointers section carries the last three offload ids of the session.
3. `redactSensitive(text)` (§3.7) → `redacted`.
4. `sha256(redacted)` → `id` (16 hex chars shown). Write `blobs/<sha256>` atomically if absent. Append `{id, tool, chars, lines, head, sessionId, createdAt, command?}` to `blobs/index.jsonl` (filename-as-key means re-delivery is idempotent).
5. If `id` is already in this agent's `state.json` `seenBlobs` → replacement = one-line pointer:
   `[same output as earlier · id <id16> · <chars> chars · recall(id="<id16>") for the exact text]`
   else → replacement = first `offload.headLines` (default 30) lines, then
   `…[<n> lines offloaded · id <id16> · recall(id="<id16>", offset=0) pages the full <chars> chars]…`, then the last `offload.tailLines` (default 15) lines. Command output puts the information at the end (test summary, exit status, the error), so the tail is kept.
6. Replace **only** that field, preserving every other field and the object shape; emit `{"hookSpecificOutput":{"hookEventName":"PostToolUse","updatedToolOutput":<object>}}`.
7. Never touch `tool_input`. Never emit `additionalContext`. If anything throws or the 2-second internal deadline passes → exit 0 with no output (the original result stands).

Determinism: identical input produces byte-identical output, so a rebuilt history matches the live turn and the prompt cache is unaffected. Acceptance test measures `cache_read_input_tokens` vs `cache_creation_input_tokens` over a scripted session with the hook on and off.

### 3.3 Recall (MCP tool)

`recall({ id: string, offset?: number, limit?: number })` → `{ id, total_chars, offset, text, next_offset | null }`. Default page 8,192 chars, hard max 32,768. Exact bytes from the blob (already redacted). Unknown id → clear error naming the blob directory. There is one MCP server process per Claude Code session and Claude Code sends no agent identity on tool calls, so no per-agent flood guard is possible or attempted; the page clamp bounds every call. Snapshots are blobs too, so `recall` reopens pre-compaction material.

### 3.4 Snapshot and task-state record (PreCompact, main agent only)

1. Read `transcript_path` from the byte offset recorded at the last snapshot (or 0); write that slice to a blob; record `{id, from, to, at}` in `state.json`'s `snapshots`.
2. Build the task-state record deterministically from the transcript (no model) and write it twice: `task-state.md` (human-readable) and `task-state.json` (what PostCompact and SessionStart read):
   - **Goal**: the first user prompt of the session and the most recent user prompt (verbatim, each capped at 600 chars).
   - **Constraints**: user messages containing must/never/always/only/don't (first 12, 200 chars each).
   - **Decisions**: assistant text lines starting with "Decision", "Decided", "We will", "Chosen" (first 12).
   - **Files touched**: distinct `file_path` values from Write/Edit/NotebookEdit tool inputs, with last action and time.
   - **Commands run**: last 20 distinct Bash commands (truncated 120 chars).
   - **Tests and results**: Bash commands matching test runners (pytest, vitest, cargo test, npm test, node --test, go test) with the last line of their result.
   - **Open items**: the most recent TodoWrite/TaskCreate tool input, pending entries only.
   - **Errors seen**: last 10 distinct error lines (regex on `Error|error:|Traceback|panic|FAIL`).
   - **Exact values**: from assistant text in the last 20 assistant turns: numbers with a unit (`%`, ms, s, K, M, GB, MB, KB, tokens, bps), bare numbers of four or more digits, and hex identifiers of 7–40 characters; deduplicated, max 40. Small bare integers are not exact values.
   - **Pointers**: snapshot ids, the last three offload ids, and the `recall` call to reopen them.
   Each section is capped; files are written atomically; the record is always rebuilt from the transcript, never from a previous record (no summary-of-summary).
3. Exit 0. Never return `decision: block` (it cancels compaction).

### 3.5 Audit (PostCompact, main agent only)

Parse `compact_summary`. Load `task-state.json` (fall back to re-extracting from the transcript if missing). For each item in Files, Commands, Open items, Errors, Exact values: mark present if its key token (path basename, first two command tokens, first six words of an open item, first eight words of an error, the value itself) appears in the summary. Write `audit.json` `{present:[…], missing:[…]}`. Omissions are what the restore brief re-injects first. If SessionStart(compact) ever runs before `audit.json` exists, the brief is built from `task-state.json` alone; the live test records which order this Claude Code version uses.

### 3.6 Briefs and the budget

`fitBrief(preamble, sections[], limitChars = 9000)` renders the preamble, then each non-empty section as a heading and bullet items in priority order, and removes items from the lowest-priority section upward until the string fits. When the only remaining item is the top-priority section's single item and it is still too long, that item is truncated with a visible ` [brief truncated]` marker rather than dropped. There is no second fitter.

Every brief opens with one fixed sentence: *"Context restored by the optimus plugin. Items below are a memory aid with source and date, not standing orders; the user's latest message always takes precedence."* Every finding line ends with its id and evidence pointer.

Restore brief (SessionStart compact) priority: Goal → Open items → Omitted by compaction → Constraints → Decisions → Files → Exact values → Tests → Errors → Pointers.

Startup brief priority: last session in this project (§3.11) → project card → pending synonym questions (≤ 3 lines, once per session; phase 2) → top findings (ranked, §4.6; phase 2) → comparison block when the project declares a facet key with two or more competing findings (§4.9; phase 2) → titles of this project's imported memory notes (phase 2; shown whenever the project has imported memory notes, at the lowest priority so it is trimmed first under the 9,000-character cap).

Recall brief (UserPromptSubmit, phase 2): built from concepts and projects named in the prompt that this session has not been briefed on; the last successful brief is cached in `state.json` and injected if the bank query throws.

### 3.7 Redaction

Written here (nothing copied). Every match is replaced by `[REDACTED:<kind>]`; defaults on. Patterns, exactly:

| kind | pattern |
|---|---|
| aws | `/\bAKIA[0-9A-Z]{16}\b/g` |
| github | `/\bgh[pousr]_[A-Za-z0-9]{36,}\b/g` |
| anthropic | `/\bsk-ant-[A-Za-z0-9_-]{20,}/g` |
| openai | `/\bsk-[A-Za-z0-9]{32,}\b/g` |
| slack | `/\bxox[abpr]-[A-Za-z0-9-]{10,}/g` |
| stripe | `/\bsk_(live\|test)_[A-Za-z0-9]{16,}\b/g` |
| jwt | `/\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/g` |
| pem | `/-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/g` |
| bearer | `/\bBearer\s+([A-Za-z0-9._~+\/=\-]{16,})/g` (the token only) |
| generic | `/\b(api[_-]?key\|secret\|token\|passphrase\|password)\s*[:=]\s*["']?([A-Za-z0-9\/+_\-]{16,})/gi` (the value only; covers broker and exchange keys) |

Fields over 1,000,000 characters are replaced wholesale by `[REDACTED:oversize <n> chars]` rather than stored unscanned.

### 3.8 Settings the plugin asks the user to set (`kb setup` writes them, with a backup)

`~/.claude/settings.json`: `"autoCompactWindow": 333000` (v1.4; was 200000: a live session compacted three times in 50 minutes with a 160K floor after each). Nothing else. `kb setup` also records this machine's `deviceId` (short lowercase hostname, overridable with `--device`) in `~/.optimus/config.json`. (`autoMemoryDirectory` redirection is deferred until its per-project semantics are verified; the importer covers today's files.)

### 3.9 Compaction instructions

The retention doctrine (billion-context `kernel/src/compression-rules.ts`, MIT with attribution, copied from the pinned commit in `THIRD_PARTY_NOTICES.md`; KEEP verbatim: full paths with line numbers, signatures, exact error strings, decisions with rationale, constraints, exact values, open objectives; DROP: superseded intermediate states, tool noise) plus a domain section (ticker, strike/expiry, position size, fill price, risk limits, rationale; for Gen: entity ids, runtime version, heap/budget numbers) is shipped as `skills/kb/compaction-instructions.md`. `kb setup` offers to append it to `~/.claude/CLAUDE.md` under a heading, and the restore brief carries the same checklist regardless, so the design does not depend on whether the native compactor reads it (unverified).

### 3.10 Measurement

`kb doctor --baseline` reads `~/.claude/projects/**/*.jsonl` usage fields and prints: sessions, turns, context per turn p50/p90/p99/max, compactions per week, cache-read share. Baseline on 2026-10-16: p50 336K, p90 613K, max 966K, 2 compactions in 5,427 turns. Targets after phase 1 on real work: p50 < 200K, compactions actually occurring, zero unresolved audit omissions in a forced-compaction test, cache-read share unchanged with offload on.

### 3.11 Session continuity (what replaces `/sc:load` and `/sc:save`)

> v1.4 subagents: SubagentStart injects the project card, the top 5 findings and the instruction to `kb_write` what the agent measures (≤ 3,000 chars; was a 1,500-char pointer brief). SubagentStop (async) extracts the agent's own transcript (`agent_transcript_path`) and merges its measurement lines into the project's `draft-findings.json` (same sentence once, newest 20), so a workflow's experiment agents feed the bank even when only a paragraph of their report reaches the main agent.

> v1.4: the Stop hook also drafts findings. Every assistant line that states a number (a percentage, a dollar figure, a count with a unit) becomes a draft finding (state observed, evidence = the transcript and the files touched, at most 8 per session) in `~/.optimus/projects/<key>/draft-findings.json`; the next startup brief names the file and the one command (`kb write <file>`) that records them after a person has edited the titles. Nothing reaches the bank without that step. The startup brief shows at most 6 findings and a prompt brief at most 5 (was 20: two live sessions cited none). Shell output offloads from 10,000 characters (other tools 20,000).
>
> v1.6: the session records its own findings; no person runs `kb write` on a draft file. The project card tells the main session to record what it measures as it goes (its agents already do), and the Stop hook (now synchronous) returns `decision: "block"` once per turn, with the turn's measured statements as candidates, when the turn stated measurements and called no `kb_write`; `stop_hook_active` and the statements' presence in the log stop it from asking twice. The draft file is a log of what was stated, not a to-do list; the brief's review line is gone.
>
> v1.5 (first live session): of 11 captured values only 3 became drafts. The claim filter now treats a signed decimal ("correlation is +0.35"), "5 times", "a year" and the word correlation as measurements, and a bare "I" as narration only at the start of a line ("I turned every idea into a backtest" drops; "under all 16 ways I tried" stays). Workflow/Agent result boilerplate ("Transcript dir: …/wf_1344b0b0", "Spawned successfully … internal metadata") is never a value: its run ids look like hashes. The draft file is also a ledger: `kb write <draft file>` marks each recorded draft in place with its `written` finding id (up to 40 kept), the Stop hook never drafts a marked sentence again, a second `kb write` reports them as already recorded instead of duplicating, and the brief line ("Draft findings waiting for review: N") counts the file's pending records rather than the last-session snapshot, so a `kb write` run between turns ends the nag. Titles are cut at a word, never mid-word.

Gage's requirement (16 Oct, evening): opening a session in a project must load the right context by itself, with no command. Three layers, all automatic:

1. **Where the last session left off.** After every main-agent turn the Stop hook rebuilds the task-state record (§3.4) from the transcript and writes it to `~/.optimus/projects/<project key>/last-session.json` with the time, session id and working directory. The project key is the `project_id` from `.kb.json` when one is present, otherwise a hash of the normalized working directory, so this works in phase 1 before the bank exists. On `startup` and `clear` the SessionStart hook injects a "Last session in this project" section (when, goal, open items, decisions, files touched, pointers) at top priority. This record is machine-local by design: it is working state, not knowledge; the bank carries what should travel between machines.
2. **What the bank knows about this project** (phase 2): the ranked findings brief, the comparison block, and, whenever the project has imported memory notes, the titles of its imported Serena and auto-memory notes (lowest priority, so they are trimmed first under the 9,000-character cap) with the `kb_find` call that opens any of them, so the 760 imported files are reachable from the first session without a command.
3. **What Claude Code already loads natively** is left alone: `CLAUDE.md`, the auto-memory `MEMORY.md` index, and `--resume`/`--continue` for the same conversation. The plugin never duplicates those.

Nothing is saved by a command either: PreCompact, Stop and SessionEnd capture; `kb sync` carries bank changes to the other machines. `/sc:save` and `/sc:load` therefore become removable (§6).

## 4. The knowledge half (the bank)

### 4.1 Nouns and relations

Binding definitions are in `CONTEXT.md`. Kinds: `domain`, `template`, `project`, `theme`, `approach`, `experiment`, `target`, `concept`, `finding`, `evidence` (`report` is defined in the glossary but no tool produces one in phases 1–2). Facets are **attributes** on approach and target notes, key `facet:<key>`, one row per value; there is no facet node. Relation types: `in_domain`, `under`, `relies_on`, `tests`, `on`, `at`, `in`, `uses` (props `{method, objective}`), `about` (props `{facet_key?}`), `discovered_in`, `validated_in` (props `{gate}`), `transfer` (props `{state: proposed|confirmed_provisional|confirmed|refuted}`), `supersedes`, `conflicts_with`, `backed_by`, `summarizes`.

### 4.2 Storage: SQLite index (per machine, rebuildable)

```sql
CREATE TABLE note(id TEXT PRIMARY KEY, kind TEXT NOT NULL, domain TEXT, project TEXT, title TEXT NOT NULL,
  body TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL, updated_at TEXT NOT NULL, deleted_at TEXT,
  device_id TEXT NOT NULL);
CREATE TABLE attr(note_id TEXT NOT NULL, key TEXT NOT NULL, value TEXT NOT NULL,
  PRIMARY KEY(note_id, key, value));
CREATE INDEX attr_kv ON attr(key, value);
CREATE TABLE rel(id TEXT PRIMARY KEY, src TEXT NOT NULL, type TEXT NOT NULL, dst TEXT NOT NULL,
  props TEXT NOT NULL DEFAULT '{}', created_at TEXT NOT NULL, deleted_at TEXT);
CREATE INDEX rel_src ON rel(src, type); CREATE INDEX rel_dst ON rel(dst, type);
CREATE TABLE alias(name_norm TEXT PRIMARY KEY, concept_id TEXT NOT NULL);
CREATE TABLE pending_merge(id TEXT PRIMARY KEY, a TEXT NOT NULL, b TEXT NOT NULL, score REAL NOT NULL,
  reason TEXT NOT NULL, created_at TEXT NOT NULL, resolved TEXT);
CREATE TABLE rank_weights(key TEXT PRIMARY KEY, value REAL NOT NULL);
CREATE TABLE meta(key TEXT PRIMARY KEY, value TEXT NOT NULL);          -- file hashes, last sync result
CREATE VIRTUAL TABLE note_fts USING fts5(note_id UNINDEXED, title, body, tokenize='porter unicode61');
```
The FTS table is a plain (not contentless) table so a note can be re-indexed with `DELETE FROM note_fts WHERE note_id=?` followed by an insert; the contentless form silently kept stale terms (reproduced during review). Body text is stored twice; at today's 760 notes that is about 4 MB.

Finding fields are attrs: `state`, `gate`, `gate_rank`, `valid_from`, `valid_to`, `metric:<name>` with value `<number>|<unit>|<higher|lower>|<baseline or empty>`. Experiment fields `method`, `objective`, `trials` are attrs of the same names. Templates are notes of kind `template` whose attrs enumerate `facet`, `method`, `gate:<rank>`, `env_axis`, `subject_axis`. Adding a domain is inserts only. `PRAGMA journal_mode=WAL; busy_timeout=3000; foreign_keys=ON`.

### 4.3 Storage: the bank repository (truth)

- `templates/<domain>.yaml`: `domain`, `facets: [..]`, `methods: [..]`, `gates: [..]` (ordered), `environment: <label>`, `subject: <label>`, `seed_concepts: [{name, aliases}]`.
- `notes/<kind>/<id>.md`:
  ```
  ---
  attrs:
    gate: out-of-sample
    gate_rank: 1
    metric:sharpe: 1.4|ratio|higher|0.9
    state: reproduced
    valid_from: 2026-09-01
  created_at: 2026-09-01T14:02:11Z
  device_id: macbook-pro
  domain: trading
  id: f_01jcx9h2k7m4q8r3t6v9w2y5z8
  kind: finding
  project: es-meanrev
  rels:
    - { type: about, dst: a_es_2sigma, props: { facet_key: risk } }
    - { type: about, dst: c_risksize00000000000000000 }
    - { type: backed_by, dst: e_3f9a1c2b4d5e6f70 }
    - { type: discovered_in, dst: x_01jcx9g0000000000000000000 }
    - { type: validated_in, dst: t_01jcx9f0000000000000000000, props: { gate: out-of-sample } }
  title: Fixed-fractional 0.5% beat fixed 1-lot on ES mean reversion
  updated_at: 2026-09-01T14:02:11Z
  ---
  ## Claim
  …
  ## Why it matters
  ## Applies when / does not establish
  ## Evidence
  ```
- Frontmatter keys sorted, rels sorted by `(type, dst)`, LF line endings: export is a pure function of the rows, so an unchanged note re-exports byte-identically and git sees no change.
- Relations reference ids, never titles, so renames never rot links.
- Ids: one-letter kind prefix + `_` + 26 chars. User-created notes: lowercase ULID (time-sortable). Domains, templates and **concepts**: deterministic slug padded to 26 (`c_` + normalized name) so two machines tagging the same concept offline produce one file. Evidence: `e_<sha256 first 16 hex>`. Relation ids: `l_` + 26 chars of `sha256(src|type|dst|props)`.
- Concept aliases are stored as attr `alias` on the concept note so they sync; the `alias` table is rebuilt from them on import.
- Filenames are the id; all lowercase ASCII; total path < 200 chars.
- Import = parse every file, upsert rows, re-index FTS; export = write the file from rows. Round trip is byte-stable.

### 4.4 Sync

- **No tool call touches git.** `kb_write`, `kb_link` and the importers write SQL and export the note file, nothing more.
- **One `sync()`**, under a directory lock (`.kb-sync.lock`, stale after 10 minutes): `git add -A`; `git commit -q -m "kb <deviceId> <iso>"` (nothing to commit is fine); if the repo has no remote → stop with `no-remote`; `git pull --rebase -q`; on failure `git rebase --abort`, log `rebase conflict`, return `failed` and leave the local commit intact; `git push -q`; re-import files the pull changed. Every git call is `spawnSync` with a 60-second timeout. Result and time are written to `config.json` (`lastSyncAt`) and `meta`.
- Runs from the SessionStart async hook (every source) and from the main agent's Stop hook when the last sync is older than 60 seconds, plus `kb sync` by hand. Per-write detached commits were reproduced losing commits under a one-second race (`index.lock`), so they are gone, and with them the custom merge driver.
- Conflicts: one file per note and deterministic ids make same-file edits rare; when a rebase does conflict, `kb doctor` shows `last sync: failed (rebase conflict)` and the fix is a normal git resolution in the bank.
- Second machine: `kb init --clone <url>` clones and rebuilds. Remote: `git@<mini-tailscale-name>:bank.git` (bare repo; macOS Remote Login; keys in the agent on Windows). An interim private GitHub remote is one `git remote set-url` away.
- `kb.sqlite`, `blobs/`, `map.html` are never in git and never in iCloud/OneDrive.

### 4.5 Tools (one stdio MCP server) and CLI

> v1.4: registration is automatic. SessionStart(startup|clear) in a folder under `$HOME` with no `.kb.json` here or above, that is a git root, has a manifest, or is a fresh folder (≤ 8 entries), writes `.kb.json` with `project_id` = folder name and a domain inferred from local signals (`auto: {registered, confidence, reason}` records the guess); the brief announces it. The folder name is a hint (lexicon per domain). While the file carries an automatic low or medium confidence, UserPromptSubmit runs the same lexicon over the prompt and, on clear evidence (three hits, two clear of the runner-up), rewrites the domain before building that prompt's brief and says so in one line; a right guess is confirmed to medium; a hand-set domain (no `auto`, or confidence high) is never touched. Home, the workspace roots (`~/projects`, Desktop, Documents, Downloads, …), hidden folders and folders holding two or more repositories are never registered. `kb project init` remains for corrections and for ids that differ from the folder name.
>
> v1.5: the domains are the bank's templates, and a new kind of project gets a new one. Each `templates/<domain>.yaml` carries `keywords` (installed as `keyword` attrs on the template note, normalised to single lowercase tokens; a YAML scalar works); `loadLexicon(db)` builds the folder-name and first-prompt word lists from them, with the built-in list as the fallback for a template without keywords or a bank with no templates. `kb sync` installs the bank's templates on every re-index, so a domain created on one machine is a domain on the next after a pull. A domain a prompt settled or confirmed (confidence medium) is final: only a low guess moves (live, 2026-10-20: an iPhone game settled to ios on its first prompt and a later prompt about agents, api, hook and memory flipped it to tooling; corrections are `project init` or `domain new`). A folder registered at low confidence gets one **decision line** on the first prompt of at least 12 words that did not settle it, once per folder (`auto.decided` in `.kb.json`, so a folder that really is tooling is never asked again in a later session): ordinary software stays tooling; a known domain is set with `project init`; only a plainly new kind of work is proposed to the user, and on a yes the session runs `kb domain new <name> --facets … --gates … --keywords … --environment … --subject …`, which refuses a bank that is not a git repository, a name that already exists or whose padded 26-character note id collides with an installed domain (`gen-l10` would overwrite `gen-l1`), writes the yaml, installs it (removing the yaml if the install fails), and files the folder under it as a hand-set choice (confidence high). Keyword scores do not gate the line: the review of 2026-10-20 measured that 7 of 12 ordinary first prompts score zero on every domain, and one generic word in a genuinely new prompt would otherwise block it. Recall is domain-first: a concept named in a prompt recalls the findings about it in the asking project's own domain, and every domain only when its own has none ("testing" had 46 findings across four domains; an iPhone session was shown Solana and poker ones, five per prompt, and cited none — unrelated recall degrades the model's output, so it is a defect, not noise). A path in a prompt names folders, not projects, and only projects with findings can be named. The prompt hook ignores user turns the harness injects (background-task notices, slash-command records, local command output, system reminders): Claude Code fires UserPromptSubmit for them, and on 2026-10-20 a Workflow completion notice settled a trading folder to tooling and such notices had been briefing on words inside tool results. `kb project init` drops the automatic guess record, so a hand-set domain is final. Every command a brief tells the session to run (`project init`, `write`, `concepts accept|reject`, `transfer`, `domain new`) is spelled as `node <plugin>/dist/kb.js …` (`paths.kbCli()`): there is no `kb` on PATH unless the user adds the README alias, and a session's shell has no aliases.

| Tool | Input | Output |
|---|---|---|
| `recall` | `{id, offset?, limit?}` | exact blob page |
| `kb_find` | `{text?, kind?, project?, domain?, concept?, limit?}` — plain full-text search (each word quoted, so punctuation never throws) plus filters | `[{id, kind, title, snippet}]` |
| `kb_write` | `{kind, id?, title, body?, domain?, project?, attrs?, rels?, tags?, facets?, metrics?: [{name, value, unit?, better, baseline?}], method?, objective?, trials?, evidence?: [{kind, ref, sha256?}]}` | `{id, created, concepts:[{tag, conceptId, how}], transfers:[id], questions:n}` |
| `kb_link` | `{src, type, dst, props?}` | `{rel_id}` |
| `kb_brief` | `{project?, limit?}` | the ranked brief text + items |
| `kb_compare` | `{concept}` | comparison rows (§4.9) |

CLI `kb` (same bundle): `init [--bank <dir>] [--clone <url>]`, `project init --domain <d> [--id <id>]`, `project move --domain <d> [--id <project>]`, `setup [--device <name>]`, `doctor [--baseline] [--live]`, `cleanup [--apply]`, `import serena|claude-memory|all [--root <dir>]`, `export`, `sync`, `rebuild`, `map [--open]`, `concepts review|accept <id>|reject <id>|split <name>|merge <a> <b>` (merge, 2026-10-24: a becomes an alias of b outside the question queue, for the merges the review proposed the wrong way round), `transfer <id> confirm|refute`, `transfers prune [--apply]`, `retract <id>`, `set <id> <attr> <value>`, `compare <concept>`, `write <spec.json|->`, `domain new <name> …`, `build manifest [--project <id>] [--repo <dir>] [--shard <n>] [--out <file>]`, `build brief [--project <id>] [--role extractor|reviewer]`, `build validate <spec.json> [--keys <keys.json>] [--fix] [--out <file>] [--project <id>]` (§4.13).

`kb project move --domain <d> [--id <project>]` (2026-10-24) moves a whole project into another domain: `project init --domain` rewrote only `.kb.json` and every note the project already had kept `domain: trading`, so `move` refuses a domain that is not installed (naming `kb domain new`), rewrites the `.kb.json` here or above as a hand-set choice (`auto` dropped, every other key kept) when it names the project, sets `domain` on every live note with that project whatever its kind, touches `updated_at` and re-exports each so `kb sync` ships them, prints the counts per kind, and changes nothing on a second run.

A repo takes part only if it contains a `.kb.json` with `project_id` and `domain` (`kb project init` writes it; commit it). Nothing derives a project id from a git remote or a directory name: the demo repos have no remotes and exist under several directory names.

### 4.6 Ranking (a sort, weights in `rank_weights`)

For a candidate finding F against the asking project P (declared in `.kb.json`: `project_id, domain, facets, target:{environment, subject}, relies_on[]`):
`+3` per facet value identical, `+1` per shared facet key with a different value, `+2` environment match, `+2` subject match (both compared after `normalizeName`), `+gate_rank`, `+1` if `valid_from` within 90 days decaying linearly to 0 at 365, `+2` per confirmed transfer of findings about the same concept, `−2` per refuted, `−3` if `conflicts_with` non-empty, `×0.5` if past `valid_to` (demoted, hatched on the map; never hidden), dropped if superseded or deleted. Ties by `updated_at` desc.

### 4.7 Concept grouping (no model)

`normalizeName(name)`: lowercase → split on space/`-`/`_`/camelCase → strip punctuation → drop stopwords → Porter-stem each token (the standard algorithm, embedded; no simpler rule set) → sort → join with `-`. `conceptNoteId(name)` is derived from it, so ids are deterministic across machines.
On every tag, in this order: `normalizeName(tag)` equals a concept's normalized title → attach silently (`exact`); alias table hit → attach silently (`alias`); else Dice overlap of stemmed token sets against all titles and aliases: `≥ 0.8` with exactly one candidate and ≥ 2 shared tokens → auto-alias (alias written as attr on the concept note and exported; log line in `concept-merges.md` with `kb concepts split <name>` as the undo); `0.5–0.8` or a tie → new concept plus a `pending_merge` row; `< 0.5` → new concept. Questions surface only at SessionStart (max 3 lines) or via `kb concepts review`. Seed concepts with aliases from `templates/*.yaml` at `kb init`. (A co-occurrence merge signal is deferred, §10.)

### 4.8 Transfers

> v1.4 (after the 2026-10-17 bulk import): a proposal's facet candidates come only from the facet the finding is explicitly `about` (the `about` rel's `facet_key`), not from every facet key of its approach; concept-sharing candidates come first; at most 12 proposals per finding. The old rule proposed ~80 transfers per finding once the bank held 180 approaches.
>
> v1.7 (2026-10-24, after the Windows knowledge build): a candidate must share a concept with the finding; a shared facet key admits nobody and only breaks ties. Candidates are ranked by shared concepts, then by how rare the shared concepts are (fewest approaches touching, compared one by one), then by carrying the facet key the finding is `about`, then by id, and cut at **four**; a run of candidates the index cannot tell apart that straddles the cut is dropped whole, so no proposal rests on creation order. Measured before the change on 829 live findings: 6,789 proposed transfers (500 findings at the cap of 12, mean 8.2), 2,492 of them (36.7%) resting on a facet key alone, one confirmed and none refuted or provisional; 511 findings had more than four concept candidates and 509 of those tied at the boundary under shared-count order, so "ties by id" would have sent 609 of 2,263 picks to the three oldest-imported projects; only 164 of 8,881 (finding, candidate) pairs shared two concepts, never more than five such candidates on one finding, which is why four slots suffice. The index records no `relies_on` relation (`.kb.json` `relies_on` is read by ranking, §4.6, never stored), so an approach is a candidate through its own concept tags. `kb transfers prune [--apply]` withdraws (soft-deletes and re-exports) the `proposed` transfers an earlier rule made that this one would not; settled transfers are never touched, and nothing is re-proposed.

`kb_write` of a finding about concepts C₁…Cₙ creates a `transfer{state: proposed}` relation toward the best-ranked approaches in other projects that `relies_on` or are `about` one of them (v1.7 above). A later finding in the target project about C changes the state **only by a mechanical rule**: when both findings carry the same metric name with a baseline, compare `sign((value − baseline) · dir)` where `dir` is −1 for lower-is-better; equal and non-zero → `confirmed_provisional`; opposite → both findings get `conflicts_with` and attr `state=conflicting`; any missing baseline or metric → nothing changes. `kb transfer <id> confirm|refute` sets the final state and is the only path to it. Transfer verdicts feed ranking (§4.6).

### 4.9 Comparison (`kb_compare`)

One row per finding `about` the concept: the facet value of the approach it is about (via the `about` relation's `facet_key`), gate and gate rank, first metric with value, unit and direction, target, `valid_from`, state, project. Sorted by gate rank, then metric value in the better direction (lower-is-better flips the sign), so a −4% max drawdown ranks above −1%. The startup brief includes the block when the project declares a facet key with two or more competing findings. The experiments leaderboard (method × objective × baseline × trials × wins) is deferred until experiments are actually recorded (§10); `method`, `objective` and `trials` are already accepted as attrs so nothing is lost.

- `kb write <spec.json|->` (v1.4): bulk notes from a JSON file `{defaults: {domain, project}, records: [{key?, …WriteRecord}]}`; a rel `dst` of `@key` points at a record written earlier in the file. Used for the 2026-10-17 import of every project under `~/projects`.

### 4.10 Importers

- Serena: `<root>/**/.serena/memories/**/*.md` for the given roots and `~/.serena/memories/global/**/*.md` → evidence notes (`e_<sha>`), body = exact text, attrs `origin: serena`, `source_path`, `sha256`, `memory_name`; project = the repo's `.kb.json` `project_id` if present, else the enclosing git repository's directory name (a linked worktree's `.git` is a file and is passed over; the home directory is no project, nor is a folder under one of its hidden directories such as `~/.t3/scratch/<chat>`), else the directory name. Memory directories are taken shallowest first, so a repository's own memories come before the copies inside it (git worktrees under `.claude/worktrees`, archived trees, snapshots): an identical copy is skipped by its hash and a copy-only revision is filed under the repository, never under the copy's folder (2026-10-24, a repo with 80 worktrees and 1,800 archived copies of 68 memory files). No byte copies are made (the evidence note holds the text), no edges are inferred from `mem:` references (deferred). Originals are never modified. Idempotent.
- Claude Code auto-memory: `~/.claude/projects/<dashed-cwd>/memory/*.md` (skip `MEMORY.md`); project from the `cwd` field of the first transcript line in that project directory, then its `.kb.json`, then the directory name; frontmatter `metadata.type` → attr `origin_type`; same evidence kind.
- Codex: `~/.codex/memories/rollout_summaries/*.md` (one per Codex thread; header lines `thread_id:` and `cwd:`, the `# ` heading is the title), `extensions/ad_hoc/notes/*.md` (a "Project: `<dir>`" line names the project) and `memory_summary.md` (user profile, no project) → evidence notes with attrs `origin: codex`, `memory_name`, `thread_id`, `cwd`. Project from the cwd by the rules above; a cwd under `~/Documents/Codex` is Codex's scratch workspace and has no project. `MEMORY.md`, `raw_memories.md` and `phase2_workspace_diff.md` are derived from the summaries and skipped; `skills/` are not memories.
- Attribution (2026-10-24): a workspace root directly under the home (`~/projects`, Desktop, Documents, Downloads, src, code, work, github — the list auto-register refuses) is no project either, like the home (48 memories whose cwd or `.serena` folder was `~/projects` had been filed under a project named `projects`, the Mac's `/Users/loser/projects` likewise), and a re-import re-attributes: an existing evidence note whose computed project differs, or whose computed domain is set and differs, has `project`/`domain` updated and is re-exported, counted as `moved` in the result line (`serena: N files, c created, u unchanged, m moved`), while a null computed domain never undoes one set by `kb project move`, a retracted note stays as it is, and a note two folders hold stays with the first in walk order.
- Nothing is promoted to a finding automatically; a finding is written by the working agent via `kb_write` or by Gage via the skill.

### 4.11 The map

`kb map` writes `~/.optimus/map.html`: self-contained, **no external script or stylesheet**, inline JSON, one lane per domain with the columns Theme → Approach → Experiment → Target (rows by insertion order; `graphData` still exposes the fixed grid at x = column × 220, y = row × 28 for tests and tooling). Since v1.3 the page follows the editorial-diagram system of cathrynlavery/diagram-design, dark only: hairline borders, no shadows, a 4 px grid, one accent colour reserved for the focal element (the selection and its traces), a serif title, sans part names and mono only for technical labels. The lanes are HTML (CSS grid, so they reflow from a phone to a wide monitor: the stages in use side by side on a desktop, one stacked column under 720 px) and the relations are an SVG overlay whose paths the inline script routes from the measured positions of the parts: orthogonal with rounded elbows, one attach point per connector along a shared edge, parallel routes offset by 12 px as far as the corridor allows, traces to the concept rail (which sits to the left of the lanes) as a bus in the gutter, same-column relations as a bracket. Parts sit above the traces at rest; while something is lit the highlighted traces float above the dimmed parts. What is not in use is off by default: stages nobody has used are left out, a domain with nothing in it starts unchecked, the legend lists only the states and relation types present, a part shows two findings and folds the rest behind a `+N more` row, and above 60 relations the traces wait for a hover or a selection (a filter switch shows them all). The filters drawer and the inspector both collapse. Motion is one reveal on load (lanes settle, solid traces draw themselves, patterned ones fade, LEDs light) and then only answers an action; all of it is off under `prefers-reduced-motion`. The board is a whiteboard canvas (v1.4): scroll pans, pinch or Cmd/Ctrl+scroll zooms at the cursor, drag on empty space or Space+drag pans, Shift+1 fits everything, Shift+2 fits the selection, Shift+0 is 100 %, and selecting something fits it with its neighbours on screen (pan-and-zoom rather than a fisheye: the studies favour it). Semantic zoom: below 80 % a part shows its name and a row of LEDs, below 50 % names grow so they stay readable. The default is terse at every zoom: finding text appears only on the part you drill into, or everywhere with the Detail switch. The inline script does only that: filters, search, trace routing, highlight, fold/unfold, pan/zoom/fit and the inspector. Finding badges attach to their `about` node, colored by state (green reproduced, blue observed, amber unverified, red conflicting, hatched past `valid_to` or superseded); concept hubs in a rail to the left of the lanes (below them on narrow screens), bold when touched from ≥ 2 lanes, hollow when a pending merge exists; edge styles about solid, discovered_in dotted, transfer dashed (proposed) / solid green (confirmed) / red cross (refuted), validated_in labeled with the gate, supersedes faded; filters by domain, environment, subject, state, gate ≥, valid today, has evidence, show proposed transfers. Read-only; the side panel shows the id, attrs, evidence refs and the exact commands to paste: `kb transfer <id> confirm|refute`, `kb concepts accept <id>`, `kb retract <id>`, `kb set <id> valid_to <date>`. Light and dark tokens.

Imported memories (evidence notes with `origin` serena, claude-memory or codex) are listed per project under their domain's lane, folded, with counts by origin and a searchable excerpt; a memory without a domain sits in the `(no domain)` lane. They are not parts: no traces, no badges.

### 4.12 Templates shipped

`templates/trading.yaml`, `templates/gen-l1.yaml`, `templates/ios.yaml` as in the deep dive (facets, methods, gates, axes, 4–5 seed concepts each incl. `risk sizing`, `autocorrelation`, `transaction cost model`, `heap ceiling`, `per-activation work budget`, `block quantisation`, `state layout break`, `idempotency`, `swiftui state ownership`).

### 4.13 The build (`kb build`)

A knowledge build turns a project's imported memories (§4.10) and repository documents into approaches, targets and findings. It is a session procedure, not a command: agents read, judge and write; the plugin prepares and checks (HANDOFF, "How to run a build"). Nothing in `kb build` reads a memory for its meaning or writes to the bank.

- `kb build manifest` lists, for one project, its evidence notes with origin `serena`, `claude-memory` or `codex` from every device (id, title, origin, device, bytes, `source_path`, `bank_file`: the note file, for a memory whose original is on another machine) and the repository's documents (Markdown, text, TOML and JSON files of 100 B to 400 KB, two directory levels deep, never `node_modules`, `.git`, `.claude`, `.serena`, hidden or `backup*` folders, `out`, `logs`, `cache`, `data`, lockfiles; READMEs, playbooks, briefs and design notes first; at most 40), in shards of at most 36 memories (`--shard <n>`), the documents on shard 1 only. Each shard carries the project's `domain` and the `vocabulary` its extractor may use: the template's facets, gates (weakest first), methods, axes and the finding states. JSON to stdout or `--out`.
- `kb build brief --role extractor|reviewer` prints one agent's instructions in the words of the project's own domain template: what to record, the vocabulary, the spec format `kb write` reads (§4.5) with the template's facet keys filled in, the rules the validator enforces, how shards and `@key`s combine. A set of synthetic worked examples (an invented strategy, instrument and numbers in the shape the real builds recorded; the owner's records stay in the private bank, since the plugin is public) illustrates trading only; every other domain shows its facet names. The reviewer's brief is the procedure of 2026-10-24: merge the shards in order, refute what the cited source does not carry (the quote and the number), deduplicate (one finding per claim, strongest gate, every evidence path), enrich the repo's `.kb.json` (`facets`, `target`, `relies_on`), validate, `kb write`, `kb sync`.
- `kb build validate <spec.json>` refuses any record the template, the finding rules or the cited sources do not support: kinds approach, target, finding, theme, experiment; titles of 12–220 characters; keys defined once; approach facets only from the template, a target's exactly `environment` and `subject`, none on a finding; experiment methods from the template; rels to a note id or an `@key` defined earlier in the file or passed with `--keys` (an earlier shard's spec, a JSON array or a comma list), `about.facet_key` and `validated_in.gate` from the template, no transfers; a finding's `state` in unverified|observed|reproduced|conflicting, `gate` from the template, `valid_from` YYYY-MM-DD, a title that carries a number and is not narration, advice or a question, 1–5 tags, metrics with a snake_case name, a numeric value and better higher|lower, at least one evidence entry (path, commit or url) with every path present on this machine, the four body headings and at least one `> quote` line found verbatim (whitespace, bold and curly quotes normalised, a trailing ellipsis allowed) in a cited path. Exit 1 with one line per failure (`#index kind "title": reason`); `--fix` drops the failing findings, strips rels to their keys, keeps approaches and targets (failing or not, as `kb write` reports those itself) and writes the spec back in place or to `--out`, exiting 0 when what remains passes.
- The project is the `.kb.json` found walking up from the folder (eight levels, like every other command); `--project` names another, `--repo` another folder; the domain is that file's, else the one the project's notes in the index carry. The vocabulary always comes from the template in the index, so a domain created with `kb domain new` builds like a shipped one.

## 5. Plugin packaging and install

- One private git repo `optimus` is both marketplace and plugin: `.claude-plugin/marketplace.json` lists `plugins/optimus` (relative source), so it loads **in place**: `git pull` + `/reload-plugins` is the update. `claude plugin validate <repo>` runs before every install. Added once per machine with `/plugin marketplace add <local clone path>` then `/plugin install optimus@optimus`.
- `plugins/optimus/.claude-plugin/plugin.json`, `hooks/hooks.json` (exec form: `node --disable-warning=ExperimentalWarning ${CLAUDE_PLUGIN_ROOT}/dist/hook.js <event>`), `.mcp.json` (same flag, `dist/mcp.js`), `skills/kb/SKILL.md`, `dist/` committed (esbuild ESM bundles with a `createRequire` banner so CommonJS dependencies load; no runtime `node_modules`), `THIRD_PARTY_NOTICES.md`.
- Windows: exec-form only; `path.normalize` on every path; `.gitattributes` LF; bank and state outside iCloud/OneDrive; Node ≥ 24.4; same drive-letter spelling when launching Claude.

## 6. Machine cleanup (`kb cleanup`)

Reports, and with `--apply` performs (each edited file backed up as `<file>.bak-<timestamp>`):
- Disable and uninstall `agentmemory@agentmemory` (12 hooks to a dead `localhost:3111`); remove its MCP entry from `~/.claude.json`; remove `~/.agentmemory` (after copying its single 143 KB backup into `~/.optimus/imports/`).
- Uninstall `claude-supermemory@supermemory-plugins` (already disabled).
- Retire `context-mode@context-mode` once phase 1's offload passes its acceptance test (its PreToolUse Agent rewrite collides with subagent briefs; its sandbox routing is replaced by transparent offload). Until then it stays and our plugin registers no PreToolUse hook.
- Remove the Serena MCP registration after `kb import serena` has run (originals untouched). List the SuperClaude commands that only write to Serena memory (`/sc:save`, `/sc:load`) as removable: the plugin's SessionStart and Stop hooks do that work automatically.
- Flag MCP entries whose command is not on PATH or whose absolute-path arguments do not exist (e.g. `morphllm-fast-apply` pointing at `/home/`), and list MCP servers and plugins with no tool calls in the last 30 days of transcripts, for Gage to confirm.
- Leave RTK, superpowers, codex, vercel, ponytail, i-have-adhd, watch, gen-skills untouched.
- The Obsidian "Engineering" vault is not used by the plugin; it is left in place (Gage: delete or reuse at will).

## 7. Doctor (`kb doctor`)

Prints one line per check with pass/warn/fail/info: Node version (info; ≥ 24.15 recommended); `node:sqlite` creates an FTS5 table (fail if not); git present; bank repo present, clean/dirty, ahead/behind, remote reachable (`git ls-remote`, 10-second timeout), last sync result and time; `kb.sqlite` size and row counts per kind; blobs size and oldest; pending merges; `.kb.json` in the current directory valid (warn if missing `project_id` or `domain`); hooks registered by this plugin (reads the active settings and plugin cache); competing hooks (any other plugin with a PreToolUse `Agent` matcher, SubagentStart, or SessionStart injecting > 5,000 chars); `autoCompactWindow` value; `--baseline` metrics (§3.10); `--live` runs the marker test (spawns `claude -p` headless with a temporary project settings file) to prove PostToolUse replacement, SubagentStart injection and the 10K cap on this machine.

## 8. Acceptance (what "done" means)

Phase 1: a real session's median context drops below 200K; a forced `/compact` produces `task-state.json`, `audit.json`, and a restore brief with zero unresolved omissions; a new session opened in a project after another one ended there shows the last-session section with no command; `recall` returns a sha256-identical copy of the tool result as it was delivered to the hook; cache-read share with offload on is within 5 points of off; `kb doctor --live` passes on this Mac; nothing in `~/.claude/settings.json` changed except `autoCompactWindow` and the cleanup disables Gage approved.
Phase 2: the risk-sizing finding written in the options repo surfaces in the futures repo's SessionStart brief in a second clone as a proposed transfer with its evidence pointer; `kb transfer confirm` turns the map edge solid; the genibook heap-ceiling finding reaches `gen-clob-explainer` the same way; `kb compare risk-sizing` prints the comparison table; the 213 Serena and 547 auto-memory files are present as evidence and searchable; `git log` on the bare remote shows both clones' commits; `kb doctor` is clean on both.
Phase 3: all of phase 1 and 2 pass on the Windows PC.

## 9. Risks and mitigations

| Risk | Mitigation |
|---|---|
| Interactive mode differs from headless tests | `kb doctor --live` plus a documented 5-minute interactive check before relying on any route |
| Unknown `tool_response` shapes | Offload only replaces when it finds one dominant string field (≥ 2× the next); otherwise leaves the result untouched; fixtures for Bash and an MCP block list |
| Compactor ignores CLAUDE.md instructions | Restore brief carries the KEEP checklist regardless |
| False concept merges | Auto-merge only at ≥ 0.8 with ≥ 2 shared stemmed tokens and a single candidate; every merge logged with an undo |
| Git conflicts on the same note | One file per note, deterministic ids; `sync` aborts the rebase, keeps the local commit, logs, and doctor warns; resolution is ordinary git |
| Concurrent git from hooks | Single locked `sync()`; no git from tool calls |
| Subagent hooks sharing state with the main agent | All state keyed by agent id; snapshot/audit/restore main-only |
| Windows exec-form regressions | Pin Claude Code ≥ 2.1.299; `kb doctor --live` on the PC on day one |
| Blob store growth | 14-day TTL and 500 MB cap with GC in the SessionStart async hook; doctor prints sizes |

## 10. Deferred (explicitly)

Proxy-based server-side context editing; history folding; background LLM summarizer; `autoMemoryDirectory` redirection; a hub HTTP service on the mini; embeddings; one-way export into Trilium or an Obsidian canvas; mobile viewer; recent-zone offload protection; raising `bashOutputMaxChars`; experiments leaderboard (method × objective × baseline × trials × wins); co-occurrence merge proposals; `mem:` and sibling-link edges from imported memories; last-writer-wins merge driver; Trilium-style query grammar; per-agent recall flood guard; report notes written by the Stop hook.

## 11. Provenance of lifted code (see `THIRD_PARTY_NOTICES.md`)

| From | What | License | Mode |
|---|---|---|---|
| billion-context | `kernel/src/compression-rules.ts` retention doctrine text (~137 lines), from a pinned commit | MIT + attribution rider | **copied** with header; README attribution line |
| claude-mem | budget fitter, redaction, transcript tail reader, dedup | Apache-2.0 | **re-expressed from behaviour; no text copied** (the review found no clone on the machine and the helpers are under 60 lines each) |
| context-mode | exec-form hook wrapper, stdin idle read, `updatedToolOutput` offload pattern | Elastic-2.0 | **re-implemented; no text copied**; its flood guard was dropped (unfulfillable per agent) |
| Serena | memory path convention, name scorer, atomic write, hook-state pattern | GPL-3.0 (app) | **re-implemented from behaviour; no text copied** |
| Trilium | data-model shape; note-map edge rules | AGPL-3.0 | **re-implemented**; its search grammar is no longer used |
| Others | inject-don't-recall, bi-temporal fields, write-time reconciliation, three-factor ranking, anchored task-state shape, omission audit | papers / Apache / MIT | ideas only |

## 12. Decisions taken (16 Oct 2026, Gage; review amendments noted)

Hooks-only, native compaction kept (ADR-0001/0002) · Trilium rejected for SQLite + Markdown export + git (ADR-0003) · working set 200K · no summarizer · Serena dropped after import · read-only map with pasteable commands · synonym questions at session start ≤ 3 lines plus review command · transfer verdicts automatic-provisional **only by the mechanical same-metric-with-baseline rule, otherwise manual via `kb transfer`** (review: the free-form version could not be mechanized) · Concept is the cross-domain carrier · method and objective are two fields · validation on the environment × subject pair with partial credit · findings age by expiry and supersession, demoted not hidden · Mac mini is always awake and on Tailscale · Obsidian vault unused (left alone) · disable/delete unused plugins and MCPs via `kb cleanup` before first start · (review) Node floor 24.4 with the warning flag · (review) one locked sync, no per-write git · (review) `project_id` declared in `.kb.json`, never derived · (review) `Read` never offloaded, threshold 20,000, head-and-tail placeholder.
