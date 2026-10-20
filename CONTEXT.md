# Optimus — Ubiquitous Language (confirmed by Gage, 2026-10-16; Transfer and Project entries amended after review)

This file is a glossary only. It defines the words the plugin, the briefs, the map and the conversations use. No implementation detail belongs here.

## Universal layer (never changes)

- **Domain** — A field of work with its own vocabulary (Trading, Gen L1, iOS). Owns exactly one Template.
- **Template** — The per-domain vocabulary, stored as data: the Facet keys an Approach has, the Method vocabulary an Experiment may use, the Gate ladder, and what counts as a Target's Environment and Subject.
- **Project** — A repo or work identity where discoveries are made. Identified by an id the repo declares once and every machine shares; never guessed from a folder name or a remote.
- **Theme** — A research bucket inside a Domain that groups Approaches (mean reversion; book scaling; offline-first sync).
- **Approach** — One strategy, design or architecture under investigation, described by Facets. "Strategy", "design", "backtest subject" are Approaches wearing domain clothes.
- **Facet** — A Template-defined (key, value) slot on an Approach or a Target. Same key with a different value across two Approaches is what makes a comparison row.
- **Experiment** — One run that tests an Approach on a Target at a Gate, using a Method toward an Objective, yielding Metrics; it may carry a baseline value and a trial count. A backtest, a soak, a burst tournament and a TestFlight cohort are all Experiments.
- **Method** — How an Experiment searched or evaluated (walk-forward; Monte Carlo; soak; snapshot test). Template vocabulary.
- **Objective** — What an Experiment optimized or measured (Sharpe; max drawdown; fills per second; launch time). Separate from Method so two walk-forward runs with different objectives stay comparable.
- **Target** — Where something ran: an Environment × Subject pair (platform × instrument; cluster-and-runtime × program or entity; OS-and-Xcode × device class). Validation attaches to the pair; ranking gives partial credit per matching axis.
- **Gate** — A rung on the Domain's validation ladder. A Finding records the highest rung it passed.
- **Concept** — A reusable idea owned by no Project (risk sizing, autocorrelation, heap ceiling, idempotency). The only carrier of reuse across Domains. Has a canonical name and Aliases.
- **Alias** — A normalized spelling that resolves to a Concept. Written when free tagging is grouped automatically or confirmed.
- **Finding** — One dated, evidenced, declarative claim: a single sentence that can be true or false. Carries State, Gate passed, a validity window (valid_from, valid_to), optional Metrics with a baseline, and may supersede or conflict with other Findings.
- **Metric** — A named measurement on a Finding or Experiment with a value, an optional unit, a direction (higher or lower is better) and an optional baseline the value is compared against.
- **State** — A Finding's confidence rung: unverified, observed, reproduced, conflicting. "Unverified" means no check has passed yet, not that the claim is false.
- **Transfer** — A tracked proposal that a Finding applies to an Approach, Target or Project it was not discovered in. States: proposed; confirmed_provisional (set automatically only when a later Finding in the target Project carries the same Metric with a baseline and moves in the same direction); confirmed and refuted (set only by a person). The dashed edge on the map.
- **Comparison** — The table of Findings about one Concept, one row per Finding, ordered by Gate passed and then by Metric in its better direction.
- **Evidence** — A pointer to source bytes plus a content hash: commit, dataset, transcript slice, memory file. A Finding with no Evidence stays unverified.
- **Brief** — The bounded, ranked text a hook pushes into a session. Derived, never stored as truth.
- **Report** — A dated roll-up of Findings and Experiments for a Theme or Project. Derived, never the source of truth.

## Session-half terms

- **Offload** — Storing a large tool result in the blob store and showing the model a placeholder that keeps the head and tail of the output with a recall pointer.
- **Blob** — A stored tool output or snapshot, addressed by content hash.
- **Recall** — The tool that pages an exact slice of a stored blob or snapshot back into context.
- **Snapshot** — The transcript slice and task-state record saved immediately before native compaction.
- **Task-state record** — The protected record of goal, constraints, decisions, files, tests run, exact values and open items, rebuilt from originals and re-injected after compaction.
- **Last-session record** — The most recent task-state record for a Project on this machine, shown at the start of the next session opened there. Working state, not knowledge; it does not travel between machines.
- **Working set** — The live context Claude Code keeps before compacting; set by the autoCompactWindow setting (about 200K tokens).

## Terms deliberately not used

- "Strategy", "Design", "Backtest", "Benchmark" as nouns of the model — they are Approaches and Experiments inside a Domain's Template.
- "Leaderboard" — the ranking of Methods across Experiments is deferred; what ships is the Comparison of Findings.
- "Memory" for the bank — it is a knowledge bank of Findings; "memory" refers only to Claude Code's own auto-memory folder or Serena's memory files, both of which are import sources.
