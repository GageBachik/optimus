import { readStdin } from './stdin.js';
import { log } from './log.js';
export type HookInput = { session_id?: string; transcript_path?: string; cwd?: string; hook_event_name?: string; agent_id?: string; agent_type?: string; [k: string]: unknown };
export async function runHook(event: string, fn: (input: HookInput) => Promise<unknown>): Promise<void> {
  process.on('uncaughtException', (e) => { log('error', `uncaught in ${event}`, String(e)); process.exit(0); });
  process.on('unhandledRejection', (e) => { log('error', `unhandled in ${event}`, String(e)); process.exit(0); });
  let input: HookInput = {}; const raw = await readStdin();
  if (raw.trim()) { try { input = JSON.parse(raw); } catch (e) { log('error', `stdin parse failed for ${event}`, { chars: raw.length, error: e instanceof Error ? e.name : 'parse error' }); process.exit(0); } }
  // Pipes are asynchronous on macOS and Windows: exiting right after write() drops anything past the ~64 KB buffer, so exit from the write callback.
  try { const out = await fn(input); if (out !== undefined) { process.stdout.write(JSON.stringify(out), () => process.exit(0)); return; } } catch (e) { log('error', `handler threw in ${event}`, String(e)); }
  process.exit(0);
}
