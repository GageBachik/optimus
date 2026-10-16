import { runHook } from '../lib/run-hook.js';
const event = process.argv[2] ?? '';
const modules: Record<string, () => Promise<{ handler: (input: any) => Promise<unknown> }>> = {
  'session-start': () => import('./session-start.js'), 'session-sync': () => import('./session-sync.js'), 'user-prompt': () => import('./user-prompt.js'),
  'post-tool-use': () => import('./post-tool-use.js'), 'pre-compact': () => import('./pre-compact.js'), 'post-compact': () => import('./post-compact.js'),
  'subagent-start': () => import('./subagent-start.js'), 'stop': () => import('./stop.js'), 'session-end': () => import('./session-end.js'),
};
await runHook(event, async (input) => { const load = modules[event]; if (!load) return undefined; return (await load()).handler(input); });
