import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fitBrief, charSafePrefix } from '../../src/lib/budget.js';
test('drops lowest-priority items first and stays under the cap', () => {
  const r = fitBrief('preamble', [
    { title: 'Goal', priority: 10, items: ['a'.repeat(3000)] },
    { title: 'Files', priority: 5, items: Array.from({ length: 50 }, (_, i) => `file-${i} `.repeat(30)) },
    { title: 'Errors', priority: 1, items: Array.from({ length: 50 }, (_, i) => `error-${i} `.repeat(30)) },
  ], 9000);
  assert.ok(r.text.length <= 9000); assert.ok(r.text.includes('## Goal')); assert.ok(r.text.includes('aaaa')); assert.ok(r.dropped > 0); assert.ok(!r.text.includes('error-49'));
});
test('oversized single item is truncated with a marker, not dropped (review focus 3)', () => {
  const r = fitBrief('p', [{ title: 'Goal', priority: 10, items: ['x'.repeat(20000)] }], 9000);
  assert.ok(r.text.length <= 9000); assert.ok(r.text.includes('[brief truncated]')); assert.ok(r.text.includes('xxxx')); assert.equal(r.truncated, true);
});
test('charSafePrefix never splits a surrogate pair', () => { assert.equal(charSafePrefix('ab' + '😀'.repeat(10), 3), 'ab'); });
