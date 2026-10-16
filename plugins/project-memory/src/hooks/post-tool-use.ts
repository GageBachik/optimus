import type { HookInput } from '../lib/run-hook.js';
import { offload } from '../offload/offload.js';
export async function postToolUse(input: HookInput) { return offload(input); }
export const handler = postToolUse;
