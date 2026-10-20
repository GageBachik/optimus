import { existsSync, readFileSync, readdirSync, statSync, rmSync, mkdirSync, cpSync } from 'node:fs';
import path from 'node:path';
import { editJson } from './backup.js';
export type CleanupAction = { id: string; kind: 'disable-plugin' | 'remove-mcp' | 'remove-dir' | 'flag'; target: string; reason: string; apply: () => void };
const readJsonFile = (f: string): any => (existsSync(f) ? JSON.parse(readFileSync(f, 'utf8')) : {});
/** True when `cmd` resolves to a file: an absolute/relative path that exists, or a name found in a PATH directory (PATHEXT on Windows). No shell. */
export function onPath(cmd: string): boolean {
  if (cmd.includes('/') || cmd.includes('\\')) return existsSync(cmd);
  const exts = process.platform === 'win32' ? ['', ...(process.env.PATHEXT ?? '.EXE;.CMD;.BAT').split(';')] : [''];
  return (process.env.PATH ?? '').split(path.delimiter).some((dir) => dir && exts.some((e) => existsSync(path.join(dir, cmd + e))));
}
/** An absolute-path argument that points nowhere useful: missing, or an empty directory (macOS's empty `/home/` mount, DESIGN §6's morphllm example). */
function deadPath(arg: unknown): boolean {
  if (typeof arg !== 'string' || !path.isAbsolute(arg) || arg.length < 2) return false;
  if (!existsSync(arg)) return true;
  try { return statSync(arg).isDirectory() && readdirSync(arg).length === 0; } catch { return true; }
}
const flag = (id: string, target: string, reason: string): CleanupAction => ({ id, kind: 'flag', target, reason, apply: () => {} });
/** The machine-cleanup plan for `home` (DESIGN §6). Flags are report-only; every other action backs up the file it edits before writing. */
export function planCleanup(home: string): CleanupAction[] {
  const actions: CleanupAction[] = [];
  const settingsPath = path.join(home, '.claude', 'settings.json'); const claudeJson = path.join(home, '.claude.json');
  const settings = readJsonFile(settingsPath); const cj = readJsonFile(claudeJson);
  const plugins: Record<string, boolean> = settings.enabledPlugins ?? {};
  const disable = (name: string, reason: string) => actions.push({ id: `plugin:${name}`, kind: 'disable-plugin', target: name, reason, apply: () => editJson(settingsPath, (s) => { s.enabledPlugins = { ...(s.enabledPlugins ?? {}), [name]: false }; }) });
  if (plugins['agentmemory@agentmemory']) disable('agentmemory@agentmemory', '12 hooks post to a dead localhost:3111 on every prompt');
  if ('claude-supermemory@supermemory-plugins' in plugins) disable('claude-supermemory@supermemory-plugins', plugins['claude-supermemory@supermemory-plugins'] ? 'unused hosted memory plugin' : 'unused hosted memory plugin (already disabled)');
  if (plugins['context-mode@context-mode']) actions.push(flag('plugin:context-mode', 'context-mode@context-mode', 'retire after offload passes acceptance (its PreToolUse Agent rewrite collides with subagent briefs)'));
  for (const [name, def] of Object.entries<any>(cj.mcpServers ?? {})) {
    if (name === 'agentmemory') { actions.push({ id: `mcp:${name}`, kind: 'remove-mcp', target: name, reason: 'backend not running; replaced by optimus', apply: () => editJson(claudeJson, (j) => { if (j.mcpServers) delete j.mcpServers[name]; }) }); continue; }
    if (name === 'serena') { actions.push(flag('mcp:serena', 'serena', 'remove after `kb import serena` has run')); continue; }
    const badArg = (Array.isArray(def?.args) ? def.args : []).find(deadPath);
    if (badArg) actions.push(flag(`mcp:${name}`, name, `argument path does not exist or is empty: ${badArg}`));
    else if (typeof def?.command === 'string' && def.command && !onPath(def.command)) actions.push(flag(`mcp:${name}`, name, `command not on PATH: ${def.command}`));
  }
  const am = path.join(home, '.agentmemory');
  if (existsSync(am)) actions.push({ id: 'dir:.agentmemory', kind: 'remove-dir', target: am, reason: 'agentmemory state; its backups/ are copied to ~/.optimus/imports/agentmemory first', apply: () => {
    const src = path.join(am, 'backups'); const dest = path.join(home, '.optimus', 'imports', 'agentmemory', 'backups');
    if (existsSync(src)) { mkdirSync(dest, { recursive: true }); cpSync(src, dest, { recursive: true }); }
    rmSync(am, { recursive: true, force: true });
  } });
  return actions;
}
