import { existsSync, readFileSync, readdirSync, statSync, writeFileSync, unlinkSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { paths } from '../lib/paths.js';
import { loadSqlite, openDb } from '../kb/db.js';
import { computeBaseline } from './baseline.js';
import { runLiveTest, type LiveResult } from './live-test.js';
export type Check = { status: 'PASS' | 'WARN' | 'FAIL' | 'INFO'; name: string; detail: string };
const readJsonFile = (f: string): any => { try { return JSON.parse(readFileSync(f, 'utf8')); } catch { return null; } };
/** DESIGN §7 hard check: node:sqlite creates an FTS5 table. */
function fts5Probe(): Check {
  try { const { DatabaseSync } = loadSqlite(); const db = new DatabaseSync(':memory:'); db.exec('CREATE VIRTUAL TABLE t USING fts5(x)'); db.close(); return { status: 'PASS', name: 'sqlite-fts5', detail: 'node:sqlite creates an FTS5 table' }; }
  catch (e: any) { return { status: 'FAIL', name: 'sqlite-fts5', detail: `node:sqlite FTS5 probe failed: ${e?.message ?? e}` }; }
}
/** Installed plugins as `{ name, installPath }` from `~/.claude/plugins/installed_plugins.json` (version 2: `plugins: { name: [{ installPath }] }`).
 *  installPath is the folder Claude Code runs the plugin from: for a `directory` marketplace that is the plugin's `source` inside the marketplace
 *  folder (CLAUDE_PLUGIN_ROOT points there; the cache copy is not refreshed), otherwise the recorded cache path. */
export function installedPlugins(home: string): { name: string; installPath: string }[] {
  const dir = path.join(home, '.claude', 'plugins'), j = readJsonFile(path.join(dir, 'installed_plugins.json')), markets = readJsonFile(path.join(dir, 'known_marketplaces.json')) ?? {};
  const runDir = (name: string, cached: string) => {
    const [plugin, market] = name.split('@'), m = markets[market];
    if (m?.source?.source !== 'directory') return cached;
    const root = m.installLocation ?? m.source.path, src = readJsonFile(path.join(root, '.claude-plugin', 'marketplace.json'))?.plugins?.find((p: any) => p?.name === plugin)?.source;
    return typeof src === 'string' ? path.resolve(root, src) : cached;
  };
  return Object.entries<any>(j?.plugins ?? {}).flatMap(([name, entries]) => (Array.isArray(entries) ? entries : []).filter((e) => typeof e?.installPath === 'string').map((e) => ({ name, installPath: runDir(name, e.installPath) })));
}
/** DESIGN §7: bank repo present, clean/dirty, ahead/behind, remote reachable (`git ls-remote`, 10 s). */
function bankChecks(): Check[] {
  const bank = paths.bankDir();
  if (!existsSync(path.join(bank, '.git'))) return [{ status: 'WARN', name: 'bank', detail: `${bank} is not a git repository (run \`kb init\`)` }];
  const g = (args: string[], timeout = 60_000) => spawnSync('git', args, { cwd: bank, encoding: 'utf8', timeout });
  const dirty = g(['status', '--porcelain']).stdout.trim() ? 'dirty' : 'clean';
  const ab = g(['rev-list', '--left-right', '--count', 'HEAD...@{upstream}']); const [ahead, behind] = ab.stdout.trim().split(/\s+/);
  const out: Check[] = [{ status: 'PASS', name: 'bank', detail: `${bank}: ${dirty}, ${ab.status === 0 ? `ahead ${ahead} behind ${behind}` : 'no upstream yet'}` }];
  const remote = g(['remote']).stdout.split('\n')[0].trim();
  if (!remote) out.push({ status: 'INFO', name: 'bank-remote', detail: 'no remote configured; kb sync stops at no-remote' });
  else { const ls = g(['ls-remote', '-q', remote], 10_000); out.push(ls.status === 0 ? { status: 'PASS', name: 'bank-remote', detail: `${remote} reachable (${g(['remote', 'get-url', remote]).stdout.trim()})` } : { status: 'WARN', name: 'bank-remote', detail: `${remote} unreachable: ${(ls.error?.message || ls.stderr || `exit ${ls.status}`).trim()}` }); }
  return out;
}
/** DESIGN §7: kb.sqlite size and row counts per kind, pending merges, last sync result and time. */
function indexChecks(): Check[] {
  const file = path.join(paths.stateDir(), 'kb.sqlite'), at = paths.config().lastSyncAt ?? 'unknown time';
  if (!existsSync(file)) return [{ status: 'INFO', name: 'index', detail: 'no kb.sqlite yet (kb init builds it)' }, { status: 'INFO', name: 'last-sync', detail: 'never' }];
  let db; try { db = openDb(file); } catch (e: any) { return [{ status: 'FAIL', name: 'index', detail: `${file}: ${e?.message ?? e}` }]; }
  try {
    const counts = (db.sql.prepare('SELECT kind, COUNT(*) AS n FROM note WHERE deleted_at IS NULL GROUP BY kind ORDER BY kind').all() as { kind: string; n: number }[]).map((r) => `${r.kind} ${r.n}`).join(', ') || 'no notes';
    const pending = (db.sql.prepare('SELECT COUNT(*) AS n FROM pending_merge WHERE resolved IS NULL').get() as { n: number }).n;
    const result = (db.sql.prepare("SELECT value FROM meta WHERE key='lastSyncResult'").get() as { value: string } | undefined)?.value;
    return [
      { status: 'INFO', name: 'index', detail: `${file} ${(statSync(file).size / 1048576).toFixed(1)} MB: ${counts}` },
      { status: 'INFO', name: 'pending-merges', detail: pending ? `${pending} awaiting review (kb concepts review)` : 'none' },
      !result ? { status: 'INFO', name: 'last-sync', detail: 'never' }
        : { status: result.startsWith('failed') ? 'WARN' : result === 'ok' ? 'PASS' : 'INFO', name: 'last-sync', detail: `${result} at ${at}${result.includes('rebase conflict') ? ` — resolve with git in ${paths.bankDir()}, then kb sync` : ''}` },
    ];
  } finally { db.sql.close(); }
}
const matchesAgent = (matcher: unknown) => { if (matcher === undefined || matcher === '' || matcher === '*') return true; try { return new RegExp(`^(?:${matcher})$`).test('Agent'); } catch { return matcher === 'Agent'; } };
export function doctorChecks(home: string): Check[] {
  const out: Check[] = [];
  out.push({ status: 'INFO', name: 'node', detail: `${process.version} (>= 24.15 recommended)` });
  out.push(fts5Probe());
  const git = spawnSync('git', ['--version'], { encoding: 'utf8' });
  out.push(git.status === 0 ? { status: 'PASS', name: 'git', detail: git.stdout.trim() } : { status: 'FAIL', name: 'git', detail: 'git not found on PATH' });
  out.push(...bankChecks(), ...indexChecks());
  const state = paths.stateDir();
  try { const probe = path.join(state, `.doctor-${process.pid}`); writeFileSync(probe, 'ok'); unlinkSync(probe); out.push({ status: 'PASS', name: 'state-dir', detail: `${state} writable` }); }
  catch (e: any) { out.push({ status: 'FAIL', name: 'state-dir', detail: `${state} not writable: ${e?.message ?? e}` }); }
  const blobs = readdirSync(paths.blobsDir()).filter((f) => f.length === 64).map((f) => statSync(path.join(paths.blobsDir(), f)));
  const bytes = blobs.reduce((n, s) => n + s.size, 0); const oldest = blobs.length ? new Date(Math.min(...blobs.map((s) => s.mtimeMs))).toISOString() : 'none';
  out.push({ status: 'INFO', name: 'blobs', detail: `${blobs.length} blobs, ${(bytes / 1048576).toFixed(1)} MB, oldest ${oldest}` });
  const sessionsDir = path.join(state, 'sessions');
  out.push({ status: 'INFO', name: 'sessions', detail: `${existsSync(sessionsDir) ? readdirSync(sessionsDir).length : 0} session dirs` });
  const settings = readJsonFile(path.join(home, '.claude', 'settings.json')) ?? {};
  out.push(settings.autoCompactWindow === 200000 ? { status: 'PASS', name: 'autoCompactWindow', detail: '200000' } : { status: 'WARN', name: 'autoCompactWindow', detail: `${settings.autoCompactWindow ?? 'unset'} (run \`kb setup\` to set 200000)` });
  const enabled: Record<string, boolean> = settings.enabledPlugins ?? {}; const installed = installedPlugins(home);
  const ours = installed.filter((p) => p.name.startsWith('project-memory@'));
  const live = ours.find((p) => enabled[p.name] && existsSync(path.join(p.installPath, 'hooks', 'hooks.json')) && existsSync(path.join(p.installPath, 'dist', 'hook.js')));
  out.push(live ? { status: 'PASS', name: 'hooks', detail: `${live.name} hooks present in ${live.installPath}` } : { status: 'WARN', name: 'hooks', detail: ours.length ? `${ours[0].name} installed but not enabled or ${ours[0].installPath} lacks hooks/hooks.json + dist/hook.js` : 'project-memory plugin not installed in the plugin cache' });
  const collisions: string[] = [];
  for (const p of installed) {
    if (!enabled[p.name] || p.name.startsWith('project-memory@')) continue;
    const hooks = readJsonFile(path.join(p.installPath, 'hooks', 'hooks.json'))?.hooks ?? {};
    if ((hooks.PreToolUse ?? []).some((e: any) => matchesAgent(e?.matcher))) collisions.push(`${p.name}: PreToolUse matcher covers Agent`);
    if ((hooks.SubagentStart ?? []).length) collisions.push(`${p.name}: SubagentStart hook`);
  }
  if (collisions.length) for (const c of collisions) out.push({ status: 'WARN', name: 'collision', detail: c });
  else out.push({ status: 'PASS', name: 'collision', detail: 'no other enabled plugin hooks PreToolUse Agent or SubagentStart' });
  return out;
}
/** DESIGN §7 `--live`: PASS/FAIL per behaviour the plugin depends on, measured on this machine. */
function liveChecks(r: LiveResult): Check[] {
  const pf = (ok: boolean, name: string, pass: string, fail: string): Check => ({ status: ok ? 'PASS' : 'FAIL', name, detail: ok ? pass : fail });
  return [
    pf(r.postToolUseReplaced, 'live:offload', 'PostToolUse replaced the 24K-char `seq 1 5000` output with the head+tail placeholder', 'placeholder not found in the Bash tool result (see log)'),
    pf(r.subagentBriefSeen, 'live:subagent', 'subagent echoed the pointer brief (recall(id))', 'subagent reply did not carry recall(id) (see log)'),
    pf(r.capTruncates, 'live:10k-cap', '12,000-char SessionStart brief: head marker seen, tail marker lost; fit-by-measure stays mandatory', 'cap behaviour differs from DESIGN §1 rule 5 (see log)'),
    !r.auditWritten ? { status: 'FAIL', name: 'live:audit', detail: 'PostCompact did not write audit.json after the forced /compact (see log)' }
      : r.auditBeforeRestore ? { status: 'PASS', name: 'live:audit-order', detail: 'forced /compact: PostCompact wrote audit.json before SessionStart(compact), so omissions reach the restore brief' }
      : { status: 'INFO', name: 'live:audit-order', detail: 'forced /compact: SessionStart(compact) fired before PostCompact on this Claude Code, so the restore brief is built from task-state.json alone (DESIGN §3.5 fallback); audit.json was written afterwards' },
    { status: 'INFO', name: 'live:wall', detail: `${(r.wallMs / 1000).toFixed(1)} s for two headless claude-haiku-5-5 runs` },
  ];
}
export function doctor(home: string, opts: { baseline?: boolean; live?: boolean } = {}): number {
  const checks = doctorChecks(home);
  const print = (c: Check) => process.stdout.write(`${c.status.padEnd(4)}  ${c.name.padEnd(18)} ${c.detail}\n`);
  for (const c of checks) print(c);
  if (opts.live) {
    const v = spawnSync('claude', ['--version'], { encoding: 'utf8' });
    process.stdout.write(`\nlive marker test (two headless runs, about two minutes)...\n`);
    const r = runLiveTest(); const live = liveChecks(r); checks.push(...live);
    print({ status: 'INFO', name: 'live:claude', detail: v.status === 0 ? v.stdout.trim() : 'claude not found on PATH' });
    for (const c of live) print(c);
    process.stdout.write(`${live.some((c) => c.status === 'FAIL') ? r.log : r.log.split('\n')[0]}\n`);
  }
  if (opts.baseline) {
    const dir = path.join(home, '.claude', 'projects');
    if (!existsSync(dir)) process.stdout.write(`\nbaseline: ${dir} not found\n`);
    else { const b = computeBaseline(dir); const k = (n: number) => `${Math.round(n / 1000)}K`;
      process.stdout.write(`\nbaseline (${dir})\n  sessions        ${b.sessions}\n  turns           ${b.turns}\n  context p50     ${k(b.p50)}\n  context p90     ${k(b.p90)}\n  context p99     ${k(b.p99)}\n  context max     ${k(b.max)}\n  compactions     ${b.compactions}\n  cache-read share ${(b.cacheReadShare * 100).toFixed(1)}%\n`); }
  }
  return checks.some((c) => c.status === 'FAIL') ? 1 : 0;
}
