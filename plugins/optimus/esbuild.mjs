import { build } from 'esbuild';
const banner = { js: "#!/usr/bin/env node\nimport { createRequire } from 'node:module'; const require = createRequire(import.meta.url);" };
// preserveSymlinks: a linked worktree shares the main checkout's node_modules through a junction; without it esbuild writes that real path into
// every module comment of the bundle (`// ../../../optimus/plugins/optimus/node_modules/…`) and each dist build from a worktree churns 900 lines.
const common = { bundle: true, platform: 'node', target: 'node24', format: 'esm', sourcemap: false, logLevel: 'info', banner, preserveSymlinks: true };
const noYaml = { name: 'no-yaml-in-hooks', setup(b) { b.onResolve({ filter: /^yaml$/ }, () => { throw new Error('yaml must not be bundled into dist/hook.js'); }); } };
await build({ ...common, entryPoints: ['src/hooks/entry.ts'], outfile: 'dist/hook.js', plugins: [noYaml] });
await build({ ...common, entryPoints: ['src/mcp/server.ts'], outfile: 'dist/mcp.js' });
await build({ ...common, entryPoints: ['src/cli/index.ts'], outfile: 'dist/kb.js' });
