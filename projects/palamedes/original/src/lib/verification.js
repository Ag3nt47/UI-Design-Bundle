import { create, all } from 'mathjs';
const precise = create(all, { number: 'BigNumber', precision: 64 });
export function crossCheck(expression, value, scope = {}, angle = 'RAD') {
  if (angle !== 'RAD' || typeof value !== 'number' || !Number.isFinite(value) || /[=;\[\]]/.test(expression)) return { status: 'inconclusive', label: 'Check unavailable', detail: 'Use the worked solver for equation substitution. This result type is not covered by high-precision recomputation.' };
  try {
    const inputs = {};
    for (const [k,v] of Object.entries(scope)) if (typeof v === 'number' && Number.isFinite(v)) inputs[k] = precise.bignumber(v);
    const high = Number(precise.evaluate(expression.replace(/π/g, 'pi').replace(/×/g, '*').replace(/÷/g, '/').replace(/−/g, '-'), inputs));
    if (!Number.isFinite(high)) throw Error();
    const relative = Math.abs(high-value) / Math.max(1,Math.abs(high));
    return {status:relative<1e-10?'pass':'fail',label:relative<1e-10?'Double-check passed':'Results disagree',detail:`64-digit recomputation: ${high}. Relative difference: ${relative.toExponential(2)}. Agreement is a numerical check, not a proof.`};
  } catch { return {status:'inconclusive',label:'Check unavailable',detail:'The independent BigNumber mode does not support this expression or scope. The primary result has not been verified.'}; }
}
