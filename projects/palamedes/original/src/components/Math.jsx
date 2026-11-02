import katex from 'katex';
export default function MathText({ tex = '', block = true }) {
  let html;
  try { html = katex.renderToString(String(tex), { throwOnError: false, displayMode: block, strict: false, trust: false }); }
  catch { return <code>{String(tex)}</code>; }
  return <span className={`math-text ${block ? 'math-block' : ''}`} dangerouslySetInnerHTML={{ __html: html }} />;
}
