import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { readBlob } from '../offload/blobs.js';
const server = new McpServer({ name: 'project-memory', version: '0.1.0' });
server.registerTool('recall', {
  description: 'Return the exact text of an offloaded tool output or pre-compaction snapshot by id (16-hex prefix or full sha256). Pages of up to 32 KB; default 8 KB; use offset and next_offset to page.',
  inputSchema: { id: z.string().regex(/^[0-9a-f]{8,64}$/), offset: z.number().int().min(0).optional(), limit: z.number().int().min(1).max(32768).optional() },
}, async ({ id, offset, limit }) => {
  try { const p = readBlob(id, offset ?? 0, limit ?? 8192); return { content: [{ type: 'text', text: JSON.stringify({ id: p.id, total_chars: p.total, offset: p.offset, text: p.text, next_offset: p.next }) }] }; }
  catch (e) { return { content: [{ type: 'text', text: JSON.stringify({ error: String((e as Error).message) }) }], isError: true }; }
});
process.stdin.on('end', () => process.exit(0));
await server.connect(new StdioServerTransport());
