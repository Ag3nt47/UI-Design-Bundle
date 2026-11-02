import { all, create } from 'mathjs';
import nerdamer from 'nerdamer/all.js';
import jstatPackage from 'jstat';

/** Local computation only. Numerical routines use IEEE-754 doubles unless an
 * explicit mathjs bignumber/fraction value is supplied to the calculator. */
export const math = create(all, { predictable: false, precision: 64 });
const jStat = jstatPackage.jStat || jstatPackage;

export function normalizeExpression(expression) {
  return String(expression ?? '').trim()
    .replace(/[−–]/g, '-').replace(/[×·]/g, '*').replace(/÷/g, '/')
    .replace(/π/g, 'pi').replace(/τ/g, '(2*pi)')
    .replace(/∞/g, 'Infinity').replace(/√\s*\(/g, 'sqrt(')
    .replace(/√\s*(\d+(?:\.\d+)?|[a-zA-Z]+)/g, 'sqrt($1)')
    .replace(/²/g, '^2').replace(/³/g, '^3').replace(/\bln\s*\(/g, 'log(');
}

export function format(value) {
  if (value === undefined) return '';
  if (typeof value === 'string') return value;
  try { return math.format(value, { precision: 14, lowerExp: -8, upperExp: 14 }); }
  catch { try { return JSON.stringify(value); } catch { return String(value); } }
}

function latexOf(value) {
  try { return math.parse(format(value)).toTex(); }
  catch { return `\\text{${format(value).replace(/[{}\\]/g, '')}}`; }
}

function fail(error, context = 'Calculation') {
  const message = error instanceof Error ? error.message : String(error);
  throw new Error(`${context}: ${message}`);
}

function variableName(variable) {
  if (!/^[a-zA-Z][a-zA-Z0-9_]*$/.test(variable)) throw new Error('Use a variable name such as x, t, or theta.');
  return variable;
}

function finite(value, name = 'Value') {
  if (value === null || value === undefined || typeof value === 'boolean' || Array.isArray(value) || (typeof value === 'string' && !value.trim())) throw new Error(`${name} must be a finite real number.`);
  const numeric = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(numeric)) throw new Error(`${name} must be a finite real number.`);
  return numeric;
}

function positive(value, name) {
  const number = finite(value, name);
  if (number <= 0) throw new Error(`${name} must be greater than zero.`);
  return number;
}

function numericFunction(expression, variable = 'x', scope = {}) {
  variableName(variable);
  const compiled = math.compile(normalizeExpression(expression));
  return x => finite(compiled.evaluate({ ...scope, [variable]: x }), `Function at ${variable}=${x}`);
}

function collectionSize(dimensions) {
  if (dimensions?.toArray) dimensions = dimensions.toArray();
  if (!Array.isArray(dimensions)) dimensions = [dimensions];
  const size = dimensions.reduce((total, value) => {
    const n = Number(value);
    if (!Number.isSafeInteger(n) || n < 0) throw new Error('Collection dimensions must be nonnegative integers.');
    if (n > 10000) throw new Error('Use at most 10,000 entries in a calculator collection dimension.');
    return total * n;
  }, 1);
  if (!Number.isFinite(size) || size > 10000) throw new Error('Use at most 10,000 entries in a calculator collection. Larger computations belong in the sandbox.');
}

function rangeSize(start, end, step = 1) {
  start = finite(start, 'Range start'); end = finite(end, 'Range end'); step = finite(step, 'Range step');
  if (!step) throw new Error('A range step cannot be zero.');
  if (Math.max(0, (end - start) / step) > 10000) throw new Error('Use at most 10,000 entries in a calculator range.');
}

// Scope wrappers protect evaluated function arguments, including parameters
// passed through an installed module. They are not persisted as user variables.
function resourceGuards() {
  const guarded = {
    range: (...args) => {
      if (typeof args[0] === 'string') {
        const parts = args[0].split(':').map(Number);
        if (parts.length === 2) rangeSize(parts[0], parts[1]);
        else if (parts.length === 3) rangeSize(parts[0], parts[2], parts[1]);
        else throw new Error('Use a range such as 1:10 or 1:2:10.');
      } else rangeSize(args[0], args[1], typeof args[2] === 'boolean' ? 1 : args[2] ?? 1);
      return math.range(...args);
    },
    factorial: value => {
      if (Number(value) > 1000) throw new Error('Calculator factorials are limited to 1,000. Use a sandbox program for larger values.');
      return math.factorial(value);
    },
  };
  for (const name of ['ones', 'zeros', 'identity']) guarded[name] = (...args) => {
    let dims = Array.isArray(args[0]) || args[0]?.toArray ? args[0] : args.filter(value => typeof value !== 'string');
    if (dims?.toArray) dims = dims.toArray();
    if (name === 'identity' && dims.length === 1) dims = [dims[0], dims[0]];
    collectionSize(dims);
    return math[name](...args);
  };
  guarded.resize = (value, dimensions, ...rest) => { collectionSize(dimensions); return math.resize(value, dimensions, ...rest); };
  for (const name of ['random', 'randomInt']) guarded[name] = (...args) => {
    if (Array.isArray(args[0]) || args[0]?.toArray) collectionSize(args[0]);
    return math[name](...args);
  };
  for (const name of ['combinations', 'combinationsWithRep', 'permutations']) guarded[name] = (...args) => {
    if (args.some(value => Number(value) > 100000)) throw new Error('Combinatoric inputs are limited to 100,000 in the calculator.');
    if (args.length > 1 && Math.min(Number(args[1]), Number(args[0]) - Number(args[1])) > 10000) throw new Error('Use a smaller combinatoric calculation or a sandbox program.');
    return math[name](...args);
  };
  return guarded;
}

export function evaluateExpression(expression, scope = {}, angleMode = 'RAD') {
  try {
    const source = normalizeExpression(expression);
    if (!source) throw new Error('Enter an expression first.');
    if (source.length > 1000) throw new Error('Calculator expressions are limited to 1,000 characters. Use the sandbox for longer programs.');
    const node = math.parse(source);
    let nodes = 0;
    node.traverse(child => {
      if (++nodes > 512) throw new Error('The expression is too complex (512 syntax nodes maximum).');
      if (child.isFunctionNode && ['import', 'createUnit', 'config', 'evaluate', 'parse', 'parser', 'reviver', 'resolve'].includes(child.fn.name)) {
        throw new Error(`Use the program sandbox for ${child.fn.name}().`);
      }
    });
    const working = scope instanceof Map ? new Map(scope) : new Map(Object.entries(scope));
    const guards = resourceGuards();
    for (const [key, value] of Object.entries(guards)) working.set(key, value);
    node.traverse(child => {
      if (child.isRangeNode) rangeSize(child.start.evaluate(working), child.end.evaluate(working), child.step ? child.step.evaluate(working) : 1);
      if (child.isOperatorNode && child.op === '!' && Number(child.args[0].evaluate(working)) > 1000) throw new Error('Calculator factorials are limited to 1,000.');
    });
    const angle = String(angleMode).toUpperCase();
    if (angle === 'DEG' || angle === 'GRAD') {
      const scale = Math.PI / (angle === 'DEG' ? 180 : 200);
      for (const name of ['sin', 'cos', 'tan', 'sec', 'csc', 'cot']) {
        working.set(name, x => math[name](math.isUnit(x) ? x : math.multiply(x, scale)));
      }
      for (const name of ['asin', 'acos', 'atan', 'asec', 'acsc', 'acot']) {
        working.set(name, x => math.divide(math[name](x), scale));
      }
      working.set('atan2', (y, x) => math.atan2(y, x) / scale);
    }
    const raw = node.evaluate(working);
    // Preserve assignments and named functions, but keep angle wrappers transient.
    const angleFunctions = new Set(['sin', 'cos', 'tan', 'sec', 'csc', 'cot', 'asin', 'acos', 'atan', 'asec', 'acsc', 'acot', 'atan2']);
    for (const [key, value] of working) {
      if (Object.hasOwn(guards, key)) continue;
      if (angle !== 'RAD' && angleFunctions.has(key)) continue;
      if (scope instanceof Map) scope.set(key, value);
      else if (!['__proto__', 'constructor', 'prototype'].includes(key)) scope[key] = value;
    }
    return { value: format(raw), raw, latex: latexOf(raw) };
  } catch (error) { fail(error); }
}

export function symbolic(operation, expression, variable = 'x', extra = {}) {
  try {
    const source = normalizeExpression(expression);
    if (!source) throw new Error('Enter an expression first.');
    variableName(variable);
    const op = String(operation).toLowerCase().replace(/[ _]/g, '-');
    const lower = extra.lower ?? extra.a ?? 0;
    const upper = extra.upper ?? extra.b ?? 1;
    let result;
    switch (op) {
      case 'simplify': result = nerdamer(`simplify(${source})`); break;
      case 'expand': result = nerdamer(`expand(${source})`); break;
      case 'factor': result = nerdamer(`factor(${source})`); break;
      case 'differentiate':
      case 'derivative':
      case 'diff': {
        const order = Number(extra.order ?? 1);
        if (!Number.isInteger(order) || order < 1 || order > 12) throw new Error('Derivative order must be an integer from 1 to 12.');
        result = nerdamer.diff(source, variable, order);
        break;
      }
      case 'integrate':
      case 'integral': result = nerdamer.integrate(source, variable); break;
      case 'definite-integral':
      case 'definite': {
        // For finite, wholly numeric real intervals, validate convergence before
        // applying an antiderivative across possible interior singularities.
        let numericCheck;
        try {
          const a = numericBound(lower), b = numericBound(upper);
          const f = numericFunction(source, variable);
          f(a); f(b);
          numericCheck = integrate(f, variable, a, b);
        } catch (error) {
          const message = String(error.message);
          if (/did not converge/.test(message)) throw error;
          // A singular interior point must not become a principal-value answer.
          if (/Function at/.test(message)) {
            const a = numericBound(lower), b = numericBound(upper);
            const point = Number(message.match(new RegExp(`${variable}=([^ ]+)`))?.[1]);
            if (point > Math.min(a, b) && point < Math.max(a, b)) throw error;
          }
        }
        // Some nerdamer trig definite integrals remain unevaluated even when an
        // elementary antiderivative is known, so try the fundamental theorem.
        const primitive = nerdamer.integrate(source, variable);
        if (!/\bintegrate\(/.test(primitive.toString())) {
          result = nerdamer(`(${primitive.sub(variable, String(upper))})-(${primitive.sub(variable, String(lower))})`);
        } else result = nerdamer.defint(source, String(lower), String(upper), variable);
        if (/\b(?:integrate|defint)\(/.test(result.toString())) {
          const value = numericCheck ?? integrate(source, variable, numericBound(lower), numericBound(upper));
          return { value: `≈ ${format(value)}`, latex: `\\approx ${format(value)}`, method: 'Adaptive Simpson numerical approximation' };
        }
        break;
      }
      case 'solve': result = nerdamer.solveEquations(source, variable); break;
      case 'limit': result = nerdamer.limit(source, variable, String(extra.at ?? extra.point ?? 0)); break;
      case 'taylor': {
        const degree = Number(extra.degree ?? extra.order ?? 5);
        const at = String(extra.at ?? extra.point ?? 0);
        if (!Number.isInteger(degree) || degree < 0 || degree > 12) throw new Error('Taylor degree must be an integer from 0 to 12.');
        const terms = [];
        for (let i = 0; i <= degree; i++) {
          const derivative = i ? nerdamer.diff(source, variable, i) : nerdamer(source);
          const coefficient = derivative.sub(variable, at).toString();
          terms.push(`(${coefficient})*(${variable}-(${at}))^${i}/factorial(${i})`);
        }
        result = nerdamer(terms.join('+')).expand();
        break;
      }
      case 'sum':
      case 'summation': {
        const a = finite(numericBound(lower), 'Lower bound');
        const b = finite(numericBound(upper), 'Upper bound');
        if (!Number.isInteger(a) || !Number.isInteger(b) || b < a || b - a > 10000) throw new Error('Sum bounds must be increasing integers with at most 10,001 terms.');
        result = nerdamer.sum(source, variable, a, b);
        break;
      }
      case 'laplace': result = nerdamer.laplace(source, variable, extra.target ?? 's'); break;
      case 'inverse-laplace': result = nerdamer.ilt(source, variable, extra.target ?? 't'); break;
      default: throw new Error(`Unknown symbolic operation: ${operation}.`);
    }
    if (Array.isArray(result)) {
      const values = result.map(item => String(item));
      return { value: `[${values.join(', ')}]`, latex: `\\left[${values.map(item => nerdamer(item).toTeX()).join(', ')}\\right]`, method: 'Symbolic' };
    }
    const value = result.toString();
    if (/\b(?:integrate|defint|limit|laplace|ilt)\(/.test(value)) {
      return { value, latex: result.toTeX(), method: 'Unevaluated: no closed form was found' };
    }
    return { value, latex: result.toTeX(), method: 'Symbolic' };
  } catch (error) { fail(error, 'Symbolic calculation'); }
}

function numericBound(bound) {
  return finite(math.evaluate(normalizeExpression(bound)), 'Bound');
}

/** Adaptive Simpson integration for finite intervals with a bounded error estimate.
 * Rejects detected singularities and non-convergence rather than displaying a number. */
export function integrate(expression, variable, a, b, tolerance = 1e-9) {
  a = finite(a, 'Lower bound'); b = finite(b, 'Upper bound');
  tolerance = positive(tolerance, 'Tolerance');
  if (a === b) return 0;
  if (a > b) return -integrate(expression, variable, b, a, tolerance);
  const f = typeof expression === 'function' ? x => finite(expression(x), 'Integrand') : numericFunction(expression, variable);
  const midpoint = (a + b) / 2;
  const fa = f(a), fm = f(midpoint), fb = f(b);
  const whole = (b - a) * (fa + 4 * fm + fb) / 6;
  function recurse(left, right, fLeft, fMid, fRight, estimate, eps, depth) {
    const mid = (left + right) / 2;
    const lm = f((left + mid) / 2), rm = f((mid + right) / 2);
    const part1 = (mid - left) * (fLeft + 4 * lm + fMid) / 6;
    const part2 = (right - mid) * (fMid + 4 * rm + fRight) / 6;
    const delta = part1 + part2 - estimate;
    if (Math.abs(delta) <= 15 * eps) return part1 + part2 + delta / 15;
    if (depth <= 0) throw new Error('Integration did not converge. Check discontinuities or split the interval.');
    return recurse(left, mid, fLeft, lm, fMid, part1, eps / 2, depth - 1) + recurse(mid, right, fMid, rm, fRight, part2, eps / 2, depth - 1);
  }
  return finite(recurse(a, b, fa, fm, fb, whole, tolerance, 20), 'Integral');
}

/** Finds one real root near a guess. This is not an exhaustive root solver. */
export function findRoot(expression, variable = 'x', guess = 1) {
  const f = typeof expression === 'function' ? x => finite(expression(x), 'Function value') : numericFunction(expression, variable);
  let x = finite(guess, 'Initial guess');
  for (let i = 0; i < 80; i++) {
    let y;
    try { y = f(x); } catch { break; }
    if (y === 0) return x;
    const h = Math.cbrt(Number.EPSILON) * Math.max(1, Math.abs(x));
    let slope;
    try { slope = (f(x + h) - f(x - h)) / (2 * h); } catch { break; }
    if (!Number.isFinite(slope) || slope === 0) break;
    const step = y / slope;
    if (Math.abs(y) < 1e-10 && Math.abs(step) < 1e-11 * Math.max(1, Math.abs(x))) return x;
    let next = x - step;
    if (!Number.isFinite(next)) break;
    for (let damp = 0; damp < 12; damp++) {
      try { if (Math.abs(f(next)) < Math.abs(y)) break; } catch { /* Try a smaller step. */ }
      next = (x + next) / 2;
    }
    if (next === x) break;
    x = next;
  }
  for (let radius = 0.125; radius <= 1048576; radius *= 2) {
    let a = Number(guess) - radius, b = Number(guess) + radius, fa, fb;
    try { fa = f(a); fb = f(b); } catch { continue; }
    if (fa === 0) return a;
    if (fb === 0) return b;
    if (Math.sign(fa) === Math.sign(fb)) continue;
    for (let i = 0; i < 100; i++) {
      const mid = (a + b) / 2;
      let fm;
      try { fm = f(mid); } catch { break; }
      if (fm === 0 || (Math.abs(fm) < 1e-10 && b - a < 1e-11 * Math.max(1, Math.abs(mid)))) return mid;
      if (Math.sign(fa) !== Math.sign(fm)) b = mid;
      else { a = mid; fa = fm; }
    }
  }
  throw new Error('No converged real root found. Try a different initial guess or inspect the graph.');
}

/** Fourth-order Runge-Kutta for y\'=f(x,y), with x and t as aliases. */
export function solveODE(expression, x0, y0, end, h = 0.05) {
  x0 = finite(x0, 'Initial x'); y0 = finite(y0, 'Initial y'); end = finite(end, 'End x');
  h = positive(Math.abs(finite(h, 'Step size')), 'Step size');
  const count = Math.ceil(Math.abs(end - x0) / h);
  if (count > 10000) throw new Error('Use a larger step size; a trajectory is limited to 10,000 steps.');
  const compiled = math.compile(normalizeExpression(expression));
  const f = (x, y) => finite(compiled.evaluate({ x, t: x, y }), 'ODE slope');
  const direction = end >= x0 ? 1 : -1;
  let x = x0, y = y0;
  const points = [{ x, y }];
  for (let i = 0; i < count; i++) {
    const step = direction * Math.min(h, Math.abs(end - x));
    const k1 = f(x, y), k2 = f(x + step / 2, y + step * k1 / 2);
    const k3 = f(x + step / 2, y + step * k2 / 2), k4 = f(x + step, y + step * k3);
    y = finite(y + step * (k1 + 2 * k2 + 2 * k3 + k4) / 6, 'ODE solution');
    x = i === count - 1 ? end : x + step;
    points.push({ x, y });
  }
  return points;
}

export function solveLinearSystem(A, b) {
  if (!Array.isArray(A) || !A.length || !A.every(row => Array.isArray(row) && row.length === A.length)) throw new Error('A must be a nonempty square matrix.');
  if (!Array.isArray(b) || b.length !== A.length) throw new Error('The right-hand side must have one value per matrix row.');
  A.forEach(row => row.forEach(value => finite(value, 'Matrix entry')));
  const rhs = b.map(value => finite(Array.isArray(value) ? value[0] : value, 'Right-hand side entry'));
  try {
    const decomposition = math.lup(A);
    const upper = decomposition.U;
    const pivotScale = Math.max(...upper.flat().map(Math.abs));
    if (upper.some((row, i) => Math.abs(row[i]) <= Number.EPSILON * pivotScale * A.length * 10)) throw new Error('The matrix is singular or numerically ill-conditioned.');
    const solution = math.lusolve(A, rhs).map(row => finite(row[0], 'Solution'));
    const residual = A.map((row, i) => Math.abs(row.reduce((sum, value, j) => sum + value * solution[j], 0) - rhs[i]));
    if (Math.max(...residual) > 1e-7 * Math.max(1, ...rhs.map(Math.abs))) throw new Error('The matrix is singular or numerically ill-conditioned.');
    return solution;
  } catch (error) { fail(error, 'Linear solve'); }
}

export function describe(values) {
  if (!Array.isArray(values) || !values.length) throw new Error('Enter at least one numeric data value.');
  const sorted = values.map(value => finite(value, 'Data value')).sort((a, b) => a - b);
  let mean = 0, m2 = 0;
  sorted.forEach((value, i) => { const delta = value - mean; mean += delta / (i + 1); m2 += delta * (value - mean); });
  const quantile = p => { const index = (sorted.length - 1) * p, lo = Math.floor(index); return sorted[lo] + (sorted[Math.ceil(index)] - sorted[lo]) * (index - lo); };
  const variance = m2 / sorted.length, sampleVariance = sorted.length > 1 ? m2 / (sorted.length - 1) : null;
  return {
    n: sorted.length, sum: sorted.reduce((sum, value) => sum + value, 0), mean,
    median: quantile(0.5), min: sorted[0], max: sorted.at(-1), range: sorted.at(-1) - sorted[0],
    variance, sampleVariance, stdDev: Math.sqrt(variance), sampleStdDev: sampleVariance === null ? null : Math.sqrt(sampleVariance),
    q1: quantile(0.25), q3: quantile(0.75), iqr: quantile(0.75) - quantile(0.25),
  };
}

/** Polynomial least squares using centered/scaled x and modified Gram-Schmidt QR.
 * Coefficients are in ascending powers: c[0] + c[1]*x + c[2]*x^2. */
export function regression(xs, ys, degree = 1) {
  if (!Array.isArray(xs) || !Array.isArray(ys) || xs.length !== ys.length || xs.length < 2) throw new Error('Supply equal-length x and y lists with at least two pairs.');
  xs = xs.map(x => finite(x, 'x value')); ys = ys.map(y => finite(y, 'y value'));
  degree = Number(degree);
  if (!Number.isInteger(degree) || degree < 1 || degree > 10 || xs.length <= degree) throw new Error('Degree must be 1–10 and smaller than the number of data pairs.');
  const center = xs.reduce((a, b) => a + b, 0) / xs.length;
  const scale = Math.max(...xs.map(x => Math.abs(x - center)));
  if (!scale) throw new Error('Regression needs distinct x values.');
  const z = xs.map(x => (x - center) / scale), size = degree + 1;
  const q = [], R = Array.from({ length: size }, () => Array(size).fill(0));
  for (let j = 0; j < size; j++) {
    const column = z.map(x => x ** j);
    for (let i = 0; i < j; i++) {
      R[i][j] = column.reduce((sum, value, k) => sum + q[i][k] * value, 0);
      for (let k = 0; k < column.length; k++) column[k] -= R[i][j] * q[i][k];
    }
    R[j][j] = Math.hypot(...column);
    if (R[j][j] < 1e-11) throw new Error('The regression design is rank deficient. Use more distinct x values or a lower degree.');
    q.push(column.map(value => value / R[j][j]));
  }
  const transformed = q.map(column => column.reduce((sum, value, i) => sum + value * ys[i], 0));
  const normalized = Array(size).fill(0);
  for (let i = degree; i >= 0; i--) normalized[i] = (transformed[i] - normalized.reduce((sum, value, j) => sum + (j > i ? R[i][j] * value : 0), 0)) / R[i][i];
  const coefficients = Array(size).fill(0);
  for (let j = 0; j < size; j++) for (let k = 0; k <= j; k++) coefficients[k] += normalized[j] * Number(math.combinations(j, k)) * (-center) ** (j - k) / scale ** j;
  const predict = x => normalized.reduceRight((sum, value) => sum * ((x - center) / scale) + value, 0);
  const residuals = ys.map((y, i) => y - predict(xs[i]));
  const sse = residuals.reduce((sum, value) => sum + value ** 2, 0);
  const meanY = ys.reduce((a, b) => a + b, 0) / ys.length;
  const sst = ys.reduce((sum, y) => sum + (y - meanY) ** 2, 0);
  const r2 = sst === 0 ? (sse < 1e-20 ? 1 : 0) : 1 - sse / sst;
  return { coefficients, equation: coefficients.map((c, i) => `${format(c)}${i ? `*x${i > 1 ? `^${i}` : ''}` : ''}`).join(' + ').replace(/\+ -/g, '- '), r2, predict, residuals, rmse: Math.sqrt(sse / ys.length) };
}

function probability(value, name = 'Probability') {
  value = finite(value, name);
  if (value < 0 || value > 1) throw new Error(`${name} must be between 0 and 1.`);
  return value;
}

export function distribution(type, args = {}) {
  const aliases = { gaussian: 'normal', t: 'studentt', 'student-t': 'studentt', chi2: 'chisquare', 'chi-square': 'chisquare', f: 'centralf' };
  type = String(type).toLowerCase(); type = aliases[type] || type;
  const operation = String(args.operation ?? args.method ?? 'pdf').toLowerCase();
  if (!['pdf', 'cdf', 'inv'].includes(operation)) throw new Error('Distribution operation must be pdf, cdf, or inv.');
  const x = operation === 'inv' ? probability(args.quantileProbability ?? args.quantile ?? args.probability ?? args.q ?? args.p ?? 0.5) : finite(args.x ?? 0, 'x');
  let family, parameters;
  switch (type) {
    case 'normal': family = jStat.normal; parameters = [finite(args.mean ?? 0, 'Mean'), positive(args.sd ?? args.std ?? 1, 'Standard deviation')]; break;
    case 'studentt': family = jStat.studentt; parameters = [positive(args.df ?? 10, 'Degrees of freedom')]; break;
    case 'chisquare': family = jStat.chisquare; parameters = [positive(args.df ?? 5, 'Degrees of freedom')]; break;
    case 'centralf': family = jStat.centralF; parameters = [positive(args.df1 ?? 5, 'Numerator degrees of freedom'), positive(args.df2 ?? 10, 'Denominator degrees of freedom')]; break;
    case 'exponential': family = jStat.exponential; parameters = [positive(args.rate ?? args.lambda ?? 1, 'Rate')]; break;
    case 'uniform': {
      const a = finite(args.a ?? 0, 'Lower bound'), b = finite(args.b ?? 1, 'Upper bound');
      if (b <= a) throw new Error('Uniform upper bound must exceed its lower bound.');
      family = jStat.uniform; parameters = [a, b]; break;
    }
    case 'beta': family = jStat.beta; parameters = [positive(args.alpha ?? 2, 'Alpha'), positive(args.beta ?? 2, 'Beta')]; break;
    case 'gamma': family = jStat.gamma; parameters = [positive(args.shape ?? 2, 'Shape'), positive(args.scale ?? 1, 'Scale')]; break;
    case 'binomial': {
      const n = finite(args.n ?? 10, 'Number of trials');
      if (!Number.isInteger(n) || n < 0 || n > 1000000) throw new Error('Number of trials must be an integer from 0 to 1,000,000.');
      family = jStat.binomial; parameters = [n, probability(args.success ?? args.prob ?? args.p ?? 0.5, 'Success probability')]; break;
    }
    case 'poisson': family = jStat.poisson; parameters = [positive(args.lambda ?? args.rate ?? 3, 'Rate')]; break;
    default: throw new Error(`Unknown probability distribution: ${type}.`);
  }
  if (operation === 'inv' && !family.inv) {
    if (x === 0) return 0;
    if (x === 1 && type === 'poisson') return Infinity;
    let lo = 0, hi = type === 'binomial' ? parameters[0] : Math.max(1, Math.ceil(parameters[0]));
    while (family.cdf(hi, ...parameters) < x && hi < 1e9) hi *= 2;
    if (hi >= 1e9) throw new Error('Discrete quantile search exceeded its limit.');
    while (lo < hi) { const mid = Math.floor((lo + hi) / 2); if (family.cdf(mid, ...parameters) >= x) hi = mid; else lo = mid + 1; }
    return lo;
  }
  if ((type === 'binomial' || type === 'poisson') && operation === 'pdf' && !Number.isInteger(x)) return 0;
  const value = family[operation](x, ...parameters);
  if (Number.isNaN(value)) throw new Error('The distribution is undefined for those parameters.');
  return value;
}

export function futureValue(present, annualRate, years, periods = 12, contribution = 0) {
  present = finite(present, 'Present value'); annualRate = finite(annualRate, 'Annual rate');
  years = finite(years, 'Years'); periods = positive(periods, 'Compounds per year'); contribution = finite(contribution, 'Periodic contribution');
  if (years < 0) throw new Error('Years cannot be negative.');
  const rate = annualRate / periods, count = years * periods;
  if (rate <= -1) throw new Error('Periodic interest rate must exceed -100%.');
  return rate === 0 ? present + contribution * count : present * (1 + rate) ** count + contribution * Math.expm1(count * Math.log1p(rate)) / rate;
}

export function loanPayment(principal, annualRate, years, periods = 12) {
  principal = positive(principal, 'Principal'); years = positive(years, 'Years'); periods = positive(periods, 'Payments per year');
  const rate = finite(annualRate, 'Annual interest rate') / periods, n = years * periods;
  if (rate <= -1) throw new Error('Periodic interest rate must exceed -100%.');
  return rate === 0 ? principal / n : principal * rate / -Math.expm1(-n * Math.log1p(rate));
}

export function npv(rate, cashflows) {
  rate = finite(rate, 'Discount rate');
  if (rate <= -1 || !Array.isArray(cashflows) || !cashflows.length) throw new Error('Provide cash flows and a discount rate greater than -100%.');
  return cashflows.reduce((sum, value, i) => sum + finite(value, 'Cash flow') / (1 + rate) ** i, 0);
}

export function irr(cashflows, guess = 0.1) {
  if (!Array.isArray(cashflows) || !cashflows.some(x => x > 0) || !cashflows.some(x => x < 0)) throw new Error('IRR requires at least one positive and one negative cash flow.');
  let rate = finite(guess, 'IRR guess');
  for (let i = 0; i < 100; i++) {
    const value = npv(rate, cashflows);
    if (Math.abs(value) < 1e-9) return rate;
    const slope = cashflows.reduce((sum, cash, t) => sum - t * cash / (1 + rate) ** (t + 1), 0);
    if (!Number.isFinite(slope) || Math.abs(slope) < 1e-14) break;
    const next = rate - value / slope;
    rate = next <= -1 ? (rate - 1) / 2 : next;
  }
  throw new Error('IRR did not converge; try another guess. Cash flows may have multiple IRRs.');
}
