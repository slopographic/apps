/* Slop Font: strokes made into outlines. A skeleton (the centre line of a letter, as lines or SVG path data) drawn with a
 * pen of a given width becomes filled contours: each segment a band, each joint and end a round, square or flat cap,
 * all merged into one outline with SlopVector's polygon booleans and the curves refitted. This is how a monoline font is
 * drawn quickly, by hand (the Stroke tool) or by the assistant ("a rounded monospace font for the digits"). Pure; needs
 * the paths module and SVGeom (in Node, pass them). Font units, y up.
 *   outline(strokes, opts) → contours
 *     strokes: [{ points: [[x, y], …], closed? } | { d: 'M… C…' }]   (d is flattened; its curves become smooth bands)
 *     opts: { width (default 80), cap: round | square | butt, join: round | bevel | miter } */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory;
  else { const F = root.SlopFont; F.stroke = factory(F.paths, root.SVGeom); }
})(typeof window !== 'undefined' ? window : globalThis, function (P, G) {
  'use strict';
  const CIRCLE = 32;
  const ccw = (pts) => (G.polyArea(pts) < 0 ? pts.slice().reverse() : pts);
  function circle(c, r) {
    const out = [];
    for (let i = 0; i < CIRCLE; i++) { const a = (2 * Math.PI * i) / CIRCLE; out.push({ x: c.x + r * Math.cos(a), y: c.y + r * Math.sin(a) }); }
    return out;
  }
  /** The small wedge that fills the outside of a bend between two bands. */
  function bevel(p, d1, d2, r, turn) {
    const s = turn > 0 ? -1 : 1;
    return [p, G.add(p, { x: -d1.y * r * s, y: d1.x * r * s }), G.add(p, { x: -d2.y * r * s, y: d2.x * r * s })];
  }
  /** Douglas–Peucker on a closed ring (the joints' tiny notches go; real corners, in keepKeys, stay). */
  function simplify(ring, eps, keepKeys) {
    const n = ring.length;
    if (n < 5) return ring;
    const keep = new Uint8Array(n);
    ring.forEach((p, i) => { if (keepKeys.has(G.qkey(p))) keep[i] = 1; });
    let far = 0;
    for (let i = 1; i < n; i++) if (G.dist(ring[i], ring[0]) > G.dist(ring[far], ring[0])) far = i;
    keep[0] = keep[far] = 1;
    const dp = (a, b) => {   // indexes on the ring, b may pass the end
      let best = eps, at = -1;
      const A = ring[a % n], B = ring[b % n], L = G.dist(A, B) || 1;
      for (let i = a + 1; i < b; i++) { const q = ring[i % n], d = Math.abs(G.cross(G.sub(B, A), G.sub(q, A))) / L; if (d > best) { best = d; at = i; } }
      if (at >= 0) { keep[at % n] = 1; dp(a, at); dp(at, b); }
    };
    dp(0, far); dp(far, n);
    return ring.filter((_, i) => keep[i]);
  }
  function polylines(strokes) {
    const out = [];
    for (const s of strokes || []) {
      if (s && typeof s.d === 'string') {
        let subs;
        try { subs = G.parseD(s.d.slice(0, 100000)); } catch (e) { throw new Error('The stroke path could not be read: ' + e.message); }
        for (const f of G.flatten(subs, 2)) if (f.pts.length) out.push({ pts: f.pts, closed: f.closed });
        continue;
      }
      const pts = (s && Array.isArray(s.points) ? s.points : []).slice(0, 2000).map((p) => (Array.isArray(p) ? { x: Number(p[0]), y: Number(p[1]) } : { x: Number(p.x), y: Number(p.y) }))
        .filter((p) => Number.isFinite(p.x) && Number.isFinite(p.y));
      if (pts.length) out.push({ pts, closed: !!(s && s.closed) });
    }
    return out;
  }
  function outline(strokes, opts = {}) {
    const w = Math.max(1, Math.min(2000, Number(opts.width) || 80)), r = w / 2;
    const cap = opts.cap || 'round', join = opts.join || 'round';
    const rings = [], corners = new Set();
    const keep = (pts) => { if (cap !== 'round' || join !== 'round') pts.forEach((p) => corners.add(G.qkey(p))); return pts; };
    for (const { pts: raw, closed } of polylines(strokes)) {
      // points closer than a quarter of the pen are merged (a flattened curve has many), so the union stays small
      const step = Math.max(2, w / 4), pts = [];
      raw.forEach((p, i) => { if (!pts.length || G.dist(p, pts[pts.length - 1]) >= step || (i === raw.length - 1 && !closed)) pts.push(p); });
      if (!closed && pts.length > 2 && G.dist(pts[pts.length - 1], pts[pts.length - 2]) < step) pts.splice(pts.length - 2, 1);
      while (closed && pts.length > 2 && G.dist(pts[0], pts[pts.length - 1]) < step) pts.pop();
      if (pts.length === 1) { rings.push(cap === 'round' ? circle(pts[0], r) : keep(ccw([{ x: pts[0].x - r, y: pts[0].y - r }, { x: pts[0].x + r, y: pts[0].y - r }, { x: pts[0].x + r, y: pts[0].y + r }, { x: pts[0].x - r, y: pts[0].y + r }]))); continue; }
      const n = pts.length, segs = closed ? n : n - 1;
      for (let i = 0; i < segs; i++) {
        let a = pts[i], b = pts[(i + 1) % n];
        const d = G.norm(G.sub(b, a)), nrm = { x: -d.y * r, y: d.x * r };
        // bands overlap a little at every joint (shared edges alone do not merge reliably); an open stroke's ends stay
        const e = Math.min(r, r * 0.06 + 0.5), first = !closed && i === 0, lastSeg = !closed && i === segs - 1;
        a = G.sub(a, G.scl(d, first ? (cap === 'square' ? r : 0) : e)); b = G.add(b, G.scl(d, lastSeg ? (cap === 'square' ? r : 0) : e));
        rings.push(keep(ccw([G.add(a, nrm), G.sub(a, nrm), G.sub(b, nrm), G.add(b, nrm)])));
      }
      for (let i = 0; i < n; i++) {
        const end = !closed && (i === 0 || i === n - 1);
        if (end) { if (cap === 'round') rings.push(circle(pts[i], r)); continue; }
        const prev = pts[(i - 1 + n) % n], p = pts[i], next = pts[(i + 1) % n];
        const d1 = G.norm(G.sub(p, prev)), d2 = G.norm(G.sub(next, p)), turn = G.cross(d1, d2);
        if (Math.abs(turn) < 0.05 && G.dot(d1, d2) > 0) continue;   // a gentle bend: the bands' overlap covers it
        if (join === 'round') { rings.push(circle(p, r)); continue; }
        const tri = bevel(p, d1, d2, r, turn), o1 = tri[1], o2 = tri[2];
        if (join === 'miter') {
          const t = (G.cross(G.sub(o2, o1), d2)) / (G.cross(d1, d2) || 1e-9), m = G.add(o1, G.scl(d1, t));
          if (G.dist(m, p) <= 4 * r) tri.splice(2, 0, m);
        }
        rings.push(keep(ccw(tri)));
      }
    }
    if (!rings.length) return [];
    const merged = G.boolean([{ rings, rule: 'nonzero' }], 'union', corners).map((ring) => simplify(ring, Math.max(0.6, w * 0.012), corners));
    return P.orient(P.clean(G.fitRings(merged, corners, { err: 1, cornerAngle: 40 }).map((s) => ({ closed: true, pts: s.pts }))));
  }
  return { outline, polylines };
});
