# Handoff — monitoring Optimus in live sessions (2026-10-20)

Read this first in a session whose job is to watch Optimus run in other sessions, judge it from files rather than impressions, and fix what the live tests expose. The plugin was called `project-memory` until 2026-10-20; the rename touched every identifier (`~/.optimus`, `OPTIMUS_HOME`, `OPTIMUS_BANK`, `OPTIMUS_DEVICE`, plugin id `optimus@optimus`, MCP server `optimus`). Private details of the owner's projects are kept out of this file on purpose; the owner's own notes hold them.

## State at handoff

- `GageBachik/optimus` on `main`, 125 tests green, built bundles committed in `plugins/optimus/dist/`. On the owner's machine the plugin runs **in place** from the clone (directory marketplace), so `git pull` + `npm test` (which rebuilds `dist/`) is the whole upgrade; an open session needs `/reload-plugins` or a restart to pick up a new bundle. A GitHub install runs from Claude Code's plugin cache instead and is upgraded with `claude plugin update optimus@optimus`.
- State: `~/.optimus/` — `sessions/<id>/main/{state,task-state,audit}.json`, `projects/<key>/{last-session,draft-findings}.json`, `blobs/`, `logs/hooks.log`, `metrics.jsonl` (one line per turn end; `cache_read` is the context size at that turn), `kb.sqlite` (the rebuildable index).
- Bank: `~/knowledge-bank` (git). Templates in `templates/*.yaml` are the domains, each with `keywords`. `kb rebuild` recreates the index from the Markdown.
- `kb` in the owner's shell is a function or alias over `node <plugin>/dist/kb.js`; every command a brief tells a session to run is spelled with that full path, because a session's shell has no aliases.

## What the live tests established

Three real sessions (a trading research session of about three hours, an iOS build session of about two and a half, and a short reuse test in a fresh folder) and the fixes they forced:

- Registration from the folder, settled by the first prompt, works; a settled or hand-set domain never moves again; harness-injected user turns (background-task notices, slash-command records, system reminders) are not prompts.
- Compaction: snapshot, audit and restore ran on every compaction, including Claude Code's idle compaction of a parked session. Claude Code's own summary kept between 3 and 22 of the tracked items each time; the restore brief put the rest back.
- Agents spawned by a session record what they measure through `kb_write` on their own (dozens of findings per long session).
- Recall is domain-first and injects nothing when nothing related exists; a generic concept with findings in many domains was the reason an earlier session was shown 31 findings and cited none.
- Reuse test: a new folder's first prompt asked for a validation method that a finding in the bank had shown to be misleading; the session got the finding in its first brief, explained why the trap did and did not apply, and ran the right controls. Pass.
- Draft findings are a ledger: recorded drafts are marked, never duplicated, titles are cut at a word, progress sentences are narration, table rows carry their header.

## Open items

1. Reuse test 2: a second project in the same domain as a recent build session, to check that the start-up brief surfaces that session's findings and the new session applies them without rediscovering. Caveat: a finding recorded without tags is reachable only through the start-up brief (domain ranking), not through prompt recall (concept matching).
2. Pending drafts in `~/.optimus/projects/*/draft-findings.json`: record with `kb write <file>` after review.
3. Open concept-merge questions: `kb concepts review`.
4. Transfer-proposal lines in briefs ("your environment differs: …") are long and rarely used; a candidate for trimming after more evidence.

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

# log watcher (a plain python filter; grep in a pipeline went deaf once on a machine that rewrites it)
tail -n0 -F ~/.optimus/logs/hooks.log | python3 -u -c '
import sys,re; p=re.compile(r"\"level\":\"(warn|error)\"|auto-registered|domain settled|domain decision|pre-compact|post-compact|subagent drafts")
for l in iter(sys.stdin.readline,""):
    if p.search(l): print(l.rstrip()[:260], flush=True)'
```

Judging a session afterwards, all from files: the transcript under `~/.claude/projects/<cwd-slug>/<session>.jsonl` holds the injected briefs (`attachment.type == hook_additional_context`), the prompts, tool calls and text; count the briefed finding ids (`[f_…]`) against the ids the assistant text cites; `metrics.jsonl` gives context per turn; `audit.json` gives present and missing per compaction; the bank findings for a project are `grep -l "^project: <id>" ~/knowledge-bank/notes/finding/*.md`; subagent transcripts that called `kb_write` are under `<session>/subagents/`.

Rules that held up: measure before changing; one fix per observed failure with a test that pins it; commit only on a green suite; repair the bank by hand only to undo a plugin mistake; never commit inside the owner's other repositories.
