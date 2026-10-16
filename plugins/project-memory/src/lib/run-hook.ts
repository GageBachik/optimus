import { readStdin } from './stdin.js';
import { log } from './log.js';
export type HookInput = { session_id?: string; transcript_path?: string; cwd?: string; hook_event_name?: string; agent_id?: string; agent_type?: string; [k: string]: unknown };
export async function runHook(event: string, fn: (input: HookInput) => Promise<unknown>): Promise<void> {
  process.on('uncaughtException', (e) => { log('error', `uncaught in ${event}`, String(e)); process.exit(0); });
  process.on('unhandledRejection', (e) => { log('error', `unhandled in ${event}`, String(e)); process.exit(0); });
  let input: HookInput = {}; const raw = await readStdin();
  if (raw.trim()) { try { input = JSON.parse(raw); } catch (e) { log('error', `stdin parse failed for ${event}`, { chars: raw.length, error: String(e) }); process.exit(0); } }
  try { const out = await fn(input); if (out !== undefined) process.stdout.write(JSON.stringify(out)); } catch (e) { log('error', `handler threw in ${event}`, String(e)); }
  process.exit(0);
}
