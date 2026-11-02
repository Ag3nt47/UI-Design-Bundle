import test from 'node:test';
import assert from 'node:assert/strict';
import katex from 'katex';
import { math } from '../src/lib/engine.js';
import { TEXTBOOK, TEXTBOOK_CATEGORIES, TEXTBOOK_SOURCES, searchTextbook } from '../src/lib/textbook.js';

test('textbook covers 60+ distinct equations across school, college, numerical and ML topics', () => {
  assert.ok(TEXTBOOK.length >= 60);
  assert.equal(new Set(TEXTBOOK.map(item => item.id)).size, TEXTBOOK.length);
  for (const category of ['Arithmetic', 'Algebra', 'Geometry', 'Trigonometry', 'Calculus', 'Linear algebra', 'Probability & statistics', 'Finance', 'Numerical methods', 'Machine learning']) assert.ok(TEXTBOOK_CATEGORIES.includes(category));
  for (const title of ['Weights, bias, and an affine layer', 'Neural network forward pass', 'Backpropagation through a weight', 'Gradient descent update', 'Adam adaptive update', 'Scaled dot-product attention', 'Softmax normalization', 'Cross-entropy loss']) assert.ok(TEXTBOOK.some(item => item.title === title));
});

test('every equation renders valid LaTeX and includes conditions and an original complete worked example', () => {
  const sourceIds = new Set(TEXTBOOK_SOURCES.map(item => item.id));
  for (const item of TEXTBOOK) {
    assert.ok(item.title.length > 5, item.id);
    assert.ok(item.description.length > 20, item.id);
    assert.ok(item.conditions.length >= 2, item.id);
    assert.ok(item.example.problem.length > 5, item.id);
    assert.ok(item.example.steps.length >= 3, item.id);
    assert.ok(item.example.answer.length > 0, item.id);
    assert.ok(sourceIds.has(item.source), item.id);
    assert.doesNotThrow(() => katex.renderToString(item.formula, { throwOnError: true, strict: 'error' }), item.id);
  }
});

function compare(actual, expected, label) {
  if (actual?.toArray) actual = actual.toArray();
  if (Array.isArray(expected)) {
    assert.ok(Array.isArray(actual), label);
    assert.equal(actual.length, expected.length, label);
    expected.forEach((value, index) => compare(actual[index], value, `${label}[${index}]`));
  } else {
    assert.ok(Number.isFinite(actual), label);
    assert.ok(Math.abs(actual - expected) < 1e-9 * Math.max(1, Math.abs(expected)), `${label}: ${actual} ≠ ${expected}`);
  }
}

test('all runnable worked examples reproduce their stated numeric or matrix result', () => {
  for (const item of TEXTBOOK) {
    assert.equal(item.input, item.example.check.expression, item.id);
    compare(math.evaluate(item.input), item.example.check.expected, item.id);
  }
});

test('textbook search combines case-insensitive words with category filters', () => {
  assert.equal(searchTextbook('QUADRATIC')[0].id, 'quadratic');
  assert.ok(searchTextbook('gradient', 'Machine learning').some(item => item.id === 'gradient-descent'));
  assert.equal(searchTextbook('quadratic', 'Arithmetic').length, 0);
  assert.equal(searchTextbook('').length, TEXTBOOK.length);
  assert.equal(searchTextbook('zzzz nonexistent').length, 0);
});
