/* Slop PDF — taking old text off a page, the one path for Edit text (Lines and Paragraphs) and Remove. The text is removed
   from the page's own content stream (core/content-strip.js), so nothing is painted over it: it no longer shows, prints,
   is found by search or copied. The page then points at a derived copy of its file ({ derived: { from, i, targets } },
   an id made from those, so the edit log can make it again on replay, io/edit-log.js); undo points it back. The copy is
   checked with pdf.js before it is used: the text in the targets is gone and every other text item is where it was.
   When that cannot be done (text in a Form XObject, clipping text, a font that cannot be measured, an unreadable or very
   large file) the caller covers the text instead, in the colour under it: the rendered page's (edit-colours.js), or, when
   the page cannot be read back, the colour the content paints there (core/content-fills.js). Classic script. */
(function () {
  'use strict';
  var SP = window.SP, E = SP.engine, Ed = SP.editor, S = Ed._, Lx = window.SlopPdfLex, St = window.SlopPdfStrip, Fi = window.SlopPdfFills;
  var X = S.strip = {};
  var MAX = 80e6; // bytes: a bigger file is covered, not copied for each edit
  var fills = new Map(); // file id:page → Promise of the page's operators (for the colour under a box)

  function latin1(b) {
    var s = '';
    for (var i = 0; i < b.length; i += 8192) s += String.fromCharCode.apply(null, b.subarray(i, i + 8192));
    return s;
  }
  function bytesOf(s) { var u = new Uint8Array(s.length); for (var i = 0; i < s.length; i++) u[i] = s.charCodeAt(i) & 255; return u; }
  function load(bytes) { return PDFLib.PDFDocument.load(bytes, { ignoreEncryption: true, updateMetadata: false, throwOnInvalidObject: false }); }
  /** FNV-1a of a string, twice with two seeds: 16 hex digits. */
  function hash(s) {
    var out = '';
    [0x811c9dc5, 0x01000193 ^ 0x5bd1e995].forEach(function (h) {
      for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
      out += ('0000000' + (h >>> 0).toString(16)).slice(-8);
    });
    return out;
  }
  /** The page's content streams (refs) and their decoded text, joined by a newline. */
  function contentOf(doc, page) {
    var L = PDFLib, c = page.node.Contents(), refs = !c ? [] : c instanceof L.PDFArray ? c.asArray() : [c];
    var text = refs.map(function (r) {
      var s = doc.context.lookup(r);
      return latin1(s instanceof L.PDFRawStream ? L.decodePDFRawStream(s).decode() : s.getUnencodedContents());
    }).join('\n');
    return { refs: refs, text: text };
  }

  /* ------------------------------------------------------------ fonts: name → { two, width(code) } or null */
  var STD = { Arial: 'Helvetica', ArialMT: 'Helvetica', 'Arial-BoldMT': 'Helvetica-Bold', 'Arial,Bold': 'Helvetica-Bold', TimesNewRoman: 'Times-Roman', TimesNewRomanPSMT: 'Times-Roman', CourierNew: 'Courier', CourierNewPSMT: 'Courier' };
  var stdCodes = new Map();
  function stdFont(base) {
    var n = String(base || '').replace(/^[A-Z]{6}\+/, ''), names = Object.values(PDFLib.StandardFonts);
    n = names.indexOf(n) >= 0 ? n : STD[n];
    if (!n) return null;
    if (!stdCodes.has(n)) {
      var em = PDFLib.StandardFontEmbedder.for(n), map = {};
      em.encoding.supportedCodePoints.forEach(function (cp) { var e = em.encoding.encodeUnicodeCodePoint(cp); if (map[e.code] == null) map[e.code] = em.font.getWidthOfGlyph(e.name) || 0; });
      stdCodes.set(n, map);
    }
    var m = stdCodes.get(n);
    return { two: false, width: function (c) { return m[c] || 0; } };
  }
  function readFont(ctx, d) {
    var L = PDFLib, N = function (k) { return L.PDFName.of(k); }, look = function (o) { return o ? ctx.lookup(o) : null; };
    var val = function (o) { o = look(o); return o instanceof L.PDFNumber ? o.asNumber() : null; };
    var nm = function (o) { o = look(o); return o instanceof L.PDFName ? o.decodeText() : null; };
    var sub = nm(d.get(N('Subtype')));
    if (sub === 'Type0') {
      if (nm(d.get(N('Encoding'))) !== 'Identity-H') return null;
      var kids = look(d.get(N('DescendantFonts'))), cid = kids instanceof L.PDFArray ? look(kids.get(0)) : null;
      if (!(cid instanceof L.PDFDict)) return null;
      var dw = val(cid.get(N('DW'))), w = look(cid.get(N('W'))), map = new Map();
      if (dw == null) dw = 1000;
      if (w instanceof L.PDFArray) {
        var a = w.asArray(), i = 0;
        while (i < a.length) {
          var c0 = val(a[i]), nx = look(a[i + 1]);
          if (nx instanceof L.PDFArray) { nx.asArray().forEach(function (v, j) { map.set(c0 + j, val(v) || 0); }); i += 2; }
          else { var c1 = val(a[i + 1]), wv = val(a[i + 2]); for (var c = c0; c <= c1 && c - c0 < 65536; c++) map.set(c, wv); i += 3; }
        }
      }
      return { two: true, width: function (c) { return map.has(c) ? map.get(c) : dw; } };
    }
    if (sub === 'Type3') return null;
    var widths = look(d.get(N('Widths'))), first = val(d.get(N('FirstChar')));
    if (widths instanceof L.PDFArray && first != null) {
      var ws = widths.asArray().map(function (v) { return val(v) || 0; }), fd = look(d.get(N('FontDescriptor')));
      var miss = fd instanceof L.PDFDict ? val(fd.get(N('MissingWidth'))) || 0 : 0;
      return { two: false, width: function (c) { var k = c - first; return k >= 0 && k < ws.length ? ws[k] : miss; } };
    }
    return stdFont(nm(d.get(N('BaseFont'))));
  }
  function fontTable(doc, page) {
    var L = PDFLib, res = page.node.Resources(), fd = res ? res.lookup(L.PDFName.of('Font')) : null, out = {};
    if (fd instanceof L.PDFDict) fd.entries().forEach(function (e) {
      var d = doc.context.lookup(e[1]);
      try { out[e[0].decodeText()] = d instanceof L.PDFDict ? readFont(doc.context, d) : null; } catch (err) { out[e[0].decodeText()] = null; }
    });
    return function (name) { return out[name] || null; };
  }

  /** The XObjects of a resource dictionary for content-fills.js: name → { image } or { ops, matrix, xobj } (forms read
   * when asked, a few levels deep), or null. */
  function xobjects(doc, res, depth) {
    var L = PDFLib, ctx = doc.context, xd = res instanceof L.PDFDict ? res.lookup(L.PDFName.of('XObject')) : null, memo = {};
    return function (name) {
      if (name in memo) return memo[name];
      var st = xd instanceof L.PDFDict ? xd.lookup(L.PDFName.of(name)) : null, out = null;
      try {
        var sub = st && st.dict ? st.dict.lookup(L.PDFName.of('Subtype')) : null, kind = sub instanceof L.PDFName ? sub.decodeText() : '';
        if (kind === 'Image') out = { image: true };
        else if (kind === 'Form' && depth < 4) {
          var m = st.dict.lookup(L.PDFName.of('Matrix')), mat = m instanceof L.PDFArray ? m.asArray().map(function (v) { return ctx.lookup(v).asNumber(); }) : null;
          var data = st instanceof L.PDFRawStream ? L.decodePDFRawStream(st).decode() : st.getUnencodedContents();
          out = { ops: Lx.lex(latin1(data)), matrix: mat && mat.length === 6 ? mat : null, xobj: xobjects(doc, st.dict.lookup(L.PDFName.of('Resources')), depth + 1) };
        }
      } catch (e) { out = null; }
      return (memo[name] = out);
    };
  }
  /** A target box (user space) for the colour under it: from the descender to above the capitals. */
  function boxOf(t) { var fs = t.fs || 10; return { x0: t.x0, x1: t.x1, y0: t.y - 0.25 * fs, y1: t.y + 0.9 * fs }; }
  /** The bytes of file f with the targets' text removed from page i (null when it cannot be), and the colour the content
   * paints under each target (null where that is not one flat colour). */
  X.derive = async function (f, i, targets) {
    var doc = await load(f.bytes), page = doc.getPage(i), c = contentOf(doc, page), ops = Lx.lex(c.text);
    var r = St.strip(c.text, fontTable(doc, page), targets), xobj = xobjects(doc, page.node.Resources(), 0);
    var paper = targets.map(function (t) { return Fi.under(ops, boxOf(t), r ? r.first : null, xobj); });
    if (!r) return { bytes: null, paper: paper };
    var L = PDFLib, ref = doc.context.register(doc.context.flateStream(bytesOf(r.text)));
    // the old streams leave the file too (unless another page shows them), so the old text is not in it at all
    var others = new Set();
    doc.getPages().forEach(function (pg, k) {
      if (k === i) return;
      var oc = pg.node.Contents(), rs = !oc ? [] : oc instanceof L.PDFArray ? oc.asArray() : [oc];
      rs.forEach(function (x) { others.add(String(x)); });
    });
    page.node.set(L.PDFName.of('Contents'), ref);
    c.refs.forEach(function (x) { if (x instanceof L.PDFRef && !others.has(String(x))) doc.context.delete(x); });
    return { bytes: await doc.save({ useObjectStreams: true }), paper: paper };
  };

  /** pdf.js text items of page i of a file: { s (no white space), x, y, w, fs }. */
  async function items(f, i) {
    var tc = await (await f.doc.getPage(i + 1)).getTextContent();
    return tc.items.filter(function (it) { return typeof it.str === 'string'; }).map(function (it) {
      var t = it.transform;
      return { s: it.str.replace(/\s+/g, ''), x: t[4], y: t[5], w: it.width || 0, fs: Math.hypot(t[2], t[3]) || 10 };
    });
  }
  function overlap(it, t) {
    var tol = Math.max(0.6, 0.2 * (t.fs || it.fs));
    return Math.abs(it.y - t.y) <= tol ? Math.min(it.x + it.w, t.x1) - Math.max(it.x, t.x0) : -1;
  }
  /** The derived page reads as the old one without the targets' text: none left in them, the rest in place. */
  X.verify = async function (f, made, i, targets) {
    var before = await items(f, i), after = await items(made, i);
    // nothing of the old text is left in a target: not a word, and not a lone mark or accent (zero width) either
    var left = after.some(function (it) {
      return it.s && targets.some(function (t) {
        var fs = t.fs || it.fs, dy = it.y - t.y;
        if (dy < -0.3 * fs || dy > 0.6 * fs) return false;
        return Math.min(it.x + it.w, t.x1) - Math.max(it.x, t.x0) > 0.6 * fs || (it.x >= t.x0 && it.x <= t.x1);
      });
    });
    if (left) return false;
    return before.every(function (it) {
      if (!it.s || targets.some(function (t) { return overlap(it, t) > -0.01; })) return true;
      return after.some(function (o) { return o.s === it.s && Math.abs(o.x - it.x) < 0.5 && Math.abs(o.y - it.y) < 0.5; });
    });
  };

  /** The derived file for page i of f without the targets' text, made (and checked) once: { id (null when it cannot be
   * made), paper (the content's colour under each target, when it was read) }. */
  X.build = async function (f, i, targets, id) {
    if (E.files.has(id)) return { id: id, paper: [] };
    var d = await X.derive(f, i, targets);
    if (!d.bytes) return { id: null, paper: d.paper };
    var made = await E.registerPdf(d.bytes, f.name, null, { id: id, color: f.color });
    made.derived = { from: f.id, i: i, targets: targets };
    if (f.ocr) made.ocr = true;
    if (f.security) { made.security = f.security; made.decrypted = true; }
    if (await X.verify(f, made, i, targets).catch(function () { return false; })) return { id: id, paper: d.paper };
    E.files.delete(id);
    made.doc.destroy();
    return { id: null, paper: d.paper };
  };
  function round(t) { return { x0: +t.x0.toFixed(2), x1: +t.x1.toFixed(2), y: +t.y.toFixed(2), fs: +(t.fs || 10).toFixed(2) }; }
  /** Takes the targets' text off page p: { to: the derived file's id (the caller sets the page's f to it in its commit),
   * or null with paper: the content's colour under each target (or null) for the covers the caller makes instead }. */
  X.take = async function (p, targets) {
    var f = E.fileOfPage(p);
    targets = (targets || []).filter(function (t) { return t.x1 > t.x0; }).map(round);
    if (!f || p.blank || f.locked || !targets.length || !window.PDFLib || f.bytes.length > MAX) return { to: null, paper: [] };
    var id = 'd' + hash(f.id + '|' + p.i + '|' + JSON.stringify(targets));
    try {
      var b = await X.build(f, p.i, targets, id);
      return { to: b.id, paper: b.paper };
    } catch (e) {
      console.warn('Slop PDF: the text could not be removed from the page; it is covered instead', e);
      return { to: null, paper: [] };
    }
  };
  /** In a commit: page q (the state's copy) shows the derived file `to` (nothing when to is null). */
  X.use = function (q, to) {
    if (!to) return;
    q.f = to;
    var f = E.files.get(to); if (f) f.used = true;
  };
  /** Lets go of a derived file that no commit used (a paragraph selected and left unchanged). */
  X.release = function (id) {
    var f = id && E.files.get(id);
    if (!f || !f.derived || f.used || E.state.pages.some(function (p) { return p.f === id; })) return;
    E.files.delete(id);
    if (f.doc) f.doc.destroy();
  };
  /** A pdf.js run (edit-text.js) as a target: its whole width on its baseline. */
  X.targetOfRun = function (run, x0, x1) {
    return { x0: x0 == null ? run.x0 : x0, x1: x1 == null ? run.x0 + run.width : x1, y: run.y, fs: run.fs };
  };
  /** The page's operators (for the colour under a box when the screen cannot be read), read once per file page. */
  X.prefetch = function (p) {
    var f = E.fileOfPage(p), key = f && p.f + ':' + p.i;
    if (!f || p.blank || !window.PDFLib || fills.has(key)) return;
    fills.set(key, null);
    load(f.bytes).then(function (doc) {
      var pg = doc.getPage(p.i);
      fills.set(key, { ops: Lx.lex(contentOf(doc, pg).text), xobj: xobjects(doc, pg.node.Resources(), 0) });
    }).catch(function () { /* no colour */ });
  };
  /** The content's colour under a page-space box (annotation space) of page p, or null (not read yet, or not flat). */
  X.contentPaper = function (p, b) {
    var c = p && fills.get(p.f + ':' + p.i);
    if (!c) return null;
    var g = E.geom(p), top = g.y0 + g.H;
    return Fi.under(c.ops, { x0: b.x + g.x0, x1: b.x + b.w + g.x0, y0: top - b.y - b.h, y1: top - b.y }, null, c.xobj);
  };
})();
