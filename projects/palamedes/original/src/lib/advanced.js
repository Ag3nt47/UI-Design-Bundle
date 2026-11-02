import jstatModule from 'jstat';

const jStat = jstatModule.jStat || jstatModule;

export function finiteNumber(value, name = 'Value') {
  if (typeof value === 'string' && !value.trim()) throw new Error(`${name} must be a finite number.`);
  const n = Number(value);
  if (!Number.isFinite(n)) throw new Error(`${name} must be a finite number.`);
  return n;
}

export function parseData(text) {
  const parts = String(text).trim().replace(/^\[([\s\S]*)\]$/, '$1').split(/[\s,;]+/).filter(Boolean);
  if (!parts.length) throw new Error('Enter at least one number.');
  if (parts.length > 10000) throw new Error('Use at most 10,000 data points.');
  return parts.map((v, i) => finiteNumber(v, `Data point ${i + 1}`));
}

export function parseMatrix(text) {
  let a;
  try { a = typeof text === 'string' ? JSON.parse(text) : text; }
  catch { throw new Error('Use a JSON matrix, for example [[1,2],[3,4]].'); }
  if (!Array.isArray(a) || !a.length || a.length > 100 || !Array.isArray(a[0]) || !a[0].length || a[0].length > 100) {
    throw new Error('Enter a nonempty matrix with at most 100 rows and columns.');
  }
  const width = a[0].length;
  if (a.some(row => !Array.isArray(row) || row.length !== width)) throw new Error('Every matrix row must have the same length.');
  return a.map((row, i) => row.map((v, j) => {
    if (typeof v !== 'number' || !Number.isFinite(v)) throw new Error(`Entry (${i + 1}, ${j + 1}) must be a finite number.`);
    return v;
  }));
}

export function rref(input, tolerance = 1e-10) {
  const a = parseMatrix(input).map(row => [...row]);
  const rows = a.length, cols = a[0].length;
  const scale = Math.max(...a.flat().map(Math.abs));
  const epsilon = tolerance * scale;
  let pivotRow = 0;
  for (let col = 0; col < cols && pivotRow < rows; col++) {
    let best = pivotRow;
    for (let row = pivotRow + 1; row < rows; row++) if (Math.abs(a[row][col]) > Math.abs(a[best][col])) best = row;
    if (Math.abs(a[best][col]) <= epsilon) {
      for (let row = pivotRow; row < rows; row++) a[row][col] = 0;
      continue;
    }
    [a[pivotRow], a[best]] = [a[best], a[pivotRow]];
    const divisor = a[pivotRow][col];
    a[pivotRow] = a[pivotRow].map(v => v / divisor);
    a[pivotRow][col] = 1;
    for (let row = 0; row < rows; row++) {
      if (row === pivotRow) continue;
      const factor = a[row][col];
      a[row] = a[row].map((v, j) => v - factor * a[pivotRow][j]);
      a[row][col] = 0;
    }
    pivotRow++;
  }
  return { matrix: a.map(row => row.map(v => Object.is(v, -0) ? 0 : v)), rank: pivotRow, tolerance };
}

const DIGITS = '0123456789abcdefghijklmnopqrstuvwxyz';
export function convertBase(input, from = 10, to = 2) {
  from = Number(from); to = Number(to);
  if (!Number.isInteger(from) || !Number.isInteger(to) || from < 2 || from > 36 || to < 2 || to > 36) throw new Error('Bases must be integers between 2 and 36.');
  const source = String(input).trim().toLowerCase();
  const negative = source.startsWith('-');
  const digits = source.replace(/^[-+]/, '');
  if (!digits || !/^[0-9a-z]+$/.test(digits)) throw new Error('Enter a signed integer without prefixes, spaces, or a decimal point.');
  if (digits.length > 10000) throw new Error('Use at most 10,000 digits.');
  let value = 0n;
  for (const char of digits) {
    const digit = DIGITS.indexOf(char);
    if (digit < 0 || digit >= from) throw new Error(`“${char}” is not a digit in base ${from}.`);
    value = value * BigInt(from) + BigInt(digit);
  }
  return (negative ? -value : value).toString(to);
}

export function compoundInterest(principal, annualPercent, years, compounds = 12) {
  principal = finiteNumber(principal, 'Principal');
  const rate = finiteNumber(annualPercent, 'Annual rate') / 100;
  years = finiteNumber(years, 'Years'); compounds = finiteNumber(compounds, 'Compounding periods');
  if (principal < 0 || years < 0 || !Number.isInteger(compounds) || compounds < 1 || 1 + rate / compounds <= 0) throw new Error('Use nonnegative principal and years, positive integer compounding periods, and a valid periodic rate.');
  const balance = principal * (1 + rate / compounds) ** (compounds * years);
  if (!Number.isFinite(balance)) throw new Error('The balance exceeds numeric limits.');
  return { balance, interest: balance - principal, effectiveAnnualRate: ((1 + rate / compounds) ** compounds - 1) * 100 };
}

export function loanPayment(principal, annualPercent, months) {
  principal = finiteNumber(principal, 'Principal');
  const rate = finiteNumber(annualPercent, 'Annual rate') / 1200;
  months = finiteNumber(months, 'Months');
  if (principal < 0 || rate < 0 || !Number.isInteger(months) || months < 1) throw new Error('Use nonnegative principal and rate, and a positive integer number of months.');
  const payment = rate === 0 ? principal / months : principal * rate / (-Math.expm1(-months * Math.log1p(rate)));
  return { payment, total: payment * months, interest: payment * months - principal };
}

export function triangle(a, b, c) {
  [a, b, c] = [a, b, c].map((v, i) => finiteNumber(v, `Side ${'abc'[i]}`));
  if (Math.min(a, b, c) <= 0 || a + b <= c || a + c <= b || b + c <= a) throw new Error('Positive sides must satisfy the strict triangle inequality.');
  const sorted = [a, b, c].sort((x, y) => y - x);
  const [x, y, z] = sorted;
  const area = Math.sqrt((x + (y + z)) * (z - (x - y)) * (z + (x - y)) * (x + (y - z))) / 4;
  const clamp = v => Math.min(1, Math.max(-1, v));
  const A = Math.acos(clamp((b * b + c * c - a * a) / (2 * b * c))) * 180 / Math.PI;
  const B = Math.acos(clamp((a * a + c * c - b * b) / (2 * a * c))) * 180 / Math.PI;
  return { area, perimeter: a + b + c, angleA: A, angleB: B, angleC: 180 - A - B };
}

export function meanInference(data, confidence = 0.95, nullMean = 0) {
  if (!Array.isArray(data) || data.length < 2 || data.some(v => !Number.isFinite(v))) throw new Error('Inference requires at least two finite observations.');
  confidence = finiteNumber(confidence, 'Confidence'); nullMean = finiteNumber(nullMean, 'Null mean');
  if (confidence <= 0 || confidence >= 1) throw new Error('Confidence must be between 0 and 1, for example 0.95.');
  const n = data.length;
  const mean = data.reduce((a, b) => a + b, 0) / n;
  const variance = data.reduce((sum, v) => sum + (v - mean) ** 2, 0) / (n - 1);
  const standardError = Math.sqrt(variance / n);
  if (standardError === 0) throw new Error('A t interval/test requires nonzero sample variation.');
  const critical = jStat.studentt.inv((1 + confidence) / 2, n - 1);
  const t = (mean - nullMean) / standardError;
  const pValue = Math.max(0, Math.min(1, 2 * jStat.studentt.cdf(-Math.abs(t), n - 1)));
  return { n, mean, standardError, df: n - 1, lower: mean - critical * standardError, upper: mean + critical * standardError, t, pValue, confidence };
}
