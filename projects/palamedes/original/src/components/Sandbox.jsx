import React,{useEffect,useMemo,useRef,useState} from 'react';
import {Play,Square,Save,Download,Upload,Terminal,ShieldCheck,LoaderCircle,Code2,FileCode2,Check,AlertCircle} from 'lucide-react';
import mathSource from '../../node_modules/mathjs/lib/browser/math.js?raw';
import {validateModule,builtinModules} from '../lib/modules.js';
import './Sandbox.css';

const JS_EXAMPLE=`// A tiny mathematical experiment.\n// math contains the full math.js library.\nconst xs = math.range(-6, 6, 0.05).toArray();\nconst ys = xs.map(x => Math.sin(x) * Math.exp(-x*x/18));\n\nprint('Samples:', xs.length);\nprint('Mean:', math.mean(ys));\nplot(xs, ys, 'Damped sine wave');\n\nreturn { peak: math.max(ys), areaEstimate: math.sum(ys) * 0.05 };`;
const PY_EXAMPLE=`import math\nimport statistics\n\nvalues = [2, 4, 5, 8, 11, 14]\nprint("Mean:", statistics.mean(values))\nprint("Standard deviation:", statistics.stdev(values))\nprint("Factorial of 10:", math.factorial(10))\n\n# The final expression is displayed as the result.\nsum(x*x for x in values)`;

// This function runs inside an opaque-origin iframe. Code only runs in its worker.
function frameBootstrap(channel,library,python){
  let worker=null,watchdog=null,url=null,currentId=null,count=0,readySeen=false;
  const send=(type,data={})=>parent.postMessage({channel,id:currentId,type,...data},'*');
  const end=()=>{if(worker)worker.terminate();worker=null;if(watchdog)clearTimeout(watchdog);watchdog=null;if(url)URL.revokeObjectURL(url);url=null;};
  const setDeadline=ms=>{if(watchdog)clearTimeout(watchdog);watchdog=setTimeout(()=>{end();send('error',{text:ms>5000?'Runtime loading timed out. Check your connection to the runtime CDN.':'Execution stopped after the 5-second limit.'});},ms);};
  const runtime=`
let outputCount=0;
const serialize=v=>{try {return typeof v==='string'?v:JSON.stringify(v,(k,x)=>typeof x==='bigint'?String(x):typeof x==='function'?'[function]':x,2);}catch{return String(v);}};
const print=(...values)=>{if(outputCount++<100)self.postMessage({type:'stdout',text:values.map(serialize).join(' ').slice(0,15000)});};
const plot=(x,y,title='Program output')=>{if(!Array.isArray(x)||!Array.isArray(y)||x.length!==y.length)throw Error('plot needs x and y arrays of equal length.');const points=x.slice(0,2000).map((v,i)=>[Number(v),Number(y[i])]).filter(p=>p.every(Number.isFinite));self.postMessage({type:'plot',points,title:String(title).slice(0,200)});};
console.log=print;console.info=print;console.warn=print;console.error=print;
`;
  addEventListener('message',event=>{
    if(event.source!==parent||event.data?.channel!==channel)return;
    const data=event.data;
    if(data.type==='stop'){end();send('stopped');return;}
    if(data.type!=='run'||typeof data.code!=='string'||data.code.length>50000)return;
    end();currentId=data.id;count=0;readySeen=false;
    let source;
    if(python){
      source=runtime+`self.onmessage=async event=>{try{self.postMessage({type:'status',text:'Downloading Python runtime from jsDelivr…'});importScripts('https://cdn.jsdelivr.net/pyodide/v0.27.7/full/pyodide.js');const py=await loadPyodide({indexURL:'https://cdn.jsdelivr.net/pyodide/v0.27.7/full/',stdout:s=>print(s),stderr:s=>print(s)});self.postMessage({type:'ready'});const result=await py.runPythonAsync(event.data.code);self.postMessage({type:'result',text:result===undefined?'Completed.':String(result).slice(0,20000)});if(result&&typeof result.destroy==='function')result.destroy();}catch(error){self.postMessage({type:'error',text:String(error.message||error).slice(0,3000)});}};`;
    }else{
      source=library+'\n'+runtime+`self.onmessage=async event=>{try{for(const fn of event.data.functions||[]){const callback=(...values)=>{const scope={};fn.args.forEach((a,i)=>scope[a]=values[i]);return math.evaluate(fn.expression,scope);};math.import({[fn.name]:callback},{override:false});}self.postMessage({type:'ready'});const AsyncFunction=Object.getPrototypeOf(async function(){}).constructor;const result=await new AsyncFunction('math','print','plot',event.data.code)(math,print,plot);self.postMessage({type:'result',text:result===undefined?'Completed.':serialize(result).slice(0,20000)});}catch(error){self.postMessage({type:'error',text:String(error.message||error).slice(0,3000)});}};`;
    }
    try{
      url=URL.createObjectURL(new Blob([source],{type:'text/javascript'}));worker=new Worker(url);
      worker.onmessage=e=>{
        if(++count>160){end();send('error',{text:'Output limit reached; execution stopped.'});return;}
        const d=e.data;if(!d||!['stdout','result','error','status','ready','plot'].includes(d.type))return;
        if(d.type==='ready'){if(!readySeen){readySeen=true;setDeadline(5000);send('status',{text:'Running program…'});}return;}
        if(d.type==='plot'){
          if(!Array.isArray(d.points)||d.points.length>2000)return;
          const points=d.points.filter(p=>Array.isArray(p)&&p.length===2&&p.every(v=>typeof v==='number'&&Number.isFinite(v)));
          send('plot',{points,title:String(d.title||'Program output').slice(0,200)});
        }else send(d.type,{text:String(d.text??'').slice(0,d.type==='result'?20000:15000)});
        if(d.type==='result'||d.type==='error')end();
      };
      worker.onerror=e=>{end();send('error',{text:String(e.message||'Worker failed.').slice(0,3000)});};
      setDeadline(python?120000:5000);worker.postMessage({code:data.code,functions:data.functions||[]});
    }catch(error){end();send('error',{text:String(error.message||error)});}
  });
  send('frame-ready');
}

function frameHTML(channel,python){
  const script=`(${frameBootstrap.toString()})(${JSON.stringify(channel)},${JSON.stringify(python?'':mathSource).replace(/</g,'\\u003c')},${JSON.stringify(python)});`;
  const policy=`default-src 'none'; script-src 'unsafe-inline' 'unsafe-eval'${python?' https://cdn.jsdelivr.net':''}; worker-src blob:; connect-src ${python?'https://cdn.jsdelivr.net':"'none'"};`;
  return `<!doctype html><html><head><meta http-equiv="Content-Security-Policy" content="${policy}"></head><body><script>${script.replace(/<\/script/gi,'<\\/script')}</script></body></html>`;
}

function safeStored(key,fallback){try{return localStorage.getItem(key)||fallback;}catch{return fallback;}}
function download(content,name,type='text/plain'){const url=URL.createObjectURL(new Blob([content],{type}));const a=document.createElement('a');a.href=url;a.download=name;a.click();URL.revokeObjectURL(url);}
function ProgramPlot({points,title}){
  if(!points.length)return null;
  const xs=points.map(p=>p[0]),ys=points.map(p=>p[1]),xmin=Math.min(...xs),xmax=Math.max(...xs),ymin=Math.min(...ys),ymax=Math.max(...ys),w=560,h=220,pad=30;
  const path=points.map(([x,y],i)=>`${i?'L':'M'}${pad+(x-xmin)/(xmax-xmin||1)*(w-2*pad)},${h-pad-(y-ymin)/(ymax-ymin||1)*(h-2*pad)}`).join(' ');
  return <figure className="sandbox-plot"><figcaption>{title}</figcaption><svg viewBox={`0 0 ${w} ${h}`} role="img" aria-label={title}><path d={`M${pad} ${pad}V${h-pad}H${w-pad}`} stroke="currentColor" fill="none" opacity=".2"/><path d={path} stroke="#b7e77c" fill="none" strokeWidth="2"/><text x={pad} y={h-7} fill="currentColor" fontSize="10">{xmin.toPrecision(3)}</text><text x={w-pad} y={h-7} textAnchor="end" fill="currentColor" fontSize="10">{xmax.toPrecision(3)}</text><text x="5" y={pad} fill="currentColor" fontSize="10">{ymax.toPrecision(3)}</text></svg></figure>;
}

export default function Sandbox({modules=[],onModulesChange,initialProgram}){
  const [language,setLanguage]=useState(initialProgram?.language==='python'?'python':'javascript'),[code,setCode]=useState(()=>initialProgram?.code||safeStored('palamedes.code.javascript',JS_EXAMPLE));
  const [output,setOutput]=useState([]),[plots,setPlots]=useState([]),[busy,setBusy]=useState(false),[status,setStatus]=useState('Ready'),[error,setError]=useState(''),[notice,setNotice]=useState(''),[ready,setReady]=useState(false);
  const frame=useRef(null),editor=useRef(null),lineNumbers=useRef(null),file=useRef(null),runId=useRef(0),start=useRef(0);
  const channel=useMemo(()=>Array.from(crypto.getRandomValues(new Uint32Array(4))).map(n=>n.toString(16)).join(''),[]);
  const srcDoc=useMemo(()=>frameHTML(channel,language==='python'),[channel,language]);
  useEffect(()=>{try{localStorage.setItem(`palamedes.code.${language}`,code);}catch{}},[language,code]);
  useEffect(()=>{
    const receive=e=>{const d=e.data;if(e.source!==frame.current?.contentWindow||d?.channel!==channel)return;if(d.type==='frame-ready'){setReady(true);return;}if(d.id!==runId.current)return;
      if(d.type==='stdout')setOutput(old=>[...old.slice(-99),{type:'stdout',text:String(d.text).slice(0,15000)}]);
      if(d.type==='plot')setPlots(old=>[...old.slice(-3),{points:d.points,title:d.title}]);
      if(d.type==='status')setStatus(d.text);
      if(d.type==='result'){setOutput(old=>[...old,{type:'result',text:d.text}]);setBusy(false);setStatus(`Completed in ${((performance.now()-start.current)/1000).toFixed(2)} s`);}
      if(d.type==='error'){setError(d.text);setBusy(false);setStatus('Stopped');}
      if(d.type==='stopped'){setBusy(false);setStatus('Stopped by you');}
    };
    window.addEventListener('message',receive);return()=>window.removeEventListener('message',receive);
  },[channel]);
  function changeLanguage(next){if(next===language)return;if(busy)stop();setReady(false);setLanguage(next);setCode(safeStored(`palamedes.code.${next}`,next==='python'?PY_EXAMPLE:JS_EXAMPLE));setOutput([]);setPlots([]);setError('');setStatus('Ready');}
  useEffect(()=>{
    const open=e=>{const p=e.detail;if(!p||!['javascript','python'].includes(p.language)||typeof p.code!=='string')return;if(busy)stop();setReady(p.language===language?ready:false);setLanguage(p.language);setCode(p.code);setNotice(`Loaded ${p.name||'program'}. Review the code, then press Run.`);setError('');};
    window.addEventListener('palamedes:program',open);return()=>window.removeEventListener('palamedes:program',open);
  },[busy,language,ready]);
  function run(){if(!ready||busy)return;if(code.length>50000){setError('Programs are limited to 50,000 characters.');return;}setError('');setOutput([]);setPlots([]);setNotice('');setBusy(true);start.current=performance.now();setStatus(language==='python'?'Loading Python runtime…':'Starting isolated worker…');runId.current++;frame.current.contentWindow.postMessage({channel,type:'run',id:runId.current,code,functions:modules.flatMap(m=>m.functions||[])},'*');}
  function stop(){frame.current?.contentWindow?.postMessage({channel,type:'stop'},'*');setBusy(false);setStatus('Stopped by you');}
  function saveProgram(){
    const name=window.prompt('Program name','My mathematical program');if(!name)return;
    const existing=modules.find(m=>m.id==='my-programs'),program={name,language,code};
    try{const mod=validateModule({...existing,schemaVersion:1,id:'my-programs',name:'My programs',version:'1.0.0',description:'Programs saved from the Palamedes sandbox.',functions:existing?.functions||[],programs:[...(existing?.programs||[]).filter(p=>p.name!==name),program]});onModulesChange?.([...modules.filter(m=>m.id!=='my-programs'),mod]);setNotice('Program saved to My programs. It will never run automatically.');setError('');}catch(e){setError(e.message);}
  }
  function keydown(e){if((e.ctrlKey||e.metaKey)&&e.key==='Enter'){e.preventDefault();run();}if(e.key==='Tab'){e.preventDefault();const el=e.currentTarget,start=el.selectionStart,end=el.selectionEnd;setCode(code.slice(0,start)+'  '+code.slice(end));requestAnimationFrame(()=>{el.selectionStart=el.selectionEnd=start+2;});}}
  return <div className="sandbox-workspace"><div className="sandbox-heading"><div><div className="eyebrow">AN IDEA. A FEW LINES. A DISCOVERY.</div><h2>Room to experiment.</h2><p className="muted">Write programs, explore algorithms, and make the calculator your own.</p></div><span className="sandbox-isolation"><ShieldCheck size={15}/> Isolated runtime</span></div>
    <div className="panel sandbox-editor-panel"><div className="sandbox-toolbar"><div className="segmented small">{['javascript','python'].map(lang=><button key={lang} className={language===lang?'active':''} onClick={()=>changeLanguage(lang)}>{lang==='javascript'?'JavaScript':'Python'}</button>)}</div><div className="sandbox-toolbar-actions"><select aria-label="Load a sandbox example" className="field" value="" onChange={e=>{if(!e.target.value)return;const p=e.target.value==='basic'?{language,code:language==='python'?PY_EXAMPLE:JS_EXAMPLE}:builtinModules.flatMap(m=>m.programs).find(p=>p.name===e.target.value);if(p){if(p.language!==language)changeLanguage(p.language);setCode(p.code);setNotice('Example loaded. Press Run to execute.');}}}><option value="">Load an example…</option><option value="basic">{language==='python'?'Python statistics':'Damped sine wave'}</option>{builtinModules.flatMap(m=>m.programs).map(p=><option key={p.name} value={p.name}>{p.name}</option>)}</select><input type="file" accept=".js,.py,.txt" ref={file} hidden onChange={async e=>{const f=e.target.files?.[0];if(f){if(f.size>50000)setError('Program file must be smaller than 50 KB.');else{const lang=f.name.endsWith('.py')?'python':'javascript';if(lang!==language)changeLanguage(lang);setCode(await f.text());setNotice('Program imported. Review it before running.');}}e.target.value='';}}/><button className="icon-button" title="Import program" onClick={()=>file.current?.click()}><Upload size={16}/></button><button className="icon-button" title="Export program" onClick={()=>download(code,`palamedes-program.${language==='python'?'py':'js'}`)}><Download size={16}/></button><button className="button" onClick={saveProgram}><Save size={15}/>Save program</button></div></div>
      <div className="sandbox-filebar"><FileCode2 size={14}/><span>experiment.{language==='python'?'py':'js'}</span><span className="sandbox-language">{code.split('\n').length} lines · {language==='python'?'Python / Pyodide':'JavaScript / math.js'}</span></div>
      <div className="sandbox-code"><div className="sandbox-line-numbers" ref={lineNumbers} aria-hidden="true">{code.split('\n').map((_,i)=><div key={i}>{i+1}</div>)}</div><textarea aria-label="Program code" ref={editor} value={code} onChange={e=>setCode(e.target.value)} onKeyDown={keydown} onScroll={e=>{if(lineNumbers.current)lineNumbers.current.scrollTop=e.target.scrollTop;}} spellCheck="false" autoCapitalize="off" autoComplete="off" autoCorrect="off"/></div>
      <div className="sandbox-runbar"><span className="sandbox-runtime-status">{busy?<LoaderCircle size={14} className="spin"/>:<span className="sandbox-ready-dot"/>}{status}</span><span className="sandbox-shortcut">Ctrl / ⌘ + Enter · 5 s execution limit</span>{busy?<button className="button sandbox-stop" onClick={stop}><Square size={14}/>Stop</button>:<button className="button button-primary" onClick={run} disabled={!ready}><Play size={15}/>{ready?'Run program':'Preparing runtime…'}</button>}</div>
    </div>
    {error&&<div className="sandbox-error" role="alert"><AlertCircle size={16}/>{error}</div>}{notice&&<div className="modules-notice" role="status"><Check size={16}/>{notice}</div>}
    <div className="sandbox-output-layout"><section className="panel sandbox-console"><div className="sandbox-output-heading"><h3><Terminal size={16}/>Output</h3><button onClick={()=>{setOutput([]);setPlots([]);setError('');}}>Clear</button></div><div className="sandbox-output" aria-live="polite">{!output.length&&!busy&&<span className="sandbox-output-placeholder">Run your program to see its output here.</span>}{busy&&!output.length&&<span className="sandbox-output-placeholder"><LoaderCircle size={15} className="spin"/> {status}</span>}{output.map((entry,i)=><pre className={entry.type==='result'?'sandbox-result':''} key={i}>{entry.type==='result'?'↳ ':''}{entry.text}</pre>)}</div>{plots.map((p,i)=><ProgramPlot key={i} {...p}/>)}</section><aside className="panel sandbox-reference"><h3><Code2 size={16}/>Runtime guide</h3>{language==='javascript'?<><code>math.evaluate('sin(pi/4)')</code><p>Scientific functions, matrices, units, complex numbers, and installed module functions.</p><code>print('Result:', value)</code><p>Send values to the output console. Return a value to show a final result.</p><code>plot(xs, ys, 'My plot')</code><p>Draw up to 2,000 finite points from equal-length JavaScript arrays.</p></>:<><code>import math, statistics</code><p>Python standard library runs locally after the first runtime download.</p><code>print(statistics.mean(values))</code><p>Standard output appears here. The final expression is shown as the result.</p></>}<div className="sandbox-security"><ShieldCheck size={16}/><p>{language==='python'?'Python downloads Pyodide 0.27.7 from jsDelivr. Its iframe allows only that CDN; the program has no access to this app’s DOM, storage, or API keys. Loading gets 120 seconds; code execution gets 5 seconds.':'JavaScript runs in a new worker inside an opaque-origin iframe. Its policy blocks network requests and access to the app’s DOM, storage, and API keys. Every run starts fresh and stops after 5 seconds.'}</p></div></aside></div>
    <iframe key={language} ref={frame} title="Isolated program runtime" sandbox="allow-scripts" srcDoc={srcDoc} hidden/>
  </div>;
}
