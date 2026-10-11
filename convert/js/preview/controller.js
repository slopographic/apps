/* Keeps a preview block in step with a ConvertTool. Updates are debounced (150 ms) and a stale result is
 * dropped. Copy, Swap and Download run the whole conversion, so the preview's first-part limits never reach
 * the file. Browser only. */
import { conversionById } from '../core/catalog.js';
import { writeZip } from '../io/zip.js';
import { saveBlob } from '../io/files.js';
import { buildPreview, pickInputs } from './model.js';
import { createView } from './view.js';
import { acceptsText, REVERSE, DEBOUNCE_MS } from './spec.js';

/** A PNG copy of any picture the browser can draw, for the clipboard (which takes PNG). */
async function toPng(blob) {
  const bmp = await createImageBitmap(blob);
  const canvas = document.createElement('canvas');
  canvas.width = bmp.width; canvas.height = bmp.height;
  canvas.getContext('2d').drawImage(bmp, 0, 0);
  bmp.close();
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('This picture cannot be copied'))), 'image/png'));
}

export class PreviewPanel {
  /** block: the preview element. tool: the ConvertTool. root: the tool's root, which emits 'cv:change'. */
  constructor(block, tool, root) {
    this.tool = tool;
    this.seq = 0;
    this.timer = 0;
    this.model = null;
    this.dirty = true;
    this.conv = null;
    const textOk = !tool.preset || acceptsText(conversionById(tool.preset.conv));
    this.view = createView(block, { input: textOk });
    const v = this.view;
    if (v.ta) v.ta.addEventListener('input', () => tool.setText(v.ta.value));
    root.addEventListener('cv:change', () => this.schedule());
    v.copy.addEventListener('click', () => this.copy());
    v.swap.addEventListener('click', () => this.swap());
    v.download.addEventListener('click', () => this.download());
    this.update();
  }

  schedule() {
    this.dirty = true;
    clearTimeout(this.timer);
    this.timer = setTimeout(() => this.update(), DEBOUNCE_MS);
  }

  /** Keeps the text box in step with the tool: a file is the input when there is one, and cleared typed text
   * stays cleared. */
  syncInput() {
    const ta = this.view.ta;
    if (!ta) return;
    const items = this.tool.items;
    if (!items.some((i) => i.pasted) && ta.value !== '') ta.value = '';
    const fileInput = items.some((i) => !i.pasted);
    ta.disabled = fileInput;
    this.view.ta.setAttribute('aria-describedby', 'cv-pv-text-hint');
    const hint = document.getElementById('cv-pv-text-hint');
    if (hint) hint.textContent = fileInput ? 'A file is the input. Remove it to type text instead.' : 'Type or paste text. The output below updates as you type. Nothing is uploaded.';
  }

  async update() {
    const id = ++this.seq;
    this.dirty = false;
    this.syncInput();
    const { conv, items, opts } = this.tool.previewState();
    this.conv = conv;
    if (!conv || !items.length) {
      this.model = null;
      this.view.empty(this.tool.items.length ? 'No conversion on this page for these files.' : 'Add a file or type text to see the preview.');
      this.setActions(null);
      return;
    }
    this.view.setStatus('Updating…');
    const model = await buildPreview(conv, items, opts);
    if (id !== this.seq) return;
    this.model = model;
    this.view.render(model);
    this.view.setStatus('Up to date.');
    this.setActions(model);
  }

  setActions(model) {
    const v = this.view, after = model && model.after;
    const text = !!after && after.kind === 'text';
    const picture = !!after && after.kind === 'image';
    v.copy.disabled = !(text || picture);
    v.swap.hidden = !(text && REVERSE[this.conv && this.conv.id]);
    v.download.disabled = !model;
  }

  /** The whole conversion of the previewed items, as Download would run it. Reuses the preview when it was whole. */
  async full() {
    if (this.model && this.model.outputs && !this.dirty) return this.model.outputs;
    const { conv, items, opts } = this.tool.previewState();
    if (!conv || !items.length) return [];
    return conv.run(pickInputs(conv, items).map(({ name, file, kind }) => ({ name, file, kind })), opts);
  }

  async fullText() {
    const outs = await this.full();
    return outs[0] ? outs[0].blob.text() : '';
  }

  async copy() {
    const after = this.model && this.model.after;
    if (!after) return;
    try {
      if (after.kind === 'text') await navigator.clipboard.writeText(await this.fullText());
      else if (after.kind === 'image') {
        const [out] = await this.full();
        await navigator.clipboard.write([new ClipboardItem({ 'image/png': await toPng(out.blob) })]);
      } else return;
      this.view.setStatus('Copied.');
    } catch (e) {
      this.view.setStatus(`Could not copy: ${e.message || e}`);
    }
  }

  /** Feeds the output back in as the input of the reverse conversion (Base64, URL, JSON and CSV). */
  async swap() {
    const id = this.conv && this.conv.id;
    const rev = conversionById(REVERSE[id]);
    if (!rev) return;
    try {
      const text = await this.fullText();
      this.tool.swapText(text, rev);
      if (this.view.ta) this.view.ta.value = text;
      this.view.setStatus(`Swapped. Now: ${rev.label}.`);
    } catch (e) {
      this.view.setStatus(`Could not swap: ${e.message || e}`);
    }
  }

  async download() {
    this.view.setStatus('Converting the whole file…');
    try {
      const outs = await this.full();
      if (!outs.length) throw new Error('Nothing to download.');
      if (outs.length === 1) saveBlob(outs[0].blob, outs[0].name);
      else saveBlob(await writeZip(outs.map((o) => ({ path: o.name, data: o.blob }))), 'slop-convert.zip');
      this.view.setStatus('Download started.');
    } catch (e) {
      this.view.setStatus(`Could not convert: ${e.message || e}`);
    }
  }
}
