# ADR-0001: Integrate with Claude Code through documented extension points only

Date: 2026-10-16 · Status: accepted

## Context
The original handoff and several quarry projects (billion-context, Headroom, rolling-context, context-mode) achieve context control by interposing on Claude Code: a local API proxy on `ANTHROPIC_BASE_URL`, rewriting the conversation on the wire, denying tools from PreToolUse, or rewriting subagent prompts. Live probes on 2026-10-16 showed the costs: a non-first-party base URL disables tool deferral unless `ENABLE_TOOL_SEARCH=true` (requests grew from 12 tools / ~61K tokens to 630 tools / ~490K tokens), Remote Control turns off, every new beta header must be tracked, and two PreToolUse hooks rewriting the same Agent prompt race with the last finisher winning.

## Decision
The plugin uses hooks (`SessionStart`, `UserPromptSubmit`, `PostToolUse` with `updatedToolOutput`, `PreCompact`, `PostCompact`, `SubagentStart`, `Stop`, `SessionEnd`), one stdio MCP server, a skill, and settings keys. It registers no PreToolUse hook, runs no proxy, never rewrites history, and never disables native compaction.

## Consequences
- Claude Code updates flow through (compaction, tool deferral, auto-memory) rather than being fought.
- Some capabilities are out of reach by construction: server-side context editing, continuous history folding, a constant-size view. These are documented as deferred, with a billion-context pilot as the escape hatch if measurement shows the compaction cliff hurts.
- Every injected string is bounded by the 10,000-character hook cap, so a budget fitter is mandatory.
