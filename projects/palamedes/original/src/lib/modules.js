import { all, create } from 'mathjs';
const math=create(all,{});
const identifier=/^[A-Za-z][A-Za-z0-9_]{0,47}$/;
const blocked=new Set(['constructor','prototype','__proto__','import','evaluate','parse','parser','createUnit','reviver','resolve','simplify','derivative','chain','range','zeros','ones','identity','resize','reshape','subset','random','randomInt','randomMatrix','map','filter','forEach','matrix','sparse','dense','concat','kron']);
const text=(v,name,max=1000)=>{if(typeof v!=='string'||!v.trim()||v.length>max)throw Error(`${name} must be nonempty text, at most ${max} characters.`);return v.trim();};
const ident=(v,name)=>{if(typeof v!=='string'||!identifier.test(v)||blocked.has(v))throw Error(`${name} must be a safe identifier, starting with a letter.`);return v;};

export function validateModule(input){
  if(typeof input==='string'){if(input.length>2_000_000)throw Error('Module file is too large (2 MB maximum).');try{input=JSON.parse(input);}catch{throw Error('Module must be valid JSON.');}}
  if(!input||typeof input!=='object'||Array.isArray(input))throw Error('Module must be a JSON object.');
  if(input.schemaVersion!==undefined&&input.schemaVersion!==1)throw Error('This app supports module schemaVersion 1.');
  const id=text(input.id,'Module id',64);if(!/^[a-z][a-z0-9-]{0,63}$/.test(id))throw Error('Module id must be lowercase letters, digits, and hyphens.');
  const name=text(input.name,'Module name',100),version=text(input.version,'Module version',40),description=text(input.description,'Module description',1000);
  if(!/^[0-9]+\.[0-9]+\.[0-9]+(?:-[A-Za-z0-9.-]+)?$/.test(version))throw Error('Use a semantic version, such as 1.0.0.');
  if(!Array.isArray(input.functions)||input.functions.length>100||!Array.isArray(input.programs)||input.programs.length>30)throw Error('A module needs functions and programs arrays (max 100 functions, 30 programs).');
  if(!input.functions.length&&!input.programs.length)throw Error('Add at least one function or program to a module.');
  const names=new Set();
  const functions=input.functions.map(fn=>{
    if(!fn||typeof fn!=='object')throw Error('Each function must be an object.');
    const fnName=ident(fn.name,'Function name');
    if(names.has(fnName)||Object.hasOwn(math,fnName))throw Error(`Function ${fnName} duplicates another name or a built-in.`);names.add(fnName);
    if(!Array.isArray(fn.args)||fn.args.length>12)throw Error(`Function ${fnName} needs an args array (max 12).`);
    const args=fn.args.map(a=>ident(a,'Argument'));if(new Set(args).size!==args.length)throw Error(`Function ${fnName} has duplicate arguments.`);
    const expression=text(fn.expression,`Expression for ${fnName}`,1200),tree=math.parse(expression);
    let count=0;
    tree.traverse(node=>{
      if(++count>250)throw Error(`Function ${fnName} is too complex.`);
      if(['AssignmentNode','FunctionAssignmentNode','BlockNode','AccessorNode','ObjectNode','IndexNode','RangeNode'].includes(node.type))throw Error('Module expressions cannot contain assignments, accessors, objects, or ranges.');
      if(node.isFunctionNode&&(blocked.has(node.name)||typeof math[node.name]!=='function'))throw Error(`Function call ${node.name} is not an allowed built-in.`);
      if(node.isSymbolNode&&!args.includes(node.name)&&!['pi','e','i','tau','Infinity','true','false'].includes(node.name)&&typeof math[node.name]!=='function')throw Error(`Unknown symbol ${node.name}; list it in args.`);
    });
    return {name:fnName,args,expression};
  });
  const programNames=new Set();
  const programs=input.programs.map(p=>{
    if(!p||typeof p!=='object')throw Error('Each program must be an object.');
    const name=text(p.name,'Program name',100);if(programNames.has(name))throw Error('Program names must be unique inside a module.');programNames.add(name);
    if(!['javascript','python'].includes(p.language))throw Error('Program language must be javascript or python.');
    const code=text(p.code,'Program code',50000);return {name,language:p.language,code};
  });
  return {schemaVersion:1,id,name,version,description,functions,programs};
}

export const builtinModules=[validateModule({schemaVersion:1,id:'engineering',name:'Engineering essentials',version:'1.0.0',description:'Reusable mechanics, circuits, and growth functions. Invoke these in the calculator or with math.functionName() in the sandbox.',functions:[{name:'ohmVoltage',args:['current','resistance'],expression:'current*resistance'},{name:'kineticEnergy',args:['mass','velocity'],expression:'mass*velocity^2/2'},{name:'compoundGrowth',args:['principal','rate','periods'],expression:'principal*(1+rate)^periods'},{name:'quadDiscriminant',args:['a','b','c'],expression:'b^2-4*a*c'}],programs:[{name:'Projectile trajectory',language:'javascript',code:"const speed = 25;\nconst angle = 45 * Math.PI / 180;\nconst gravity = 9.81;\nconst flight = 2 * speed * Math.sin(angle) / gravity;\nconst times = math.range(0, flight, flight / 100).toArray();\nconst x = times.map(t => speed * Math.cos(angle) * t);\nconst y = times.map(t => speed * Math.sin(angle) * t - gravity * t * t / 2);\nplot(x, y, 'Projectile trajectory');\nprint('Flight time:', flight.toFixed(3), 's');\nreturn { range: speed * Math.cos(angle) * flight };"}]}),validateModule({schemaVersion:1,id:'machine-learning',name:'Machine learning toolkit',version:'1.0.0',description:'Activation functions, loss calculation, and a runnable gradient descent example.',functions:[{name:'sigmoidML',args:['z'],expression:'1/(1+exp(-z))'},{name:'reluML',args:['z'],expression:'max(0,z)'},{name:'mseLoss',args:['actual','predicted'],expression:'mean(dotPow(subtract(actual,predicted),2))'}],programs:[{name:'Gradient descent regression',language:'javascript',code:"const xs = [1, 2, 3, 4, 5];\nconst ys = [3, 5, 7, 9, 11];\nlet slope = 0, intercept = 0;\nconst losses = [];\nfor (let epoch = 0; epoch < 500; epoch++) {\n  const errors = xs.map((x, i) => slope * x + intercept - ys[i]);\n  slope -= 0.02 * 2 * math.mean(errors.map((e, i) => e * xs[i]));\n  intercept -= 0.02 * 2 * math.mean(errors);\n  losses.push(math.mean(errors.map(e => e * e)));\n}\nplot(losses.map((_, i) => i), losses, 'Training loss');\nprint('Fitted slope:', slope.toFixed(4));\nprint('Fitted intercept:', intercept.toFixed(4));\nreturn { slope, intercept, finalLoss: losses.at(-1) };"}]})];

export function loadModules(){try{const raw=JSON.parse(localStorage.getItem('palamedes.modules')||'[]');if(!Array.isArray(raw))return [];return raw.slice(0,30).flatMap(m=>{try{return [validateModule(m)];}catch{return [];}});}catch{return [];}}
export function saveModules(modules){if(!Array.isArray(modules)||modules.length>30)throw Error('Keep up to 30 installed modules.');const validated=modules.map(validateModule);const ids=new Set();for(const m of validated){if(ids.has(m.id))throw Error('Module ids must be unique.');ids.add(m.id);}localStorage.setItem('palamedes.modules',JSON.stringify(validated));return validated;}

export function moduleFunctions(modules){const out=[];for(const mod of modules||[])for(const fn of validateModule(mod).functions)out.push({...fn,module:mod.name});return out;}
