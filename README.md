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

Optimus ships no binary, so give your shell a `kb` command. This function finds the plugin wherever Claude Code keeps it, so it survives plugin updates:

```sh
cat >> ~/.zshrc <<'EOF'
kb() { node "$(claude plugin list --json | node -pe '(p=>p.readFromFolder||p.installPath)(JSON.parse(require("fs").readFileSync(0,"utf8")).find(p=>p.id=="optimus@optimus"))')/dist/kb.js" "$@"; }
EOF
source ~/.zshrc
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
- **At the end of a session** a draft file of the measurements the session stated, for you to review and record:

```sh
kb write ~/.optimus/projects/<project>/draft-findings.json
```

Agents your session spawns get the same project card and record what they measure on their own.

## Commands

| Command | What it does |
|---|---|
| `kb doctor` | Checks the install, the bank, the window and hook collisions |
| `kb map --open` | Opens the bank as a zoomable map of projects, approaches and findings |
| `kb write <file>` | Records the findings in a draft file (or any JSON spec) into the bank |
| `kb project init --domain <d>` | Files the current folder under a domain by hand |
| `kb domain new <name> --facets a,b,c --gates g1,g2,g3 --keywords w1,w2` | Adds a new kind of project to the bank |
| `kb concepts review` | Shows the open "merge X into Y?" questions |
| `kb sync` | Commits and pushes the bank (also runs itself at the end of each turn) |

`kb` with no arguments lists everything.

## A second device

Push your bank once from the first machine, then install Optimus and clone the bank on the next one:

```sh
# first machine
cd ~/knowledge-bank && git remote add origin <your private git remote> && git push -u origin main

# second machine: install the plugin and the kb function exactly as in Install, then
kb setup && kb init --clone <your private git remote> && kb doctor
```

Keep the bank repository private: it holds what your projects learned.

## Setting it up with Claude Code

Paste this into a Claude Code session and it will do the steps above for you:

> Install the Optimus plugin from https://github.com/GageBachik/optimus. Run `claude plugin marketplace add GageBachik/optimus` and `claude plugin install optimus@optimus`. Find the plugin folder with `claude plugin list --json`: the entry with id `optimus@optimus`, field `readFromFolder` if present, else `installPath`; call it PLUGIN. Append the `kb` shell function from the README's Install section to my `~/.zshrc`. Then run `node PLUGIN/dist/kb.js setup`, `node PLUGIN/dist/kb.js init` and `node PLUGIN/dist/kb.js doctor` directly (your shell has no aliases), show me the doctor output, and remind me to restart Claude Code or run `/reload-plugins` so the hooks load.

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
