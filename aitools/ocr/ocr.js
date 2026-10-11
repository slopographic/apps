/* OCR tool page: an image or one PDF page in, text out. Recognition runs in the inference worker (PP-OCRv4).
 * Nothing leaves the device: the file is read here and handed to the worker, and the text is only saved when asked. */
(function () {
  'use strict';
  const T = window.SlopAITools, $ = (id) => document.getElementById(id);
  let file = null, pdfDoc = null;

  /** Renders one page of a PDF to a canvas at about 200 dpi (scale 2.8 of 72 dpi points). */
  async function pdfPage(f, n) {
    const lib = await import(new URL('../../vendor/pdfjs/pdf.min.js', document.baseURI).href);
    lib.GlobalWorkerOptions.workerSrc = new URL('../../vendor/pdfjs/pdf.worker.min.js', document.baseURI).href;
    if (!pdfDoc || pdfDoc.fileName !== f.name + f.size) {
      const bytes = new Uint8Array(await f.arrayBuffer());
      pdfDoc = await lib.getDocument({ data: bytes, verbosity: 0, isEvalSupported: false }).promise;
      pdfDoc.fileName = f.name + f.size;
    }
    if (n < 1 || n > pdfDoc.numPages) throw new Error(`This PDF has ${pdfDoc.numPages} page${pdfDoc.numPages === 1 ? '' : 's'}.`);
    const page = await pdfDoc.getPage(n), vp = page.getViewport({ scale: 2.8 });
    const c = document.createElement('canvas');
    c.width = Math.round(vp.width); c.height = Math.round(vp.height);
    await page.render({ canvasContext: c.getContext('2d'), viewport: vp }).promise;
    return c;
  }
  /** The picture to read: the image, or the chosen page of the PDF. */
  async function source() {
    if (file.type === 'application/pdf') {
      const c = await pdfPage(file, Math.max(1, parseInt($('page').value, 10) || 1));
      return { bitmap: await createImageBitmap(c), w: c.width, h: c.height };
    }
    return T.image(file);
  }

  async function run() {
    $('run').disabled = true; $('msg').textContent = ''; const prog = $('prog');
    prog.hidden = false; prog.value = 0;
    try {
      await T.ensure('ppocr-v4', (s) => ($('msg').textContent = s));
      const img = await source();
      const r = await T.call('ocr', { bitmap: img.bitmap, w: img.w, h: img.h }, {
        transfer: [img.bitmap],
        onProgress: (p) => { prog.value = p.total ? p.done / p.total : 0; $('msg').textContent = p.stage === 'detect' ? 'Finding text lines…' : `Reading line ${p.done + 1} of ${p.total}…`; },
      });
      const text = r.lines.map((l) => l.text).join('\n');
      $('out').value = text;
      const any = text.length > 0;
      $('copy').disabled = $('dl').disabled = $('docs').disabled = !any;
      $('msg').textContent = any ? `${r.lines.length} line${r.lines.length === 1 ? '' : 's'} read. Check the text before you use it.` : 'No text found on this picture.';
    } catch (e) {
      $('msg').textContent = 'Could not read the text: ' + e.message;
    } finally { $('run').disabled = false; prog.hidden = true; }
  }
  function pick(f) {
    if (!f) return;
    if (!/^image\/|^application\/pdf$/.test(f.type)) { $('msg').textContent = 'Choose an image or a PDF.'; return; }
    file = f; pdfDoc = null;
    $('fileName').textContent = f.name + ' · ' + window.SlopAIModels.formatSize(f.size);
    $('page').parentElement.hidden = f.type !== 'application/pdf';
    $('run').disabled = false;
  }
  const drop = $('drop');
  $('file').addEventListener('change', (e) => pick(e.target.files[0]));
  drop.addEventListener('dragover', (e) => { e.preventDefault(); });
  drop.addEventListener('drop', (e) => { e.preventDefault(); pick(e.dataTransfer.files[0]); });
  $('run').addEventListener('click', run);
  $('copy').addEventListener('click', async () => { try { await navigator.clipboard.writeText($('out').value); $('msg').textContent = 'Copied.'; } catch (e) { $('msg').textContent = 'Copy was blocked. Select the text and copy it.'; } });
  $('dl').addEventListener('click', () => { const base = (file ? file.name.replace(/\.[^.]+$/, '') : 'ocr'); T.download(base + '.txt', $('out').value, 'text/plain'); });
  $('docs').addEventListener('click', async () => {
    const base = (file ? file.name.replace(/\.[^.]+$/, '') : 'ocr');
    const id = await T.toDrive(base + '.txt', new Blob([$('out').value], { type: 'text/plain' }), 'ai-ocr', { source: 'OCR' });
    if (id) { T.openDocs(id); $('msg').textContent = 'Saved to Slop Drive as ' + base + '.txt. Slop Docs is opening it in a new tab.'; }
    else $('msg').textContent = 'Slop Drive is not available here, so the text cannot be sent to Slop Docs. Use Download instead.';
  });
  T.gate('ocr', () => { $('ui').hidden = false; $('page').parentElement.hidden = true; });
})();
