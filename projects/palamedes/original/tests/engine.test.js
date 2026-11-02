import test from 'node:test';
import assert from 'node:assert/strict';
import {
  math, normalizeExpression, evaluateExpression, symbolic, integrate, findRoot,
  solveODE, solveLinearSystem, describe, regression, distribution,
  loanPayment, futureValue, npv, irr,
} from '../src/lib/engine.js';

const near = (actual, expected, tolerance = 1e-9) => assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} should be within ${tolerance} of ${expected}`);
const numeric = expression => evaluateExpression(expression).raw;

test('calculator respects precedence, implicit multiplication and Unicode notation', () => {
  near(numeric('2 + 3*4^2'), 50);
  near(numeric('2(3+4)'), 14);
  near(numeric('√(9) + 2³ × 4 − 6 ÷ 2'), 32);
  near(numeric('sin(π/2)'), 1);
  near(numeric('ln(e)'), 1);
  assert.equal(normalizeExpression('τ'), '(2*pi)');
});

test('degree, gradian, inverse trig and explicit angular units agree', () => {
  near(evaluateExpression('sin(30)', {}, 'DEG').raw, 0.5);
  near(evaluateExpression('asin(0.5)', {}, 'DEG').raw, 30);
  near(evaluateExpression('cos(100)', {}, 'GRAD').raw, 0);
  near(evaluateExpression('sin(30 deg)', {}, 'DEG').raw, 0.5);
  near(evaluateExpression('atan2(1,1)', {}, 'DEG').raw, 45);
});

test('variables and user functions persist while angle wrappers do not leak', () => {
  const scope = {};
  evaluateExpression('a = 7', scope);
  evaluateExpression('f(x) = a*x + 1', scope);
  near(evaluateExpression('f(3)', scope).raw, 22);
  evaluateExpression('cos(60)', scope, 'DEG');
  assert.equal(scope.cos, undefined);
  near(evaluateExpression('cos(pi)', scope).raw, -1);
});

test('complex numbers, fractions, explicit big numbers and physical units work', () => {
  const complex = numeric('sqrt(-1)');
  near(complex.re, 0); near(complex.im, 1);
  near(Number(numeric('fraction(1,3) + fraction(1,6)')), 0.5);
  assert.equal(numeric('bignumber("9007199254740993") + bignumber(1)').toString(), '9007199254740994');
  near(numeric('2 inch to cm').toNumber('cm'), 5.08);
  near(numeric('36 km/h to m/s').toNumber('m/s'), 10);
});

test('invalid syntax and incompatible units produce actionable errors', () => {
  assert.throws(() => evaluateExpression('2 + ('), /Calculation:/);
  assert.throws(() => evaluateExpression('2 m + 3 kg'), /Calculation:/);
  assert.throws(() => evaluateExpression(''), /Enter an expression/);
  assert.throws(() => evaluateExpression('config({number: "BigNumber"})'), /sandbox/);
});

test('calculator resource bounds reject huge collections and expensive combinatorics', () => {
  for (const expr of ['1:1000000000', 'range(1,1000000000)', 'zeros(1000000)', 'ones([1000,1000])', 'resize([1,2],[1000000])', '1000000!', 'factorial(bignumber(1000000))', 'combinations(1000000000,2)']) assert.throws(() => evaluateExpression(expr), /limited|10,000|100,000/, expr);
  assert.throws(() => evaluateExpression('1'.repeat(1001)), /1,000/);
  assert.deepEqual(evaluateExpression('1:4').raw.toArray(), [1,2,3,4]);
  assert.deepEqual(evaluateExpression('zeros(2,2)').raw.toArray(), [[0,0],[0,0]]);
});

test('matrix arithmetic and complex matrix operations are available', () => {
  near(numeric('det([1,2;3,4])'), -2);
  assert.deepEqual(numeric('transpose([1,2;3,4])').toArray(), [[1, 3], [2, 4]]);
  const inverse = numeric('inv([1,2;3,4])').toArray();
  near(inverse[0][0], -2); near(inverse[0][1], 1);
  assert.deepEqual(solveLinearSystem([[2, 1], [1, -1]], [5, 1]), [2, 1]);
  assert.deepEqual(solveLinearSystem([[1e-20, 0], [0, 1e-20]], [2e-20, 3e-20]), [2, 3]);
  assert.throws(() => solveLinearSystem([[1, 2], [2, 4]], [1, 2]), /Linear solve:/);
  assert.throws(() => solveLinearSystem([[1, 2]], [1]), /square/);
});

test('symbolic algebra expansion, factoring and rational simplification preserve values', () => {
  const expanded = symbolic('expand', '(x+1)^3').value;
  near(evaluateExpression(expanded, { x: 3 }).raw, 64);
  const factored = symbolic('factor', 'x^2-1').value;
  near(evaluateExpression(factored, { x: 4 }).raw, 15);
  const simplified = symbolic('simplify', '(x^2-1)/(x-1)').value;
  near(evaluateExpression(simplified, { x: 5 }).raw, 6);
});

test('symbolic derivatives, antiderivatives and definite integrals agree with known values', () => {
  const derivative = symbolic('derivative', 'x^3 + sin(x)').value;
  near(evaluateExpression(derivative, { x: 0 }).raw, 1);
  const second = symbolic('derivative', 'x^4', 'x', { order: 2 }).value;
  near(evaluateExpression(second, { x: 2 }).raw, 48);
  const antiderivative = symbolic('integrate', 'x^2').value;
  near(evaluateExpression(antiderivative, { x: 3 }).raw, 9);
  const integral = symbolic('definite-integral', 'sin(x)', 'x', { lower: 0, upper: 'pi' });
  near(Number(integral.value), 2);
  assert.ok(integral.latex.length > 0);
  assert.throws(() => symbolic('definite-integral', '1/x', 'x', { lower: -1, upper: 1 }), /finite/);
});

test('symbolic equations, limits, Taylor expansions, finite sums and transforms work', () => {
  const solutions = symbolic('solve', 'x^2=4').value;
  assert.match(solutions, /-2/); assert.match(solutions, /2/);
  assert.equal(symbolic('limit', 'sin(x)/x', 'x', { at: 0 }).value, '1');
  const taylor = symbolic('taylor', 'exp(x)', 'x', { degree: 5 }).value;
  near(evaluateExpression(taylor, { x: 0.1 }).raw, 1.1051709166666667, 1e-12);
  assert.equal(symbolic('sum', 'x^2', 'x', { lower: 1, upper: 10 }).value, '385');
  const transform = symbolic('laplace', 'sin(t)', 't').value;
  near(evaluateExpression(transform, { s: 2 }).raw, 0.2);
  const inverse = symbolic('inverse-laplace', '1/(s^2+1)', 's').value;
  near(evaluateExpression(inverse, { t: Math.PI / 2 }).raw, 1);
});

test('symbolic invalid orders and unavailable operations are errors', () => {
  assert.throws(() => symbolic('derivative', 'x^2', 'x', { order: -1 }), /order/);
  assert.throws(() => symbolic('taylor', 'exp(x)', 'x', { degree: 1000 }), /degree/);
  assert.throws(() => symbolic('sum', 'x', 'x', { lower: 1.5, upper: 3 }), /integer/);
  assert.throws(() => symbolic('unknown', 'x'), /Unknown/);
});

test('adaptive quadrature handles reversed/zero bounds and rejects detected poles', () => {
  near(integrate('sin(x)', 'x', 0, Math.PI), 2);
  near(integrate('x^2', 'x', 1, -1), -2 / 3);
  near(integrate('exp(-x^2)', 'x', -2, 2), 1.764162781524843, 1e-8);
  assert.equal(integrate('x', 'x', 3, 3), 0);
  assert.throws(() => integrate('1/x', 'x', -1, 1), /finite/);
  assert.throws(() => integrate('x', 'x', 0, Infinity), /finite/);
});

test('numerical root solver finds a real root and rejects pole/no-root examples', () => {
  near(findRoot('cos(x)-x', 'x', 1), 0.7390851332151607);
  near(findRoot('x^2-2', 'x', 1), Math.SQRT2);
  near(findRoot(x => x*x-2, 'x', 1), Math.SQRT2);
  near(findRoot('(x-1)^2', 'x', 2), 1, 1e-6);
  assert.throws(() => findRoot('1/x', 'x', 0), /No converged/);
  assert.throws(() => findRoot('1/x', 'x', 1), /No converged/);
  assert.throws(() => findRoot('x^2+1', 'x', 0), /No converged/);
});

test('RK4 follows known ODEs forward/backward and clips the final step', () => {
  const forward = solveODE('y', 0, 1, 1, 0.03);
  near(forward.at(-1).x, 1);
  near(forward.at(-1).y, Math.E, 3e-8);
  const backward = solveODE('y', 1, Math.E, 0, 0.03);
  near(backward.at(-1).y, 1, 2e-8);
  const timeAlias = solveODE('t', 0, 0, 1, 0.1);
  near(timeAlias.at(-1).y, 0.5);
  assert.throws(() => solveODE('y', 0, 1, 1, 0), /greater than zero/);
  assert.throws(() => solveODE('y', 0, 1, 100, 0.00001), /10,000/);
});

test('descriptive statistics distinguish sample and population and define quantiles', () => {
  const stats = describe([5, 1, 3, 2, 4]);
  assert.equal(stats.n, 5); assert.equal(stats.mean, 3); assert.equal(stats.median, 3);
  assert.equal(stats.variance, 2); assert.equal(stats.sampleVariance, 2.5);
  assert.equal(stats.q1, 2); assert.equal(stats.q3, 4);
  assert.equal(describe([1]).sampleVariance, null);
  assert.throws(() => describe([]), /at least one/);
  assert.throws(() => describe([1, NaN]), /finite/);
});

test('linear and polynomial regressions recover known models and reject rank deficiency', () => {
  const linear = regression([1, 2, 3, 4], [3, 5, 7, 9]);
  near(linear.coefficients[0], 1); near(linear.coefficients[1], 2);
  near(linear.r2, 1); near(linear.predict(10), 21);
  const quadratic = regression([-2, -1, 0, 1, 2], [9, 2, 1, 6, 17], 2);
  near(quadratic.coefficients[0], 1); near(quadratic.coefficients[1], 2); near(quadratic.coefficients[2], 3);
  near(quadratic.predict(3), 34);
  const offset = regression([10000, 10001, 10002, 10003], [1, 3, 5, 7]);
  near(offset.predict(10004), 9);
  assert.throws(() => regression([1, 1, 1], [1, 2, 3]), /distinct/);
  assert.throws(() => regression([1, 2], [1, 2], 2), /Degree/);
});

test('continuous distributions, inverse CDFs and discrete PMFs match reference cases', () => {
  near(distribution('normal', { operation: 'cdf', x: 0 }), 0.5);
  near(distribution('normal', { operation: 'inv', probability: 0.975 }), 1.959963984540054, 1e-7);
  near(distribution('studentt', { operation: 'cdf', x: 0, df: 9 }), 0.5);
  near(distribution('uniform', { operation: 'cdf', x: 4, a: 2, b: 6 }), 0.5);
  near(distribution('exponential', { operation: 'cdf', x: 1, rate: 2 }), 1 - Math.exp(-2));
  near(distribution('binomial', { x: 2, n: 4, p: 0.5 }), 0.375);
  near(distribution('poisson', { x: 0, lambda: 2 }), Math.exp(-2));
  assert.equal(distribution('binomial', { operation: 'inv', n: 4, p: 0.5, probability: 0.8 }), 3);
  assert.equal(distribution('poisson', { operation: 'inv', lambda: 2, probability: 0.5 }), 2);
  assert.equal(distribution('binomial', { x: 1.5, n: 4, p: 0.5 }), 0);
});

test('invalid probability distribution parameters are rejected', () => {
  assert.throws(() => distribution('normal', { sd: 0 }), /greater than zero/);
  assert.throws(() => distribution('binomial', { p: 1.1 }), /between 0 and 1/);
  assert.throws(() => distribution('binomial', { n: 2.5 }), /integer/);
  assert.throws(() => distribution('normal', { operation: 'inv', probability: 2 }), /between 0 and 1/);
  assert.throws(() => distribution('uniform', { a: 3, b: 1 }), /exceed/);
  assert.throws(() => distribution('studentt', { df: -1 }), /greater than zero/);
});

test('financial routines handle zero interest and agree with standard cash-flow equations', () => {
  near(loanPayment(12000, 0, 1), 1000);
  near(loanPayment(200000, 0.06, 30), 1199.1010503055, 1e-8);
  near(futureValue(1000, 0, 2, 12, 100), 3400);
  near(futureValue(1000, 0.1, 2, 1), 1210);
  near(npv(0.1, [-100, 110]), 0);
  near(irr([-100, 110]), 0.1);
  assert.throws(() => irr([100, 200]), /positive and one negative/);
  assert.throws(() => npv(-1, [1]), /greater than -100/);
});
