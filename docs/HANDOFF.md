# Handoff — monitoring Optimus in live sessions (updated 2026-10-24)

Read this first in a session whose job is to watch Optimus run in other sessions, judge it from files rather than impressions, and fix what the live tests expose. This file is the carrier between machines: Claude Code's own memory directory is per machine, so everything a monitoring session needs is written here. Private details of the owner's projects are kept out on purpose; the owner's own notes hold them.

The plugin was called `project-memory` until 2026-10-20; the rename touched every identifier (`~/.optimus`, `OPTIMUS_HOME`, `OPTIMUS_BANK`, `OPTIMUS_DEVICE`, plugin id `optimus@optimus`, MCP server `optimus`).

## State at handoff

- `GageBachik/optimus`, branch `main`, 133 tests green (`npm test` in `plugins/optimus` rebuilds `dist/` and runs them). Built bundles are committed in `plugins/optimus/dist/`.
- On the owner's Mac the plugin runs **in place** from the clone (directory marketplace), so `git pull` + `npm test` is the whole upgrade. An open session keeps the hook registration it started with: after a change to `hooks/hooks.json` it needs `/reload-plugins` or a restart. A change to `dist/` alone is picked up by the next hook run. A GitHub install runs from Claude Code's plugin cache and is upgraded with `claude plugin update optimus@optimus`.
- v1.6 is live: the session records its own findings. The project card tells it to `kb_write` as it goes; the Stop hook asks once per turn, with the turn's measured statements as candidates, when the turn stated measurements and recorded nothing. No person runs `kb write`. The draft files under `~/.optimus/projects/<project>/draft-findings.json` are a log.
- State: `~/.optimus/` — `sessions/<id>/main/{state,task-state,audit}.json`, `projects/<key>/{last-session,draft-findings}.json`, `blobs/`, `logs/hooks.log`, `metrics.jsonl` (one line per turn end; `cache_read` is the context size at that turn), `kb.sqlite` (the rebuildable index).
- Bank: `~/knowledge-bank` (git). Templates in `templates/*.yaml` are the domains, each with `keywords`. `kb rebuild` recreates the index from the Markdown. On 2026-10-24 it held about 505 findings in 5 domains and **had no git remote**, so `kb sync` commits locally and stops.
- `kb` in the owner's shell is a function over `node <plugin>/dist/kb.js`; every command a brief tells a session to run is spelled with that full path, because a session's shell has no aliases.

## Setting up a second machine to monitor from

1. The bank must have a private remote before the second machine can know anything. On the first machine: `cd ~/knowledge-bank && git remote add origin <private remote> && git push -u origin main`. `kb doctor` prints `bank-remote  no remote configured` until this is done.
2. On the new machine: install Claude Code and Node 24.4 or later, then follow README → Install (from GitHub) or README → Develop (in place from a clone, which is what a monitoring session wants, since it may change the plugin). Then `kb setup`, `kb init --clone <private remote>`, `kb doctor`, and restart Claude Code.
3. Where things are on the new machine: state in the home directory's `.optimus` folder (on Windows `%USERPROFILE%\.optimus`); Claude Code's transcripts in the home directory's `.claude/projects/<slug>/<session>.jsonl`, where the slug is the working directory with its separators replaced by `-`; the plugin folder from `claude plugin list --json` (`readFromFolder` when installed in place, else `installPath`).
4. Hooks are registered as the `node` program with an argument list, no shell, so they run the same on Windows and Linux; `kb sync` is spawned with the running Node binary. The README gives the `kb` function for zsh, bash and PowerShell. Every command a brief tells a session to run quotes the plugin path and uses forward slashes, because Claude Code's Bash tool on Windows is Git Bash, which strips unquoted backslashes (audit of 2026-10-24). The state watcher below needs only the tools Git for Windows ships; the log watcher is node.
5. Then read "How to watch a session" below and re-arm the watchers.

## What the live tests established (2026-10-19 to 2026-10-24)

Seven real sessions (four fresh folders: a trading research session, two iOS builds, a short reuse test; three existing folders with new questions: an investment-strategy notebook, a trading bot, a web app), one isolated headless session for the Stop hook, and the fixes they forced.

Fresh folders tested registration, domain settling and recording:

- Registration from the folder, settled by the first prompt, works; a settled or hand-set domain never moves again (one iOS folder flipped to tooling on a later prompt before this); harness-injected user turns (background-task notices, slash-command records, system reminders, anything opening with `<` or `[`) are not prompts.
- A new kind of project gets its own domain: `kb domain new`, keywords on every template, one decision line per folder.
- Compaction: snapshot, audit and restore ran on every compaction, including Claude Code's idle compaction of a parked session. Claude Code's own summary kept between 3 and 22 of the tracked items each time; the restore brief put the rest back.
- Agents spawned by a session record what they measure through `kb_write` on their own (dozens of findings per long session).
- The claim filter was wrong in both directions (narration with numbers kept; a mid-sentence "I", a signed decimal, "5 times" dropped) and was fixed in rounds, each pinned by a test. Recorded drafts came back as pending until the draft file became a ledger. Table rows carry their header.
- Recall is domain-first and injects nothing when nothing related exists; a generic concept with findings in many domains was the reason an earlier session was shown 31 findings and cited none. A path in a prompt is not a project mention. A guessed domain brings no findings until it settles. A bare project (no facets) is ranked newest-first, duplicates once, own and other projects' findings interleaved; a two-word phrase of the prompt recalls a finding by title even without tags.
- Reuse test 1: a new folder's first prompt asked for a validation method that a finding in the bank had shown to be misleading; the session got the finding in its first brief, explained why the trap did and did not apply, and ran the right controls. Pass.

Existing folders tested whether the bank reaches a session cleanly and whether talk gets mis-recorded:

- One outsider finding leaked into a declared project's brief through a single matching facet key; a project that declares facets gets no forced cross-project slots, and the start-up brief's comparison tables became a one-line `kb_compare` pointer.
- Dated prices, second-person advice, questions and in-flight progress reports ("still running in the background") were drafted as findings; all are narration now.
- The owner ruled that no step is ever manual: v1.6 replaced the "run kb write" line with the Stop-hook ask.
- The trading-bot session was the clearest reuse pass: it applied a sizing finding, a real-chain-versus-proxy finding, reproduced a reference number and found the bug class the brief carried.

The Stop hook, verified in an isolated session (temporary `OPTIMUS_HOME`, `OPTIMUS_BANK`, project folder; `claude -p` with bypass permissions):

- Claude Code starts the Stop hook **before the turn's final assistant message has always reached the transcript file**. The first run missed the turn's one measured sentence and asked nothing. The hook input carries `last_assistant_message`; the hook appends it when the file lacks it (2026-10-24 fix, test in `tests/hooks/lifecycle.test.ts`).
- With the fix: the hook logged `stop: asked the session to record` with one candidate, Claude Code inserted the ask as a user turn that begins `Stop hook feedback:`, the session continued, called `kb_write` with tags and a metric attribute, the finding landed in the bank, and the continued stop (`stop_hook_active: true`) asked nothing.
- The transcript's `stop_hook_summary` entry shows `preventedContinuation: false` even when the block worked. Judge by the `Stop hook feedback:` user entry and the `kb_write` that follows, not by that flag.
- A session opened before the `hooks.json` change still runs the Stop hook asynchronously: its log shows the ask, Claude Code ignores it. Restart or `/reload-plugins`.

## Open items

1. Watch v1.6 in interactive sessions: the ask should fire only when a turn stated measurements and recorded nothing, never twice, and the session's `kb_write` should follow. Only the headless run has been seen so far.
2. Reuse test 2: a second project in the same domain as a recent build session, to check that the start-up brief surfaces that session's findings and the new session applies them without rediscovering. Caveat: a finding recorded without tags is reachable only through the start-up brief (domain ranking), not through prompt recall (concept matching).
3. Concept-merge questions pile up with no one to answer them (`kb doctor` showed 39 pending; `kb concepts review` lists them). Today they wait for a person, which the owner's rule forbids. Candidate: let the session answer them from the brief, or accept exact-prefix merges automatically.
4. The bank has no remote; a second machine starts empty until the owner pushes it (see above).
5. Residual ranking leak: facet-key-only partial credit can still admit one weak outsider finding in a declared project's brief. Watch for it in start-up briefs.
6. Transfer-proposal lines in briefs ("your environment differs: …") are long and rarely used; a candidate for trimming after more evidence.
7. `.kb.json` files are untracked in many of the owner's repositories; committing or ignoring them is the owner's call.

## How to watch a session

Two background watchers, re-armed every 30 minutes (the Monitor tool caps a watch at 30 minutes):

```sh
# state watcher: new sessions, registrations, turn ends with context, compaction files, draft counts
S=~/.optimus; ME=<this session id>; touch $S/.watch-stamp; prev=$(wc -l < $S/metrics.jsonl | tr -d ' ')
while true; do
  m=$(wc -l < $S/metrics.jsonl | tr -d ' '); if [ "$m" != "$prev" ]; then last=$(tail -1 $S/metrics.jsonl); case "$last" in *"$ME"*) ;; *) echo "TURN ENDED: $(echo "$last" | cut -c1-120)";; esac; prev=$m; fi
  find $S/sessions -maxdepth 3 \( -name task-state.json -o -name audit.json \) -newer $S/.watch-stamp -not -path "*$ME*" | sed 's/^/COMPACTION STATE: /'
  find ~/projects ~ -maxdepth 2 -name .kb.json -newer $S/.watch-stamp | sed 's/^/KB.JSON WRITTEN: /'
  touch $S/.watch-stamp; sleep 2
done

# log watcher (a node filter: node is a plugin prerequisite on every machine, python is not; grep in a pipeline went deaf once on a machine that rewrites it)
tail -n0 -F ~/.optimus/logs/hooks.log | node -e 'const p=/"level":"(warn|error)"|auto-registered|domain settled|domain decision|pre-compact|post-compact|subagent drafts|asked the session to record/; require("readline").createInterface({input:process.stdin}).on("line",l=>{if(p.test(l))console.log(l.slice(0,260))})'
```

Judging a session afterwards, all from files: the transcript under `~/.claude/projects/<cwd-slug>/<session>.jsonl` holds the injected briefs (`attachment.type == hook_additional_context`), the prompts, tool calls and text; count the briefed finding ids (`[f_…]`) against the ids the assistant text cites; `metrics.jsonl` gives context per turn; `audit.json` gives present and missing per compaction; the bank findings for a project are `grep -l "^project: <id>" ~/knowledge-bank/notes/finding/*.md`; subagent transcripts that called `kb_write` are under `<session>/subagents/`. For v1.6: a `stop: asked the session to record` log line should be followed in the transcript by a user entry beginning `Stop hook feedback:` and a `kb_write` tool call; a second ask for the same statements is a defect.

An isolated end-to-end run of the Stop hook, when a change touches it: create a temporary folder with a `.kb.json` (`{"project_id":"e2e","domain":"tooling"}`), export `OPTIMUS_HOME` and `OPTIMUS_BANK` to temporary paths, `node <plugin>/dist/kb.js init --bank $OPTIMUS_BANK`, then `env -u CLAUDECODE claude -p --permission-mode bypassPermissions --output-format json "<a prompt that ends in one measured sentence>"` from that folder, and check the temporary `logs/hooks.log`, the temporary bank's `notes/finding/`, and the session transcript.

Rules that held up: measure before changing; one fix per observed failure with a test that pins it; commit only on a green suite; repair the bank by hand only to undo a plugin mistake; never commit inside the owner's other repositories; nothing unrelated is ever injected into a session.
