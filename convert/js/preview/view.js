/* Draws the preview block: the input box (optional), the before and after panels, a note, and the Copy, Swap
 * and Download buttons. Takes the plain panel data from model.js. Browser only. */
import { h } from '../ui/dom.js';
import { fmtSize } from '../io/files.js';
import { fillModel } from './model3d.js';

function panel(title) {
  const meta = h('span', { class: 'cv-pv-meta' });
  const body = h('div', { class: 'cv-pv-body' });
  const fig = h('figure', { class: 'cv-pv-panel' }, h('figcaption', { class: 'cv-pv-cap' }, h('span', { text: title }), meta), body);
  return { title, fig, meta, body, urls: [] };
}

/** Fills one panel from model data. Object URLs from the previous fill are released first. */
function fill(pn, p) {
  for (const u of pn.urls) URL.revokeObjectURL(u);
  pn.urls = [];
  if (pn.cleanup) { pn.cleanup(); pn.cleanup = null; }   // a 3D view from the last fill
  pn.meta.textContent = [p.label, p.size != null ? fmtSize(p.size) : ''].filter(Boolean).join(' · ');
  if (p.kind === 'image') {
    const url = URL.createObjectURL(p.blob);
    pn.urls.push(url);
    const img = h('img', { src: url, alt: `${pn.title}: ${p.label || 'picture'}` });
    img.addEventListener('load', () => { pn.meta.textContent += ` · ${img.naturalWidth} × ${img.naturalHeight} px`; });
    img.addEventListener('error', () => pn.body.replaceChildren(h('p', { class: 'cv-hint', text: 'This browser cannot show this picture. Download it to open it.' })));
    pn.body.replaceChildren(img);
  } else if (p.kind === 'text') {
    const lines = p.lines.map((line, i) => h('span', { class: 'cv-pv-line' + (p.changed && p.changed.has(i) ? ' cv-pv-chg' : ''), text: line || ' ' }));
    pn.body.replaceChildren(h('pre', { class: 'cv-pv-text' }, lines), p.note ? h('p', { class: 'cv-hint', text: p.note }) : null);
  } else if (p.kind === 'model') {
    pn.cleanup = fillModel(pn, p);
  } else if (p.kind === 'error') {
    pn.body.replaceChildren(h('p', { class: 'cv-pv-error', role: 'alert', text: p.message }), p.hint ? h('p', { class: 'cv-hint', text: p.hint }) : null);
  } else {
    pn.body.replaceChildren(h('p', { class: 'cv-hint', text: p.text || 'Nothing to show.' }));
  }
}

/**
 * createView(block, { input }) → refs. input: true adds the text box (for conversions that take typed text).
 * refs.render(model), refs.empty(message), refs.setStatus(text), refs.ta, refs.taHint, refs.copy, refs.swap, refs.download.
 */
export function createView(block, { input = false, placeholder = 'Type or paste text here' } = {}) {
  const status = h('p', { class: 'cv-pv-status', role: 'status' });
  const ta = input ? h('textarea', { id: 'cv-pv-text', rows: 6, spellcheck: false, placeholder, 'aria-describedby': 'cv-pv-text-hint' }) : null;
  const taHint = input ? h('p', { class: 'cv-hint', id: 'cv-pv-text-hint', text: 'Type or paste text. The output below updates as you type. Nothing is uploaded.' }) : null;
  const before = panel('Before'), after = panel('After');
  const note = h('p', { class: 'cv-pv-note', 'aria-live': 'polite' });
  const copy = h('button', { type: 'button', class: 'cv-btn cv-small' }, 'Copy output');
  const swap = h('button', { type: 'button', class: 'cv-btn cv-small', hidden: true }, 'Swap');
  const download = h('button', { type: 'button', class: 'cv-btn cv-small cv-primary' }, 'Download');
  block.replaceChildren(h('div', { class: 'cv-pv' },
    h('div', { class: 'cv-pv-head' }, h('h2', { text: 'Live preview' }), status),
    input ? h('div', { class: 'cv-pv-input' }, h('label', { for: 'cv-pv-text', text: 'Input text' }), ta, taHint) : null,
    h('div', { class: 'cv-pv-grid' }, before.fig, after.fig),
    note,
    h('div', { class: 'cv-pv-actions' }, copy, swap, download)));
  const setStatus = (text) => { status.textContent = text; };
  const setNote = (text) => { note.textContent = text; };
  const render = (model) => {
    fill(before, model.before);
    fill(after, model.after);
    setNote(model.note || '');
  };
  const empty = (message) => {
    fill(before, { kind: 'info', text: message });
    fill(after, { kind: 'info', text: '' });
    setNote('');
  };
  return { ta, taHint, copy, swap, download, status, setStatus, setNote, render, empty, panels: { before, after } };
}
