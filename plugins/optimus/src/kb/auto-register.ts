import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { loadProjectConfig } from './project.js';
import { type Db } from './db.js';
import { installedDomains, templateFor } from './templates.js';
import { log } from '../lib/log.js';
import { paths, canonical } from '../lib/paths.js';

export type AutoRegistered = { file: string; project_id: string; domain: string; confidence: 'high' | 'low'; reason: string };
export type Settled = { file: string; project_id: string; domain: string; previous: string; reason: string };
export type Lexicon = Record<string, string[]>;
/** Words that point at a domain, used for the folder name at registration and for the first prompts afterwards. v1.5: the built-in list is
 *  the fallback; the bank's templates carry their own `keywords`, so a new template is a new domain a session can settle to (DESIGN §4.5). */
export const DEFAULT_LEXICON: Lexicon = {
  trading: ['trade', 'trading', 'trader', 'momentum', 'crypto', 'options', '0dte', 'backtest', 'backtests', 'backtesting', 'quant', 'strategy', 'strategies', 'perp', 'perps', 'futures', 'alpha', 'signal', 'signals', 'sniper', 'arb', 'arbitrage', 'orderbook', 'portfolio', 'sharpe', 'drawdown', 'broker', 'exchange', 'binance', 'bybit', 'hyperliquid', 'coinbase', 'spy', 'spx', 'btc', 'eth', 'ohlc', 'candles', 'pnl', 'leaps', 'iron', 'condor', 'straddle'],
  solana: ['solana', 'sol', 'anchor', 'spl', 'nft', 'nfts', 'mint', 'minter', 'candy', 'token', 'tokens', 'pump', 'raydium', 'jupiter', 'dex', 'amm', 'stake', 'staking', 'airdrop', 'wallet', 'program', 'programs', 'pda', 'lamports', 'devnet', 'metaplex', 'pinocchio', 'surfpool'],
  'gen-l1': ['gen', 'genie', 'gen-l1', 'clob', 'genibook', 'geniswap', 'activation', 'activations', 'gvm'],
  ios: ['ios', 'swift', 'swiftui', 'iphone', 'ipad', 'macos', 'xcode', 'testflight', 'watchos', 'flutter', 'appstore'],
  tooling: ['cli', 'tool', 'tools', 'plugin', 'plugins', 'agent', 'agents', 'mcp', 'script', 'scripts', 'memory', 'docs', 'site', 'website', 'server', 'api', 'pipeline', 'hook', 'hooks', 'extension', 'dashboard', 'scraper', 'skill', 'skills'],
};
/** The lexicon the bank defines: every installed template's keywords, the built-in words for a template that has none. No templates: built-in. */
export function loadLexicon(db: Db): Lexicon {
  const domains = installedDomains(db); if (!domains.length) return DEFAULT_LEXICON;
  const lex: Lexicon = {};
  for (const d of domains) { const k = templateFor(db, d)?.keywords ?? []; lex[d] = k.length ? k : (DEFAULT_LEXICON[d] ?? []); }
  return lex;
}
export const knownDomains = (lex: Lexicon = DEFAULT_LEXICON) => Object.keys(lex).sort((a, b) => (a === 'tooling' ? 1 : b === 'tooling' ? -1 : a.localeCompare(b)));
const tokensOf = (text: string) => text.toLowerCase().split(/[^a-z0-9-]+/).filter(Boolean);
export function scoreDomains(text: string, lex: Lexicon = DEFAULT_LEXICON): Record<string, number> {
  const tokens = tokensOf(text), score: Record<string, number> = {};
  for (const [domain, words] of Object.entries(lex)) { const set = new Set(words); let n = 0; const seen: Record<string, number> = {}; for (const t of tokens) if (set.has(t) && (seen[t] = (seen[t] ?? 0) + 1) <= 3) n++; score[domain] = n; }
  return score;
}
/** The domain a text points at: the top score must reach minScore and lead the runner-up by margin (tooling words are generic, so it needs one more). */
export function domainFromText(text: string, minScore: number, margin = 1, lex: Lexicon = DEFAULT_LEXICON): { domain: string; score: number; reason: string } | null {
  const ranked = Object.entries(scoreDomains(text, lex)).sort((a, b) => b[1] - a[1]);
  const [top, second] = ranked; if (!top) return null;
  const need = top[0] === 'tooling' ? minScore + 1 : minScore;
  if (top[1] < need || top[1] - (second?.[1] ?? 0) < margin) return null;
  const words = [...new Set(tokensOf(text).filter((t) => lex[top[0]].includes(t)))].slice(0, 4);
  return { domain: top[0], score: top[1], reason: words.join(', ') };
}
/** The folders directly under the home that hold projects and are not one: never registered, and (2026-10-24) no project for an imported memory either. */
export const WORKSPACE_ROOTS = ['projects', 'Desktop', 'Documents', 'Downloads', 'src', 'code', 'work', 'github'];
const SKIP_DIRS = new Set(['node_modules', '.git', 'target', 'dist', 'build', '.next', 'vendor', 'Pods', 'AppData', 'Library']); // AppData, Library: the OS's hidden folders under the home (Windows %TEMP% lives there)
const MANIFESTS = ['package.json', 'Cargo.toml', 'pyproject.toml', 'requirements.txt', 'go.mod', 'Package.swift', 'pubspec.yaml', 'Anchor.toml'];
const read = (p: string) => { try { return readFileSync(p, 'utf8'); } catch { return ''; } };

/** Relative paths two levels deep, capped, skipping build and dependency folders. */
function listing(dir: string): string[] {
  const out: string[] = [];
  const walk = (d: string, rel: string, depth: number) => {
    let entries: import('node:fs').Dirent[] = []; try { entries = readdirSync(d, { withFileTypes: true }); } catch { return; }
    for (const e of entries) { if (out.length >= 400) return; const r = rel ? `${rel}/${e.name}` : e.name; out.push(e.isDirectory() ? `${r}/` : r); if (e.isDirectory() && depth < 2 && !SKIP_DIRS.has(e.name) && !e.name.startsWith('.')) walk(path.join(d, e.name), r, depth + 1); }
  };
  walk(dir, '', 1); return out;
}

/** Cheap local signals only: files and dependency names. Defaults to tooling with low confidence; the brief then asks the session to correct it. */
export function inferDomain(cwd: string, lex: Lexicon = DEFAULT_LEXICON): { domain: string; confidence: 'high' | 'low'; reason: string } {
  const files = listing(cwd), names = files.map((f) => f.toLowerCase()), has = (re: RegExp) => names.some((n) => re.test(n));
  const pkg = read(path.join(cwd, 'package.json')), cargo = read(path.join(cwd, 'Cargo.toml')), py = read(path.join(cwd, 'pyproject.toml')) + read(path.join(cwd, 'requirements.txt'));
  if (has(/\.xcodeproj\/$|\.xcworkspace\/$|^package\.swift$|^pubspec\.yaml$|\.swift$/)) return { domain: 'ios', confidence: 'high', reason: 'Swift, Xcode or Flutter files' };
  if (/"@gen\//.test(pkg) || /\bgenie\b|\bgen-sdk\b/.test(cargo) || has(/^gen\.toml$|^genie\.toml$/)) return { domain: 'gen-l1', confidence: 'high', reason: 'Gen SDK or genie crate' };
  if (has(/^anchor\.toml$|^programs\/$|^surfpool\.yaml$|^txtx\.yml$/) || /@solana\/|@coral-xyz\/anchor|@metaplex|@raydium|@jup-ag|@pinocchio/.test(pkg) || /solana-program|anchor-lang|pinocchio|spl-token/.test(cargo)) return { domain: 'solana', confidence: 'high', reason: 'Solana program or SDK dependencies' };
  if (has(/^backtests?\/$|^strategies\/$|^signals\/$|^backtest\.py$/) || /databento|ib_insync|ibapi|alpaca|thetadata|ccxt|backtrader|vectorbt|yfinance|polygon|quantstats|zipline|schwab|tastytrade|tradingview/.test(py + pkg)) return { domain: 'trading', confidence: 'high', reason: 'market-data or broker dependencies' };
  const byName = domainFromText(path.basename(cwd).replace(/[-_.]+/g, ' '), 1, 1, lex);
  if (byName) return { domain: byName.domain, confidence: 'low', reason: `folder name suggests ${byName.domain} (${byName.reason})` };
  return { domain: 'tooling', confidence: 'low', reason: files.length ? 'no chain, mobile or market signals' : 'empty folder' };
}

/** The first prompts settle a guessed domain: while `.kb.json` still carries an automatic low or medium confidence, a prompt that clearly
 *  points at another domain (three lexicon hits, two clear of the runner-up) rewrites it before the brief is built, so the first brief
 *  already draws on the right bank. A domain set by hand (`kb project init`, or confidence "high") is never touched. */
type AutoConfig = { project_id?: string; domain?: string; auto?: { confidence?: string; reason?: string; registered?: string; decided?: string } };
/** The nearest `.kb.json` at or above cwd, parsed; null when there is none or it is not JSON. */
function findConfig(cwd: string): { file: string; cfg: AutoConfig } | null {
  let dir = path.resolve(cwd), file = '';
  for (let i = 0; i < 8; i++) { const f = path.join(dir, '.kb.json'); if (existsSync(f)) { file = f; break; } const up = path.dirname(dir); if (up === dir) break; dir = up; }
  if (!file) return null;
  try { return { file, cfg: JSON.parse(readFileSync(file, 'utf8')) }; } catch { return null; }
}
export function settleFromPrompt(cwd: string, prompt: string, lex: Lexicon = DEFAULT_LEXICON): Settled | null {
  const found = findConfig(cwd); if (!found) return null; const { file, cfg } = found;
  // Only a LOW guess moves. A domain a prompt settled or confirmed (medium) is final: on 2026-10-20 an iOS game project settled to ios on
  // its first prompt and a later prompt about "agents, api, hook, memory" flipped it to tooling. Corrections are kb project init or kb domain new.
  if (!cfg.auto || cfg.auto.confidence !== 'low' || !cfg.domain) return null;
  const guess = domainFromText(prompt, 3, 2, lex); if (!guess) return null;
  const previous = cfg.domain;
  if (guess.domain === previous) { if (cfg.auto.confidence === 'low') { cfg.auto = { ...cfg.auto, confidence: 'medium', reason: `confirmed by a prompt (${guess.reason})` }; writeFileSync(file, JSON.stringify(cfg, null, 2) + '\n'); } return null; }
  cfg.domain = guess.domain; cfg.auto = { ...cfg.auto, confidence: 'medium', reason: `a prompt mentions ${guess.reason}` };
  writeFileSync(file, JSON.stringify(cfg, null, 2) + '\n');
  log('info', 'domain settled from prompt', { file, previous, domain: guess.domain, reason: guess.reason });
  return { file, project_id: String(cfg.project_id ?? ''), domain: guess.domain, previous, reason: guess.reason };
}
export const settledLine = (s: Settled) => `Project domain changed from \`${s.previous}\` to \`${s.domain}\` because this prompt mentions ${s.reason}; the brief below is for ${s.domain}. Say "this is a <domain> project" to override.`;

export type Decision = { file: string; project_id: string; domain: string; known: string[] };
const MIN_DECISION_WORDS = 12;
/** v1.5: a folder the plugin filed at low confidence gets one decision instruction, on the first substantive prompt that did not settle it,
 *  once per FOLDER: the mark lives in `.kb.json`, so a folder that really is tooling is never asked again in a later session. Keyword
 *  scores do not decide it — a prompt with one generic word, or none, both leave the guess unsettled, and the session's judgment beats a
 *  word count (review 2026-10-20: 7 of 12 ordinary first prompts score zero on every domain). */
export function needsDecision(cwd: string, prompt: string, lex: Lexicon = DEFAULT_LEXICON): Decision | null {
  const found = findConfig(cwd); if (!found) return null; const { file, cfg } = found;
  if (!cfg.auto || cfg.auto.confidence !== 'low' || !cfg.domain || cfg.auto.decided) return null;
  if (tokensOf(prompt).length < MIN_DECISION_WORDS) return null;
  cfg.auto = { ...cfg.auto, decided: new Date().toISOString().slice(0, 10) };
  writeFileSync(file, JSON.stringify(cfg, null, 2) + '\n');
  log('info', 'domain decision asked', { file, domain: cfg.domain });
  return { file, project_id: String(cfg.project_id ?? ''), domain: cfg.domain, known: knownDomains(lex) };
}
export const decisionLine = (d: Decision) => `This folder was filed under \`${d.domain}\` by a guess (low confidence) and this prompt did not settle it. Decide now from the prompt alone, and do not ask the user unless the work is plainly a new kind of project. (1) Ordinary software — scripts, sites, services, libraries, tools, docs — is \`tooling\`: leave it and say nothing. (2) If it is one of ${d.known.filter((k) => k !== 'tooling').join(', ')}, run \`${paths.kbCli()} project init --domain <d>\` here and say so; your next prompt's brief then carries that domain's findings, or call kb_brief({ project: "${d.project_id}" }) for them now. (3) Only if none of those describes the work (a console game, hardware, a research paper…), propose a domain to the user with one AskUserQuestion — a short lowercase name, 4–6 facets (the axes an approach varies on; single snake_case words), 4–6 gates (the stages evidence passes through, weakest first) and 5–10 single-word keywords a prompt about such work contains — and on a yes run from this folder: ${paths.kbCli()} domain new <name> --facets a,b,c --gates g1,g2,g3 --keywords w1,w2,w3 --environment <where it runs> --subject <what it acts on>. It writes the template into the bank, installs it and files this folder under it.`;

/** `kb domain new` run inside an auto-registered folder files that folder under the new domain, as a hand-set choice (confidence high). */
export function fileHereUnder(cwd: string, domain: string): { file: string; project_id: string } | null {
  const found = findConfig(cwd); if (!found) return null; const { file, cfg } = found;
  if (!cfg.auto || cfg.auto.confidence === 'high') return null;
  cfg.domain = domain; cfg.auto = { ...cfg.auto, confidence: 'high', reason: `domain ${domain} created here by kb domain new` };
  writeFileSync(file, JSON.stringify(cfg, null, 2) + '\n');
  log('info', 'domain settled by kb domain new', { file, domain });
  return { file, project_id: String(cfg.project_id ?? '') };
}

/** A git root, a folder with a manifest, or a fresh folder with a handful of entries — but not a folder of repositories. */
export function looksLikeProject(cwd: string): boolean {
  let entries: string[] = []; try { entries = readdirSync(cwd); } catch { return false; }
  const repos = entries.filter((e) => existsSync(path.join(cwd, e, '.git'))).length;
  if (repos >= 2) return false;
  return existsSync(path.join(cwd, '.git')) || MANIFESTS.some((m) => existsSync(path.join(cwd, m))) || entries.some((e) => e.endsWith('.xcodeproj')) || entries.length <= 8;
}

/** A `.kb.json` file here or in a parent (8 levels), whatever its content: a hand-written file with a typo is reported by loadProjectConfig, never replaced by a guess. */
const kbJsonAbove = (dir: string) => { let d = dir; for (let i = 0; i < 8; i++) { if (existsSync(path.join(d, '.kb.json'))) return true; const up = path.dirname(d); if (up === d) break; d = up; } return false; };
/** DESIGN §4.5 (v1.4): a session started in an unregistered project folder registers it, so nobody runs `kb project init` by hand. Only under the
 *  home directory, never at the home or workspace roots or inside hidden folders, never when a `.kb.json` already exists here or above. */
export function autoRegister(cwd: string, home = os.homedir(), lex: Lexicon = DEFAULT_LEXICON): AutoRegistered | null {
  if (!cwd) return null;
  const dir = canonical(cwd); // the on-disk spelling: an 8.3 cwd (what %TEMP% hands a process) is under the home too (audit 2026-10-24)
  if (!existsSync(dir)) return null;
  // path.relative, not a startsWith on the home string: on Windows a VS Code-hosted launch hands Claude Code `c:\Users\…` while the home is
  // `C:\Users\…`, and path.relative compares them case-insensitively. Home itself gives '', a folder outside it '..', another drive an absolute path.
  const rel = path.relative(canonical(home), dir);
  if (!rel || rel === '..' || rel.startsWith('..' + path.sep) || path.isAbsolute(rel)) return null;
  if (rel.split(path.sep).some((s) => s.startsWith('.') || SKIP_DIRS.has(s))) return null;
  if (WORKSPACE_ROOTS.includes(rel)) return null; // workspace roots hold projects; they are not one
  if (kbJsonAbove(dir)) return null;
  if (!looksLikeProject(dir)) return null;
  const { domain, confidence, reason } = inferDomain(dir, lex);
  const project_id = path.basename(dir).toLowerCase().replace(/[^a-z0-9._-]+/g, '-');
  const file = path.join(dir, '.kb.json');
  writeFileSync(file, JSON.stringify({ project_id, domain, auto: { registered: new Date().toISOString().slice(0, 10), confidence, reason } }, null, 2) + '\n');
  log('info', 'auto-registered project', { file, domain, confidence, reason });
  return { file, project_id, domain, confidence, reason };
}

export const autoLine = (a: AutoRegistered, known: string[] = knownDomains()) => `This folder was registered in the knowledge bank automatically: project \`${a.project_id}\`, domain \`${a.domain}\` (${a.confidence} confidence: ${a.reason}).${a.confidence === 'low' ? ` If the work turns out to be ${known.filter((d) => d !== a.domain).join(', ')}, run \`${paths.kbCli()} project init --domain <d>\` here and say so; the first prompt usually settles it on its own.` : ''} The file is \`.kb.json\`; commit it when you commit.`;
