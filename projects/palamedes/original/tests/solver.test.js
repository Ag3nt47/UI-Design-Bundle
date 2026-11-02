import test from 'node:test';
import assert from 'node:assert/strict';
import { solveProblem, classifyProblem, normalizeProblem } from '../src/lib/solver.js';

test('linear equation keeps operations and checks original sides',()=>{
  const r=solveProblem('2*(x + 3) = 5*x - 9');
  assert.equal(r.answer,'x = 5');
  assert.ok(r.steps.some(s=>s.title==='Collect like terms'));
  assert.ok(r.steps.some(s=>s.expression==='-3*x = -15'));
  assert.equal(r.checks[0].status,'pass');
  assert.match(r.checks[0].detail,/Original left = 16; original right = 16/);
});
test('quadratic solutions use discriminant and both roots check',()=>{
  const r=solveProblem('x^2-5*x+6=0');
  assert.deepEqual(r.roots,['2','3']);assert.equal(r.checks.length,2);
  assert.ok(r.checks.every(c=>c.status==='pass'));
  assert.ok(r.steps.some(s=>s.expression?.includes('D = b^2 - 4*a*c')));
});
test('negative discriminant produces complex roots that verify',()=>{
  const r=solveProblem('x^2+1=0');
  assert.deepEqual(r.roots,['i','-i']);assert.ok(r.checks.every(c=>c.status==='pass'));
});
test('double roots, identities and contradictions are distinguished',()=>{
  assert.deepEqual(solveProblem('(x-2)^2=0').roots,['2']);
  assert.equal(solveProblem('2*(x+1)=2*x+2').answer,'All values in the original domain');
  assert.equal(solveProblem('x+1=x+2').answer,'No solution');
  assert.equal(solveProblem('0.1*x+0.2*x=0.3*x').answer,'All values in the original domain');
});
test('zero coefficient is handled as constant rather than division by zero',()=>{
  assert.equal(solveProblem('0*x=0').answer,'All values in the original domain');
  assert.equal(solveProblem('0*x=7').answer,'No solution');
});
test('domain restrictions are preserved by rejecting variable denominators',()=>{
  assert.throws(()=>solveProblem('x/x=1'),/denominators|domain/);
  assert.throws(()=>solveProblem('x+y=3'),/one unknown/);
  assert.throws(()=>solveProblem('x^3=8'),/powers up to 2|degree/);
});
test('arithmetic steps occur after child operations with independent evaluation',()=>{
  const r=solveProblem('(2+3)*4^2');assert.equal(r.answer,'80');
  const power=r.steps.findIndex(s=>s.expression?.startsWith('4 ^ 2'));
  const multiply=r.steps.findIndex(s=>s.expression?.includes('(2 + 3) * 4 ^ 2'));
  assert.ok(power>=0&&multiply>power);assert.equal(r.checks[0].status,'pass');
});
test('elementary functions, factorial and unicode input are supported',()=>{
  assert.equal(solveProblem('5! / (3!*2!)').answer,'10');
  assert.equal(solveProblem('√(81) × 2 − 3²').answer,'9');
  assert.equal(normalizeProblem('π²'),'pi^2');
});
test('percentages and percentage change retain the correct scale',()=>{
  assert.equal(solveProblem('What is 18% of 250?').answer,'45');
  assert.equal(solveProblem('what is 18 percent of 250').answer,'45');
  assert.equal(solveProblem('increase 80 by 15%').answer,'92');
  assert.equal(solveProblem('decrease 80 by 15%').answer,'68');
  assert.equal(solveProblem('percentage change from 80 to 100').answer,'25%');
  assert.throws(()=>solveProblem('percentage change from 0 to 100'),/zero/);
});
test('data summaries show operations and use sorted median',()=>{
  assert.equal(solveProblem('mean of 4,7,9,12,18').answer,'10');
  const r=solveProblem('median of 9,1,7,3');assert.equal(r.answer,'5');
  assert.match(r.interpretation,/1, 3, 7, 9/);
});
test('word templates calculate geometry and rate with domain validation',()=>{
  assert.equal(solveProblem('hypotenuse of a right triangle with legs 3 and 4').answer,'5');
  assert.equal(solveProblem('area of a triangle base 8 height 3').answer,'12');
  assert.equal(solveProblem('find speed distance 120 time 2').answer,'60');
  assert.match(solveProblem('A car travels 120 miles in 2 hours. What is its speed?').answer,/60 miles\/hours/);
  assert.throws(()=>solveProblem('area of a circle with radius -2'),/positive/);
  assert.throws(()=>solveProblem('find speed distance 120 time 0'),/positive/);
});
test('unit conversion includes a reverse check and handles offsets',()=>{
  const r=solveProblem('convert 5 km to m');assert.equal(r.answer,'5000 m');assert.equal(r.checks[0].status,'pass');
  assert.match(solveProblem('convert 0 degC to degF').answer,/32/);
  assert.throws(()=>solveProblem('convert 5 kg to m'),/Units|units/);
});
test('derivative shows product rule and finite-difference check',()=>{
  const r=solveProblem('differentiate x^3*sin(x)');
  assert.ok(r.steps.some(s=>s.title==='Product rule'));assert.equal(r.checks[0].status,'pass');
  assert.match(r.checks[0].detail,/not a proof/);
});
test('integration uses power rules and verifies by differentiating',()=>{
  const r=solveProblem('integrate x^2');assert.match(r.answer,/\+ C$/);
  assert.ok(r.steps.some(s=>s.title==='Apply the power rule'));assert.equal(r.checks[0].status,'pass');
});
test('symbolic factor and expand verify equivalence',()=>{
  for(const p of ['factor x^2-1','expand (x+1)^2','simplify x+x'])assert.equal(solveProblem(p).checks[0].status,'pass');
});
test('double-check can be disabled and unsupported real domain stays inconclusive',()=>{
  assert.equal(solveProblem('2+3',{doubleCheck:false}).checks.length,0);
  assert.equal(solveProblem('sqrt(-1)').checks[0].status,'inconclusive');
});
test('unsupported prose, code, empty input and oversized input fail clearly',()=>{
  assert.throws(()=>solveProblem('Prove that all prime numbers are odd'),/local language/);
  assert.throws(()=>solveProblem('a=import(2)'),/belongs|one variable|operation|Unsupported/);
  assert.throws(()=>solveProblem(''),/Paste a problem/);
  assert.throws(()=>solveProblem('x'.repeat(4001)),/4,000/);
  assert.throws(()=>solveProblem('range(1,1e9)'),/scalar elementary/);
  assert.throws(()=>solveProblem('ones(1e9)'),/scalar elementary/);
  assert.throws(()=>solveProblem('1/0'),/finite number/);
});
test('natural equation prefixes do not become unknown symbols',()=>{
  assert.equal(solveProblem('Solve the equation 3x+2=14').answer,'x = 4');
  assert.equal(solveProblem('Find x if 4x=20').answer,'x = 5');
});
test('input classifier chooses specialized workspaces',()=>{
  for(const [input,tab]of [['plot sin(x)','graphing'],['y = x^2','graphing'],['[[1,2],[3,4]]','matrices'],['differentiate x^2','symbolic'],['mean of 1,2,3','statistics'],['convert 5 km to m','tools'],['2*x+1=5','solver'],['sqrt(9)+2','calculator']])assert.equal(classifyProblem(input).tab,tab,input);
});
