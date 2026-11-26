/* Slop PDF — CMaps: how the codes of a composite (Type 0) font's strings split, and which CID each code is. Pure (no DOM),
   tested alone in Node (tests/node/pdf-content-cmap.test.mjs). Read the way pdf.js reads them, since pdf.js draws the page.
     parse(text) → the CMap of an embedded CMap stream (its text, latin1, read with content-lex.js): codespace ranges,
       cidrange and cidchar, WMode and usecmap (the name of the CMap it extends, in use); bfchar and bfrange are not read.
     binary(bytes) → a predefined CMap from pdf.js's packed form (vendor/pdfjs/cmaps/*.bcmap: its BinaryCMapReader), or
       null when the data does not read.
     extend(cmap, base) → cmap with base's codespace ranges when it has none, and base's CIDs for the codes it lacks.
     identity(vertical) → Identity-H (or -V): two-byte codes, each its own CID.
     codes(cmap, str) → [{ c, b }]: the codes of a string (1 to 4 bytes each, by the codespace ranges; a byte that starts
       none is a one-byte code 0, as pdf.js reads it).
     cid(cmap, code) → its CID (the code itself when the CMap maps it to none: pdf.js measures it so).
   A CMap: { spaces: [[lo, hi, …] for 1, 2, 3 and 4 bytes], map: Map code → CID, vertical, use }. */
(function (root, factory) {
  var api = factory(root.SlopPdfLex || (typeof require === 'function' ? require('./content-lex.js') : null));
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.SlopPdfCMap = api;
})(typeof window !== 'undefined' ? window : globalThis, function (Lx) {
  'use strict';
  var MAX_RANGE = 1 << 20; // codes one range may map (pdf.js allows more; a CMap needs far fewer)
  function make() { return { spaces: [[], [], [], []], map: new Map(), vertical: false, use: null }; }
  function int(s) { var n = 0; for (var i = 0; i < s.length; i++) n = n * 256 + s.charCodeAt(i); return n; }
  function range(cm, lo, hi, cid) {
    if (!(hi >= lo) || hi - lo > MAX_RANGE) return;
    for (var c = lo; c <= hi; c++) cm.map.set(c, cid + c - lo);
  }

  function parse(text) {
    var cm = make();
    Lx.lex(text).forEach(function (o) {
      var a = o.args, i;
      switch (o.op) {
        case 'endcodespacerange':
          for (i = 0; i + 1 < a.length; i += 2) {
            if (!a[i] || a[i].str == null || !a[i + 1] || a[i + 1].str == null) break;
            var n = a[i + 1].str.length;
            if (n >= 1 && n <= 4) cm.spaces[n - 1].push(int(a[i].str), int(a[i + 1].str));
          }
          break;
        case 'endcidrange':
          for (i = 0; i + 2 < a.length; i += 3) if (a[i].str != null && a[i + 1].str != null && typeof a[i + 2] === 'number') range(cm, int(a[i].str), int(a[i + 1].str), a[i + 2]);
          break;
        case 'endcidchar':
          for (i = 0; i + 1 < a.length; i += 2) if (a[i].str != null && typeof a[i + 1] === 'number') cm.map.set(int(a[i].str), a[i + 1]);
          break;
        case 'usecmap': if (a.length && a[a.length - 1].name != null) cm.use = a[a.length - 1].name; break;
        case 'def': if (a.length >= 2 && a[a.length - 2].name === 'WMode' && typeof a[a.length - 1] === 'number') cm.vertical = a[a.length - 1] === 1; break;
      }
    });
    return cm;
  }

  /* ------------------------------------------------------------ pdf.js's packed CMaps */
  function reader(b) {
    var pos = 0, tmp = new Uint8Array(19);
    function byte() { return pos < b.length ? b[pos++] : -1; }
    function eof() { throw new Error('bcmap'); }
    var r = {
      byte: byte,
      num: function () { var n = 0, x; do { if ((x = byte()) < 0) eof(); n = (n << 7) | (x & 127); } while (x & 128); return n; },
      signed: function () { var n = r.num(); return n & 1 ? ~(n >>> 1) : n >>> 1; },
      hex: function (num, size) { if (pos + size + 1 > b.length) eof(); num.set(b.subarray(pos, pos + size + 1)); pos += size + 1; },
      hexNum: function (num, size) {
        var sp = 0, x;
        do { if ((x = byte()) < 0) eof(); tmp[sp++] = x & 127; } while (x & 128);
        for (var i = size, buf = 0, bits = 0; i >= 0; i--) {
          while (bits < 8) { buf |= (sp > 0 ? tmp[--sp] : 0) << bits; bits += 7; }
          num[i] = buf & 255; buf >>= 8; bits -= 8;
        }
      },
      str: function () { var n = r.num(), s = ''; for (var i = 0; i < n; i++) s += String.fromCharCode(r.num()); return s; }
    };
    return r;
  }
  function toInt(a, size) { var n = 0; for (var i = 0; i <= size; i++) n = (n << 8) | a[i]; return n >>> 0; }
  function addHex(a, b, size) { for (var i = size, c = 0; i >= 0; i--) { c += a[i] + b[i]; a[i] = c & 255; c >>= 8; } }
  function incHex(a, size) { for (var i = size, c = 1; i >= 0 && c > 0; i--) { c += a[i]; a[i] = c & 255; c >>= 8; } }

  function binary(bytes) {
    try {
      var r = reader(bytes), cm = make(), x, start = new Uint8Array(16), end = new Uint8Array(16), ch = new Uint8Array(16), tmp = new Uint8Array(16);
      var head = r.byte();
      if (head < 0) return null;
      cm.vertical = !!(head & 1);
      while ((x = r.byte()) >= 0) {
        var type = x >> 5;
        if (type === 7) { var s = r.str(); if ((x & 31) === 1) cm.use = s; continue; }
        var seq = !!(x & 16), size = x & 15, count = r.num(), i, code;
        if (size > 3) return null;
        if (type === 0 || type === 1 || type === 3) {
          // codespacerange, notdefrange (skipped), cidrange: ranges, each after the last
          r.hex(start, size); r.hexNum(end, size); addHex(end, start, size);
          if (type === 0) cm.spaces[size].push(toInt(start, size), toInt(end, size)); else { code = r.num(); if (type === 3) range(cm, toInt(start, size), toInt(end, size), code); }
          for (i = 1; i < count; i++) {
            incHex(end, size);
            if (type === 3 && seq) start.set(end); else { r.hexNum(start, size); addHex(start, end, size); }
            r.hexNum(end, size); addHex(end, start, size);
            if (type === 0) cm.spaces[size].push(toInt(start, size), toInt(end, size)); else { code = r.num(); if (type === 3) range(cm, toInt(start, size), toInt(end, size), code); }
          }
        } else if (type === 2) { // cidchar
          r.hex(ch, size); code = r.num(); cm.map.set(toInt(ch, size), code);
          for (i = 1; i < count; i++) {
            incHex(ch, size);
            if (!seq) { r.hexNum(tmp, size); addHex(ch, tmp, size); }
            code = r.signed() + (code + 1);
            cm.map.set(toInt(ch, size), code);
          }
        } else return null; // bfchar / bfrange: a ToUnicode map, not a CID one
      }
      return cm;
    } catch (e) { return null; }
  }

  function extend(cm, base) {
    if (!base) return cm;
    if (cm.spaces.every(function (s) { return !s.length; })) cm.spaces = base.spaces.map(function (s) { return s.slice(); });
    if (base.map) base.map.forEach(function (cid, code) { if (!cm.map.has(code)) cm.map.set(code, cid); });
    return cm;
  }
  function identity(vertical) { return { spaces: [[], [0, 65535], [], []], map: null, identity: true, vertical: !!vertical, use: null }; }

  function codes(cm, str) {
    var out = [], sp = cm.spaces;
    for (var i = 0; i < str.length;) {
      var c = 0, len = 0;
      for (var n = 0; n < sp.length && !len; n++) {
        c = ((c << 8) | str.charCodeAt(i + n)) >>> 0; // past the end of the string: a zero byte, as in pdf.js
        for (var j = 0; j + 1 < sp[n].length; j += 2) if (c >= sp[n][j] && c <= sp[n][j + 1]) { len = n + 1; break; }
      }
      if (!len) { c = 0; len = 1; }
      out.push({ c: c, b: str.substr(i, len) });
      i += len;
    }
    return out;
  }
  function cid(cm, code) { return cm.identity || !cm.map.has(code) ? code : cm.map.get(code); }

  return { parse: parse, binary: binary, extend: extend, identity: identity, codes: codes, cid: cid };
});
