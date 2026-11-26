/* Slop PDF — layers. Every annotation on a page is one layer item. A page's annots array is the stack: the first
   item is the bottom layer, the last is the top. A layer can be hidden (not drawn on the page, not exported) or locked
   (it cannot be moved, resized, edited or deleted, but it is still drawn and exported). A cover over old text an edit could
   not take off the page (L.isCover) is part of that edit, not a layer: it is not listed, and it stays right under its text
   when the stack changes. Pure helpers on plain state: editor/layers-ops.js makes the changes undoable commands.
   Classic script. */
(function () {
  'use strict';
  var SP = window.SP;
  var L = SP.layers = {};
  var T = function (k, v) { return SP.util.t(k, v); };
  /** The layer name keys by annotation type (the text is read when the Layers panel renders, so it follows the language). */
  var NAMES = {
    text: 'text', callout: 'callout', note: 'comment', rect: 'rect', ellipse: 'ellipse', line: 'line', arrow: 'arrow',
    pen: 'drawing', marker: 'highlighter', hlbox: 'highlight', texthl: 'texthl', whiteout: 'whiteout', image: 'image',
    redact: 'redaction', step: 'step', para: 'paragraph',
  };

  L.isHidden = function (a) { return !!(a && a.hidden); };
  /** A cover Edit text (Lines, Paragraphs), Remove, Replace or the selection's lift made over old text it could not take
   * off the page: { type: 'whiteout', hides: 'text', of: the new text's id (none when the text was only removed) }. The old
   * text is still in the file under it. A whiteout drawn with the Whiteout tool has no hides: it is an ordinary layer. */
  L.isCover = function (a) { return !!(a && a.type === 'whiteout' && a.hides === 'text'); };
  L.isLocked = function (a) { return !!(a && a.locked); };
  /** The name a layer item shows: its type, numbered among the page's layers of that type (bottom to top). */
  function baseName(a) { return T('pdf.core.layer_' + (a.sig ? 'signature' : NAMES[a.type] || 'item')); }

  /** The page's layer items, top layer first: { a, index (in annots), name }. Covers over old text are not items. */
  L.items = function (p) {
    var all = (p && p.annots) || [], seen = {}, names = all.map(function (a) {
      if (L.isCover(a)) return null;
      var b = baseName(a);
      seen[b] = (seen[b] || 0) + 1;
      return a.type === 'step' ? T('pdf.core.layer_step_n', { n: String(a.n) }) : T('pdf.core.layer_numbered', { name: b, n: String(seen[b]) });
    });
    return all.map(function (a, i) { return { a: a, index: i, name: names[i] }; }).filter(function (it) { return it.name !== null; }).reverse();
  };
  /** Puts each cover right under its text again (after the stack changed), in place: the text is never hidden by its own
   * cover, and a cover whose text is gone (deleted, moved to another page) stays where it is. */
  L.keepCovers = function (p) {
    var ids = new Set(p.annots.filter(function (a) { return !L.isCover(a); }).map(function (a) { return a.id; }));
    var linked = p.annots.filter(function (a) { return L.isCover(a) && a.of && ids.has(a.of); });
    if (!linked.length) return;
    var out = [];
    p.annots.forEach(function (a) {
      if (linked.indexOf(a) >= 0) return;
      linked.forEach(function (c) { if (c.of === a.id) out.push(c); });
      out.push(a);
    });
    p.annots = out;
  };

  function pageIn(st, pid) { for (var i = 0; i < st.pages.length; i++) if (st.pages[i].id === pid) return st.pages[i]; return null; }
  /** Sets (val truthy) or clears a flag on one layer, on a state in place. Returns false when the layer is not there. */
  L.setFlag = function (st, pid, aid, key, val) {
    var p = pageIn(st, pid), a = p && p.annots.filter(function (x) { return x.id === aid; })[0];
    if (!a) return false;
    if (val) a[key] = true; else delete a[key];
    return true;
  };
  /** Moves a layer one step up (dir > 0, towards the top) or down (dir < 0) in the stack, in place: past the next layer
   * (covers are not layers: they are passed over, and each stays under its text). */
  L.move = function (st, pid, aid, dir) {
    var p = pageIn(st, pid); if (!p) return false;
    var i = p.annots.findIndex(function (x) { return x.id === aid; }), d = dir > 0 ? 1 : -1, j = i + d;
    while (j >= 0 && j < p.annots.length && L.isCover(p.annots[j])) j += d;
    if (i < 0 || L.isCover(p.annots[i]) || j < 0 || j >= p.annots.length) return false;
    var t = p.annots[j]; p.annots[j] = p.annots[i]; p.annots[i] = t;
    L.keepCovers(p);
    return true;
  };
  /** Removes a layer from its page, in place. */
  L.remove = function (st, pid, aid) {
    var p = pageIn(st, pid); if (!p) return false;
    var n = p.annots.length;
    p.annots = p.annots.filter(function (x) { return x.id !== aid; });
    return p.annots.length !== n;
  };
})();
