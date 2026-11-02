// Adapted from Palamedes (MIT, copyright 2026 Ag3nt47).
// This file isolates renderer effects. It does not control or close an OS window.
import React, { useCallback, useEffect, useRef, useState } from 'react';
import './palamedes-effects.css';

export function useInstrumentPower(initialPhase = 'opening') {
  const [phase, setPhase] = useState(initialPhase);
  const timer = useRef(null);
  const transition = useCallback((next, final, delay) => {
    clearTimeout(timer.current);
    setPhase(next);
    timer.current = setTimeout(() => setPhase(final), delay);
  }, []);
  useEffect(() => {
    if (initialPhase === 'opening') timer.current = setTimeout(() => setPhase('on'), 1050);
    return () => clearTimeout(timer.current);
  }, [initialPhase]);
  return {
    phase,
    powerOn: () => transition('opening', 'on', 1050),
    powerOff: () => transition('closing', 'off', 500),
  };
}

export function PowerOverlay({ phase, name = 'PALAMEDES', mark = 'P' }) {
  if (!['opening', 'closing'].includes(phase)) return null;
  const opening = phase === 'opening';
  return <div className={`pm-power-overlay ${opening ? '' : 'pm-is-closing'}`} role="status" aria-live="polite">
    <div className="pm-boot-mark" aria-hidden="true">{mark}</div>
    <h2>{name}</h2>
    <p>{opening ? 'A place for every problem.' : 'Saving your workspace.'}</p>
    <div className="pm-boot-loader" aria-hidden="true"><span /></div>
    <span className="pm-boot-caption">{opening ? 'INITIALIZING MATH INSTRUMENT' : 'POWERING DOWN'}</span>
  </div>;
}

export function WorkspaceLoader({ label = 'Loading workspace…' }) {
  return <div className="pm-workspace-loading" role="status">
    <div className="pm-loading-orbit" aria-hidden="true"><svg width="38" height="38" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M21 12a9 9 0 1 1-6.22-8.56" /></svg></div>
    <strong>{label}</strong><span>Preparing your instruments</span>
  </div>;
}

export function ProgressWheel({ value = 0, label = 'Progress' }) {
  const pct = Math.max(0, Math.min(100, Number.isFinite(value) ? value : 0));
  return <span className="pm-progress-wheel" style={{ '--pm-progress': `${pct * 3.6}deg` }} role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}><span>{Math.round(pct)}%</span></span>;
}

export function InstrumentFrame({ children, screenKey, backlight = '#36aaff', brightness = 1, title = 'PALAMEDES', model = 'PX · 01' }) {
  return <section className="pm-instrument-shell" style={{ '--pm-backlight': backlight, '--pm-brightness': brightness }}>
    <header className="pm-instrument-top"><span>{title} <small>{model}</small></span><span className="pm-status">● <small>LOCAL SYSTEM</small></span></header>
    <div className="pm-instrument-screen" key={screenKey}>{children}</div>
    <footer className="pm-instrument-bottom"><span>PROFESSIONAL INSTRUMENT SYSTEM</span><i /><span>DESIGNED FOR CURIOSITY</span></footer>
  </section>;
}

// The original settings modal fades in and unmounts immediately on dismissal.
// Dialog focus management belongs to the host application's accessible dialog.
export function ModalBackdrop({ children, onDismiss }) {
  return <div className="pm-modal-backdrop" onClick={event => { if (event.target === event.currentTarget) onDismiss?.(); }}>{children}</div>;
}
