/* Builds the converter's markup inside a container and returns the elements the controller needs.
 * Used by the hub and by every converter page, so they all behave the same. */
import { h } from './dom.js';
import '../../../shared/ui/flow.js';   // window.SlopFlow: the "PDF → DOCX" picture at the top of the tool
import '../../../shared/raw/tiff.js';
import '../../../shared/raw/detect.js';   // camera RAW extensions for the file picker (often no MIME type)

export function buildTool(root, preset) {
  const id = (s) => `cv-${s}`;
  // The drop zone's content (message, Choose files button, progress) is drawn by SlopDrop (shared/drop) in tool.js.
  const drop = h('div', { class: 'cv-drop', id: id('drop') });
  const input = h('input', { type: 'file', multiple: true, id: id('input'), class: 'cv-sr', tabindex: -1, 'aria-hidden': 'true', accept: preset && preset.accept ? preset.accept : 'image/*,application/pdf,.csv,.tsv,.vcf,.vcard,.xlsx,.json,.md,.markdown,.txt,.html,.htm,text/csv,application/json,text/markdown,text/plain,text/html,.se,.si,.sie,.ofx,.qfx,.qif,.sta,.mt940,.940,.xml,' + globalThis.SlopRawDetect.ACCEPT });
  const list = h('ul', { class: 'cv-files', id: id('list'), 'aria-label': 'Files to convert' });
  // Select all, and for the selected rows: "N selected · Convert to [..] · Remove" (bulk.js).
  const bulk = h('div', { class: 'cv-bulk', id: id('bulk'), role: 'group', 'aria-label': 'Selected files', hidden: true });
  // Each file has its own target (file-row.js). The picker sets the target of every file, or of the selected rows; its
  // choice is mirrored in a hidden <select> (the code and tests read it; empty when the files' targets differ).
  const target = h('select', { id: id('target'), hidden: true, 'aria-hidden': 'true', tabindex: -1 });
  const picker = h('div', { class: 'cv-picker', id: id('picker'), role: 'radiogroup', 'aria-labelledby': id('target-h'), 'aria-describedby': id('scope') });
  const scope = h('p', { class: 'cv-hint cv-pick-scope', id: id('scope'), 'aria-live': 'polite' });   // which files the picker sets
  const opts = h('div', { id: id('opts-body'), class: 'cv-opts-body' });
  const note = h('p', { class: 'cv-note', id: id('note'), 'aria-live': 'polite' });
  const run = h('button', { type: 'submit', class: 'cv-btn cv-primary', id: id('run'), disabled: true }, 'Convert');
  const clear = h('button', { type: 'button', class: 'cv-btn', id: id('clear') }, 'Clear');
  const form = h('form', { class: 'cv-form', id: id('form'), 'aria-label': 'Conversion settings' },
    h('div', { class: 'cv-opt' }, h('p', { class: 'cv-opt-h', id: id('target-h') }, 'Convert to'), scope, picker, target),
    h('fieldset', { class: 'cv-opts' }, h('legend', null, 'Options'), opts),
    note,
    h('div', { class: 'cv-actions' }, run, clear));
  const status = h('p', { class: 'cv-status', id: id('status'), role: 'status' });
  const zip = h('button', { type: 'button', class: 'cv-btn', id: id('zip'), hidden: true }, 'Download all as zip');
  const outList = h('ul', { class: 'cv-out', id: id('out'), 'aria-label': 'Converted files' });
  const results = h('section', { class: 'cv-results', 'aria-labelledby': id('res-h'), hidden: true },
    h('div', { class: 'cv-res-head' }, h('h2', { id: id('res-h') }, 'Converted'), zip), outList);
  const picked = preset ? h('p', { class: 'cv-page-note' }, preset.note || '') : null;
  const flow = window.SlopFlow.create({ size: 'lg' });
  const flowBox = h('div', { class: 'cv-flow' }, flow.el);
  // replaceChildren turns null into the text "null", so an absent note is left out.
  root.replaceChildren(
    flowBox,
    ...(picked ? [picked] : []),
    drop, input,
    h('section', { class: 'cv-section', 'aria-label': 'Files' }, bulk, list),
    form, status, results);
  return { drop, input, list, bulk, target, picker, scope, opts, note, run, clear, form, status, zip, outList, results, flow, flowBox };
}
