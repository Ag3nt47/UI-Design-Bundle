import { all, create } from 'mathjs';
import nerdamer from 'nerdamer/all.js';

const m = create(all, {});
const f = v => typeof v === 'string' ? v : m.format(v, { precision: 12 });
const close = (a, b, tol = 1e-8) => {
  try { return Number(m.abs(m.subtract(a,b))) <= tol * Math.max(1,Number(m.abs(a)),Number(m.abs(b))); } catch { return false; }
};
const step = (title, detail, expression) => ({ title, detail, ...(expression ? {expression} : {}) });
const check = (status, label, detail) => ({ status, label, detail });
const scalarFunctions=new Set('sin cos tan cot sec csc asin acos atan atan2 acot asec acsc sinh cosh tanh asinh acosh atanh sqrt cbrt nthRoot abs arg re im conj sign floor ceil round fix exp log log2 log10 log1p expm1 factorial gamma erf min max mod pow hypot gcd lcm'.split(' '));

export function normalizeProblem(text) {
  return String(text).replace(/[−–]/g, '-').replace(/×/g,'*').replace(/÷/g,'/').replace(/π/g,'pi').replace(/²/g,'^2').replace(/³/g,'^3').replace(/√\s*\(([^)]+)\)/g,'sqrt($1)').replace(/[“”]/g,'"').trim();
}

function validateExpression(expr, variable) {
  if (expr.length > 1800) throw new Error('Please shorten the expression to 1,800 characters.');
  const tree = m.parse(expr);
  let nodes=0;
  tree.traverse(node => {
    if(++nodes>300)throw new Error('Please split this expression into smaller calculations (300 syntax nodes maximum).');
    if (['AssignmentNode','FunctionAssignmentNode','BlockNode','AccessorNode','ObjectNode','IndexNode'].includes(node.type)) throw new Error('Enter a mathematical expression, rather than assignments or code.');
    if (node.isFunctionNode && ['import','createUnit','evaluate','parse','simplify','derivative','resolve','reviver'].includes(node.name)) throw new Error('That operation belongs in the calculator or code sandbox.');
    if(node.isFunctionNode&&!scalarFunctions.has(node.name))throw new Error(`The worked solver supports scalar elementary functions; use a specialist workspace or sandbox for ${node.name}.`);
  });
  return tree;
}

// Extract polynomial coefficients from the syntax tree, without fitting sample values.
function polynomial(node, variable, maxDegree=2) {
  if (node.isParenthesisNode) return polynomial(node.content,variable,maxDegree);
  if (node.isConstantNode) return [Number(node.value)];
  if (node.isSymbolNode) {
    if (node.name === variable) return [0,1];
    if (['pi','e','tau'].includes(node.name)) return [Number(node.evaluate())];
    throw new Error(`The local equation solver needs one variable. Unresolved symbol: ${node.name}.`);
  }
  if (node.isFunctionNode) {
    let hasVariable = false;
    node.traverse(n => { if (n.isSymbolNode && n.name === variable) hasVariable = true; });
    if (!hasVariable) { const value = Number(node.evaluate()); if (Number.isFinite(value)) return [value]; }
    throw new Error('For this equation, use the Symbolic workspace or rewrite it as a linear or quadratic polynomial.');
  }
  if (!node.isOperatorNode) throw new Error('This equation form is not supported locally.');
  const args = node.args.map(n => polynomial(n,variable,maxDegree));
  const add = (a,b,sign=1) => Array.from({length:Math.max(a.length,b.length)},(_,i)=>(a[i]||0)+sign*(b[i]||0));
  const mul = (a,b) => {
    const out = Array(a.length+b.length-1).fill(0);
    a.forEach((v,i)=>b.forEach((w,j)=>out[i+j]+=v*w));
    while(out.length>1 && out.at(-1)===0) out.pop();
    if(out.length>maxDegree+1) throw new Error('Worked equation solutions currently support degree 1 and 2. Use Symbolic for higher degrees.');
    return out;
  };
  if(node.op==='+') return args.length===1 ? args[0] : add(...args);
  if(node.op==='-') return args.length===1 ? args[0].map(v=>-v) : add(args[0],args[1],-1);
  if(node.op==='*') return mul(...args);
  if(node.op==='/') { if(args[1].length!==1 || args[1][0]===0) throw new Error('Variable denominators need the Symbolic workspace; do not cancel away domain restrictions.'); return args[0].map(v=>v/args[1][0]); }
  if(node.op==='^') {
    if(args[1].length!==1) throw new Error('Variable exponents need the Symbolic workspace.');
    const n=args[1][0];
    if(args[0].length===1) return [Math.pow(args[0][0],n)];
    if(!Number.isInteger(n)||n<0||n>maxDegree) throw new Error('Worked polynomial equations currently support powers up to 2.');
    let result=[1];for(let i=0;i<n;i++)result=mul(result,args[0]);return result;
  }
  throw new Error('Unsupported polynomial operation.');
}

function polynomialString(c, variable) {
  const parts=[];
  for(let i=c.length-1;i>=0;i--) if(c[i]!==0) parts.push(`${c[i]<0?'-':'+'}${f(Math.abs(c[i]))}${i?`*${variable}${i===1?'':`^${i}`}`:''}`);
  return (parts.join(' ').replace(/^\+/,'') || '0').trim();
}

function equationSolution(text, options) {
  const pieces=text.split('=');
  if(pieces.length!==2||!pieces[0].trim()||!pieces[1].trim()) throw new Error('Enter one complete equation, such as 2*x + 3 = 11.');
  const [lhs,rhs]=pieces.map(x=>x.trim());
  const leftTree=validateExpression(lhs),rightTree=validateExpression(rhs);
  const variables = new Set();
  [leftTree,rightTree].forEach(t=>t.traverse(n=>{if(n.isSymbolNode && !['pi','e','tau'].includes(n.name) && !Object.hasOwn(m,n.name)) variables.add(n.name);}));
  if(variables.size>1) throw new Error('This worked solver needs one unknown. Use Matrices for linear systems, or Symbolic for general equations.');
  const variable=[...variables][0] || 'x';
  const l=polynomial(leftTree,variable),r=polynomial(rightTree,variable);
  let c=Array.from({length:Math.max(l.length,r.length)},(_,i)=>(l[i]||0)-(r[i]||0));
  // Exact decimal/rational collection happens only after the original trees have
  // passed polynomial/domain validation. This avoids false contradictions from
  // binary floating-point cancellation such as 0.1x + 0.2x = 0.3x.
  try{c=polynomial(m.parse(nerdamer(`(${lhs})-(${rhs})`).expand().toString()),variable);}catch{}
  while(c.length>1 && c.at(-1)===0)c.pop();
  if(c.some(v=>!Number.isFinite(v))) throw new Error('The coefficients must be finite real numbers.');
  const steps=[step('Read the equation','Keep both sides of the original equation for the final substitution check.',`${lhs} = ${rhs}`),step('Collect like terms','Subtract the right side from both sides, then combine equal powers.',`${polynomialString(c,variable)} = 0`)];
  const checks=[];
  let roots=[],answer;
  if(c.length===1) {
    answer=c[0]===0?'All values in the original domain':'No solution';
    steps.push(step(c[0]===0?'Recognize an identity':'Recognize a contradiction',c[0]===0?'Every coefficient cancels, so the equation is true for every value in its original domain.':'The variable cancels, leaving a nonzero constant equal to zero.'));
    if(options.doubleCheck)checks.push(check('pass','Coefficient check',c[0]===0?'Both polynomial sides are identical.':`${f(c[0])} cannot equal 0.`));
  }else if(c.length===2){
    const [b,a]=c;
    roots=[-b/a];
    answer=`${variable} = ${f(roots[0])}`;
    steps.push(step('Isolate the variable term','Subtract the constant from both sides.',`${f(a)}*${variable} = ${f(-b)}`),step('Divide by the coefficient',`Divide both sides by ${f(a)}.`,answer));
  }else{
    let [cc,b,a]=c;
    const magnitude=Math.max(Math.abs(a),Math.abs(b),Math.abs(cc));
    if(magnitude>1e100||magnitude<1e-100){a/=magnitude;b/=magnitude;cc/=magnitude;steps.push(step('Normalize the coefficients',`Divide all coefficients by ${f(magnitude)} to reduce numerical overflow. The roots are unchanged.`,`${f(a)}*${variable}^2 + (${f(b)})*${variable} + (${f(cc)}) = 0`));}
    if(a===0)throw Error('The coefficient range exceeds floating-point precision. Use an exact symbolic method.');
    const d=b*b-4*a*cc;
    if(!Number.isFinite(d))throw Error('The discriminant exceeds the local numerical range. Rescale the equation or use an exact symbolic method.');
    steps.push(step('Identify the coefficients',`a = ${f(a)}, b = ${f(b)}, c = ${f(cc)}.`,`${f(a)}*${variable}^2 + (${f(b)})*${variable} + (${f(cc)}) = 0`),step('Compute the discriminant','The discriminant decides whether the roots are real or complex.',`D = b^2 - 4*a*c = (${f(b)})^2 - 4*(${f(a)})*(${f(cc)}) = ${f(d)}`),step('Apply the quadratic formula','Substitute the coefficients, then evaluate both signs.',`${variable} = (-(${f(b)}) ± sqrt(${f(d)})) / (2*(${f(a)}))`));
    if(d>=0) {
      // Stable quadratic formula avoids loss of precision for very different root magnitudes.
      if(d===0)roots=[-b/(2*a)];
      else {const q=-0.5*(b+(b>=0?1:-1)*Math.sqrt(d)); roots=[q/a,cc/q].sort((u,v)=>u-v);}
    }else roots=[m.complex(-b/(2*a),Math.sqrt(-d)/(2*a)),m.complex(-b/(2*a),-Math.sqrt(-d)/(2*a))];
    answer=`${variable} = ${roots.map(f).join(' or ')}`;
    steps.push(step('State the solutions',d<0?'A negative discriminant gives a complex conjugate pair.':d===0?'The discriminant is zero, so there is one repeated real root.':'The positive discriminant gives two real roots.',answer));
  }
  if(roots.some(root=>!Number.isFinite(Number(m.abs(root)))))throw Error('The solution exceeds the finite numerical range. Use an exact symbolic method or rescale the problem.');
  if(options.doubleCheck) roots.forEach(root=>{
    try {const a=leftTree.evaluate({[variable]:root}),b=rightTree.evaluate({[variable]:root});checks.push(check(close(a,b)?'pass':'fail',`Substitute ${variable} = ${f(root)}`,`Original left = ${f(a)}; original right = ${f(b)}. Residual = ${f(m.abs(m.subtract(a,b)))}.`));}
    catch(e){checks.push(check('inconclusive','Substitution check',e.message));}
  });
  return {title:'Equation solved',interpretation:`A degree-${Math.max(0,c.length-1)} polynomial equation in ${variable}.`,answer,steps,checks,source:'local',roots:roots.map(f),originalEquation:`${lhs} = ${rhs}`,variable};
}

const independentFunctions = {
  sin:Math.sin,cos:Math.cos,tan:Math.tan,asin:Math.asin,acos:Math.acos,atan:Math.atan,
  sinh:Math.sinh,cosh:Math.cosh,tanh:Math.tanh,sqrt:Math.sqrt,abs:Math.abs,exp:Math.exp,
  log:(x,b)=>b===undefined?Math.log(x):Math.log(x)/Math.log(b),ln:Math.log,log10:Math.log10,
  floor:Math.floor,ceil:Math.ceil,round:Math.round,min:Math.min,max:Math.max,pow:Math.pow,
  factorial:n=>{if(!Number.isInteger(n)||n<0||n>170)throw Error('Unsupported factorial domain.');let r=1;for(let i=2;i<=n;i++)r*=i;return r;}
};
function independentlyEvaluate(node) {
  if(node.isParenthesisNode)return independentlyEvaluate(node.content);
  if(node.isConstantNode)return Number(node.value);
  if(node.isSymbolNode&&['pi','e','tau'].includes(node.name))return {pi:Math.PI,e:Math.E,tau:2*Math.PI}[node.name];
  if(node.isFunctionNode&&independentFunctions[node.name])return independentFunctions[node.name](...node.args.map(independentlyEvaluate));
  if(node.isOperatorNode){
    const a=node.args.map(independentlyEvaluate);
    if(node.op==='+')return a.length===1?a[0]:a[0]+a[1];
    if(node.op==='-')return a.length===1?-a[0]:a[0]-a[1];
    if(node.op==='*')return a[0]*a[1];
    if(node.op==='/')return a[0]/a[1];
    if(node.op==='^')return a[0]**a[1];
    if(node.op==='%')return a[0]%a[1];
    if(node.op==='!')return independentFunctions.factorial(a[0]);
  }
  throw Error('This expression needs a specialist check; independent elementary evaluation is unavailable.');
}

function arithmeticSolution(expression, options, interpretation='Evaluate the expression using standard order of operations.') {
  const tree=validateExpression(expression);
  const value=tree.evaluate();
  if(typeof value==='function'||value===undefined)throw Error('Enter a complete expression, including the values to calculate.');
  if(typeof value==='number'&&!Number.isFinite(value))throw Error('The result is not a finite number. Check division by zero and the expression’s domain.');
  const steps=[step('Translate the problem',interpretation,expression)];
  const seen=new Set();
  tree.traverse(node=>{
    if((node.isOperatorNode||node.isFunctionNode) && !seen.has(node.toString()))seen.add(node.toString());
  });
  // Postorder makes each calculation appear after its operands.
  function visit(node){
    if(node.args)node.args.forEach(visit);
    else if(node.content)visit(node.content);
    if((node.isOperatorNode||node.isFunctionNode)&&steps.length<24){
      const result=node.evaluate();
      steps.push(step(node.isFunctionNode?`Evaluate ${node.name}`:node.op==='^'?'Calculate the power':node.op==='*'||node.op==='/'?'Multiply or divide':'Apply the operation','Use the values inside parentheses before the surrounding operation.',`${node.toString()} = ${f(result)}`));
    }
  }
  visit(tree);
  steps.push(step('Write the answer','The result follows from the operations above.',f(value)));
  const checks=[];
  if(options.doubleCheck){try{const other=independentlyEvaluate(tree);if(!Number.isFinite(other))throw Error('The separate real-number evaluator cannot check this domain or nonfinite result.');checks.push(check(close(value,other)?'pass':'fail','Independent arithmetic check',`A separate arithmetic evaluator gives ${f(other)}.`));}catch(e){checks.push(check('inconclusive','Independent arithmetic check',e.message));}}
  return {title:'Calculation complete',interpretation,answer:f(value),steps,checks,verificationExpression:expression,source:'local'};
}

function derivativeRuleSteps(node, variable, steps) {
  if(node.isParenthesisNode)return derivativeRuleSteps(node.content,variable,steps);
  if(node.isOperatorNode||node.isFunctionNode){
    const labels={'+':['Sum rule','Differentiate each term, then add the derivatives.'],'-':['Difference rule','Differentiate each term, keeping its sign.'],'*':['Product rule',"For u*v, use u′*v + u*v′."],'/':['Quotient rule',"For u/v, use (u′*v - u*v′)/v^2."],'^':['Power and chain rules',"For u^n with constant n, use n*u^(n-1)*u′; variable exponents use logarithmic differentiation."]};
    const functions={sin:'cos(u)*u′',cos:'-sin(u)*u′',tan:'sec(u)^2*u′',exp:'exp(u)*u′',log:'u′/u',sqrt:'u′/(2*sqrt(u))'};
    const info=labels[node.op]||[`${node.name || 'Function'} rule`,functions[node.name]?`Apply the chain rule: ${functions[node.name]}.`:'Differentiate the inner expression and apply the corresponding outer function rule.'];
    if(steps.length<14)steps.push(step(info[0],info[1],`d/d${variable} (${node.toString()}) = ${m.derivative(node,variable).toString()}`));
    (node.args||[]).forEach(n=>derivativeRuleSteps(n,variable,steps));
  }
}

function symbolicSolution(operation, expression, variable, options) {
  const tree=validateExpression(expression,variable),steps=[step('Identify the expression',`Work symbolically with respect to ${variable}.`,expression)],checks=[];
  let result;
  if(operation==='derivative'){
    derivativeRuleSteps(tree,variable,steps);
    result=m.derivative(tree,variable).toString();
    steps.push(step('Simplify the derivative','Combine the differentiated terms.',result));
    if(options.doubleCheck){
      const compiled=tree.compile(),deriv=m.compile(result);
      let count=0,failed=false,examples=[];
      for(const x of [0.7,1.3,2.1]){try{const h=1e-5*Math.max(1,Math.abs(x));const approx=(compiled.evaluate({[variable]:x+h})-compiled.evaluate({[variable]:x-h}))/(2*h);const exact=deriv.evaluate({[variable]:x});if(Number.isFinite(approx)&&typeof exact==='number'&&Number.isFinite(exact)){count++;failed ||= !close(approx,exact,1e-4);examples.push(`${variable}=${x}: derivative ${f(exact)}, finite difference ${f(approx)}`);}}catch{}}
      checks.push(check(count?(failed?'fail':'pass'):'inconclusive','Numerical derivative check',count?`${examples.join('; ')}. Sampling is a numerical check, not a proof.`:'No suitable real sample points could be evaluated.'));
    }
  } else if(operation==='integrate'){
    try{
      const coeffs=polynomial(tree,variable,20);
      for(let i=0;i<coeffs.length;i++)if(coeffs[i]!==0)steps.push(step('Apply the power rule',`Increase power ${i} to ${i+1} and divide by ${i+1}.`,`${f(coeffs[i])}*${variable}^${i} → ${f(coeffs[i]/(i+1))}*${variable}^${i+1}`));
    }catch{steps.push(step('Find an antiderivative','Use symbolic integration rules. The CAS does not expose every internal transformation; verify by differentiation.'));}
    result=nerdamer.integrate(expression,variable).toString();
    if(/integrate\(/.test(result))throw Error('The local symbolic engine could not find a closed-form antiderivative. Try numerical integration in Symbolic.');
    steps.push(step('Include the integration constant','Any constant has derivative zero.',`${result} + C`));
    if(options.doubleCheck){try{const recovered=nerdamer.diff(result,variable).toString();const residual=nerdamer(`(${recovered})-(${expression})`).expand().toString();checks.push(check(residual==='0'?'pass':'inconclusive','Differentiate the answer',`Derivative of the antiderivative minus the original expression: ${residual}.`));}catch(e){checks.push(check('inconclusive','Differentiate the answer',e.message));}}
    result+=' + C';
  } else {
    const command={simplify:()=>nerdamer(expression).simplify(),factor:()=>nerdamer.factor(expression),expand:()=>nerdamer(expression).expand()}[operation];
    result=command().toString();
    steps.push(step({simplify:'Combine equivalent terms',factor:'Find common and polynomial factors',expand:'Distribute multiplication over addition'}[operation],'Apply the symbolic transformation while respecting the original domain.',result));
    if(options.doubleCheck){try{const residual=nerdamer(`(${expression})-(${result})`).expand().toString();checks.push(check(residual==='0'?'pass':'inconclusive','Symbolic equivalence check',`Original minus transformed expression simplifies to ${residual}. Domain exclusions still apply.`));}catch(e){checks.push(check('inconclusive','Symbolic equivalence check',e.message));}}
  }
  return {title:{derivative:'Derivative found',integrate:'Antiderivative found',simplify:'Expression simplified',factor:'Expression factored',expand:'Expression expanded'}[operation],interpretation:`${operation} ${expression} with respect to ${variable}.`,answer:result,steps,checks,source:'local'};
}

const numberPattern='([+-]?(?:\\d+(?:\\.\\d*)?|\\.\\d+))';
function naturalLanguage(text, options) {
  let match;
  const low=text.toLowerCase().replace(/(\d)\s+percent\s+of\b/g,'$1% of').replace(/[?!.]+$/,'').trim();
  if((match=low.match(new RegExp(`^(?:what is |calculate |find )?${numberPattern}\\s*%\\s*(?:of|times)\\s*${numberPattern}$`)))){
    const [,p,n]=match;return arithmeticSolution(`(${p}/100)*(${n})`,options,`${p}% means ${p}/100. Multiply this by ${n}.`);
  }
  if((match=low.match(new RegExp(`^(increase|decrease)\\s+${numberPattern}\\s+by\\s+${numberPattern}\\s*%$`)))){
    const [,direction,n,p]=match,op=direction==='increase'?'+':'-';return arithmeticSolution(`${n}*(1${op}${p}/100)`,options,`${direction} the original value by ${p}% of itself.`);
  }
  if((match=low.match(new RegExp(`^(?:what is (?:the )?)?(?:percent|percentage) change from\\s+${numberPattern}\\s+to\\s+${numberPattern}$`)))){
    const [,a,b]=match;if(Number(a)===0)throw Error('Percentage change from zero is undefined.');const out=arithmeticSolution(`((${b})-(${a}))/abs(${a})*100`,options,'Percentage change = (new − old) / |old| × 100.');out.answer+='%';return out;
  }
  if((match=low.match(new RegExp(`^${numberPattern}\\s+is\\s+what\\s+(?:percent|percentage)\\s+of\\s+${numberPattern}$`)))){
    if(Number(match[2])===0)throw Error('The reference amount must be nonzero.');const out=arithmeticSolution(`${match[1]}/${match[2]}*100`,options,'Divide the part by the whole, then multiply by 100 to express a percentage.');out.answer+='%';return out;
  }
  if((match=low.match(/^(?:find |calculate |what is )?(?:the )?(mean|average|median|sum) (?:of )?([\d.,\s+-]+)$/))){
    const values=match[2].trim().split(/[\s,]+/).map(Number);if(!values.length||values.some(x=>!Number.isFinite(x)))throw Error('Enter a comma-separated list of numbers.');
    const op=match[1]==='average'?'mean':match[1],sorted=[...values].sort((a,b)=>a-b),sum=values.reduce((a,b)=>a+b,0);
    const expression=op==='sum'?values.join(' + '):op==='mean'?`(${values.join(' + ')})/${values.length}`:values.length%2?String(sorted[(values.length-1)/2]):`(${sorted[values.length/2-1]}+${sorted[values.length/2]})/2`;
    const result=arithmeticSolution(expression,options,op==='median'?`Sort the data: ${sorted.join(', ')}. Take the middle value, or average the two middle values.`:op==='mean'?`Add all ${values.length} observations, then divide by ${values.length}.`:'Add the listed observations.');result.title=`${op[0].toUpperCase()+op.slice(1)} calculated`;return result;
  }
  if((match=text.replace(/[?!.]+$/,'').match(/^convert\s+(.+?)\s+(?:to|into)\s+([a-zA-Z][a-zA-Z0-9/*^ -]*)$/i))){
    const value=m.unit(match[1]),converted=value.to(match[2]);
    const checks=options.doubleCheck?[check(close(converted.toNumber(value.formatUnits()),value.toNumber(value.formatUnits()))?'pass':'inconclusive','Reverse conversion',`Convert the answer back: ${f(converted.to(value.formatUnits()))}. Compare with ${f(value)}.`)]:[];
    return {title:'Units converted',interpretation:`Convert ${match[1]} into ${match[2]}.`,answer:f(converted),steps:[step('Identify the quantities','The source and destination units must measure the same physical dimension.',match[1]),step('Convert through the common base unit','Use the unit definitions, including any offsets for temperature.',`${match[1]} = ${f(converted)}`)],checks,source:'local'};
  }
  if((match=low.match(new RegExp(`^(?:find (?:the )?)?(?:area of (?:a |the )?)?triangle (?:with )?base\\s+${numberPattern}\\s+(?:and )?height\\s+${numberPattern}$`)))){if(Number(match[1])<=0||Number(match[2])<=0)throw Error('Triangle dimensions must be positive.');return arithmeticSolution(`(${match[1]}*${match[2]})/2`,options,'Triangle area = base × perpendicular height / 2.');}
  if((match=low.match(new RegExp(`^(?:find (?:the )?)?(?:hypotenuse of (?:a |the )?)?right triangle (?:with )?legs\\s+${numberPattern}\\s+and\\s+${numberPattern}$`)))){if(Number(match[1])<=0||Number(match[2])<=0)throw Error('Triangle dimensions must be positive.');return arithmeticSolution(`sqrt((${match[1]})^2+(${match[2]})^2)`,options,'For a right triangle, a² + b² = c². Take the positive square root for the hypotenuse.');}
  if((match=low.match(new RegExp(`^(?:find (?:the )?)?(area|circumference) of (?:a |the )?circle (?:with )?radius\\s+${numberPattern}$`)))){if(Number(match[2])<=0)throw Error('A circle radius must be positive.');return arithmeticSolution(match[1]==='area'?`pi*(${match[2]})^2`:`2*pi*(${match[2]})`,options,match[1]==='area'?'Circle area = πr².':'Circle circumference = 2πr.');}
  if((match=low.match(new RegExp(`^(?:find |calculate )?(distance|speed|time) (?:with |for )?(speed|distance|time)\\s*=?\\s*${numberPattern}\\s+(?:and )?(speed|distance|time)\\s*=?\\s*${numberPattern}$`)))){
    const [,target,k1,v1,k2,v2]=match,data={[k1]:Number(v1),[k2]:Number(v2)};
    if(k1===k2||data[target]!==undefined)throw Error('Give the other two quantities. For example: find speed distance 120 time 2.');
    if((data.distance!==undefined&&data.distance<0)||(data.speed!==undefined&&data.speed<0)||(data.time!==undefined&&data.time<=0)||(target==='time'&&data.speed===0))throw Error('Use nonnegative distance/speed and a positive time; solving for time needs positive speed.');
    const expr=target==='distance'?`${data.speed}*${data.time}`:target==='speed'?`${data.distance}/${data.time}`:`${data.distance}/${data.speed}`;
    const result=arithmeticSolution(expr,options,'Use distance = speed × time, with consistent units.');result.title=`${target[0].toUpperCase()+target.slice(1)} calculated`;return result;
  }
  if((match=low.match(new RegExp(`^(?:a |the )?\\w+ (?:travels|covers)\\s+${numberPattern}\\s+(km|kilometers|miles|m|meters)\\s+in\\s+${numberPattern}\\s+(hours?|minutes?|seconds?)[,.]?\\s+(?:what is (?:its |the )?speed|find (?:its |the )?speed)$`)))){
    const [,distance,dUnit,time,tUnit]=match;if(Number(distance)<0||Number(time)<=0)throw Error('Use a nonnegative distance and positive travel time.');
    const unit={kilometers:'km',meters:'m',miles:'mile'}[dUnit]||dUnit;
    const result=arithmeticSolution(`${distance}/${time}`,options,'Average speed = distance ÷ elapsed time.');result.answer+=` ${dUnit}/${tUnit}`;result.steps.splice(1,0,step('Keep the units consistent',`Distance = ${distance} ${dUnit}; elapsed time = ${time} ${tUnit}.`,`speed = ${distance} ${unit} / (${time} ${tUnit})`));return result;
  }
  return null;
}

/** Deterministic worked solutions. Unsupported natural language is deliberately rejected. */
export function solveProblem(input, options={}) {
  options={doubleCheck:true,...options};
  let text=normalizeProblem(input);
  if(!text)throw Error('Paste a problem, type an expression, or upload an image first.');
  if(text.length>4000)throw Error('Please use one problem at a time (up to 4,000 characters).');
  const natural=naturalLanguage(text,options);if(natural)return natural;
  text=text.replace(/^(?:please\s+)?(?:solve\s+(?:the\s+equation\s+)?(?:for\s+[a-z]\s*)?[:\s]*|find\s+[a-z]\s+(?:if|in)\s+|evaluate\s*[:\s]*|calculate\s*[:\s]*|what\s+is\s+)/i,'').replace(/\?$/,'').trim();
  const command=text.match(/^(differentiate|derivative(?: of)?|d\/d([a-z])|integrate|integral(?: of)?|simplify|factor|expand)\s*[:\s]+(.+)$/i);
  if(command){
    let expression=command[3],variable=command[2]||'x';
    const suffix=expression.match(/\s+(?:with respect to|wrt)\s+([a-z])$/i);if(suffix){variable=suffix[1];expression=expression.slice(0,suffix.index);}
    expression=expression.replace(/\s+d([a-z])$/i,(_,v)=>{variable=v;return '';});
    const op=command[1].toLowerCase().startsWith('d')?'derivative':command[1].toLowerCase().startsWith('integr')?'integrate':command[1].toLowerCase();
    return symbolicSolution(op,expression,variable,options);
  }
  if(text.includes('='))return equationSolution(text,options);
  // Free-form prose must not be accidentally interpreted as products of unknown symbols.
  if(/\b(?:a|the|how|what|when|where|who|why|which|find|is|are|has|have|please|show|prove|let|given|if|then|of|with)\b/i.test(text))throw Error('The local language solver could not map this wording reliably. Rewrite it as an equation or choose a supported example. Optional AI in Settings can interpret broader word problems.');
  try{return arithmeticSolution(text,options);}catch(e){throw Error(`Could not solve this locally: ${e.message} Try an explicit expression such as (2+3)^2, an equation, or a listed command.`);}
}

export const SOLVER_EXAMPLES=[
  {label:'Algebra',text:'2*(x + 3) = 5*x - 9'},
  {label:'Quadratic',text:'x^2 - 5*x + 6 = 0'},
  {label:'Calculus',text:'differentiate x^3 * sin(x)'},
  {label:'Percentages',text:'What is 18% of 250?'},
  {label:'Statistics',text:'mean of 4, 7, 9, 12, 18'},
  {label:'Geometry',text:'hypotenuse of a right triangle with legs 3 and 4'},
  {label:'Units',text:'convert 5 km to m'},
];

/** Routing is a hint, never an assertion that an expression was solved. */
export function classifyProblem(input) {
  const text=normalizeProblem(input),lower=text.toLowerCase();
  if(!text)return {tab:'solver',label:'Enter a problem',confidence:0};
  if(/\b(graph|plot|surface|polar|parametric)\b|^y\s*=|^z\s*=/i.test(text))return {tab:'graphing',label:'Graphing',confidence:0.98,expression:text.replace(/^(?:graph|plot)\s+/i,'').replace(/^y\s*=\s*/i,'')};
  if(/\[\s*\[|\b(matrix|determinant|eigenvalues?|rref|inverse matrix)\b/i.test(text))return {tab:'matrices',label:'Linear algebra',confidence:0.96,expression:text};
  if(/\b(derivative|differentiate|integral|integrate|limit|taylor|laplace|simplify|factor|expand)\b|^d\/[a-z]/i.test(text))return {tab:'symbolic',label:'Symbolic mathematics',confidence:0.95,expression:text};
  if(/\b(mean|median|average|variance|standard deviation|regression|distribution|binomial|poisson|normal cdf|confidence interval|anova)\b/i.test(text))return {tab:'statistics',label:'Statistics & probability',confidence:0.94,expression:text};
  if(/\b(convert|binary|hexadecimal|decimal|base\s*\d|interest|mortgage|payment|loan|finance)\b/i.test(text))return {tab:'tools',label:'Math tools',confidence:0.92,expression:text};
  if(text.includes('=')||/\b(what|find|solve|how|triangle|circle|percent|speed|distance|time|increase|decrease)\b|%\s*of/i.test(lower))return {tab:'solver',label:'Worked solution',confidence:0.9,expression:text};
  try{const tree=m.parse(text);let unsafe=false;tree.traverse(n=>{if(n.isAssignmentNode||n.isFunctionAssignmentNode)unsafe=true;});if(!unsafe)return {tab:'calculator',label:'Scientific calculation',confidence:0.8,expression:text};}catch{}
  return {tab:'solver',label:'Problem interpretation',confidence:0.5,expression:text};
}
