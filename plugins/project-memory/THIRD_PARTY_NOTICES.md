# Third-party notices

This plugin is a personal tool. It copies a small number of files from other projects, each kept with its original header, and re-implements ideas from others without copying text. If this plugin is ever published, this file and the referenced license texts ship with it.

## Copied code

| Source | Files copied into this plugin | License | Obligations honoured |
|---|---|---|---|
| claude-mem (thedotmack/claude-mem, Copyright 2026 Alex Newman) | `src/lib/budget.ts` (from `src/services/context/ContextBudget.ts`), `src/lib/redaction.ts` (from `src/utils/redaction.ts`, defaults changed to on, patterns added), `src/kb/dedup/*.ts` (from `src/services/dedup/*`), `src/lib/transcript.ts` (from `src/shared/transcript-parser.ts`, Claude Code branch only) | Apache-2.0 | License text in `licenses/APACHE-2.0.txt`; NOTICE attribution retained; modified files marked in their headers |
| billion-context (ranxianglei/billion-context, Copyright (c) 2026 ranxianglei) | `src/compaction/doctrine.ts` (from `kernel/src/compression-rules.ts`), `src/offload/content-store.ts` (from `kernel/src/content-store.ts`) | MIT with an attribution term for user-facing products | MIT header retained; README carries the line "uses mechanisms from billion-context / acp-kernel (https://github.com/ranxianglei/billion-context, https://github.com/ranxianglei/acp-kernel)" |
| context-mode (mksglu/context-mode, Copyright 2026 Mert Koseoglu) | `src/lib/run-hook.ts` and `src/lib/stdin.ts` (from `hooks/run-hook.mjs`, `hooks/core/stdin.mjs`), `src/lib/truncate.ts` (from `src/truncate.ts`), `src/lib/flood-guard.ts` (from `src/search/flood-guard.ts`) | Elastic License 2.0 | ELv2 text in `licenses/ELv2.txt`; copyright line retained; files marked "modified"; not offered as a hosted service |

## Re-implemented from behaviour (no text copied)

- Serena (GPL-3.0-or-later): memory path convention, `mem:` reference regex, name similarity scorer, degrade-not-truncate output ladder, per-session hook state, atomic write pattern.
- TriliumNext (AGPL-3.0-only): data-model shape (typed relations as rows, layout separate from edges), note-map edge rules, search grammar used as a specification.
- Papers and other projects (Letta, Basic Memory, Graphiti, Mem0, Factory, Slipstream, "Delivery, not storage", MERIT): ideas only.
