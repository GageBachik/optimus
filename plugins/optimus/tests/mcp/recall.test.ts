import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
process.env.OPTIMUS_HOME = mkdtempSync(path.join(tmpdir(), 'pm-'));
const { storeBlob } = await import('../../src/offload/blobs.js');
test('recall returns exact pages over MCP', async () => {
  const text = 'abcdefghij'.repeat(1000); const { id16 } = storeBlob(text, { tool: 'Bash', sessionId: 's' });
  const client = new Client({ name: 't', version: '0' });
  await client.connect(new StdioClientTransport({ command: process.execPath, args: ['--disable-warning=ExperimentalWarning', 'dist/mcp.js'], env: { ...process.env } as Record<string, string> }));
  try {
    const res: any = await client.callTool({ name: 'recall', arguments: { id: id16, offset: 5, limit: 20 } });
    const body = JSON.parse(res.content[0].text); assert.equal(body.text, text.slice(5, 25)); assert.equal(body.next_offset, 25); assert.equal(body.total_chars, 10000);
    const bad: any = await client.callTool({ name: 'recall', arguments: { id: ('../'.repeat(10) + 'etc/passwd').padStart(64, '/') } }).catch((e: Error) => ({ isError: true, error: e.message })); // SDK rejects schema-invalid args as -32602
    assert.equal(bad.isError, true); assert.ok(!JSON.stringify(bad).includes('root:'));
  } finally { await client.close(); }
});
