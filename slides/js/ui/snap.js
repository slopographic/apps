/* Slop Slides: smart guides. Snaps the moving box's edges and centre to other objects' edges/centres and to
   the slide's edges and centre lines, and reports the guide lines to draw. Equal spacing between neighbours
   in a row is offered as well (Keynote's spacing guides). */
(function () {
  'use strict';
  var SS = window.SS, A = SS.app, V = SS.view, O = SS.objects;
  var S = SS.snap = { enabled: true };

  S.targets = function (exclude) {
    var W = A.deck.size.w, H = A.deck.size.h, boxes = [{ x: 0, y: 0, w: W, h: H, slide: true }];
    A.slide().objects.forEach(function (o) { if (exclude.indexOf(o) < 0) boxes.push(O.bounds(o)); });
    return boxes;
  };
  function axis(b, boxes, X, Wd, Y, Hd, thr) {
    var mine = [b[X], b[X] + b[Wd] / 2, b[X] + b[Wd]], best = null;
    boxes.forEach(function (t) {
      var theirs = [t[X], t[X] + t[Wd] / 2, t[X] + t[Wd]];
      mine.forEach(function (m, mi) {
        theirs.forEach(function (v, ti) {
          if (t.slide && ti !== 1 && mi === 1) return;
          var d = v - m;
          if (Math.abs(d) <= thr && (!best || Math.abs(d) < Math.abs(best.d) - 0.01)) best = { d: d, pos: v, boxes: [t], center: mi === 1 && ti === 1 };
          else if (best && Math.abs(d - best.d) < 0.01 && Math.abs(v - best.pos) < 0.01) best.boxes.push(t);
        });
      });
    });
    if (!best) return null;
    var from = b[Y], to = b[Y] + b[Hd];
    best.boxes.forEach(function (t) { from = Math.min(from, t[Y]); to = Math.max(to, t[Y] + t[Hd]); });
    return { d: best.d, guide: { axis: X, pos: best.pos, from: from, to: to, center: best.center } };
  }
  /** Equal gaps: if the box sits between two neighbours in the same row/column, centre it in the gap. */
  function spacing(b, boxes, X, Wd, Y, Hd, thr) {
    var row = boxes.filter(function (t) { return !t.slide && t[Y] < b[Y] + b[Hd] && t[Y] + t[Hd] > b[Y]; });
    var left = row.filter(function (t) { return t[X] + t[Wd] <= b[X] + thr; }).sort(function (p, q) { return (q[X] + q[Wd]) - (p[X] + p[Wd]); })[0];
    var right = row.filter(function (t) { return t[X] >= b[X] + b[Wd] - thr; }).sort(function (p, q) { return p[X] - q[X]; })[0];
    if (!left || !right) return null;
    var gap = (right[X] - (left[X] + left[Wd]) - b[Wd]) / 2, want = left[X] + left[Wd] + gap, d = want - b[X];
    if (gap < 0 || Math.abs(d) > thr) return null;
    var y = b[Y] + b[Hd] / 2;
    return { d: d, gap: [{ axis: X === 'x' ? 'y' : 'x', pos: y, from: left[X] + left[Wd], to: want, gap: true }, { axis: X === 'x' ? 'y' : 'x', pos: y, from: want + b[Wd], to: right[X], gap: true }] };
  }
  /** Returns { dx, dy, guides } that snap box b (slide coords). */
  S.move = function (b, exclude, opts) {
    if (!S.enabled || (opts && opts.off)) return { dx: 0, dy: 0, guides: [] };
    var thr = 6 / V.k, boxes = S.targets(exclude), guides = [];
    var sx = axis(b, boxes, 'x', 'w', 'y', 'h', thr), sy = axis(b, boxes, 'y', 'h', 'x', 'w', thr);
    var gx = !sx && spacing(b, boxes, 'x', 'w', 'y', 'h', thr), gy = !sy && spacing(b, boxes, 'y', 'h', 'x', 'w', thr);
    if (sx) guides.push(sx.guide); if (sy) guides.push(sy.guide);
    if (gx) guides = guides.concat(gx.gap); if (gy) guides = guides.concat(gy.gap);
    return { dx: sx ? sx.d : gx ? gx.d : 0, dy: sy ? sy.d : gy ? gy.d : 0, guides: guides };
  };
  /** Snaps one edge coordinate (resize). axisName 'x' | 'y'. */
  S.edge = function (v, axisName, exclude) {
    if (!S.enabled) return { v: v, guide: null };
    var thr = 6 / V.k, best = null, Wd = axisName === 'x' ? 'w' : 'h';
    S.targets(exclude).forEach(function (t) { [t[axisName], t[axisName] + t[Wd] / 2, t[axisName] + t[Wd]].forEach(function (c) { var d = c - v; if (Math.abs(d) <= thr && (!best || Math.abs(d) < Math.abs(best))) best = d; }); });
    if (best == null) return { v: v, guide: null };
    var other = axisName === 'x' ? A.deck.size.h : A.deck.size.w;
    return { v: v + best, guide: { axis: axisName, pos: v + best, from: 0, to: other } };
  };
})();
