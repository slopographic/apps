/* File convert dialog: converts files on this device with the converters in convert/js, from any Slop app.
 *   const ctl = SlopConvert.open({ file, files, drive, target, onPdf })
 *                                // file / files: File or Blob with a name; drive: the document is linked to a Slop Drive file,
 *                                // so results can be saved there too; target: the target id to preselect; onPdf(outputs, names):
 *                                // the PDF made from the files is handed to the app, which then gets the dialog closed
 *   ctl.close(); ctl.results() -> [{ name, blob }]; ctl.targets() -> target ids; ctl.done -> resolves when the dialog closes.
 * The targets (targets.js) list only what every open file can become. Each converter's own options are shown; the work is
 * convertAll() from convert/js/ui/run.js. Nothing is uploaded. Self-contained: no SlopUI, its own styles (dialog.css). */
import { readHead, fmtSize, saveBlob } from '../../convert/js/io/files.js';
import { detectKind, KIND_LABEL } from '../../convert/js/core/detect.js';
import { convertAll } from '../../convert/js/ui/run.js';
import { writeZip } from '../../convert/js/io/zip.js';
import { targetsFor } from './targets.js';

const ACCEPT = '.pdf,.png,.jpg,.jpeg,.webp,.bmp,.gif,.svg,.csv,.json,.txt,.md,.html,.htm,application/pdf,image/*,text/*,application/json';
const UNSUPPORTED = ['bin'];
const PDF_TARGETS = ['images-to-pdf', 'html-to-pdf']; // the conversions that make a PDF (images and SVG; HTML as pictures)
let uid = 0;

/** A DOM element: attributes (false, null and undefined skipped, true is a bare attribute; on* are listeners), then children. */
function el(tag, attrs, ...kids) {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v === false || v == null) continue;
    if (k === 'text') n.textContent = v;
    else if (k.startsWith('on')) n.addEventListener(k.slice(2), v);
    else n.setAttribute(k, v === true ? '' : String(v));
  }
  n.append(...kids.flat().filter((x) => x != null && x !== false));
  return n;
}
const note = (text, cls = 'sl-cvt-note') => el('p', { class: cls, text });

/** The value of one converter option, as the form shows it. */
function optionField(t, o, value, set) {
  const id = `sl-cvt-${t.id}-${o.key}`, k = 'opt:' + o.key;
  let input;
  if (o.type === 'select') {
    input = el('select', { id, 'data-k': k, onchange: (e) => set(o, o.options.find(([v]) => String(v) === e.target.value)?.[0]) },
      ...o.options.map(([v, label]) => el('option', { value: String(v), selected: String(v) === String(value), text: label })));
  } else if (o.type === 'checkbox') {
    input = el('input', { id, type: 'checkbox', 'data-k': k, checked: !!value, onchange: (e) => set(o, e.target.checked) });
  } else if (o.type === 'range') {
    input = el('input', { id, type: 'range', 'data-k': k, min: o.min, max: o.max, value: String(value), oninput: (e) => set(o, Number(e.target.value)) });
  } else if (o.type === 'color') {
    input = el('input', { id, type: 'color', 'data-k': k, value: String(value || '#ffffff'), oninput: (e) => set(o, e.target.value) });
  } else {
    const isNum = o.type === 'number';
    input = el('input', { id, type: isNum ? 'number' : 'text', 'data-k': k, min: isNum ? o.min : null, max: isNum ? o.max : null,
      placeholder: o.placeholder, value: value == null ? '' : String(value), autocomplete: 'off', oninput: (e) => set(o, e.target.value) });
  }
  return el('div', { class: 'sl-cvt-opt' }, el('label', { for: id, text: o.label }), input, o.hint ? el('span', { class: 'sl-cvt-hint', text: o.hint }) : null);
}

class Dialog {
  constructor(opts) {
    this.opts = opts; this.items = []; this.targetId = opts.target || null; this.vals = {}; this.outputs = []; this.errors = [];
    this.saved = {}; this.status = ''; this.busy = false; this.progress = 0; this.drive = !!opts.drive;
    this.opener = document.activeElement;
    this.group = 'sl-cvt-target-' + ++uid;
    this.picker = el('input', { type: 'file', multiple: true, accept: ACCEPT, hidden: true, onchange: (e) => { const f = [...e.target.files]; e.target.value = ''; if (f.length) this.addFiles(f); } });
    this.body = el('div', { class: 'sl-cvt-body' });
    this.done = new Promise((r) => { this.resolveDone = r; });
    this.back = el('div', { class: 'sl-cvt-back', onmousedown: (e) => { if (e.target === this.back) this.close(); } });
    this.dlg = el('div', { class: 'sl-cvt-dlg', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Convert',
      onkeydown: (e) => this.onKey(e) },
      el('div', { class: 'sl-cvt-head' }, el('h2', { text: 'Convert' }), el('button', { type: 'button', class: 'sl-cvt-x', 'aria-label': 'Close', onclick: () => this.close() }, '×')),
      this.body,
      el('p', { class: 'sl-cvt-foot', text: 'Converted on this device. Nothing is uploaded.' }));
    this.back.append(this.dlg);
    document.body.append(this.back);
    const files = [...(opts.files || []), ...(opts.file ? [opts.file] : [])];
    this.ready = this.addFiles(files, { quiet: true }).then(() => this.paint());
    this.paint();
    this.dlg.querySelector('.sl-cvt-x').focus();
  }

  /* ----- files and targets ----- */
  async addFiles(files, { quiet } = {}) {
    for (const file of files) {
      const kind = detectKind(file.name, file.type, await readHead(file));
      this.items.push({ id: 'f' + ++uid, file, name: file.name, size: file.size, kind });
    }
    this.outputs = []; this.errors = [];
    this.ensureTarget();
    if (!quiet) this.paint();
  }
  remove(id) { this.items = this.items.filter((i) => i.id !== id); this.outputs = []; this.errors = []; this.ensureTarget(); this.paint(); }
  unsupported() { return this.items.some((i) => UNSUPPORTED.includes(i.kind) || !KIND_LABEL[i.kind]); }
  targets() {
    if (!this.items.length || this.unsupported()) return [];
    return targetsFor(this.items.map((i) => i.kind), this.items.length);
  }
  target() { return this.targets().find((t) => t.id === this.targetId) || null; }
  /** Keeps the target when it still applies; otherwise a PDF target when the app asked for one (onPdf), else the first. */
  ensureTarget() {
    const list = this.targets();
    if (list.some((t) => t.id === this.targetId)) return;
    const pdf = list.find((t) => this.opts.onPdf && PDF_TARGETS.includes(t.id));
    this.targetId = pdf ? pdf.id : list[0] ? list[0].id : null;
  }

  /* ----- values and the run ----- */
  val(t, o) { const k = t.id + '.' + o.key; return k in this.vals ? this.vals[k] : o.value; }
  setVal(t, o, v) { this.vals[t.id + '.' + o.key] = v; }
  optsFor(t) {
    const out = {};
    for (const o of t.options) {
      let v = this.val(t, o);
      if (o.type === 'number') v = v === '' || v == null || Number.isNaN(Number(v)) ? undefined : Number(v);
      else if (o.type === 'range') v = Number(v);
      else if (o.type === 'checkbox') v = !!v;
      out[o.key] = v;
    }
    return out;
  }
  async run() {
    const t = this.target();
    if (!t || this.busy) return;
    this.busy = true; this.progress = 0; this.outputs = []; this.errors = []; this.saved = {}; this.status = 'Converting…';
    this.paint();
    try {
      const res = await convertAll(t, this.items, this.optsFor(t), (g, n) => { this.progress = g / n; this.paint(); });
      this.outputs = res.outputs;
      this.errors = res.errors.map((e) => e.message);
      this.status = res.outputs.length ? `${res.outputs.length} file${res.outputs.length === 1 ? '' : 's'} ready` : 'Nothing was made';
    } catch (e) {
      this.errors = [String((e && e.message) || e)];
      this.status = '';
    } finally {
      this.busy = false; this.paint();
    }
    if (this.opts.onPdf && PDF_TARGETS.includes(t.id) && this.outputs.length && !this.errors.length) this.handOff();
  }
  /** The PDF goes to the app that asked (onPdf), and the dialog closes. */
  handOff() {
    const names = this.items.map((i) => i.name), outs = this.outputs.map((o) => ({ name: o.name, blob: o.blob }));
    this.close();
    this.opts.onPdf(outs, names);
  }
  async saveDrive(i) {
    const o = this.outputs[i], H = window.SlopHub;
    if (!H) return;
    try {
      const id = await H.saveToDrive(o.blob, o.name, { from: 'convert', title: `Save “${o.name}” to Slop Drive` });
      if (id) { this.saved[i] = id; this.status = `Saved ${o.name} to Slop Drive`; }
    } catch (e) { this.status = 'Could not save to Slop Drive: ' + ((e && e.message) || e); }
    this.paint();
  }
  async zip() {
    const bytes = await writeZip(this.outputs.map((o) => ({ path: o.name, data: o.blob })));
    saveBlob(new Blob([bytes], { type: 'application/zip' }), 'converted.zip');
  }

  /* ----- painting: the body is rebuilt; the focused control is found again by its data-k ----- */
  paint() {
    const focused = this.dlg.contains(document.activeElement) ? document.activeElement.getAttribute('data-k') : null;
    const t = this.target();
    const parts = [this.filesSection(), this.targetSection(), this.pdfNote(), t && t.note ? note(t.note, 'sl-cvt-note sl-cvt-hint') : null, t && t.options.length ? this.optionsSection(t) : null, this.runSection(t), this.resultSection()];
    this.body.replaceChildren(...parts.filter((x) => x != null));
    if (focused) { const n = [...this.body.querySelectorAll('[data-k]')].find((x) => x.getAttribute('data-k') === focused); if (n && !n.disabled) n.focus(); }
  }
  filesSection() {
    const rows = this.items.map((i) => el('li', { class: 'sl-cvt-file' },
      el('span', { class: 'sl-cvt-name', text: i.name }),
      el('span', { class: 'sl-cvt-meta', text: `${KIND_LABEL[i.kind] || 'Unknown file'} · ${fmtSize(i.size)}` }),
      el('button', { type: 'button', class: 'sl-cvt-x', 'aria-label': `Remove ${i.name}`, 'data-k': 'rm:' + i.id, disabled: this.busy, onclick: () => this.remove(i.id) }, '×')));
    return el('section', { class: 'sl-cvt-sec' }, el('h3', { text: 'Files' }),
      rows.length ? el('ul', { class: 'sl-cvt-files' }, ...rows) : note('No files yet.'),
      el('div', { class: 'sl-cvt-row' },
        el('button', { type: 'button', class: 'sl-cvt-btn', 'data-k': 'add', disabled: this.busy, onclick: () => this.picker.click() }, 'Add files…'), this.picker));
  }
  targetSection() {
    if (!this.items.length) return note('Add a file to see what it can become.');
    if (this.unsupported()) return note('These files cannot be converted here. Try a PDF, an image, CSV, JSON, text, Markdown or HTML.', 'sl-cvt-note sl-cvt-err');
    const list = this.targets(), kinds = this.items.map((i) => i.kind), count = this.items.length;
    const locked = targetsFor(kinds, 99).filter((t) => !list.includes(t));
    const cur = this.target();
    return el('section', { class: 'sl-cvt-sec' }, el('h3', { text: 'Convert to' }),
      list.length ? el('fieldset', { class: 'sl-cvt-targets' }, el('legend', { class: 'sl-cvt-sr', text: 'Target format' }),
        ...list.map((t) => el('label', { class: 'sl-cvt-target' },
          el('input', { type: 'radio', name: this.group, value: t.id, 'data-target': t.id, 'data-k': 'tg:' + t.id, disabled: this.busy,
            checked: !!cur && cur.id === t.id, onchange: () => { this.targetId = t.id; this.outputs = []; this.errors = []; this.paint(); } }),
          el('span', { text: t.label })))) : note('No conversion takes these files together.'),
      locked.length ? note(`Add more files to unlock ${locked.map((t) => t.label).join(', ')}.`, 'sl-cvt-hint') : null,
      count > 1 && !list.length ? note('Try converting one file at a time.', 'sl-cvt-hint') : null);
  }
  /** With onPdf: names the files that cannot become the PDF here (only images and SVG make one). */
  pdfNote() {
    if (!this.opts.onPdf) return null;
    const bad = this.items.filter((i) => !targetsFor([i.kind], 1).some((t) => PDF_TARGETS.includes(t.id)));
    if (!bad.length) return null;
    return note(`${bad.map((i) => '“' + i.name + '”').join(', ')} cannot be converted to PDF here. Only images, SVG and HTML files make a PDF.`, 'sl-cvt-note sl-cvt-err');
  }
  optionsSection(t) {
    return el('section', { class: 'sl-cvt-sec' }, el('h3', { text: 'Options' }),
      ...t.options.map((o) => optionField(t, o, this.val(t, o), (oo, v) => this.setVal(t, oo, v))));
  }
  runSection(t) {
    const pct = Math.round(this.progress * 100);
    return el('section', { class: 'sl-cvt-sec sl-cvt-run' },
      this.busy ? el('div', { class: 'sl-cvt-bar', role: 'progressbar', 'aria-valuemin': '0', 'aria-valuemax': '100', 'aria-valuenow': String(pct) }, el('i', { style: `width:${pct}%` })) : null,
      el('div', { class: 'sl-cvt-row' },
        el('button', { type: 'button', class: 'sl-cvt-btn primary', 'data-k': 'run', disabled: !t || this.busy || !this.items.length, onclick: () => this.run(), text: this.busy ? 'Converting…' : 'Convert' }),
        el('span', { class: 'sl-cvt-status', role: 'status', text: this.status })));
  }
  resultSection() {
    if (!this.outputs.length && !this.errors.length) return null;
    const rows = this.outputs.map((o, i) => el('li', { class: 'sl-cvt-file' },
      el('span', { class: 'sl-cvt-name', text: o.name }),
      el('span', { class: 'sl-cvt-meta', text: fmtSize(o.blob.size) }),
      el('button', { type: 'button', class: 'sl-cvt-btn', 'data-k': 'dl:' + i, onclick: () => saveBlob(o.blob, o.name), text: 'Download' }),
      this.drive && window.SlopHub ? el('button', { type: 'button', class: 'sl-cvt-btn', 'data-k': 'dr:' + i, disabled: !!this.saved[i] || this.busy,
        onclick: () => this.saveDrive(i), text: this.saved[i] ? 'Saved to Slop Drive' : 'Save to Slop Drive' }) : null));
    return el('section', { class: 'sl-cvt-sec', 'aria-live': 'polite' }, el('h3', { text: 'Result' }),
      rows.length ? el('ul', { class: 'sl-cvt-files' }, ...rows) : null,
      this.outputs.length > 1 ? el('button', { type: 'button', class: 'sl-cvt-btn', 'data-k': 'zip', onclick: () => this.zip(), text: 'Download all as ZIP' }) : null,
      ...this.errors.map((m) => el('p', { class: 'sl-cvt-note sl-cvt-err', role: 'alert', text: m })));
  }

  /* ----- keys and closing: Escape closes; Tab stays inside the dialog ----- */
  onKey(e) {
    if (e.key === 'Escape') { e.preventDefault(); this.close(); return; }
    if (e.key !== 'Tab') return;
    const f = [...this.dlg.querySelectorAll('button:not([disabled]), input:not([disabled]), select:not([disabled])')];
    if (!f.length) return;
    if (e.shiftKey && document.activeElement === f[0]) { e.preventDefault(); f[f.length - 1].focus(); }
    else if (!e.shiftKey && document.activeElement === f[f.length - 1]) { e.preventDefault(); f[0].focus(); }
  }
  close() {
    if (!this.back.isConnected) return;
    this.back.remove();
    if (this.opener && this.opener.focus && this.opener.isConnected) this.opener.focus();
    this.resolveDone();
  }
  api() {
    return {
      ready: this.ready, done: this.done, element: this.dlg,
      close: () => this.close(),
      results: () => this.outputs.map((o) => ({ name: o.name, blob: o.blob })),
      targets: () => this.targets().map((t) => t.id),
      run: () => this.run(),
    };
  }
}

/** Opens the dialog. Returns the controller (see the top of this file). */
export function open(opts = {}) {
  return new Dialog(opts).api();
}

window.SlopConvert = { open };
