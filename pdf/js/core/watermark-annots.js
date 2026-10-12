/* Slop PDF — watermark layers on a page: each layer that applies to the page becomes a synthetic text or image
   annotation (same renderer for the on-screen preview and the exporter), so the watermark is drawn into the page
   content in the stacking order (bottom layer first). Geometry: core/watermark.js. */
(function () {
  'use strict';
  var SP = window.SP, E = SP.engine, WM = window.SlopPdfWm;

  /** Size of a layer's content at its own scale: text lines measured with the standard font, or the logo's width. */
  function contentOf(L) {
    if (L.kind === 'image') {
      var as = E.assets.get(L.asset);
      if (!as || !as.w || !as.h) return null;
      return { w: L.size, h: L.size * as.h / as.w };
    }
    var t = E.textLayout({ text: L.text || ' ', font: L.font, bold: L.bold, size: L.size });
    return { w: t.w, h: t.h };
  }
  /** Synthetic annotations for the watermark layers that apply to page `index` of `total`, bottom first. */
  E.watermarkAnnots = function (p, index, total, stamps) {
    var list = WM.fromStamps(stamps || E.state.stamps), out = [];
    if (!list.length) return out;
    var g = E.geom(p), R = E.rotation(p), vs = E.viewSize(p);
    list.forEach(function (L) {
      if (!WM.appliesTo(L, index, total)) return;
      var content = contentOf(L);
      if (!content) return;
      var b = WM.box(L, vs.w, vs.h, content), c = E.toPage(R, g.W, g.H, b.cx, b.cy);
      out.push({
        id: 'wm:' + L.id, type: L.kind === 'image' ? 'image' : 'text', asset: L.asset, text: L.text, font: L.font, bold: L.bold,
        size: L.size, color: L.colour, opacity: L.opacity, rot: R + L.rot, cx: c[0], cy: c[1], w: content.w, h: content.h
      });
    });
    return out;
  };
})();
