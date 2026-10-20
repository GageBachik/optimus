# ADR-0003: Markdown files in git are the bank's truth; SQLite is a rebuildable index; Trilium is not run

Date: 2026-10-16 · Status: accepted (reverses the 16 Oct morning pick of Trilium)

## Context
Four independent designs for the knowledge bank were scored by three judges against the domain-agnostic model. Both Trilium-based designs ranked last with every judge. Specific reasons, verified in Trilium 0.106 source: relations are (name, target) rows with no properties, so a validation's gate and a transfer's state have no home; search has no aggregation, so ranking, the leaderboard and conflict detection live in the plugin anyway; the stock note map has no lanes, edge styles or filter panel, so the lane map must be custom anyway and inside Trilium runs through an eval'd script API; ETAPI silently overwrites on an existing id, requires caller-supplied attribute ids, returns success for mis-escaped searches with terms dropped, resurrects deleted ids within seven days, and has no change feed. Operationally it means Docker on the mini, a desktop app per laptop and three tokens for an app Gage was never confirmed to open. Everything else in Gage's stack is Markdown.

## Decision
One SQLite file per machine (`node:sqlite`, FTS5) is a rebuildable index. The truth is a folder of Markdown files with YAML frontmatter (attrs and relations by stable id) in a private git repo; the Mac mini hosts the bare remote over SSH on Tailscale. A self-contained `map.html` is generated from the index and opened from disk. No daemons.

## Consequences
- Zero servers to run; full offline on every machine; conflicts visible in git. One file per note and deterministic ids make same-file conflicts rare; when a rebase does conflict, `kb sync` aborts it, keeps the local commit, and `kb doctor` reports it.
- Lost: a rich editor, kanban boards, a mobile app. The export folder opens in Obsidian or VS Code; a one-way export into Trilium later costs about fifty lines if an editor is ever wanted.
- The model's load-bearing parts (edge properties, Transfer state, ranking weights, leaderboard) are plain SQL.
