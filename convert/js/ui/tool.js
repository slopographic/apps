/* The converter controller: the file list, where every file has its own "Convert to" (targets.js, file-row.js), the
 * selection and its bulk bar (bulk.js), the big picker that sets every file or the selected ones (target-picker.js),
 * options per conversion in use (option-sets.js), the batch run (each file with its own target), and results with one
 * download per file or a zip of all of them. */
import { conversionById, outKind } from '../core/catalog.js';
import { KIND_LABEL, TEXT_KINDS, detectKind } from '../core/detect.js';
import { writeZip } from '../io/zip.js';
import { readHead, uniqueName, saveBlob } from '../io/files.js';
import { h } from './dom.js';
import { buildTool } from './markup.js';
import { OptionSets } from './option-sets.js';
import { runGroups, firstUseGate } from './run.js';
import { drawPicker, focusPicker } from './target-picker.js';
import { ownTargets, resolve, sharedTargets, applyTarget, groupsFor, commonTarget, needsRefs, readRefs, WITH } from './targets.js';
import { drawFiles, drawResults } from './list-view.js';

let seq = 0;
const plural = (n, one, many = one + 's') => `${n} ${n === 1 ? one : many}`;

export class ConvertTool {
  /** preset: null for the hub, or { conv, from, defaults, note } for a converter page. */
  constructor(root, preset = null) {
    this.preset = preset;
    this.root = root;
    this.items = [];
    this.outputs = [];
    this.busy = false;
    this.defaultTarget = null;   // set by ?to= (route.js) or a pick on the big picker: the default for files added later
    this.ui = buildTool(root, preset);
    const ui = this.ui;
    this.optSets = new OptionSets(ui.opts);
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
    ui.target.addEventListener('change', () => { if (ui.target.value) this.bulkPick(ui.target.value, !this.selected().length); });
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

  get only() { return this.preset ? this.preset.conv : null; }

  /** A new file's target: the one-off wish (the sample, Swap), else the default (?to=, the picker), when it fits. */
  firstTarget(kind) {
    const want = this.wantTarget || this.defaultTarget;
    return want && ownTargets(kind, this.only).some((c) => c.id === want) ? want : null;
  }

  /** Adds files (a FileList or array). Each is detected by its first bytes, name and type. */
  async addFiles(list) {
    const files = Array.from(list || []);
    if (!files.length) return;
    this.items = this.items.filter((i) => !i.pasted);
    this.setStatus(`Reading ${plural(files.length, 'file')}…`);
    for (const file of files) {
      const kind = detectKind(file.name, file.type, await readHead(file));
      this.items.push({ id: ++seq, file, name: file.name, size: file.size, kind, error: '', target: this.firstTarget(kind), selected: false, refs: needsRefs(kind) ? await readRefs(file) : '' });
    }
    this.wantTarget = null;
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
      this.items.unshift({ id: ++seq, file, name, size: file.size, kind, error: '', pasted: true, target: this.firstTarget(kind), selected: false });
    }
    this.render();
  }

  /** Swap: the output text of a reversible conversion becomes the input, and the page switches to the reverse. */
  swapText(text, conv) {
    this.items = [];
    this.clearOutputs();
    if (this.preset) this.preset = { ...this.preset, conv: conv.id, from: conv.from };
    this.wantTarget = conv.id;
    this.setText(text);
    this.wantTarget = null;
  }

  /** Sets the default target (?to=): files that can take it start on it, the ones already here that have no choice too. */
  setDefaultTarget(id) {
    this.defaultTarget = this.linkTarget = id || null;
    for (const it of this.items) if (!it.target && this.firstTarget(it.kind)) it.target = id;
    this.render();
  }

  /** What the preview needs: the conversion shown, its files and its option values. */
  previewState() {
    const conv = this.current();
    const g = conv && this.groups().find((x) => x.conv.id === conv.id);
    return { conv, items: g ? g.items : [], opts: this.optSets.read(conv) };
  }

  emit() { this.root.dispatchEvent(new CustomEvent('cv:change')); }

  remove(id) { this.items = this.items.filter((i) => i.id !== id); this.render(); }

  clear() {
    this.ui.flow.state('idle');
    this.items = [];
    this.defaultTarget = this.linkTarget || null;   // a pick on the picker lasts until Clear; the link's stays
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
  selected() { return this.active().filter((i) => i.selected); }
  /** The files the big picker sets: the selected rows, else every file. */
  scope() { const s = this.selected(); return s.length ? s : this.active(); }
  candidates() { return sharedTargets(this.scope(), this.only); }
  targetOf(it) { return resolve(it, this.active(), this.only); }
  groups() { return groupsFor(this.active(), this.only); }

  /** The conversion the picture, the preview and the picker show: the one the files in scope share, else the first in use. */
  current() {
    const id = commonTarget(this.scope(), this.active(), this.only);
    const g = this.groups();
    return (id && g.find((x) => x.conv.id === id)?.conv) || (g[0] && g[0].conv) || null;
  }

  /** Sets one conversion on every file in scope that can take it. asDefault: files added later start on it too. */
  bulkPick(id, asDefault = false) {
    const act = this.active();
    for (const it of this.scope()) applyTarget(it, act, id, this.only);
    if (asDefault) this.defaultTarget = id;
    this.render();
  }

  rowPick(it, id) { it.target = id; this.render(); }

  /** A row's checkbox: shift-click sets the whole range from the last row clicked. */
  select(it, on, range) {
    const act = this.active(), a = act.findIndex((i) => i.id === this.lastPick), b = act.indexOf(it);
    if (range && a >= 0 && b >= 0) for (let k = Math.min(a, b); k <= Math.max(a, b); k++) act[k].selected = on;
    else it.selected = on;
    this.lastPick = it.id;
    this.render();
  }

  render() {
    const ui = this.ui, act = this.active(), only = this.only;
    drawFiles(this);
    const cands = this.candidates(), common = commonTarget(this.scope(), act, only);
    ui.target.replaceChildren(...(cands.length ? [...(common ? [] : [h('option', { value: '' }, 'Different formats')]), ...cands.map((c) => h('option', { value: c.id }, c.label))]
      : [h('option', { value: '' }, act.length ? 'No conversion for these files' : 'Add files first')]));
    ui.target.value = cands.some((c) => c.id === common) ? common : '';
    if (this.dropZone) this.dropZone.empty(!this.items.length);   // the preview in the drop zone is for an empty page
    ui.target.disabled = !cands.length;
    this.drawPicker(cands);
    ui.run.disabled = this.busy || !this.groups().length;
    this.noteFor(cands);
    this.showOptions();
  }

  /** The tiles of the formats the files in scope can become, the one they share marked (target-picker.js). */
  drawPicker(cands = this.candidates()) {
    const act = this.active(), n = this.selected().length;
    const empty = !act.length ? 'Add files to see what they can become'
      : n ? `No format fits ${n === 1 ? 'the selected file' : `all ${n} selected files`}. Select files of one kind, or set each row.` : 'No format fits all these files. Set each row, or select rows of one kind.';
    drawPicker(this.ui.picker, cands, this.ui.target.value, (id) => { this.ui.target.value = id; this.ui.target.dispatchEvent(new Event('change', { bubbles: true })); }, empty);
    this.ui.scope.textContent = !act.length || !cands.length ? '' : n ? `Sets the ${plural(n, 'selected file')}.` : act.length > 1 ? `Sets all ${act.length} files. Each file can also have its own, in its row.` : '';
  }

  noteFor(cands) {
    const act = this.active(), groups = this.groups();
    const notes = [];
    if (this.items.length && !act.length) notes.push('None of these files can be converted on this page.');
    else if (act.length && !this.selected().length && !cands.some((c) => !c.from.includes('*')) && new Set(act.map((i) => i.kind)).size > 1) {
      notes.push('These files are of different kinds, so each row has its own Convert to. Select rows to set several at once.');
    }
    // A kind with no converter on this site says so by name, rather than leaving an empty target list.
    const bare = [...new Set(act.filter((i) => !ownTargets(i.kind).length && this.targetOf(i) !== WITH).map((i) => i.kind))];
    for (const k of bare) notes.push(`${KIND_LABEL[k] || k} files have no conversion here yet.`);
    if (act.some((i) => i.kind === 'png' && this.targetOf(i) === 'images-to-pdf')) notes.push('PNG transparency is flattened onto white in the PDF.');
    const n = groups.reduce((s, g) => s + g.items.length, 0);
    if (n > 1) notes.push(`${n} files will be converted${groups.length > 1 ? `, to ${groups.length} formats` : ''}.`);
    this.ui.note.textContent = notes.join(' ');
  }

  showOptions() {
    this.optSets.draw(this.groups().map((g) => g.conv), this.preset && this.preset.defaults ? this.preset.defaults : {});
    this.paintFlow();
    this.emit();
  }

  /** The picture at the top: the kinds of the files (or, before any, what the page takes) to what the conversion makes.
   *  With several targets it shows the conversion the picker shows. The hub shows it only once it knows both sides. */
  paintFlow() {
    const conv = this.current() || (this.preset ? conversionById(this.preset.conv) : null);
    const g = conv && this.groups().find((x) => x.conv.id === conv.id);
    const kinds = [...new Set((g ? g.items : this.active()).map((i) => i.kind))];
    const from = kinds.length ? kinds : this.preset && this.preset.from ? this.preset.from : [];
    const to = conv ? outKind(conv, this.optSets.read(conv)) : '';
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

  /** Converts every file with its own target: one run per conversion in use. */
  async run() {
    const groups = this.groups();
    if (!groups.length || this.busy) return;
    if (groups.some((g) => g.conv.engine === 'ffmpeg') && !(await firstUseGate())) return;   // the video engine's first download asks first
    this.busy = true;
    this.clearOutputs();
    for (const it of this.items) it.error = '';
    this.ui.run.disabled = true;
    const n = groups.reduce((s, g) => s + g.items.length, 0);
    this.setStatus(`Converting ${plural(n, 'file')}…`);
    this.ui.flow.state('run').progress(0);
    const res = await runGroups(groups, (conv) => this.optSets.read(conv), (i, total) => { this.ui.flow.progress(i / total); this.setStatus(total > 1 ? `Converting ${i + 1} of ${total}…` : 'Converting…'); });
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
    if (ok) parts.push(`${plural(ok, 'file')} ready`);
    if (bad) parts.push(`${bad} could not be converted`);
    return parts.join('. ') + (parts.length ? '.' : '');
  }

  renderResults() { drawResults(this.ui, this.outputs); }

  async zipAll() {
    if (!this.outputs.length) return;
    this.setStatus('Packing the zip…');
    const z = await writeZip(this.outputs.map((o) => ({ path: o.name, data: o.blob })));
    saveBlob(z, 'slop-convert.zip');
    this.setStatus('Zip ready.');
  }
}
