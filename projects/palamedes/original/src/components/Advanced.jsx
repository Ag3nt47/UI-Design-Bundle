import React, { useState } from 'react';
import { ArrowRight, Download, FunctionSquare, Grid2X2, Sigma, Sparkles, Calculator, RotateCcw } from 'lucide-react';
import { math, symbolic, format, integrate, findRoot, solveODE, solveLinearSystem, regression, describe, distribution } from '../lib/engine.js';
import { parseData, parseMatrix, rref, finiteNumber, convertBase, compoundInterest, loanPayment, triangle, meanInference } from '../lib/advanced.js';
import MathText from './Math.jsx';

const number = value => typeof value === 'number' ? Number(value.toPrecision(11)).toLocaleString('en-US', { maximumFractionDigits: 10 }) : String(value);
const rawFormat = value => typeof value === 'string' ? value : format(value);
function Field({ label, children, wide = false }) {
  return <label className={`field${wide ? ' full-span' : ''}`}><span>{label}</span>{children}</label>;
}
function ErrorMessage({ error }) { return error ? <div role="alert" className="error-message">{error}</div> : null; }
function Metric({ label, value }) { return <div className="metric"><span className="muted">{label}</span><strong>{number(value)}</strong></div>; }
function downloadCSV(rows, name) {
  const csv = rows.map(row => row.map(v => `"${String(v).replaceAll('"', '""')}"`).join(',')).join('\n');
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  const a = document.createElement('a'); a.href = url; a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function useCalculation() {
  const [result, setResult] = useState(null), [error, setError] = useState('');
  const run = callback => { try { setResult(callback()); setError(''); } catch (e) { setError(e.message || String(e)); setResult(null); } };
  return { result, error, run, clear: () => { setResult(null); setError(''); } };
}

const symbolicOperations = [
  ['simplify', 'Simplify'], ['expand', 'Expand'], ['factor', 'Factor'], ['derivative', 'Differentiate'],
  ['integrate', 'Indefinite integral'], ['definite-integral', 'Definite integral'], ['solve', 'Solve equation'],
  ['limit', 'Limit'], ['taylor', 'Taylor series'], ['sum', 'Finite sum'], ['laplace', 'Laplace transform'], ['inverse-laplace', 'Inverse Laplace transform'],
];

function symbolicInput(text) {
  if (!text?.trim()) return { expression: 'x^3 - 6*x^2 + 11*x - 6', operation: 'factor' };
  const m = text.trim().match(/^(differentiate|derivative|integrate|integral|simplify|factor|expand|solve)\b\s*(?:of\s+)?([\s\S]*)$/i);
  if (!m) return { expression: text.trim(), operation: 'simplify' };
  const aliases = { differentiate: 'derivative', integral: 'integrate' };
  const variableSuffix = m[2].match(/\s+(?:d([a-z])|(?:with respect to|wrt)\s+([a-z]))\s*$/i);
  return { expression: (variableSuffix ? m[2].slice(0, variableSuffix.index) : m[2]).trim(), operation: aliases[m[1].toLowerCase()] || m[1].toLowerCase(), variable: variableSuffix ? (variableSuffix[1] || variableSuffix[2]) : 'x' };
}
function SymbolicPanel({ initialInput }) {
  const initial = symbolicInput(initialInput);
  const [expression, setExpression] = useState(initial.expression);
  const [operation, setOperation] = useState(initial.operation);
  const [variable, setVariable] = useState(initial.variable || 'x');
  const [lower, setLower] = useState('0'), [upper, setUpper] = useState('1');
  const [at, setAt] = useState('0'), [order, setOrder] = useState('1'), [target, setTarget] = useState('s');
  const { result, error, run, clear } = useCalculation();
  const calculate = e => {
    e?.preventDefault();
    run(() => symbolic(operation, expression, variable, { lower, upper, at, point: at, order: Number(order), degree: Number(order), target }));
  };
  const example = (op, text, v = 'x') => { setOperation(op); setExpression(text); setVariable(v); clear(); };
  return <div className="two-col advanced-layout">
    <section className="panel">
      <div className="panel-header"><div><span className="eyebrow">COMPUTER ALGEBRA</span><h2>Let the symbols do the work.</h2></div><FunctionSquare size={23} /></div>
      <form className="panel-body stack" onSubmit={calculate}>
        <div className="form-grid">
          <Field label="Operation"><select aria-label="Symbolic operation" value={operation} onChange={e => { setOperation(e.target.value); if (e.target.value === 'inverse-laplace') setTarget('t'); if (e.target.value === 'laplace') setTarget('s'); clear(); }}>{symbolicOperations.map(([v, text]) => <option key={v} value={v}>{text}</option>)}</select></Field>
          <Field label="Variable"><input aria-label="Symbolic variable" value={variable} onChange={e => setVariable(e.target.value)} required pattern="[A-Za-z][A-Za-z0-9_]*" /></Field>
          <Field label={operation === 'solve' ? 'Equation (or expression equal to zero)' : 'Expression'} wide><textarea aria-label="Symbolic expression" className="code-input" rows={3} value={expression} onChange={e => setExpression(e.target.value)} spellCheck={false} required /></Field>
          {(operation === 'definite-integral' || operation === 'sum') && <><Field label="Lower bound"><input value={lower} onChange={e => setLower(e.target.value)} /></Field><Field label="Upper bound"><input value={upper} onChange={e => setUpper(e.target.value)} /></Field></>}
          {(operation === 'limit' || operation === 'taylor') && <Field label="Evaluate around"><input value={at} onChange={e => setAt(e.target.value)} placeholder="0 or Infinity" /></Field>}
          {(operation === 'taylor' || operation === 'derivative') && <Field label={operation === 'derivative' ? 'Derivative order' : 'Series order'}><input type="number" min={operation === 'taylor' ? '0' : '1'} max="12" value={order} onChange={e => setOrder(e.target.value)} /></Field>}
          {(operation === 'laplace' || operation === 'inverse-laplace') && <Field label="Transform variable"><input value={target} onChange={e => setTarget(e.target.value)} pattern="[A-Za-z][A-Za-z0-9_]*" required /></Field>}
        </div>
        <ErrorMessage error={error} />
        <button className="button button-primary" type="submit"><Sparkles size={17} /> Calculate <ArrowRight size={17} /></button>
      </form>
      {result && <div className="panel-body result-box" aria-live="polite"><span className="eyebrow">RESULT</span><MathText tex={result.latex || result.value} /><code className="wrap-code">{result.value}</code>{operation === 'integrate' && <p className="muted">Add an arbitrary constant C for the family of antiderivatives.</p>}{result.method && <p className="muted">{result.method}</p>}<p className="muted">Symbolic results depend on the expression’s domain. Check excluded values and branch conditions.</p></div>}
    </section>
    <aside className="stack">
      <section className="panel"><div className="panel-header"><h3>A few starting points</h3></div><div className="panel-body example-list">
        <button className="example-button" onClick={() => example('factor', 'x^3-6*x^2+11*x-6')}><span>Factor a polynomial</span><code>x³ − 6x² + 11x − 6</code></button>
        <button className="example-button" onClick={() => { example('derivative', 'sin(x)*exp(x)'); setOrder('1'); }}><span>Product & chain rules</span><code>d/dx [sin(x) · eˣ]</code></button>
        <button className="example-button" onClick={() => example('integrate', 'x*cos(x)')}><span>Integration</span><code>∫ x cos(x) dx</code></button>
        <button className="example-button" onClick={() => { example('limit', 'sin(x)/x'); setAt('0'); }}><span>Find a limit</span><code>lim sin(x)/x as x → 0</code></button>
        <button className="example-button" onClick={() => example('solve', 'x^2-5*x+6=0')}><span>Solve an equation</span><code>x² − 5x + 6 = 0</code></button>
        <button className="example-button" onClick={() => { example('taylor', 'exp(x)'); setOrder('5'); setAt('0'); }}><span>Taylor expansion</span><code>eˣ around x = 0</code></button>
      </div></section>
      <section className="panel"><div className="panel-body"><h3>Write naturally, calculate precisely</h3><p className="muted">Use <code>^</code> for powers, <code>*</code> for multiplication, and parentheses for function arguments. Transcendental expressions may remain unevaluated. Equation solving can omit branches; inspect and substitute candidate roots.</p></div></section>
    </aside>
  </div>;
}

const matrixOperations = [['det', 'Determinant'], ['inv', 'Inverse'], ['transpose', 'Transpose'], ['rref', 'Row-reduced echelon form'], ['rank', 'Rank'], ['eigs', 'Eigenvalues & eigenvectors'], ['multiply', 'A × B'], ['add', 'A + B'], ['solve', 'Solve A x = b'], ['lup', 'LU decomposition']];

function MatrixView({ value }) {
  const a = value?.toArray ? value.toArray() : value;
  if (Array.isArray(a) && a.length && Array.isArray(a[0])) return <div className="matrix-scroll"><table className="data-table matrix-table"><tbody>{a.map((row, i) => <tr key={i}>{row.map((v, j) => <td key={j}>{typeof v === 'number' ? number(v) : rawFormat(v)}</td>)}</tr>)}</tbody></table></div>;
  return <pre className="wrap-code">{rawFormat(a)}</pre>;
}

function MatricesPanel({ initialInput }) {
  const [aText, setA] = useState(initialInput?.trim() ? initialInput.slice(Math.max(0, initialInput.indexOf('['))).trim() : '[[2, 1], [1, 3]]'), [bText, setB] = useState('[[1, 0], [0, 1]]');
  const [bVector, setBVector] = useState('5, 7'), [operation, setOperation] = useState('inv');
  const { result, error, run } = useCalculation();
  const calculate = e => {
    e.preventDefault();
    run(() => {
      const A = parseMatrix(aText);
      let value, check = '';
      if (operation === 'rref') { const r = rref(A); value = r.matrix; check = `Rank ${r.rank}; numerical pivot tolerance ${r.tolerance}.`; }
      else if (operation === 'rank') value = rref(A).rank;
      else if (operation === 'solve') {
        const b = parseData(bVector);
        if (A.length !== A[0].length || b.length !== A.length) throw new Error('A must be square and b must have one entry per row.');
        value = solveLinearSystem(A, b);
        const vector = value?.toArray ? value.toArray().flat() : value.flat();
        const residual = Math.max(...A.map((row, i) => Math.abs(row.reduce((s, v, j) => s + v * vector[j], 0) - b[i])));
        check = `Substitution check: maximum residual |A x − b| = ${residual.toExponential(3)}.`;
      } else if (operation === 'multiply' || operation === 'add') value = math[operation](A, parseMatrix(bText));
      else if (operation === 'eigs') {
        if (A.length !== A[0].length) throw new Error('Eigenvalues require a square matrix.');
        value = math.eigs(A);
      } else value = math[operation](A);
      if (operation === 'inv') {
        const product = math.multiply(A, value);
        const p = product.toArray ? product.toArray() : product;
        const residual = Math.max(...p.flatMap((row, i) => row.map((v, j) => Math.abs(v - (i === j ? 1 : 0)))));
        check = `Independent product check: maximum |A A⁻¹ − I| = ${residual.toExponential(3)}.`;
      }
      return { value, check };
    });
  };
  return <div className="two-col advanced-layout">
    <section className="panel"><div className="panel-header"><div><span className="eyebrow">LINEAR ALGEBRA</span><h2>Think in dimensions.</h2></div><Grid2X2 size={23} /></div>
      <form className="panel-body stack" onSubmit={calculate}><Field label="Operation"><select aria-label="Matrix operation" value={operation} onChange={e => setOperation(e.target.value)}>{matrixOperations.map(([v, t]) => <option key={v} value={v}>{t}</option>)}</select></Field>
        <Field label="Matrix A"><textarea aria-label="Matrix A" className="code-input" rows={5} value={aText} onChange={e => setA(e.target.value)} spellCheck={false} /></Field>
        {(operation === 'multiply' || operation === 'add') && <Field label="Matrix B"><textarea aria-label="Matrix B" className="code-input" rows={4} value={bText} onChange={e => setB(e.target.value)} spellCheck={false} /></Field>}
        {operation === 'solve' && <Field label="Vector b (comma-separated)"><input aria-label="Vector b" value={bVector} onChange={e => setBVector(e.target.value)} /></Field>}
        <ErrorMessage error={error} /><button className="button button-primary" type="submit">Calculate <ArrowRight size={17} /></button>
      </form>
    </section>
    <section className="panel"><div className="panel-header"><h3>{result ? 'Result' : 'Your matrix, transformed'}</h3><span className="badge">NUMERICAL</span></div><div className="panel-body stack" aria-live="polite">{result ? <><div className="result-box"><MatrixView value={result.value} /></div>{result.check && <p className="verification-note">{result.check}</p>}</> : <><div className="empty-math">[ A ]</div><p className="muted">Enter rows as nested arrays. Determinants, inverses, eigenvalues, and direct system solving require square matrices.</p><button className="button" onClick={() => { setA('[[1, 2, 3], [2, 4, 6], [1, 0, 1]]'); setOperation('rref'); }}><RotateCcw size={16} /> Try a row reduction</button></>}<p className="muted">Floating-point operations can lose accuracy on nearly singular matrices. RREF and rank use a numerical tolerance.</p></div></section>
  </div>;
}

function StatsPanel({ initialInput }) {
  const [mode, setMode] = useState('describe');
  const [xText, setX] = useState(initialInput?.trim() ? initialInput.trim().replace(/^(?:statistics|stats|mean|median|average)\s*(?:of\s+)?/i, '') : '2, 4, 6, 8, 10'), [yText, setY] = useState('3.1, 5.2, 6.8, 9.1, 11.2');
  const [degree, setDegree] = useState('1'), [confidence, setConfidence] = useState('0.95'), [nullMean, setNullMean] = useState('0');
  const [dist, setDist] = useState('normal'), [distOp, setDistOp] = useState('cdf');
  const [params, setParams] = useState({ x: '1.96', q: '0.975', mean: '0', sd: '1', n: '10', p: '0.5', lambda: '3', df: '10', rate: '1', a: '0', b: '1' });
  const { result, error, run, clear } = useCalculation();
  const update = (k, v) => setParams(old => ({ ...old, [k]: v }));
  const calculate = e => {
    e.preventDefault();
    run(() => {
      if (mode === 'distribution') {
        const args = Object.fromEntries(Object.entries(params).map(([k, v]) => [k, finiteNumber(v, k)]));
        if (dist === 'normal' && args.sd <= 0) throw new Error('Standard deviation must be positive.');
        if (dist === 'binomial' && (!Number.isInteger(args.n) || args.n < 0 || args.p < 0 || args.p > 1)) throw new Error('Binomial n must be a nonnegative integer and p must lie between 0 and 1.');
        if (dist === 'poisson' && args.lambda <= 0) throw new Error('Poisson λ must be positive.');
        if (['studentt', 'chisquare'].includes(dist) && args.df <= 0) throw new Error('Degrees of freedom must be positive.');
        if (dist === 'exponential' && args.rate <= 0) throw new Error('Rate must be positive.');
        if (dist === 'uniform' && args.a >= args.b) throw new Error('The upper bound must exceed the lower bound.');
        if (distOp === 'inv' && (args.q <= 0 || args.q >= 1)) throw new Error('Quantile probability must be strictly between 0 and 1.');
        if (distOp === 'pdf' && ['binomial', 'poisson'].includes(dist) && !Number.isInteger(args.x)) throw new Error('Use an integer x for a discrete probability mass.');
        const value = distribution(dist, { ...args, operation: distOp, probability: args.q, quantileProbability: args.q });
        return { type: 'distribution', value, dist, distOp };
      }
      const xs = parseData(xText);
      if (mode === 'regression') {
        const ys = parseData(yText);
        if (xs.length !== ys.length) throw new Error('X and Y must contain the same number of observations.');
        const d = Number(degree);
        if (!Number.isInteger(d) || d < 1 || d > 8 || xs.length <= d) throw new Error('Use degree 1–8 with more observations than the degree.');
        const r = regression(xs, ys, d);
        return { type: 'regression', ...r, xs, ys };
      }
      if (mode === 'inference') return { type: 'inference', ...meanInference(xs, confidence, nullMean) };
      return { type: 'describe', ...describe(xs), xs };
    });
  };
  const distFields = dist === 'normal' ? [['mean', 'Mean μ'], ['sd', 'Standard deviation σ']] : dist === 'binomial' ? [['n', 'Trials n'], ['p', 'Success probability p']] : dist === 'poisson' ? [['lambda', 'Mean count λ']] : ['studentt', 'chisquare'].includes(dist) ? [['df', 'Degrees of freedom']] : dist === 'exponential' ? [['rate', 'Rate λ']] : [['a', 'Lower bound a'], ['b', 'Upper bound b']];
  return <div className="two-col advanced-layout">
    <section className="panel"><div className="panel-header"><div><span className="eyebrow">STATISTICS & PROBABILITY</span><h2>Make sense of the numbers.</h2></div><Sigma size={23} /></div>
      <form className="panel-body stack" onSubmit={calculate}><Field label="Analysis"><select aria-label="Statistics analysis" value={mode} onChange={e => { setMode(e.target.value); clear(); }}><option value="describe">Descriptive statistics</option><option value="regression">Polynomial regression</option><option value="inference">Mean confidence interval & t test</option><option value="distribution">Probability distributions</option></select></Field>
        {mode !== 'distribution' ? <><Field label={mode === 'regression' ? 'X values' : 'Data values'}><textarea aria-label="Statistics data" className="code-input" rows={4} value={xText} onChange={e => setX(e.target.value)} /></Field>{mode === 'regression' && <><Field label="Y values"><textarea aria-label="Y data" className="code-input" rows={3} value={yText} onChange={e => setY(e.target.value)} /></Field><Field label="Polynomial degree"><input type="number" min="1" max="8" value={degree} onChange={e => setDegree(e.target.value)} /></Field></>}{mode === 'inference' && <><div className="form-grid"><Field label="Confidence level"><input aria-label="Confidence level" type="number" step="0.01" min="0.01" max="0.99" value={confidence} onChange={e => setConfidence(e.target.value)} /></Field><Field label="Null mean μ₀"><input aria-label="Null mean" type="number" step="any" value={nullMean} onChange={e => setNullMean(e.target.value)} /></Field></div><p className="muted">One-sample, two-sided Student-t test. Assumes independent observations and an approximately normal sampling distribution.</p></>}</> : <><div className="form-grid"><Field label="Distribution"><select aria-label="Distribution" value={dist} onChange={e => { setDist(e.target.value); if (['binomial', 'poisson'].includes(e.target.value) && distOp === 'inv') setDistOp('cdf'); }}><option value="normal">Normal</option><option value="binomial">Binomial</option><option value="poisson">Poisson</option><option value="studentt">Student t</option><option value="chisquare">Chi-square</option><option value="exponential">Exponential</option><option value="uniform">Uniform</option></select></Field><Field label="Operation"><select aria-label="Distribution operation" value={distOp} onChange={e => setDistOp(e.target.value)}><option value="cdf">Cumulative probability P(X ≤ x)</option><option value="pdf">Density / probability mass</option>{!['binomial', 'poisson'].includes(dist) && <option value="inv">Inverse CDF / quantile</option>}</select></Field>{distFields.map(([k, label]) => <Field label={label} key={k}><input type="number" step="any" value={params[k]} onChange={e => update(k, e.target.value)} /></Field>)}<Field label={distOp === 'inv' ? 'Quantile probability' : 'Value x'}><input aria-label="Distribution value" type="number" step="any" value={params[distOp === 'inv' ? 'q' : 'x']} onChange={e => update(distOp === 'inv' ? 'q' : 'x', e.target.value)} /></Field></div><p className="muted">For continuous distributions, PDF is a density, not a point probability. CDF is the probability to the left of x.</p></>}
        <ErrorMessage error={error} /><button type="submit" className="button button-primary">Analyze <ArrowRight size={17} /></button>
      </form>
    </section>
    <section className="panel"><div className="panel-header"><h3>Results</h3><span className="badge">DATA LAB</span></div><div className="panel-body stack" aria-live="polite">
      {!result && <><div className="empty-math">σ</div><p className="muted">Paste numbers separated by commas, spaces, semicolons, or new lines. Your data stays in this browser.</p></>}
      {result?.type === 'describe' && <><div className="metrics-grid">{[['Count', 'n'], ['Mean', 'mean'], ['Median', 'median'], ['Sum', 'sum'], ['Minimum', 'min'], ['Maximum', 'max'], ['Range', 'range'], ['Sample std. deviation', 'sampleStdDev'], ['Population std. deviation', 'stdDev'], ['Sample variance', 'sampleVariance'], ['First quartile', 'q1'], ['Third quartile', 'q3']].map(([label, key]) => <Metric key={key} label={label} value={result[key] ?? 'undefined'} />)}</div><button className="button" onClick={() => downloadCSV([['index', 'value'], ...result.xs.map((x, i) => [i + 1, x])], 'palamedes-data.csv')}><Download size={16} /> Export CSV</button></>}
      {result?.type === 'regression' && <><div className="result-box"><span className="eyebrow">LEAST-SQUARES FIT</span><p className="large-result wrap-code">{result.equation}</p></div><Metric label="R² — coefficient of determination" value={result.r2} /><div className="matrix-scroll"><table className="data-table"><thead><tr><th>x</th><th>Observed y</th><th>Predicted y</th><th>Residual</th></tr></thead><tbody>{result.xs.slice(0, 30).map((x, i) => <tr key={i}><td>{number(x)}</td><td>{number(result.ys[i])}</td><td>{number(result.predict(x))}</td><td>{number(result.ys[i] - result.predict(x))}</td></tr>)}</tbody></table></div><button className="button" onClick={() => downloadCSV([['x', 'y', 'predicted', 'residual'], ...result.xs.map((x, i) => [x, result.ys[i], result.predict(x), result.ys[i] - result.predict(x)])], 'palamedes-regression.csv')}><Download size={16} /> Export fit</button><p className="muted">High-degree or poorly scaled inputs can produce ill-conditioned fits. Correlation does not establish causation.</p></>}
      {result?.type === 'inference' && <><div className="result-box"><span className="eyebrow">{number(result.confidence * 100)}% CONFIDENCE INTERVAL FOR THE MEAN</span><p className="large-result">[{number(result.lower)}, {number(result.upper)}]</p></div><div className="metrics-grid"><Metric label="Sample mean" value={result.mean} /><Metric label="Standard error" value={result.standardError} /><Metric label="t statistic" value={result.t} /><Metric label="Degrees of freedom" value={result.df} /><Metric label="Two-sided p value" value={result.pValue} /></div><p className="muted">A p value describes compatibility with the stated null model. It is not the probability that the null hypothesis is true.</p></>}
      {result?.type === 'distribution' && <div className="result-box"><span className="eyebrow">{result.distOp === 'inv' ? 'QUANTILE' : result.distOp === 'cdf' ? 'CUMULATIVE PROBABILITY' : 'DENSITY / MASS'}</span><p className="large-result">{rawFormat(result.value)}</p></div>}
    </div></section>
  </div>;
}

const toolNames = [['units', 'Unit converter'], ['finance', 'Finance'], ['numerics', 'Numerical methods'], ['geometry', 'Geometry'], ['programmer', 'Number bases']];
function ToolsPanel() {
  const [tool, setTool] = useState('units');
  const [values, setValues] = useState({ amount: '100', fromUnit: 'cm', toUnit: 'inch', principal: '10000', rate: '5', years: '10', compounds: '12', months: '60', financeMode: 'compound', numericMode: 'integral', expression: 'sin(x)', lower: '0', upper: 'pi', guess: '1', x0: '0', y0: '1', end: '5', step: '0.05', fft: '1, 0, -1, 0', geometryMode: 'triangle', a: '3', b: '4', c: '5', radius: '5', height: '10', integer: '255', fromBase: '10', toBase: '2' });
  const { result, error, run, clear } = useCalculation();
  const set = (k, v) => setValues(old => ({ ...old, [k]: v }));
  const field = (label, key, type = 'text', extra = {}) => <Field label={label} key={key}><input aria-label={label} type={type} step={type === 'number' ? 'any' : undefined} value={values[key]} onChange={e => set(key, e.target.value)} {...extra} /></Field>;
  const calculate = e => {
    e.preventDefault();
    run(() => {
      const v = values;
      if (tool === 'units') {
        const amount = finiteNumber(v.amount, 'Amount');
        return { title: 'Converted value', value: math.unit(amount, v.fromUnit).to(v.toUnit).format({ precision: 14 }), note: 'Converted using compatible physical dimensions. Temperature units use their appropriate offsets.' };
      }
      if (tool === 'programmer') return { title: `Base ${v.toBase}`, value: convertBase(v.integer, v.fromBase, v.toBase), note: 'Exact signed-integer conversion with BigInt, including values larger than 2⁵³.' };
      if (tool === 'finance') {
        if (v.financeMode === 'compound') return { title: 'Compound growth', metrics: Object.entries(compoundInterest(v.principal, v.rate, v.years, v.compounds)), formula: 'A = P(1 + r/n)^(nt)', note: 'Rate is annual percent; no recurring deposits, fees, or taxes.' };
        return { title: 'Amortized loan', metrics: Object.entries(loanPayment(v.principal, v.rate, v.months)), formula: 'M = P i / [1 − (1+i)^(−n)]', note: 'Fixed annual percent rate, equal monthly payments, no fees or taxes.' };
      }
      if (tool === 'geometry') {
        if (v.geometryMode === 'triangle') return { title: 'Triangle from three sides', metrics: Object.entries(triangle(v.a, v.b, v.c)), note: 'Angles are in degrees; area is in squared input units.' };
        const r = finiteNumber(v.radius, 'Radius');
        if (r < 0) throw new Error('Radius must be nonnegative.');
        if (v.geometryMode === 'circle') return { title: 'Circle', metrics: [['area', Math.PI * r * r], ['circumference', 2 * Math.PI * r], ['diameter', 2 * r]], formula: 'A = πr²; C = 2πr' };
        if (v.geometryMode === 'sphere') return { title: 'Sphere', metrics: [['surfaceArea', 4 * Math.PI * r * r], ['volume', 4 / 3 * Math.PI * r ** 3]], formula: 'S = 4πr²; V = 4πr³/3' };
        const h = finiteNumber(v.height, 'Height');
        if (h < 0) throw new Error('Height must be nonnegative.');
        return { title: 'Cylinder', metrics: [['volume', Math.PI * r * r * h], ['surfaceArea', 2 * Math.PI * r * (r + h)]], formula: 'V = πr²h; S = 2πr(r+h)' };
      }
      if (tool === 'numerics') {
        if (v.numericMode === 'integral') return { title: 'Definite integral (numerical)', value: integrate(v.expression, 'x', Number(math.evaluate(v.lower)), Number(math.evaluate(v.upper))), note: 'Numerical quadrature. Discontinuities, singularities, and oscillations require care.' };
        if (v.numericMode === 'root') {
          const x = findRoot(v.expression, 'x', finiteNumber(v.guess, 'Initial guess'));
          const residual = math.evaluate(v.expression, { x });
          return { title: 'Root (numerical)', value: x, note: `Substitution check: f(x) = ${rawFormat(residual)}. A root search returns a candidate near the initial guess, not all roots.` };
        }
        if (v.numericMode === 'fft') return { title: 'Discrete Fourier transform', value: math.fft(parseData(v.fft)), note: 'Forward unnormalized FFT; bins are indexed from zero. Sampling rate is not inferred.' };
        const points = solveODE(v.expression, finiteNumber(v.x0, 'Initial x'), finiteNumber(v.y0, 'Initial y'), finiteNumber(v.end, 'Final x'), finiteNumber(v.step, 'Step size'));
        return { title: 'ODE trajectory · RK4', points, note: 'Fixed-step fourth-order Runge–Kutta for dy/dx = f(x,y). Reduce the step and compare to assess error; stiff equations may require another solver.' };
      }
    });
  };
  const labelize = key => key.replace(/([A-Z])/g, ' $1').replace(/^./, c => c.toUpperCase());
  return <div className="stack"><div className="tool-tabs" role="tablist" aria-label="Toolbox">{toolNames.map(([key, name]) => <button role="tab" aria-selected={tool === key} key={key} className={`button ${tool === key ? 'button-primary' : ''}`} onClick={() => { setTool(key); clear(); }}>{name}</button>)}</div><div className="two-col advanced-layout">
    <section className="panel"><div className="panel-header"><div><span className="eyebrow">THE TOOLBOX</span><h2>{toolNames.find(([key]) => key === tool)?.[1]}</h2></div><Calculator size={23} /></div><form className="panel-body stack" onSubmit={calculate}>
      {tool === 'units' && <><div className="form-grid">{field('Amount', 'amount', 'number')}{field('From unit', 'fromUnit')}{field('To unit', 'toUnit')}</div><div className="row"><button type="button" className="button" onClick={() => { set('fromUnit', 'degC'); set('toUnit', 'degF'); set('amount', '20'); }}>Temperature</button><button type="button" className="button" onClick={() => { set('fromUnit', 'km/h'); set('toUnit', 'm/s'); set('amount', '100'); }}>Speed</button><button type="button" className="button" onClick={() => { set('fromUnit', 'kg*m/s^2'); set('toUnit', 'N'); set('amount', '1'); }}>Compound units</button></div><p className="muted">Try cm → inch, kg → lb, rad → deg, degC → degF, kWh → J, or compound dimensions such as m/s.</p></>}
      {tool === 'programmer' && <div className="form-grid">{field('Signed integer', 'integer')}{field('From base (2–36)', 'fromBase', 'number', { min: 2, max: 36 })}{field('To base (2–36)', 'toBase', 'number', { min: 2, max: 36 })}</div>}
      {tool === 'finance' && <><Field label="Calculation"><select value={values.financeMode} onChange={e => set('financeMode', e.target.value)}><option value="compound">Compound interest</option><option value="loan">Monthly loan payment</option></select></Field><div className="form-grid">{field('Principal', 'principal', 'number')}{field('Annual interest (%)', 'rate', 'number')}{values.financeMode === 'compound' ? <>{field('Years', 'years', 'number')}{field('Compounding periods / year', 'compounds', 'number')}</> : field('Number of months', 'months', 'number')}</div></>}
      {tool === 'geometry' && <><Field label="Shape"><select value={values.geometryMode} onChange={e => set('geometryMode', e.target.value)}><option value="triangle">Triangle (three sides)</option><option value="circle">Circle</option><option value="sphere">Sphere</option><option value="cylinder">Cylinder</option></select></Field><div className="form-grid">{values.geometryMode === 'triangle' ? <>{field('Side a', 'a', 'number')}{field('Side b', 'b', 'number')}{field('Side c', 'c', 'number')}</> : <>{field('Radius', 'radius', 'number')}{values.geometryMode === 'cylinder' && field('Height', 'height', 'number')}</>}</div></>}
      {tool === 'numerics' && <><Field label="Method"><select aria-label="Numerical method" value={values.numericMode} onChange={e => { set('numericMode', e.target.value); if (e.target.value === 'ode') set('expression', 'y-x^2+1'); if (e.target.value === 'root') set('expression', 'x^3-x-2'); if (e.target.value === 'integral') set('expression', 'sin(x)'); }}><option value="integral">Numerical definite integral</option><option value="root">Numerical root</option><option value="ode">Differential equation (RK4)</option><option value="fft">Fast Fourier transform</option></select></Field>{values.numericMode === 'fft' ? <Field label="Real samples"><textarea value={values.fft} onChange={e => set('fft', e.target.value)} rows={4} /></Field> : <>{field(values.numericMode === 'ode' ? 'dy/dx = f(x, y)' : 'f(x)', 'expression')}<div className="form-grid">{values.numericMode === 'integral' && <>{field('Lower bound', 'lower')}{field('Upper bound', 'upper')}</>}{values.numericMode === 'root' && field('Initial guess', 'guess', 'number')}{values.numericMode === 'ode' && <>{field('Initial x', 'x0', 'number')}{field('Initial y', 'y0', 'number')}{field('Final x', 'end', 'number')}{field('Step size', 'step', 'number')}</>}</div></>}</>}
      <ErrorMessage error={error} /><button className="button button-primary" type="submit">Calculate <ArrowRight size={17} /></button>
    </form></section>
    <section className="panel"><div className="panel-header"><h3>{result?.title || 'Ready when you are'}</h3></div><div className="panel-body stack" aria-live="polite">{result ? <>{result.value !== undefined && <div className="result-box"><p className="large-result wrap-code">{rawFormat(result.value)}</p></div>}{result.formula && <code className="wrap-code">{result.formula}</code>}{result.metrics && <div className="metrics-grid">{result.metrics.map(([key, value]) => <Metric key={key} label={labelize(key)} value={value} />)}</div>}{result.points && <><div className="matrix-scroll"><table className="data-table"><thead><tr><th>x</th><th>y</th></tr></thead><tbody>{result.points.slice(0, 20).map((p, i) => <tr key={i}><td>{number(p.x)}</td><td>{number(p.y)}</td></tr>)}</tbody></table></div><p className="muted">Showing {Math.min(20, result.points.length)} of {result.points.length} computed points.</p><button className="button" onClick={() => downloadCSV([['x', 'y'], ...result.points.map(p => [p.x, p.y])], 'palamedes-ode.csv')}><Download size={16} /> Export trajectory</button></>}{result.note && <p className="muted">{result.note}</p>}</> : <><div className="empty-math">∞</div><p className="muted">From everyday conversions to numerical analysis, keep the useful tools close at hand.</p></>}</div></section>
  </div></div>;
}

export default function Advanced({ tab, initialInput }) {
  if (tab === 'symbolic') return <SymbolicPanel initialInput={initialInput} />;
  if (tab === 'matrices') return <MatricesPanel initialInput={initialInput} />;
  if (tab === 'statistics') return <StatsPanel initialInput={initialInput} />;
  return <ToolsPanel />;
}
