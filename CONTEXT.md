# Project Memory — Ubiquitous Language (confirmed by Gage, 2026-10-16)

This file is a glossary only. It defines the words the plugin, the briefs, the map and the conversations use. No implementation detail belongs here.

## Universal layer (never changes)

- **Domain** — A field of work with its own vocabulary (Trading, Gen L1, iOS). Owns exactly one Template.
- **Template** — The per-domain vocabulary, stored as data: the Facet keys an Approach has, the Method vocabulary an Experiment may use, the Gate ladder, and what counts as a Target's Environment and Subject.
- **Project** — A repo or work identity where discoveries are made. Resolved from the normalized git remote, then the repo name, then the working directory, so every machine agrees on the same id.
- **Theme** — A research bucket inside a Domain that groups Approaches (mean reversion; book scaling; offline-first sync).
- **Approach** — One strategy, design or architecture under investigation, described by Facets. "Strategy", "design", "backtest subject" are Approaches wearing domain clothes.
- **Facet** — A Template-defined (key, value) slot on an Approach or a Target. Same key with a different value across two Approaches is what makes a comparison row.
- **Experiment** — One run that tests an Approach on a Target at a Gate, using a Method toward an Objective, yielding Metrics, with a baseline value and a trial count. A backtest, a soak, a burst tournament and a TestFlight cohort are all Experiments.
- **Method** — How an Experiment searched or evaluated (walk-forward; Monte Carlo; soak; snapshot test). Template vocabulary.
- **Objective** — What an Experiment optimized or measured (Sharpe; max drawdown; fills per second; launch time). Separate from Method so two walk-forward runs with different objectives stay comparable.
- **Target** — Where something ran: an Environment × Subject pair (platform × instrument; cluster-and-runtime × program or entity; OS-and-Xcode × device class). Validation attaches to the pair; ranking gives partial credit per matching axis.
- **Gate** — A rung on the Domain's validation ladder. A Finding records the highest rung it passed.
- **Concept** — A reusable idea owned by no Project (risk sizing, autocorrelation, heap ceiling, idempotency). The only carrier of reuse across Domains. Has a canonical name and Aliases.
- **Alias** — A normalized spelling that resolves to a Concept. Written when free tagging is grouped automatically or confirmed.
- **Finding** — One dated, evidenced, declarative claim: a single sentence that can be true or false. Carries State, Gate passed, a validity window (valid_from, valid_to), and may supersede or conflict with other Findings.
- **State** — A Finding's confidence rung: unverified, observed, reproduced, conflicting. "Unverified" means no check has passed yet, not that the claim is false.
- **Transfer** — A tracked proposal that a Finding applies to an Approach, Target or Project it was not discovered in. States: proposed, confirmed, refuted. The dashed edge on the map.
- **Evidence** — A pointer to source bytes plus a content hash: commit, dataset, transcript slice, memory file. A Finding with no Evidence stays unverified.
- **Brief** — The bounded, ranked text a hook pushes into a session. Derived, never stored as truth.
- **Report** — A dated roll-up of Findings and Experiments for a Theme or Project. Derived, never the source of truth.

## Session-half terms

- **Offload** — Storing a large tool result in the blob store and showing the model a short placeholder with a recall pointer.
- **Blob** — A stored tool output or snapshot, addressed by content hash.
- **Recall** — The tool that pages an exact slice of a stored blob or snapshot back into context.
- **Snapshot** — The transcript slice and task-state record saved immediately before native compaction.
- **Task-state record** — The protected record of goal, constraints, decisions, files, tests run and open items, rebuilt from originals and re-injected after compaction.
- **Working set** — The live context Claude Code keeps before compacting; set by the autoCompactWindow setting (about 200K tokens).

## Terms deliberately not used

- "Strategy", "Design", "Backtest", "Benchmark" as nouns of the model — they are Approaches and Experiments inside a Domain's Template.
- "Memory" for the bank — it is a knowledge bank of Findings; "memory" refers only to Claude Code's own auto-memory folder or Serena's memory files, both of which are import sources.
