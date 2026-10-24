/* SlopIsolate — per-image undo/redo. Every image keeps its own two stacks (item.hist).
 * Entries: { kind: 'stroke', label, tiles, rect } (brush strokes, see brush.js) and
 * { kind: 'look', label, before, after } (edge, background, shadow and crop changes).
 * A stroke entry is its own inverse: CO.brush.swap exchanges the bytes, so the same entry
 * goes to the other stack after it is applied.
 * A bulk change (the settings panel editing several images) pushes one entry per image with the same `group`: undoing or
 * redoing one of them does the same to every image whose next entry is of that group, so it is one step for all. */
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

  /** Record a look change made by a control. `before` is the look snapshot from before the change. group: the id that
   *  ties the entries of one bulk change together (see H.group). Returns true when something changed. */
  H.pushLook = function (it, before, label, group) {
    const after = snap(it);
    if (JSON.stringify(before) === JSON.stringify(after)) return false;
    const e = { kind: 'look', label: label || 'Look', before, after };
    if (group) e.group = group;
    H.push(it, e);
    return true;
  };
  let groups = 0;
  /** A new id for the entries of one bulk change. */
  H.group = () => 'g' + (++groups);

  /** Undo or redo one entry on an image; for a bulk entry, on every image whose next entry has its group. */
  function step(it, from, to, which, dir) {
    const h = it && it.hist, entry = h && h[from][h[from].length - 1];
    if (!entry) return null;
    const all = entry.group && CO.state ? CO.state.items.filter((o) => o.hist && o.hist[from].length && o.hist[from][o.hist[from].length - 1].group === entry.group) : [it];
    for (const o of all.includes(it) ? all : [it].concat(all)) {
      const e = o.hist[from].pop();
      const rect = apply(o, e, which);
      o.hist[to].push(e);
      emit(o, e, dir, rect);
    }
    return entry;
  }
  H.undo = (it) => step(it, 'undo', 'redo', 'before', 'undo');
  H.redo = (it) => step(it, 'redo', 'undo', 'after', 'redo');

  H.can = (it, dir) => !!(it && it.hist && it.hist[dir].length);
  H.label = (it, dir) => { const e = it && it.hist && it.hist[dir][it.hist[dir].length - 1]; return e ? e.label : ''; };
  H.clear = (it) => { if (it) it.hist = { undo: [], redo: [] }; };
  U.LOOK_KEYS = LOOK_KEYS;
})();
