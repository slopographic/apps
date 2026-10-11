/* Slop Slides: editor state and the change pipeline. Every edit goes through A.change(label, fn, key): it records an
   undo step, runs fn, marks the deck unsaved and schedules a draft. Views subscribe with A.on(event, fn):
   load (a document was opened), deck (structure replaced by undo or redo), change (any edit, cheap to repaint),
   select (object selection), slide (current slide moved), render (repaint only), mode (edit | present).
   Exposes window.SS.app. */
(function () {
  'use strict';
  var SS = window.SS, O = SS.objects, U = SS.util;
  var A = SS.app = { deck: null, idx: 0, sel: [], doc: null, dirty: false, mode: 'edit', clip: null, hist: null };
  var listeners = {};
  A.on = function (ev, fn) { (listeners[ev] = listeners[ev] || []).push(fn); };
  A.emit = function (ev, data) { (listeners[ev] || []).slice().forEach(function (fn) { try { fn(data); } catch (e) { console.error(e); } }); };

  A.hist = SS.History(function () { return A.deck; }, function (d) {
    A.deck = d;
    A.idx = Math.max(0, Math.min(A.idx, d.slides.length - 1));
    A.sel = A.sel.filter(function (id) { return !!O.find(A.slide(), id); });
    A.emit('deck');
    A.emit('change');
  }, { coalesce: 800, limit: 300 });

  A.slide = function () { return A.deck.slides[A.idx] || null; };
  /** Selected objects on the current slide (groups' children included when selected by id). */
  A.selObjs = function () {
    var s = A.slide();
    return s ? A.sel.map(function (id) { return O.find(s, id); }).filter(Boolean) : [];
  };

  /** Opens a document: deck is a model deck, doc = { driveId, name, dirty }. Clears undo history. */
  A.load = function (deck, doc) {
    A.deck = deck; A.idx = 0; A.sel = []; A.mode = 'edit';
    A.doc = Object.assign({ driveId: null, name: SS.native.DEFAULT_NAME }, doc || {});
    A.dirty = !!A.doc.dirty;
    A.hist.clear();
    A.emit('load');
    A.emit('change');
    A.guard();
    A.draftNow();
  };
  /** Records one undo step (before fn runs), then marks the deck changed. key merges quick repeats (typing, nudging). */
  A.change = function (label, fn, key) {
    if (A.mode !== 'edit' || !A.deck) return null;
    A.hist.push(label, key);
    var r = fn ? fn() : null;
    A.touch();
    return r;
  };
  /** The deck changed without a new undo step (a drag in progress, or undo/redo). */
  A.touch = function () {
    A.dirty = true;
    A.guard();
    A.emit('change');
    A.draftLater();
  };
  A.undo = function () { if (A.mode !== 'edit') return false; var r = A.hist.undo(); if (r) A.touch(); return r; };
  A.redo = function () { if (A.mode !== 'edit') return false; var r = A.hist.redo(); if (r) A.touch(); return r; };
  A.select = function (ids) { A.sel = (ids || []).slice(); A.emit('select'); };
  A.go = function (i) {
    if (!A.deck) return;
    A.idx = Math.max(0, Math.min(i, A.deck.slides.length - 1));
    A.sel = [];
    A.emit('slide');
    A.emit('select');
  };
  A.markSaved = function (driveId, name) {
    A.doc = { driveId: driveId, name: name };
    A.dirty = false;
    A.guard();
    A.draftNow();
    A.emit('change');
  };
  A.guard = function () { if (window.SlopGuard) SlopGuard.setUnsaved('slides', A.dirty); };
  A.draftNow = function () {
    if (!SS.draft) return;
    if (A.dirty && A.deck) SS.draft.save({ deck: A.deck, driveId: A.doc.driveId, name: A.doc.name });
    else SS.draft.clear();
  };
  A.draftLater = U.debounce(function () { A.draftNow(); }, 900);
})();
