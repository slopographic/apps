/* Slop Slides: turns the text editor's DOM back into model paragraphs/runs, and applies run styles to the
   current selection (execCommand with CSS styling, then normalised). */
(function () {
  'use strict';
  var SS = window.SS, U = SS.util, TH = SS.themes, F = SS.fonts;
  var P = SS.textParse = {};
  var BLOCK = /^(DIV|P|LI|H\d)$/;

  function styleFrom(n, cur, ctx) {
    var s = Object.assign({}, cur), tag = n.tagName, st = n.style || {};
    if (tag === 'B' || tag === 'STRONG') s.b = true;
    if (tag === 'I' || tag === 'EM') s.i = true;
    if (tag === 'U') s.u = true;
    if (tag === 'S' || tag === 'STRIKE' || tag === 'DEL') s.s = true;
    if (tag === 'FONT' && n.getAttribute('color')) s.color = U.normHex(n.getAttribute('color'));
    if (tag === 'FONT' && n.getAttribute('face')) s.font = n.getAttribute('face');
    if (st.fontWeight) s.b = st.fontWeight === 'bold' || +st.fontWeight >= 600;
    if (st.fontStyle) s.i = st.fontStyle === 'italic';
    var dec = st.textDecorationLine || st.textDecoration || '';
    if (dec) { if (/underline/.test(dec)) s.u = true; if (/line-through/.test(dec)) s.s = true; if (dec === 'none') { s.u = false; s.s = false; } }
    if (st.color) s.color = U.normHex(st.color);
    if (st.fontFamily) s.font = st.fontFamily;
    if (st.fontSize) {
      var v = parseFloat(st.fontSize);
      if (/em$/.test(st.fontSize)) s.size = U.round(v * (cur.size || ctx.base), 1);
      else if (/px$/.test(st.fontSize)) s.size = U.round(v / ctx.pxPerPt, 1);
    }
    if (n.dataset && n.dataset.link) s.link = n.dataset.link;
    return s;
  }
  /** Normalises a run style against the object's base style (drop what equals the default, keep theme refs). */
  function finish(s, ctx) {
    var r = {};
    var baseFam = F.family(TH.font(ctx.theme, ctx.style.font));
    if (s.b != null && s.b !== !!ctx.style.bold) r.b = s.b;
    if (s.i != null && s.i !== !!ctx.style.italic) r.i = s.i;
    if (s.u) r.u = true; if (s.s) r.s = true;
    if (s.color) {
      var base = TH.color(ctx.theme, ctx.style.color, 'text');
      if (s.color !== base) { var ref = TH.SLOTS.filter(function (k) { return ctx.theme.colors[k] === s.color; })[0]; r.color = ref || s.color; }
    }
    if (s.size && Math.abs(s.size - (ctx.style.size || 18)) > 0.05) r.size = s.size;
    if (s.font) { var m = /SSG-([^"',]+)/.exec(s.font), fam = m ? m[1].trim() : s.font.split(',')[0].replace(/["']/g, '').trim(); if (F.family(fam) !== baseFam) r.font = fam; }
    if (s.link) r.link = s.link;
    return r;
  }
  function same(a, b) { return JSON.stringify(a) === JSON.stringify(b); }

  P.parse = function (root, style, pxPerPt, theme) {
    var ctx = { style: style, pxPerPt: pxPerPt, base: style.size || 18, theme: theme }, paras = [], cur = null;
    function para(el) {
      var p = { runs: [] };
      if (el && el.dataset) {
        if (el.dataset.p) { try { Object.assign(p, JSON.parse(el.dataset.p)); } catch (e) { /* ignore */ } }
        if (el.dataset.level) p.level = +el.dataset.level || 0;
        if (el.dataset.bullet) p.bullet = el.dataset.bullet;
        var ta = el.style && el.style.textAlign, al = { left: 'l', center: 'c', right: 'r', justify: 'j' }[ta];
        var def = style.align || 'l';
        if (al && al !== def) p.align = al; else delete p.align;
      }
      p.runs = []; paras.push(p); cur = p; return p;
    }
    function add(t, s) {
      if (!cur) para(null);
      var r = finish(s, ctx), last = cur.runs[cur.runs.length - 1];
      if (last && same(Object.assign({}, last, { t: '' }), Object.assign({}, r, { t: '' }))) last.t += t;
      else cur.runs.push(Object.assign({ t: t }, r));
    }
    function walk(n, s, inBlock) {
      if (n.nodeType === 3) { var t = n.nodeValue.replace(/​/g, ''); if (t) add(t.replace(/\n/g, ' '), s); return; }
      if (n.nodeType !== 1) return;
      if (n.tagName === 'BR') { if (n.nextSibling || !inBlock) para(cur ? { dataset: { level: String(cur.level || 0), bullet: cur.bullet || 'none' }, style: {} } : null); return; }
      if (BLOCK.test(n.tagName)) { para(n); Array.prototype.forEach.call(n.childNodes, function (c) { walk(c, styleFrom(n, s, ctx), true); }); cur = null; return; }
      var s2 = styleFrom(n, s, ctx);
      Array.prototype.forEach.call(n.childNodes, function (c) { walk(c, s2, inBlock); });
    }
    Array.prototype.forEach.call(root.childNodes, function (c) { walk(c, {}, false); });
    if (!paras.length) paras.push({ runs: [{ t: '' }] });
    paras.forEach(function (p) { if (!p.runs.length) p.runs.push({ t: '' }); });
    return paras;
  };
  /** Plain text length of a fragment, counting paragraph breaks as one character each. */
  P.textLen = function (frag) {
    var n = (frag.textContent || '').replace(/​/g, '').length, blocks = frag.querySelectorAll ? frag.querySelectorAll('.tp').length : 0;
    return n + Math.max(0, blocks - 1);
  };

  /** Applies {b,i,u,s,color,size,font} to the current selection inside root. Returns false when collapsed. */
  P.applyRun = function (root, style, ed, after) {
    var sel = window.getSelection();
    if (!sel.rangeCount || sel.isCollapsed || !root.contains(sel.anchorNode)) return false;
    document.execCommand('styleWithCSS', false, true);
    var map = { b: 'bold', i: 'italic', u: 'underline', s: 'strikeThrough' };
    Object.keys(style).forEach(function (k) {
      var v = style[k];
      if (map[k]) { if (document.queryCommandState(map[k]) !== !!v) document.execCommand(map[k]); }
      else if (k === 'color') document.execCommand('foreColor', false, v);
      else if (k === 'font') document.execCommand('fontName', false, 'SSG-' + F.family(v));
      else if (k === 'size') {
        document.execCommand('fontSize', false, '7');
        root.querySelectorAll('font[size="7"], span[style*="xxx-large"]').forEach(function (n) {
          var sp = document.createElement('span'); sp.style.fontSize = v / ((ed.cell ? ed.obj.style.size : (ed.obj.style || {}).size) || 18) + 'em';
          while (n.firstChild) sp.append(n.firstChild);
          if (n.tagName === 'SPAN') { n.style.fontSize = sp.style.fontSize; while (sp.firstChild) n.append(sp.firstChild); } else n.replaceWith(sp);
        });
      }
    });
    after();
    return true;
  };
})();
