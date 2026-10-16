import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeName, dice, tokens } from '../../src/kb/normalize.js';
test('normalization folds hyphen, underscore, plural, case; porter stems', () => {
  assert.equal(normalizeName('Risk-Sizing'), normalizeName('risk sizings'));
  assert.equal(normalizeName('project_overview'), normalizeName('project-overview'));
  assert.equal(normalizeName('position sizing'), 'posit-size');
  assert.equal(dice(tokens('heap ceiling'), tokens('heap')), 2 / 3);
});
test('porter stemmer matches the reference vocabulary', async () => {
  const { stem } = await import('../../src/kb/normalize.js');
  const cases: Record<string, string> = { caresses: 'caress', ponies: 'poni', agreed: 'agre', hopping: 'hop', filing: 'file', happy: 'happi', relational: 'relat', triplicate: 'triplic', adoption: 'adopt', generalizations: 'gener', controll: 'control', cease: 'ceas' };
  for (const [w, e] of Object.entries(cases)) assert.equal(stem(w), e, w);
  assert.equal(normalizeName('IllegalOpcode heap form'), normalizeName('heap form illegal opcode'));
});
