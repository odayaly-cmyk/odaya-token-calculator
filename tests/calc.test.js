const { test } = require('node:test');
const assert = require('node:assert/strict');
const calc = require('../calc.js');

test('numeric parsing accepts comma formatting', () => {
  assert.equal(calc.parseTokenValue('455,019,030'), 455019030);
  assert.equal(calc.parseTokenValue('1_000'), 1000);
});

test('shorthand parsing accepts k, m, and b case-insensitively', () => {
  assert.equal(calc.parseTokenValue('500k'), 500000);
  assert.equal(calc.parseTokenValue('15.2M'), 15200000);
  assert.equal(calc.parseTokenValue('1.5b'), 1500000000);
});

test('parsing rejects negatives and malformed values', () => {
  assert.ok(Number.isNaN(calc.parseTokenValue('-1')));
  assert.ok(Number.isNaN(calc.parseTokenValue('12mm')));
  assert.ok(Number.isNaN(calc.parseTokenValue('')));
});

test('per-row GPT-5.6 Sol cost matches expected value', () => {
  const cost = calc.calculateRow({ input: 15156170, output: 1012460, cached: 241724160, inputPrice: 2, outputPrice: 12, cachePrice: .2 });
  assert.ok(Math.abs(cost - 90.806692) < 1e-9);
});

test('per-row GPT-5.5 cost matches expected value', () => {
  const cost = calc.calculateRow({ input: 16508597, output: 1181099, cached: 179436544, inputPrice: 4, outputPrice: 24, cachePrice: .4 });
  assert.ok(Math.abs(cost - 166.1553816) < 1e-9);
});

test('combined model cost matches expected default', () => {
  const rows = [
    { input: 15156170, output: 1012460, cached: 241724160, inputPrice: 2, outputPrice: 12, cachePrice: .2 },
    { input: 16508597, output: 1181099, cached: 179436544, inputPrice: 4, outputPrice: 24, cachePrice: .4 }
  ];
  assert.ok(Math.abs(calc.calculateRows(rows) - 256.9620736) < 1e-9);
});

test('percentage validation requires 100 percent and valid ranges', () => {
  assert.equal(calc.percentagesValid(6.959, .482, 92.559), true);
  assert.equal(calc.percentagesValid(10, 10, 79), false);
  assert.equal(calc.percentagesValid(-1, 1, 100), false);
});

test('simple calculator creates a costable row', () => {
  const row = calc.simpleToRow({ total: '100m', inputPct: 10, outputPct: 5, cachePct: 85, inputPrice: 2, outputPrice: 12, cachePrice: .2 });
  assert.deepEqual({ input: row.input, output: row.output, cached: row.cached }, { input: 10000000, output: 5000000, cached: 85000000 });
  assert.equal(calc.calculateRow(row), 97);
});

test('URL-state serialization round-trips Unicode and numeric state', () => {
  const state = { mode: 'detailed', rows: [{ name: 'Modèle Ω', input: '1.5m', inputPrice: 2 }], currency: 'USD' };
  const encoded = calc.serializeState(state);
  assert.match(encoded, /^[A-Za-z0-9_-]+$/);
  assert.deepEqual(calc.deserializeState(encoded), state);
  assert.equal(calc.deserializeState('not-valid-json'), null);
});
