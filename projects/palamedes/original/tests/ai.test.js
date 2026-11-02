import test from 'node:test';
import assert from 'node:assert/strict';
import {solveWithAI,checkWithAI,evaluateVerification} from '../src/lib/ai.js';

const settings={enabled:true,provider:'openai',apiKey:'test-only-not-a-real-key',model:'gpt-4.1',endpoint:'https://api.openai.com/v1/responses'};
const solution=(overrides={})=>({title:'Addition',interpretation:'Add two and three.',answer:'5',steps:[{title:'Add',detail:'Combine the quantities.',expression:'2+3=5'}],checks:[],verificationExpression:'2+3',...overrides});
const response=(value,extra={})=>({ok:true,status:200,json:async()=>({status:'completed',output:[{type:'message',content:[{type:'output_text',text:JSON.stringify(value)}]}],...extra})});
async function mocked(fn,run){const old=globalThis.fetch;globalThis.fetch=fn;try{return await run();}finally{globalThis.fetch=old;}}

test('disabled AI performs no request and does not inspect endpoint',async()=>{
  let calls=0;await mocked(async()=>{calls++;throw Error('must not fetch');},async()=>{
    await assert.rejects(()=>solveWithAI('2+3',null,{enabled:false,endpoint:'http://invalid'}),/disabled/);
    await assert.rejects(()=>checkWithAI('2+3',solution(),{enabled:false}),/disabled/);
  });assert.equal(calls,0);
});
test('Responses request uses strict schema, runtime Authorization and non-storage',async()=>{
  await mocked(async(url,options)=>{
    assert.equal(url,settings.endpoint);assert.equal(options.headers.Authorization,`Bearer ${settings.apiKey}`);
    assert.equal(options.credentials,'omit');const body=JSON.parse(options.body);
    assert.equal(body.store,false);assert.equal(body.text.format.type,'json_schema');assert.equal(body.text.format.strict,true);
    assert.equal(body.input[0].content[0].text,'2+3');assert.ok(!options.body.includes(settings.apiKey));
    return response(solution());
  },async()=>{const result=await solveWithAI('2+3',null,settings);assert.equal(result.answer,'5');assert.equal(result.source,'ai');assert.equal(result.checks[0].status,'pass');assert.match(result.checks[0].detail,/not whether the expression correctly represents/);});
});
test('local arithmetic comparison catches an inconsistent numerical answer',async()=>{
  await mocked(async()=>response(solution({answer:'6'})),async()=>{const r=await solveWithAI('2+3',null,settings);assert.equal(r.checks[0].status,'fail');});
});
test('local arithmetic check is inconclusive for symbolic results and can be disabled',async()=>{
  await mocked(async()=>response(solution({answer:'x^2',verificationExpression:''})),async()=>{const r=await solveWithAI('integrate 2*x',null,settings);assert.equal(r.checks[0].status,'inconclusive');});
  await mocked(async()=>response(solution()),async()=>{const r=await solveWithAI('2+3',null,{...settings,doubleCheck:false});assert.equal(r.checks.length,0);});
});
test('model self-checks are discarded rather than trusted',async()=>{
  await mocked(async()=>response(solution({checks:[{status:'pass',label:'Trust me',detail:'I am certain.'}]})),async()=>{const r=await solveWithAI('2+3',null,settings);assert.equal(r.checks.length,1);assert.ok(!r.checks.some(c=>c.label==='Trust me'));});
});
test('images use high-detail input_image and image-only input receives instructions',async()=>{
  const image='data:image/png;base64,AQID';
  await mocked(async(_,options)=>{const body=JSON.parse(options.body);assert.deepEqual(body.input[0].content[1],{type:'input_image',image_url:image,detail:'high'});assert.match(body.input[0].content[0].text,/attached mathematical problem/);return response(solution());},()=>solveWithAI('',image,settings));
});
test('invalid images and oversized problem text fail before fetching',async()=>{
  let calls=0;await mocked(async()=>{calls++;return response(solution());},async()=>{
    await assert.rejects(()=>solveWithAI('2+3','https://example.com/a.png',settings),/data URL/);
    await assert.rejects(()=>solveWithAI('2+3','data:image/svg+xml;base64,AQID',settings),/PNG/);
    await assert.rejects(()=>solveWithAI('a'.repeat(12001),null,settings),/12,000/);
  });assert.equal(calls,0);
});
test('endpoint validation prevents insecure remote and embedded credentials',async()=>{
  let calls=0;await mocked(async()=>{calls++;return response(solution());},async()=>{
    for(const endpoint of ['http://example.com/v1/responses','https://key@example.com/v1/responses','https://example.com/v1/responses?key=abc','file:///tmp/api'])await assert.rejects(()=>solveWithAI('2+3',null,{...settings,endpoint}),/HTTPS|credentials|endpoint/);
  });assert.equal(calls,0);
});
test('OpenAI-compatible endpoint receives Chat Completions format',async()=>{
  await mocked(async(url,options)=>{assert.equal(url,'http://localhost:1234/v1/chat/completions');assert.equal(options.headers.Authorization,undefined);const body=JSON.parse(options.body);assert.equal(body.response_format.type,'json_schema');assert.equal(body.messages[0].role,'system');assert.equal(body.messages[1].content[0].type,'text');return {ok:true,status:200,json:async()=>({choices:[{finish_reason:'stop',message:{content:JSON.stringify(solution())}}]})};},async()=>{const r=await solveWithAI('2+3',null,{enabled:true,provider:'compatible',endpoint:'http://localhost:1234/v1/chat/completions',model:'local-model',apiKey:''});assert.equal(r.answer,'5');});
});
test('refusal, incomplete output, provider errors and malformed JSON are explicit',async()=>{
  await mocked(async()=>response(null,{output:[{type:'message',content:[{type:'refusal',refusal:'Cannot interpret this.'}]}]}),async()=>assert.rejects(()=>solveWithAI('2+3',null,settings),/declined/));
  await mocked(async()=>response(null,{status:'incomplete',incomplete_details:{reason:'max_output_tokens'}}),async()=>assert.rejects(()=>solveWithAI('2+3',null,settings),/incomplete/));
  await mocked(async()=>({ok:false,status:429,json:async()=>({error:{message:'Too many requests'}})}),async()=>assert.rejects(()=>solveWithAI('2+3',null,settings),/429.*Too many/));
  await mocked(async()=>response(null,{output_text:'not json'}),async()=>assert.rejects(()=>solveWithAI('2+3',null,settings),/valid structured JSON/));
  await mocked(async()=>response({answer:'5'}),async()=>assert.rejects(()=>solveWithAI('2+3',null,settings),/invalid solution structure/));
});
test('provider error and output never echo runtime key',async()=>{
  await mocked(async()=>({ok:false,status:500,json:async()=>({error:{message:`Bad key ${settings.apiKey}`}})}),async()=>{await assert.rejects(()=>solveWithAI('2+3',null,settings),e=>!e.message.includes(settings.apiKey)&&e.message.includes('[redacted]'));});
  await mocked(async()=>response(solution({answer:settings.apiKey})),async()=>{const r=await solveWithAI('2+3',null,settings);assert.equal(r.answer,'[redacted]');});
});
test('review uses original problem and proposed working and reports separate verdict',async()=>{
  await mocked(async(_,options)=>{const body=JSON.parse(options.body),data=JSON.parse(body.input[0].content[0].text);assert.equal(data.originalProblem,'2+3');assert.equal(data.proposedSolution.answer,'6');assert.match(body.instructions,/Independently check/);return response({status:'fail',label:'Arithmetic mismatch',detail:'2+3 equals 5, not 6.'});},async()=>{const checks=await checkWithAI('2+3',solution({answer:'6'}),settings);assert.equal(checks[0].status,'fail');assert.match(checks[0].label,/AI review/);assert.match(checks[0].detail,/not a formal proof/);});
});
test('numeric verifier allows elementary arithmetic and denies assignments, symbols and code',()=>{
  assert.equal(evaluateVerification('sqrt(9)+2^3'),11);
  assert.equal(evaluateVerification('-2 + abs(-3)'),1);
  assert.ok(Math.abs(evaluateVerification('sin(pi/2)')-1)<1e-12);
  for(const expr of ['x+2','a=3','import("fs")','[1,2]','random()','2^99999','1/0'])assert.throws(()=>evaluateVerification(expr));
});
