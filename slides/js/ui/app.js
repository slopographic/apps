/* Slop Slides: editor state and the change pipeline. Every edit goes through A.change(label, fn), which records an
   undo step, runs the mutation, marks the document dirty and schedules a render of the canvas, the sorter and
   the inspector. Exposes window.SS.app (A). */
(function () {
  'use strict';
  var SS = window.SS, U = SS.util, M = SS.model, O = SS.objects;
  var A = SS.app = {
    deck: null, cur: null, sel: [], editing: null, zoom: 'fit', dirty: false, file: null, selSlides: [],
    listeners: { render: [], select: [], slide: [], deck: [] }
  };
  A.on = function (ev, fn) { (A.listeners[ev] = A.listeners[ev] || []).push(fn); };
  A.emit = function (ev, data) { (A.listeners[ev] || []).forEach(function (fn) { try { fn(data); } catch (e) { console.error(e); } }); };

  A.history = SS.History(function () { return A.deck; }, function (d) { A.deck = d; A.fixCur(); A.sel = A.sel.filter(function (id) { return !!O.find(A.slide(), id); }); A.emit('deck'); A.invalidate('all'); });
  A.history.on(function () { A.emit('history'); });

  A.slide = function () { return M.slide(A.deck, A.cur) || A.deck.slides[0]; };
  A.slideIndex = function () { return M.index(A.deck, A.cur); };
  A.fixCur = function () { if (!M.slide(A.deck, A.cur)) A.cur = A.deck.slides[Math.min(A.deck.slides.length - 1, Math.max(0, A._lastIdx || 0))].id; };
  A.selected = function () { var s = A.slide(); return A.sel.map(function (id) { return O.find(s, id); }).filter(Boolean); };
  A.theme = function () { return SS.themes.of(A.deck); };

  /** Loads a deck into the editor (clears history). */
  A.load = function (deck, file) {
    A.deck = deck; A.cur = deck.slides[0].id; A.sel = []; A.editing = null; A.file = file || null; A.selSlides = [A.cur];
    A.history.clear(); A.setDirty(false);
    A.emit('deck'); A.emit('slide'); A.emit('select'); A.invalidate('all');
  };
  /** Records an undo step, runs fn, re-renders. key coalesces rapid edits (sliders, nudges). */
  A.change = function (label, fn, key) {
    if (A.readOnly) return;
    A.history.push(label, key);
    var r = fn();
    A.setDirty(true);
    A.invalidate(A.cur);
    return r;
  };
  A.setDirty = function (d) {
    A.dirty = d;
    if (window.SlopGuard) window.SlopGuard.setUnsaved('slides', !!d);
    A.emit('dirty', d);
    if (d) A.emit('changed');
  };

  var pending = { slides: {}, all: false }, raf = 0;
  /** Schedules a render. what: a slide id, or 'all'. */
  A.invalidate = function (what) {
    if (what === 'all') pending.all = true; else if (what) pending.slides[what] = true;
    if (!raf) raf = requestAnimationFrame(flush);
  };
  function flush() {
    raf = 0;
    var p = pending; pending = { slides: {}, all: false };
    A.emit('render', p);
  }
  A.renderNow = function () { if (raf) { cancelAnimationFrame(raf); flush(); } };

  A.goto = function (id, opts) {
    if (!M.slide(A.deck, id)) return;
    if (A.editing && SS.textEdit) SS.textEdit.commit();
    A.cur = id; A._lastIdx = M.index(A.deck, id); A.sel = [];
    if (!(opts && opts.keepSorter)) A.selSlides = [id];
    A.emit('slide'); A.emit('select'); A.invalidate('all');
  };
  A.select = function (ids, opts) {
    if (A.editing && SS.textEdit && !(opts && opts.keepEditing)) SS.textEdit.commit();
    A.sel = (ids || []).slice();
    A.emit('select'); A.invalidate(A.cur);
  };

  /* ---------- slide operations ---------- */
  A.addSlide = function (layout) {
    var i = A.slideIndex();
    var cur = A.slide(), lay = layout || (cur && cur.layout === 'title' ? 'title-content' : cur ? cur.layout : 'title-content');
    var s = A.change('New slide', function () { return M.addSlide(A.deck, lay, i + 1); });
    A.goto(s.id);
    return s;
  };
  A.duplicateSlides = function (ids) {
    ids = ids || A.selSlides;
    var last = null;
    A.change('Duplicate slide', function () { ids.slice().reverse().forEach(function (id) { var d = M.duplicateSlide(A.deck, id); if (!last) last = d; }); });
    if (last) A.goto(last.id);
  };
  A.deleteSlides = function (ids) {
    ids = ids || A.selSlides;
    var i = A.slideIndex();
    A.change('Delete slide', function () { M.deleteSlides(A.deck, ids); });
    A.goto(A.deck.slides[Math.min(i, A.deck.slides.length - 1)].id);
  };
  A.moveSlides = function (ids, to) { A.change('Move slide', function () { M.moveSlides(A.deck, ids, to); }); A.emit('deck'); A.invalidate('all'); };

  /* ---------- object operations ---------- */
  A.insert = function (obj, opts) {
    var s = A.slide();
    A.change('Insert ' + obj.name, function () {
      if (!(opts && opts.keepPos)) { obj.x = (A.deck.size.w - obj.w) / 2; obj.y = (A.deck.size.h - obj.h) / 2; }
      s.objects.push(obj);
    });
    A.select([obj.id]);
    return obj;
  };
  A.deleteSelected = function () {
    var s = A.slide(), ids = A.sel.slice();
    if (!ids.length) return;
    A.change('Delete', function () {
      (function rm(list) { for (var i = list.length - 1; i >= 0; i--) { if (ids.indexOf(list[i].id) >= 0) list.splice(i, 1); else if (list[i].children) rm(list[i].children); } })(s.objects);
      M.cleanBuilds(s);
    });
    A.select([]);
  };
  /** Applies fn(obj) to every selected object (one undo step). */
  A.each = function (label, fn, key) {
    var objs = A.selected(); if (!objs.length) return;
    A.change(label, function () { objs.forEach(fn); }, key);
    A.emit('select');
  };
  A.parentList = function (obj) {
    var s = A.slide(), hit = s.objects;
    O.walk(s.objects, function (o) { if (o.children && o.children.indexOf(obj) >= 0) hit = o.children; });
    return hit;
  };
  A.zorder = function (how) { var objs = A.selected(); if (!objs.length) return; A.change('Arrange', function () { M.zorder(A.parentList(objs[0]), objs, how); }); };
  A.align = function (how) {
    var objs = A.selected(); if (!objs.length) return;
    A.change('Align', function () { M.align(objs, how, objs.length === 1 ? { x: 0, y: 0, w: A.deck.size.w, h: A.deck.size.h } : null); });
    A.emit('select');
  };
  A.distribute = function (axis) { var objs = A.selected(); if (objs.length < 3) return; A.change('Distribute', function () { M.distribute(objs, axis); }); A.emit('select'); };
  A.group = function () {
    var objs = A.selected().filter(function (o) { return A.slide().objects.indexOf(o) >= 0; }); if (objs.length < 2) return;
    var g = A.change('Group', function () { return O.group(A.slide().objects, objs); });
    A.select([g.id]);
  };
  A.ungroup = function () {
    var gs = A.selected().filter(function (o) { return o.type === 'group'; }); if (!gs.length) return;
    var out = [];
    A.change('Ungroup', function () { gs.forEach(function (g) { out = out.concat(O.ungroup(A.parentList(g), g)); }); });
    A.select(out.map(function (o) { return o.id; }));
  };
  A.nudge = function (dx, dy) { A.each('Nudge', function (o) { o.x += dx; o.y += dy; }, 'nudge'); };
  A.toast = function (msg) { if (window.SlopUI) window.SlopUI.toast(msg); };
  A.isMobile = function () { return window.matchMedia('(max-width: 760px)').matches; };
  void U;
})();
