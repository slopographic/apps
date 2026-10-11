/* PDF pages to PNG or JPG using the vendored pdf.js build (vendor/pdfjs). Browser only.
 * pdfToImages(bytes, { pages, scale, format, quality }) → [{ pageNo, blob, width, height }] */
import { PDFJS_URL, PDFJS_WORKER_URL, PDFJS_CMAP_URL } from './lib.js';
import { parseRange } from './range.js';
import { makeCanvas, canvasToBlob } from './image.js';

const MAX_PIXELS = 40e6;
let libPromise = null;
function pdfjs() {
  if (!libPromise) {
    libPromise = import(PDFJS_URL).then((lib) => {
      lib.GlobalWorkerOptions.workerSrc = PDFJS_WORKER_URL;
      return lib;
    }, (e) => { libPromise = null; throw e; });
  }
  return libPromise;
}

/** Open a PDF with pdf.js; throws a readable error for passwords and damaged files. */
export async function openPdf(bytes) {
  const lib = await pdfjs();
  try {
    return await lib.getDocument({ data: bytes.slice(), cMapUrl: PDFJS_CMAP_URL, cMapPacked: true, isEvalSupported: false, useSystemFonts: true, verbosity: 0 }).promise;
  } catch (e) {
    if (e && e.name === 'PasswordException') throw new Error('This PDF is password protected. Unlock it first.');
    if (e && e.name === 'InvalidPDFException') throw new Error('This is not a valid PDF, or it is damaged.');
    throw new Error(`This PDF could not be opened: ${(e && e.message) || e}`);
  }
}

export async function pdfToImages(bytes, { pages = '', scale = 2, format = 'png', quality = 0.92, onPage } = {}) {
  const doc = await openPdf(bytes);
  try {
    const list = parseRange(pages, doc.numPages);
    const out = [];
    const mime = format === 'jpg' ? 'image/jpeg' : 'image/png';
    for (const n of list) {
      const page = await doc.getPage(n);
      const base = page.getViewport({ scale: 1 });
      const s = Math.min(Number(scale) || 2, Math.sqrt(MAX_PIXELS / (base.width * base.height)));
      const vp = page.getViewport({ scale: s });
      const w = Math.max(1, Math.floor(vp.width)), h = Math.max(1, Math.floor(vp.height));
      const canvas = makeCanvas(w, h);
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#ffffff';            // PDF pages are paper; JPG has no alpha either
      ctx.fillRect(0, 0, w, h);
      await page.render({ canvasContext: ctx, viewport: vp }).promise;
      const blob = await canvasToBlob(canvas, mime, quality);
      canvas.width = canvas.height = 0;
      page.cleanup();
      out.push({ pageNo: n, blob, width: w, height: h });
      if (onPage) onPage(out.length, list.length);
    }
    return out;
  } finally {
    await doc.destroy();
  }
}
