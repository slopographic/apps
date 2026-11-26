/* Slop PDF — how far each glyph of a font moves the pen, read with pdf-lib for the content readers (core/content-glyphs.js),
   the way pdf.js measures it (pdf.js draws the page, and editor/text-strip.js checks its work with it).
     read(ctx, dict) → { width(code) (1/1000 em of text space; null: unknown), codes(str) (composite fonts) } or null:
       simple fonts: Widths from FirstChar (MissingWidth outside them). With no Widths (allowed only for the standard 14,
         but older files leave them out for others too), pdf.js measures by the standard font of the name (Arial is
         Helvetica, Times New Roman Times, …; another name is Times-Roman when it reads as a serif face, else Helvetica),
         each code by its glyph name in the font's encoding: WinAnsi and Differences (another base encoding: only the codes
         it shares with WinAnsi), so those fonts are measured so too, not by their font program.
       Type3: Widths in glyph space, through the FontMatrix to text space.
       Type0: W and DW of its CIDFont by CID, the codes (1 to 4 bytes) and their CIDs by its CMap (core/content-cmap.js):
         Identity-H, an embedded CMap stream (with its UseCMap), or a predefined CMap from vendor/pdfjs/cmaps, which
         ready() fetches first. Vertical writing (WMode 1, Identity-V, …-V) is not measured: the text stays covered.
     ready(doc, res) → Promise: the predefined CMaps that the fonts of resources res (and of the forms in them) use, loaded.
   Classic script, used by core/content-res.js. */
(function () {
  'use strict';
  var F = window.SlopPdfFonts = {}, CM = window.SlopPdfCMap;
  var cmaps = new Map(); // a predefined CMap's name → Promise of it (its usecmap applied; null when it cannot be had)
  // the first word of a name that pdf.js takes for a serif face (fonts.js getSerifFonts, the one-word names), or "serif"
  var SERIF = /^(Albertus|Aldus|Alexandria|Algerian|Antiqua|Apex|Arno|Aster|Aurora|Baskerville|Bell|Bembo|Benguiat|Bodoni|Bookman|Calisto|Calvert|Capitals|Cambria|Cartier|Caslon|Catull|Centaur|Chaparral|Cheltenham|Clarendon|Clearface|Cochin|Colonna|Constantia|Corona|Ecotype|Egyptienne|Elephant|Excelsior|Fairfield|Folkard|Footlight|FreeSerif|Garamond|Gentium|Georgia|Gloucester|Granjon|Heather|Hercules|Hiroshige|Imprint|Janson|Joanna|Korinna|Lexicon|LiberationSerif|Literaturnaya|Lucida|Melior|Memphis|Miller|Minion|Modern|Palatino|Perpetua|Plantin|Playbill|Renault|Requiem|Rockwell|Roman|Sabon|Scala|Seagull|Sistina|Souvenir|STIX|Sylfaen|Times|Trajan|Utopia|Versailles|Wanted|Weiss|Windsor|XITS)$|serif/i;
  var FAMILY = /^(Arial(?:MT|UnicodeMS)?|Helvetica|CourierNew(?:PS)?(?:MT)?|Courier|TimesNewRoman(?:PS)?(?:MT)?|Times|Symbol)(?:-(.*))?$/;
  var winAnsi = null;

  function helpers(ctx) {
    var L = PDFLib, look = function (o) { return o ? ctx.lookup(o) : null; };
    return {
      N: function (k) { return L.PDFName.of(k); }, look: look,
      val: function (o) { o = look(o); return o instanceof L.PDFNumber ? o.asNumber() : null; },
      nm: function (o) { o = look(o); return o instanceof L.PDFName ? o.decodeText() : null; }
    };
  }
  /** The standard font pdf.js measures a font without Widths by (fonts.js getBaseFontMetrics). */
  function stdOf(base) {
    var n = String(base || '').replace(/[,_]/g, '-').replace(/\s/g, ''), m = FAMILY.exec(n);
    if (Object.values(PDFLib.StandardFonts).indexOf(n) >= 0) return n;
    if (!m) return SERIF.test(n.split('-')[0]) ? 'Times-Roman' : 'Helvetica'; // i18n-ignore: PDF names / font names / producer, not UI
    var st = m[2] || '', b = /Bold/.test(st), it = /Italic|Oblique/.test(st), fam = /^Times/.test(m[1]) ? 'Times' : /^Courier/.test(m[1]) ? 'Courier' : /^Symbol/.test(m[1]) ? 'Symbol' : 'Helvetica'; // i18n-ignore: PDF names / font names / producer, not UI
    if (fam === 'Symbol') return fam; // i18n-ignore: PDF names / font names / producer, not UI
    if (fam === 'Times') return 'Times-' + (b && it ? 'BoldItalic' : b ? 'Bold' : it ? 'Italic' : 'Roman'); // i18n-ignore: PDF names / font names / producer, not UI
    return fam + (b && it ? '-BoldOblique' : b ? '-Bold' : it ? '-Oblique' : '');
  }
  /** code → glyph name of a pdf-lib standard encoding. */
  function table(enc) {
    var names = [];
    enc.supportedCodePoints.forEach(function (cp) { var e = enc.encodeUnicodeCodePoint(cp); if (names[e.code] == null) names[e.code] = e.name; });
    return names;
  }
  /** A simple font with no Widths, measured as pdf.js does (see the header). */
  function noWidths(ctx, d, sub) {
    var h = helpers(ctx), std = stdOf(h.nm(d.get(h.N('BaseFont')))), em = PDFLib.StandardFontEmbedder.for(std); // i18n-ignore: PDF names / font names / producer, not UI
    if (/^Courier/.test(std)) return { width: function () { return 600; } }; // pdf.js: one width for every code
    var enc = h.look(d.get(h.N('Encoding'))), dict = enc instanceof PDFLib.PDFDict ? enc : null; // i18n-ignore: PDF names / font names / producer, not UI
    var base = dict ? h.nm(dict.get(h.N('BaseEncoding'))) : h.nm(enc), names, all = true; // i18n-ignore: PDF names / font names / producer, not UI
    if (std === 'Symbol' || std === 'ZapfDingbats') names = base ? [] : table(em.encoding); // i18n-ignore: PDF names / font names / producer, not UI
    else {
      names = (winAnsi = winAnsi || table(PDFLib.StandardFontEmbedder.for('Helvetica').encoding)).slice(); // i18n-ignore: PDF names / font names / producer, not UI
      // StandardEncoding, MacRoman …: only the codes they share with WinAnsi
      if (base ? base !== 'WinAnsiEncoding' : sub !== 'TrueType') { // i18n-ignore: PDF names / font names / producer, not UI
        all = false;
        if (base !== 'MacRomanEncoding') { names[39] = 'quoteright'; names[96] = 'quoteleft'; } // i18n-ignore: PDF names / font names / producer, not UI
      }
    }
    var diff = dict ? h.look(dict.get(h.N('Differences'))) : null, set = new Set(); // i18n-ignore: PDF names / font names / producer, not UI
    if (diff instanceof PDFLib.PDFArray) {
      var c = 0;
      diff.asArray().forEach(function (v) { v = h.look(v); if (v instanceof PDFLib.PDFNumber) c = v.asNumber(); else if (v instanceof PDFLib.PDFName) { names[c] = v.decodeText(); set.add(c++); } });
    }
    return { width: function (code) {
      if (!all && !set.has(code) && (code < 32 || code > 126)) return null;
      return (names[code] && em.font.getWidthOfGlyph(names[code])) || 0;
    } };
  }
  /** Widths from FirstChar, MissingWidth outside them: code → width, or null when the font has no Widths. */
  function widthsOf(ctx, d) {
    var h = helpers(ctx), widths = h.look(d.get(h.N('Widths'))), first = h.val(d.get(h.N('FirstChar'))); // i18n-ignore: PDF names / font names / producer, not UI
    if (!(widths instanceof PDFLib.PDFArray) || first == null) return null;
    var ws = widths.asArray().map(function (v) { return h.val(v) || 0; }), fd = h.look(d.get(h.N('FontDescriptor'))); // i18n-ignore: PDF names / font names / producer, not UI
    var miss = fd instanceof PDFLib.PDFDict ? h.val(fd.get(h.N('MissingWidth'))) || 0 : 0; // i18n-ignore: PDF names / font names / producer, not UI
    return function (c) { var k = c - first; return k >= 0 && k < ws.length ? ws[k] : miss; };
  }
  /** The CMap a Type 0 font's Encoding names (null: not one this reads, or a predefined one not loaded). */
  function cmapOf(ctx, enc, depth) {
    var L = PDFLib, h = helpers(ctx);
    enc = h.look(enc);
    if (enc instanceof L.PDFName) {
      var n = enc.decodeText();
      return n === 'Identity-H' ? CM.identity(false) : n === 'Identity-V' ? CM.identity(true) : cmaps.has(n) ? cmaps.get(n).value || null : null; // i18n-ignore: PDF names / font names / producer, not UI
    }
    if (!enc || !enc.dict || depth > 4) return null;
    var cm = CM.parse(window.SlopPdfRes.streamText(enc)), use = enc.dict.get(h.N('UseCMap')); // i18n-ignore: PDF names / font names / producer, not UI
    if (!use && cm.use) use = h.N(cm.use);
    if (!use) return cm;
    var base = cmapOf(ctx, use, depth + 1);
    return base ? CM.extend(cm, base) : null;
  }
  F.read = function (ctx, d) {
    var L = PDFLib, h = helpers(ctx), sub = h.nm(d.get(h.N('Subtype'))); // i18n-ignore: PDF names / font names / producer, not UI
    if (sub === 'Type0') { // i18n-ignore: PDF names / font names / producer, not UI
      var kids = h.look(d.get(h.N('DescendantFonts'))), cid = kids instanceof L.PDFArray ? h.look(kids.get(0)) : null; // i18n-ignore: PDF names / font names / producer, not UI
      var cm = cmapOf(ctx, d.get(h.N('Encoding')), 0); // i18n-ignore: PDF names / font names / producer, not UI
      if (!(cid instanceof L.PDFDict) || !cm || cm.vertical) return null;
      var dw = h.val(cid.get(h.N('DW'))), w = h.look(cid.get(h.N('W'))), map = new Map();
      if (dw == null) dw = 1000;
      if (w instanceof L.PDFArray) {
        var a = w.asArray(), i = 0;
        while (i < a.length) {
          var c0 = h.val(a[i]), nx = h.look(a[i + 1]);
          if (c0 == null) break;
          if (nx instanceof L.PDFArray) { nx.asArray().forEach(function (v, j) { if (h.val(v) != null) map.set(c0 + j, h.val(v)); }); i += 2; }
          else { var c1 = h.val(a[i + 1]), wv = h.val(a[i + 2]); for (var c = c0; wv != null && c <= c1 && c - c0 < 65536; c++) map.set(c, wv); i += 3; }
        }
      }
      return { codes: function (s) { return CM.codes(cm, s); }, width: function (code) { var id = CM.cid(cm, code); return map.has(id) ? map.get(id) : dw; } };
    }
    var ws = widthsOf(ctx, d);
    if (sub === 'Type3') { // i18n-ignore: PDF names / font names / producer, not UI
      var fm = h.look(d.get(h.N('FontMatrix'))), sx = fm instanceof L.PDFArray ? h.val(fm.get(0)) : null; // i18n-ignore: PDF names / font names / producer, not UI
      return ws && sx ? { width: function (code) { return ws(code) * sx * 1000; } } : null;
    }
    return ws ? { width: ws } : noWidths(ctx, d, sub);
  };

  /** The names of the predefined CMaps the Type 0 fonts of resources res and of its forms use (a few levels deep). */
  function needs(ctx, res, out, depth, seen) {
    var L = PDFLib, h = helpers(ctx);
    res = h.look(res);
    if (!(res instanceof L.PDFDict) || depth > 12) return;
    var fd = h.look(res.get(h.N('Font'))), xd = h.look(res.get(h.N('XObject'))); // i18n-ignore: PDF names / font names / producer, not UI
    if (fd instanceof L.PDFDict) fd.values().forEach(function (f) { // compat-ok: pdf-lib's PDFDict.values() is an array
      f = h.look(f);
      if (!(f instanceof L.PDFDict) || h.nm(f.get(h.N('Subtype'))) !== 'Type0') return; // i18n-ignore: PDF names / font names / producer, not UI
      var enc = h.look(f.get(h.N('Encoding'))); // i18n-ignore: PDF names / font names / producer, not UI
      for (var k = 0; k < 4 && enc; k++) {
        if (enc instanceof L.PDFName) { if (!/^Identity-[HV]$/.test(enc.decodeText())) out.add(enc.decodeText()); break; }
        if (!enc.dict) break;
        var use = h.look(enc.dict.get(h.N('UseCMap'))); // i18n-ignore: PDF names / font names / producer, not UI
        if (!use) { var t = CM.parse(window.SlopPdfRes.streamText(enc)).use; use = t ? h.N(t) : null; }
        enc = use;
      }
    });
    if (xd instanceof L.PDFDict) xd.values().forEach(function (r) { // compat-ok: an array (pdf-lib)
      var st = h.look(r), key = String(r);
      if (!st || !st.dict || seen.has(key) || h.nm(st.dict.get(h.N('Subtype'))) !== 'Form') return; // i18n-ignore: PDF names / font names / producer, not UI
      seen.add(key);
      needs(ctx, st.dict.get(h.N('Resources')), out, depth + 1, seen); // i18n-ignore: PDF names / font names / producer, not UI
    });
  }
  /** A predefined CMap fetched and read (its usecmap too), once: a Promise. */
  function load(name, depth) {
    if (!cmaps.has(name)) {
      var E = window.SP && SP.engine, pr = !E || SP.offline || !/^[\w.+-]+$/.test(name) || (depth || 0) > 4 ? Promise.resolve(null)
        : fetch(E.vendorBase() + 'cmaps/' + name + '.bcmap').then(function (r) { return r.ok ? r.arrayBuffer() : null; }).then(function (buf) {
          var cm = buf ? CM.binary(new Uint8Array(buf)) : null;
          return cm && cm.use ? load(cm.use, (depth || 0) + 1).then(function (base) { return base ? CM.extend(cm, base) : null; }) : cm;
        }).catch(function () { return null; });
      pr.then(function (cm) { pr.value = cm; });
      cmaps.set(name, pr);
    }
    return cmaps.get(name);
  }
  F.ready = function (doc, res) {
    var names = new Set();
    try { needs(doc.context, res, names, 0, new Set()); } catch (e) { return Promise.resolve(); }
    return Promise.all(Array.from(names).map(function (n) { return load(n); })).then(function () {});
  };
})();
