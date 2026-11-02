import React, { useState, useEffect, useRef } from 'react';
import { ImagePlus, Clipboard, Sparkles, Check, AlertCircle, ArrowRight, ShieldCheck, X, LoaderCircle, ScanText, RotateCcw, Settings2 } from 'lucide-react';
import { solveProblem, SOLVER_EXAMPLES } from '../lib/solver.js';
import { solveWithAI, checkWithAI, evaluateVerification } from '../lib/ai.js';
import './Solver.css';

const statusIcon={pass:Check,fail:X,inconclusive:AlertCircle};
export default function Solver({aiSettings={enabled:false},onOpenSettings}) {
  const [text,setText]=useState('2*(x + 3) = 5*x - 9');
  const [image,setImage]=useState(null),[result,setResult]=useState(null),[error,setError]=useState('');
  const [busy,setBusy]=useState(false),[ocrBusy,setOcrBusy]=useState(false),[progress,setProgress]=useState(''),[ocrPct,setOcrPct]=useState(null);
  const [doubleCheck,setDoubleCheck]=useState(true),[ocrConfirmed,setOcrConfirmed]=useState(true);
  const fileInput=useRef(null),workerRef=useRef(null),runRef=useRef(0);
  useEffect(()=>()=>{runRef.current++;workerRef.current?.terminate();},[]);
  useEffect(()=>{
    const receive=e=>{if(e.detail?.tab==='solver'){setText(e.detail.text);setResult(null);setError('');setOcrConfirmed(true);}};
    window.addEventListener('palamedes:input',receive);return()=>window.removeEventListener('palamedes:input',receive);
  },[]);
  async function readImage(file){
    if(!file?.type.startsWith('image/')){setError('Choose a PNG, JPEG, WebP or another browser-readable image.');return;}
    if(file.size>12*1024*1024){setError('Please use an image smaller than 12 MB.');return;}
    setError('');setResult(null);setOcrConfirmed(false);
    const reader=new FileReader();reader.onload=()=>setImage({src:reader.result,name:file.name||'Pasted image'});reader.readAsDataURL(file);
  }
  async function recognize(){
    if(!image)return;
    setOcrBusy(true);setError('');setOcrPct(null);setProgress('Loading local OCR engine…');
    try{
      const {createWorker}=await import('tesseract.js');
      const worker=await createWorker('eng',1,{logger:m=>{if(m.status)setProgress(m.status);setOcrPct(typeof m.progress==='number'?Math.round(m.progress*100):null);}});
      workerRef.current=worker;
      const {data}=await worker.recognize(image.src);
      setText(data.text.trim());setProgress(`OCR confidence: ${Math.round(data.confidence)}%. Review the extracted text below.`);
      await worker.terminate();workerRef.current=null;
    }catch(e){setError(`OCR could not load or recognize this image. ${e.message} You can type the expression, or enable AI vision in Settings.`);setProgress('');}
    finally{setOcrBusy(false);}
  }
  function onPaste(e){const file=[...e.clipboardData.items].find(i=>i.type.startsWith('image/'))?.getAsFile();if(file){e.preventDefault();readImage(file);}}
  async function run(){
    if(ocrBusy||busy)return;
    if(image&&!aiSettings.enabled&&!ocrConfirmed){setError('Review the extracted text, correct OCR mistakes, then confirm it matches the image before solving.');return;}
    const id=++runRef.current;setBusy(true);setError('');setResult(null);
    try{
      let next;
      if(aiSettings.enabled){
        next=await solveWithAI(text,image?.src||null,{...aiSettings,doubleCheck});
        if(doubleCheck){
          const checks=[...(next.checks||[])];
          // Try the user's original mathematical input locally. AI-supplied expressions
          // are never treated as proof that the original word problem was understood.
          try{
            const local=solveProblem(text,{doubleCheck:true});
            checks.push(...local.checks.map(c=>({...c,label:`Local: ${c.label}`})));
            if(next.answer&&local.answer&&next.answer.replace(/\s/g,'')===local.answer.replace(/\s/g,''))checks.push({status:'pass',label:'Independent local answer',detail:`The deterministic solver also gives ${local.answer}.`});
            else{
              let comparison;
              try{const original=evaluateVerification(local.answer.replace(/^[a-z]\s*=\s*/i,'')),candidate=evaluateVerification(next.answer.replace(/^[a-z]\s*=\s*/i,''));const same=Math.abs(original-candidate)<=1e-8*Math.max(1,Math.abs(original),Math.abs(candidate));comparison={status:same?'pass':'fail',label:'Independent local answer comparison',detail:`The original problem gives ${local.answer} locally; the AI answer is ${next.answer}. ${same?'The numerical values agree.':'The numerical values disagree; review this solution.'}`};}catch{comparison={status:'inconclusive',label:'Local answer comparison',detail:`Local interpretation gives ${local.answer}. Compare this with the AI result; different forms may be equivalent.`};}
              checks.push(comparison);
            }
          }catch{checks.push({status:'inconclusive',label:'Local mathematical check',detail:'The original wording is outside the deterministic solver’s supported patterns.'});}
          try{const reviewed=await checkWithAI(text,next,{...aiSettings,imageDataUrl:image?.src||null});if(Array.isArray(reviewed))checks.push(...reviewed);else if(reviewed?.checks)checks.push(...reviewed.checks);else if(reviewed?.status)checks.push(reviewed);}catch(e){checks.push({status:'inconclusive',label:'AI review unavailable',detail:e.message});}
          next={...next,checks,source:'ai'};
        }
      }else next=solveProblem(text,{doubleCheck});
      if(id===runRef.current)setResult(next);
    }catch(e){if(id===runRef.current)setError(e.message||'The problem could not be solved.');}
    finally{if(id===runRef.current)setBusy(false);}
  }
  const failed=result?.checks?.some(c=>c.status==='fail'),inconclusive=result?.checks?.some(c=>c.status==='inconclusive');
  return <div className="solver-workspace" onPaste={onPaste}>
    <div className="solver-topline"><div><div className="eyebrow">UNDERSTAND · SOLVE · VERIFY</div><h2 className="section-title">Every answer has a working.</h2><p className="muted">Paste a problem or a photo. Follow the steps, then check the result.</p></div><span className={`solver-mode ${aiSettings.enabled?'ai':''}`}><span/>{aiSettings.enabled?'AI assistance enabled':'Local solver'}</span></div>
    <div className="solver-columns">
      <section className="panel solver-input-panel">
        <div className="solver-panel-heading"><h3>Your problem</h3><button className="button button-ghost" onClick={()=>{setText('');setImage(null);setResult(null);setError('');setOcrConfirmed(true);}} title="Clear problem"><RotateCcw size={16}/></button></div>
        <div className="solver-upload" role="button" tabIndex={0} onClick={()=>fileInput.current?.click()} onKeyDown={e=>{if(e.key==='Enter'||e.key===' ')fileInput.current?.click();}} onDragOver={e=>e.preventDefault()} onDrop={e=>{e.preventDefault();if(e.dataTransfer.files[0])readImage(e.dataTransfer.files[0]);}}>
          <ImagePlus size={25}/><strong>Drop an image or click to upload</strong><span>PNG, JPG, WebP · or paste with Ctrl / ⌘ V</span>
          <input ref={fileInput} type="file" accept="image/*" hidden onChange={e=>{if(e.target.files[0])readImage(e.target.files[0]);e.target.value='';}}/>
        </div>
        {image&&<div className="solver-image"><button className="solver-remove" title="Remove image" onClick={()=>{setImage(null);setOcrConfirmed(true);setProgress('');}}><X size={15}/></button><img src={image.src} alt="Problem to solve"/><div><span>{image.name}</span><button className="button" onClick={recognize} disabled={ocrBusy}>{ocrBusy?<LoaderCircle size={15} className="spin"/>:<ScanText size={15}/>}Read text</button></div></div>}
        {progress&&<div className="solver-progress" role="status">{ocrBusy&&(ocrPct===null?<LoaderCircle size={20} className="spin"/>:<span className="progress-wheel" style={{'--progress':`${ocrPct*3.6}deg`}}><span>{ocrPct}%</span></span>)}{progress}</div>}
        <label className="solver-label" htmlFor="problem-text">{image?'Review / describe the problem':'Or type a question or expression'}</label>
        <textarea id="problem-text" className="field solver-text" rows={6} value={text} onChange={e=>{setText(e.target.value);setResult(null);}} placeholder="Solve 2x + 3 = 11, differentiate x^3, or ask: what is 18% of 250?" onKeyDown={e=>{if((e.ctrlKey||e.metaKey)&&e.key==='Enter')run();}}/>
        {image&&!aiSettings.enabled&&<label className="solver-option"><input type="checkbox" checked={ocrConfirmed} onChange={e=>setOcrConfirmed(e.target.checked)}/><span>I checked that the text matches the image.</span></label>}
        <div className="solver-actions"><label className="solver-option"><input type="checkbox" checked={doubleCheck} onChange={e=>setDoubleCheck(e.target.checked)}/><ShieldCheck size={16}/><span>Double-check</span></label><span className="muted solver-shortcut">Ctrl + Enter</span></div>
        <button className="button button-primary solver-run" onClick={run} disabled={busy||ocrBusy}>{busy?<LoaderCircle size={18} className="spin"/>:<Sparkles size={18}/>} {busy?'Solving & checking…':'Show me the working'}{!busy&&<ArrowRight size={18}/>}</button>
        {error&&<div className="solver-error" role="alert"><AlertCircle size={18}/><span>{error}</span></div>}
        <div className="solver-examples"><span className="eyebrow">TRY A PROBLEM</span><div>{SOLVER_EXAMPLES.map(x=><button key={x.label} onClick={()=>{setText(x.text);setResult(null);setError('');setImage(null);setOcrConfirmed(true);}}>{x.label}<ArrowRight size={12}/></button>)}</div></div>
        <p className="solver-footnote">Local interpretation supports listed patterns and explicit mathematical expressions. Printed-text OCR needs an initial download; handwriting and notation may need corrections.</p>
        <button className="solver-settings-link" onClick={onOpenSettings}><Settings2 size={14}/>{aiSettings.enabled?'Manage AI settings':'Broader word problems? Configure optional AI'}</button>
      </section>
      <section className="panel solver-output-panel" aria-live="polite">
        <div className="solver-panel-heading"><h3>The working</h3>{result&&<span className="solver-source">{result.source==='ai'?'AI-assisted':'Deterministic'}</span>}</div>
        {!result&&!busy&&<div className="solver-empty"><div className="solver-empty-icon"><Sparkles size={30}/></div><h3>From question to understanding.</h3><p>Your answer, calculation steps, and verification checks will appear here.</p><div><span>01 &nbsp; Interpret</span><span>02 &nbsp; Work through</span><span>03 &nbsp; Verify</span></div></div>}
        {busy&&<div className="solver-empty"><LoaderCircle size={34} className="spin"/><h3>{aiSettings.enabled?'Reading, solving, reviewing…':'Working through your problem…'}</h3><p>{aiSettings.enabled?'AI results will be checked separately where supported.':'Calculations run locally in your browser.'}</p></div>}
        {result&&<>
          <div className="solver-interpretation"><span className="eyebrow">INTERPRETATION</span><p>{result.interpretation||result.title}</p></div>
          <ol className="solver-steps">{(result.steps||[]).map((s,i)=><li key={i}><span className="solver-step-number">{i+1}</span><div><h4>{s.title}</h4><p>{s.detail}</p>{s.expression&&<code>{s.expression}</code>}</div></li>)}</ol>
          <div className="solver-answer"><span className="eyebrow">ANSWER</span><strong>{result.answer}</strong><button title="Copy answer" onClick={()=>navigator.clipboard?.writeText(result.answer)}><Clipboard size={16}/></button></div>
          {doubleCheck&&result.checks?.length>0&&<div className={`solver-checks ${failed?'has-fail':inconclusive?'has-unknown':'all-pass'}`}><div className="solver-checks-title"><ShieldCheck size={18}/><strong>{failed?'Check found a mismatch':inconclusive?'Checked with limitations':'Checks passed'}</strong></div>{result.checks.map((c,i)=>{const Icon=statusIcon[c.status]||AlertCircle;return <div key={i} className={`solver-check ${c.status}`}><Icon size={16}/><div><strong>{c.label}</strong><p>{c.detail}</p></div></div>;})}<p className="solver-check-note">A numerical or AI check increases confidence; it is not a formal proof. Review assumptions and domains.</p></div>}
        </>}
      </section>
    </div>
  </div>;
}
