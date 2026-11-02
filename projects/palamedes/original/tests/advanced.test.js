import test from 'node:test';
import assert from 'node:assert/strict';
import { parseData, parseMatrix, rref, convertBase, compoundInterest, loanPayment, triangle, meanInference } from '../src/lib/advanced.js';

test('data/matrix validation rejects malformed and nonfinite input', () => {
  assert.deepEqual(parseData('1, 2\n3; -4'), [1, 2, 3, -4]);
  assert.throws(() => parseData('1 banana 3'), /finite/);
  assert.throws(() => parseMatrix('[[1,2],[3]]'), /same length/);
  assert.throws(() => parseMatrix('[["1"]]'), /finite number/);
});

test('RREF handles row exchange, rank deficiency, and rectangular matrices', () => {
  assert.deepEqual(rref([[0, 2, 4], [1, 1, 3]]).matrix, [[1, 0, 1], [0, 1, 2]]);
  assert.equal(rref([[1, 2, 3], [2, 4, 6]]).rank, 1);
  assert.equal(rref([[0, 0], [0, 0]]).rank, 0);
  assert.deepEqual(rref([[1e-12, 0], [0, 1e-12]]).matrix, [[1, 0], [0, 1]]);
  assert.equal(rref([[1e-12, 0], [0, 1e-12]]).rank, 2, 'uniform rescaling preserves numerical rank');
  assert.deepEqual(rref([[1, 1e-12]]).matrix, [[1, 1e-12]], 'meaningful small free coefficients are preserved');
});

test('base conversion preserves large integers and rejects invalid digits', () => {
  assert.equal(convertBase('9007199254740993', 10, 16), '20000000000001');
  assert.equal(convertBase('-ff', 16, 2), '-11111111');
  assert.equal(convertBase('z', 36, 10), '35');
  assert.throws(() => convertBase('2', 2, 10), /not a digit/);
  assert.throws(() => convertBase('1.5', 10, 2), /signed integer/);
});

test('finance handles zero rate and known monthly loan payment', () => {
  assert.equal(compoundInterest(1000, 0, 10).balance, 1000);
  assert.ok(Math.abs(compoundInterest(1000, 5, 1, 1).balance - 1050) < 1e-10);
  assert.equal(loanPayment(1200, 0, 12).payment, 100);
  assert.ok(Math.abs(loanPayment(100000, 6, 360).payment - 599.5505251527569) < 1e-8);
  assert.throws(() => loanPayment(100, 2, 0), /positive integer/);
});

test('geometry computes a 3-4-5 triangle and rejects degenerate triangles', () => {
  const t = triangle(3, 4, 5);
  assert.equal(t.area, 6);
  assert.equal(t.perimeter, 12);
  assert.ok(Math.abs(t.angleC - 90) < 1e-10);
  assert.throws(() => triangle(1, 2, 3), /triangle inequality/);
});

test('Student-t inference uses sample variance and two-sided probability', () => {
  const result = meanInference([1, 2, 3, 4, 5], 0.95, 3);
  assert.equal(result.mean, 3);
  assert.equal(result.df, 4);
  assert.equal(result.t, 0);
  assert.ok(Math.abs(result.pValue - 1) < 1e-8);
  assert.ok(Math.abs(result.lower - 1.036756838522439) < 1e-6);
  assert.throws(() => meanInference([2, 2]), /nonzero/);
});
