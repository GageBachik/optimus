import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { loadProjectConfig } from './project.js';
import { log } from '../lib/log.js';

export type AutoRegistered = { file: string; project_id: string; domain: string; confidence: 'high' | 'low'; reason: string };
export type Settled = { file: string; project_id: string; domain: string; previous: string; reason: string };
/** Words that point at a domain, used for the folder name at registration and for the first prompts afterwards. */
const LEXICON: Record<string, string[]> = {
  trading: ['trade', 'trading', 'trader', 'momentum', 'crypto', 'options', '0dte', 'backtest', 'backtests', 'backtesting', 'quant', 'strategy', 'strategies', 'perp', 'perps', 'futures', 'alpha', 'signal', 'signals', 'sniper', 'arb', 'arbitrage', 'orderbook', 'portfolio', 'sharpe', 'drawdown', 'broker', 'exchange', 'binance', 'bybit', 'hyperliquid', 'coinbase', 'spy', 'spx', 'btc', 'eth', 'ohlc', 'candles', 'pnl', 'leaps', 'iron', 'condor', 'straddle'],
  solana: ['solana', 'sol', 'anchor', 'spl', 'nft', 'nfts', 'mint', 'minter', 'candy', 'token', 'tokens', 'pump', 'raydium', 'jupiter', 'dex', 'amm', 'stake', 'staking', 'airdrop', 'wallet', 'program', 'programs', 'pda', 'lamports', 'devnet', 'metaplex', 'pinocchio', 'surfpool'],
  'gen-l1': ['gen', 'genie', 'gen-l1', 'clob', 'genibook', 'geniswap', 'activation', 'activations', 'gvm'],
  ios: ['ios', 'swift', 'swiftui', 'iphone', 'ipad', 'macos', 'xcode', 'testflight', 'watchos', 'flutter', 'appstore'],
  tooling: ['cli', 'tool', 'tools', 'plugin', 'plugins', 'agent', 'agents', 'mcp', 'script', 'scripts', 'memory', 'docs', 'site', 'website', 'server', 'api', 'pipeline', 'hook', 'hooks', 'extension', 'dashboard', 'scraper', 'skill', 'skills'],
};
export function scoreDomains(text: string): Record<string, number> {
  const tokens = text.toLowerCase().split(/[^a-z0-9-]+/).filter(Boolean), score: Record<string, number> = {};
  for (const [domain, words] of Object.entries(LEXICON)) { const set = new Set(words); let n = 0; const seen: Record<string, number> = {}; for (const t of tokens) if (set.has(t) && (seen[t] = (seen[t] ?? 0) + 1) <= 3) n++; score[domain] = n; }
  return score;
}
/** The domain a text points at: the top score must reach minScore and lead the runner-up by margin (tooling words are generic, so it needs one more). */
export function domainFromText(text: string, minScore: number, margin = 1): { domain: string; score: number; reason: string } | null {
  const ranked = Object.entries(scoreDomains(text)).sort((a, b) => b[1] - a[1]);
  const [top, second] = ranked; if (!top) return null;
  const need = top[0] === 'tooling' ? minScore + 1 : minScore;
  if (top[1] < need || top[1] - (second?.[1] ?? 0) < margin) return null;
  const words = [...new Set(text.toLowerCase().split(/[^a-z0-9-]+/).filter((t) => LEXICON[top[0]].includes(t)))].slice(0, 4);
  return { domain: top[0], score: top[1], reason: words.join(', ') };
}
const SKIP_DIRS = new Set(['node_modules', '.git', 'target', 'dist', 'build', '.next', 'vendor', 'Pods']);
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
export function inferDomain(cwd: string): { domain: string; confidence: 'high' | 'low'; reason: string } {
  const files = listing(cwd), names = files.map((f) => f.toLowerCase()), has = (re: RegExp) => names.some((n) => re.test(n));
  const pkg = read(path.join(cwd, 'package.json')), cargo = read(path.join(cwd, 'Cargo.toml')), py = read(path.join(cwd, 'pyproject.toml')) + read(path.join(cwd, 'requirements.txt'));
  if (has(/\.xcodeproj\/$|\.xcworkspace\/$|^package\.swift$|^pubspec\.yaml$|\.swift$/)) return { domain: 'ios', confidence: 'high', reason: 'Swift, Xcode or Flutter files' };
  if (/"@gen\//.test(pkg) || /\bgenie\b|\bgen-sdk\b/.test(cargo) || has(/^gen\.toml$|^genie\.toml$/)) return { domain: 'gen-l1', confidence: 'high', reason: 'Gen SDK or genie crate' };
  if (has(/^anchor\.toml$|^programs\/$|^surfpool\.yaml$|^txtx\.yml$/) || /@solana\/|@coral-xyz\/anchor|@metaplex|@raydium|@jup-ag|@pinocchio/.test(pkg) || /solana-program|anchor-lang|pinocchio|spl-token/.test(cargo)) return { domain: 'solana', confidence: 'high', reason: 'Solana program or SDK dependencies' };
  if (has(/^backtests?\/$|^strategies\/$|^signals\/$|^backtest\.py$/) || /databento|ib_insync|ibapi|alpaca|thetadata|ccxt|backtrader|vectorbt|yfinance|polygon|quantstats|zipline|schwab|tastytrade|tradingview/.test(py + pkg)) return { domain: 'trading', confidence: 'high', reason: 'market-data or broker dependencies' };
  const byName = domainFromText(path.basename(cwd).replace(/[-_.]+/g, ' '), 1);
  if (byName) return { domain: byName.domain, confidence: 'low', reason: `folder name suggests ${byName.domain} (${byName.reason})` };
  return { domain: 'tooling', confidence: 'low', reason: files.length ? 'no chain, mobile or market signals' : 'empty folder' };
}

/** The first prompts settle a guessed domain: while `.kb.json` still carries an automatic low or medium confidence, a prompt that clearly
 *  points at another domain (three lexicon hits, two clear of the runner-up) rewrites it before the brief is built, so the first brief
 *  already draws on the right bank. A domain set by hand (`kb project init`, or confidence "high") is never touched. */
export function settleFromPrompt(cwd: string, prompt: string): Settled | null {
  let dir = path.resolve(cwd), file = '';
  for (let i = 0; i < 8; i++) { const f = path.join(dir, '.kb.json'); if (existsSync(f)) { file = f; break; } const up = path.dirname(dir); if (up === dir) break; dir = up; }
  if (!file) return null;
  let cfg: { project_id?: string; domain?: string; auto?: { confidence?: string; reason?: string; registered?: string } };
  try { cfg = JSON.parse(readFileSync(file, 'utf8')); } catch { return null; }
  if (!cfg.auto || cfg.auto.confidence === 'high' || !cfg.domain) return null;
  const guess = domainFromText(prompt, 3, 2); if (!guess) return null;
  const previous = cfg.domain;
  if (guess.domain === previous) { if (cfg.auto.confidence === 'low') { cfg.auto = { ...cfg.auto, confidence: 'medium', reason: `confirmed by a prompt (${guess.reason})` }; writeFileSync(file, JSON.stringify(cfg, null, 2) + '\n'); } return null; }
  cfg.domain = guess.domain; cfg.auto = { ...cfg.auto, confidence: 'medium', reason: `a prompt mentions ${guess.reason}` };
  writeFileSync(file, JSON.stringify(cfg, null, 2) + '\n');
  log('info', 'domain settled from prompt', { file, previous, domain: guess.domain, reason: guess.reason });
  return { file, project_id: String(cfg.project_id ?? ''), domain: guess.domain, previous, reason: guess.reason };
}
export const settledLine = (s: Settled) => `Project domain changed from \`${s.previous}\` to \`${s.domain}\` because this prompt mentions ${s.reason}; the brief below is for ${s.domain}. Say "this is a <domain> project" to override.`;

/** A git root, a folder with a manifest, or a fresh folder with a handful of entries — but not a folder of repositories. */
export function looksLikeProject(cwd: string): boolean {
  let entries: string[] = []; try { entries = readdirSync(cwd); } catch { return false; }
  const repos = entries.filter((e) => existsSync(path.join(cwd, e, '.git'))).length;
  if (repos >= 2) return false;
  return existsSync(path.join(cwd, '.git')) || MANIFESTS.some((m) => existsSync(path.join(cwd, m))) || entries.some((e) => e.endsWith('.xcodeproj')) || entries.length <= 8;
}

/** DESIGN §4.5 (v1.4): a session started in an unregistered project folder registers it, so nobody runs `kb project init` by hand. Only under the
 *  home directory, never at the home or workspace roots or inside hidden folders, never when a `.kb.json` already exists here or above. */
export function autoRegister(cwd: string, home = os.homedir()): AutoRegistered | null {
  if (!cwd) return null;
  const dir = path.resolve(cwd);
  if (!existsSync(dir) || !dir.startsWith(home + path.sep)) return null;
  const rel = path.relative(home, dir);
  if (rel.split(path.sep).some((s) => s.startsWith('.') || SKIP_DIRS.has(s))) return null;
  if (['projects', 'Desktop', 'Documents', 'Downloads', 'src', 'code', 'work', 'github'].includes(rel)) return null; // workspace roots hold projects; they are not one
  if (loadProjectConfig(dir)) return null;
  if (!looksLikeProject(dir)) return null;
  const { domain, confidence, reason } = inferDomain(dir);
  const project_id = path.basename(dir).toLowerCase().replace(/[^a-z0-9._-]+/g, '-');
  const file = path.join(dir, '.kb.json');
  writeFileSync(file, JSON.stringify({ project_id, domain, auto: { registered: new Date().toISOString().slice(0, 10), confidence, reason } }, null, 2) + '\n');
  log('info', 'auto-registered project', { file, domain, confidence, reason });
  return { file, project_id, domain, confidence, reason };
}

export const autoLine = (a: AutoRegistered) => `This folder was registered in the knowledge bank automatically: project \`${a.project_id}\`, domain \`${a.domain}\` (${a.confidence} confidence: ${a.reason}).${a.confidence === 'low' ? ' If the work turns out to be trading, solana, gen-l1 or ios, run `kb project init --domain <d>` here and say so.' : ''} The file is \`.kb.json\`; commit it when you commit.`;
