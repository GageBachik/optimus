import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { log } from '../lib/log.js';
export type ProjectConfig = { project_id: string; domain: string; facets?: Record<string, string>; target?: { environment?: string; subject?: string }; relies_on?: string[] };
export function loadProjectConfig(cwd: string): ProjectConfig | null {
  let dir = path.resolve(cwd);
  for (let i = 0; i < 8; i++) {
    const f = path.join(dir, '.kb.json');
    if (existsSync(f)) { const c = JSON.parse(readFileSync(f, 'utf8')); if (!c.project_id || !c.domain) { log('warn', `.kb.json at ${f} lacks project_id or domain; ignored`); return null; } return c; }
    const up = path.dirname(dir); if (up === dir) break; dir = up;
  }
  return null;
}
