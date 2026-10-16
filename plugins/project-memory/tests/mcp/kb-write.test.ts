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
  await client.connect(new StdioClientTransport({ command: process.execPath, args: ['--disable-warning=ExperimentalWarning', 'dist/mcp.js'], env: { ...process.env } as Record<string, string> }));
  try {
    const call = async (name: string, args: Record<string, unknown>) => JSON.parse(((await client.callTool({ name, arguments: args })) as any).content[0].text);
    const a = await call('kb_write', { kind: 'approach', title: 'ES 2-sigma', domain: 'trading', project: 'es', facets: { risk: 'fixed-fractional' } });
    const f = await call('kb_write', { kind: 'finding', title: 'F', domain: 'trading', project: 'es', tags: ['risk sizing'], attrs: { gate: 'in-sample' }, metrics: [{ name: 'sharpe', value: 1.2, better: 'higher' }], evidence: [{ kind: 'commit', ref: 'abc' }] });
    assert.match(f.id, /^f_/); assert.equal(f.created, true); assert.equal(f.concepts[0].how, 'exact'); assert.deepEqual(f.transfers, []);
    assert.match((await call('kb_link', { src: f.id, type: 'about', dst: a.id, props: { facet_key: 'risk' } })).rel_id, /^l_/);
    assert.match((await call('kb_write', { kind: 'finding', title: 'x', domain: 'trading', attrs: { gate: 'mainnet' } })).error, /allowed gates/);
    assert.ok(existsSync(path.join(process.env.PROJECT_MEMORY_BANK!, 'notes', 'finding', `${f.id}.md`)));
  } finally { await client.close(); }
});
