/* The tool vortex's maths (home/vortex/vortex.js draws it). Pure functions, no DOM: unit-tested in
 * tests/node/vortex-orbit.test.mjs. Classic script: sets window.SlopVortexMath, and module.exports under Node.
 *
 * An icon lives on a spiral. Its life runs from phase 0 (it appears at the rim, near and large) to phase 1 (it has sunk
 * into the centre, far and small). Its normalised radius d (1 at the rim, 0 at the centre) is also its depth.
 *   tier({ reduced, cores, memory, saveData, coarse, width }) -> 'static' | 'lite' | 'full'
 *   TIERS[tier] -> { icons, fps, trail }               how many icons, the frame-rate cap, trail steps
 *   spiral(phase, a0, turns) -> { d, a }               depth and angle on the spiral
 *   place(d, a, geom, par) -> { x, y, z, scale }       stage position, front/back z (-1 back .. 1 front), size factor
 *   alpha(phase, d, z) -> 0..1                         fade in at the rim, fade out into the centre, back dimmer
 *   keepOut(x, y, rects, margin) -> 0.05..1            how much an icon shows over the text boxes (rects)
 *   ring(n, geom) -> [{ d, a }]                        the static ring for reduced motion
 *   due(now, last, fps) -> bool                        whether a frame should be drawn under the fps cap */
(function () {
  'use strict';
  const TAU = Math.PI * 2;
  const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
  const smooth = (e0, e1, x) => { const t = clamp((x - e0) / (e1 - e0), 0, 1); return t * t * (3 - 2 * t); };

  const TIERS = Object.freeze({
    full: Object.freeze({ icons: 34, fps: 60, trail: 6 }),
    lite: Object.freeze({ icons: 14, fps: 30, trail: 3 }),
    static: Object.freeze({ icons: 16, fps: 0, trail: 0 }),
  });

  /** Which version of the vortex a device gets. Reduced motion always gets the still ring; a phone, a touch screen,
   * a device with few cores or little memory, or Save-Data gets fewer icons at a lower frame rate. */
  function tier(o) {
    if (o.reduced) return 'static';
    const weak = (o.cores && o.cores <= 4) || (o.memory && o.memory <= 4) || o.saveData || o.coarse || (o.width && o.width < 700);
    return weak ? 'lite' : 'full';
  }

  /** Where an icon is on its spiral: depth d falls from 1 to 0 as the phase runs out, and the angle turns faster the
   * deeper it goes (the swirl tightens towards the centre). */
  function spiral(phase, a0, turns) {
    const p = clamp(phase, 0, 1);
    return { d: Math.pow(1 - p, 0.85), a: a0 + TAU * turns * Math.pow(p, 1.35) };
  }

  /** A point on the spiral in stage pixels. geom: { cx, cy, rx, ry, tilt } (an ellipse tilted by tilt radians);
   * par: { x, y } the pointer, -1..1 (near icons move more than far ones). z: +1 at the front (the lower half of the
   * ellipse), -1 at the back. */
  function place(d, a, geom, par) {
    const ex = Math.cos(a) * geom.rx * d, ey = Math.sin(a) * geom.ry * d;
    const ct = Math.cos(geom.tilt || 0), st = Math.sin(geom.tilt || 0);
    const z = Math.sin(a);
    const px = par ? par.x : 0, py = par ? par.y : 0;
    return {
      x: geom.cx + ex * ct - ey * st + px * 28 * d,
      y: geom.cy + ex * st + ey * ct + py * 16 * d,
      z,
      scale: (0.26 + 0.74 * Math.pow(d, 1.1)) * (1 + 0.12 * z),
    };
  }

  /** How opaque an icon is: it fades in as it leaves the rim, fades out as it nears the centre, and the back half of the
   * ellipse is dimmer than the front. */
  function alpha(phase, d, z) {
    const life = smooth(0, 0.08, phase) * (1 - smooth(0.6, 0.9, phase));
    return clamp(life * (0.45 + 0.55 * d) * (0.78 + 0.22 * z), 0, 1);
  }

  /** How much of an icon shows at (x, y) given the text boxes: 1 well clear of every box, 0.05 inside one, a smooth ramp
   * across the margin. rects: [{ l, t, r, b }]. */
  function keepOut(x, y, rects, margin) {
    let k = 1;
    const m = margin > 0 ? margin : 1;
    for (const b of rects || []) {
      const dx = Math.max(b.l - x, 0, x - b.r), dy = Math.max(b.t - y, 0, y - b.b);
      const dist = Math.sqrt(dx * dx + dy * dy);
      k = Math.min(k, 0.05 + 0.95 * smooth(0, m, dist));
    }
    return k;
  }

  /** The still arrangement for reduced motion: two rings (an outer one at depth .94 and an inner one at .7), the icons
   * spread evenly, the inner ring offset by half a step so no two line up. */
  function ring(n) {
    const outer = Math.ceil(n * 0.6), inner = n - outer, out = [];
    for (let i = 0; i < outer; i++) out.push({ d: 0.94, a: (TAU * i) / outer - Math.PI / 2 });
    for (let i = 0; i < inner; i++) out.push({ d: 0.7, a: (TAU * (i + 0.5)) / inner - Math.PI / 2 });
    return out;
  }

  /** Whether enough time has passed for the next frame under an fps cap (a 2 ms slack, so 60 fps is not halved). */
  const due = (now, last, fps) => !fps ? false : fps >= 60 || now - last >= 1000 / fps - 2;

  const M = { TAU, TIERS, clamp, smooth, tier, spiral, place, alpha, keepOut, ring, due };
  if (typeof window !== 'undefined') window.SlopVortexMath = M;
  if (typeof module !== 'undefined' && module.exports) module.exports = M;
})();
