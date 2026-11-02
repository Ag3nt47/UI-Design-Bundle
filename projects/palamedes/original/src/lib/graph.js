import { math, normalizeExpression } from './engine.js';

const FUNCTIONS = new Set(['sin','cos','tan','asin','acos','atan','atan2','sinh','cosh','tanh','exp','log','log10','sqrt','abs','sign','floor','ceil','round','min','max','pow']);
const SYMBOLS = new Set(['x','y','t','theta','a','b','pi','e','tau', ...FUNCTIONS]);
const TYPES = new Set(['ParenthesisNode','ConstantNode','OperatorNode','SymbolNode','FunctionNode']);

/** Graphs evaluate a small scalar-only expression language. Compilation and all
 * validation happen once before sampling; graphs cannot create arrays or code. */
export function compileGraphExpression(input) {
  const expression = normalizeExpression(input);
  if (!expression || expression.length > 500) throw new Error('Use a graph expression from 1 to 500 characters.');
  const node = math.parse(expression);
  let count = 0;
  node.traverse(child => {
    if (++count > 128) throw new Error('The graph expression is too complex (128 syntax nodes maximum).');
    if (!TYPES.has(child.type)) throw new Error('Graph expressions accept scalar arithmetic and elementary functions, without assignments, arrays, ranges, or code.');
    if (child.isSymbolNode && !SYMBOLS.has(child.name)) throw new Error(`Unknown graph symbol ${child.name}. Use x, y, t, theta, a, or b.`);
    if (child.isConstantNode && (typeof child.value !== 'number' || !Number.isFinite(child.value))) throw new Error('Graph constants must be finite real numbers.');
    if (child.isOperatorNode && !['+','-','*','/','^'].includes(child.op)) throw new Error(`Operator ${child.op} is not supported in graph expressions.`);
    if (child.isFunctionNode && !FUNCTIONS.has(child.name)) throw new Error(`Function ${child.name} is not available in graphs.`);
    if ((child.isOperatorNode && child.op === '^') || (child.isFunctionNode && child.name === 'pow')) {
      const exponent = child.args[1];
      // Constant exponents are evaluated only after the whole tree has passed
      // its allowlist; the second traversal below does this safely.
      if (!exponent) throw new Error('Powers require both a base and an exponent.');
    }
  });
  node.traverse(child => {
    if ((child.isOperatorNode && child.op === '^') || (child.isFunctionNode && child.name === 'pow')) {
      const exponent = child.args[1];
      let hasVariable = false;
      exponent.traverse(value => { if (value.isSymbolNode && ['x','y','t','theta','a','b'].includes(value.name)) hasVariable = true; });
      if (!hasVariable) {
        const power = exponent.evaluate();
        if (typeof power !== 'number' || !Number.isFinite(power) || Math.abs(power) > 1000) throw new Error('Graph power exponents must have magnitude at most 1,000.');
      }
    }
  });
  return node.compile();
}
