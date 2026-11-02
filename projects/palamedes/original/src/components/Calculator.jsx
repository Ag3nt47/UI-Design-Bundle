import { useEffect, useRef, useState } from 'react';
import { ArrowUpRight, CheckCheck, Copy, CornerDownLeft, Delete, History, Trash2 } from 'lucide-react';
import { evaluateExpression } from '../lib/engine.js';
import { readStorage, writeStorage, download } from '../lib/storage.js';
import { crossCheck } from '../lib/verification.js';
import MathText from './Math.jsx';

const science = ['sin(', 'cos(', 'tan(', 'asin(', 'acos(', 'atan(', 'sinh(', 'cosh(', 'tanh(', 'log10(', 'log(', 'exp(', 'sqrt(', '^2', '^', 'abs(', 'pi', 'e', 'i', '!', 'gcd(', 'lcm(', 'combinations(', 'permutations('];
const keys = ['AC','(',')','⌫','7','8','9','÷','4','5','6','×','1','2','3','−','0','.','%','+'];
export default function Calculator({ advanced, angle, setAngle, modules = [], initialInput = '', onNavigate }) {
  const [expression,setExpression] = useState(initialInput || '');
  const [result,setResult] = useState(null);
  const [error,setError] = useState('');
  const [check,setCheck] = useState(null);
  const [doubleCheck,setDoubleCheck] = useState(true);
  const [history,setHistory] = useState(()=>readStorage('history',[]));
  const input = useRef(null), scope = useRef({ans:0});
  useEffect(()=>{ const fn=e=>{if(e.detail.tab==='calculator'){setExpression(e.detail.text);setTimeout(()=>input.current?.focus(),50)}};window.addEventListener('palamedes:input',fn);return()=>window.removeEventListener('palamedes:input',fn)},[]);
  function insert(text) {
    const el=input.current, start=el?.selectionStart??expression.length, end=el?.selectionEnd??start;
    setExpression(expression.slice(0,start)+text+expression.slice(end));
    requestAnimationFrame(()=>{el?.focus();el?.setSelectionRange(start+text.length,start+text.length)});
  }
  function calculate(e) {
    e?.preventDefault();setError('');setCheck(null);
    try {
      for (const mod of modules) for(const f of mod.functions||[]) evaluateExpression(`${f.name}(${f.args.join(',')})=${f.expression}`,scope.current,angle);
      const r=evaluateExpression(expression,scope.current,angle);setResult(r);
      if(doubleCheck)setCheck(crossCheck(expression,r.raw,scope.current,angle));
      scope.current.ans=r.raw;
      const next=[{expression,value:r.value,latex:r.latex,time:new Date().toISOString()},...history].slice(0,100);
      setHistory(next);writeStorage('history',next);
    } catch(err){setError(err.message);}
  }
  return <div className="calculator-layout">
    <div className="stack">
      <section className="panel calculator-panel">
        <div className="panel-header"><div><span className="eyebrow">YOUR EVERYDAY MATH, ELEVATED</span><h2>{advanced?'Scientific':'Standard'} calculator</h2></div><div className="segmented small">{['RAD','DEG'].map(x=><button key={x} className={angle===x?'active':''} onClick={()=>setAngle(x)}>{x}</button>)}</div></div>
        <form onSubmit={calculate} className="calc-display">
          <label htmlFor="expression" className="sr-only">Calculation</label>
          <input ref={input} id="expression" autoComplete="off" spellCheck="false" placeholder="Enter an expression…" value={expression} onChange={e=>setExpression(e.target.value)} />
          <div className="calc-result" aria-live="polite">{error?<span className="error-message">{error}</span>:result?<><span className="equals-sign">=</span><MathText tex={result.latex||result.value} block={false}/><button type="button" className="icon-button" title="Copy result" onClick={()=>navigator.clipboard?.writeText(result.value)}><Copy size={16}/></button></>:<span className="placeholder-result">0</span>}</div>
          <div className="display-footer"><span>Enter to calculate · ans recalls your last result</span><span className="live-dot">LOCAL ENGINE</span></div>
        </form>
        <div className="keypad-wrapper">
          {advanced&&<div className="scientific-keys">{science.map(k=><button key={k} onClick={()=>insert(k)}>{k.replace('(', '').replace('sqrt','√').replace('pi','π')}</button>)}</div>}
          <div className="number-keys">{keys.map((k,i)=><button key={k} className={`${i<4?'utility-key':''} ${['÷','×','−','+'].includes(k)?'operator-key':''}`} onClick={()=>k==='AC'?(setExpression(''),setResult(null),setCheck(null),setError('')):k==='⌫'?setExpression(s=>s.slice(0,-1)):insert(k==='%'?'/100':k)}>{k==='⌫'?<Delete size={22}/>:k}</button>)}<button className="ans-key" onClick={()=>insert('ans')}>ans</button><button className="solve-key" onClick={()=>onNavigate('solver',expression)}>Show work <ArrowUpRight size={15}/></button><button className="equals-key" aria-label="Calculate" onClick={calculate}>=</button></div>
        </div>
        <div className="calc-check"><label className="check-label"><input type="checkbox" checked={doubleCheck} onChange={e=>setDoubleCheck(e.target.checked)}/><CheckCheck size={16}/> Double-check results</label><span className="muted">{advanced?'Complex numbers · Units · Variables':'Standard arithmetic'}</span></div>
        {check&&<div className={`check-result ${check.status}`}><strong>{check.label}</strong><span>{check.detail}</span></div>}
      </section>
      <div className="example-strip"><span className="eyebrow">TRY SOMETHING</span>{['sqrt(144) + 2^5','5 cm to inch','(3 + 2i) * (1 - i)','f(x) = x^2 + 1'].map(x=><button key={x} onClick={()=>{setExpression(x);input.current?.focus()}}>{x}</button>)}</div>
      <section className="panel quick-start"><div><span className="eyebrow">MORE THAN AN ANSWER</span><h3>Understand every step.</h3><p>Paste a question or a photo. Follow the work, then check the result.</p><button className="button button-primary" onClick={()=>onNavigate('solver')}>Open worked solver <ArrowUpRight size={16}/></button></div><div className="formula-decoration">∫<span>∞</span><small>possibilities</small></div></section>
    </div>
    <aside className="stack"><section className="panel history-panel"><div className="panel-header"><h3><History size={17}/> Calculation history</h3><button className="icon-button" title="Clear calculation history" onClick={()=>{setHistory([]);writeStorage('history',[])}}><Trash2 size={15}/></button></div><div className="history-list">{history.length?history.map((h,i)=><button className="history-item" key={h.time+i} onClick={()=>setExpression(h.expression)}><code>{h.expression}</code><strong>= {h.value}</strong><span>{new Date(h.time).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})}</span></button>):<div className="empty-state"><History size={28}/><p>A little room for your thinking.</p><span>Your calculations will appear here.</span></div>}</div>{history.length>0&&<button className="button history-export" onClick={()=>download('palamedes-history.json',JSON.stringify(history,null,2))}>Export history</button>}</section><section className="panel tips-panel"><span className="eyebrow">MAKE YOURSELF AT HOME</span><p><kbd>Enter</kbd> Calculate</p><p><kbd>Ctrl</kbd> + <kbd>K</kbd> Smart input</p><p><kbd>ans</kbd> Previous answer</p><p><kbd>x = 5</kbd> Save a variable</p><p><kbd>f(x) = x²</kbd> Define a function</p><p className="muted">Use ^ for powers and * for multiplication. Scientific functions follow the angle mode above.</p></section></aside>
  </div>;
}
