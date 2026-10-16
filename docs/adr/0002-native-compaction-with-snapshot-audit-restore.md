# ADR-0002: Keep native compaction; make the cliff safe and reversible instead of replacing it

Date: 2026-10-16 · Status: accepted

## Context
OptChat/billion-context keep the model's view at a constant size by folding older history into summaries on every request and letting the model reopen folded blocks. That requires owning the request stream (ADR-0001 forbids it) and, on current models, rewriting earlier turns invalidates thinking blocks and restarts the prompt cache. billion-context's own controlled experiment found its retention doctrine text with zero compressions delivered 62 of the 63 percentage points of measured re-fetch reduction. Anthropic's guidance to API builders is that simple compaction (one summary, then continue) performs comparably to elaborate schemes when the summarizer is told what to retain. Gage's baseline shows a median turn of 336K tokens and only 2 compactions in 5,427 turns, so the lever is the working-set budget, not raw capacity.

## Decision
Set `autoCompactWindow` to about 200K so native compaction runs. Around it: PreCompact snapshots the transcript slice and rebuilds a task-state record from originals; PostCompact audits the summary for omissions; SessionStart(compact) re-injects a bounded restore brief with pointers; a `recall` tool reopens any stored original; the retention doctrine is supplied as compaction instructions and carried in the restore brief regardless.

## Consequences
- Between compactions nothing is summarized (full fidelity). At the cliff, loss is recoverable and audited, not prevented.
- No continuous fold, no summary tree. If two weeks of measurement (compactions per day, audit omissions, recall calls, tokens per turn) show the cliff hurting, pilot billion-context on one project rather than build a proxy.
