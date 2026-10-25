/* OCR tool page: an image or one PDF page in, text out. Recognition runs in the inference worker (PaddleOCR), with the model
 * for the language chosen under Language and model (shared/ocr/choose.js, the same dialog as Slop OCR); without a choice
 * the bundled Chinese and English model reads first and a line under the text offers the model for another script.
 * Nothing leaves the device: the file is read here and handed to the worker, and the text is only saved when asked. */
(function () {
  'use strict';
  const T = window.SlopAITools, $ = (id) => document.getElementById(id);
  let file = null, pdfDoc = null;
  /** The Language and model choice (an ES module, loaded once). */
  const choiceP = import(new URL('../../shared/ocr/choose.js', document.baseURI).href)
    .then((m) => m.createOcrChoice({ ui: window.SlopUI, storageHref: '../../settings/#storage' }));

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
      const choice = await choiceP, pick = await choice.pick();
      $('suggest').replaceChildren();
      if (!pick) { $('msg').textContent = 'Choose the language of the text, and download its model, to read it.'; return; }
      await T.ensure(pick.model, (s) => ($('msg').textContent = s));
      const img = await source();
      const r = await T.call('ocr', { model: pick.model, bitmap: img.bitmap, w: img.w, h: img.h }, {
        transfer: [img.bitmap],
        onProgress: (p) => { prog.value = p.total ? p.done / p.total : 0; $('msg').textContent = p.stage === 'detect' ? 'Finding text lines…' : `Reading line ${p.done + 1} of ${p.total}…`; },
      });
      const text = r.lines.map((l) => l.text).join('\n');
      $('out').value = text;
      const any = text.length > 0;
      $('copy').disabled = $('dl').disabled = $('docs').disabled = !any;
      $('msg').textContent = any ? `${r.lines.length} line${r.lines.length === 1 ? '' : 's'} read. Check the text before you use it.` : 'No text found on this picture.';
      const tip = choice.suggestion(choice.suggest(r.lines, pick.model, r.skipped), () => run());
      if (tip) $('suggest').append(tip);
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
  // the one way in (aitools/intake.js): a drop on the box, choose a file, a paste, ?drive=<id>, a launch
  const intake = T.intake('ai-ocr', { accept: { types: ['image/*', 'application/pdf'], exts: ['.pdf', '.png', '.jpg', '.jpeg', '.webp', '.gif', '.bmp'], noun: 'an image or a PDF' }, read: (f) => pick(f) });
  $('run').addEventListener('click', run);
  choiceP.then((c) => c.button($('lang'), () => { if (file && $('out').value) run(); }));
  $('copy').addEventListener('click', async () => { try { await navigator.clipboard.writeText($('out').value); $('msg').textContent = 'Copied.'; } catch (e) { $('msg').textContent = 'Copy was blocked. Select the text and copy it.'; } });
  $('dl').addEventListener('click', () => { const base = (file ? file.name.replace(/\.[^.]+$/, '') : 'ocr'); T.download(base + '.txt', $('out').value, 'text/plain'); });
  $('docs').addEventListener('click', async () => {
    const base = (file ? file.name.replace(/\.[^.]+$/, '') : 'ocr');
    const id = await T.toDrive(base + '.txt', new Blob([$('out').value], { type: 'text/plain' }), 'ai-ocr', { source: 'OCR' });
    if (id) { T.openDocs(id); $('msg').textContent = 'Saved to Slop Drive as ' + base + '.txt. Slop Docs is opening it in a new tab.'; }
    else $('msg').textContent = 'Slop Drive is not available here, so the text cannot be sent to Slop Docs. Use Download instead.';
  });
  T.gate('ocr', () => { $('ui').hidden = false; $('page').parentElement.hidden = true; intake.launch(); });
})();
