/** Small, transparent CPU implementations for learning and inspecting ML math.
 * Arrays use row-major notation. These functions do not load models or call APIs. */
function finite(value, label) {
  if (typeof value !== 'number' || !Number.isFinite(value)) throw new Error(`${label} must be a finite number.`);
  return value;
}
function vector(values, label = 'Vector') {
  if (!Array.isArray(values) || !values.length || values.length > 10000) throw new Error(`${label} must be a nonempty array of at most 10,000 numbers.`);
  values.forEach((value, i) => finite(value, `${label}[${i}]`));
  return values;
}
function matrix(values, label = 'Matrix') {
  if (!Array.isArray(values) || !values.length || !Array.isArray(values[0]) || !values[0].length) throw new Error(`${label} must be a nonempty matrix.`);
  const width = values[0].length;
  if (values.length * width > 200000) throw new Error(`${label} has too many entries for this browser tool.`);
  values.forEach((row, i) => {
    vector(row, `${label} row ${i}`);
    if (row.length !== width) throw new Error(`${label} rows must have equal lengths.`);
  });
  return values;
}
function checked(value) {
  if (!Number.isFinite(value)) throw new Error('The calculation overflowed. Scale the inputs or reduce the learning rate.');
  return value;
}
function sameLength(a, b, label) { if (a.length !== b.length) throw new Error(label); }
const sigmoid = z => z >= 0 ? 1 / (1 + Math.exp(-z)) : Math.exp(z) / (1 + Math.exp(z));

export function softmax(logits) {
  vector(logits, 'Logits');
  const max = Math.max(...logits);
  const exps = logits.map(z => Math.exp(z - max));
  const total = exps.reduce((s, x) => s + x, 0);
  return exps.map(x => x / total);
}

export function activate(logits, activation = 'linear') {
  vector(logits, 'Logits');
  if (activation === 'softmax') return softmax(logits);
  const fn = { linear: x => x, relu: x => Math.max(0, x), sigmoid, tanh: Math.tanh }[activation];
  if (!fn) throw new Error('Choose linear, ReLU, sigmoid, tanh, or softmax activation.');
  return logits.map(fn);
}

export function denseForward(x, W, b, activation = 'linear') {
  vector(x, 'Input x'); matrix(W, 'Weights W'); vector(b, 'Bias b');
  if (W[0].length !== x.length) throw new Error('W must have one column per input feature.');
  sameLength(W, b, 'W must have one row per bias/output neuron.');
  const terms = W.map(row => row.map((weight, j) => checked(weight * x[j])));
  const z = terms.map((row, i) => checked(row.reduce((sum, value) => checked(sum + value), b[i])));
  return { x: [...x], W: W.map(row => [...row]), b: [...b], terms, z, output: activate(z, activation), activation };
}

export function lossValue(predictions, targets, type = 'mse', epsilon = 1e-15) {
  vector(predictions, 'Predictions'); vector(targets, 'Targets');
  sameLength(predictions, targets, 'Predictions and targets must have equal lengths.');
  if (!(epsilon > 0 && epsilon < 0.5)) throw new Error('Clipping epsilon must be between 0 and 0.5.');
  let terms;
  if (type === 'mse') terms = predictions.map((p, i) => checked((p - targets[i]) ** 2));
  else if (type === 'bce' || type === 'cross-entropy') {
    if (predictions.some(p => p < 0 || p > 1) || targets.some(t => t < 0 || t > 1)) throw new Error('Cross-entropy requires predictions and targets between 0 and 1.');
    if (type === 'cross-entropy') {
      if (Math.abs(predictions.reduce((a, b) => a + b, 0) - 1) > 1e-6 || Math.abs(targets.reduce((a, b) => a + b, 0) - 1) > 1e-6) throw new Error('Multiclass predictions and targets must each sum to 1.');
      terms = predictions.map((p, i) => -targets[i] * Math.log(Math.max(epsilon, p)));
    } else terms = predictions.map((p, i) => {
      const q = Math.max(epsilon, Math.min(1 - epsilon, p));
      return -(targets[i] * Math.log(q) + (1 - targets[i]) * Math.log1p(-q));
    });
  } else throw new Error('Choose MSE, binary cross-entropy, or multiclass cross-entropy.');
  const sum = terms.reduce((a, b) => a + b, 0);
  return { value: checked(type === 'cross-entropy' ? sum : sum / terms.length), terms, type, epsilon, reduction: type === 'cross-entropy' ? 'sum' : 'mean' };
}

/** Gradient of mean squared error through one dense layer. At ReLU z=0 the
 * conventional subgradient 0 is used; softmax uses its full Jacobian. */
export function denseMSEGradient(x, W, b, target, activation = 'linear') {
  const forward = denseForward(x, W, b, activation);
  vector(target, 'Target'); sameLength(target, forward.output, 'Target length must equal the output width.');
  const a = forward.output;
  const dA = a.map((v, i) => 2 * (v - target[i]) / a.length);
  let dZ;
  if (activation === 'softmax') {
    const dot = dA.reduce((sum, v, i) => sum + v * a[i], 0);
    dZ = a.map((v, i) => v * (dA[i] - dot));
  } else dZ = dA.map((v, i) => v * (activation === 'linear' ? 1 : activation === 'relu' ? (forward.z[i] > 0 ? 1 : 0) : activation === 'sigmoid' ? a[i] * (1 - a[i]) : 1 - a[i] ** 2));
  return { ...forward, loss: lossValue(a, target, 'mse').value, dA, dZ, dW: dZ.map(g => x.map(v => checked(g * v))), db: dZ, dX: x.map((_, j) => checked(dZ.reduce((s, g, i) => s + g * W[i][j], 0))) };
}

export function scaledDotProductAttention(Q, K, V, { causal = false } = {}) {
  matrix(Q, 'Q'); matrix(K, 'K'); matrix(V, 'V');
  if (Q[0].length !== K[0].length) throw new Error('Q and K must have the same feature width dₖ.');
  if (K.length !== V.length) throw new Error('K and V must have the same number of rows/tokens.');
  if (Q.length * K.length * Math.max(Q[0].length, V[0].length) > 10000000) throw new Error('Use smaller matrices in this browser attention lab.');
  if (causal && Q.length !== K.length) throw new Error('Causal masking requires equal Q and K sequence lengths in this lab.');
  const scale = Math.sqrt(Q[0].length);
  const scores = Q.map((q, i) => K.map((k, j) => causal && j > i ? null : checked(q.reduce((s, v, d) => s + v * k[d], 0) / scale)));
  const weights = scores.map(row => {
    const allowed = row.filter(v => v !== null);
    const max = Math.max(...allowed);
    const exp = row.map(v => v === null ? 0 : Math.exp(v - max));
    const sum = exp.reduce((s, v) => s + v, 0);
    return exp.map(v => v / sum);
  });
  const output = weights.map(row => V[0].map((_, d) => checked(row.reduce((s, w, j) => s + w * V[j][d], 0))));
  return { scores, weights, output, scale, causal };
}

export function trainLinearRegression(X, y, { learningRate = 0.01, epochs = 500, weights, bias = 0 } = {}) {
  matrix(X, 'Feature matrix X'); vector(y, 'Targets y');
  sameLength(X, y, 'X must have one row per target y.');
  finite(learningRate, 'Learning rate'); finite(bias, 'Initial bias');
  if (learningRate <= 0) throw new Error('Learning rate must be positive.');
  if (!Number.isInteger(epochs) || epochs < 1 || epochs > 10000) throw new Error('Epochs must be an integer from 1 to 10,000.');
  const n = X.length, d = X[0].length;
  if (n * d * epochs > 30000000) throw new Error('Reduce samples, features, or epochs to keep browser training responsive.');
  let w = weights === undefined ? Array(d).fill(0) : [...vector(weights, 'Initial weights')];
  if (w.length !== d) throw new Error('Initial weights must match the number of feature columns.');
  let b = bias;
  const history = [];
  const stride = Math.max(1, Math.ceil(epochs / 150));
  const predict = row => checked(row.reduce((s, value, j) => s + value * w[j], b));
  for (let epoch = 0; epoch <= epochs; epoch++) {
    const errors = X.map((row, i) => checked(predict(row) - y[i]));
    const loss = checked(errors.reduce((s, e) => s + e * e, 0) / n);
    if (epoch === 0 || epoch % stride === 0 || epoch === epochs) history.push({ epoch, loss });
    if (epoch === epochs) break;
    const dw = w.map((_, j) => 2 / n * errors.reduce((s, e, i) => s + e * X[i][j], 0));
    const db = 2 / n * errors.reduce((s, e) => s + e, 0);
    w = w.map((v, j) => checked(v - learningRate * dw[j]));
    b = checked(b - learningRate * db);
  }
  const predictions = X.map(predict);
  const residuals = y.map((value, i) => value - predictions[i]);
  const loss = history.at(-1).loss;
  const mean = y.reduce((s, v) => s + v, 0) / n;
  const totalVariation = y.reduce((s, v) => s + (v - mean) ** 2, 0);
  return { weights: w, bias: b, loss, rmse: Math.sqrt(loss), r2: totalVariation === 0 ? null : 1 - loss * n / totalVariation, predictions, residuals, history, epochs, learningRate };
}

export function optimizerStep(parameters, gradients, { method = 'sgd', learningRate = 0.01, beta1 = 0.9, beta2 = 0.999, epsilon = 1e-8, step = 1, m, v } = {}) {
  vector(parameters, 'Parameters'); vector(gradients, 'Gradients');
  sameLength(parameters, gradients, 'Parameters and gradients must have equal lengths.');
  finite(learningRate, 'Learning rate');
  if (learningRate <= 0) throw new Error('Learning rate must be positive.');
  if (method === 'sgd') return { parameters: parameters.map((p, i) => checked(p - learningRate * gradients[i])), method, learningRate };
  if (method !== 'adam') throw new Error('Choose SGD or Adam.');
  if (!(beta1 >= 0 && beta1 < 1 && beta2 >= 0 && beta2 < 1 && Number.isFinite(epsilon) && epsilon > 0) || !Number.isSafeInteger(step) || step < 1) throw new Error('Adam requires beta values in [0,1), finite epsilon > 0, and a positive integer step.');
  const oldM = m === undefined ? parameters.map(() => 0) : vector(m, 'First moment m');
  const oldV = v === undefined ? parameters.map(() => 0) : vector(v, 'Second moment v');
  sameLength(parameters, oldM, 'Moment m must match parameter length.'); sameLength(parameters, oldV, 'Moment v must match parameter length.');
  if (oldV.some(value => value < 0)) throw new Error('Second moments must be nonnegative.');
  const nextM = gradients.map((g, i) => checked(beta1 * oldM[i] + (1 - beta1) * g));
  const nextV = gradients.map((g, i) => checked(beta2 * oldV[i] + (1 - beta2) * g * g));
  const mHat = nextM.map(value => value / (1 - beta1 ** step));
  const vHat = nextV.map(value => value / (1 - beta2 ** step));
  return { parameters: parameters.map((p, i) => checked(p - learningRate * mHat[i] / (Math.sqrt(vHat[i]) + epsilon))), method, learningRate, step, m: nextM, v: nextV, mHat, vHat };
}
