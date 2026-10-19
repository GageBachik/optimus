import os from 'node:os';
import path from 'node:path';
import { existsSync, readFileSync, appendFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { paths } from '../lib/paths.js';
import { editJson, backupFile } from './backup.js';
/** Short lowercase hostname: `Gages-MacBook-Pro.local` → `gages-macbook-pro` (DESIGN §3.8). */
export const defaultDeviceId = (host = os.hostname()) => host.split('.')[0].toLowerCase().replace(/[^a-z0-9]+/g, '-');
const HEADING = '## Compaction instructions (project-memory)';
/** The shipped compaction instructions; resolved next to dist/kb.js (`../skills`) or src/cli (`../../skills`). */
export function compactionInstructionsPath(): string {
  const here = path.dirname(fileURLToPath(import.meta.url));
  return [path.join(here, '..', 'skills', 'kb', 'compaction-instructions.md'), path.join(here, '..', '..', 'skills', 'kb', 'compaction-instructions.md')].find(existsSync) ?? path.join(here, '..', 'skills', 'kb', 'compaction-instructions.md');
}
/** DESIGN §3.8/§3.9: autoCompactWindow (settings backed up first), deviceId into config.json, optional CLAUDE.md append.
 *  v1.4: 333000, a third of the 1M window. At 200000 a live session compacted three times in 50 minutes with a 160K floor after each. */
export const AUTO_COMPACT_WINDOW = 333000;
export function setup(home: string, opts: { device?: string; appendClaudeMd?: boolean; print?: (line: string) => void } = {}): void {
  const print = opts.print ?? ((l: string) => process.stdout.write(l + '\n'));
  const settingsPath = path.join(home, '.claude', 'settings.json');
  const settings = existsSync(settingsPath) ? JSON.parse(readFileSync(settingsPath, 'utf8')) : {};
  if (settings.autoCompactWindow === AUTO_COMPACT_WINDOW) print(`autoCompactWindow already ${AUTO_COMPACT_WINDOW} in ${settingsPath}`);
  else { editJson(settingsPath, (s) => { s.autoCompactWindow = AUTO_COMPACT_WINDOW; }); print(`set autoCompactWindow: ${AUTO_COMPACT_WINDOW} in ${settingsPath} (backup written)`); }
  const deviceId = defaultDeviceId(opts.device ?? os.hostname());
  paths.saveConfig({ deviceId }); print(`deviceId: ${deviceId} (${paths.configPath()})`);
  const instructions = compactionInstructionsPath(); const claudeMd = path.join(home, '.claude', 'CLAUDE.md');
  if (!opts.appendClaudeMd) { print(`compaction instructions: ${instructions}`); print('  run `kb setup --append-claude-md` to append them to ~/.claude/CLAUDE.md'); return; }
  if (existsSync(claudeMd) && readFileSync(claudeMd, 'utf8').includes(HEADING)) { print(`${claudeMd} already carries the compaction instructions`); return; }
  backupFile(claudeMd); appendFileSync(claudeMd, `\n${HEADING}\n\n${readFileSync(instructions, 'utf8')}`);
  print(`appended compaction instructions to ${claudeMd} (backup written)`);
}
