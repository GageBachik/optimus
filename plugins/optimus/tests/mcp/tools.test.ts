import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
process.env.OPTIMUS_HOME = mkdtempSync(path.join(tmpdir(), 'pm-')); process.env.OPTIMUS_BANK = mkdtempSync(path.join(tmpdir(), 'bank-'));
test('the server registers recall and the five kb tools with schemas; kb_find names its six fields (DESIGN §4.5)', async () => {
  const client = new Client({ name: 't', version: '0' });
  await client.connect(new StdioClientTransport({ command: process.execPath, args: ['--disable-warning=ExperimentalWarning', 'dist/mcp.js'], env: { ...process.env } as Record<string, string> }));
  try {
    const { tools } = await client.listTools();
    assert.deepEqual(tools.map((t) => t.name).sort(), ['kb_brief', 'kb_compare', 'kb_find', 'kb_link', 'kb_write', 'recall']);
    for (const t of tools) assert.ok(Object.keys(t.inputSchema.properties ?? {}).length > 0, `${t.name} has an input schema`);
    const fields = ['text', 'kind', 'project', 'domain', 'concept', 'limit'];
    const find = tools.find((t) => t.name === 'kb_find')!;
    assert.deepEqual(Object.keys(find.inputSchema.properties ?? {}).sort(), [...fields].sort());
    assert.ok(find.description!.includes(`Fields: ${fields.join(', ')}`), find.description);
  } finally { await client.close(); }
});
