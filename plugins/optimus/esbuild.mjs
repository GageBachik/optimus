import { build } from 'esbuild';
const banner = { js: "#!/usr/bin/env node\nimport { createRequire } from 'node:module'; const require = createRequire(import.meta.url);" };
// preserveSymlinks: a worktree whose node_modules is a junction to the main checkout otherwise bundles module keys like
// `../../../optimus/plugins/optimus/node_modules/ajv/...` (2026-10-24, 732 changed lines in dist/mcp.js with no source change); with it the
// committed bundles are the same bytes whichever checkout built them.
const common = { bundle: true, platform: 'node', target: 'node24', format: 'esm', sourcemap: false, logLevel: 'info', banner, preserveSymlinks: true };
const noYaml = { name: 'no-yaml-in-hooks', setup(b) { b.onResolve({ filter: /^yaml$/ }, () => { throw new Error('yaml must not be bundled into dist/hook.js'); }); } };
await build({ ...common, entryPoints: ['src/hooks/entry.ts'], outfile: 'dist/hook.js', plugins: [noYaml] });
await build({ ...common, entryPoints: ['src/mcp/server.ts'], outfile: 'dist/mcp.js' });
await build({ ...common, entryPoints: ['src/cli/index.ts'], outfile: 'dist/kb.js' });
