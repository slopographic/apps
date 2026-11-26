/* Slop PDF — removing text from a page's content stream and from the forms it draws. Pure (no DOM), tested alone in Node
   (tests/node/pdf-content-strip.test.mjs, pdf-content-forms.test.mjs). Works on the operators of content-lex.js and the
   glyphs of content-glyphs.js (whose glyphs, walk, inTarget and mul are here too, for content-ink.js and content-fills.js).
     strip(src, fonts, targets, res) → { text, dropped, first, forms, unused } or null. targets: [{ x0, x1, y, fs }] in user
       space: a glyph is dropped when its centre is in x0..x1 and its origin on the line of baseline y. Each text operator
       that shows a dropped glyph is rewritten as a TJ array that keeps the other glyphs and moves the pen past the dropped
       ones by their advance (a numeric adjustment), so nothing after it moves; one left with no glyphs and no kept text
       after it in its BT goes. ' and " keep their line move (and their spacing). A marked-content span that loses a glyph
       loses the text it stands for (its ActualText, Alt and E: they would still be copied and found). Every other operator
       stays byte for byte.
     res (optional): the stream's resources, { form(name) → { src, ops, matrix, res } for a Form XObject (null for anything
       else; res: the form's own resources, or the very same object when it has none and uses its caller's), has(name) }. Text
       in forms is found where each Do draws it, forms in forms too (12 levels). A form that loses glyphs gets a copy for
       that one Do: forms: [{ name, as (the copy's name: new, not in has), x (the form as form gave it), text (the copy's
       content), forms, unused }] for the stream, whose text draws the copy (its Do renamed); unused: the names the stream
       no longer draws, which its resources' copy can leave out. The form itself stays as it was for every other Do.
     null when nothing matched, when a dropped glyph is invisible (render mode 3: the words a scan shows are in its picture,
       so removing them would change nothing on the page) or clipping text (modes 4 to 7: its removal would change what is
       clipped), or when the page draws too much to follow. first: the operator of the page's own stream where the first
       dropped glyph is drawn (the Do, for a form). */
(function (root, factory) {
  var req = typeof require === 'function' ? require : null;
  var api = factory(root.SlopPdfLex || (req ? req('./content-lex.js') : null), root.SlopPdfGlyphs || (req ? req('./content-glyphs.js') : null));
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.SlopPdfStrip = api;
})(typeof window !== 'undefined' ? window : globalThis, function (Lx, G) {
  'use strict';
  var DEPTH = 12, BUDGET = 5e6; // forms are followed this many levels deep, and this many operators are walked in all
  function none() { return null; }

  /** A stream of the tree: the page's own, or the form that the Do at operator k of stream up draws (each Do its own). */
  function node(src, ops, res, up, k, name, x) {
    res = res || {};
    return { src: src, ops: ops, res: res, fonts: res.fonts || none, up: up, k: k, name: name, x: x, kids: new Map(), drop: new Map(), repl: new Map(),
      depth: up ? up.depth + 1 : 0, top: !up ? null : up.up ? up.top : k };
  }
  /** Walks the page's stream and the forms it draws, each Do's form a node (made once, the same on the next walk):
   * visit(node) → the callback for the strings of its stream. false when there is too much to walk. */
  function walkTree(root, visit) {
    var left = BUDGET - root.ops.length;
    function opts(n) {
      return { form: function (name, k) {
        var x = n.depth < DEPTH && n.res.form ? n.res.form(name) : null, kid = n.kids.get(k);
        if (!x || !x.ops || x.src == null || (left -= x.ops.length) < 0) return null;
        if (!kid) n.kids.set(k, (kid = node(x.src, x.ops, x.res || n.res, n, k, name, x)));
        return { ops: kid.ops, fonts: kid.fonts, matrix: x.matrix, show: visit(kid), opts: opts(kid) };
      } };
    }
    G.walk(root.ops, root.fonts, visit(root), opts(root));
    return left >= 0;
  }

  /** Rewrites the stream (and its forms) without the glyphs in the targets (see the header). */
  function strip(src, fonts, targets, res) {
    var root = node(src, Lx.lex(src), res), all = [], dropped = 0, first = -1, bad = false;
    root.fonts = fonts;
    if (!walkTree(root, function (n) { return G.shower(all, n); })) return null;
    all.forEach(function (g) {
      if (!G.inTarget(g, targets)) return;
      if (g.tr >= 3) bad = true; // invisible (3: what shows is a picture, as in a scan) or clipping (4 to 7)
      var n = g.n, at = n === root ? g.k : n.top;
      if (!n.drop.has(g.k)) n.drop.set(g.k, []);
      n.drop.get(g.k).push(g);
      dropped++;
      if (first < 0 || at < first) first = at;
    });
    if (bad || !dropped) return null;
    var ok = walkTree(root, function (n) { return replacer(n, function () { bad = true; }); });
    var r = ok && !bad ? rebuild(root) : null;
    return r ? { text: r.text, dropped: dropped, first: first, forms: r.forms, unused: r.unused } : null;
  }
  /** The walker callback that works out, from the state each ran in, the new elements of the strings of n's stream that
   * lose glyphs (n.repl: operator → { string index → parts }). */
  function replacer(n, fail) {
    return function (k, str, t) {
      if (!t.f) return null;
      var gs = t.gs, adv = 0, codes = G.codesOf(str, t.f), ws = codes.map(function (c) { var w = t.f.width(c.c); return w == null || !isFinite(w) ? null : w; });
      var mine = n.drop.has(k) ? n.drop.get(k).filter(function (g) { return g.si === t.si; }) : [];
      if (mine.length) {
        if (!gs.fs) { fail(); return null; }
        var gone = new Set(mine.map(function (g) { return g.at; })), parts = [], keep = '', pend = 0;
        codes.forEach(function (c, i) {
          if (gone.has(i)) { if (keep) { parts.push({ str: keep }); keep = ''; } pend += G.advOf(c, ws[i], gs) / gs.fs * 1000; }
          else { if (pend) { parts.push(-pend); pend = 0; } keep += c.b; }
        });
        if (keep) parts.push({ str: keep });
        if (pend) parts.push(-pend);
        if (!n.repl.has(k)) n.repl.set(k, {});
        n.repl.get(k)[t.si] = parts;
      }
      if (ws.indexOf(null) >= 0) return null;
      codes.forEach(function (c, i) { adv += G.advOf(c, ws[i], gs) * gs.th; });
      return adv;
    };
  }
  /** n's stream rewritten: { text, forms, unused } (see the header), or null when nothing in it or under it changes. */
  function rebuild(n) {
    var parts = new Map(), edits = new Map(), renamed = new Set(), forms = [], taken = new Set(), lent = false;
    n.repl.forEach(function (r, k) { var o = n.ops[k]; parts.set(k, o.op === 'TJ' ? mergeTJ(o.args[o.args.length - 1], r) : r[0]); });
    var omit = trailing(n.ops, parts);
    parts.forEach(function (p, k) { var o = n.ops[k]; edits.set(k, omit.has(k) ? prefix(o).trim() : prefix(o) + tj(p)); });
    Array.from(n.kids.keys()).sort(function (a, b) { return a - b; }).forEach(function (k) {
      var kid = n.kids.get(k), r = rebuild(kid);
      if (kid.res === n.res) lent = true;
      if (!r) return;
      var as = fresh(kid.name, n.res, taken);
      edits.set(k, '/' + as + ' Do'); // i18n-ignore: PDF names / font names / producer, not UI
      renamed.add(k);
      forms.push({ name: kid.name, as: as, x: kid.x, text: r.text, forms: r.forms, unused: r.unused });
    });
    if (!edits.size) return null;
    spans(n, new Set(Array.from(parts.keys()).concat(Array.from(renamed)))).forEach(function (k) { edits.set(k, bdc(n.ops[k])); });
    var out = '', at = 0, still = new Set();
    Array.from(edits.keys()).sort(function (a, b) { return a - b; }).forEach(function (k) { var o = n.ops[k]; out += n.src.slice(at, o.s) + edits.get(k); at = o.e; });
    n.ops.forEach(function (o, k) { if (o.op === 'Do' && !renamed.has(k) && o.args[0] && o.args[0].name != null) still.add(o.args[0].name); }); // i18n-ignore: PDF names / font names / producer, not UI
    // a form that has no resources of its own draws by this stream's names: then none of them is left out
    var unused = lent || n.depth >= DEPTH - 1 ? [] : forms.map(function (f) { return f.name; }).filter(function (nm, i, a) { return !still.has(nm) && a.indexOf(nm) === i; });
    return { text: out + n.src.slice(at), forms: forms, unused: unused };
  }
  var SAYS = ['ActualText', 'Alt', 'E']; // i18n-ignore: PDF names / font names / producer, not UI
  /** The BDC operators of n's stream whose span (with text it stands for) holds one of the operators changed. */
  function spans(n, changed) {
    var open = [], out = new Set();
    n.ops.forEach(function (o, k) {
      var d = o.op === 'BDC' && o.args[1] && o.args[1].dict;
      if (o.op === 'BDC' || o.op === 'BMC') open.push(d && SAYS.some(function (x) { return d[x] != null; }) ? k : -1);
      else if (o.op === 'EMC') open.pop();
      else if (changed.has(k)) open.forEach(function (b) { if (b >= 0) out.add(b); });
    });
    return out;
  }
  /** A BDC operator without the text its span stands for. */
  function bdc(o) {
    var d = {}, a = o.args;
    Object.keys(a[1].dict).forEach(function (x) { if (SAYS.indexOf(x) < 0) d[x] = a[1].dict[x]; });
    return valText(a[0]) + ' ' + valText({ dict: d }) + ' BDC';
  }
  /** An operand (content-lex.js's form) as content text. */
  function valText(v) {
    if (typeof v === 'number') return Lx.num(v);
    if (Array.isArray(v)) return '[' + v.map(valText).join(' ') + ']';
    if (v.name != null) return '/' + v.name.replace(/[^\x21-\x7e]|[#()<>[\]{}\/%]/g, function (c) { return '#' + ('0' + c.charCodeAt(0).toString(16)).slice(-2); });
    if (v.str != null) return Lx.hexOf(v.str);
    if (v.dict) return '<<' + Object.keys(v.dict).map(function (k) { return valText({ name: k }) + ' ' + valText(v.dict[k]); }).join(' ') + '>>';
    return v.kw || 'null';
  }
  /** A new XObject name from base: not in the resources (res.has) and not given before in this stream. */
  function fresh(base, res, taken) {
    base = /^[A-Za-z0-9_.+-]{1,40}$/.test(base) ? base : 'Fm'; // i18n-ignore: PDF names / font names / producer, not UI
    for (var i = 1; ; i++) {
      var c = base + '_' + i;
      if (!taken.has(c) && !(res.has && res.has(c))) { taken.add(c); return c; }
    }
  }
  var SHOW = { Tj: 1, TJ: 1, "'": 1, '"': 1 };
  /** The rewritten operators left with no glyphs that no kept text follows in their text object: their pen move matters
   * to nothing, so they go altogether (a lone move would read as a space to text extraction). */
  function trailing(ops, parts) {
    var omit = new Set(), shows = [];
    function close() {
      for (var i = shows.length - 1; i >= 0; i--) {
        var p = parts.get(shows[i]);
        if (!p || p.some(function (x) { return typeof x !== 'number'; })) break;
        omit.add(shows[i]);
      }
      shows = [];
    }
    ops.forEach(function (o, k) { if (o.op === 'BT' || o.op === 'ET') close(); else if (SHOW[o.op]) shows.push(k); });
    close();
    return omit;
  }
  /** A TJ's new elements: its numbers stay where they were, its strings become their rewritten parts. */
  function mergeTJ(arr, r) {
    var out = [], si = 0;
    arr.forEach(function (el) {
      if (typeof el === 'number') { out.push(el); return; }
      if (!el || el.str == null) return;
      out = out.concat(r[si] || [el]); si++;
    });
    return out;
  }
  /** What a rewritten ' or " still does before its text: the line move, and for " the word and character spacing. */
  function prefix(o) {
    var a = o.args;
    if (o.op === "'") return 'T* ';
    if (o.op === '"') return Lx.num(a[0]) + ' Tw ' + Lx.num(a[1]) + ' Tc T* '; // i18n-ignore: PDF names / font names / producer, not UI
    return '';
  }
  /** A TJ operator from parts (strings and numbers), numbers next to each other added up. */
  function tj(parts) {
    var els = [];
    parts.forEach(function (p) {
      if (typeof p === 'number') { if (typeof els[els.length - 1] === 'number') els[els.length - 1] += p; else els.push(p); }
      else els.push(p);
    });
    return '[' + els.map(function (p) { return typeof p === 'number' ? Lx.num(p) : Lx.hexOf(p.str); }).join(' ') + '] TJ';
  }

  return { glyphs: G.glyphs, strip: strip, mul: G.mul, walk: G.walk, inTarget: G.inTarget };
});
