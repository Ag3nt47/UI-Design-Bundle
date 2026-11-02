import test from 'node:test';
import assert from 'node:assert/strict';
import {validateModule,builtinModules,saveModules,loadModules} from '../src/lib/modules.js';
const valid=()=>({schemaVersion:1,id:'my-math',name:'My math',version:'1.0.0',description:'My functions',functions:[{name:'cubeCustom',args:['x'],expression:'x^3'}],programs:[{name:'Program',language:'javascript',code:'print(2+2)'}]});

test('valid module is canonicalized and programs remain plain text',()=>{
  const source=valid(),out=validateModule(JSON.stringify(source));assert.deepEqual(out,source);assert.equal(typeof out.programs[0].code,'string');assert.equal(out.functions[0].expression,'x^3');
});
test('starter packs are valid and provide engineering and ML functions',()=>{
  assert.equal(builtinModules.length,2);for(const m of builtinModules)assert.deepEqual(validateModule(m),m);
  assert.ok(builtinModules.flatMap(m=>m.functions).some(f=>f.name==='mseLoss'));
});
test('unsafe identifiers, duplicate names and built-in overrides are rejected',()=>{
  for(const name of ['__proto__','constructor','import','1bad','bad-name','sin'])assert.throws(()=>validateModule({...valid(),functions:[{name,args:['x'],expression:'x'}]}));
  assert.throws(()=>validateModule({...valid(),functions:[...valid().functions,...valid().functions]}),/duplicates/);
});
test('assignment, accessors, unknown variables and evaluator escape calls are rejected',()=>{
  for(const expression of ['x=2','f(x)=x','x[1]','x.constructor','evaluate("2+2")','import("fs")','unknown(x)','x+y'])assert.throws(()=>validateModule({...valid(),functions:[{name:'safeFunction',args:['x'],expression}]}),undefined,expression);
});
test('safe elementary composition and array-capable numeric built-ins are accepted',()=>{
  assert.equal(validateModule({...valid(),functions:[{name:'gaussianCustom',args:['x'],expression:'exp(-x^2/2)/sqrt(2*pi)'}]}).functions.length,1);
});
test('schema, versions, sizes and unsupported program languages fail clearly',()=>{
  assert.throws(()=>validateModule('not json'),/valid JSON/);
  assert.throws(()=>validateModule({...valid(),schemaVersion:2}),/schemaVersion/);
  assert.throws(()=>validateModule({...valid(),version:'latest'}),/semantic version/);
  assert.throws(()=>validateModule({...valid(),programs:[{name:'Bad',language:'bash',code:'echo hello'}]}),/javascript or python/);
  assert.throws(()=>validateModule({...valid(),programs:[{name:'Big',language:'javascript',code:'x'.repeat(50001)}]}),/50000/);
  assert.throws(()=>validateModule({...valid(),functions:[],programs:[]}),/at least/);
});
test('persistence validates modules and safely recovers corrupt storage',()=>{
  const old=globalThis.localStorage,store=new Map();globalThis.localStorage={setItem:(k,v)=>store.set(k,v),getItem:k=>store.get(k)||null};
  try{saveModules([valid()]);assert.deepEqual(loadModules(),[valid()]);assert.throws(()=>saveModules([valid(),valid()]),/unique/);store.set('palamedes.modules','bad json');assert.deepEqual(loadModules(),[]);store.set('palamedes.modules',JSON.stringify([{name:'Invalid'},valid()]));assert.equal(loadModules().length,1);}finally{globalThis.localStorage=old;}
});
