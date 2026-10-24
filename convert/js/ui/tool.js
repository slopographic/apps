/* The converter controller: the drop zone (always there; a fixed-height "Add more files" strip once there are files), the
 * file list, where every file has its own "Convert to" and its own Options (targets.js, file-row.js, file-opts.js), the
 * selection and its bulk bar (bulk.js), the batch run (each file with its own target and values), and results with one
 * download per file or a zip of all of them. The flow picture's target tile opens the first file's menu (the bulk bar's
 * when rows are selected). setTarget(id) sets every file, or the selected ones; `target` is the one they share. */
import { conversionById, outKind } from '../core/catalog.js';
import { KIND_LABEL, TEXT_KINDS, detectKind } from '../core/detect.js';
import { writeZip } from '../io/zip.js';
import { readHead, uniqueName, saveBlob } from '../io/files.js';
import { buildTool, firstVisit } from './markup.js';
import { valuesOf, setValues } from './file-opts.js';
import { runGroups, firstUseGate } from './run.js';
import { ownTargets, resolve, sharedTargets, applyTarget, groupsFor, commonTarget, needsRefs, readRefs, WITH } from './targets.js';
import { drawFiles, drawResults } from './list-view.js';

let seq = 0, instances = 0;
const plural = (n, one, many = one + 's') => `${n} ${n === 1 ? one : many}`;

export class ConvertTool {
  /** preset: null for the hub, or { conv, from, defaults, note, accept } for a converter page. opts: { compact (a strip of
   *  a drop zone and no first-visit preview, for a dialog), onResults(outputs) after each run }. Use mountTool (mount-tool.js). */
  constructor(root, preset = null, opts = {}) {
    this.preset = preset;
    this.opts = opts;
    this.ns = instances++ ? `cv${instances}` : 'cv';   // ids: cv-drop for the first tool on a page, cv2-drop for the next
    this.root = root;
    this.items = [];
    this.outputs = [];
    this.busy = false;
    this.defaultTarget = null;   // set by ?to= (route.js) or setTarget with no selection: the default for files added later
    this.ui = buildTool(root, preset, { ns: this.ns, compact: !!opts.compact });
    const ui = this.ui;
    // The drop zone is SlopDrop (shared/drop): drops and the Choose files button (the only thing that opens the picker)
    // read each file through addFiles. The page's own picker input keeps its accept list.
    const accept = ui.input.getAttribute('accept');
    this.dropZone = window.SlopDrop.attach(ui.drop, {
      accept: { any: true, noun: 'a file' },
      input: ui.input,
      label: 'Drop files here, or choose files',
      hint: 'Several at once is fine. Files are read on this device and never uploaded.',
      ...(opts.compact ? { compact: true, quiet: false } : firstVisit(this)),
      process: async (file) => { await this.addFiles([file]); return file.name; },
    });
    ui.input.setAttribute('accept', accept);
    // The flow picture's target tile (PDF → DOCX ▾) opens the menu of what the files can become.
    ui.flow.onTo(() => this.openMenu(), 'Choose the format to make');
    ui.form.addEventListener('submit', (e) => { e.preventDefault(); this.run(); });
    ui.clear.addEventListener('click', () => this.clear());
    ui.zip.addEventListener('click', () => this.zipAll());
    ui.list.addEventListener('click', (e) => {
      const b = e.target.closest('button[data-remove]');
      if (b) this.remove(Number(b.dataset.remove));
    });
    this.render();
  }

  get only() { return this.preset ? this.preset.conv : null; }

  /** A new file's target: the one-off wish (the sample, Swap), else the default (?to=, setTarget), when it fits. */
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
    return { conv, items: g ? g.items : [], opts: this.valuesOf(g && g.items[0], conv) };
  }

  emit() { this.root.dispatchEvent(new CustomEvent('cv:change')); }

  remove(id) { this.items = this.items.filter((i) => i.id !== id); this.render(); }

  clear() {
    this.ui.flow.state('idle');
    this.items = [];
    this.defaultTarget = this.linkTarget || null;   // a pick for every file lasts until Clear; the link's stays
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
  /** The files setTarget sets: the selected rows, else every file. */
  scope() { const s = this.selected(); return s.length ? s : this.active(); }
  candidates() { return sharedTargets(this.scope(), this.only); }
  /** The conversion every file in scope has ('' when they differ), and the ones they could all have. */
  get target() { const t = commonTarget(this.scope(), this.active(), this.only); return this.candidates().some((c) => c.id === t) ? t : ''; }
  targets() { return this.candidates().map((c) => c.id); }
  /** Sets one conversion on the selected files, or on every file (and the files added later) when none is selected. */
  setTarget(id) { this.bulkPick(id, !this.selected().length); }

  /** The flow picture's ▾: the bulk bar's menu when rows are selected, else the first file's, else Choose files. */
  openMenu() {
    const b = (this.selected().length && this.ui.bulk.querySelector('.cv-bulk-to')) || this.ui.list.querySelector('.cv-to:not([disabled])');
    if (b && b.menu) { b.focus({ preventScroll: true }); b.menu.open(); return; }
    const choose = this.ui.drop.querySelector('button');
    if (choose) choose.focus();
  }

  /** The option values a file converts with: the catalog's defaults, the page's, then the file's own. */
  valuesOf(it, conv) { return valuesOf(it, conv, this.preset && this.preset.defaults ? this.preset.defaults : {}); }
  /** A card's options changed. A 'combine' conversion makes one file of all its files, so they all take the values. */
  rowOptions(it, conv, values, final) {
    const mates = conv.mode === 'combine' ? this.active().filter((i) => this.targetOf(i) === conv.id) : [it];
    setValues(mates, conv, values);
    if (final && mates.length > 1) drawFiles(this, { bulk: false });
    this.optionsChanged();
  }
  /** The bulk bar's options changed: every selected file with that target takes them. */
  bulkOptions(items, conv, values, final) {
    setValues(items, conv, values);
    if (final) drawFiles(this, { bulk: false });
    this.optionsChanged();
  }
  optionsChanged() { this.paintFlow(); this.emit(); }
  targetOf(it) { return resolve(it, this.active(), this.only); }
  groups() { return groupsFor(this.active(), this.only); }

  /** The conversion the picture and the preview show: the one the files in scope share, else the first in use. */
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
    this.root.dispatchEvent(new CustomEvent('cv:target', { bubbles: true, detail: { id } }));   // route.js writes ?to=
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
    const ui = this.ui, cands = this.candidates();
    drawFiles(this);
    ui.drop.classList.toggle('cv-drop-has', this.items.length > 0);   // the strip: same place, fixed height
    const msg = ui.drop.querySelector('.sd-msg');
    if (msg) msg.textContent = this.items.length ? 'Add more files: drop them here, or choose files' : 'Drop files here, or choose files';
    if (this.dropZone) this.dropZone.empty(!this.items.length);   // the preview in the drop zone is for an empty page
    ui.run.disabled = this.busy || !this.groups().length;
    this.noteFor(cands);
    this.paintFlow();
    this.emit();
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

  /** The picture at the top: the kinds of the files (or, before any, what the page takes) to what the conversion makes.
   *  With several targets it shows the conversion the files in scope share, else the first. The hub's empty page has none;
   *  once there are files it keeps its place (blank while a side is unknown), so the list below does not move. */
  paintFlow() {
    const conv = this.current() || (this.preset ? conversionById(this.preset.conv) : null);
    const g = conv && this.groups().find((x) => x.conv.id === conv.id);
    const kinds = [...new Set((g ? g.items : this.active()).map((i) => i.kind))];
    const from = kinds.length ? kinds : this.preset && this.preset.from ? this.preset.from : [];
    const to = conv ? outKind(conv, this.valuesOf(g && g.items[0], conv)) : '';
    this.ui.flowBox.hidden = !this.preset && !this.items.length;
    this.ui.flowBox.classList.toggle('cv-flow-blank', !from.length || !to);
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
    const res = await runGroups(groups, (conv, it) => this.valuesOf(it, conv), (i, total) => { this.ui.flow.progress(i / total); this.setStatus(total > 1 ? `Converting ${i + 1} of ${total}…` : 'Converting…'); });
    for (const e of res.errors) for (const it of this.items) if (e.ids.includes(it.id)) it.error = e.message;
    const taken = new Set();
    this.outputs = res.outputs.map((o) => ({ name: uniqueName(o.name, taken), blob: o.blob, url: URL.createObjectURL(o.blob) }));
    this.busy = false;
    this.ui.flow.state(res.outputs.length ? 'done' : 'error');
    this.setStatus([this.summary(res), ...res.info].filter(Boolean).join(' '));
    this.render();
    this.renderResults();
    if (this.opts.onResults) this.opts.onResults(this.outputs.slice());
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
