import test from 'node:test';
import assert from 'node:assert/strict';
import { softmax, denseForward, denseMSEGradient, lossValue, scaledDotProductAttention, trainLinearRegression, optimizerStep } from '../src/lib/ml.js';
const close = (a, b, epsilon = 1e-8) => assert.ok(Math.abs(a - b) < epsilon, `${a} != ${b}`);

test('softmax is stable for large logits, normalized, and translation-invariant', () => {
  const a = softmax([10000, 10001, 9999]), b = softmax([0, 1, -1]);
  close(a.reduce((s, v) => s + v, 0), 1);
  a.forEach((v, i) => close(v, b[i]));
  assert.ok(a.every(Number.isFinite));
});

test('dense forward exposes weighted terms and rejects incompatible shapes', () => {
  const result = denseForward([2, 3], [[1, -1], [2, 1]], [0.5, -1], 'relu');
  assert.deepEqual(result.terms, [[2, -3], [4, 3]]);
  assert.deepEqual(result.z, [-0.5, 6]);
  assert.deepEqual(result.output, [0, 6]);
  assert.throws(() => denseForward([2, 3], [[1]], [0]), /column/);
  assert.throws(() => denseForward([2], [[1]], [0, 1]), /bias/);
});

test('dense backpropagation matches finite differences including full softmax Jacobian', () => {
  for (const activation of ['linear', 'relu', 'sigmoid', 'tanh', 'softmax']) {
    const x = [0.5, -0.3], W = [[0.4, -0.2], [-0.1, 0.7]], b = [0.2, 0.1], target = [0.1, 0.9];
    const gradient = denseMSEGradient(x, W, b, target, activation);
    const h = 1e-6;
    for (let i = 0; i < W.length; i++) for (let j = 0; j < W[i].length; j++) {
      const plus = W.map(row => [...row]), minus = W.map(row => [...row]);
      plus[i][j] += h; minus[i][j] -= h;
      const f = weights => lossValue(denseForward(x, weights, b, activation).output, target).value;
      close(gradient.dW[i][j], (f(plus) - f(minus)) / (2 * h), 1e-6);
    }
  }
});

test('loss calculations use expected reductions and probability validation', () => {
  close(lossValue([1, 3], [2, 1], 'mse').value, 2.5);
  close(lossValue([0.8, 0.2], [1, 0], 'bce').value, -Math.log(0.8));
  close(lossValue([0.1, 0.8, 0.1], [0, 1, 0], 'cross-entropy').value, -Math.log(0.8));
  assert.throws(() => lossValue([0.8, 0.8], [1, 0], 'cross-entropy'), /sum to 1/);
});

test('attention scales dot products, normalizes each row, and applies causal masks', () => {
  const r = scaledDotProductAttention([[1, 0], [0, 1]], [[1, 0], [0, 1]], [[10, 0], [0, 10]]);
  const p = Math.exp(1 / Math.sqrt(2)) / (Math.exp(1 / Math.sqrt(2)) + 1);
  close(r.output[0][0], 10 * p);
  r.weights.forEach(row => close(row.reduce((s, v) => s + v, 0), 1));
  const causal = scaledDotProductAttention([[1], [1]], [[1], [1]], [[2], [4]], { causal: true });
  assert.deepEqual(causal.output, [[2], [3]]);
  assert.throws(() => scaledDotProductAttention([[1]], [[1], [2]], [[1]]), /same number/);
});

test('gradient descent learns slope and bias and records decreasing loss', () => {
  const result = trainLinearRegression([[1], [2], [3], [4], [5]], [3, 5, 7, 9, 11], { learningRate: 0.02, epochs: 2500 });
  close(result.weights[0], 2, 1e-5); close(result.bias, 1, 1e-5);
  assert.ok(result.loss < 1e-10);
  assert.ok(result.history.at(-1).loss < result.history[0].loss);
  assert.throws(() => trainLinearRegression([[1]], [1], { learningRate: -1 }), /positive/);
});

test('SGD and bias-corrected Adam perform known parameter updates', () => {
  assert.deepEqual(optimizerStep([1, 2], [0.5, -1], { learningRate: 0.1 }).parameters, [0.95, 2.1]);
  const adam = optimizerStep([1], [2], { method: 'adam', learningRate: 0.1 });
  close(adam.parameters[0], 0.9, 1e-8); close(adam.mHat[0], 2); close(adam.vHat[0], 4);
  assert.throws(() => optimizerStep([1], [1, 2]), /equal lengths/);
});
