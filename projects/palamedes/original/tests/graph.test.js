import test from 'node:test';
import assert from 'node:assert/strict';
import { compileGraphExpression } from '../src/lib/graph.js';

test('scalar graph compiler supports every preset and shared parameters', () => {
  const scope = {x: 0,y: 0,t: 0,theta: 0,a:2,b:1};
  for (const expr of ['sin(x)', 'cos(x)', 'a*sin(x)+b', '3*cos(4*theta)', 'sin(sqrt(x^2+y^2))', 'x^2+y^2-9']) assert.ok(Number.isFinite(compileGraphExpression(expr).evaluate(scope)), expr);
  assert.equal(compileGraphExpression('a*sin(x)+b').evaluate(scope), 1);
  const x = compileGraphExpression('cos(t)'), y = compileGraphExpression('sin(t)');
  for (const t of [0, 1, 2, 3]) assert.ok(Math.abs(x.evaluate({t})**2+y.evaluate({t})**2-1)<1e-12);
});

test('graph compiler rejects code, allocation, unsafe access, large powers and oversized expressions', () => {
  for (const expr of ['x=1', 'f(x)=x', 'x; y', 'range(1,1e9)', '[1,2]', '1:1e9', 'ones(1000000)', 'factorial(1000000)', 'x.constructor', '{a:1}', 'import(1)', 'evaluate("1")', 'x^1001', 'pow(x,1001)', 'x!']) assert.throws(()=>compileGraphExpression(expr), undefined, expr);
  assert.throws(()=>compileGraphExpression('x'.repeat(501)), /500/);
  assert.throws(()=>compileGraphExpression(Array(80).fill('sin(x)').join('+')), /128|500/);
});
