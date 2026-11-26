/* Slop PDF — the selectable text layer. Each rasterised page gets pdf.js's TextLayer (transparent text positioned over
   the canvas, as pdf.js does it), in the page's own layer so it turns with the page and follows the zoom. It sits under
   the annotations and over the find highlights. Only the select tool takes text presses; other tools draw over it. Old
   text under covers (an edit could not take it out of the page: core/covered.js) has no spans, so it cannot be selected,
   copied or block-copied, and a drag across it skips it; the layer is built again when the page's covers change. */
(function () {
  'use strict';
  var SP = window.SP, U = SP.util, E = SP.engine, Ed = SP.editor, S = Ed._, C = SP.covered;
  /** What a text layer is built for: the raster's key and the page's covers. */
  function keyOf(s, p) { return S.keyOf(s) + '|' + C.sig(p); }

  /** Builds (or rebuilds, after a zoom) a page's text layer. Resolves without one for blank pages and failures. */
  S.buildTextLayer = async function (s) {
    var p = E.pageById(s.pid), f = p && !p.blank ? E.fileOfPage(p) : null;
    if (!f) return;
    var key = keyOf(s, p);
    if (s.textKey === key) return;
    s.textKey = key;
    var lib = await E.pdfjs(), pg = await f.doc.getPage(p.i + 1), tc = C.visibleOf(p, await pg.getTextContent(), f.info[p.i].view);
    if (keyOf(s, E.pageById(s.pid)) !== key || !s.layer.isConnected) { if (s.textKey === key) s.textKey = null; return; } // the zoom, the covers or the page moved on
    var vp = pg.getViewport({ scale: Ed.zoom, rotation: 0 });
    var old = s.layer.querySelector('.pv-textlayer'); if (old) old.remove();
    var div = U.h('div', { class: 'pv-textlayer textLayer' });
    div.style.setProperty('--scale-factor', String(Ed.zoom)); // pdf.js sizes and places its spans with this (the viewport scale)
    div.style.setProperty('--total-scale-factor', String(Ed.zoom));
    // pdf.js 5 sizes the layer with round(down, ..., var(--scale-round-x)): a whole pixel, as its viewer sets it
    div.style.setProperty('--scale-round-x', '1px'); div.style.setProperty('--scale-round-y', '1px');
    s.layer.insertBefore(div, s.svg);
    var tl = new lib.TextLayer({ textContentSource: tc, container: div, viewport: vp });
    await tl.render();
  };
  // an edit that leaves a cover (or its undo) builds the layers whose page's covers changed again
  E.on('change', function () {
    S.slots.forEach(function (s) {
      var p = E.pageById(s.pid);
      if (p && s.textKey && s.textKey !== keyOf(s, p)) S.buildTextLayer(s).catch(function (e) { console.warn('Slop PDF: text layer failed', e); });
    });
  });
  /** Removes a page's text layer (its raster went away). */
  S.dropTextLayer = function (s) {
    var old = s.layer.querySelector('.pv-textlayer'); if (old) old.remove();
    s.textKey = null;
  };
})();
