/* Builds the converter's markup inside a container and returns the elements the controller needs.
 * Used by the hub and by every converter page, so they all behave the same. */
import { h } from './dom.js';

export function buildTool(root, preset) {
  const id = (s) => `cv-${s}`;
  // The drop zone's content (message, Choose files button, progress) is drawn by SlopDrop (shared/drop) in tool.js.
  const drop = h('div', { class: 'cv-drop', id: id('drop') });
  const input = h('input', { type: 'file', multiple: true, id: id('input'), class: 'cv-sr', tabindex: -1, 'aria-hidden': 'true', accept: preset && preset.accept ? preset.accept : 'image/*,application/pdf,.csv,.tsv,.json,.md,.markdown,.txt,.html,.htm,text/csv,application/json,text/markdown,text/plain,text/html' });
  const list = h('ul', { class: 'cv-files', id: id('list'), 'aria-label': 'Files to convert' });
  const target = h('select', { id: id('target') });
  const opts = h('div', { id: id('opts-body'), class: 'cv-opts-body' });
  const note = h('p', { class: 'cv-note', id: id('note'), 'aria-live': 'polite' });
  const run = h('button', { type: 'submit', class: 'cv-btn cv-primary', id: id('run'), disabled: true }, 'Convert');
  const clear = h('button', { type: 'button', class: 'cv-btn', id: id('clear') }, 'Clear');
  const form = h('form', { class: 'cv-form', id: id('form'), 'aria-label': 'Conversion settings' },
    h('div', { class: 'cv-opt' }, h('label', { for: id('target') }, 'Convert to'), target),
    h('fieldset', { class: 'cv-opts' }, h('legend', null, 'Options'), opts),
    note,
    h('div', { class: 'cv-actions' }, run, clear));
  const status = h('p', { class: 'cv-status', id: id('status'), role: 'status' });
  const zip = h('button', { type: 'button', class: 'cv-btn', id: id('zip'), hidden: true }, 'Download all as zip');
  const outList = h('ul', { class: 'cv-out', id: id('out'), 'aria-label': 'Converted files' });
  const results = h('section', { class: 'cv-results', 'aria-labelledby': id('res-h'), hidden: true },
    h('div', { class: 'cv-res-head' }, h('h2', { id: id('res-h') }, 'Converted'), zip), outList);
  const picked = preset ? h('p', { class: 'cv-page-note' }, preset.note || '') : null;
  root.replaceChildren(
    picked,
    drop, input,
    h('section', { class: 'cv-section', 'aria-label': 'Files' }, list),
    form, status, results);
  return { drop, input, list, target, opts, note, run, clear, form, status, zip, outList, results };
}
