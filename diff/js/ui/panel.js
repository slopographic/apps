/* Slop Compare: the settings in the right panel (SlopFrame.panel; a bottom sheet on phones), drawn from the one table of
 * options (core/compare.js OPTIONS), so the panel, the commands and the Workflows step offer the same choices.
 *   build(host) → { sections(kind) }   the form controls (ids df-opt-<key>) in their sections; every change goes to setOpts
 *   sync()      the controls show S.opts again (after a command changed them)
 * Sections: Compare (as, view, whitespace, case, context lines), CSV (the key column, with the columns as suggestions),
 * Pictures and PDFs (the view, the threshold, PDF text or pages). */
import { S, setOpts } from './state.js';
import { OPTIONS } from '../core/compare.js';

const BY = Object.fromEntries(OPTIONS.map((o) => [o.key, o]));
const el = (tag, attrs = {}, text) => { const n = Object.assign(document.createElement(tag), attrs); if (text != null) n.textContent = text; return n; };

function field(key) {
  const o = BY[key], id = `df-opt-${key}`;
  if (typeof o.value === 'boolean') {
    const lab = el('label', { className: 'sf-field df-check' });
    const box = el('input', { type: 'checkbox', id });
    box.addEventListener('change', () => setOpts({ [key]: box.checked }));
    lab.append(box, el('span', {}, o.label));
    return lab;
  }
  if (o.options && o.options.length <= 3) {
    const wrap = el('div', { className: 'sf-field' });
    wrap.append(el('span', { className: 'sf-lab', id: `${id}-lab` }, o.label));
    const seg = el('div', { className: 'sf-seg', id, role: 'group' });
    seg.setAttribute('aria-labelledby', `${id}-lab`);
    for (const [v, label] of o.options) {
      const b = el('button', { type: 'button', className: 'sui-btn' }, label);
      b.dataset.value = v;
      b.addEventListener('click', () => setOpts({ [key]: v }));
      seg.append(b);
    }
    wrap.append(seg);
    return wrap;
  }
  const lab = el('label', { className: 'sf-field' });
  lab.append(el('span', { className: 'sf-lab' }, o.label));
  let input;
  if (o.options) {
    input = el('select', { id });
    for (const [v, label] of o.options) input.append(new Option(label, v));
    input.addEventListener('change', () => setOpts({ [key]: input.value }));
  } else if (typeof o.value === 'number') {
    input = el('input', { id, type: key === 'threshold' ? 'range' : 'number', min: o.min, max: o.max, step: 1 });
    input.addEventListener(key === 'threshold' ? 'input' : 'change', () => setOpts({ [key]: input.value }));
  } else {
    input = el('input', { id, type: 'text', autocomplete: 'off', spellcheck: false, placeholder: 'auto' });
    input.setAttribute('list', 'df-cols');
    input.addEventListener('change', () => setOpts({ [key]: input.value || 'auto' }));
  }
  lab.append(input);
  if (o.hint) lab.append(el('span', { className: 'sf-note' }, o.hint));
  return lab;
}

/** Has the person chosen the settings before (kept in this browser)? */
export function chosen() { try { return !!localStorage.getItem('slop-diff:opts'); } catch (e) { return false; } }

export function sync() {
  for (const o of OPTIONS) {
    const n = document.getElementById(`df-opt-${o.key}`), v = S.opts[o.key];
    if (!n) continue;
    if (n.classList.contains('sf-seg')) for (const b of n.children) b.setAttribute('aria-pressed', String(b.dataset.value === v));
    else if (n.type === 'checkbox') n.checked = !!v;
    else if (n.value !== String(v)) n.value = String(v);
  }
  const t = document.getElementById('df-opt-threshold');
  if (t) t.title = `${S.opts.threshold}%`;
  const out = document.getElementById('df-thr-val');
  if (out) out.textContent = `${S.opts.threshold}%`;
  const cols = document.getElementById('df-cols');
  if (cols) { cols.textContent = ''; for (const c of (S.result && S.result.csv ? S.result.csv.columns : [])) cols.append(new Option(c)); cols.append(new Option('none')); }
}

export function build(host) {
  const group = (keys) => { const d = el('div', { className: 'df-group' }); for (const k of keys) d.append(field(k)); return d; };
  const compare = group(['mode', 'view', 'ignoreWs', 'ignoreCase', 'context']);
  const csv = group(['key']);
  csv.append(el('datalist', { id: 'df-cols' }));
  const pics = group(['imageView', 'threshold', 'pdfView']);
  const thr = pics.querySelector('#df-opt-threshold');
  thr.after(el('output', { id: 'df-thr-val', className: 'sf-note' }));
  host.append(compare, csv, pics);
  sync();
  return {
    /** The sections to show for what is compared (kind: the result's, or null before a comparison). */
    sections(kind) {
      const all = !kind;
      return [{ title: 'Compare', key: 'compare', settings: compare }]
        .concat(all || kind === 'csv' ? [{ title: 'CSV', key: 'csv', settings: csv }] : [])
        .concat(all || kind === 'image' || kind === 'pdf' ? [{ title: 'Pictures and PDFs', key: 'pics', settings: pics }] : []);
    },
  };
}
