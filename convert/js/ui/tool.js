/* The converter controller: the file list, target picker (only conversions valid for the files),
 * options, batch run, and results with one download per file or a zip of all of them. */
import { conversionsFor } from '../core/catalog.js';
import { KIND_LABEL, TEXT_KINDS, detectKind } from '../core/detect.js';
import { writeZip } from '../io/zip.js';
import { readHead, fmtSize, uniqueName, saveBlob } from '../io/files.js';
import { h } from './dom.js';
import { buildTool } from './markup.js';
import { renderOptions, readOptions } from './options.js';
import { convertAll } from './run.js';

let seq = 0;

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
    ui.drop.addEventListener('click', () => ui.input.click());
    ui.drop.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); ui.input.click(); }
    });
    for (const t of ['dragenter', 'dragover']) ui.drop.addEventListener(t, (e) => { e.preventDefault(); ui.drop.classList.add('cv-over'); });
    for (const t of ['dragleave', 'dragend']) ui.drop.addEventListener(t, () => ui.drop.classList.remove('cv-over'));
    ui.drop.addEventListener('drop', (e) => { e.preventDefault(); ui.drop.classList.remove('cv-over'); this.addFiles(e.dataTransfer.files); });
    ui.input.addEventListener('change', () => { this.addFiles(ui.input.files); ui.input.value = ''; });
    ui.target.addEventListener('change', () => this.showOptions());
    ui.opts.addEventListener('input', () => this.emit());
    ui.opts.addEventListener('change', () => this.emit());
    ui.form.addEventListener('submit', (e) => { e.preventDefault(); this.run(); });
    ui.clear.addEventListener('click', () => this.clear());
    ui.zip.addEventListener('click', () => this.zipAll());
    ui.list.addEventListener('click', (e) => {
      const b = e.target.closest('button[data-remove]');
      if (b) this.remove(Number(b.dataset.remove));
    });
    this.render();
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
    this.items = [];
    this.clearOutputs();
    this.setStatus('');
    this.render();
  }

  skipReason(item) {
    const p = this.preset;
    if (p && p.from && !p.from.includes(item.kind)) {
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
    if (cands.some((c) => c.id === prev)) ui.target.value = prev;
    ui.target.disabled = !cands.length;
    ui.run.disabled = this.busy || !cands.length;
    this.noteFor(cands);
    this.showOptions();
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
    if (act.some((i) => i.kind === 'png') && cands.some((c) => c.id === 'images-to-pdf')) notes.push('PNG transparency is flattened onto white in the PDF.');
    if (act.length > 1 && cands.length) notes.push(`${act.length} files will be converted.`);
    this.ui.note.textContent = notes.join(' ');
  }

  showOptions() {
    const conv = this.current();
    const defaults = this.preset && this.preset.defaults ? this.preset.defaults : {};
    renderOptions(this.ui.opts, conv ? conv.options : [], defaults);
    this.emit();
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
    this.busy = true;
    this.clearOutputs();
    for (const it of this.items) it.error = '';
    this.ui.run.disabled = true;
    const opts = readOptions(this.ui.opts, conv.options);
    this.setStatus(`Converting ${act.length} file${act.length === 1 ? '' : 's'}…`);
    const res = await convertAll(conv, act, opts, (i, n) => this.setStatus(n > 1 ? `Converting file ${i + 1} of ${n}…` : 'Converting…'));
    for (const e of res.errors) for (const it of this.items) if (e.ids.includes(it.id)) it.error = e.message;
    const taken = new Set();
    this.outputs = res.outputs.map((o) => ({ name: uniqueName(o.name, taken), blob: o.blob, url: URL.createObjectURL(o.blob) }));
    this.busy = false;
    this.setStatus(this.summary(res));
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

