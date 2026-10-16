import { randomBytes } from 'node:crypto';
const ENC = '0123456789abcdefghjkmnpqrstvwxyz';
let lastTime = 0, lastRand: number[] = [];
export function ulid(now = Date.now()): string {
  let t = now, time = '';
  for (let i = 0; i < 10; i++) { time = ENC[t % 32] + time; t = Math.floor(t / 32); }
  if (now === lastTime) { for (let i = 15; i >= 0; i--) { if (lastRand[i] < 31) { lastRand[i]++; break; } lastRand[i] = 0; } }
  else { lastTime = now; lastRand = [...randomBytes(16)].map((b) => b % 32); }
  return time + lastRand.map((x) => ENC[x]).join('');
}
export type Kind = 'domain'|'template'|'project'|'theme'|'approach'|'experiment'|'target'|'concept'|'finding'|'evidence'|'report';
const PREFIX: Record<Kind, string> = { domain: 'd', template: 'm', project: 'p', theme: 'h', approach: 'a', experiment: 'x', target: 't', concept: 'c', finding: 'f', evidence: 'e', report: 'r' };
export const noteId = (kind: Kind) => `${PREFIX[kind]}_${ulid()}`;
export const evidenceId = (sha256: string) => `e_${sha256.slice(0, 16)}`;
export function kindOfId(id: string): Kind {
  const k = Object.entries(PREFIX).find(([, p]) => id.startsWith(p + '_'))?.[0];
  if (!k) throw new Error(`unknown id prefix: ${id}`);
  return k as Kind;
}
