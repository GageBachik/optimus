import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, existsSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
process.env.PROJECT_MEMORY_HOME = mkdtempSync(path.join(tmpdir(), 'pm-')); process.env.PROJECT_MEMORY_BANK = mkdtempSync(path.join(tmpdir(), 'bank-'));
const { autoRegister, inferDomain, settleFromPrompt, domainFromText } = await import('../../src/kb/auto-register.js');
const { userPrompt } = await import('../../src/hooks/user-prompt.js');
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

test('auto-register: the folder name is a hint when the files say nothing', () => {
  const a = autoRegister(mk('projects/crypto-momentum'), home)!;
  assert.equal(a.domain, 'trading'); assert.equal(a.confidence, 'low'); assert.match(a.reason, /folder name suggests trading/);
  assert.equal(autoRegister(mk('projects/nft-minter-v2'), home)!.domain, 'solana');
  assert.equal(autoRegister(mk('projects/notes'), home)!.domain, 'tooling');
});

test('domainFromText: needs clear evidence, tooling needs more, ties resolve to nothing', () => {
  assert.equal(domainFromText('research, develop and trade a crypto momentum strategy; backtest it first', 3, 2)!.domain, 'trading');
  assert.equal(domainFromText('build a cli tool with hooks and a plugin', 3, 2)!.domain, 'tooling');
  assert.equal(domainFromText('hello, what should we do today?', 3, 2), null);
  assert.equal(domainFromText('an anchor program that trades perps on a solana dex with momentum signals', 3, 2), null, 'solana and trading tie');
});

test('the first prompt settles a guessed domain, confirms a right guess, and never touches a hand-set one', async () => {
  const d = mk('projects/mystery'); autoRegister(d, home);
  assert.equal(JSON.parse(readFileSync(path.join(d, '.kb.json'), 'utf8')).domain, 'tooling');
  const prev = process.env.HOME; process.env.HOME = home;
  try {
    const r = (await userPrompt({ hook_event_name: 'UserPromptSubmit', session_id: 's2', cwd: d, prompt: 'Today I want to research, develop and get ready to trade a crypto momentum strategy with a proper backtest' } as any)) as any;
    const cfg = JSON.parse(readFileSync(path.join(d, '.kb.json'), 'utf8'));
    assert.equal(cfg.domain, 'trading'); assert.equal(cfg.auto.confidence, 'medium');
    assert.ok(r.hookSpecificOutput.additionalContext.startsWith('Project domain changed from `tooling` to `trading`'), r.hookSpecificOutput.additionalContext.slice(0, 120));
    assert.equal(settleFromPrompt(d, 'what time is it'), null, 'no signal, no change');
    assert.equal(settleFromPrompt(d, 'more momentum backtests on crypto perps with sharpe and drawdown'), null, 'same domain: confirmed, not changed');
    writeFileSync(path.join(d, '.kb.json'), JSON.stringify({ project_id: 'mystery', domain: 'ios' }));
    assert.equal(settleFromPrompt(d, 'trade crypto momentum strategy backtest sharpe'), null, 'hand-set file is never touched');
    assert.equal(JSON.parse(readFileSync(path.join(d, '.kb.json'), 'utf8')).domain, 'ios');
  } finally { process.env.HOME = prev; }
});

test('v1.5: the lexicon comes from the templates in the index, so a new template is a domain the first prompt can settle to', async () => {
  const { loadLexicon, knownDomains, DEFAULT_LEXICON, needsDecision, fileHereUnder } = await import('../../src/kb/auto-register.js');
  const { openDb } = await import('../../src/kb/db.js');
  const { installTemplate, templateFor } = await import('../../src/kb/templates.js');
  const { loadTemplate } = await import('../../src/kb/templates-yaml.js');
  const db = openDb();
  assert.deepEqual(loadLexicon(db), DEFAULT_LEXICON, 'no templates installed: the built-in words');
  installTemplate(db, loadTemplate('templates/tooling.yaml'));
  installTemplate(db, { domain: 'console', facets: ['engine', 'sdk', 'input', 'distribution'], methods: ['prototype'], gates: ['devkit', 'testkit', 'cert', 'store-live'], environment: 'platform', subject: 'title', seed_concepts: [], keywords: ['ps4', 'PS5', 'playstation', 'xbox', 'devkit', 'unreal engine', 'node.js'] });
  const lex = loadLexicon(db);
  assert.deepEqual(knownDomains(lex), ['console', 'tooling'], 'tooling sorts last');
  assert.deepEqual(templateFor(db, 'console')!.keywords, ['ps4', 'ps5', 'playstation', 'xbox', 'devkit', 'unreal', 'engine'], 'keywords are single lowercase tokens; node.js can never match and is dropped');
  assert.ok(lex.tooling.includes('plugin'), 'tooling.yaml carries its keywords');
  assert.equal(domainFromText('a ps4 title built on unreal for the devkit', 3, 2, lex)!.domain, 'console');
  // a registered empty folder; a substantive prompt about a kind of work no domain knows
  const d = mk('projects/track-smack'); autoRegister(d, home, lex);
  const prompt = 'Build me a PlayStation 4 game for the ps4 devkit where you smack a running track with a hammer and the crowd cheers every lap';
  assert.equal(settleFromPrompt(d, prompt, { tooling: lex.tooling }), null, 'without the console template nothing settles');
  assert.equal(needsDecision(d, 'fix the bug', { tooling: lex.tooling }), null, 'a short prompt asks nothing');
  const dec = needsDecision(d, prompt + ' and ship it as a cli tool', { tooling: lex.tooling })!; // one generic lexicon word does not block the decision
  assert.equal(dec.domain, 'tooling'); assert.deepEqual(dec.known, ['tooling']);
  assert.equal(needsDecision(d, prompt, { tooling: lex.tooling }), null, 'asked once per folder, whatever the session');
  assert.equal(JSON.parse(readFileSync(path.join(d, '.kb.json'), 'utf8')).auto.decided.length, 10, 'the mark lives in .kb.json');
  // with the template installed the same prompt settles the folder to console on its own; the decision mark does not stop a settle
  const s = settleFromPrompt(d, prompt, lex)!; assert.equal(s.domain, 'console'); assert.equal(s.previous, 'tooling');
  assert.equal(needsDecision(d, prompt, lex), null, 'settled to medium: nothing to decide');
  // kb domain new files the folder by hand (confidence high), and a later prompt never moves it
  const f = fileHereUnder(d, 'console')!; assert.equal(f.project_id, 'track-smack');
  const cfg = JSON.parse(readFileSync(path.join(d, '.kb.json'), 'utf8')); assert.equal(cfg.domain, 'console'); assert.equal(cfg.auto.confidence, 'high');
  assert.equal(settleFromPrompt(d, 'a swift ios iphone app in xcode', lex), null);
  assert.equal(fileHereUnder(d, 'ios'), null, 'a hand-set folder is never re-filed');
  const high = mk('projects/swifty', { 'App.swift': 'import SwiftUI' }); autoRegister(high, home, lex);
  assert.equal(needsDecision(high, prompt, lex), null, 'a folder registered at high confidence is never asked');
  db.sql.close();
});

test('v1.5: the prompt hook asks for the domain decision once per folder, in whatever session, and a settle still wins', async () => {
  const { openDb } = await import('../../src/kb/db.js'); const { installTemplate } = await import('../../src/kb/templates.js'); const { loadTemplate } = await import('../../src/kb/templates-yaml.js');
  { const db = openDb(); installTemplate(db, loadTemplate('templates/ios.yaml')); db.sql.close(); } // the bank now knows tooling, console and ios
  const d = mk('projects/smack-two'); autoRegister(d, home);
  const prompt = 'Build me a board game night planner for my family where everyone votes on snacks and the winner picks the movie we watch';
  const r1: any = await userPrompt({ session_id: 'dec1', cwd: d, prompt });
  const t1 = r1.hookSpecificOutput.additionalContext; assert.match(t1, /^This folder was filed under `tooling` by a guess/); assert.match(t1, /node \S+\/dist\/kb\.js domain new <name> --facets/);
  assert.match(t1, /If it is one of console, ios, run/, 'the known domains come from the bank, tooling excluded');
  const r2: any = await userPrompt({ session_id: 'dec2', cwd: d, prompt: prompt + ' please' }); // a NEW session: still not asked again
  assert.ok(!r2 || !/filed under `tooling` by a guess/.test(r2.hookSpecificOutput.additionalContext), 'once per folder');
  const r3: any = await userPrompt({ session_id: 'dec2', cwd: d, prompt: 'make it a swift ios iphone app in xcode instead' });
  assert.match(r3.hookSpecificOutput.additionalContext, /^Project domain changed from `tooling` to `ios`/);
  const r4: any = await userPrompt({ session_id: 'dec3', cwd: path.join(d, 'nowhere-registered-' + Date.now()), prompt });
  assert.equal(r4, undefined, 'no .kb.json at or above: nothing, and the bank is not opened');
});
