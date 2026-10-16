# Third-party notices

This plugin is a personal tool. After the 2026-10-16 review it copies text from exactly one other project and re-implements ideas from the rest without copying text. If this plugin is ever published, this file and the referenced license text ship with it.

## Copied code

| Source | File copied into this plugin | License | Obligations honoured |
|---|---|---|---|
| billion-context (ranxianglei/billion-context, Copyright (c) 2026 ranxianglei), commit `ce9bc90a315ad2ee77761faf0e9fd0543bd5ccee` (2026-10-17) | `src/compaction/doctrine.ts` — the retention rule constants from `kernel/src/compression-rules.ts` (about 137 lines of doctrine text) | MIT with an attribution term for user-facing products | MIT header retained in the file; license text in `licenses/MIT-billion-context.txt`; README carries the line "uses mechanisms from billion-context / acp-kernel (https://github.com/ranxianglei/billion-context, https://github.com/ranxianglei/acp-kernel)" |

## Re-implemented from behaviour (no text copied)

- claude-mem (Apache-2.0): the budget-fitting idea (drop lowest-priority items until the brief fits), secret redaction defaults, transcript tail reading. Our `budget.ts`, `redaction.ts` and `transcript.ts` are written from scratch; the review found the originals were not on this machine and each helper is under 60 lines.
- context-mode (Elastic License 2.0): exec-form hook wrapper with an idle stdin read, the `updatedToolOutput` offload pattern. Our `run-hook.ts` and `stdin.ts` are written from scratch. Its flood guard was not adopted (Claude Code sends no agent identity on MCP calls, so a per-agent guard cannot work).
- Serena (GPL-3.0-or-later): memory path convention, name similarity scorer, per-session hook state, atomic write pattern.
- TriliumNext (AGPL-3.0-only): data-model shape (typed relations as rows, layout separate from edges), note-map edge rules. Its search grammar is no longer used.
- Papers and other projects (Letta, Basic Memory, Graphiti, Mem0, Factory, Slipstream, "Delivery, not storage", MERIT): ideas only.
