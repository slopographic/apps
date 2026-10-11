/* SlopIsolate — per-image undo/redo. Every image keeps its own two stacks (item.hist).
 * Entries: { kind: 'stroke', label, tiles, rect } (brush strokes, see brush.js) and
 * { kind: 'look', label, before, after } (edge, background, shadow and crop changes).
 * A stroke entry is its own inverse: CO.brush.swap exchanges the bytes, so the same entry
 * goes to the other stack after it is applied. */
(function () {
  'use strict';
  const CO = window.CO, U = CO.util;
  const LOOK_KEYS = ['s', 'bg', 'shadow', 'crop'];
  const MAX = 200;
  const H = CO.history = {};

  const snap = (it) => { const o = {}; for (const k of LOOK_KEYS) o[k] = { ...it[k] }; return o; };
  H.snapLook = snap;

  function applyLook(it, look) {
    for (const k of LOOK_KEYS) Object.assign(it[k], look[k]);
  }

  /** Run one entry against an image. Returns the entry's rect (for stroke repaints) or null. */
  function apply(it, entry, which) {
    if (entry.kind === 'stroke') return CO.brush.swap(it, entry);
    if (entry.kind === 'look') applyLook(it, entry[which]);
    return null;
  }

  function emit(it, entry, dir, rect) {
    CO.emit('history', { it, entry, dir, rect });
    CO.emit('item', it);
  }

  /** Record a finished change. Looks are pushed after they happen: `before` is the snapshot taken before. */
  H.push = function (it, entry) {
    if (!entry) return;
    const h = it.hist;
    h.undo.push(entry);
    if (h.undo.length > MAX) h.undo.shift();
    h.redo.length = 0;
    CO.emit('history', { it, entry, dir: 'push' });
    CO.emit('item', it);
  };

  /** Record a look change made by a control. `before` is the look snapshot from before the change. */
  H.pushLook = function (it, before, label) {
    const after = snap(it);
    if (JSON.stringify(before) === JSON.stringify(after)) return;
    H.push(it, { kind: 'look', label: label || 'Look', before, after });
  };

  H.undo = function (it) {
    const h = it && it.hist, entry = h && h.undo.pop();
    if (!entry) return null;
    const rect = apply(it, entry, 'before');
    h.redo.push(entry);
    emit(it, entry, 'undo', rect);
    return entry;
  };

  H.redo = function (it) {
    const h = it && it.hist, entry = h && h.redo.pop();
    if (!entry) return null;
    const rect = apply(it, entry, 'after');
    h.undo.push(entry);
    emit(it, entry, 'redo', rect);
    return entry;
  };

  H.can = (it, dir) => !!(it && it.hist && it.hist[dir].length);
  H.label = (it, dir) => { const e = it && it.hist && it.hist[dir][it.hist[dir].length - 1]; return e ? e.label : ''; };
  H.clear = (it) => { if (it) it.hist = { undo: [], redo: [] }; };
  U.LOOK_KEYS = LOOK_KEYS;
})();
