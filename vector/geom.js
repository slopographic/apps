/* Slop Vector — geometry kernel
   Matrices, beziers, shape→path conversion, SVG path data parsing/serialising,
   flattening, hit testing, Schneider curve fitting, polygon booleans, Slopify.
   Hand-written, no dependencies. Exposes window.SVGeom. */
(function () {
  'use strict';
  var G = {};
  var abs = Math.abs, sqrt = Math.sqrt, min = Math.min, max = Math.max, PI = Math.PI;
  var KAPPA = 0.5522847498;

  /* ---------- small vector helpers ---------- */
  function P(x, y) { return { x: x, y: y }; }
  function sub(a, b) { return P(a.x - b.x, a.y - b.y); }
  function add(a, b) { return P(a.x + b.x, a.y + b.y); }
  function scl(a, s) { return P(a.x * s, a.y * s); }
  function dot(a, b) { return a.x * b.x + a.y * b.y; }
  function cross(a, b) { return a.x * b.y - a.y * b.x; }
  function len(a) { return sqrt(a.x * a.x + a.y * a.y); }
  function dist(a, b) { var dx = a.x - b.x, dy = a.y - b.y; return sqrt(dx * dx + dy * dy); }
  function norm(a) { var l = len(a); return l > 1e-12 ? P(a.x / l, a.y / l) : P(0, 0); }
  function lerp(a, b, t) { return P(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t); }
  G.P = P; G.sub = sub; G.add = add; G.scl = scl; G.dot = dot; G.cross = cross; G.len = len; G.dist = dist; G.norm = norm; G.lerp = lerp;

  /* ---------- affine matrices [a b c d e f] ---------- */
  G.I = function () { return [1, 0, 0, 1, 0, 0]; };
  G.mul = function (m, n) {
    return [m[0] * n[0] + m[2] * n[1], m[1] * n[0] + m[3] * n[1],
      m[0] * n[2] + m[2] * n[3], m[1] * n[2] + m[3] * n[3],
      m[0] * n[4] + m[2] * n[5] + m[4], m[1] * n[4] + m[3] * n[5] + m[5]];
  };
  G.inv = function (m) {
    var d = m[0] * m[3] - m[1] * m[2];
    if (abs(d) < 1e-14) return G.I();
    return [m[3] / d, -m[1] / d, -m[2] / d, m[0] / d, (m[2] * m[5] - m[3] * m[4]) / d, (m[1] * m[4] - m[0] * m[5]) / d];
  };
  G.ap = function (m, x, y) { return P(m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]); };
  G.translate = function (x, y) { return [1, 0, 0, 1, x, y]; };
  G.scale = function (sx, sy, cx, cy) { cx = cx || 0; cy = cy || 0; return [sx, 0, 0, sy, cx - sx * cx, cy - sy * cy]; };
  G.rotate = function (rad, cx, cy) {
    cx = cx || 0; cy = cy || 0;
    var c = Math.cos(rad), s = Math.sin(rad);
    return [c, s, -s, c, cx - c * cx + s * cy, cy - s * cx - c * cy];
  };
  G.isIdentity = function (m) {
    return !m || (abs(m[0] - 1) < 1e-9 && abs(m[1]) < 1e-9 && abs(m[2]) < 1e-9 && abs(m[3] - 1) < 1e-9 && abs(m[4]) < 1e-9 && abs(m[5]) < 1e-9);
  };
  G.det = function (m) { return m[0] * m[3] - m[1] * m[2]; };

  /* ---------- anchors / subpaths ---------- */
  // anchor: {x,y, ix,iy (in handle), ox,oy (out handle), s (smooth)}
  G.A = function (x, y) { return { x: x, y: y, ix: x, iy: y, ox: x, oy: y, s: false }; };
  G.cloneSubs = function (subs) {
    return subs.map(function (sp) { return { closed: !!sp.closed, pts: sp.pts.map(function (a) { return { x: a.x, y: a.y, ix: a.ix, iy: a.iy, ox: a.ox, oy: a.oy, s: !!a.s }; }) }; });
  };
  G.hasIn = function (a) { return abs(a.ix - a.x) > 1e-9 || abs(a.iy - a.y) > 1e-9; };
  G.hasOut = function (a) { return abs(a.ox - a.x) > 1e-9 || abs(a.oy - a.y) > 1e-9; };
  G.isLineSeg = function (a, b) { return !G.hasOut(a) && !G.hasIn(b); };
  // iterate segments of a subpath: cb(a, b, i, j)
  G.eachSeg = function (sp, cb) {
    var n = sp.pts.length;
    if (n < 2) return;
    var last = sp.closed ? n : n - 1;
    for (var i = 0; i < last; i++) { var j = (i + 1) % n; cb(sp.pts[i], sp.pts[j], i, j); }
  };
  G.transformSubs = function (subs, m) {
    if (G.isIdentity(m)) return G.cloneSubs(subs);
    return subs.map(function (sp) {
      return {
        closed: sp.closed, pts: sp.pts.map(function (a) {
          var p = G.ap(m, a.x, a.y), i = G.ap(m, a.ix, a.iy), o = G.ap(m, a.ox, a.oy);
          return { x: p.x, y: p.y, ix: i.x, iy: i.y, ox: o.x, oy: o.y, s: !!a.s };
        })
      };
    });
  };
  G.reverseSub = function (sp) {
    var pts = sp.pts.slice().reverse().map(function (a) { return { x: a.x, y: a.y, ix: a.ox, iy: a.oy, ox: a.ix, oy: a.iy, s: a.s }; });
    return { closed: sp.closed, pts: pts };
  };

  /* ---------- bezier math ---------- */
  G.bez = function (p0, p1, p2, p3, t) {
    var mt = 1 - t, a = mt * mt * mt, b = 3 * mt * mt * t, c = 3 * mt * t * t, d = t * t * t;
    return P(a * p0.x + b * p1.x + c * p2.x + d * p3.x, a * p0.y + b * p1.y + c * p2.y + d * p3.y);
  };
  G.splitBez = function (p0, p1, p2, p3, t) {
    var a = lerp(p0, p1, t), b = lerp(p1, p2, t), c = lerp(p2, p3, t);
    var d = lerp(a, b, t), e = lerp(b, c, t), f = lerp(d, e, t);
    return [[p0, a, d, f], [f, e, c, p3]];
  };
  function segPts(a, b) { return [P(a.x, a.y), P(a.ox, a.oy), P(b.ix, b.iy), P(b.x, b.y)]; }
  G.segPts = segPts;
  function cubicExtrema(p0, p1, p2, p3) {
    // roots of derivative per axis
    var ts = [];
    ['x', 'y'].forEach(function (k) {
      var a = -p0[k] + 3 * p1[k] - 3 * p2[k] + p3[k];
      var b = 2 * (p0[k] - 2 * p1[k] + p2[k]);
      var c = p1[k] - p0[k];
      // derivative/3 = a t^2 + b t + c
      if (abs(a) < 1e-12) { if (abs(b) > 1e-12) ts.push(-c / b); }
      else {
        var disc = b * b - 4 * a * c;
        if (disc >= 0) { var sq = sqrt(disc); ts.push((-b + sq) / (2 * a), (-b - sq) / (2 * a)); }
      }
    });
    return ts.filter(function (t) { return t > 0 && t < 1; });
  }
  G.subsBBox = function (subs) {
    var x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    function inc(p) { if (p.x < x0) x0 = p.x; if (p.y < y0) y0 = p.y; if (p.x > x1) x1 = p.x; if (p.y > y1) y1 = p.y; }
    subs.forEach(function (sp) {
      sp.pts.forEach(function (a) { inc(a); });
      G.eachSeg(sp, function (a, b) {
        if (G.isLineSeg(a, b)) return;
        var s = segPts(a, b);
        cubicExtrema(s[0], s[1], s[2], s[3]).forEach(function (t) { inc(G.bez(s[0], s[1], s[2], s[3], t)); });
      });
    });
    if (x0 === Infinity) return null;
    return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
  };
  G.unionBox = function (a, b) {
    if (!a) return b; if (!b) return a;
    var x0 = min(a.x, b.x), y0 = min(a.y, b.y), x1 = max(a.x + a.w, b.x + b.w), y1 = max(a.y + a.h, b.y + b.h);
    return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
  };
  G.boxOfPoints = function (pts) {
    var x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    pts.forEach(function (p) { if (p.x < x0) x0 = p.x; if (p.y < y0) y0 = p.y; if (p.x > x1) x1 = p.x; if (p.y > y1) y1 = p.y; });
    return x0 === Infinity ? null : { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
  };
  G.boxesTouch = function (a, b) { return a.x <= b.x + b.w && b.x <= a.x + a.w && a.y <= b.y + b.h && b.y <= a.y + a.h; };

  /* ---------- primitive shapes → subpaths (local coords) ---------- */
  G.rectSubs = function (x, y, w, h, r) {
    r = max(0, min(r || 0, abs(w) / 2, abs(h) / 2));
    if (r < 1e-6) {
      return [{ closed: true, pts: [G.A(x, y), G.A(x + w, y), G.A(x + w, y + h), G.A(x, y + h)] }];
    }
    var k = KAPPA * r, pts = [];
    function an(px, py, ix, iy, ox, oy) { return { x: px, y: py, ix: ix, iy: iy, ox: ox, oy: oy, s: false }; }
    pts.push(an(x + r, y, x + r - k, y, x + r, y));
    pts.push(an(x + w - r, y, x + w - r, y, x + w - r + k, y));
    pts.push(an(x + w, y + r, x + w, y + r - k, x + w, y + r));
    pts.push(an(x + w, y + h - r, x + w, y + h - r, x + w, y + h - r + k));
    pts.push(an(x + w - r, y + h, x + w - r + k, y + h, x + w - r, y + h));
    pts.push(an(x + r, y + h, x + r, y + h, x + r - k, y + h));
    pts.push(an(x, y + h - r, x, y + h - r + k, x, y + h - r));
    pts.push(an(x, y + r, x, y + r, x, y + r - k));
    return [{ closed: true, pts: pts }];
  };
  G.ellipseSubs = function (cx, cy, rx, ry) {
    var kx = KAPPA * rx, ky = KAPPA * ry;
    return [{
      closed: true, pts: [
        { x: cx, y: cy - ry, ix: cx - kx, iy: cy - ry, ox: cx + kx, oy: cy - ry, s: true },
        { x: cx + rx, y: cy, ix: cx + rx, iy: cy - ky, ox: cx + rx, oy: cy + ky, s: true },
        { x: cx, y: cy + ry, ix: cx + kx, iy: cy + ry, ox: cx - kx, oy: cy + ry, s: true },
        { x: cx - rx, y: cy, ix: cx - rx, iy: cy + ky, ox: cx - rx, oy: cy - ky, s: true }
      ]
    }];
  };
  G.polygonSubs = function (cx, cy, r, n) {
    n = max(3, Math.round(n)); var pts = [];
    for (var k = 0; k < n; k++) { var a = -PI / 2 + 2 * PI * k / n; pts.push(G.A(cx + r * Math.cos(a), cy + r * Math.sin(a))); }
    return [{ closed: true, pts: pts }];
  };
  G.starSubs = function (cx, cy, r1, r2, n) {
    n = max(2, Math.round(n)); var pts = [];
    for (var k = 0; k < 2 * n; k++) { var a = -PI / 2 + PI * k / n, r = k % 2 ? r2 : r1; pts.push(G.A(cx + r * Math.cos(a), cy + r * Math.sin(a))); }
    return [{ closed: true, pts: pts }];
  };

  /* ---------- path data ---------- */
  function fmt(n) { var v = Math.round(n * 1000) / 1000; if (v === 0) v = 0; return String(v); }
  G.fmt = fmt;
  G.toD = function (subs, m) {
    var out = [];
    subs.forEach(function (sp) {
      if (!sp.pts.length) return;
      var pts = sp.pts;
      if (m && !G.isIdentity(m)) pts = G.transformSubs([sp], m)[0].pts;
      out.push('M' + fmt(pts[0].x) + ' ' + fmt(pts[0].y));
      G.eachSeg({ closed: sp.closed, pts: pts }, function (a, b, i, j) {
        if (sp.closed && j === 0 && G.isLineSeg(a, b)) return; // Z closes with a line
        if (G.isLineSeg(a, b)) out.push('L' + fmt(b.x) + ' ' + fmt(b.y));
        else out.push('C' + fmt(a.ox) + ' ' + fmt(a.oy) + ' ' + fmt(b.ix) + ' ' + fmt(b.iy) + ' ' + fmt(b.x) + ' ' + fmt(b.y));
      });
      if (sp.closed) out.push('Z');
    });
    return out.join('');
  };

  // Full SVG path data parser (all commands incl. arcs) → subpaths
  G.parseD = function (d) {
    var i = 0, n = d.length, subs = [], cur = null, cx = 0, cy = 0, sx = 0, sy = 0, cmd = '', lastC = null, lastQ = null;
    function skip() { while (i < n && /[\s,]/.test(d[i])) i++; }
    function num() {
      skip();
      var m = /^[-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?/.exec(d.slice(i, i + 40));
      if (!m) throw new Error('bad number');
      i += m[0].length; return parseFloat(m[0]);
    }
    function flag() { skip(); var c = d[i]; if (c !== '0' && c !== '1') throw new Error('bad flag'); i++; return c === '1' ? 1 : 0; }
    function hasNum() { skip(); return i < n && /[-+.\d]/.test(d[i]); }
    function ensure() { if (!cur) { cur = { closed: false, pts: [G.A(cx, cy)] }; subs.push(cur); } }
    function lineTo(x, y) { ensure(); cur.pts.push(G.A(x, y)); cx = x; cy = y; }
    function cubicTo(x1, y1, x2, y2, x, y) {
      ensure(); var l = cur.pts[cur.pts.length - 1]; l.ox = x1; l.oy = y1;
      cur.pts.push({ x: x, y: y, ix: x2, iy: y2, ox: x, oy: y, s: false }); cx = x; cy = y;
    }
    function arcTo(rx, ry, rot, large, sweep, x, y) {
      if (rx === 0 || ry === 0) { lineTo(x, y); return; }
      G.arcToCubics(cx, cy, rx, ry, rot, large, sweep, x, y).forEach(function (c) { cubicTo(c[0], c[1], c[2], c[3], c[4], c[5]); });
      cx = x; cy = y;
    }
    try {
      while (i < n) {
        skip(); if (i >= n) break;
        var ch = d[i];
        if (/[a-zA-Z]/.test(ch)) { cmd = ch; i++; }
        else if (!cmd) break;
        var rel = cmd === cmd.toLowerCase(), C = cmd.toUpperCase(), x, y, x1, y1, x2, y2;
        if (C === 'Z') {
          if (cur) {
            cur.closed = true;
            var f = cur.pts[0], l = cur.pts[cur.pts.length - 1];
            if (cur.pts.length > 1 && abs(f.x - l.x) < 1e-6 && abs(f.y - l.y) < 1e-6) { f.ix = l.ix; f.iy = l.iy; cur.pts.pop(); }
          }
          cx = sx; cy = sy; cur = null; lastC = lastQ = null;
          if (!hasNum()) { cmd = ''; } // allow next command
          continue;
        }
        do {
          switch (C) {
            case 'M':
              x = num(); y = num(); if (rel) { x += cx; y += cy; }
              cur = { closed: false, pts: [G.A(x, y)] }; subs.push(cur);
              cx = sx = x; cy = sy = y; cmd = rel ? 'l' : 'L'; C = 'L'; rel = cmd === 'l'; lastC = lastQ = null;
              break;
            case 'L': x = num(); y = num(); if (rel) { x += cx; y += cy; } lineTo(x, y); lastC = lastQ = null; break;
            case 'H': x = num(); if (rel) x += cx; lineTo(x, cy); lastC = lastQ = null; break;
            case 'V': y = num(); if (rel) y += cy; lineTo(cx, y); lastC = lastQ = null; break;
            case 'C':
              x1 = num(); y1 = num(); x2 = num(); y2 = num(); x = num(); y = num();
              if (rel) { x1 += cx; y1 += cy; x2 += cx; y2 += cy; x += cx; y += cy; }
              cubicTo(x1, y1, x2, y2, x, y); lastC = P(x2, y2); lastQ = null; break;
            case 'S':
              x2 = num(); y2 = num(); x = num(); y = num();
              if (rel) { x2 += cx; y2 += cy; x += cx; y += cy; }
              x1 = lastC ? 2 * cx - lastC.x : cx; y1 = lastC ? 2 * cy - lastC.y : cy;
              cubicTo(x1, y1, x2, y2, x, y); lastC = P(x2, y2); lastQ = null; break;
            case 'Q':
              x1 = num(); y1 = num(); x = num(); y = num();
              if (rel) { x1 += cx; y1 += cy; x += cx; y += cy; }
              cubicTo(cx + 2 / 3 * (x1 - cx), cy + 2 / 3 * (y1 - cy), x + 2 / 3 * (x1 - x), y + 2 / 3 * (y1 - y), x, y);
              lastQ = P(x1, y1); lastC = null; break;
            case 'T':
              x = num(); y = num(); if (rel) { x += cx; y += cy; }
              x1 = lastQ ? 2 * cx - lastQ.x : cx; y1 = lastQ ? 2 * cy - lastQ.y : cy;
              cubicTo(cx + 2 / 3 * (x1 - cx), cy + 2 / 3 * (y1 - cy), x + 2 / 3 * (x1 - x), y + 2 / 3 * (y1 - y), x, y);
              lastQ = P(x1, y1); lastC = null; break;
            case 'A':
              var rx = num(), ry = num(), rot = num(), la = flag(), sw = flag(); x = num(); y = num();
              if (rel) { x += cx; y += cy; }
              arcTo(abs(rx), abs(ry), rot, la, sw, x, y); lastC = lastQ = null; break;
            default: i = n;
          }
        } while (hasNum());
      }
    } catch (e) { /* keep what parsed so far */ }
    subs.forEach(function (sp) { sp.pts.forEach(function (a) { a.s = G.isSmooth(a); }); });
    return subs.filter(function (sp) { return sp.pts.length > 0; });
  };
  G.isSmooth = function (a) {
    if (!G.hasIn(a) || !G.hasOut(a)) return false;
    var u = norm(P(a.x - a.ix, a.y - a.iy)), v = norm(P(a.ox - a.x, a.oy - a.y));
    return abs(cross(u, v)) < 0.02 && dot(u, v) > 0;
  };
  // SVG arc (endpoint parameterisation) → array of cubic [x1,y1,x2,y2,x,y]
  G.arcToCubics = function (x1, y1, rx, ry, phiDeg, fa, fs, x2, y2) {
    var phi = phiDeg * PI / 180, cosp = Math.cos(phi), sinp = Math.sin(phi);
    var dx = (x1 - x2) / 2, dy = (y1 - y2) / 2;
    var x1p = cosp * dx + sinp * dy, y1p = -sinp * dx + cosp * dy;
    var lam = (x1p * x1p) / (rx * rx) + (y1p * y1p) / (ry * ry);
    if (lam > 1) { var s = sqrt(lam); rx *= s; ry *= s; }
    var num = rx * rx * ry * ry - rx * rx * y1p * y1p - ry * ry * x1p * x1p;
    var den = rx * rx * y1p * y1p + ry * ry * x1p * x1p;
    var co = sqrt(max(0, num / den)) * (fa === fs ? -1 : 1);
    var cxp = co * rx * y1p / ry, cyp = -co * ry * x1p / rx;
    var cx = cosp * cxp - sinp * cyp + (x1 + x2) / 2, cy = sinp * cxp + cosp * cyp + (y1 + y2) / 2;
    function ang(ux, uy, vx, vy) { var a = Math.atan2(ux * vy - uy * vx, ux * vx + uy * vy); return a; }
    var t1 = ang(1, 0, (x1p - cxp) / rx, (y1p - cyp) / ry);
    var dt = ang((x1p - cxp) / rx, (y1p - cyp) / ry, (-x1p - cxp) / rx, (-y1p - cyp) / ry);
    if (!fs && dt > 0) dt -= 2 * PI; else if (fs && dt < 0) dt += 2 * PI;
    var segs = Math.ceil(abs(dt) / (PI / 2) - 1e-9), out = [];
    var delta = dt / segs, k = 4 / 3 * Math.tan(delta / 4);
    for (var i = 0; i < segs; i++) {
      var a1 = t1 + i * delta, a2 = a1 + delta;
      var c1 = Math.cos(a1), s1 = Math.sin(a1), c2 = Math.cos(a2), s2 = Math.sin(a2);
      var e1 = [c1 - k * s1, s1 + k * c1], e2 = [c2 + k * s2, s2 - k * c2], e3 = [c2, s2];
      var pts = [e1, e2, e3].map(function (e) {
        var X = rx * e[0], Y = ry * e[1];
        return [cosp * X - sinp * Y + cx, sinp * X + cosp * Y + cy];
      });
      out.push([pts[0][0], pts[0][1], pts[1][0], pts[1][1], pts[2][0], pts[2][1]]);
    }
    return out;
  };

  /* ---------- flattening ---------- */
  G.flattenSeg = function (a, b, tol, out) {
    if (G.isLineSeg(a, b)) { out.push(P(b.x, b.y)); return; }
    var s = segPts(a, b);
    var L = dist(s[0], s[1]) + dist(s[1], s[2]) + dist(s[2], s[3]);
    var nseg = max(6, min(256, Math.ceil(L / (3 * (tol || 1)))));
    for (var i = 1; i <= nseg; i++) out.push(G.bez(s[0], s[1], s[2], s[3], i / nseg));
  };
  // returns [{pts:[...], closed}] in same coordinates
  G.flatten = function (subs, tol) {
    return subs.map(function (sp) {
      var pts = sp.pts.length ? [P(sp.pts[0].x, sp.pts[0].y)] : [];
      G.eachSeg(sp, function (a, b) { G.flattenSeg(a, b, tol, pts); });
      if (sp.closed && pts.length > 1) { var f = pts[0], l = pts[pts.length - 1]; if (abs(f.x - l.x) < 1e-9 && abs(f.y - l.y) < 1e-9) pts.pop(); }
      return { pts: pts, closed: sp.closed };
    });
  };
  G.polyArea = function (pts) {
    var a = 0; for (var i = 0, n = pts.length; i < n; i++) { var p = pts[i], q = pts[(i + 1) % n]; a += p.x * q.y - q.x * p.y; }
    return a / 2;
  };
  G.polyLength = function (pts, closed) {
    var L = 0; for (var i = 1; i < pts.length; i++) L += dist(pts[i - 1], pts[i]);
    if (closed && pts.length > 1) L += dist(pts[pts.length - 1], pts[0]);
    return L;
  };

  /* ---------- hit testing ---------- */
  G.winding = function (pts, p) {
    var w = 0, n = pts.length;
    for (var i = 0; i < n; i++) {
      var a = pts[i], b = pts[(i + 1) % n];
      if (a.y <= p.y) { if (b.y > p.y && ((b.x - a.x) * (p.y - a.y) - (p.x - a.x) * (b.y - a.y)) > 0) w++; }
      else if (b.y <= p.y && ((b.x - a.x) * (p.y - a.y) - (p.x - a.x) * (b.y - a.y)) < 0) w--;
    }
    return w;
  };
  // polys: [{pts, closed}] — fill treats open polys as closed (as SVG does)
  G.pointInPolys = function (polys, p, rule) {
    var w = 0;
    polys.forEach(function (pl) { if (pl.pts.length > 2) w += G.winding(pl.pts, p); });
    return rule === 'evenodd' ? (abs(w) % 2) === 1 : w !== 0;
  };
  G.distToSeg = function (p, a, b) {
    var dx = b.x - a.x, dy = b.y - a.y, l2 = dx * dx + dy * dy;
    var t = l2 ? max(0, min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / l2)) : 0;
    var x = a.x + t * dx - p.x, y = a.y + t * dy - p.y;
    return sqrt(x * x + y * y);
  };
  G.distToPolys = function (polys, p) {
    var best = Infinity;
    polys.forEach(function (pl) {
      var pts = pl.pts, n = pts.length;
      if (n === 1) best = min(best, dist(p, pts[0]));
      var last = pl.closed ? n : n - 1;
      for (var i = 0; i < last; i++) { var d = G.distToSeg(p, pts[i], pts[(i + 1) % n]); if (d < best) best = d; }
    });
    return best;
  };
  function segIntersects(a, b, c, d) {
    var d1 = cross(sub(b, a), sub(c, a)), d2 = cross(sub(b, a), sub(d, a));
    var d3 = cross(sub(d, c), sub(a, c)), d4 = cross(sub(d, c), sub(b, c));
    return ((d1 > 0) !== (d2 > 0)) && ((d3 > 0) !== (d4 > 0));
  }
  G.polysTouchRect = function (polys, r, filled) {
    var corners = [P(r.x, r.y), P(r.x + r.w, r.y), P(r.x + r.w, r.y + r.h), P(r.x, r.y + r.h)];
    for (var k = 0; k < polys.length; k++) {
      var pts = polys[k].pts, n = pts.length;
      for (var i = 0; i < n; i++) {
        var p = pts[i];
        if (p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h) return true;
      }
      var last = polys[k].closed ? n : n - 1;
      for (i = 0; i < last; i++) {
        var a = pts[i], b = pts[(i + 1) % n];
        for (var c = 0; c < 4; c++) if (segIntersects(a, b, corners[c], corners[(c + 1) % 4])) return true;
      }
    }
    if (filled) { var mid = P(r.x + r.w / 2, r.y + r.h / 2); if (G.pointInPolys(polys, mid, 'nonzero')) return true; }
    return false;
  };
  // nearest point on a subpath's segments → {i (segment start index), t, d, p}
  G.nearestOnSub = function (sp, p) {
    var best = null;
    G.eachSeg(sp, function (a, b, i) {
      var s = segPts(a, b), N = G.isLineSeg(a, b) ? 1 : 40, prev = s[0];
      for (var k = 1; k <= N; k++) {
        var t = k / N, q = N === 1 ? s[3] : G.bez(s[0], s[1], s[2], s[3], t);
        var dx = q.x - prev.x, dy = q.y - prev.y, l2 = dx * dx + dy * dy;
        var u = l2 ? max(0, min(1, ((p.x - prev.x) * dx + (p.y - prev.y) * dy) / l2)) : 0;
        var px = prev.x + u * dx, py = prev.y + u * dy, dd = sqrt((px - p.x) * (px - p.x) + (py - p.y) * (py - p.y));
        if (!best || dd < best.d) best = { i: i, t: (k - 1 + u) / N, d: dd, p: P(px, py) };
        prev = q;
      }
    });
    if (best && !G.isLineSeg(sp.pts[best.i], sp.pts[(best.i + 1) % sp.pts.length])) {
      // refine t with a few Newton-ish bisection steps
      var a = sp.pts[best.i], b = sp.pts[(best.i + 1) % sp.pts.length], s = segPts(a, b), t = best.t, step = 1 / 80;
      for (var it = 0; it < 12; it++) {
        var t0 = max(0, t - step), t1 = min(1, t + step);
        var d0 = dist(G.bez(s[0], s[1], s[2], s[3], t0), p), d1 = dist(G.bez(s[0], s[1], s[2], s[3], t1), p), dm = dist(G.bez(s[0], s[1], s[2], s[3], t), p);
        if (d0 < dm && d0 <= d1) t = t0; else if (d1 < dm) t = t1;
        step /= 2;
      }
      best.t = t; best.p = G.bez(s[0], s[1], s[2], s[3], t); best.d = dist(best.p, p);
    }
    return best;
  };
  // split segment i of subpath at t; returns index of new anchor
  G.splitSegAt = function (sp, i, t) {
    var n = sp.pts.length, a = sp.pts[i], b = sp.pts[(i + 1) % n];
    var na;
    if (G.isLineSeg(a, b)) {
      var p = lerp(a, b, t); na = G.A(p.x, p.y);
    } else {
      var s = segPts(a, b), parts = G.splitBez(s[0], s[1], s[2], s[3], t);
      a.ox = parts[0][1].x; a.oy = parts[0][1].y;
      na = { x: parts[0][3].x, y: parts[0][3].y, ix: parts[0][2].x, iy: parts[0][2].y, ox: parts[1][1].x, oy: parts[1][1].y, s: true };
      b.ix = parts[1][2].x; b.iy = parts[1][2].y;
    }
    sp.pts.splice(i + 1, 0, na);
    return i + 1;
  };

  /* ---------- Schneider curve fitting ---------- */
  function B0(u) { var t = 1 - u; return t * t * t; }
  function B1(u) { var t = 1 - u; return 3 * u * t * t; }
  function B2(u) { var t = 1 - u; return 3 * u * u * t; }
  function B3(u) { return u * u * u; }
  function chordParam(d, first, last) {
    var u = [0];
    for (var i = first + 1; i <= last; i++) u.push(u[i - first - 1] + dist(d[i], d[i - 1]));
    var tot = u[u.length - 1] || 1;
    return u.map(function (v) { return v / tot; });
  }
  function genBez(d, first, last, u, t1, t2) {
    var p0 = d[first], p3 = d[last], C00 = 0, C01 = 0, C11 = 0, X0 = 0, X1 = 0;
    for (var i = 0; i < u.length; i++) {
      var a0 = scl(t1, B1(u[i])), a1 = scl(t2, B2(u[i]));
      C00 += dot(a0, a0); C01 += dot(a0, a1); C11 += dot(a1, a1);
      var tmp = sub(d[first + i], add(scl(p0, B0(u[i]) + B1(u[i])), scl(p3, B2(u[i]) + B3(u[i]))));
      X0 += dot(a0, tmp); X1 += dot(a1, tmp);
    }
    var det = C00 * C11 - C01 * C01, al = 0, ar = 0;
    if (abs(det) > 1e-12) { al = (X0 * C11 - X1 * C01) / det; ar = (C00 * X1 - C01 * X0) / det; }
    var segL = dist(p0, p3), eps = 1e-6 * segL;
    if (al < eps || ar < eps) { al = ar = segL / 3; }
    return [p0, add(p0, scl(t1, al)), add(p3, scl(t2, ar)), p3];
  }
  function maxError(d, first, last, bez, u) {
    var maxD = 0, split = Math.floor((last - first + 1) / 2) + first;
    for (var i = first + 1; i < last; i++) {
      var p = G.bez(bez[0], bez[1], bez[2], bez[3], u[i - first]), dd = dist(p, d[i]);
      if (dd >= maxD) { maxD = dd; split = i; }
    }
    if (split <= first) split = first + 1; if (split >= last) split = last - 1;
    return [maxD, split];
  }
  function reparam(d, first, last, u, bez) {
    return u.map(function (uu, k) {
      var p = d[first + k];
      var q = G.bez(bez[0], bez[1], bez[2], bez[3], uu);
      var q1 = [scl(sub(bez[1], bez[0]), 3), scl(sub(bez[2], bez[1]), 3), scl(sub(bez[3], bez[2]), 3)];
      var q2 = [scl(sub(q1[1], q1[0]), 2), scl(sub(q1[2], q1[1]), 2)];
      var mt = 1 - uu;
      var d1 = add(add(scl(q1[0], mt * mt), scl(q1[1], 2 * mt * uu)), scl(q1[2], uu * uu));
      var d2 = add(scl(q2[0], mt), scl(q2[1], uu));
      var numr = dot(sub(q, p), d1), den = dot(d1, d1) + dot(sub(q, p), d2);
      if (abs(den) < 1e-12) return uu;
      var r = uu - numr / den;
      return max(0, min(1, r));
    });
  }
  function fitCubic(d, first, last, t1, t2, err, out, depth) {
    if (last - first === 1) {
      var dd = dist(d[first], d[last]) / 3;
      out.push([d[first], add(d[first], scl(t1, dd)), add(d[last], scl(t2, dd)), d[last]]);
      return;
    }
    var u = chordParam(d, first, last), bez = genBez(d, first, last, u, t1, t2);
    var me = maxError(d, first, last, bez, u);
    if (me[0] < err) { out.push(bez); return; }
    if (me[0] < err * 4) {
      for (var i = 0; i < 16; i++) {
        var up = reparam(d, first, last, u, bez);
        bez = genBez(d, first, last, up, t1, t2);
        me = maxError(d, first, last, bez, up);
        if (me[0] < err) { out.push(bez); return; }
        u = up;
      }
    }
    if (depth > 30) { out.push(bez); return; }
    var split = me[1];
    var tc = norm(sub(d[split - 1], d[split + 1]));
    if (len(tc) < 0.5) tc = norm(sub(d[split - 1], d[split]));
    fitCubic(d, first, split, t1, tc, err, out, depth + 1);
    fitCubic(d, split, last, scl(tc, -1), t2, err, out, depth + 1);
  }
  // fit a polyline run (array of points) → list of cubics [p0,c1,c2,p3]; t1/t2 optional tangents
  G.fitRun = function (pts, err, t1, t2) {
    var d = [pts[0]];
    for (var i = 1; i < pts.length; i++) if (dist(pts[i], d[d.length - 1]) > 1e-6) d.push(pts[i]);
    if (d.length < 2) return [];
    if (d.length === 2) return [[d[0], d[0], d[1], d[1]]];
    t1 = t1 || norm(sub(d[1], d[0])); t2 = t2 || norm(sub(d[d.length - 2], d[d.length - 1]));
    var out = []; fitCubic(d, 0, d.length - 1, t1, t2, err, out, 0);
    return out;
  };
  // cubic list → anchors
  G.cubicsToSub = function (cubics, closed) {
    if (!cubics.length) return null;
    var pts = [{ x: cubics[0][0].x, y: cubics[0][0].y, ix: cubics[0][0].x, iy: cubics[0][0].y, ox: cubics[0][1].x, oy: cubics[0][1].y }];
    for (var i = 0; i < cubics.length; i++) {
      var c = cubics[i], prev = pts[pts.length - 1];
      prev.ox = c[1].x; prev.oy = c[1].y;
      pts.push({ x: c[3].x, y: c[3].y, ix: c[2].x, iy: c[2].y, ox: c[3].x, oy: c[3].y });
    }
    if (closed && pts.length > 2) { var l = pts.pop(); pts[0].ix = l.ix; pts[0].iy = l.iy; }
    pts.forEach(function (a) {
      // snap degenerate handles
      if (dist(a, P(a.ix, a.iy)) < 1e-4) { a.ix = a.x; a.iy = a.y; }
      if (dist(a, P(a.ox, a.oy)) < 1e-4) { a.ox = a.x; a.oy = a.y; }
      a.s = G.isSmooth(a);
    });
    return { closed: !!closed, pts: pts };
  };
  // freehand points → subpath (pencil)
  G.fitFreehand = function (raw, err, closed) {
    var pts = [raw[0]];
    for (var i = 1; i < raw.length; i++) if (dist(raw[i], pts[pts.length - 1]) > err * 0.25) pts.push(raw[i]);
    if (pts.length < 2) pts.push(raw[raw.length - 1]);
    // light smoothing (keeps ends)
    if (pts.length > 4) {
      var sm = pts.map(function (p, k) {
        if (k === 0 || k === pts.length - 1) return p;
        var a = pts[k - 1], b = pts[k + 1];
        return P((a.x + 2 * p.x + b.x) / 4, (a.y + 2 * p.y + b.y) / 4);
      });
      pts = sm;
    }
    if (closed) {
      pts.push(P(pts[0].x, pts[0].y));
      var t = norm(sub(pts[1], pts[pts.length - 2]));
      var cub = G.fitRun(pts, err, t, scl(t, -1));
      return G.cubicsToSub(cub, true);
    }
    return G.cubicsToSub(G.fitRun(pts, err), false);
  };

  /* ---------- polygon boolean operations ----------
     Robust arrangement-based approach: split all edges of all operands at every
     intersection (incl. collinear overlaps), classify each unique edge by sampling
     the region on both sides against every operand (winding rule aware), keep
     edges where the boolean result changes, orient them with the result on the
     left and chain them into rings. Works for N operands, holes, touching and
     coincident edges. */
  var QG = 1024;
  function qv(v) { return Math.round(v * QG) / QG; }
  function key(p) { return p.x + ',' + p.y; }
  G.qkey = function (p) { return qv(p.x) + ',' + qv(p.y); };

  G.boolean = function (operands, op, cornerKeys) {
    cornerKeys = cornerKeys || new Set();
    var opData = operands.map(function (o) {
      var rings = o.rings.map(function (r) {
        var q = []; r.forEach(function (p) { var v = P(qv(p.x), qv(p.y)); if (!q.length || v.x !== q[q.length - 1].x || v.y !== q[q.length - 1].y) q.push(v); });
        if (q.length > 1 && q[0].x === q[q.length - 1].x && q[0].y === q[q.length - 1].y) q.pop();
        return q;
      }).filter(function (r) { return r.length >= 3; });
      return { rule: o.rule || 'nonzero', rings: rings.map(function (r) { return { pts: r, box: G.boxOfPoints(r) }; }) };
    });
    var edges = [];
    opData.forEach(function (o, k) {
      o.rings.forEach(function (r) {
        var pts = r.pts, n = pts.length;
        for (var i = 0; i < n; i++) {
          var a = pts[i], b = pts[(i + 1) % n];
          if (a.x === b.x && a.y === b.y) continue;
          edges.push({ a: a, b: b, k: k, sp: [], x0: min(a.x, b.x), x1: max(a.x, b.x), y0: min(a.y, b.y), y1: max(a.y, b.y) });
        }
      });
    });
    edges.sort(function (e, f) { return e.x0 - f.x0; });
    var TINY = 1e-10;
    for (var i = 0; i < edges.length; i++) {
      var e = edges[i];
      for (var j = i + 1; j < edges.length && edges[j].x0 <= e.x1; j++) {
        var f = edges[j];
        if (f.y0 > e.y1 || f.y1 < e.y0) continue;
        var r = sub(e.b, e.a), s = sub(f.b, f.a), den = cross(r, s), qp = sub(f.a, e.a);
        var lr = len(r), ls = len(s);
        if (abs(den) > 1e-12 * lr * ls) {
          var t = cross(qp, s) / den, u = cross(qp, r) / den;
          if (t < -1e-9 || t > 1 + 1e-9 || u < -1e-9 || u > 1 + 1e-9) continue;
          var X;
          if (t <= TINY) X = e.a; else if (t >= 1 - TINY) X = e.b;
          else if (u <= TINY) X = f.a; else if (u >= 1 - TINY) X = f.b;
          else X = P(qv(e.a.x + t * r.x), qv(e.a.y + t * r.y));
          var ti = t > TINY && t < 1 - TINY, ui = u > TINY && u < 1 - TINY;
          if (ti) e.sp.push(X);
          if (ui) f.sp.push(X);
          if ((ti || ui) && e.k !== f.k) cornerKeys.add(key(X));
        } else {
          // parallel: collinear?
          if (abs(cross(qp, r)) / (lr || 1) > 1e-6) continue;
          var rr = dot(r, r), ss = dot(s, s);
          [f.a, f.b].forEach(function (p) { var tt = dot(sub(p, e.a), r) / rr; if (tt > TINY && tt < 1 - TINY) e.sp.push(p); });
          [e.a, e.b].forEach(function (p) { var tt = dot(sub(p, f.a), s) / ss; if (tt > TINY && tt < 1 - TINY) f.sp.push(p); });
        }
      }
    }
    // split edges & dedupe
    var segs = new Map();
    edges.forEach(function (e) {
      var pts = [e.a].concat(e.sp.sort(function (p, q) { return dot(sub(p, e.a), sub(e.b, e.a)) - dot(sub(q, e.a), sub(e.b, e.a)); }), [e.b]);
      for (var i = 0; i < pts.length - 1; i++) {
        var a = pts[i], b = pts[i + 1];
        if (a.x === b.x && a.y === b.y) continue;
        var ka = key(a), kb = key(b), kk = ka < kb ? ka + '|' + kb : kb + '|' + ka;
        if (!segs.has(kk)) segs.set(kk, { a: a, b: b });
      }
    });
    function inside(k, p) {
      var o = opData[k], w = 0;
      for (var i = 0; i < o.rings.length; i++) {
        var rg = o.rings[i], bx = rg.box;
        if (p.x < bx.x || p.x > bx.x + bx.w || p.y < bx.y || p.y > bx.y + bx.h) continue;
        w += G.winding(rg.pts, p);
      }
      return o.rule === 'evenodd' ? (abs(w) % 2) === 1 : w !== 0;
    }
    function evalOp(ins) {
      var c = 0, i;
      switch (op) {
        case 'union': return ins.some(Boolean);
        case 'intersect': return ins.every(Boolean);
        case 'xor': for (i = 0; i < ins.length; i++) if (ins[i]) c++; return c % 2 === 1;
        case 'minus': if (!ins[0]) return false; for (i = 1; i < ins.length; i++) if (ins[i]) return false; return true;
      }
      return false;
    }
    var EPSO = 1 / 256, directed = [];
    segs.forEach(function (sg) {
      var d = sub(sg.b, sg.a), l = len(d), nrm = P(-d.y / l, d.x / l), m = lerp(sg.a, sg.b, 0.5);
      var L = add(m, scl(nrm, EPSO)), R = sub(m, scl(nrm, EPSO));
      var insL = [], insR = [];
      for (var k = 0; k < opData.length; k++) { insL.push(inside(k, L)); insR.push(inside(k, R)); }
      var rl = evalOp(insL), rr = evalOp(insR);
      if (rl === rr) return;
      directed.push(rl ? { a: sg.a, b: sg.b } : { a: sg.b, b: sg.a });
    });
    // chain
    var out = new Map();
    directed.forEach(function (e, idx) { e.used = false; var k = key(e.a); if (!out.has(k)) out.set(k, []); out.get(k).push(e); });
    var rings = [];
    directed.forEach(function (e0) {
      if (e0.used) return;
      var ring = [e0.a], cur = e0, startK = key(e0.a), guard = 0;
      e0.used = true;
      while (guard++ < 1e6) {
        var endK = key(cur.b);
        if (endK === startK) break;
        ring.push(cur.b);
        var cands = (out.get(endK) || []).filter(function (c) { return !c.used; });
        if (!cands.length) break;
        var din = sub(cur.b, cur.a), best = null, bestA = -Infinity;
        cands.forEach(function (c) {
          var dout = sub(c.b, c.a), a = Math.atan2(cross(din, dout), dot(din, dout));
          if (a > bestA) { bestA = a; best = c; }
        });
        best.used = true; cur = best;
      }
      if (ring.length >= 3) rings.push(ring);
    });
    // clean: remove collinear points & tiny rings
    return rings.map(function (r) {
      var changed = true;
      while (changed && r.length > 3) {
        changed = false;
        for (var i = 0; i < r.length && r.length > 3; i++) {
          var a = r[(i + r.length - 1) % r.length], b = r[i], c = r[(i + 1) % r.length];
          var u = sub(b, a), v = sub(c, b);
          if (abs(cross(u, v)) < 1e-9 * (len(u) * len(v) + 1e-12) && dot(u, v) > 0 && !cornerKeys.has(key(b))) { r.splice(i, 1); changed = true; i--; }
        }
      }
      return r;
    }).filter(function (r) { return r.length >= 3 && abs(G.polyArea(r)) > 0.01; });
  };

  // collect corner keys from (doc-space) subpaths: anchors whose in/out tangents differ
  G.cornerKeysOf = function (subs, set) {
    subs.forEach(function (sp) {
      var n = sp.pts.length;
      sp.pts.forEach(function (a, i) {
        var prev = sp.pts[(i - 1 + n) % n], next = sp.pts[(i + 1) % n];
        if (!sp.closed && (i === 0 || i === n - 1)) { set.add(G.qkey(a)); return; }
        var tin = G.hasIn(a) ? P(a.x - a.ix, a.y - a.iy) : (G.hasOut(prev) ? P(a.x - prev.ox, a.y - prev.oy) : P(a.x - prev.x, a.y - prev.y));
        var tout = G.hasOut(a) ? P(a.ox - a.x, a.oy - a.y) : (G.hasIn(next) ? P(next.ix - a.x, next.iy - a.y) : P(next.x - a.x, next.y - a.y));
        var u = norm(tin), v = norm(tout);
        if (len(u) < 0.5 || len(v) < 0.5) return;
        var ang = abs(Math.atan2(cross(u, v), dot(u, v)));
        if (ang > 3 * PI / 180) set.add(G.qkey(a));
      });
    });
    return set;
  };

  // polygon rings → bezier subpaths: corners kept, smooth runs curve-fitted
  G.fitRings = function (rings, cornerKeys, opts) {
    opts = opts || {};
    var err = opts.err || 0.35, angT = (opts.cornerAngle || 32) * PI / 180;
    return rings.map(function (r) {
      var n = r.length, isC = r.map(function (p, i) {
        if (cornerKeys && cornerKeys.has(key(p))) return true;
        var a = r[(i - 1 + n) % n], c = r[(i + 1) % n];
        var u = sub(p, a), v = sub(c, p);
        return abs(Math.atan2(cross(u, v), dot(u, v))) > angT;
      });
      var cIdx = []; isC.forEach(function (c, i) { if (c) cIdx.push(i); });
      var cubics = [];
      function runFrom(i0, i1) { // inclusive indices, cyclic
        var pts = [], i = i0; pts.push(r[i]);
        do { i = (i + 1) % n; pts.push(r[i]); } while (i !== i1);
        return pts;
      }
      function addRun(pts, t1, t2) {
        if (pts.length === 2) { cubics.push([pts[0], pts[0], pts[1], pts[1]]); return; }
        var a = pts[0], b = pts[pts.length - 1], chord = sub(b, a), cl = len(chord), straight = true;
        for (var k = 1; k < pts.length - 1 && straight; k++) {
          var dd = cl > 1e-9 ? abs(cross(chord, sub(pts[k], a))) / cl : dist(pts[k], a);
          if (dd > 0.02) straight = false;
        }
        if (straight && cl > 1e-9) { cubics.push([a, a, b, b]); return; }
        G.fitRun(pts, err, t1, t2).forEach(function (c) { cubics.push(c); });
      }
      if (!cIdx.length) {
        var pts = r.slice(); pts.push(r[0]);
        var t = norm(sub(r[1], r[n - 1]));
        addRun(pts, t, scl(t, -1));
      } else {
        for (var k = 0; k < cIdx.length; k++) {
          var i0 = cIdx[k], i1 = cIdx[(k + 1) % cIdx.length];
          if (cIdx.length === 1) i1 = i0;
          addRun(runFrom(i0, i1));
        }
      }
      // line cubics → anchors w/o handles
      var sp = G.cubicsToSub(cubics.map(function (c) {
        if (c[1] === c[0] && c[2] === c[3]) return [c[0], P(c[0].x, c[0].y), P(c[3].x, c[3].y), c[3]];
        return c;
      }), true);
      return sp;
    }).filter(Boolean);
  };

  /* ---------- Slopify ---------- */
  function rng(seed) { var s = seed >>> 0 || 1; return function () { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; return ((s >>> 0) % 100000) / 100000; }; }
  function resample(pts, closed, spacing) {
    var ring = pts.slice(); if (closed) ring.push(pts[0]);
    var out = [ring[0]], acc = 0;
    for (var i = 1; i < ring.length; i++) {
      var a = ring[i - 1], b = ring[i], d = dist(a, b), pos = spacing - acc;
      while (pos <= d) { out.push(lerp(a, b, pos / d)); pos += spacing; }
      acc = d - (pos - spacing);
    }
    if (closed && out.length > 2 && dist(out[out.length - 1], out[0]) < spacing * 0.5) out.pop();
    return out;
  }
  G.slopify = function (subs, opts) {
    opts = opts || {};
    var rand = rng(opts.seed || (Math.random() * 1e9) | 0);
    var polys = G.flatten(subs, 0.5).filter(function (p) { return p.pts.length >= 3; });
    if (!polys.length) return null;
    var all = []; polys.forEach(function (p) { all = all.concat(p.pts); });
    var bb = G.boxOfPoints(all), w = max(bb.w, 1), h = max(bb.h, 1), S = min(w, h), cy = bb.y + h / 2;
    var amp = max(1.2, S * 0.028);
    var waves = [3, 5, 8, 13].map(function (k, i) { return { k: k, a: [1, 0.55, 0.32, 0.18][i] * (0.7 + rand() * 0.6), ph: rand() * PI * 2 }; });
    var wob = polys.map(function (pl) {
      var perim = G.polyLength(pl.pts, true), sp = max(1.5, perim / 220);
      var pts = resample(pl.pts, true, sp), n = pts.length, area = G.polyArea(pts), sgn = area > 0 ? 1 : -1;
      var res = [];
      for (var i = 0; i < n; i++) {
        var a = pts[(i - 1 + n) % n], c = pts[(i + 1) % n], t = norm(sub(c, a));
        var nrm = sgn > 0 ? P(t.y, -t.x) : P(-t.y, t.x), u = i / n, nz = 0;
        waves.forEach(function (wv) { nz += wv.a * Math.sin(2 * PI * wv.k * u + wv.ph); });
        res.push({ p: add(pts[i], scl(nrm, amp * nz * 0.6)), n: nrm });
      }
      return res;
    });
    // drips from the biggest ring
    var big = wob.reduce(function (a, b) { return b.length > a.length ? b : a; });
    var cands = big.filter(function (o) { return o.n.y > 0.55 && o.p.y > cy; });
    var drips = [], count = 2 + Math.floor(rand() * 3), tries = 0, chosen = [];
    while (cands.length && chosen.length < count && tries++ < 60) {
      var c = cands[Math.floor(rand() * cands.length)];
      if (chosen.every(function (q) { return abs(q.p.x - c.p.x) > w * 0.16; })) chosen.push(c);
    }
    chosen.forEach(function (c) {
      var x = c.p.x, y = c.p.y, wn = max(1.6, w * (0.028 + rand() * 0.03)), L = h * (0.1 + rand() * 0.22) + wn * 2;
      var rb = wn * (1.3 + rand() * 0.35), y0 = y - wn * 2.2, yb = y + L - rb, left = [], right = [];
      for (var k = 0; k <= 10; k++) {
        var s = k / 10, yy = y0 + s * (yb - y0), ww = wn * (0.82 + 1.25 * Math.pow(1 - s, 3));
        left.push(P(x - ww, yy)); right.unshift(P(x + ww, yy));
      }
      drips.push(left.concat(right));
      var circ = []; for (k = 0; k < 28; k++) { var an = 2 * PI * k / 28; circ.push(P(x + rb * Math.cos(an), yb + rb * Math.sin(an))); }
      drips.push(circ);
    });
    var operands = [{ rings: wob.map(function (r) { return r.map(function (o) { return o.p; }); }), rule: opts.rule || 'nonzero' }];
    drips.forEach(function (d) { operands.push({ rings: [d], rule: 'nonzero' }); });
    var rings = G.boolean(operands, 'union', new Set());
    var bigA = 0; rings.forEach(function (r) { bigA = max(bigA, abs(G.polyArea(r))); });
    rings = rings.filter(function (r) { return abs(G.polyArea(r)) > max(4, bigA * 0.003); });
    var body = G.fitRings(rings, null, { err: max(0.4, S * 0.004), cornerAngle: 70 });
    // gloss highlight
    var gloss = null;
    if (S > 24) {
      var gx = bb.x + w * 0.3, gy = bb.y + h * 0.27;
      var testPolys = rings.map(function (r) { return { pts: r, closed: true }; });
      if (G.pointInPolys(testPolys, P(gx, gy), 'nonzero')) {
        gloss = G.transformSubs(G.ellipseSubs(gx, gy, w * 0.1, h * 0.055), G.rotate(-35 * PI / 180, gx, gy));
      }
    }
    return { body: body, gloss: gloss, box: bb };
  };

  window.SVGeom = G;
})();
