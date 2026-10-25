<p align="center">
  <img src="assets/optimus.png" alt="Optimus" width="220">
</p>

<h1 align="center">Optimus</h1>

<p align="center">Memory for Claude Code. A session never loses its place, and what one project learns, the next one knows.</p>

---

Optimus is a Claude Code plugin. It runs as hooks and one MCP server inside your normal `claude` sessions and does four things:

- **Keeps big tool outputs out of your context.** Shell output over 10K characters, and search, fetch or MCP results over 20K, is stored on disk and replaced by a head-and-tail preview; `recall(id)` reopens it exactly when it is needed. File reads are left alone.
- **Survives compaction.** Before Claude Code compacts, Optimus snapshots the goal, decisions, files, commands and measurements of the session; after compaction it checks what the summary dropped and puts it back.
- **Keeps a knowledge bank.** Findings your sessions and their agents measure are recorded as notes with evidence, and the relevant ones are briefed into the next session that needs them, in this project or another. When nothing in the bank relates to a prompt, nothing is injected.
- **Syncs across your devices.** The bank is a git repository of Markdown files. Push it, clone it, and every machine knows the same things.

It never changes how Claude Code works. No forked harness, no proxy, no replacement compaction: only the official hook and plugin extension points.

## Install

You need Claude Code 2.1.300 or later, Node 24.4 or later, and git.

```sh
claude plugin marketplace add GageBachik/optimus
claude plugin install optimus@optimus
```

Optimus ships no binary, so give your shell a `kb` command. This function finds the plugin wherever Claude Code keeps it, so it survives plugin updates. zsh or bash (use `~/.bashrc` instead of `~/.zshrc` for bash):

```sh
cat >> ~/.zshrc <<'EOF'
kb() { node "$(claude plugin list --json | node -pe '(p=>p.readFromFolder||p.installPath)(JSON.parse(require("fs").readFileSync(0,"utf8")).find(p=>p.id=="optimus@optimus"))')/dist/kb.js" "$@"; }
EOF
source ~/.zshrc
```

Windows, PowerShell 5.1 or 7 (if `. $PROFILE` says running scripts is disabled, run `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned` once first):

```powershell
New-Item -Force $PROFILE | Out-Null
Add-Content $PROFILE 'function kb { $p = claude plugin list --json | ConvertFrom-Json | Where-Object id -eq "optimus@optimus"; $r = if ($p.readFromFolder) { $p.readFromFolder } else { $p.installPath }; node "$r/dist/kb.js" @args }'
. $PROFILE
```

Then set it up once:

```sh
kb setup     # raises Claude Code's compaction window to 333K in ~/.claude/settings.json (backup kept) and records a device id
kb init      # creates ~/knowledge-bank as a git repository with the starter domains
kb doctor    # one PASS/WARN/FAIL line per check
```

Restart Claude Code, or run `/reload-plugins` in an open session, so the hooks and the MCP server load. That is the whole setup: open `claude` in any project folder under your home directory and work as usual.

`kb setup --append-claude-md` also appends the compaction checklist to `~/.claude/CLAUDE.md`; it is optional, the restore brief carries the same rules.

## What you will see

- **At session start** a short brief: where the last session in this folder left off, and the findings in the bank most relevant to this project.
- **On your first prompt** the folder is registered in the bank. Optimus writes a small `.kb.json` (project id and domain) at the folder root; commit it or git-ignore it, your call, the folder takes part as long as the file exists. The folder's files and name give a first guess of its domain (trading, solana, gen-l1, ios, tooling), and your first real prompt settles it. If nothing fits, Optimus asks once whether this is a new kind of project and creates the domain on your yes.
- **On prompts that name something the bank knows** (a concept, another project) a few related findings, from this project's domain only.
- **After compaction** the restore brief, with the items Claude Code's summary left out.
- **At the end of a turn**, if the session stated measurements it did not record, Optimus asks it once to judge them and record the durable ones itself. Nothing is left for you to run; the drafts stay in `~/.optimus/projects/<project>/draft-findings.json` as a log.

Agents your session spawns get the same project card and record what they measure on their own.

## Commands

| Command | What it does |
|---|---|
| `kb doctor` | Checks the install, the bank, the window and hook collisions |
| `kb map --open` | Opens the bank as a zoomable map of projects, approaches, findings and imported memories |
| `kb write <file>` | Records the findings in a draft file (or any JSON spec) into the bank |
| `kb project init --domain <d>` | Files the current folder under a domain by hand |
| `kb domain new <name> --facets a,b,c --gates g1,g2,g3 --keywords w1,w2` | Adds a new kind of project to the bank |
| `kb concepts review` | Shows the open "merge X into Y?" questions |
| `kb transfers prune [--apply]` | Lists (with `--apply`, withdraws) the proposed transfers the current rule would no longer propose; confirmed, refuted and provisional ones are never touched |
| `kb sync` | Commits the bank, pulls what other machines pushed, and pushes (also runs itself at the end of each turn) |
| `kb import all [--root <dir>]` | Turns Serena memories under the root (default `~/projects`), Claude Code auto-memory and Codex memories into evidence notes; rerunning adds only what is new |

`kb` with no arguments lists everything.

## The bank repository and a second device

The bank is a git repository of Markdown files in `~/knowledge-bank`. Give it a **private** remote: it holds what your projects learned, including numbers, paths and names from your own code. Create an empty private repository (no README, no license) and push the bank to it once; from then on `kb sync` commits and pushes at the end of every turn and pulls what your other machines pushed. With the GitHub CLI that is one command:

```sh
cd ~/knowledge-bank && gh repo create <you>/knowledge-bank --private --source . --remote origin --push
```

Without it: `cd ~/knowledge-bank && git remote add origin <your private git remote> && git push -u origin main`.

On the next machine, install the plugin and the `kb` function exactly as in Install, make sure `git` can reach the private repository (an SSH key on your account, or `gh auth login && gh auth setup-git`), then, before opening any project session:

```sh
kb setup
kb init --clone <your private git remote>
kb doctor      # bank-remote should read "origin reachable"
```

If `~/knowledge-bank` already exists on the second machine (an earlier `kb init`, or a session already recorded a note there), remove it first or pass `--bank <empty dir>` to the init. If a sync ever hits a rebase conflict, it aborts, keeps the local commit, and `kb doctor` shows `last-sync  failed (rebase conflict)` until you resolve it in `~/knowledge-bank` like any git conflict.

## Setting it up with Claude Code

Paste this into a Claude Code session and it will do the steps above for you:

> Install the Optimus plugin from https://github.com/GageBachik/optimus. Run `claude plugin marketplace add GageBachik/optimus` and `claude plugin install optimus@optimus`. Find the plugin folder with `claude plugin list --json`: the entry with id `optimus@optimus`, field `readFromFolder` if present, else `installPath`; call it PLUGIN. Append the `kb` function from the README's Install section to my shell profile (`~/.zshrc` for zsh, `~/.bashrc` for bash, `$PROFILE` for PowerShell). Then run `node PLUGIN/dist/kb.js setup`, `node PLUGIN/dist/kb.js init` (or `node PLUGIN/dist/kb.js init --clone <url>` if I give you the URL of my private bank repository) and `node PLUGIN/dist/kb.js doctor` directly (your shell has no aliases), show me the doctor output, and remind me to restart Claude Code or run `/reload-plugins` so the hooks load.

Notes for agents: state lives in `~/.optimus/` (sessions, drafts, blobs, `logs/hooks.log`, `metrics.jsonl`; override with `OPTIMUS_HOME`); the bank is `~/knowledge-bank/` (`notes/<kind>/*.md`; `templates/*.yaml` are the domains; override with `OPTIMUS_BANK` or `kb init --bank <dir>`); a project takes part when it has a `.kb.json` with `project_id` and `domain`; the MCP tools are `kb_brief`, `kb_find`, `kb_write`, `kb_compare`, `kb_link` and `recall`; the full design is in `docs/DESIGN.md`.

## Privacy

Offloaded outputs, snapshots and drafts stay on your machine under `~/.optimus/`. Recognised secret formats (AWS, GitHub, OpenAI, Anthropic, Slack and Stripe keys, JWTs, PEM private keys, Bearer headers, `password=` and `token=` style values) are redacted before anything is written to a blob, snapshot, draft or the bank. It is pattern-based, so review drafts before `kb write`. Nothing leaves your machine except the bank repository you choose to push.

## Develop

```sh
git clone https://github.com/GageBachik/optimus && cd optimus/plugins/optimus && npm install && npm test
```

To run the plugin in place from your clone (so a rebuild is the whole upgrade), switch Claude Code over to it. If you installed from GitHub first, remove that install so the two do not share a name:

```sh
claude plugin uninstall optimus@optimus && claude plugin marketplace remove optimus
claude plugin marketplace add /path/to/optimus && claude plugin install optimus@optimus
```

`npm test` rebuilds `dist/` and runs the suite. Design: `docs/DESIGN.md`. Decisions: `docs/adr/`.

## Credits and license

MIT, see `LICENSE`. Uses mechanisms from billion-context / acp-kernel (https://github.com/ranxianglei/billion-context, https://github.com/ranxianglei/acp-kernel); third-party terms in `plugins/optimus/THIRD_PARTY_NOTICES.md`. The ideas it re-implements, and the projects they came from, are credited there too.
