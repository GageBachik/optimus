import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
process.env.PROJECT_MEMORY_HOME = mkdtempSync(path.join(tmpdir(), 'pm-')); process.env.PROJECT_MEMORY_BANK = mkdtempSync(path.join(tmpdir(), 'bank-'));
const { openDb } = await import('../../src/kb/db.js');
const { installTemplate } = await import('../../src/kb/templates.js');
const { loadTemplate } = await import('../../src/kb/templates-yaml.js');
test('kb_write and kb_link over MCP; a bad gate comes back as an error payload', async () => {
  const db = openDb(); installTemplate(db, loadTemplate('templates/trading.yaml')); db.sql.close();
  const client = new Client({ name: 't', version: '0' });
  await client.connect(new StdioClientTransport({ command: process.execPath, args: ['--disable-warning=ExperimentalWarning', path.resolve('dist/mcp.js')], cwd: process.env.PROJECT_MEMORY_HOME, env: { ...process.env } as Record<string, string> })); // a neutral cwd: this repo now has its own .kb.json
  try {
    const call = async (name: string, args: Record<string, unknown>) => JSON.parse(((await client.callTool({ name, arguments: args })) as any).content[0].text);
    const a = await call('kb_write', { kind: 'approach', title: 'ES 2-sigma', domain: 'trading', project: 'es', facets: { risk: 'fixed-fractional' } });
    const f = await call('kb_write', { kind: 'finding', title: 'F', domain: 'trading', project: 'es', tags: ['risk sizing'], attrs: { gate: 'in-sample' }, metrics: [{ name: 'sharpe', value: 1.2, better: 'higher' }], evidence: [{ kind: 'commit', ref: 'abc' }] });
    assert.match(f.id, /^f_/); assert.equal(f.created, true); assert.equal(f.concepts[0].how, 'exact'); assert.deepEqual(f.transfers, []);
    assert.match((await call('kb_link', { src: f.id, type: 'about', dst: a.id, props: { facet_key: 'risk' } })).rel_id, /^l_/);
    const rows = await call('kb_compare', { concept: 'position sizing' });
    assert.deepEqual(rows.map((r: any) => [r.findingId, r.approachValue, r.metric, r.value]), [[f.id, 'fixed-fractional', 'sharpe', 1.2]]);
    assert.match((await call('kb_write', { kind: 'finding', title: 'x', domain: 'trading', attrs: { gate: 'mainnet' } })).error, /allowed gates/);
    assert.ok(existsSync(path.join(process.env.PROJECT_MEMORY_BANK!, 'notes', 'finding', `${f.id}.md`)));
    const b = await call('kb_brief', { project: 'es' }); assert.ok(b.text.includes('## Project es'), b.text); assert.ok(b.text.includes('Domain trading')); assert.deepEqual(b.items, []);
    assert.match((await call('kb_brief', {})).error, /no \.kb\.json/);
  } finally { await client.close(); }
});
