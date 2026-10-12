/* Slop PDF — watermark layers as data (no DOM). A document has a list of layers, bottom first: each is a text or
   an image (logo) with a position (a 3 by 3 anchor on the visible page plus an offset in points), a size, an opacity,
   a rotation (degrees, counter-clockwise) and a page range. The list is stored in state.stamps.watermarks. Every
   function here returns a new list and never changes its input, so E.commit can record each change as one step.
   Loaded as a classic script (window.SlopPdfWm) and in a vm for tests/node/pdf-watermark.test.mjs. */
(function () {
  'use strict';
  var W = window.SlopPdfWm = window.SlopPdfWm || {};
  var FONTS = ['Helvetica', 'Times', 'Courier'];
  W.ANCHORS = ['tl', 'tc', 'tr', 'ml', 'mc', 'mr', 'bl', 'bc', 'br'];
  W.ANCHOR_LABELS = { tl: 'Top left', tc: 'Top centre', tr: 'Top right', ml: 'Middle left', mc: 'Centre', mr: 'Middle right', bl: 'Bottom left', bc: 'Bottom centre', br: 'Bottom right' };
  var COL = { l: 0, c: 0.5, r: 1 }, ROW = { t: 0, m: 0.5, b: 1 };
  var seq = 0;
  function num(v, lo, hi, d) { var n = typeof v === 'number' ? v : parseFloat(v); if (!isFinite(n)) n = d; return Math.min(hi, Math.max(lo, n)); }
  W.uid = function () { seq++; return 'w' + Date.now().toString(36).slice(-4) + Math.random().toString(36).slice(2, 6) + seq.toString(36); };

  /** A layer with every field set (defaults for a new text or logo layer). */
  W.defaults = function (kind) {
    return W.normalize({ id: W.uid(), kind: kind === 'image' ? 'image' : 'text', text: 'CONFIDENTIAL', font: 'Helvetica', bold: true,
      colour: '#888888', size: kind === 'image' ? 160 : 60, opacity: 0.25, rot: 45, anchor: 'mc', dx: 0, dy: 0, asset: '', pages: '', show: true });
  };
  /** Clean copy of a layer: every field in range, unknown fields dropped, an id always present. */
  W.normalize = function (L) {
    L = L || {};
    var anchor = W.ANCHORS.indexOf(L.anchor) >= 0 ? L.anchor : 'mc';
    var colour = /^#[0-9a-f]{6}$/i.test(String(L.colour || '')) ? String(L.colour).toLowerCase() : '#888888';
    return {
      id: typeof L.id === 'string' && L.id ? L.id : W.uid(),
      kind: L.kind === 'image' ? 'image' : 'text',
      text: String(L.text == null ? '' : L.text).slice(0, 200),
      font: FONTS.indexOf(L.font) >= 0 ? L.font : 'Helvetica',
      bold: !!L.bold,
      colour: colour,
      size: num(L.size, 4, 1000, 60),
      opacity: num(L.opacity, 0, 1, 0.25),
      rot: num(L.rot, -180, 180, 0),
      anchor: anchor,
      dx: num(L.dx, -5000, 5000, 0),
      dy: num(L.dy, -5000, 5000, 0),
      asset: typeof L.asset === 'string' ? L.asset : '',
      pages: String(L.pages == null ? '' : L.pages).slice(0, 120),
      show: L.show !== false
    };
  };
  W.normalizeList = function (list) {
    return (Array.isArray(list) ? list : []).filter(function (x) { return x && typeof x === 'object'; }).map(W.normalize);
  };
  /** The layers of a document's stamps. A file saved before layers had one watermark object, read as one layer. */
  W.fromStamps = function (stamps) {
    if (!stamps) return [];
    if (Array.isArray(stamps.watermarks)) return W.normalizeList(stamps.watermarks);
    var old = stamps.watermark;
    if (!old || !old.text) return [];
    return [W.normalize({ id: 'wm-legacy', kind: 'text', text: old.text, font: old.font, bold: old.bold !== false, colour: old.color,
      size: old.size || 60, opacity: old.opacity == null ? 0.25 : old.opacity, rot: old.angle == null ? 45 : old.angle, anchor: 'mc' })];
  };

  /** Page indices (0-based, sorted) that a page range names, for a document of n pages. Syntax: 2, 1-3, 4-, last,
      odd, even, all; comma separated. An empty range or "all" is every page. Throws on text it cannot read. */
  W.parsePages = function (spec, n) {
    var total = n == null ? Infinity : n, finite = isFinite(total), s = String(spec == null ? '' : spec).trim().toLowerCase();
    var out = new Set();
    function addAll(test) { for (var i = 0; finite && i < total; i++) if (!test || test(i + 1)) out.add(i); }
    if (!s) s = 'all';
    s.split(',').forEach(function (raw) {
      var p = raw.trim();
      if (!p) return;
      if (p === 'all') return addAll();
      if (p === 'odd') return addAll(function (k) { return k % 2 === 1; });
      if (p === 'even') return addAll(function (k) { return k % 2 === 0; });
      if (p === 'last') { if (finite && total > 0) out.add(total - 1); return; }
      var m = /^(\d+)(?:\s*-\s*(\d+)?)?$/.exec(p);
      if (!m) throw new Error('“' + p + '” is not a page number. Use numbers such as 2 or 1-3, or the words all, odd, even, last.');
      var a = +m[1], b = m[2] != null ? +m[2] : (p.indexOf('-') >= 0 ? total : a);
      if (a < 1 || b < a) throw new Error('“' + p + '” is not a valid page range.');
      for (var k = a; k <= b && (finite ? k <= total : k <= a + 10000); k++) out.add(k - 1);
    });
    return Array.from(out).sort(function (x, y) { return x - y; });
  };
  /** Whether a layer is drawn on page `index` (0-based) of `total` pages. A range that cannot be read draws nowhere. */
  W.appliesTo = function (L, index, total) {
    if (!L || !L.show) return false;
    if (!String(L.pages || '').trim()) return true;
    try { return W.parsePages(L.pages, total).indexOf(index) >= 0; } catch (e) { return false; }
  };

  /** Where a layer sits on a visible page W×H (points, top-left origin, y down). content is {w, h}: the size of the
      text or logo at its own scale. Returns the centre, the size and the rotation of the box. The anchor is the
      page point (0, 0.5 or 1 of each side), the box is aligned to it, then the offset (dx right, dy down) is added. */
  W.box = function (L, pageW, pageH, content) {
    var w = content.w, h = content.h, col = COL[L.anchor.charAt(1)], row = ROW[L.anchor.charAt(0)];
    var left = col * pageW - col * w + L.dx, top = row * pageH - row * h + L.dy;
    return { cx: left + w / 2, cy: top + h / 2, w: w, h: h, rot: L.rot };
  };

  /* Pure list operations. */
  W.get = function (list, id) { for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i]; return null; };
  W.indexOf = function (list, id) { for (var i = 0; i < list.length; i++) if (list[i].id === id) return i; return -1; };
  /** A new layer on top of the stack (or at `index`, counted from the bottom). */
  W.add = function (list, layer, index) {
    var L = W.normalize(layer), out = list.slice();
    var at = index == null ? out.length : Math.max(0, Math.min(out.length, index));
    out.splice(at, 0, L);
    return out;
  };
  W.remove = function (list, id) { return list.filter(function (x) { return x.id !== id; }); };
  /** A copy of the layer, one step above the original. The copy takes a new id. */
  W.duplicate = function (list, id, newId) {
    var i = W.indexOf(list, id); if (i < 0) return list.slice();
    var copy = W.normalize(Object.assign({}, list[i], { id: newId || W.uid() }));
    var out = list.slice(); out.splice(i + 1, 0, copy); return out;
  };
  /** Moves a layer one step: dir -1 down (towards the bottom), +1 up. At the edge the list is unchanged. */
  W.move = function (list, id, dir) {
    var i = W.indexOf(list, id), j = i + (dir < 0 ? -1 : 1), out = list.slice();
    if (i < 0 || j < 0 || j >= out.length) return out;
    var t = out[i]; out[i] = out[j]; out[j] = t;
    return out;
  };
  /** Changes some fields of one layer (the rest keep their values). */
  W.update = function (list, id, patch) {
    return list.map(function (x) { return x.id === id ? W.normalize(Object.assign({}, x, patch, { id: x.id })) : x; });
  };
  /** Ids of the logo assets the layers use (saved with the edit log so a replay finds them). */
  W.assetIds = function (list) {
    var seen = {};
    (list || []).forEach(function (L) { if (L && L.kind === 'image' && L.asset) seen[L.asset] = true; });
    return Object.keys(seen);
  };
  /** Text of a layer's label in lists: its text, or the logo's name. */
  W.label = function (L, assetName) {
    if (L.kind === 'image') return 'Logo' + (assetName ? ': ' + assetName : '');
    return L.text.trim() ? '“' + L.text.trim().slice(0, 40) + '”' : 'Text (empty)';
  };
})();
