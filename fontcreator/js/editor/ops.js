/* Slop Font: what can be done to the current glyph's outline, one undo step each. The toolbar, the panel, Ctrl+K and
 * the assistant all call these (one source of truth). Classic script. FC.ops:
 *   boolean(op)                 union | minus | intersect | exclude of the selected contours (the first selected one is
 *                               the one cut from); with none selected, union merges every contour
 *   merge()                     remove overlap: the glyph's contours as one outline
 *   flip(axis)                  'h' or 'v', the selected contours (else all) about their own middle
 *   clear()                     the outline removed (the width stays)
 *   copyFrom(key, { dx, dy, add })   another glyph's outline (and width, unless add) into this one: Å from A and ˚
 *   moveAll(dx, dy), scaleAll(sx, sy)  the whole outline (scale about the left end of the baseline)
 *   selected() → [contour indexes] */
(function (g) {
  'use strict';
  const S = () => g.FC.state, P = () => g.SlopFont.paths, M = () => g.SlopFont.model;
  function selected() {
    const sel = S().sel, out = new Set(sel.contours);
    for (const k of sel.points) out.add(Number(k.split(':')[0]));
    return [...out].sort((a, b) => a - b).filter((i) => i < S().view().contours.length);
  }
  function boolean(op) {
    const idx = selected(), all = S().view().contours;
    if (idx.length < 2) {
      if (op !== 'union' || all.length < 2) throw new Error('Select two or more contours first (click inside them with Shift)');
      return merge();
    }
    const a = [all[idx[0]]], b = idx.slice(1).map((i) => all[i]);
    const out = P().boolean(a, b, op);
    S().edit({ union: 'Union', minus: 'Subtract', intersect: 'Intersect', exclude: 'Exclude' }[op] || op, 'glyph', (p, gl) => {
      gl.contours = gl.contours.filter((_, i) => !idx.includes(i)).concat(out);
    });
    S().clearSel();
    return out.length;
  }
  function merge() {
    const all = S().view().contours;
    if (!all.length) throw new Error('This glyph has no outline yet');
    const out = P().merge(all);
    S().edit('Remove overlap', 'glyph', (p, gl) => { gl.contours = out; });
    S().clearSel();
    return out.length;
  }
  function flip(axis) {
    const idx = selected(), all = S().view().contours, pick = idx.length ? idx : all.map((_, i) => i);
    const box = P().bbox(pick.map((i) => all[i]));
    if (!box) throw new Error('Nothing to flip');
    const cx = box.x + box.w / 2, cy = box.y + box.h / 2;
    const m = axis === 'v' ? [1, 0, 0, -1, 0, 2 * cy] : [-1, 0, 0, 1, 2 * cx, 0];
    S().edit(axis === 'v' ? 'Flip vertically' : 'Flip horizontally', 'glyph', (p, gl) => {
      gl.contours = gl.contours.map((c, i) => (pick.includes(i) ? P().reverse(P().transform([c], m))[0] : c));
    });
  }
  function clear() { S().edit('Clear the glyph', 'glyph', (p, gl) => { gl.contours = []; }); S().clearSel(); }
  function copyFrom(key, o = {}) {
    const src = M().find(S().project(), key);
    if (!src) throw new Error(`No glyph “${key}” in the font`);
    if (src.id === S().cur() && !o.add) throw new Error('That is this glyph');
    const moved = P().move(src.contours, Number(o.dx) || 0, Number(o.dy) || 0);
    S().edit(o.add ? `Add the outline of ${src.name}` : `Copy ${src.name}`, 'glyph', (p, gl) => {
      gl.contours = o.add ? gl.contours.concat(moved) : moved;
      if (!o.add) gl.advance = src.advance;
    });
    return src.name;
  }
  function moveAll(dx, dy) { S().edit('Move the outline', 'glyph', (p, gl) => { gl.contours = P().move(gl.contours, Number(dx) || 0, Number(dy) || 0); }); }
  function scaleAll(sx, sy) {
    S().edit('Scale the outline', 'glyph', (p, gl) => { gl.contours = P().scaleAt(gl.contours, Number(sx) || 1, Number(sy == null ? sx : sy) || 1, 0, 0); });
  }
  g.FC.ops = { selected, boolean, merge, flip, clear, copyFrom, moveAll, scaleAll };
})(window);
