/* Slop Slides: the font registry. Each face is a static TTF in slides/fonts/, loaded once as bytes, registered
   with the browser as its own family ("SSF-<file>") and parsed for metrics. Layout measures with the TTF tables,
   the canvas draws with the same file (kerning off), and the PDF embeds a subset of the same file.
   Families the deck names but we do not ship (Calibri, Arial, Georgia…) are substituted by kind. */
(function () {
  'use strict';
  var SS = window.SS, T = SS.ttf;
  var F = SS.fonts = {};
  F.BASE = new URL('../../fonts/', (document.currentScript && document.currentScript.src) || location.href).href;
  F.FAMILIES = {
    'Inter Tight': { regular: 'InterTight-Regular', bold: 'InterTight-Bold', kind: 'sans' },
    'Archivo': { regular: 'Archivo-Regular', bold: 'Archivo-ExtraBold', kind: 'sans' },
    'Instrument Serif': { regular: 'InstrumentSerif-Regular', italic: 'InstrumentSerif-Italic', kind: 'serif' },
    'JetBrains Mono': { regular: 'JetBrainsMono-Regular', bold: 'JetBrainsMono-SemiBold', kind: 'mono' },
    'Caveat': { regular: 'Caveat-Regular', kind: 'hand' }
  };
  F.LIST = Object.keys(F.FAMILIES);
  var faces = {}, ready = false, loading = null;

  /** Maps any family name to one we ship. */
  F.family = function (name) {
    if (F.FAMILIES[name]) return name;
    var n = String(name || '').toLowerCase();
    if (/mono|courier|consol|code|menlo/.test(n)) return 'JetBrains Mono';
    if (/serif|times|georgia|garamond|baskerville|cambria|palatino|didot|playfair|merriweather|book/.test(n) && !/sans/.test(n)) return 'Instrument Serif';
    if (/hand|script|caveat|comic|marker|brush/.test(n)) return 'Caveat';
    if (/archivo|impact|black|display|oswald|bebas/.test(n)) return 'Archivo';
    return 'Inter Tight';
  };
  /** Resolves family + bold/italic to a face, noting what has to be synthesised. */
  F.face = function (family, bold, italic) {
    var fam = F.FAMILIES[F.family(family)];
    var key = (italic && fam.italic) ? fam.italic : (bold && fam.bold) ? fam.bold : fam.regular;
    return { key: key, css: 'SSF-' + key, font: faces[key] && faces[key].font, synthItalic: !!italic && !(fam.italic && key === fam.italic), synthBold: !!bold && !fam.bold };
  };
  F.isReady = function () { return ready; };

  /** Loads every face. `src(key)` may supply bytes (the offline build does); otherwise they are fetched. */
  F.load = function (src) {
    if (loading) return loading;
    var keys = [];
    F.LIST.forEach(function (f) { var d = F.FAMILIES[f]; [d.regular, d.bold, d.italic].forEach(function (k) { if (k && keys.indexOf(k) < 0) keys.push(k); }); });
    loading = Promise.all(keys.map(function (k) {
      var p = src && src(k) ? Promise.resolve(src(k)) : fetch(F.BASE + k + '.ttf').then(function (r) { if (!r.ok) throw new Error('Font ' + k + ' ' + r.status); return r.arrayBuffer(); }).then(function (b) { return new Uint8Array(b); });
      return p.then(function (u8) {
        var font = T.parse(u8);
        faces[k] = { key: k, u8: u8, font: font };
        var ff = new FontFace('SSF-' + k, u8.slice().buffer);
        document.fonts.add(ff);
        return ff.load().catch(function () { /* metrics still work */ });
      });
    })).then(function () { ready = true; });
    return loading;
  };
  F.bytes = function (key) { return faces[key] && faces[key].u8; };
  F.parsed = function (key) { return faces[key] && faces[key].font; };

  var mctx = null;
  function fallbackWidth(ch, size) {
    if (!mctx) mctx = document.createElement('canvas').getContext('2d');
    mctx.font = '100px sans-serif';
    return mctx.measureText(ch).width * size / 100;
  }
  /** Width in points of `s` at `size` pt in the given face (from F.face). Unknown glyphs use a system font. */
  F.measure = function (face, s, size, letterSpacing) {
    var f = face.font || F.parsed(face.key), w = 0, ls = letterSpacing || 0;
    if (!f) return fallbackWidth(s, size);
    for (var i = 0; i < s.length; i++) {
      var cp = s.codePointAt(i), ch = String.fromCodePoint(cp); if (cp > 0xFFFF) i++;
      var g = f.cmap.get(cp);
      w += (g ? f.adv[g] * size / f.upm : fallbackWidth(ch, size)) + ls;
    }
    return w;
  };
  /** Vertical metrics in points for a face at size: ascent, descent (positive), cap height. */
  F.vmetrics = function (face, size) {
    var f = face.font || F.parsed(face.key);
    if (!f) return { ascent: size * 0.92, descent: size * 0.24, cap: size * 0.7 };
    return { ascent: f.ascent * size / f.upm, descent: -f.descent * size / f.upm, cap: f.capHeight * size / f.upm };
  };
  /** CSS font string for canvas. Sizes are in canvas units (the caller scales the context). */
  F.css = function (face, size) { return size + 'px "' + face.css + '", sans-serif'; };
})();
