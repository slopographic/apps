/* Slop PDF — where a content stream puts its glyphs. Pure (no DOM), tested alone in Node (tests/node/pdf-content-strip.test.mjs,
   pdf-content-forms.test.mjs). Works on the operators of content-lex.js; content-strip.js takes text out with it.
     walk(ops, fonts, show, opts) follows the text and graphics state and calls show for each string a text operator shows.
     glyphs(ops, fonts, opts) → every glyph the stream shows with a known place: { k (operator index), si (string index in
       the operator), at (code index in the string), code, x, y (its origin, PDF user space), w (its advance, user space),
       cx (its centre), up (upright), tr (render mode), fs }. A glyph is upright when its baseline runs left to right and it
       stands on it: a slanted line (a synthetic italic) is, a turned or mirrored one is not.
     fonts(name) → { width(code) → 1/1000 em of text space (null: unknown), codes(str) → [{ c, b }] (the string split into
       codes; when missing, one byte each, or two for a font marked two) } or null when the font cannot be measured. A glyph
       whose width is unknown, and the ones after it up to the next line move, have no known place and are never picked.
     inTarget(g, targets) whether a glyph is in one of the targets ({ x0, x1, y, fs }: its centre in x0..x1 and its
       origin on the line of baseline y).
   Text state follows the PDF model: Tc, Tw, Tz, TL, Tf, Ts and Tr are graphics state (q/Q), Tm and Tlm are per BT. A form
   (Do) starts from the state of its Do, its matrix on the CTM. */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.SlopPdfGlyphs = api;
})(typeof window !== 'undefined' ? window : globalThis, function () {
  'use strict';
  /** m1 × m2 for PDF matrices [a b c d e f]. */
  function mul(m1, m2) {
    return [m1[0] * m2[0] + m1[1] * m2[2], m1[0] * m2[1] + m1[1] * m2[3], m1[2] * m2[0] + m1[3] * m2[2], m1[2] * m2[1] + m1[3] * m2[3],
      m1[4] * m2[0] + m1[5] * m2[2] + m2[4], m1[4] * m2[1] + m1[5] * m2[3] + m2[5]];
  }
  function apply(m, x, y) { return [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]]; }
  var ID = [1, 0, 0, 1, 0, 0];
  function nums(args, n) {
    if (args.length < n) return null;
    var a = args.slice(args.length - n);
    return a.every(function (v) { return typeof v === 'number' && isFinite(v); }) ? a : null;
  }

  /** Walks the operators: calls show(k, el, ts) for each string a text operator shows (el: the string, ts: the text state
   * with Tm, CTM and a known flag); show returns the pen's advance (text space), or null when it is not known. opts
   * (content-ink.js, content-strip.js): gs0, the graphics state to start from (a form's caller's); each(op, gs), called for
   * every operator first (the colour state); form(name, k) → { ops, fonts, matrix, opts, show } for the Form XObject the Do
   * at operator k draws, to walk into (null: not followed; show: the callback for its strings, when not the caller's). */
  function walk(ops, fonts, show, opts) {
    opts = opts || {};
    var gs = Object.assign({ ctm: ID, tc: 0, tw: 0, th: 1, tl: 0, font: null, fs: 0, rise: 0, tr: 0 }, opts.gs0 || {}), stack = [];
    var tm = ID, tlm = ID, known = true;
    function lineMove(tx, ty) { tlm = mul([1, 0, 0, 1, tx, ty], tlm); tm = tlm; known = true; }
    function adv(tx) { tm = mul([1, 0, 0, 1, tx, 0], tm); }
    function shows(k, str, si) {
      var f = gs.font ? fonts(gs.font) : null;
      var res = show(k, str, { gs: gs, tm: tm, known: known && !!f, f: f, si: si || 0 });
      if (!f || res == null) { known = false; return; }
      adv(res);
    }
    ops.forEach(function (o, k) {
      var a = o.args, n;
      if (opts.each) opts.each(o, gs);
      switch (o.op) {
        case 'Do':
          var x = opts.form && a[0] && a[0].name != null ? opts.form(a[0].name, k) : null;
          if (x) walk(x.ops, x.fonts, x.show || show, Object.assign({}, x.opts, { gs0: Object.assign({}, gs, { ctm: mul(x.matrix || ID, gs.ctm) }) }));
          break;
        case 'q': stack.push(Object.assign({}, gs)); break;
        case 'Q': if (stack.length) gs = stack.pop(); break;
        case 'cm': if ((n = nums(a, 6))) gs.ctm = mul(n, gs.ctm); break;
        case 'BT': tm = tlm = ID; known = true; break;
        case 'Tc': if ((n = nums(a, 1))) gs.tc = n[0]; break;
        case 'Tw': if ((n = nums(a, 1))) gs.tw = n[0]; break;
        case 'Tz': if ((n = nums(a, 1))) gs.th = n[0] / 100; break;
        case 'TL': if ((n = nums(a, 1))) gs.tl = n[0]; break;
        case 'Ts': if ((n = nums(a, 1))) gs.rise = n[0]; break;
        case 'Tr': if ((n = nums(a, 1))) gs.tr = n[0]; break;
        case 'Tf': if (a.length >= 2 && a[0] && a[0].name != null && typeof a[1] === 'number') { gs.font = a[0].name; gs.fs = a[1]; } break;
        case 'Td': if ((n = nums(a, 2))) lineMove(n[0], n[1]); break;
        case 'TD': if ((n = nums(a, 2))) { gs.tl = -n[1]; lineMove(n[0], n[1]); } break;
        case 'Tm': if ((n = nums(a, 6))) { tlm = tm = n; known = true; } break;
        case 'T*': lineMove(0, -gs.tl); break;
        case 'Tj': if (a.length && a[a.length - 1].str != null) shows(k, a[a.length - 1].str); break;
        case "'": lineMove(0, -gs.tl); if (a.length && a[a.length - 1].str != null) shows(k, a[a.length - 1].str); break;
        case '"':
          if (a.length >= 3 && typeof a[0] === 'number' && typeof a[1] === 'number') { gs.tw = a[0]; gs.tc = a[1]; }
          lineMove(0, -gs.tl);
          if (a.length && a[a.length - 1].str != null) shows(k, a[a.length - 1].str);
          break;
        case 'TJ':
          var arr = Array.isArray(a[a.length - 1]) ? a[a.length - 1] : [], si = 0;
          arr.forEach(function (el) {
            if (typeof el === 'number') { if (known) adv(-el / 1000 * gs.fs * gs.th); }
            else if (el && el.str != null) shows(k, el.str, si++);
          });
          break;
      }
    });
  }

  /** The codes of a string in a font: as the font splits them (a CMap's codespace ranges), or one byte each, or two for a
   * two-byte (Identity) font. */
  function codesOf(str, f) {
    if (f && f.codes) return f.codes(str);
    var out = [];
    if (f && f.two) for (var i = 0; i + 1 < str.length; i += 2) out.push({ c: str.charCodeAt(i) * 256 + str.charCodeAt(i + 1), b: str.substr(i, 2) });
    else for (var j = 0; j < str.length; j++) out.push({ c: str.charCodeAt(j), b: str[j] });
    return out;
  }
  /** The advance (text space, before Th) of one code of width w: its width, Tc, and Tw for the one-byte code 32. */
  function advOf(code, w, gs) {
    return (w / 1000) * gs.fs + gs.tc + (code.b.length === 1 && code.c === 32 ? gs.tw : 0);
  }

  /** A walker callback that adds the glyphs each string shows to out, each with n: the node of the stream (content-strip.js). */
  function shower(out, n) {
    return function (k, str, t) {
      if (!t.f) return null;
      var m = mul(t.tm, t.gs.ctm), dx = 0, gs = t.gs, codes = codesOf(str, t.f);
      var up = m[0] > 0 && m[3] > 0 && Math.abs(m[1]) < 1e-3 * Math.abs(m[0]);
      for (var at = 0; at < codes.length; at++) {
        var code = codes[at], w = t.f.width(code.c);
        if (w == null || !isFinite(w)) return null;
        var w0 = (w / 1000) * gs.fs * gs.th, o = apply(m, dx, gs.rise), e = apply(m, dx + w0, gs.rise);
        if (t.known) out.push({ n: n, k: k, si: t.si, at: at, code: code.c, x: o[0], y: o[1], w: e[0] - o[0], cx: (o[0] + e[0]) / 2, up: up, tr: gs.tr, fs: Math.abs(gs.fs * m[3]), fill: gs.fill, stroke: gs.stroke });
        dx += advOf(code, w, gs) * gs.th;
      }
      return dx;
    };
  }
  /** Every glyph the stream shows with a known place. */
  function glyphs(ops, fonts, opts) {
    var out = [];
    walk(ops, fonts, shower(out, null), opts);
    return out;
  }
  /** Whether a glyph is in a target: its centre within x0..x1, its origin on the line of baseline y (from 0.3 em below it
   * to 0.6 em above: a shaped mark or accent placed above the letters is part of the line, the next line is not). */
  function inTarget(g, ts) {
    return g.up && ts.some(function (t) {
      var fs = t.fs || g.fs || 10, dy = g.y - t.y;
      return dy >= -Math.max(0.6, 0.3 * fs) && dy <= Math.max(0.6, 0.6 * fs) && g.cx >= t.x0 - 0.01 && g.cx <= t.x1 + 0.01;
    });
  }

  return { walk: walk, glyphs: glyphs, shower: shower, codesOf: codesOf, advOf: advOf, inTarget: inTarget, mul: mul };
});
