// Slop Expenses mileage claims, the pure part (expenses/js/core/mileage.js).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const ctx = vm.createContext({});
vm.runInContext(readFileSync(path.join(ROOT, 'expenses/js/core/mileage.js'), 'utf8'), ctx);
const M = ctx.SlopExpenses.mileage;

test('distance: dot or comma decimals, one decimal kept; nothing, zero or absurd is refused', () => {
  assert.equal(M.parseDistance('42'), 42);
  assert.equal(M.parseDistance('42,55'), 42.6);
  assert.equal(M.parseDistance(' 7.25 '), 7.3);
  for (const bad of ['', '0', '-3', 'far', '200000']) assert.equal(M.parseDistance(bad), null);
});

test('amount: distance times the rate per unit, rounded to the cent', () => {
  assert.equal(M.amount(42, 45), 1890);       // 42 km at 0.45
  assert.equal(M.amount(12.5, 58.5), 731);    // 12.5 mi at 0.585 → 7.3125
});

test('description: the route, there and back, the distance, the rate and the purpose', () => {
  assert.equal(M.describe({ from: 'Leeds', to: 'York', roundTrip: true, distance: 84, unit: 'km', rateText: '0.45', purpose: 'client visit' }),
    'Mileage: Leeds to York and back, 84 km at 0.45 (client visit)');
  assert.equal(M.describe({ distance: 10, unit: 'mi', rateText: '0.67' }), 'Mileage: 10 mi at 0.67');
});
