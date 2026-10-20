import { build } from 'esbuild';
const banner = { js: "#!/usr/bin/env node\nimport { createRequire } from 'node:module'; const require = createRequire(import.meta.url);" };
const common = { bundle: true, platform: 'node', target: 'node24', format: 'esm', sourcemap: false, logLevel: 'info', banner };
const noYaml = { name: 'no-yaml-in-hooks', setup(b) { b.onResolve({ filter: /^yaml$/ }, () => { throw new Error('yaml must not be bundled into dist/hook.js'); }); } };
await build({ ...common, entryPoints: ['src/hooks/entry.ts'], outfile: 'dist/hook.js', plugins: [noYaml] });
await build({ ...common, entryPoints: ['src/mcp/server.ts'], outfile: 'dist/mcp.js' });
await build({ ...common, entryPoints: ['src/cli/index.ts'], outfile: 'dist/kb.js' });
