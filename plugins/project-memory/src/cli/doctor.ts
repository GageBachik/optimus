import { existsSync, readFileSync, readdirSync, statSync, writeFileSync, unlinkSync } from 'node:fs';
import { createRequire as requireFrom } from 'node:module'; // aliased: the esbuild banner already declares createRequire
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { paths } from '../lib/paths.js';
import { computeBaseline } from './baseline.js';
export type Check = { status: 'PASS' | 'WARN' | 'FAIL' | 'INFO'; name: string; detail: string };
const readJsonFile = (f: string): any => { try { return JSON.parse(readFileSync(f, 'utf8')); } catch { return null; } };
/** DESIGN §7 hard check: node:sqlite creates an FTS5 table. Its ExperimentalWarning is swallowed for the probe only. */
function fts5Probe(): Check {
  const emit = process.emitWarning;
  process.emitWarning = ((w: string | Error, ...rest: any[]) => { const type = typeof rest[0] === 'string' ? rest[0] : rest[0]?.type; if (type === 'ExperimentalWarning') return; return (emit as any).call(process, w, ...rest); }) as typeof process.emitWarning;
  try { const { DatabaseSync } = requireFrom(import.meta.url)('node:sqlite'); const db = new DatabaseSync(':memory:'); db.exec('CREATE VIRTUAL TABLE t USING fts5(x)'); db.close(); return { status: 'PASS', name: 'sqlite-fts5', detail: 'node:sqlite creates an FTS5 table' }; }
  catch (e: any) { return { status: 'FAIL', name: 'sqlite-fts5', detail: `node:sqlite FTS5 probe failed: ${e?.message ?? e}` }; }
  finally { process.emitWarning = emit; }
}
/** Installed plugins as `{ name, installPath }` from `~/.claude/plugins/installed_plugins.json` (version 2: `plugins: { name: [{ installPath }] }`). */
function installedPlugins(home: string): { name: string; installPath: string }[] {
  const j = readJsonFile(path.join(home, '.claude', 'plugins', 'installed_plugins.json'));
  return Object.entries<any>(j?.plugins ?? {}).flatMap(([name, entries]) => (Array.isArray(entries) ? entries : []).filter((e) => typeof e?.installPath === 'string').map((e) => ({ name, installPath: e.installPath as string })));
}
const matchesAgent = (matcher: unknown) => { if (matcher === undefined || matcher === '' || matcher === '*') return true; try { return new RegExp(`^(?:${matcher})$`).test('Agent'); } catch { return matcher === 'Agent'; } };
export function doctorChecks(home: string): Check[] {
  const out: Check[] = [];
  out.push({ status: 'INFO', name: 'node', detail: `${process.version} (>= 24.15 recommended)` });
  out.push(fts5Probe());
  const git = spawnSync('git', ['--version'], { encoding: 'utf8' });
  out.push(git.status === 0 ? { status: 'PASS', name: 'git', detail: git.stdout.trim() } : { status: 'FAIL', name: 'git', detail: 'git not found on PATH' });
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
  out.push(live ? { status: 'PASS', name: 'hooks', detail: `${live.name} hooks present in ${live.installPath}` } : { status: 'WARN', name: 'hooks', detail: ours.length ? `${ours[0].name} installed but not enabled or its cache lacks hooks/hooks.json + dist/hook.js` : 'project-memory plugin not installed in the plugin cache' });
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
export function doctor(home: string, opts: { baseline?: boolean } = {}): number {
  const checks = doctorChecks(home);
  for (const c of checks) process.stdout.write(`${c.status.padEnd(4)}  ${c.name.padEnd(18)} ${c.detail}\n`);
  if (opts.baseline) {
    const dir = path.join(home, '.claude', 'projects');
    if (!existsSync(dir)) process.stdout.write(`\nbaseline: ${dir} not found\n`);
    else { const b = computeBaseline(dir); const k = (n: number) => `${Math.round(n / 1000)}K`;
      process.stdout.write(`\nbaseline (${dir})\n  sessions        ${b.sessions}\n  turns           ${b.turns}\n  context p50     ${k(b.p50)}\n  context p90     ${k(b.p90)}\n  context p99     ${k(b.p99)}\n  context max     ${k(b.max)}\n  compactions     ${b.compactions}\n  cache-read share ${(b.cacheReadShare * 100).toFixed(1)}%\n`); }
  }
  return checks.some((c) => c.status === 'FAIL') ? 1 : 0;
}
