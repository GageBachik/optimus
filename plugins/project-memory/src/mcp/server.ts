import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { readBlob } from '../offload/blobs.js';
import { openDb, type Db } from '../kb/db.js';
import { KINDS } from '../kb/ids.js';
import { kbWrite, kbLink } from '../kb/write.js';
import { paths } from '../lib/paths.js';
const server = new McpServer({ name: 'project-memory', version: '0.1.0' });
let _db: Db | undefined; const db = () => (_db ??= openDb());
const json = (v: unknown) => ({ content: [{ type: 'text' as const, text: JSON.stringify(v) }] });
const fail = (e: unknown) => ({ content: [{ type: 'text' as const, text: JSON.stringify({ error: String((e as Error).message) }) }], isError: true });
server.registerTool('recall', {
  description: 'Return the exact text of an offloaded tool output or pre-compaction snapshot by id (16-hex prefix or full sha256). Pages of up to 32 KB; default 8 KB; use offset and next_offset to page.',
  inputSchema: { id: z.string().regex(/^[0-9a-f]{8,64}$/), offset: z.number().int().min(0).optional(), limit: z.number().int().min(1).max(32768).optional() },
}, async ({ id, offset, limit }) => {
  try { const p = readBlob(id, offset ?? 0, limit ?? 8192); return json({ id: p.id, total_chars: p.total, offset: p.offset, text: p.text, next_offset: p.next }); }
  catch (e) { return fail(e); }
});
const Metric = z.object({ name: z.string().min(1), value: z.number(), unit: z.string().optional(), better: z.enum(['higher', 'lower']), baseline: z.number().optional() });
const Evidence = z.object({ kind: z.enum(['commit', 'path', 'transcript', 'url']), ref: z.string().min(1), sha256: z.string().regex(/^[0-9a-f]{64}$/).optional() });
server.registerTool('kb_write', {
  description: 'Create or update a knowledge-bank note (finding, approach, experiment, target, theme, concept, evidence, …). tags resolve to concepts (about rels); facets, metrics (with optional baseline), method/objective/trials become attrs; evidence becomes evidence notes with backed_by rels; a finding without evidence is stored as state=unverified; a finding proposes transfers to approaches in other projects. Returns {id, created, concepts, transfers, questions}. Never touches git.',
  inputSchema: {
    kind: z.enum(KINDS), id: z.string().optional(), title: z.string().min(1), body: z.string().optional(), domain: z.string().optional(), project: z.string().optional(),
    attrs: z.record(z.string(), z.union([z.string(), z.array(z.string())])).optional(),
    rels: z.array(z.object({ type: z.string().min(1), dst: z.string().min(1), props: z.record(z.string(), z.unknown()).optional() })).optional(),
    tags: z.array(z.string().min(1)).optional(), facets: z.record(z.string(), z.string()).optional(), metrics: z.array(Metric).optional(),
    method: z.string().optional(), objective: z.string().optional(), trials: z.number().int().min(0).optional(), evidence: z.array(Evidence).optional(),
  },
}, async (rec) => { try { return json(kbWrite(db(), paths.bankDir(), rec)); } catch (e) { return fail(e); } });
server.registerTool('kb_link', {
  description: 'Add one relation between two bank notes (about, relies_on, under, tests, on, at, in, uses, discovered_in, validated_in, supersedes, conflicts_with, backed_by, …). Returns {rel_id}. Never touches git.',
  inputSchema: { src: z.string().min(1), type: z.string().min(1), dst: z.string().min(1), props: z.record(z.string(), z.unknown()).optional() },
}, async (l) => { try { return json(kbLink(db(), paths.bankDir(), l)); } catch (e) { return fail(e); } });
process.stdin.on('end', () => process.exit(0));
await server.connect(new StdioServerTransport());
