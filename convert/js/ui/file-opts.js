/* Per-file options: every file card has an "Options" disclosure with the options of its own target (the catalog entry's
 * `options` are the one definition, drawn by options.js), and its values are the file's own: item.opts[conversion id], so
 * switching a file to another format and back keeps what was typed. The bulk bar's disclosure sets the same values on every
 * selected file that has that target. A 'combine' conversion (Images to PDF, Merge PDFs) makes one file from all of its
 * files, so a change on one of its cards is copied to the others.
 *   valuesOf(item, conv, defaults)        the values a file converts with: the option defaults, the page's, the file's own
 *   setValues(items, conv, values)        stores values on these files (for that conversion)
 *   optionsBox({ conv, values, prefix, label, open, onToggle, onChange(values, final), cls })   a <details> with the
 *     controls, or null when the conversion has no options; control ids are cv-o-<prefix><key>; final on a change event */
import { h } from './dom.js';
import { renderOptions, readOptions } from './options.js';

export function valuesOf(item, conv, defaults = {}) {
  if (!conv) return {};
  const out = {};
  for (const o of conv.options) out[o.key] = o.value;
  return { ...out, ...defaults, ...((item && item.opts && item.opts[conv.id]) || {}) };
}

export function setValues(items, conv, values) {
  for (const it of items) { it.opts = it.opts || {}; it.opts[conv.id] = { ...values }; }
}

/** A short summary of the values that differ from the defaults ("Quality 70, Width 800"), for the closed disclosure. */
function changed(conv, values) {
  const parts = [];
  for (const o of conv.options) {
    const v = values[o.key];
    if (v === undefined || v === '' || String(v) === String(o.value ?? '')) continue;
    const shown = o.type === 'checkbox' ? (v ? 'on' : 'off') : o.type === 'select' ? ((o.options.find(([x]) => String(x) === String(v)) || [])[1] || v) : v;
    parts.push(`${o.label.replace(/\s*\(.*?\)$/, '')} ${shown}`);
  }
  return parts.join(', ');
}

export function optionsBox({ conv, values, prefix, label = 'Options', open = false, onToggle, onChange, cls = '' }) {
  if (!conv || !conv.options.length) return null;
  const body = h('div', { class: 'cv-opts-body' });
  renderOptions(body, conv.options, values, prefix);
  const sum = h('span', { class: 'cv-file-opts-sum' }, changed(conv, values));
  const box = h('details', { class: 'cv-file-opts ' + cls, open: !!open },
    h('summary', { class: 'cv-file-opts-h' }, h('span', null, label), sum), body);
  box.addEventListener('toggle', () => { if (onToggle) onToggle(box.open); });
  const read = (e) => {
    const v = readOptions(body, conv.options, prefix);
    sum.textContent = changed(conv, { ...values, ...v });
    if (onChange) onChange(v, e.type === 'change');   // final: the value is set (not a slider still moving)
  };
  body.addEventListener('input', read);
  body.addEventListener('change', read);
  return box;
}
