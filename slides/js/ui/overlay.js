/* Slop Slides: hit testing and the selection overlay (outlines, resize/rotate handles, line end points,
   marquee and smart guides) drawn as SVG over the canvas. */
(function () {
  'use strict';
  var SS = window.SS, A = SS.app, V = SS.view, U = SS.util, O = SS.objects;
  var H = SS.overlay = { guides: [], marquee: null, hover: null };
  var NS = 'http://www.w3.org/2000/svg';
  function svg(tag, attrs) { var n = document.createElementNS(NS, tag); Object.keys(attrs).forEach(function (k) { n.setAttribute(k, attrs[k]); }); return n; }

  /** Object corners on the slide (rotation applied). */
  H.corners = function (o) { var m = U.mat.forObject(o); return [[0, 0], [o.w, 0], [o.w, o.h], [0, o.h]].map(function (p) { return U.mat.apply(m, p[0], p[1]); }); };
  /** Line end points on the slide. */
  H.lineEnds = function (o) { var m = U.mat.forObject(o); return [U.mat.apply(m, 0, 0), U.mat.apply(m, o.w, o.h)]; };

  function distSeg(p, a, b) {
    var dx = b[0] - a[0], dy = b[1] - a[1], L = dx * dx + dy * dy, t = L ? U.clamp(((p.x - a[0]) * dx + (p.y - a[1]) * dy) / L, 0, 1) : 0;
    return Math.hypot(p.x - (a[0] + t * dx), p.y - (a[1] + t * dy));
  }
  /** Topmost object under a slide point (groups are hit as a whole). */
  H.hit = function (pt, list) {
    list = list || A.slide().objects;
    var tol = 5 / V.k;
    for (var i = list.length - 1; i >= 0; i--) {
      var o = list[i];
      if (O.isLine(o)) { var e = H.lineEnds(o); if (distSeg(pt, e[0], e[1]) <= Math.max(tol, (o.stroke ? o.stroke.width : 2) / 2 + 2 / V.k)) return o; continue; }
      var inv = U.mat.invert(U.mat.forObject(o)), p = U.mat.apply(inv, pt.x, pt.y);
      if (p[0] >= -tol && p[1] >= -tol && p[0] <= o.w + tol && p[1] <= o.h + tol) return o;
    }
    return null;
  };
  /** Objects whose bounds intersect a slide rect. */
  H.inRect = function (r) {
    return A.slide().objects.filter(function (o) { var b = O.bounds(o); return b.x < r.x + r.w && b.x + b.w > r.x && b.y < r.y + r.h && b.y + b.h > r.y; });
  };

  H.draw = function () {
    var g = V.overlay, k = V.k;
    while (g.firstChild) g.removeChild(g.firstChild);
    if (!A.deck || A.playing) return;
    var sel = A.selected();
    var pts = function (arr) { return arr.map(function (p) { return (p[0] * k).toFixed(1) + ',' + (p[1] * k).toFixed(1); }).join(' '); };
    if (H.hover && sel.indexOf(H.hover) < 0 && !A.editing) g.append(svg('polygon', { points: pts(H.corners(H.hover)), class: 'ov-hover' }));
    H.guides.forEach(function (gd) {
      if (gd.axis === 'x') g.append(svg('line', { x1: gd.pos * k, y1: gd.from * k, x2: gd.pos * k, y2: gd.to * k, class: 'ov-guide' + (gd.center ? ' ov-center' : '') }));
      else g.append(svg('line', { y1: gd.pos * k, x1: gd.from * k, y2: gd.pos * k, x2: gd.to * k, class: 'ov-guide' + (gd.center ? ' ov-center' : '') }));
    });
    if (H.marquee) { var m = H.marquee; g.append(svg('rect', { x: m.x * k, y: m.y * k, width: m.w * k, height: m.h * k, class: 'ov-marquee' })); }
    if (!sel.length) return;
    var handle = function (x, y, name, cls) { var r = svg('rect', { x: x - 5, y: y - 5, width: 10, height: 10, rx: 2.5, class: 'ov-h ' + (cls || ''), 'data-h': name }); g.append(r); return r; };
    if (sel.length === 1) {
      var o = sel[0];
      if (O.isLine(o)) {
        var e = H.lineEnds(o);
        g.append(svg('line', { x1: e[0][0] * k, y1: e[0][1] * k, x2: e[1][0] * k, y2: e[1][1] * k, class: 'ov-line' }));
        g.append(svg('circle', { cx: e[0][0] * k, cy: e[0][1] * k, r: 6, class: 'ov-h', 'data-h': 'p0' }));
        g.append(svg('circle', { cx: e[1][0] * k, cy: e[1][1] * k, r: 6, class: 'ov-h', 'data-h': 'p1' }));
        return;
      }
      var c = H.corners(o);
      g.append(svg('polygon', { points: pts(c), class: 'ov-sel' + (A.editing ? ' ov-editing' : '') }));
      if (A.editing || o.locked) return;
      var m2 = U.mat.forObject(o), at = function (fx, fy) { var p = U.mat.apply(m2, o.w * fx, o.h * fy); return [p[0] * k, p[1] * k]; };
      var top = at(0.5, 0), r = (o.rot || 0) * Math.PI / 180, flip = o.flipV ? -1 : 1;
      var rx = top[0] + Math.sin(r) * 26 * flip, ry = top[1] - Math.cos(r) * 26 * flip;
      g.append(svg('line', { x1: top[0], y1: top[1], x2: rx, y2: ry, class: 'ov-stem' }));
      g.append(svg('circle', { cx: rx, cy: ry, r: 6, class: 'ov-h ov-rot', 'data-h': 'rot' }));
      var small = o.w * k < 30 || o.h * k < 30;
      [['nw', 0, 0], ['n', 0.5, 0], ['ne', 1, 0], ['e', 1, 0.5], ['se', 1, 1], ['s', 0.5, 1], ['sw', 0, 1], ['w', 0, 0.5]].forEach(function (hh) {
        if (small && hh[0].length === 1) return;
        var p = at(hh[1], hh[2]); handle(p[0], p[1], hh[0]);
      });
      if (o.type === 'shape' && o.shape === 'roundRect' && o.w * k > 60 && o.h * k > 40) {
        var rr = (o.radius == null ? 0.12 : o.radius) * Math.min(o.w, o.h), pr = U.mat.apply(m2, Math.max(rr, 8 / k), 0);
        g.append(svg('circle', { cx: pr[0] * k, cy: pr[1] * k + 0.01, r: 4.5, class: 'ov-h ov-adj', 'data-h': 'radius' }));
      }
      return;
    }
    sel.forEach(function (s) { g.append(svg('polygon', { points: pts(H.corners(s)), class: 'ov-sel ov-multi' })); });
    var u = O.union(sel);
    g.append(svg('rect', { x: u.x * k, y: u.y * k, width: u.w * k, height: u.h * k, class: 'ov-union' }));
    [['nw', 0, 0], ['ne', 1, 0], ['se', 1, 1], ['sw', 0, 1]].forEach(function (hh) { handle((u.x + u.w * hh[1]) * k, (u.y + u.h * hh[2]) * k, hh[0]); });
  };
  A.on('drawn', H.draw);
  A.on('select', function () { H.draw(); });
})();
