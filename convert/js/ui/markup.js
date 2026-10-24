/* Builds the converter's markup inside a container and returns the elements the controller needs.
 * Used by the hub and by every converter page, so they all behave the same. */
import { h } from './dom.js';
import { conversionById, outKind } from '../core/catalog.js';
import { isRoute, stepsOf } from '../core/chain.js';
import '../../../shared/ui/flow.js';   // window.SlopFlow: the "PDF → DOCX" picture at the top of the tool
import '../../../shared/raw/tiff.js';
import '../../../shared/raw/detect.js';   // camera RAW extensions for the file picker (often no MIME type)

/** ns: the id prefix of this tool ('cv' for the first on a page, 'cv2' and on for more), so two tools can share a page. */
export function buildTool(root, preset, { ns = 'cv', compact = false } = {}) {
  const id = (s) => `${ns}-${s}`;
  // The drop zone's content (message, Choose files button, progress) is drawn by SlopDrop (shared/drop) in tool.js.
  const drop = h('div', { class: 'cv-drop', id: id('drop') });
  const input = h('input', { type: 'file', multiple: true, id: id('input'), class: 'cv-sr', tabindex: -1, 'aria-hidden': 'true', accept: preset && preset.accept ? preset.accept : 'image/*,video/*,audio/*,application/pdf,.heic,.heif,.csv,.tsv,.vcf,.vcard,.xlsx,.ods,.json,.yaml,.yml,.toml,.srt,.vtt,.md,.markdown,.txt,.html,.htm,text/csv,application/json,text/markdown,text/plain,text/html,.se,.si,.sie,.ofx,.qfx,.qif,.sta,.mt940,.940,.xml,.eml,.ics,.zip,.opus,.flac,.m4a,' + globalThis.SlopRawDetect.ACCEPT }); // intake-ok: the drop zone's own Choose files input (SlopDrop.attach input, through the intake)
  const list = h('ul', { class: 'cv-files', id: id('list'), 'aria-label': 'Files to convert' });
  // Select all, and for the selected rows: "N selected · Convert to [..] · Remove" (bulk.js).
  const bulk = h('div', { class: 'cv-bulk', id: id('bulk'), role: 'group', 'aria-label': 'Selected files', hidden: true });
  // Each file has its own target and its own options (file-row.js, file-opts.js); the bulk bar sets several at once.
  const note = h('p', { class: 'cv-note', id: id('note'), 'aria-live': 'polite' });
  const run = h('button', { type: 'submit', class: 'cv-btn cv-primary', id: id('run'), disabled: true }, 'Convert');
  const clear = h('button', { type: 'button', class: 'cv-btn', id: id('clear') }, 'Clear');
  const form = h('form', { class: 'cv-form', id: id('form'), 'aria-label': 'Conversion settings' },
    note,
    h('div', { class: 'cv-actions' }, run, clear));
  const status = h('p', { class: 'cv-status', id: id('status'), role: 'status' });
  const zip = h('button', { type: 'button', class: 'cv-btn', id: id('zip'), hidden: true }, 'Download all as zip');
  const outList = h('ul', { class: 'cv-out', id: id('out'), 'aria-label': 'Converted files' });
  const results = h('section', { class: 'cv-results', 'aria-labelledby': id('res-h'), hidden: true },
    h('div', { class: 'cv-res-head' }, h('h2', { id: id('res-h') }, 'Converted'), zip), outList);
  const picked = preset ? h('p', { class: 'cv-page-note' }, preset.note || '') : null;
  const flow = window.SlopFlow.create({ size: compact ? 'md' : 'lg' });
  const flowBox = h('div', { class: 'cv-flow' }, flow.el);
  // replaceChildren turns null into the text "null", so an absent note is left out.
  root.replaceChildren(
    flowBox,
    ...(picked ? [picked] : []),
    drop, input,
    h('section', { class: 'cv-section', 'aria-label': 'Files' }, bulk, list),
    form, status, results);
  return { drop, input, list, bulk, note, run, clear, form, status, zip, outList, results, flow, flowBox };
}

/** What an empty page shows in the drop zone (SlopDrop's preview): the hub shows a CSV becoming an XLSX and offers a
 *  sample price list (shared/samples/docs.js); a converter page has its pair drawn above, so it shows the steps. */
export function firstVisit(tool) {
  const p = tool.preset, tag = (k) => window.SlopFlow.tag(k);
  if (p) {
    const conv = conversionById(p.conv) || (isRoute(p.conv) ? stepsOf(p.conv).pop().conv : null), from = p.from ? p.from.map(tag).join(' or ') : 'your';
    return { preview: { steps: [`Drop ${from} files, one or many`, 'Check the options', `Download the ${conv ? tag(outKind(conv, p.defaults)) : 'new'} files`] } };
  }
  const S = window.SlopSamples;
  return {
    preview: { picture: { flow: { from: 'csv', to: 'xlsx' } }, steps: ['Drop pictures, PDFs, sheets, text', 'Pick what to make', 'Download one file or a zip'] },
    sample: S && S.docs ? { label: 'Try it with a sample price list (CSV)', files: () => { tool.wantTarget = 'csv-to-xlsx'; return [S.docs.csv()]; } } : undefined,
  };
}
