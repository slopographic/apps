/* Slop PDF — the colours of a text run on the rendered page, for Edit text (edit-text.js): the paper round the run (the
   editor's background, the cover over the old text, the paint over an OCR word) and the run's ink (the new text's colour).
   The ink is the colour that stands out most from the paper, not the darkest one: light text on a dark band is light.
   Both are read from the page's canvas; a page that is not rendered gives white paper and black ink. Classic script. */
(function () {
  'use strict';
  var SP = window.SP, E = SP.engine, S = SP.editor._;

  /** The canvas pixels of a page-space box grown by pad (points), clipped to the canvas: { d, x0, y0, w, h, k } or null. */
  function pixels(s, b, pad) {
    var c = s && s.canvas, g = c && c.width ? E.geom(E.pageById(s.pid)) : null;
    if (!g || !g.W) return null;
    var k = c.width / g.W;
    var x0 = Math.max(0, Math.floor((b.x - pad) * k)), y0 = Math.max(0, Math.floor((b.y - pad) * k));
    var x1 = Math.min(c.width, Math.ceil((b.x + b.w + pad) * k)), y1 = Math.min(c.height, Math.ceil((b.y + b.h + pad) * k));
    if (x1 <= x0 || y1 <= y0) return null;
    return { d: c.getContext('2d').getImageData(x0, y0, x1 - x0, y1 - y0).data, x0: x0, y0: y0, w: x1 - x0, h: y1 - y0, k: k };
  }

  /** The paper round a box (page space): the median of the ring of pixels just outside it, as [r, g, b] in 0..1. */
  S.paperColour = function (s, b) {
    var px = pixels(s, b, 3);
    if (!px) return [1, 1, 1];
    var ix0 = b.x * px.k, iy0 = b.y * px.k, ix1 = (b.x + b.w) * px.k, iy1 = (b.y + b.h) * px.k, ch = [[], [], []];
    for (var y = 0; y < px.h; y++) for (var x = 0; x < px.w; x++) {
      var X = px.x0 + x, Y = px.y0 + y;
      if (X >= ix0 && X < ix1 && Y >= iy0 && Y < iy1) continue; // the run's own box is not the paper
      var i = (y * px.w + x) * 4;
      if (px.d[i + 3] < 128) continue;
      ch[0].push(px.d[i]); ch[1].push(px.d[i + 1]); ch[2].push(px.d[i + 2]);
    }
    if (!ch[0].length) return [1, 1, 1];
    return ch.map(function (a) { a.sort(function (p, q) { return p - q; }); return a[a.length >> 1] / 255; });
  };

  /** The run's ink inside a box: the pixel farthest from the paper colour ([r, g, b] in 0..1), as '#rrggbb'. When nothing
   * in the box stands out (no glyph pixels), black or white, whichever reads on that paper. */
  S.inkColour = function (s, b, paper) {
    var px = pixels(s, b, 0), P = paper.map(function (v) { return v * 255; }), best = null, far = 0;
    if (px) for (var i = 0; i < px.d.length; i += 4) {
      if (px.d[i + 3] < 128) continue;
      var dist = Math.abs(px.d[i] - P[0]) + Math.abs(px.d[i + 1] - P[1]) + Math.abs(px.d[i + 2] - P[2]);
      if (dist > far) { far = dist; best = [px.d[i], px.d[i + 1], px.d[i + 2]]; }
    }
    if (!best || far < 90) return P[0] * 0.299 + P[1] * 0.587 + P[2] * 0.114 < 128 ? '#ffffff' : '#000000';
    return S.hex(best.map(function (v) { return v / 255; }));
  };

  /** [r, g, b] in 0..1 as '#rrggbb'. */
  S.hex = function (rgb) {
    return '#' + rgb.map(function (v) { return ('0' + Math.round(Math.max(0, Math.min(1, v)) * 255).toString(16)).slice(-2); }).join('');
  };
})();
