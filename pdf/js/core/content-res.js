/* Slop PDF — a page's resources read with pdf-lib for the content readers (core/content-strip.js, content-fills.js,
   content-ink.js): fonts (name → { width(code), codes(str) } or null, by core/content-fonts.js), colour spaces (name → a
   content-ink.js space: ICCBased as its alternate, Indexed with its lookup, Separation / one-ink DeviceN with an
   exponential tint transform; others null) and XObjects (images, and forms with their text, operators, matrix and own
   resources, 12 levels deep, a form never inside itself). Classic script, used by editor/text-strip.js. */
(function () {
  'use strict';
  var R = window.SlopPdfRes = {};
  var Lx = window.SlopPdfLex;

  function latin1(b) {
    var s = '';
    for (var i = 0; i < b.length; i += 8192) s += String.fromCharCode.apply(null, b.subarray(i, i + 8192));
    return s;
  }
  R.latin1 = latin1;
  /** A stream's decoded bytes as a latin1 string. */
  function streamText(s) { var L = PDFLib; return latin1(s instanceof L.PDFRawStream ? L.decodePDFRawStream(s).decode() : s.getUnencodedContents()); }
  R.streamText = streamText;
  /** A page's content streams as the page names them: refs (a stream written into the page dictionary itself, as itself). */
  R.contentRefs = function (page) {
    var L = PDFLib, raw = page.node.get(L.PDFName.of('Contents')), c = page.node.Contents(); // i18n-ignore: PDF names / font names / producer, not UI
    return !c ? [] : c instanceof L.PDFArray ? c.asArray() : [raw instanceof L.PDFRef ? raw : c];
  };
  /** The page's content streams (refs, so the old ones can leave the file) and their decoded text, joined by a newline. */
  R.contentOf = function (doc, page) {
    var refs = R.contentRefs(page);
    return { refs: refs, text: refs.map(function (r) { return streamText(doc.context.lookup(r)); }).join('\n') };
  };

  /* ------------------------------------------------------------ colour spaces */
  function readSpace(ctx, o, named, depth) {
    var L = PDFLib, Ink = window.SlopPdfInk, look = function (x) { return x ? ctx.lookup(x) : null; };
    o = look(o);
    if (!o || depth > 4) return null;
    if (o instanceof L.PDFName) { var n = o.decodeText(); return Ink.BUILTIN[n] || (named ? named(n) : null); }
    if (!(o instanceof L.PDFArray) || !o.size()) return null;
    var kind = look(o.get(0)), k = kind instanceof L.PDFName ? kind.decodeText() : '';
    var num = function (x) { x = look(x); return x instanceof L.PDFNumber ? x.asNumber() : null; };
    var nums = function (x, d) { x = look(x); return x instanceof L.PDFArray ? x.asArray().map(num) : d; };
    if (k === 'CalRGB') return Ink.BUILTIN.DeviceRGB; // i18n-ignore: PDF names / font names / producer, not UI
    if (k === 'CalGray') return Ink.BUILTIN.DeviceGray; // i18n-ignore: PDF names / font names / producer, not UI
    if (k === 'Pattern') return Ink.BUILTIN.Pattern; // i18n-ignore: PDF names / font names / producer, not UI
    if (k === 'ICCBased') {
      var st = look(o.get(1)), alt = st && st.dict ? st.dict.get(L.PDFName.of('Alternate')) : null, cn = st && st.dict ? num(st.dict.get(L.PDFName.of('N'))) : null; // i18n-ignore: PDF names / font names / producer, not UI
      if (alt) return readSpace(ctx, alt, named, depth + 1);
      return cn === 1 ? Ink.BUILTIN.DeviceGray : cn === 3 ? Ink.BUILTIN.DeviceRGB : cn === 4 ? Ink.BUILTIN.DeviceCMYK : null;
    }
    if (k === 'Indexed' || k === 'I') { // i18n-ignore: PDF names / font names / producer, not UI
      var base = readSpace(ctx, o.get(1), named, depth + 1), lk = look(o.get(3)), bytes = null;
      if (lk instanceof L.PDFString || lk instanceof L.PDFHexString) bytes = latin1(lk.asBytes());
      else if (lk && lk.dict) bytes = streamText(lk);
      return base && bytes != null ? { kind: 'indexed', base: base, hival: num(o.get(2)) || 0, lookup: bytes } : null;
    }
    if (k === 'Separation' || k === 'DeviceN') { // i18n-ignore: PDF names / font names / producer, not UI
      var names = look(o.get(1));
      if (k === 'DeviceN' && !(names instanceof L.PDFArray && names.size() === 1)) return null; // i18n-ignore: PDF names / font names / producer, not UI
      var altSp = readSpace(ctx, o.get(2), named, depth + 1), fn = look(o.get(3)), d = fn && fn.dict ? fn.dict : fn;
      if (!altSp || !(d instanceof L.PDFDict) || num(d.get(L.PDFName.of('FunctionType'))) !== 2) return null; // i18n-ignore: PDF names / font names / producer, not UI
      return { kind: 'sep', base: altSp, c0: nums(d.get(L.PDFName.of('C0')), [0]), c1: nums(d.get(L.PDFName.of('C1')), [1]), N: num(d.get(L.PDFName.of('N'))) };
    }
    return null;
  }

  /** The readers of a resource dictionary: { fonts, space, form, xobj, has (an XObject name), dict }. parent: the resources
   * a form without its own uses; path: the forms drawing this one (refs), none of which it may draw again. */
  R.of = function (doc, res, parent, depth, path) {
    var L = PDFLib, ctx = doc.context, dict = function (k) { return res instanceof L.PDFDict ? res.lookup(L.PDFName.of(k)) : null; };
    if (!(res instanceof L.PDFDict) && parent) return parent;
    depth = depth || 0; path = path || [];
    var fd = dict('Font'), cs = dict('ColorSpace'), xd = dict('XObject'), fonts = {}, spaces = {}, xs = {}; // i18n-ignore: PDF names / font names / producer, not UI
    var out = {
      fonts: function (name) {
        if (!(name in fonts)) { var d = fd instanceof L.PDFDict ? fd.lookup(L.PDFName.of(name)) : null; try { fonts[name] = d instanceof L.PDFDict ? window.SlopPdfFonts.read(ctx, d) : null; } catch (e) { fonts[name] = null; } }
        return fonts[name];
      },
      space: function (name) {
        if (!(name in spaces)) { spaces[name] = null; try { spaces[name] = cs instanceof L.PDFDict ? readSpace(ctx, cs.get(L.PDFName.of(name)), out.space, 0) : null; } catch (e) { spaces[name] = null; } }
        return spaces[name];
      },
      /** name → { image: true } or a form { src, ops, matrix, res, xobj, stream, ref } (null when unknown, too deep or
       * drawn inside itself). */
      form: function (name) {
        if (name in xs) return xs[name];
        var raw = xd instanceof L.PDFDict ? xd.get(L.PDFName.of(name)) : null, st = raw ? ctx.lookup(raw) : null, x = null;
        try {
          var sub = st && st.dict ? st.dict.lookup(L.PDFName.of('Subtype')) : null, kind = sub instanceof L.PDFName ? sub.decodeText() : ''; // i18n-ignore: PDF names / font names / producer, not UI
          var ref = raw instanceof L.PDFRef ? String(raw) : null;
          if (kind === 'Image') x = { image: true }; // i18n-ignore: PDF names / font names / producer, not UI
          else if (kind === 'Form' && depth < 12 && (!ref || path.indexOf(ref) < 0)) { // i18n-ignore: PDF names / font names / producer, not UI
            var m = st.dict.lookup(L.PDFName.of('Matrix')), mat = m instanceof L.PDFArray ? m.asArray().map(function (v) { return ctx.lookup(v).asNumber(); }) : null; // i18n-ignore: PDF names / font names / producer, not UI
            var sub2 = R.of(doc, st.dict.lookup(L.PDFName.of('Resources')), out, depth + 1, ref ? path.concat(ref) : path); // i18n-ignore: PDF names / font names / producer, not UI
            var src = streamText(st);
            x = { src: src, ops: Lx.lex(src), matrix: mat && mat.length === 6 ? mat : null, res: sub2, xobj: sub2.form, stream: st, ref: raw instanceof L.PDFRef ? raw : null };
          }
        } catch (e) { x = null; }
        return (xs[name] = x);
      },
      has: function (name) { return xd instanceof L.PDFDict && xd.has(L.PDFName.of(name)); },
      dict: res instanceof L.PDFDict ? res : null
    };
    out.xobj = out.form;
    return out;
  };
})();
