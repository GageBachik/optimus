import { test } from 'node:test';
import assert from 'node:assert/strict';
import { auditSummary } from '../../src/compaction/audit.js';
import { buildRestoreBrief } from '../../src/compaction/restore-brief.js';
const ts: any = { goalFirst: 'Fix sizing', goalLatest: 'Check Sharpe', constraints: ['must never exceed 2%'], decisions: ['Decision: fixed-fractional 0.5%'], files: [{ path: '/w/sizing.py', action: 'Edit', at: '' }], commands: [{ cmd: 'pytest tests/test_sizing.py -q', at: '' }], tests: [], openItems: ['re-run walk-forward on NQ'], errors: ['Error: FileNotFoundError data/es.parquet'], exactValues: ['30001'], pointers: ['snapshot ab12'] };
test('audit marks items missing from the summary', () => {
  const a = auditSummary('We fixed sizing.py with fixed-fractional 0.5%.', ts);
  assert.ok(a.present.includes('sizing.py')); assert.ok(a.missing.some((m) => /walk-forward/.test(m))); assert.ok(a.missing.includes('30001'));
});
test('restore brief puts omissions above files and stays under 9,000 chars', () => {
  const b = buildRestoreBrief(ts, { missing: ['re-run walk-forward on NQ', '30001'] });
  assert.ok(b.length <= 9000); assert.ok(b.indexOf('Omitted by compaction') < b.indexOf('## Files')); assert.ok(b.includes('memory aid'));
});
