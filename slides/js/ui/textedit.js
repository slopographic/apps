/* Slop Slides: on-canvas text editing. A contenteditable overlay sits exactly over the object (rotated with it),
   styled with the same font files; paragraphs carry bullet/level/alignment as data attributes and runs are
   spans. On every input the DOM is parsed back into the model (textedit-parse.js), so the inspector, the
   sorter thumbnail and autofit follow live. Text boxes grow to fit; placeholders shrink their text. */
(function () {
  'use strict';
  var SS = window.SS, A = SS.app, V = SS.view, D = SS.dom, F = SS.fonts, TH = SS.themes, U = SS.util, O = SS.objects, X = SS.textLayout;
  var T = SS.textEdit = { el: null };

  function target(ed) { return ed.cell ? ed.obj.cells[ed.cell[0]][ed.cell[1]] : ed.obj; }
  function styleOf(ed) { return ed.cell ? Object.assign({}, ed.obj.style) : (ed.obj.style || {}); }
  /** Box of the text area in object-local points. */
  function frame(ed) {
    var o = ed.obj;
    if (ed.cell) { var q = SS.tableScene.cells(o).filter(function (c) { return c.r === ed.cell[0] && c.c === ed.cell[1]; })[0]; return { x: q.x, y: q.y, w: q.w, h: q.h }; }
    return o.type === 'shape' ? SS.shapes.textBox(o.shape, o.w, o.h) : { x: 0, y: 0, w: o.w, h: o.h };
  }

  T.start = function (obj, at, cell) {
    if (A.readOnly) return;
    if (A.editing) T.commit();
    if (!obj.text && obj.type === 'shape') obj.text = Object.assign(O.defaultText(''), { valign: 'middle' });
    var ed = A.editing = { id: obj.id, obj: obj, cell: cell || null };
    A.history.push('Edit text'); ed.before = JSON.stringify(target(ed).text);
    A.sel = [obj.id];
    var el = T.el = D.h('div', { class: 'text-editor', contenteditable: 'true', spellcheck: 'true', role: 'textbox', 'aria-multiline': 'true', 'aria-label': 'Edit text' });
    T.build(ed);
    V.board.append(el);
    el.addEventListener('input', onInput);
    el.addEventListener('keydown', onKey);
    el.addEventListener('paste', onPaste);
    el.focus();
    placeCaret(el, at, !SS.objects.plain(target(ed).text));
    A.emit('select'); A.emit('editing', true); A.invalidate(A.cur);
  };
  T.startCell = function (table, pt) {
    var p = U.mat.apply(U.mat.invert(U.mat.forObject(table)), pt.x, pt.y);
    var q = SS.tableScene.cells(table).filter(function (c) { return p[0] >= c.x && p[0] <= c.x + c.w && p[1] >= c.y && p[1] <= c.y + c.h; })[0];
    if (q) T.start(table, null, [q.r, q.c]);
  };

  /** (Re)builds the editor DOM from the model. */
  T.build = function (ed) {
    var el = T.el, o = ed.obj, k = V.k, fr = frame(ed), t = target(ed), st = styleOf(ed), theme = A.theme();
    var tx = t.text || O.defaultText(''), ins = ed.cell ? [8, 4, 8, 4] : (tx.inset || X.INSET);
    var lay = X.layout(Object.assign({}, o, { w: fr.w, h: fr.h, style: st, text: Object.assign({}, tx, { inset: ins }) }), theme);
    ed.scale = lay.scale || 1;
    var base = (st.size || 18) * ed.scale * k;
    var m = U.mat.mul(U.mat.forObject(o), U.mat.translate(fr.x, fr.y));
    Object.assign(el.style, {
      left: '0px', top: '0px', width: fr.w * k + 'px', minHeight: fr.h * k + 'px', transformOrigin: '0 0',
      transform: 'matrix(' + [m[0], m[1], m[2], m[3], m[4] * k, m[5] * k].join(',') + ')',
      padding: ins[1] * k + 'px ' + ins[2] * k + 'px ' + ins[3] * k + 'px ' + ins[0] * k + 'px',
      fontSize: base + 'px', fontFamily: F.domFamily(TH.font(theme, st.font)), color: TH.color(theme, st.color, 'text'),
      fontWeight: st.bold ? '700' : '400', fontStyle: st.italic ? 'italic' : 'normal', lineHeight: String(st.lineHeight || 1.2),
      justifyContent: { top: 'flex-start', middle: 'center', bottom: 'flex-end' }[ed.cell ? 'middle' : (tx.valign || 'top')], letterSpacing: (st.letterSpacing || 0) * k + 'px'
    });
    el.style.setProperty('--bullet', TH.color(theme, st.bulletColor || 'accent1'));
    el.innerHTML = '';
    var nums = {};
    tx.paras.forEach(function (p, i) {
      var lvl = p.level || 0, hasB = p.bullet && p.bullet !== 'none', size0 = (st.size || 18);
      var pd = D.h('div', { class: 'tp' + (hasB ? ' tb-' + p.bullet : ''), 'data-level': lvl, 'data-bullet': p.bullet || 'none' });
      var extra = Object.assign({}, p); ['runs', 'level', 'bullet', 'align'].forEach(function (k2) { delete extra[k2]; });
      if (Object.keys(extra).length) pd.dataset.p = JSON.stringify(extra);
      if (p.bullet === 'num') { nums[lvl] = (nums[lvl] || 0) + 1; pd.setAttribute('data-n', nums[lvl] + '.'); } else if (!hasB) nums = {};
      pd.style.paddingLeft = (lvl * size0 * 1.25 + (hasB ? size0 * (p.bullet === 'num' ? 1.5 : 1.05) : 0)) / size0 + 'em';
      if (p.align) pd.style.textAlign = { l: 'left', c: 'center', r: 'right', j: 'justify' }[p.align];
      else pd.style.textAlign = { l: 'left', c: 'center', r: 'right', j: 'justify' }[st.align || 'l'];
      if (i > 0) pd.style.marginTop = (p.spaceBefore != null ? p.spaceBefore : (st.paraSpace != null ? st.paraSpace : (hasB ? size0 * 0.45 : size0 * 0.15))) / size0 + 'em';
      p.runs.forEach(function (r) {
        if (!r.t) return;
        var sp = D.h('span', { text: r.t });
        if (r.b != null) sp.style.fontWeight = r.b ? '700' : '400';
        if (r.i != null) sp.style.fontStyle = r.i ? 'italic' : 'normal';
        var dec = [r.u ? 'underline' : '', r.s ? 'line-through' : ''].join(' ').trim(); if (dec) sp.style.textDecoration = dec;
        if (r.color) sp.style.color = TH.color(theme, r.color);
        if (r.size) sp.style.fontSize = (r.size / size0) + 'em';
        if (r.font) sp.style.fontFamily = F.domFamily(TH.font(theme, r.font));
        if (r.link) sp.dataset.link = r.link;
        pd.append(sp);
      });
      if (!pd.firstChild) pd.append(D.h('br'));
      el.append(pd);
    });
  };
  function placeCaret(el, at, selectAll) {
    var sel = window.getSelection(), range = document.createRange();
    if (at && document.caretRangeFromPoint && !selectAll) { var r = document.caretRangeFromPoint(at.x, at.y); if (r && el.contains(r.startContainer)) { sel.removeAllRanges(); sel.addRange(r); return; } }
    range.selectNodeContents(el); if (!selectAll) range.collapse(false);
    sel.removeAllRanges(); sel.addRange(range);
  }
  function onInput() {
    var ed = A.editing; if (!ed) return;
    var t = target(ed);
    t.text = Object.assign({}, t.text || O.defaultText(''), { paras: SS.textParse.parse(T.el, styleOf(ed), ed.scale * V.k, A.theme()) });
    fit(ed);
    A.setDirty(true); A.invalidate(A.cur); A.emit('textinput');
  }
  /** Grows text boxes to fit and keeps autofit (shrink) live. */
  function fit(ed) {
    var o = ed.obj;
    if (!ed.cell && o.type === 'text' && o.text.autofit === 'grow') { var hNeed = X.measureHeight(o, A.theme()); if (Math.abs(hNeed - o.h) > 0.5) { o.h = hNeed; T.el.style.minHeight = o.h * V.k + 'px'; } }
    if (!ed.cell && o.text.autofit === 'shrink') {
      var fr = frame(ed), lay = X.layout(Object.assign({}, o, { w: fr.w, h: fr.h }), A.theme());
      if (Math.abs(lay.scale - ed.scale) > 0.01) { ed.scale = lay.scale; T.el.style.fontSize = (o.style.size || 18) * ed.scale * V.k + 'px'; }
    }
  }
  function curPara() {
    var s = window.getSelection(); if (!s.rangeCount) return null;
    var n = s.anchorNode; while (n && n !== T.el && !(n.classList && n.classList.contains('tp'))) n = n.parentNode;
    return n && n !== T.el ? n : null;
  }
  function onKey(e) {
    e.stopPropagation();
    if (e.key === 'Escape') { e.preventDefault(); T.commit(); return; }
    if (e.key === 'Tab' && A.editing.cell) { e.preventDefault(); return T.nextCell(e.shiftKey ? -1 : 1); }
    if (e.key === 'Tab') {
      var p = curPara(); if (!p) return;
      e.preventDefault();
      T.paraAttr(p, 'level', U.clamp((+p.dataset.level || 0) + (e.shiftKey ? -1 : 1), 0, 4));
    }
    if ((e.metaKey || e.ctrlKey) && /^[biu]$/i.test(e.key)) { e.preventDefault(); document.execCommand({ b: 'bold', i: 'italic', u: 'underline' }[e.key.toLowerCase()]); onInput(); }
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') { e.preventDefault(); T.commit(); }
  }
  function onPaste(e) {
    var txt = e.clipboardData && e.clipboardData.getData('text/plain');
    if (txt == null) return;
    e.preventDefault();
    document.execCommand('insertText', false, txt);
  }
  /** Sets a paragraph attribute (level, bullet, align) on paragraph element p and re-renders. */
  T.paraAttr = function (p, k, v) {
    var i = Array.prototype.indexOf.call(T.el.children, p);
    onInput();
    var paras = target(A.editing).text.paras; if (!paras[i]) return;
    paras[i][k] = v;
    T.rebuildKeepCaret();
  };
  T.rebuildKeepCaret = function () {
    var off = caretOffset(); T.build(A.editing); setCaretOffset(off); onInput();
  };
  function caretOffset() { var s = window.getSelection(); if (!s.rangeCount) return 0; var r = s.getRangeAt(0).cloneRange(); r.selectNodeContents(T.el); r.setEnd(s.anchorNode, s.anchorOffset); return SS.textParse.textLen(r.cloneContents()); }
  function setCaretOffset(n) {
    var paras = Array.prototype.slice.call(T.el.children), left = n;
    for (var i = 0; i < paras.length; i++) {
      var w = document.createTreeWalker(paras[i], NodeFilter.SHOW_TEXT), node;
      while ((node = w.nextNode())) { if (left <= node.length) { var r = document.createRange(); r.setStart(node, left); r.collapse(true); var s = window.getSelection(); s.removeAllRanges(); s.addRange(r); return; } left -= node.length; }
      left -= 1; if (left < 0) left = 0;
    }
  }
  /** Applies a run style to the selected text (while editing): {b, i, u, s, color, size, font}. Returns false if nothing is selected. */
  T.applyRun = function (style) { return SS.textParse.applyRun(T.el, style, A.editing, onInput); };
  T.nextCell = function (dir) {
    var ed = A.editing, t = ed.obj, r = ed.cell[0], c = ed.cell[1] + dir, nc = t.cells[0].length;
    if (c >= nc) { c = 0; r++; } else if (c < 0) { c = nc - 1; r--; }
    if (r < 0 || r >= t.cells.length) return T.commit();
    T.commit(); T.start(t, null, [r, c]);
  };
  T.commit = function () {
    var ed = A.editing; if (!ed) return;
    if (T.el) { onInput(); T.el.remove(); T.el = null; }
    A.editing = null;
    if (JSON.stringify(target(ed).text) === ed.before) A.history.drop();
    else A.setDirty(true);
    A.emit('editing', false); A.emit('select'); A.invalidate('all');
  };
  A.on('zoom', function () { if (A.editing && T.el) T.rebuildKeepCaret(); });
})();
