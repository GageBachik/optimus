// DESIGN §3.7: exact patterns. `group` = the capture group that holds the secret (only that part is replaced).
const PATTERNS: { kind: string; re: RegExp; group?: number }[] = [
  { kind: 'aws', re: /\bAKIA[0-9A-Z]{16}\b/g },
  { kind: 'github', re: /\bgh[pousr]_[A-Za-z0-9]{36,}\b/g },
  { kind: 'anthropic', re: /\bsk-ant-[A-Za-z0-9_-]{20,}/g },
  { kind: 'openai', re: /\bsk-[A-Za-z0-9]{32,}\b/g },
  { kind: 'slack', re: /\bxox[abpr]-[A-Za-z0-9-]{10,}/g },
  { kind: 'stripe', re: /\bsk_(live|test)_[A-Za-z0-9]{16,}\b/g },
  { kind: 'jwt', re: /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/g },
  { kind: 'pem', re: /-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/g },
  { kind: 'bearer', re: /\bBearer\s+([A-Za-z0-9._~+\/=\-]{16,})/g, group: 1 },
  { kind: 'generic', re: /\b(api[_-]?key|secret|token|passphrase|password)\s*[:=]\s*["']?([A-Za-z0-9\/+_\-]{16,})/gi, group: 2 },
];
const MAX_CHARS = 1_000_000;

export function redactSensitive(text: string): { text: string; count: number } {
  if (text.length > MAX_CHARS) return { text: `[REDACTED:oversize ${text.length} chars]`, count: 1 };
  let count = 0;
  for (const { kind, re, group } of PATTERNS) {
    text = text.replace(re, (m: string, ...g: unknown[]) => {
      count++;
      const tag = `[REDACTED:${kind}]`;
      // The secret group ends every match here, so keep the prefix and swap the tail.
      return group ? m.slice(0, m.length - (g[group - 1] as string).length) + tag : tag;
    });
  }
  return { text, count };
}
