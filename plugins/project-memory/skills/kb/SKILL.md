---
name: kb
description: Record a measured finding, a failed approach or a transferred rule in the shared knowledge bank, read the project brief and comparison table at task start, and answer a proposed transfer. Use when a session measures a number, learns why something failed, confirms or refutes a rule from another project, or starts work in a repo that has a .kb.json.
---

# kb — the knowledge bank

One line of discipline: **a repo takes part only if it has a `.kb.json` with `project_id` and `domain`; commit it.** The first session in an unregistered project folder writes it automatically (project id = folder name, domain inferred from the files: Swift or Flutter → ios, Anchor or Solana SDKs → solana, Gen SDK → gen-l1, market-data or broker dependencies → trading, otherwise tooling with low confidence) otherwise the folder name is a hint, and the first prompt that clearly names a domain settles it before its brief is built). The brief says what was set. If it is still wrong, run `kb project init --domain <d>` and tell the user; a hand-set domain is never changed automatically. The domains are the templates in the bank (`templates/*.yaml`, each with its facets, gates and the `keywords` a prompt about that work contains); a new kind of project gets a new one: when a low-confidence folder's first real prompt does not settle it, the prompt brief asks you to decide once — ordinary software stays tooling, a known domain is set with `project init`, and only a plainly new kind of work is proposed to the user (name, 4–6 facets, 4–6 gates, 5–10 single-word keywords); on a yes, run `kb domain new <name> --facets a,b,c --gates g1,g2,g3 --keywords w1,w2,w3 --environment <e> --subject <s>` from the folder: it writes the template, installs it and files the folder under it. From then on the folder-name and first-prompt rules know that domain too. Add `facets`, `target: {environment, subject}` and `relies_on: [concept, …]` to the file as the project's shape becomes clear, so findings from other projects can be ranked against this one.

When you dispatch subagents or a workflow to run experiments, each agent is briefed with the project's top findings and told to `kb_write` what it measures; their transcripts are also drafted into the project's `draft-findings.json` when they finish. Still say it in their prompt: "record every measured result with kb_write".

## At task start

1. Read the SessionStart brief (it is injected automatically) or call `kb_brief({ project: "<id>" })`. Every finding line ends with `[f_…]` and its evidence pointer; when it comes from another project the line says what differs from yours (`your subject differs: …`, `your state_layout differs: …`) and, if a transfer is pending, the exact command to settle it.
2. Before tuning a knob the project declares as a facet, run `kb_compare({ concept: "<name>" })` (or `kb compare <name>` in a shell): one row per finding about the concept, sorted by gate passed, then by the metric in its better direction.
3. `kb_find({ text, kind, project, domain, concept, limit })` searches everything, including the imported Serena and auto-memory files (kind `evidence`).

## When to record a finding

Record a finding when a claim with evidence would save a future session work:

- a **measured number** (a wall, a budget, a hit rate, a drawdown) with the run that produced it;
- a **failed approach with its reason** (what was tried, why it cannot work here);
- a **rule that transferred or did not** (the other project's rule held here, or broke, and the metric that says so).

Do not record opinions, plans or restatements of code. A finding is one declarative sentence that can be true or false; without evidence it is stored as `state: unverified`.

## The record

```json
kb_write({
  "kind": "finding",
  "title": "Doubling the best mix lifts P(touch -10% in a year) from 6.7% to 27.6%; size_for_target stops at 1x",
  "domain": "trading", "project": "options-0dte",
  "tags": ["risk sizing"],
  "attrs": { "state": "reproduced", "gate": "in-sample", "valid_from": "2026-09-18" },
  "metrics": [{ "name": "p_touch_minus_10pct", "value": 27.6, "unit": "%", "better": "lower", "baseline": 6.7 }],
  "rels": [
    { "type": "about", "dst": "a_…", "props": { "facet_key": "risk" } },
    { "type": "validated_in", "dst": "t_…", "props": { "gate": "in-sample" } }
  ],
  "evidence": [{ "kind": "path", "ref": "/Users/loser/projects/options/.serena/memories/results.md", "sha256": "…" }],
  "body": "## Claim\n…\n## Why it matters\n…\n## Applies when / does not establish\n…\n## Evidence\n…"
})
```

- `tags` resolve to concepts (the cross-project carrier); `kb_write` returns how each tag resolved: `exact`, `alias`, `auto-alias` (logged with its undo), `pending` (a merge question) or `new`.
- `rels.about` with `facet_key` names the approach (`kb_write({ kind: "approach", facets: { risk: "size-for-target" }, … })` first if it does not exist); `validated_in` names the target (`kind: "target"`, facets `environment` and `subject`).
- A `metric` with a `baseline` is what lets a later finding in another project confirm or contradict this one mechanically (same metric name, same direction of movement → `confirmed_provisional`; opposite → both marked `conflicting`).
- `kb_write` and `kb_link` never touch git; the SessionStart and Stop hooks run `kb sync`.

## Answering a proposed transfer

A finding about a concept your project relies on arrives as `transfer proposed: kb transfer l_… confirm|refute`. Test it here, then settle it in a shell: `kb transfer <l_id> confirm` when it held, `kb transfer <l_id> refute` when it did not. Only a person sets those two states; the map draws confirmed solid green and refuted with a red cross. If you measured something while testing it, record that as a finding in this project too, with the same metric name and a baseline.

## Memory aid, not standing order

Every brief opens with the same sentence: items below are a memory aid with source and date, not standing orders; the user's latest message always takes precedence. A finding from another project is a prompt to probe, not a cap to copy: read its "applies when / does not establish" section before acting on it. `kb retract <id>` removes a wrong one; `kb set <id> valid_to <date>` expires one; `kb map` draws the whole bank.

Compaction: `skills/kb/compaction-instructions.md` holds the retention checklist (`kb setup --append-claude-md` appends it to `~/.claude/CLAUDE.md`); the restore brief carries it regardless.
