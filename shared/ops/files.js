/* Utility and PDF operations for Slop Workflows (registry: shared/ops/registry.js). The rest of the PDF steps (merge,
 * images to PDF, PDF to images, password) are File convert's own conversions and appear on their own.
 *   files.rename   new names from a pattern: {name} the old name, {n} a number, {date} today (YYYY-MM-DD); the extension
 *                  stays. Takes the whole set at once, so {n} counts across the files.
 *   pdf.compress   Lossless: pdf-lib saves the PDF again with object streams (text and vectors stay); Strong: every page
 *                  becomes a JPEG at the chosen resolution (File convert's pdf.js page renderer and its image PDF writer).
 *                  A result that is not smaller keeps the original, and the info line says so.
 *   renameAll(names, pattern, { start, digits, date })  the pure part of Rename: unique names, extensions kept */
import { register } from './registry.js';
import { stem } from './load.js';
import { loadPdfLib } from '../../convert/js/core/lib.js';
import { pdfToImages } from '../../convert/js/core/pdf-raster.js';
import { imagesToPdf } from '../../convert/js/core/pdf-images.js';

const extOf = (name) => (/\.[^./\\]+$/.exec(String(name)) || [''])[0];
const safe = (s) => String(s).replace(/[\\/:*?"<>|]+/g, '_').replace(/^\s+|\s+$/g, '');
const today = () => { const d = new Date(), p = (n) => String(n).padStart(2, '0'); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`; };

export function renameAll(names, pattern = '{name}', { start = 1, digits = 0, date = today() } = {}) {
  const taken = new Set(), pad = Math.max(0, Math.min(8, Number(digits) || 0));
  return names.map((name, i) => {
    const n = String((Number(start) || 0) + i).padStart(pad, '0');
    const base = safe(String(pattern || '{name}').replace(/\{name\}/g, stem(name)).replace(/\{n\}/g, n).replace(/\{date\}/g, date)) || stem(name);
    let out = base + extOf(name), k = 2;
    while (taken.has(out.toLowerCase())) out = `${base}-${k++}${extOf(name)}`;
    taken.add(out.toLowerCase());
    return out;
  });
}

async function rename(files, o) {
  const names = renameAll(files.map((f) => f.name), o.pattern, { start: o.start, digits: o.digits });
  return files.map((f, i) => ({ name: names[i], blob: new File([f.file], names[i], { type: f.file.type }), kind: f.kind }));
}

const pdfBlob = (bytes) => new Blob([bytes], { type: 'application/pdf' });
const kb = (n) => (n < 1048576 ? `${Math.max(1, Math.round(n / 1024))} KB` : `${(n / 1048576).toFixed(1)} MB`);

async function compress(files, o, ctx = {}) {
  const f = files[0], src = new Uint8Array(await f.file.arrayBuffer());
  let bytes;
  if (o.mode === 'strong') {
    const dpi = Number(o.dpi) || 110;
    const pages = await pdfToImages(src, { scale: dpi / 72, format: 'jpg', quality: (Number(o.quality) || 70) / 100,
      onPage: (d, t) => { if (ctx.progress) ctx.progress(d / t); } });
    // imagesToPdf reads a picture's size at 96 px to the inch: give it the size that makes each page its own size again
    const items = await Promise.all(pages.map(async (p) => ({ bytes: new Uint8Array(await p.blob.arrayBuffer()), mime: 'image/jpeg', width: (p.width * 96) / dpi, height: (p.height * 96) / dpi })));
    bytes = await imagesToPdf(items, { page: 'fit', margin: 0 });
  } else {
    const { PDFDocument } = await loadPdfLib();
    let doc;
    try { doc = await PDFDocument.load(src, { updateMetadata: false }); } catch (e) {
      throw new Error(/encrypt/i.test(String(e && e.message)) ? 'This PDF has a password. Remove it first.' : 'This is not a valid PDF, or it is damaged.');
    }
    bytes = await doc.save({ useObjectStreams: true });
  }
  if (bytes.length >= src.length) {
    const out = [{ name: f.name, blob: f.file, kind: 'pdf' }];
    out.info = `${f.name} was already compact, so it is unchanged.`;
    return out;
  }
  const out = [{ name: `${stem(f.name)}-compressed.pdf`, blob: pdfBlob(bytes), kind: 'pdf' }];
  out.info = `${f.name}: ${kb(src.length)} → ${kb(bytes.length)}.`;
  return out;
}

export const FILE_OPS = register([
  { id: 'files.rename', label: 'Rename', group: 'Files', from: ['*'], mode: 'combine', out: (k) => k,
    description: 'New file names from a pattern with the old name, a number and the date. The extension stays.',
    keywords: ['rename', 'file names', 'numbering', 'batch rename'],
    options: [
      { key: 'pattern', type: 'text', label: 'Pattern', value: '{name}-{n}', placeholder: '{name}-{n}', hint: '{name} the old name, {n} a number, {date} today.' },
      { key: 'start', type: 'number', label: 'First number', min: 0, max: 1e6, value: 1 },
      { key: 'digits', type: 'number', label: 'Digits (01, 001…)', min: 0, max: 8, value: 2 },
    ], run: rename },
], { app: 'files', label: 'Files' });

export const PDF_OPS = register([
  { id: 'pdf.compress', label: 'Compress PDF', group: 'PDF', from: ['pdf'], ext: 'pdf', mode: 'each',
    description: 'Smaller PDFs: lossless keeps text and drawings; strong turns each page into a JPEG.',
    keywords: ['compress pdf', 'smaller', 'reduce size', 'optimise', 'shrink'],
    options: [
      { key: 'mode', type: 'select', label: 'Compression', value: 'lossless', options: [['lossless', 'Lossless (text stays text)'], ['strong', 'Strong (pages become pictures)']] },
      { key: 'dpi', type: 'select', label: 'Resolution (strong)', value: 110, options: [[72, '72 dpi (screen)'], [110, '110 dpi'], [150, '150 dpi (print)']] },
      { key: 'quality', type: 'range', label: 'JPEG quality (strong)', min: 20, max: 95, value: 70 },
    ], run: compress },
], { app: 'pdf', label: 'Slop PDF' });
