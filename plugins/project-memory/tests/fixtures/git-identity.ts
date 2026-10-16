import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
/** A machine where git cannot form an identity (no user.name/email, autodetect refused — what a host without a dotted hostname gets). */
export function withoutGitIdentity<T>(fn: () => T): T {
  const cfg = path.join(mkdtempSync(path.join(tmpdir(), 'gitcfg-')), 'config'); writeFileSync(cfg, '[user]\n\tuseConfigOnly = true\n');
  const saved = { g: process.env.GIT_CONFIG_GLOBAL, s: process.env.GIT_CONFIG_NOSYSTEM };
  process.env.GIT_CONFIG_GLOBAL = cfg; process.env.GIT_CONFIG_NOSYSTEM = '1';
  try { return fn(); } finally { for (const [k, v] of [['GIT_CONFIG_GLOBAL', saved.g], ['GIT_CONFIG_NOSYSTEM', saved.s]] as const) { if (v === undefined) delete process.env[k]; else process.env[k] = v; } }
}
