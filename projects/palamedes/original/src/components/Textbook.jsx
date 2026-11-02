import React, { useMemo, useState } from 'react';
import { ArrowRight, BookOpen, Check, ChevronDown, ExternalLink, Search } from 'lucide-react';
import MathText from './Math.jsx';
import { TEXTBOOK, TEXTBOOK_CATEGORIES, TEXTBOOK_SOURCES, searchTextbook } from '../lib/textbook.js';

export default function Textbook({ onNavigate, initialCategory = 'All' }) {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState(initialCategory);
  const [expanded, setExpanded] = useState(null);
  const [showSources, setShowSources] = useState(false);
  const entries = useMemo(() => searchTextbook(query, category), [query, category]);

  return <div className="textbook-workspace stack">
    <section className="panel textbook-intro">
      <div className="panel-header">
        <div><span className="eyebrow">THE PALAMEDES TEXTBOOK</span><h2>Understand the equation.</h2><p className="muted">{TEXTBOOK.length} curated formulas, their conditions, and worked examples. From first fractions to neural network weights.</p></div>
        <BookOpen size={30} aria-hidden="true" />
      </div>
      <div className="panel-body stack">
        <label className="textbook-search field"><span>Find an equation or idea</span><div style={{ position: 'relative' }}><Search size={18} aria-hidden="true" style={{ position: 'absolute', left: 13, top: 13, color: 'var(--muted)' }} /><input aria-label="Search textbook" value={query} onChange={event => setQuery(event.target.value)} placeholder="Try quadratic, derivative, weights, softmax…" style={{ paddingLeft: 40 }} /></div></label>
        <div className="textbook-categories" role="group" aria-label="Textbook topics" style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
          {['All', ...TEXTBOOK_CATEGORIES].map(topic => <button key={topic} className={`button button-small${category === topic ? ' button-primary' : ''}`} aria-pressed={category === topic} onClick={() => { setCategory(topic); setExpanded(null); }}>{topic}</button>)}
        </div>
        <div className="textbook-meta" style={{ display: 'flex', gap: 12, alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap' }}><p className="muted" aria-live="polite">{entries.length} {entries.length === 1 ? 'equation' : 'equations'} · Select a card to explore its rules and example.</p><button className="button button-small" aria-expanded={showSources} onClick={() => setShowSources(value => !value)}><ExternalLink size={14} /> References</button></div>
        {showSources && <div className="textbook-sources"><p className="muted">A curated, extensible handbook. The explanations and examples are original; these references provide further study. This collection does not cover every possible equation.</p><ul>{TEXTBOOK_SOURCES.map(source => <li key={source.id}><a href={source.url} target="_blank" rel="noreferrer">{source.title}</a></li>)}</ul></div>}
      </div>
    </section>

    {!entries.length && <section className="panel"><div className="panel-body"><h3>No matching equations</h3><p className="muted">Try a shorter term or choose All topics.</p><button className="button" onClick={() => { setQuery(''); setCategory('All'); }}>Reset search</button></div></section>}

    <div className="textbook-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,360px),1fr))', alignItems: 'start', gap: 16 }}>
      {entries.map(item => {
        const open = expanded === item.id;
        const source = TEXTBOOK_SOURCES.find(reference => reference.id === item.source);
        return <article key={item.id} className={`panel textbook-card${open ? ' is-expanded' : ''}`} style={{ minWidth: 0, overflow: 'hidden' }}>
          <button className="textbook-card-toggle" aria-expanded={open} aria-controls={`textbook-${item.id}`} onClick={() => setExpanded(open ? null : item.id)} style={{ display: 'block', width: '100%', textAlign: 'left', color: 'inherit', border: 0, background: 'transparent', padding: 22, cursor: 'pointer' }}>
            <span className="eyebrow">{item.category}</span>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', marginTop: 8 }}><h3 style={{ margin: 0 }}>{item.title}</h3><ChevronDown size={18} aria-hidden="true" style={{ flexShrink: 0, transform: open ? 'rotate(180deg)' : undefined }} /></div>
            <div className="textbook-formula" style={{ overflowX: 'auto', margin: '19px 0', minHeight: 34 }}><MathText tex={item.formula} /></div>
            <p className="muted" style={{ marginBottom: 0 }}>{item.description}</p>
            <span className="textbook-expand-label" style={{ display: 'inline-block', marginTop: 15, color: 'var(--accent)', fontSize: 12 }}>{open ? 'Close worked example' : 'Rules & worked example'} <ArrowRight size={12} aria-hidden="true" style={{ verticalAlign: 'middle' }} /></span>
          </button>
          {open && <div id={`textbook-${item.id}`} className="textbook-details panel-body" style={{ borderTop: '1px solid var(--border)', padding: 22 }}>
            <span className="eyebrow">CONDITIONS & RULES</span>
            <ul className="textbook-rules" style={{ paddingLeft: 19, lineHeight: 1.7 }}>{item.conditions.map((condition, index) => <li key={index}>{condition}</li>)}</ul>
            <div className="textbook-worked-example" style={{ background: 'var(--bg)', border: '1px solid var(--border)', padding: 18, borderRadius: 12, marginTop: 20 }}>
              <span className="eyebrow">WORKED EXAMPLE</span><p style={{ fontWeight: 600 }}>{item.example.problem}</p>
              <ol className="textbook-steps" style={{ paddingLeft: 20, lineHeight: 1.8 }}>{item.example.steps.map((step, index) => <li key={index} style={{ marginBottom: 9 }}>{step}</li>)}</ol>
              <div className="textbook-answer" style={{ display: 'flex', gap: 9, alignItems: 'baseline', paddingTop: 13, borderTop: '1px solid var(--border)' }}><Check size={16} aria-hidden="true" style={{ color: 'var(--accent)', flexShrink: 0 }} /><strong>{item.example.answer}</strong></div>
            </div>
            <div style={{ display: 'flex', gap: 12, alignItems: 'center', justifyContent: 'space-between', marginTop: 18, flexWrap: 'wrap' }}>
              {onNavigate && <button className="button button-primary button-small" onClick={() => onNavigate(item.calculatorTab, item.input)}>Try in calculator <ArrowRight size={14} /></button>}
              {source && <a className="muted" href={source.url} target="_blank" rel="noreferrer" style={{ fontSize: 11, display: 'inline-flex', gap: 5, alignItems: 'center' }}>Further study <ExternalLink size={12} /></a>}
            </div>
          </div>}
        </article>;
      })}
    </div>
  </div>;
}
