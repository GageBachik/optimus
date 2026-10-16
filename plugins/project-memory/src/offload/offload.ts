import type { HookInput } from '../lib/run-hook.js';
import { paths } from '../lib/paths.js';
import { redactSensitive } from '../lib/redaction.js';
import { storeBlob } from './blobs.js';
import { buildPlaceholder } from './placeholder.js';
import { loadState, saveState } from '../lib/session-state.js';
import { log } from '../lib/log.js';
export function largestStringField(obj: unknown): { path: (string | number)[]; value: string } | null {
  const found: { path: (string | number)[]; value: string }[] = [];
  const walk = (v: unknown, p: (string | number)[]) => { if (typeof v === 'string') found.push({ path: p, value: v }); else if (Array.isArray(v)) v.forEach((x, i) => walk(x, [...p, i])); else if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) walk(x, [...p, k]); };
  walk(obj, []); found.sort((a, b) => b.value.length - a.value.length);
  if (!found.length) return null; if (found.length > 1 && found[0].value.length < 2 * found[1].value.length) return null; return found[0];
}
export function setAtPath(obj: unknown, p: (string | number)[], value: string): unknown {
  if (!p.length) return value; const clone: any = Array.isArray(obj) ? [...(obj as unknown[])] : { ...(obj as object) }; clone[p[0]] = setAtPath(clone[p[0]], p.slice(1), value); return clone;
}
export function offload(input: HookInput) {
  const started = Date.now(); const cfg = paths.config().offload ?? {};
  const threshold = cfg.thresholdChars ?? 20000, headLines = cfg.headLines ?? 30, tailLines = cfg.tailLines ?? 15;
  const sessionId = String(input.session_id ?? 'unknown'); const agentId = input.agent_id ? String(input.agent_id) : 'main';
  const target = largestStringField(input.tool_response); if (!target || target.value.length < threshold) return undefined;
  const state = loadState(sessionId, agentId);
  const redacted = redactSensitive(target.value);
  const command = (input.tool_input as { command?: unknown } | undefined)?.command;
  const blob = storeBlob(redacted.text, { tool: String(input.tool_name), sessionId, command: typeof command === 'string' ? command : undefined });
  const seen = state.seenBlobs.includes(blob.id); if (!seen) { state.seenBlobs = [...state.seenBlobs, blob.id].slice(-500); saveState(sessionId, state, agentId); }
  if (Date.now() - started > 2000) { log('warn', 'offload exceeded 2 s; leaving output untouched'); return undefined; }
  const replacement = buildPlaceholder({ text: redacted.text, chars: blob.chars, lines: blob.lines, id16: blob.id16, seen, headLines, tailLines });
  return { hookSpecificOutput: { hookEventName: 'PostToolUse' as const, updatedToolOutput: setAtPath(input.tool_response, target.path, replacement) } };
}
