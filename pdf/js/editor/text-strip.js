/* Slop PDF — taking old text off a page, the one path for Edit text (Lines and Paragraphs) and Remove. The text is removed
   from the page's own content stream (core/content-strip.js), so nothing is painted over it: it no longer shows, prints,
   is found by search or copied. The page then points at a derived copy of its file ({ derived: { from, i, targets } },
   an id made from those, so the edit log can make it again on replay, io/edit-log.js); undo points it back. The copy is
   checked with pdf.js before it is used: the text in the targets is gone and every other text item is where it was.
   Text in a Form XObject is taken out of a copy of the form that only this page draws (core/content-forms.js). When it
   cannot be done (clipping or invisible text, a font that cannot be measured: vertical writing, a predefined CMap the
   build does not have; an unreadable or very large file) the caller covers the text instead, in the colour under it: the
   rendered page's (edit-colours.js), or, when the page cannot be read back, the colour the content paints there
   (core/content-fills.js). Classic script. */
(function () {
  'use strict';
  var SP = window.SP, E = SP.engine, Ed = SP.editor, S = Ed._, Lx = window.SlopPdfLex, St = window.SlopPdfStrip, Fi = window.SlopPdfFills;
  var Ink = window.SlopPdfInk, Res = window.SlopPdfRes, contentOf = Res.contentOf, Fonts = window.SlopPdfFonts, Forms = window.SlopPdfForms;
  var X = S.strip = {};
  var MAX = 80e6; // bytes: a bigger file is covered, not copied for each edit
  var fills = new Map(); // file id:page → Promise of the page's operators (for the colour under a box)

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
  /** A target box (user space) for the colour under it: from the descender to above the capitals. */
  function boxOf(t) { var fs = t.fs || 10; return { x0: t.x0, x1: t.x1, y0: t.y - 0.25 * fs, y1: t.y + 0.9 * fs }; }
  /** The bytes of file f with the targets' text removed from page i (null when it cannot be), and the colour the content
   * paints under each target (null where that is not one flat colour). */
  X.derive = async function (f, i, targets) {
    var doc = await load(f.bytes), page = doc.getPage(i), c = contentOf(doc, page), ops = Lx.lex(c.text);
    await Fonts.ready(doc, page.node.Resources()); // the predefined CMaps its fonts use
    var res = Res.of(doc, page.node.Resources()), r = St.strip(c.text, res.fonts, targets, res), xobj = res.xobj;
    var paper = targets.map(function (t) { return Fi.under(ops, boxOf(t), r ? r.first : null, xobj); });
    if (!r) return { bytes: null, paper: paper };
    Forms.put(doc, page, r);
    X.putContent(doc, i, c.refs, r.text);
    return { bytes: await doc.save({ useObjectStreams: true }), paper: paper };
  };
  X.load = load;
  /** Page i of doc shows the content text from now on; its old streams leave the file (core/content-forms.js). */
  X.putContent = Forms.contents;

  /** pdf.js text items of page i of a file: { s (no white space), x, y, w, fs, cx (the centre of its first glyph that is
   * not a space, by the item's mean advance) }. */
  async function items(f, i) {
    var tc = await (await f.doc.getPage(i + 1)).getTextContent();
    return tc.items.filter(function (it) { return typeof it.str === 'string'; }).map(function (it) {
      var t = it.transform, w = it.width || 0, n = Math.max(1, it.str.length), lead = it.str.length - it.str.replace(/^\s+/, '').length;
      return { s: it.str.replace(/\s+/g, ''), x: t[4], y: t[5], w: w, fs: Math.hypot(t[2], t[3]) || 10, cx: t[4] + (lead + 0.5) * w / n };
    });
  }
  function overlap(it, t) {
    var tol = Math.max(0.6, 0.2 * (t.fs || it.fs));
    return Math.abs(it.y - t.y) <= tol ? Math.min(it.x + it.w, t.x1) - Math.max(it.x, t.x0) : -1;
  }
  /** Whether an item of the derived page shows text in target t: it covers more of it than a gap left where the text went
   * (a run across the target, whose text pdf.js joins over the gap), or its first glyph's centre is in it (a lone mark or
   * accent has no width); text that only starts where the target ends, or a hair before (kerning), is not in it. */
  function inside(it, t) {
    var fs = t.fs || it.fs, dy = it.y - t.y;
    if (!it.s || dy < -0.3 * fs || dy > 0.6 * fs) return false;
    return Math.min(it.x + it.w, t.x1) - Math.max(it.x, t.x0) > 0.6 * fs || (it.cx > t.x0 + 0.01 && it.cx < t.x1 - 0.01);
  }
  /** The derived page reads as the old one without the targets' text: none left in them, the rest in place. */
  X.verify = async function (f, made, i, targets) {
    var before = await items(f, i), after = await items(made, i);
    if (after.some(function (it) { return targets.some(function (t) { return inside(it, t); }); })) return false;
    // a target that held a letter lost one: the items over it have fewer than before (text too narrow for the check above)
    var letters = function (list, t) { return list.reduce(function (n, it) { return n + (overlap(it, t) > -0.01 ? it.s.length : 0); }, 0); };
    var held = function (t) { return before.reduce(function (n, it) { var o = overlap(it, t); return n + (o > 0 && it.w > 0 ? it.s.length * Math.min(1, o / it.w) : 0); }, 0); };
    if (targets.some(function (t) { return held(t) >= 1 && letters(after, t) >= letters(before, t); })) return false;
    // every other item is where it was; one that pdf.js now joins to the text before or after the gap starts or ends it
    return before.every(function (it) {
      if (!it.s || targets.some(function (t) { return overlap(it, t) > -0.01; })) return true;
      return after.some(function (o) {
        if (Math.abs(o.y - it.y) >= 0.5 || o.s.indexOf(it.s) < 0) return false;
        return (Math.abs(o.x - it.x) < 0.5 && o.s.indexOf(it.s) === 0) || (Math.abs(o.x + o.w - it.x - it.w) < 0.5 && o.s.slice(-it.s.length) === it.s);
      });
    });
  };

  /** The derived file for page i of f without the targets' text, made (and checked) once: { id (null when it cannot be
   * made), paper (the content's colour under each target, when it was read) }. edit: an object or layer edit instead of
   * targets (editor/obj-derive.js, io/ocg.js: X.kinds[edit.op] makes and checks it), the same path for every page edit. */
  X.build = async function (f, i, targets, id, edit) {
    if (E.files.has(id)) return { id: id, paper: [] };
    var kind = edit ? X.kinds[edit.kind || 'obj'] : null;
    if (edit && !kind) return { id: null, paper: [] };
    var d = edit ? { bytes: await kind.derive(f, i, edit), paper: [] } : await X.derive(f, i, targets);
    if (!d.bytes) return { id: null, paper: d.paper };
    var made = await E.registerPdf(d.bytes, f.name, null, { id: id, color: f.color });
    made.derived = edit ? { from: f.id, i: i, targets: null, edit: edit } : { from: f.id, i: i, targets: targets };
    if (f.ocr) made.ocr = true;
    if (f.fontMap) made.fontMap = f.fontMap;
    if (f.security) { made.security = f.security; made.decrypted = true; }
    var ok = edit ? kind.verify(f, made, i, edit) : X.verify(f, made, i, targets);
    if (await Promise.resolve(ok).catch(function () { return false; })) return { id: id, paper: d.paper };
    E.files.delete(id);
    made.doc.destroy();
    return { id: null, paper: d.paper };
  };
  /** The derived-file makers for edits other than taking text off: { derive(f, i, edit) → bytes | null, verify(f, made, i, edit) }. */
  X.kinds = {};
  /** A derived copy of page p's file with an edit made (an object moved, a layer deleted …): { to: its id, or null }. */
  X.edit = async function (p, edit) {
    var f = E.fileOfPage(p);
    if (!f || p.blank || f.locked || !window.PDFLib || f.bytes.length > MAX) return { to: null };
    var i = edit.page === false ? -1 : p.i, id = 'd' + hash(f.id + '|' + i + '|' + JSON.stringify(edit));
    try { return { to: (await X.build(f, i, null, id, edit)).id }; } catch (e) {
      console.warn('Slop PDF: the page could not be changed', e);
      return { to: null, error: e };
    }
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
  /** The page's operators and resources (for the colours of its text, and of the paper under a box when the screen cannot
   * be read), read once per file page: a Promise (null when the page has no content to read). */
  X.prefetch = function (p) {
    var f = E.fileOfPage(p), key = f && p.f + ':' + p.i;
    if (!f || p.blank || !window.PDFLib) return Promise.resolve(null);
    if (!fills.has(key)) {
      var pr = load(f.bytes).then(function (doc) {
        var pg = doc.getPage(p.i);
        return Fonts.ready(doc, pg.node.Resources()).then(function () { return { doc: doc, pg: pg }; });
      }).then(function (d) {
        var doc = d.doc, pg = d.pg, c = { ops: Lx.lex(contentOf(doc, pg).text), res: Res.of(doc, pg.node.Resources()) };
        pr.value = c;
        return c;
      }).catch(function () { return null; });
      fills.set(key, pr);
    }
    return fills.get(key);
  };
  /** Resolves once page p's content is read (X.prefetch), so the readers below have it. */
  X.ready = function (p) { return X.prefetch(p).then(function () { return true; }); };
  function cached(p) { var pr = p && fills.get(p.f + ':' + p.i); return pr ? pr.value || null : null; }
  /** The content's colour under a page-space box (annotation space) of page p, or null (not read yet, or not flat). */
  X.contentPaper = function (p, b) {
    var c = cached(p);
    if (!c) return null;
    var g = E.geom(p), top = g.y0 + g.H;
    return Fi.under(c.ops, { x0: b.x + g.x0, x1: b.x + b.w + g.x0, y0: top - b.y - b.h, y1: top - b.y }, null, c.res.xobj);
  };
  /** The colour the content paints the text of the targets (user space) in, [r, g, b] in 0..1, or null (core/content-ink.js). */
  X.contentInk = function (p, targets) {
    var c = cached(p);
    try { return c ? Ink.ink(c.ops, c.res, targets) : null; } catch (e) { return null; }
  };
})();
