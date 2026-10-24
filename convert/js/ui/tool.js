/* The converter controller: the file list, target picker (only conversions valid for the files),
 * options, batch run, and results with one download per file or a zip of all of them. */
import { conversionsFor, conversionById, outKind } from '../core/catalog.js';
import { KIND_LABEL, TEXT_KINDS, detectKind } from '../core/detect.js';
import { writeZip } from '../io/zip.js';
import { readHead, fmtSize, uniqueName, saveBlob } from '../io/files.js';
import { h } from './dom.js';
import { buildTool } from './markup.js';
import { renderOptions, readOptions } from './options.js';
import { convertAll } from './run.js';
import { drawPicker, focusPicker } from './target-picker.js';

let seq = 0;

/** The notice before the video engine's first download: shown once, and only when a video conversion runs (catalog
 *  entries with engine: 'ffmpeg'). Every other conversion needs no download and starts without asking. */
const FIRST_USE = {
  title: 'Download the video engine?',
  lines: ['Converting a video needs the video engine. It is downloaded once and kept by this browser for next time. Your files are still read on this device and never uploaded.'],
  downloads: [{ name: 'Video engine (ffmpeg.wasm)', bytes: 32344223 }],
};
let firstUse = null;
/** Resolves true when the work may go on. Cancelling clears the gate, so the next drop asks again. */
function firstUseGate() {
  if (!firstUse) firstUse = window.SlopFirstRun ? SlopFirstRun.once('convert', FIRST_USE) : Promise.resolve(true);
  return firstUse.then((ok) => { if (!ok) firstUse = null; return ok; });
}
export class ConvertTool {
  /** preset: null for the hub, or { conv, from, defaults, note } for a converter page. */
  constructor(root, preset = null) {
    this.preset = preset;
    this.root = root;
    this.items = [];
    this.outputs = [];
    this.busy = false;
    this.ui = buildTool(root, preset);
    const ui = this.ui;
    // The drop zone is SlopDrop (shared/drop): drops and the Choose files button (the only thing that opens the picker)
    // read each file through addFiles. The page's own picker input keeps its accept list.
    const accept = ui.input.getAttribute('accept');
    this.dropZone = window.SlopDrop.attach(ui.drop, {
      accept: { any: true, noun: 'a file' },
      input: ui.input,
      label: 'Drop files here, or choose files',
      hint: 'Several at once is fine. Files are read on this device and never uploaded.',
      ...this.firstVisit(),
      process: async (file) => { await this.addFiles([file]); return file.name; },
    });
    ui.input.setAttribute('accept', accept);
    ui.target.addEventListener('change', () => { this.drawPicker(); this.showOptions(); });
    // The flow picture's target tile (PDF → DOCX ▾) brings up the picker of the formats these files can become.
    ui.flow.onTo(() => focusPicker(ui.picker), 'Choose the format to make');
    ui.opts.addEventListener('input', () => this.emit());
    ui.opts.addEventListener('change', () => { this.paintFlow(); this.emit(); });
    ui.form.addEventListener('submit', (e) => { e.preventDefault(); this.run(); });
    ui.clear.addEventListener('click', () => this.clear());
    ui.zip.addEventListener('click', () => this.zipAll());
    ui.list.addEventListener('click', (e) => {
      const b = e.target.closest('button[data-remove]');
      if (b) this.remove(Number(b.dataset.remove));
    });
    this.render();
  }

  /** What an empty page shows in the drop zone (SlopDrop's preview): the hub shows a CSV becoming an XLSX and offers a
   *  sample price list (shared/samples/docs.js); a converter page has its pair drawn above, so it shows the steps. */
  firstVisit() {
    const p = this.preset, tag = (k) => window.SlopFlow.tag(k);
    if (p) {
      const conv = conversionById(p.conv), from = p.from ? p.from.map(tag).join(' or ') : 'your';
      return { preview: { steps: [`Drop ${from} files, one or many`, 'Check the options', `Download the ${conv ? tag(outKind(conv, p.defaults)) : 'new'} files`] } };
    }
    const S = window.SlopSamples;
    return {
      preview: { picture: { flow: { from: 'csv', to: 'xlsx' } }, steps: ['Drop pictures, PDFs, sheets, text', 'Pick what to make', 'Download one file or a zip'] },
      sample: S && S.docs ? { label: 'Try it with a sample price list (CSV)', files: () => { this.wantTarget = 'csv-to-xlsx'; return [S.docs.csv()]; } } : undefined,
    };
  }

  /** Adds files (a FileList or array). Each is detected by its first bytes, name and type. */
  async addFiles(list) {
    const files = Array.from(list || []);
    if (!files.length) return;
    this.items = this.items.filter((i) => !i.pasted);
    this.setStatus(`Reading ${files.length} file${files.length === 1 ? '' : 's'}…`);
    for (const file of files) {
      const kind = detectKind(file.name, file.type, await readHead(file));
      this.items.push({ id: ++seq, file, name: file.name, size: file.size, kind, error: '' });
    }
    this.setStatus('');
    this.render();
  }

  /** Typed or pasted text is the input as one item named pasted.<kind>. Empty text removes it. */
  setText(text) {
    this.items = this.items.filter((i) => !i.pasted);
    if (text !== '') {
      const first = this.preset && this.preset.from ? this.preset.from[0] : 'txt';
      const kind = TEXT_KINDS.includes(first) ? first : 'txt';
      const name = `pasted.${kind}`;
      const file = new File([text], name, { type: 'text/plain' });
      this.items.unshift({ id: ++seq, file, name, size: file.size, kind, error: '', pasted: true });
    }
    this.render();
  }

  /** Swap: the output text of a reversible conversion becomes the input, and the page switches to the reverse. */
  swapText(text, conv) {
    this.items = [];
    this.clearOutputs();
    if (this.preset) this.preset = { ...this.preset, conv: conv.id, from: conv.from };
    this.render();
    this.setText(text);
    this.ui.target.value = conv.id;
    this.showOptions();
  }

  /** What the preview needs: the chosen conversion, the convertible items and the option values. */
  previewState() {
    const conv = this.current();
    return { conv, items: this.active(), opts: conv ? readOptions(this.ui.opts, conv.options) : {} };
  }

  emit() { this.root.dispatchEvent(new CustomEvent('cv:change')); }

  remove(id) {
    this.items = this.items.filter((i) => i.id !== id);
    this.render();
  }

  clear() {
    this.ui.flow.state('idle');
    this.items = [];
    this.clearOutputs();
    this.setStatus('');
    this.render();
  }

  skipReason(item) {
    const p = this.preset;
    if (p && p.from && !p.from.includes(item.kind) && !(conversionById(p.conv)?.with || []).includes(item.kind)) {   // `with`: a model's .mtl, .bin, textures
      return `This page converts ${p.from.map((k) => KIND_LABEL[k]).join(' or ')}, not ${KIND_LABEL[item.kind].toLowerCase()}.`;
    }
    return '';
  }

  /** Items that can be converted (the preset's input types only). */
  active() { return this.items.filter((i) => !this.skipReason(i)); }

  candidates() {
    const act = this.active();
    if (!act.length) return [];
    const kinds = [...new Set(act.map((i) => i.kind))];
    return conversionsFor(kinds, this.preset ? this.preset.conv : null);
  }

  current() {
    const id = this.ui.target.value;
    return this.candidates().find((c) => c.id === id) || null;
  }

  render() {
    const ui = this.ui;
    ui.list.replaceChildren(...(this.items.length ? this.items.map((it) => this.itemRow(it)) : [h('li', { class: 'cv-empty' }, 'No files yet.')]));
    const cands = this.candidates();
    const prev = ui.target.value;
    ui.target.replaceChildren(...(cands.length ? cands.map((c) => h('option', { value: c.id }, c.label))
      : [h('option', { value: '' }, this.active().length ? 'No conversion for these files' : 'Add files first')]));
    if (cands.some((c) => c.id === this.wantTarget)) { ui.target.value = this.wantTarget; this.wantTarget = null; } else if (cands.some((c) => c.id === prev)) ui.target.value = prev;
    // The preview in the drop zone is for an empty page.
    if (this.dropZone) this.dropZone.empty(!this.items.length);
    ui.target.disabled = !cands.length;
    this.drawPicker(cands);
    ui.run.disabled = this.busy || !cands.length;
    this.noteFor(cands);
    this.showOptions();
  }

  /** The tiles of the formats these files can become, the chosen one marked (target-picker.js). */
  drawPicker(cands = this.candidates()) {
    const empty = this.active().length ? 'No conversion for these files' : 'Add files to see what they can become';
    drawPicker(this.ui.picker, cands, this.ui.target.value, (id) => { this.ui.target.value = id; this.ui.target.dispatchEvent(new Event('change')); }, empty);
  }

  itemRow(it) {
    const reason = this.skipReason(it);
    const label = KIND_LABEL[it.kind] || 'File';
    const meta = `${label} · ${fmtSize(it.size)}`;
    return h('li', { class: 'cv-file' + (reason ? ' cv-skip' : '') },
      h('div', { class: 'cv-file-main' },
        h('span', { class: 'cv-file-name', text: it.name }),
        h('span', { class: 'cv-file-meta', text: meta })),
      reason ? h('p', { class: 'cv-file-msg' }, reason) : null,
      it.error ? h('p', { class: 'cv-file-msg cv-error', role: 'alert' }, it.error) : null,
      h('button', { type: 'button', class: 'cv-btn cv-small', 'data-remove': it.id, 'aria-label': `Remove ${it.name}` }, 'Remove'));
  }

  noteFor(cands) {
    const act = this.active();
    const notes = [];
    if (this.items.length && !act.length) notes.push('None of these files can be converted on this page.');
    else if (act.length && !cands.length) notes.push('These files have no conversion in common. Convert one type at a time.');
    // A kind with no converter on this site says so by name, rather than leaving an empty target list.
    const bare = [...new Set(act.map((i) => i.kind))].filter((k) => !conversionsFor([k]).length);
    for (const k of bare) notes.push(`${KIND_LABEL[k] || k} files have no conversion here yet.`);
    if (act.some((i) => i.kind === 'png') && cands.some((c) => c.id === 'images-to-pdf')) notes.push('PNG transparency is flattened onto white in the PDF.');
    if (act.length > 1 && cands.length) notes.push(`${act.length} files will be converted.`);
    this.ui.note.textContent = notes.join(' ');
  }

  showOptions() {
    const conv = this.current();
    const defaults = this.preset && this.preset.defaults ? this.preset.defaults : {};
    renderOptions(this.ui.opts, conv ? conv.options : [], defaults);
    this.paintFlow();
    this.emit();
  }

  /** The picture at the top: the kinds of the files (or, before any, what the page takes) to what the conversion makes.
   *  The hub shows it only once it knows both sides. */
  paintFlow() {
    const conv = this.current() || (this.preset ? conversionById(this.preset.conv) : null);
    const kinds = [...new Set(this.active().map((i) => i.kind))];
    const from = kinds.length ? kinds : this.preset && this.preset.from ? this.preset.from : [];
    const to = conv ? outKind(conv, readOptions(this.ui.opts, conv.options)) : '';
    this.ui.flowBox.hidden = !from.length || !to;
    if (!this.busy) this.ui.flow.set({ from, to });
  }

  setStatus(text) { this.ui.status.textContent = text; }

  clearOutputs() {
    for (const o of this.outputs) URL.revokeObjectURL(o.url);
    this.outputs = [];
    this.ui.outList.replaceChildren();
    this.ui.results.hidden = true;
  }

  async run() {
    const conv = this.current();
    const act = this.active();
    if (!conv || !act.length || this.busy) return;
    if (conv.engine === 'ffmpeg' && !(await firstUseGate())) return;   // the video engine's first download asks first
    this.busy = true;
    this.clearOutputs();
    for (const it of this.items) it.error = '';
    this.ui.run.disabled = true;
    const opts = readOptions(this.ui.opts, conv.options);
    this.setStatus(`Converting ${act.length} file${act.length === 1 ? '' : 's'}…`);
    this.ui.flow.state('run').progress(0);
    const res = await convertAll(conv, act, opts, (i, n) => { this.ui.flow.progress(i / n); this.setStatus(n > 1 ? `Converting file ${i + 1} of ${n}…` : 'Converting…'); });
    for (const e of res.errors) for (const it of this.items) if (e.ids.includes(it.id)) it.error = e.message;
    const taken = new Set();
    this.outputs = res.outputs.map((o) => ({ name: uniqueName(o.name, taken), blob: o.blob, url: URL.createObjectURL(o.blob) }));
    this.busy = false;
    this.ui.flow.state(res.outputs.length ? 'done' : 'error');
    this.setStatus([this.summary(res), ...res.info].filter(Boolean).join(' '));
    this.render();
    this.renderResults();
  }

  summary(res) {
    const ok = res.outputs.length, bad = res.errors.reduce((n, e) => n + e.ids.length, 0);
    const parts = [];
    if (ok) parts.push(`${ok} file${ok === 1 ? '' : 's'} ready`);
    if (bad) parts.push(`${bad} could not be converted`);
    return parts.join('. ') + (parts.length ? '.' : '');
  }

  renderResults() {
    const ui = this.ui;
    ui.results.hidden = !this.outputs.length;
    ui.zip.hidden = this.outputs.length < 2;
    ui.outList.replaceChildren(...this.outputs.map((o) => h('li', { class: 'cv-out-item' },
      h('span', { class: 'cv-file-name', text: o.name }),
      h('span', { class: 'cv-file-meta', text: fmtSize(o.blob.size) }),
      h('a', { class: 'cv-btn cv-small cv-primary', href: o.url, download: o.name }, 'Download'))));
  }

  async zipAll() {
    if (!this.outputs.length) return;
    this.setStatus('Packing the zip…');
    const z = await writeZip(this.outputs.map((o) => ({ path: o.name, data: o.blob })));
    saveBlob(z, 'slop-convert.zip');
    this.setStatus('Zip ready.');
  }
}

