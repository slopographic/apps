/* Slop PDF — text hidden under covers. Where an edit (Edit text, Remove, Replace all, the selection's lift) could not take
   old text out of the page, a cover hides it (a whiteout marked hides: 'text', core/layers.js L.isCover). Inside the app
   that text is gone: Find and its highlights, Find and replace, the selectable text layer (and the block copy tool, which
   reads it), Redact ▸ find, Extract text and Extract all leave it out. This is the one rule they share: a text item (or a
   run of its characters) is hidden when most of its box (60% or more) lies under covers on its page. The part that is
   hidden is dropped from the item; what stays visible of it becomes items of its own, in their own place. Boxes are PDF
   user space (as pdf.js text positions). Pure (tests/node/pdf-covered.test.mjs) except C.visibleOf and C.ofBuilt, which
   read a page's covers and its text. Classic script, loaded after core/layers.js. */
(function () {
  'use strict';
  var SP = window.SP;
  var C = SP.covered = {};
  var SHARE = 0.6; // as Edit text's visibleRuns (editor/edit-text.js): a run 60% covered is not on the page any more
  var WHOLE = 0.9;

  /** Whether an annotation is a cover over old text that hides it now (not a hidden layer). */
  C.hides = function (a) { return !!(a && a.type === 'whiteout' && a.hides === 'text' && !a.hidden); };
  /** The covers of a page's annotations as PDF user-space rectangles { x0, y0, x1, y1 }. view: the page's view box
   * [x0, y0, x1, y1] (annotations are unrotated page points from its top-left). A turned cover counts by its bounds. */
  C.rects = function (annots, view) {
    return (annots || []).filter(C.hides).map(function (a) {
      var r = (a.rot || 0) * Math.PI / 180, cs = Math.abs(Math.cos(r)), sn = Math.abs(Math.sin(r));
      var w = a.w * cs + a.h * sn, h = a.w * sn + a.h * cs, x = view[0] + a.cx, y = view[3] - a.cy;
      return { x0: x - w / 2, x1: x + w / 2, y0: y - h / 2, y1: y + h / 2 };
    });
  };
  /** The box of the part of a pdf.js text item from fraction f0 to f1 of its width: the glyphs' band (a little under the
   * baseline to near the cap height), as a user-space rectangle. */
  C.box = function (it, f0, f1) {
    var t = it.transform, sx = Math.hypot(t[0], t[1]) || 1, fs = Math.hypot(t[2], t[3]) || it.height || 10;
    var dx = t[0] / sx, dy = t[1] / sx, ux = t[2] / fs, uy = t[3] / fs, w = it.width || 0;
    var xs = [], ys = [];
    [[w * f0, -0.2 * fs], [w * f0, 0.75 * fs], [w * f1, -0.2 * fs], [w * f1, 0.75 * fs]].forEach(function (c) {
      xs.push(t[4] + dx * c[0] + ux * c[1]); ys.push(t[5] + dy * c[0] + uy * c[1]);
    });
    return { x0: Math.min.apply(null, xs), y0: Math.min.apply(null, ys), x1: Math.max.apply(null, xs), y1: Math.max.apply(null, ys) };
  };
  function area(r) { return Math.max(0, r.x1 - r.x0) * Math.max(0, r.y1 - r.y0); }
  /** Rectangle a with c cut out: up to four pieces. */
  function cut(a, c) {
    if (c.x1 <= a.x0 || c.x0 >= a.x1 || c.y1 <= a.y0 || c.y0 >= a.y1) return [a];
    var out = [], y0 = Math.max(a.y0, c.y0), y1 = Math.min(a.y1, c.y1);
    if (c.y0 > a.y0) out.push({ x0: a.x0, x1: a.x1, y0: a.y0, y1: c.y0 });
    if (c.y1 < a.y1) out.push({ x0: a.x0, x1: a.x1, y0: c.y1, y1: a.y1 });
    if (c.x0 > a.x0) out.push({ x0: a.x0, x1: c.x0, y0: y0, y1: y1 });
    if (c.x1 < a.x1) out.push({ x0: c.x1, x1: a.x1, y0: y0, y1: y1 });
    return out;
  }
  /** The share (0..1) of a box that the covers hide together. A box without area is not hidden. */
  C.share = function (box, rects) {
    var all = area(box);
    if (!(all > 0)) return 0;
    var left = [box];
    rects.forEach(function (c) { left = left.reduce(function (acc, p) { return acc.concat(cut(p, c)); }, []); });
    return 1 - left.reduce(function (s, r) { return s + area(r); }, 0) / all;
  };
  function even(it, k) { return k / it.str.length; }
  /** Which characters of a text item the covers hide: null when none, else one boolean per character. Each character is
   * hidden when its own box is mostly covered (so a cover Replace all put over one word hides that word only); an item
   * all but entirely covered (90%) is hidden whole, whatever the measured glyphs say. frac(it, k): the share of the item's
   * width before character k (measured glyphs; even shares when it is not given). */
  C.mask = function (it, rects, frac) {
    var str = typeof it.str === 'string' ? it.str : '', n = str.length, k;
    if (!n || !rects || !rects.length) return null;
    var whole = C.share(C.box(it, 0, 1), rects);
    if (!(whole > 0)) return null;
    var m = new Array(n), any = false;
    if (whole >= WHOLE) { for (k = 0; k < n; k++) m[k] = true; return m; }
    frac = frac || even;
    for (k = 0; k < n; k++) { m[k] = C.share(C.box(it, frac(it, k), frac(it, k + 1)), rects) >= SHARE; any = any || m[k]; }
    return any ? m : null;
  };
  /** Whether a whole text item counts as hidden by covers (every character mostly under them). */
  C.hidden = function (it, rects) { var m = C.mask(it, rects); return !!m && m.every(Boolean); };
  /** The visible parts of an item as items of their own (each runs of characters the mask leaves, placed where they sit).
   * A line end the item carried stays on its last part, or on an empty item when nothing of it is left. */
  C.pieces = function (it, m, frac) {
    frac = frac || even;
    var t = it.transform, sx = Math.hypot(t[0], t[1]) || 1, dx = t[0] / sx, dy = t[1] / sx, w = it.width || 0, out = [], a = -1;
    function piece(i, j) {
      var fa = frac(it, i), fb = frac(it, j), q = Object.assign({}, it);
      q.str = it.str.slice(i, j); q.width = w * (fb - fa); q.hasEOL = false;
      q.transform = t.slice(); q.transform[4] = t[4] + dx * w * fa; q.transform[5] = t[5] + dy * w * fa;
      out.push(q);
    }
    for (var k = 0; k <= m.length; k++) {
      if (k < m.length && !m[k]) { if (a < 0) a = k; }
      else if (a >= 0) { piece(a, k); a = -1; }
    }
    if (it.hasEOL) {
      if (out.length) out[out.length - 1].hasEOL = true;
      else out.push(Object.assign({}, it, { str: '', width: 0, hasEOL: true }));
    }
    return out;
  };
  /** A text item's identity in a page's content: its words and where they start. */
  C.key = function (it) { return it.str + '|' + (it.transform || []).map(function (v) { return Math.round(v * 100); }).join(','); };
  /** How many items of each identity a text content has (a Map). */
  C.keys = function (tc) {
    var out = new Map();
    ((tc && tc.items) || []).forEach(function (it) { if (typeof it.str === 'string' && it.str) { var k = C.key(it); out.set(k, (out.get(k) || 0) + 1); } });
    return out;
  };
  /** A text content (pdf.js getTextContent) without what the covers hide; the same object when they hide nothing.
   * opts: frac (as C.mask); only (a Map from C.keys): only items of the page's own content can be hidden, each identity
   * as many times as that content has it, so text drawn over the covers in a saved copy (the new text) stays. */
  C.visible = function (tc, rects, opts) {
    opts = opts || {};
    if (!tc || !rects || !rects.length) return tc;
    var only = opts.only ? new Map(opts.only) : null, items = [], changed = false;
    (tc.items || []).forEach(function (it) {
      if (typeof it.str !== 'string' || !it.str) { items.push(it); return; }
      if (only) {
        var k = C.key(it), n = only.get(k) || 0;
        if (!n) { items.push(it); return; }
        only.set(k, n - 1);
      }
      var m = C.mask(it, rects, opts.frac);
      if (!m) { items.push(it); return; }
      changed = true;
      C.pieces(it, m, opts.frac).forEach(function (q) { items.push(q); });
    });
    return changed ? Object.assign({}, tc, { items: items }) : tc;
  };

  /* ------------------------------------------------------------ in the app */
  /** Measured glyph shares for a text content's items (redact/find.js R.frac), or null (even shares). */
  function fracOf(tc) {
    var R = SP.redact;
    if (!R || !R.frac) return null;
    return function (it, k) { var st = tc.styles && tc.styles[it.fontName]; return R.frac(it, k, st && st.fontFamily); };
  }
  /** A page's text content (from its own file, view: that page's view box) without what the page's covers hide. */
  C.visibleOf = function (p, tc, view) {
    var rects = p ? C.rects(p.annots, view) : [];
    return rects.length ? C.visible(tc, rects, { frac: fracOf(tc) }) : tc;
  };
  /** The text content of page p's copy in a built PDF (E.build) without the old text p's covers hide: only items that
   * are p's own content can be hidden (what the annotations drew stays). Resolves tc itself when nothing is hidden. */
  C.ofBuilt = async function (p, tc) {
    var E = SP.engine, f = p && !p.blank && E ? E.fileOfPage(p) : null;
    if (!f || !f.doc || !f.info[p.i]) return tc;
    var rects = C.rects(p.annots, f.info[p.i].view);
    if (!rects.length) return tc;
    var own = await (await f.doc.getPage(p.i + 1)).getTextContent();
    return C.visible(tc, rects, { frac: fracOf(tc), only: C.keys(own) });
  };
  /** The covers of a page as a short key: what the text layer is built for. */
  C.sig = function (p) {
    return ((p && p.annots) || []).filter(C.hides).map(function (a) { return [a.cx, a.cy, a.w, a.h, a.rot || 0].join(','); }).join(';');
  };
})();
