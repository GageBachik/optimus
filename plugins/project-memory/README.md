# project-memory

Claude Code plugin that keeps task state across compaction and sessions: large tool outputs are offloaded and recalled exactly, and a restore brief is injected after each compaction. See `docs/DESIGN.md` at the repository root.

Uses mechanisms from billion-context / acp-kernel (https://github.com/ranxianglei/billion-context, https://github.com/ranxianglei/acp-kernel). Third-party terms: `THIRD_PARTY_NOTICES.md`.

## Install and test

These are the commands used on the development Mac (see `docs/acceptance/phase-1.md` §2 and §4). Paths assume the repository is at `/Users/loser/projects/project-memory`; replace it with your clone.

Install the plugin from this repository as a directory marketplace. Claude Code then runs the plugin from `plugins/project-memory` in place, so a later `git pull` or rebuild updates it without reinstalling.

```
claude plugin validate /Users/loser/projects/project-memory
claude plugin marketplace add /Users/loser/projects/project-memory
claude plugin install project-memory@project-memory
claude plugin list
```

A Claude Code session that was already open must run `/reload-plugins` or be restarted. New `claude` processes load the plugin straight away.

The `kb` command is `dist/kb.js` run with Node 24.4 or later. There is no installed binary, so either type the full form or add an alias:

```
node /Users/loser/projects/project-memory/plugins/project-memory/dist/kb.js setup
alias kb='node /Users/loser/projects/project-memory/plugins/project-memory/dist/kb.js'
```

`kb setup` sets `autoCompactWindow` to 200000 in `~/.claude/settings.json` (a backup is written) and records a device id. Then create the knowledge bank, and register each project that should use it:

```
kb init                                    # creates ~/knowledge-bank as a git repo with the note templates
cd ~/projects/<repo> && kb project init --domain <domain> [--id <project id>]
```

`kb project init` writes `.kb.json` in the current directory, so run it from the repository root. Without it the plugin still manages context in that project, but the startup brief carries no findings from the bank.

Check the installation:

```
kb doctor           # one PASS/WARN/FAIL/INFO line per check, exit 1 on any FAIL
kb doctor --live    # also runs two headless claude sessions (about two minutes) to prove offload, subagent brief and the 10K cap
kb map --open       # writes the bank's note map as HTML and opens it in the browser
```

`node dist/kb.js` with no arguments prints the full command list.

To see the plugin working by hand, follow the five-minute interactive check in `docs/acceptance/phase-1.md` §11: offload of a large output, `recall`, the subagent brief, `/compact` and the restore brief, and "Last session in this project" in a new session. The knowledge-bank demonstrations (two clones of one bank, transfer between projects, the map) are in `docs/acceptance/phase-2.md`.
