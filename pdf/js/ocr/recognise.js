/* Slop PDF — Recognise text (OCR) on pages that have none. The engine is the AI tools' OCR (PP-OCRv4 on the inference
   worker, aitools/common.js). Its model is stored on this device after one download (Get more), and then it runs offline.
   Each page is rendered at 200 dpi, read line by line, and the words are written as an invisible text layer (ocr/layer.js).
   The pages get a copy of their file with that layer, so the existing text editing finds the words. One undo step per page.
   Cancel stops before the next page: the pages already read are kept. Stubs replace SP.ocr.ready and SP.ocr.read in tests. */
(function () {
  'use strict';
  var SP = window.SP, U = SP.util, E = SP.engine, Ed = SP.editor, A = SP.app, O = SP.organizer;
  var OCR = SP.ocr = {};
  var MODEL = 'ppocr-v4', DPI = 200, MAX_PX = 40e6;

  /** Checks the device and the model. Throws (with needsModel set) when the model still has to be downloaded. */
  OCR.ready = async function (onStatus) {
    var T = window.SlopAITools, M = window.SlopAIManager;
    if (!T || !M || !window.SlopAISupport) throw new Error('The OCR engine did not load. Reload the page.');
    var sup = window.SlopAISupport.check('ocr');
    if (!sup.ok) throw new Error(sup.reason);
    if ((await M.status(MODEL)) === 'needs-download') {
      var err = new Error('The OCR model is not on this device yet.');
      err.needsModel = true;
      throw err;
    }
    await T.ensure(MODEL, onStatus);
  };
  /** Opens the Get more dialog for the model (nothing downloads until the person confirms there). */
  OCR.getModel = function () {
    if (window.SlopAIGetMore) window.SlopAIGetMore.open(MODEL, { onInstalled: function () { SlopUI.toast('The OCR model is on this device. Choose Recognise text again.'); } });
  };
  /** Reads one picture (a canvas of the page). Resolves to lines [{ text, score, box: { x, y, w, h } }] in canvas pixels. */
  OCR.read = async function (canvas, onProgress) {
    var bitmap = await createImageBitmap(canvas);
    var r = await window.SlopAITools.call('ocr', { bitmap: bitmap, w: canvas.width, h: canvas.height }, { transfer: [bitmap], onProgress: onProgress });
    return r.lines || [];
  };

  /** The unrotated picture of a page at DPI (capped in pixels). Its size maps to the view box, as the layer needs. */
  function pictureOf(p) {
    var g = E.geom(p), scale = Math.min(DPI / 72, Math.sqrt(MAX_PX / (g.W * g.H)));
    return E.renderToCanvas(E.fileOfPage(p), p.i, scale);
  }
  /** True when the page already has text the editor can see. */
  async function hasText(p) {
    var pg = await E.fileOfPage(p).doc.getPage(p.i + 1), tc = await pg.getTextContent();
    return tc.items.some(function (it) { return typeof it.str === 'string' && it.str.trim() !== ''; });
  }
  /** Progress dialog with a Cancel button. cancelled() turns true when the person cancels (button, X or Escape). */
  function progressDialog() {
    var msg = U.h('p', { class: 'sui-p', role: 'status' }, 'Starting…');
    var bar = U.h('progress', { max: '1', value: '0', style: { width: '100%' } });
    var state = { done: false, cancelled: false };
    var dlg = SlopUI.dialog({ title: 'Recognise text', cls: 'ocr-progress', body: U.h('div', null, msg, bar), buttons: [{ label: 'Cancel' }],
      onClose: function () { if (!state.done) state.cancelled = true; } });
    return {
      cancelled: function () { return state.cancelled; },
      set: function (text, frac) { msg.textContent = text; if (frac != null) bar.value = frac; },
      close: function () { state.done = true; dlg.close(true); }
    };
  }

  /** Reads the given pages (ids) and adds their text layer. Resolves to the number of pages changed. */
  A.recognise = async function (ids) {
    var pages = ids.map(function (id) { return E.pageById(id); }).filter(function (p) { return p && !p.blank; });
    if (!pages.length) { SlopUI.toast('Blank pages have no picture to read.'); return 0; }
    if (Ed.isEditingText()) Ed.commitText();
    var todo = [], skipped = 0;
    for (var i = 0; i < pages.length; i++) {
      if (!(await hasText(pages[i]))) todo.push(pages[i]);
      else if (pages.length === 1) {
        var again = await SlopUI.confirm('This page already has text', 'Recognised text is added on top of it, so its words would be found twice. Recognise it anyway?', 'Recognise anyway');
        if (again) todo.push(pages[i]); else return 0;
      } else skipped++;
    }
    if (!todo.length) { SlopUI.toast('These pages already have text.'); return 0; }
    var ui = progressDialog(), n = todo.length, results = [], error = null;
    try {
      await OCR.ready(function (s) { ui.set(s, null); });
      for (var k = 0; k < n && !ui.cancelled(); k++) {
        var p = todo[k], label = n > 1 ? 'Page ' + (k + 1) + ' of ' + n : 'The page';
        ui.set(label + ': rendering…', k / n);
        var canvas = await pictureOf(p), px = { w: canvas.width, h: canvas.height };
        var lines = await OCR.read(canvas, function (q) {
          var within = q.stage === 'detect' ? 0 : (q.total ? q.done / q.total : 0);
          ui.set(label + (q.stage === 'detect' ? ': finding text lines…' : ': reading line ' + (q.done + 1) + ' of ' + q.total + '…'), (k + within) / n);
        });
        results.push({ id: p.id, f: p.f, i: p.i, lines: lines, px: px, g: E.geom(p) });
        canvas.width = canvas.height = 0;
      }
    } catch (e) { error = e; }
    ui.close();
    if (error && error.needsModel) { OCR.getModel(); return 0; }
    var stopped = ui.cancelled() && results.length < n;
    var changed = await writeResults(results);
    if (error) SlopUI.alert('Could not read the text', String(error.message || error));
    else if (changed) {
      SlopUI.toast('Text recognised on ' + changed + ' page' + (changed === 1 ? '' : 's') + (stopped ? '. Stopped early; the other pages are unchanged' : '') + (skipped ? '. ' + skipped + ' with text skipped' : '') + '.');
    } else SlopUI.toast(stopped ? 'Cancelled. Nothing was changed.' : 'No text was found on these pages.');
    if (changed) Ed.paint();
    return changed;
  };

  /** Writes the layer into one copy of each source file, then one undo step per page. */
  async function writeResults(results) {
    if (!results.length) return 0;
    var byFile = new Map();
    results.forEach(function (r) { var a = byFile.get(r.f) || []; a.push(r); byFile.set(r.f, a); });
    var newFile = new Map();
    for (var entry of byFile) {
      var f = E.files.get(entry[0]), rs = entry[1];
      var bytes = await SP.ocrLayer.write(f.bytes, rs.map(function (r) { return { index: r.i, lines: r.lines, g: r.g, px: r.px }; }));
      var made = await E.registerPdf(bytes, 'Recognised text.pdf', null);
      made.noLog = true; // generated: its bytes cannot be replayed from the edit log
      newFile.set(entry[0], made.id);
    }
    results.forEach(function (r) {
      var fid = newFile.get(r.f), n = E.indexOf(r.id) + 1;
      E.commit('Recognise text on page ' + n, function (st) {
        var q = st.pages.filter(function (x) { return x.id === r.id; })[0];
        if (q) q.f = fid;
      });
    });
    return results.length;
  }

  /** The pages "this page" means: the page in view, else the selected pages, else the focused one. */
  function pagesHere() {
    if (A.mode === 'page') return Ed.pid ? [Ed.pid] : [];
    var sel = O.selected();
    return sel.length ? sel : (O.focusId ? [O.focusId] : []);
  }
  A.recognisePage = function () { return A.recognise(pagesHere()); };
  A.recogniseAll = function () { return A.recognise(E.state.pages.map(function (p) { return p.id; })); };
})();
