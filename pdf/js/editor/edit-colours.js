/* Slop PDF — the colours of a text run on the rendered page, for Edit text (edit-text.js): the paper round the run (the
   editor's background, the cover over the old text, the paint over an OCR word) and the run's ink (the new text's colour).
   The ink is the colour that stands out most from the paper, not the darkest one: light text on a dark band is light.
   Both are read from the page's canvas. Some browsers do not let a page read its canvases back (Firefox and Tor Browser
   with fingerprinting resistance give white): then, and on a page that is not rendered, the paper is the colour the
   page's content paints under the box (text-strip.js, content-fills.js), else white, and the ink black or white on it.
   Classic script. */
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

  var readable = null;
  /** Whether canvas pixels read back as drawn (a known colour is drawn and read once). */
  S.canvasReadable = function () {
    if (readable == null) {
      try {
        var c = document.createElement('canvas'); c.width = c.height = 2;
        var g = c.getContext('2d'); g.fillStyle = 'rgb(10, 200, 60)'; g.fillRect(0, 0, 2, 2);
        var d = g.getImageData(0, 0, 1, 1).data;
        readable = Math.abs(d[0] - 10) + Math.abs(d[1] - 200) + Math.abs(d[2] - 60) < 12;
      } catch (e) { readable = false; }
    }
    return readable;
  };
  /** The paper when the screen cannot tell: the colour the content paints there (hint, or read from the page), else white. */
  function contentPaper(s, b, hint) {
    if (hint) return hint;
    var p = s && E.pageById(s.pid), c = p && S.strip ? S.strip.contentPaper(p, b) : null;
    return c || [1, 1, 1];
  }
  /** The paper round a box (page space): the median of the ring of pixels just outside it, as [r, g, b] in 0..1. hint: the
   * content's colour under the box, used when the canvas cannot be read. */
  S.paperColour = function (s, b, hint) {
    var px = S.canvasReadable() ? pixels(s, b, 3) : null;
    if (!px) return contentPaper(s, b, hint);
    var ix0 = b.x * px.k, iy0 = b.y * px.k, ix1 = (b.x + b.w) * px.k, iy1 = (b.y + b.h) * px.k, ch = [[], [], []];
    for (var y = 0; y < px.h; y++) for (var x = 0; x < px.w; x++) {
      var X = px.x0 + x, Y = px.y0 + y;
      if (X >= ix0 && X < ix1 && Y >= iy0 && Y < iy1) continue; // the run's own box is not the paper
      var i = (y * px.w + x) * 4;
      if (px.d[i + 3] < 128) continue;
      ch[0].push(px.d[i]); ch[1].push(px.d[i + 1]); ch[2].push(px.d[i + 2]);
    }
    if (!ch[0].length) return contentPaper(s, b, hint);
    return ch.map(function (a) { a.sort(function (p, q) { return p - q; }); return a[a.length >> 1] / 255; });
  };

  /** The run's ink inside a box: the pixel farthest from the paper colour ([r, g, b] in 0..1), as '#rrggbb'. When nothing
   * in the box stands out (no glyph pixels), black or white, whichever reads on that paper. */
  S.inkColour = function (s, b, paper) {
    var px = S.canvasReadable() ? pixels(s, b, 0) : null, P = paper.map(function (v) { return v * 255; }), best = null, far = 0;
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
