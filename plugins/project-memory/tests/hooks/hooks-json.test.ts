import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
// A broken hooks.json breaks the whole plugin load at session start; a stray escape once did exactly that. Parse it here, every run.
test('hooks.json parses, registers every event the router knows, and every hook points at a router module', () => {
  const d = JSON.parse(readFileSync('hooks/hooks.json', 'utf8'));
  const router = readFileSync('src/hooks/entry.ts', 'utf8');
  const events = Object.keys(d.hooks);
  for (const ev of ['SessionStart', 'UserPromptSubmit', 'PostToolUse', 'PreCompact', 'PostCompact', 'SubagentStart', 'SubagentStop', 'Stop', 'SessionEnd']) assert.ok(events.includes(ev), ev);
  for (const ev of events) for (const entry of d.hooks[ev]) for (const h of entry.hooks) {
    assert.equal(h.type, 'command'); assert.equal(h.command, 'node'); assert.equal(h.args[1], '${CLAUDE_PLUGIN_ROOT}/dist/hook.js');
    assert.ok(router.includes(`'${h.args[2]}':`), `router module for ${ev}: ${h.args[2]}`);
  }
});
