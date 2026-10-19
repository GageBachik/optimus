import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, existsSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
process.env.PROJECT_MEMORY_HOME = mkdtempSync(path.join(tmpdir(), 'pm-')); process.env.PROJECT_MEMORY_BANK = mkdtempSync(path.join(tmpdir(), 'bank-'));
const { autoRegister, inferDomain } = await import('../../src/kb/auto-register.js');
const { sessionStart } = await import('../../src/hooks/session-start.js');
const home = mkdtempSync(path.join(tmpdir(), 'home-'));
const mk = (rel: string, files: Record<string, string> = {}) => { const d = path.join(home, rel); mkdirSync(d, { recursive: true }); for (const [f, c] of Object.entries(files)) { mkdirSync(path.dirname(path.join(d, f)), { recursive: true }); writeFileSync(path.join(d, f), c); } return d; };

test('auto-register: a fresh empty folder becomes a tooling project with low confidence; the file carries the reason', () => {
  const d = mk('projects/fresh');
  const a = autoRegister(d, home)!;
  assert.equal(a.project_id, 'fresh'); assert.equal(a.domain, 'tooling'); assert.equal(a.confidence, 'low');
  const cfg = JSON.parse(readFileSync(path.join(d, '.kb.json'), 'utf8')); assert.equal(cfg.domain, 'tooling'); assert.equal(cfg.auto.reason, 'empty folder');
  assert.equal(autoRegister(d, home), null, 'already registered');
  assert.equal(autoRegister(path.join(d, 'sub'), home), null, 'a subfolder of a registered project is not a project');
});

test('auto-register: domains are inferred from local signals', () => {
  assert.equal(autoRegister(mk('projects/sol', { 'Anchor.toml': '', 'programs/x/Cargo.toml': '[dependencies]\nanchor-lang = "0.30"' }), home)!.domain, 'solana');
  assert.equal(autoRegister(mk('projects/app', { 'App.xcodeproj/project.pbxproj': '', 'Sources/A.swift': '' }), home)!.domain, 'ios');
  assert.equal(autoRegister(mk('projects/bt', { 'requirements.txt': 'databento\npandas', 'backtests/run.py': '' }), home)!.domain, 'trading');
  assert.equal(autoRegister(mk('projects/gen', { 'package.json': '{"dependencies":{"@gen/client":"1.0.0"}}' }), home)!.domain, 'gen-l1');
  assert.equal(inferDomain(mk('projects/web', { 'package.json': '{"dependencies":{"next":"15"}}' })).domain, 'tooling');
});

test('auto-register: never at the home or workspace roots, in hidden folders, or in a folder of repositories', () => {
  assert.equal(autoRegister(home, home), null); assert.equal(autoRegister(mk('projects'), home), null); assert.equal(autoRegister(mk('.claude/x'), home), null);
  const ws = mk('projects/ws'); for (const r of ['a', 'b', 'c']) mkdirSync(path.join(ws, r, '.git'), { recursive: true });
  assert.equal(autoRegister(ws, home), null); assert.ok(!existsSync(path.join(ws, '.kb.json')));
  assert.equal(autoRegister('/tmp', home), null, 'outside home');
});

test('session start in an unregistered folder registers it and says so in the brief', async () => {
  const d = mk('projects/fresh2', { 'package.json': '{"name":"fresh2"}' });
  const prev = process.env.HOME; process.env.HOME = home;
  try {
    const r = (await sessionStart({ hook_event_name: 'SessionStart', source: 'startup', session_id: 's1', cwd: d } as any)) as any;
    const text = r.hookSpecificOutput.additionalContext as string;
    assert.ok(text.includes('registered in the knowledge bank automatically: project `fresh2`, domain `tooling`'), text.slice(0, 300));
    assert.ok(existsSync(path.join(d, '.kb.json')));
  } finally { process.env.HOME = prev; }
});
