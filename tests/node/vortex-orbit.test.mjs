// The homepage tool vortex's pure maths (home/vortex/orbit.js): tiers, the spiral, placing on the tilted ellipse, the
// fades with depth, the text keep-out, the still ring and the frame-rate cap.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const V = createRequire(import.meta.url)('../../home/vortex/orbit.js');
const geom = { cx: 500, cy: 300, rx: 600, ry: 250, tilt: 0 };
const near = (a, b, eps = 1e-9) => Math.abs(a - b) <= eps;

test('tiers: reduced motion is still, weak or small devices get the lite swirl, the rest the full one', () => {
  assert.equal(V.tier({ reduced: true, cores: 16, width: 1600 }), 'static');
  assert.equal(V.tier({ cores: 16, memory: 16, width: 1600 }), 'full');
  for (const o of [{ cores: 4, width: 1600 }, { memory: 2, width: 1600 }, { saveData: true, width: 1600 }, { coarse: true, width: 1600 }, { cores: 16, width: 390 }]) {
    assert.equal(V.tier(o), 'lite', JSON.stringify(o));
  }
  assert.ok(V.TIERS.lite.icons < V.TIERS.full.icons && V.TIERS.lite.fps < V.TIERS.full.fps);
  assert.equal(V.TIERS.static.fps, 0);
});

test('the spiral sinks from the rim (depth 1) to the centre (depth 0) and turns faster the deeper it goes', () => {
  assert.equal(V.spiral(0, 0, 1).d, 1);
  assert.equal(V.spiral(1, 0, 1).d, 0);
  let lastD = 2;
  for (let p = 0; p <= 1; p += 0.05) { const d = V.spiral(p, 0, 1.2).d; assert.ok(d < lastD); lastD = d; }
  const step = (p) => V.spiral(p + 0.01, 0, 1.2).a - V.spiral(p, 0, 1.2).a;
  assert.ok(step(0.8) > step(0.2), 'faster near the centre');
  assert.ok(near(V.spiral(1, 0.5, 1).a, 0.5 + V.TAU));
  assert.deepEqual(V.spiral(-1, 0, 1), V.spiral(0, 0, 1), 'the phase is clamped');
});

test('place: on the ellipse at full depth, at the centre at depth 0, front larger than back, near icons follow the pointer more', () => {
  const right = V.place(1, 0, geom), bottom = V.place(1, Math.PI / 2, geom), top = V.place(1, -Math.PI / 2, geom);
  assert.ok(near(right.x, 1100) && near(right.y, 300));
  assert.ok(near(bottom.y, 550) && near(bottom.z, 1));
  assert.ok(near(top.y, 50) && near(top.z, -1));
  assert.ok(bottom.scale > top.scale, 'the front half is larger');
  const centre = V.place(0, 1.3, geom);
  assert.ok(near(centre.x, 500) && near(centre.y, 300));
  assert.ok(V.place(0.2, 0, geom).scale < V.place(0.9, 0, geom).scale, 'deeper is smaller');
  const tilted = V.place(1, 0, { ...geom, tilt: Math.PI / 2 });
  assert.ok(near(tilted.x, 500, 1e-6) && near(tilted.y, 900, 1e-6), 'the tilt turns the ellipse');
  const par = { x: 1, y: 1 };
  const shiftNear = V.place(1, 0, geom, par).x - right.x, shiftFar = V.place(0.2, 0, geom, par).x - V.place(0.2, 0, geom).x;
  assert.ok(shiftNear > shiftFar && shiftFar > 0, 'parallax grows with nearness');
});

test('alpha: zero when an icon is born and when it reaches the centre, highest in between, back half dimmer', () => {
  assert.equal(V.alpha(0, 1, 0), 0);
  assert.equal(V.alpha(0.95, 0.05, 0), 0);
  const mid = V.alpha(0.3, V.spiral(0.3, 0, 1).d, 1);
  assert.ok(mid > 0.6 && mid <= 1, String(mid));
  assert.ok(V.alpha(0.3, 0.8, -1) < V.alpha(0.3, 0.8, 1));
  for (let p = 0; p <= 1; p += 0.01) { const a = V.alpha(p, V.spiral(p, 0, 1).d, 0); assert.ok(a >= 0 && a <= 1); }
});

test('keepOut: an icon over the text nearly vanishes, one clear of it shows fully, with a smooth ramp between', () => {
  const rects = [{ l: 100, t: 100, r: 400, b: 200 }];
  assert.ok(near(V.keepOut(250, 150, rects, 30), 0.08));
  assert.equal(V.keepOut(250, 300, rects, 30), 1);
  const a = V.keepOut(250, 210, rects, 30), b = V.keepOut(250, 220, rects, 30);
  assert.ok(a > 0.08 && a < b && b < 1);
  assert.equal(V.keepOut(0, 0, [], 30), 1);
  assert.ok(near(V.keepOut(250, 150, [{ l: 0, t: 0, r: 10, b: 10 }, rects[0]], 30), 0.08), 'the closest box wins');
});

test('ring: the still arrangement spreads n icons on two rings, none on top of another', () => {
  for (const n of [5, 14, 16, 34]) {
    const r = V.ring(n);
    assert.equal(r.length, n);
    assert.deepEqual([...new Set(r.map((x) => x.d))].sort(), [0.7, 0.94]);
    const pts = r.map((x) => V.place(x.d, x.a, geom));
    for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) assert.ok(Math.hypot(pts[i].x - pts[j].x, pts[i].y - pts[j].y) > 20, `${n}: ${i} and ${j}`);
  }
});

test('due: 60 fps draws every frame, 30 fps every other one, 0 never', () => {
  assert.equal(V.due(16, 0, 60), true);
  assert.equal(V.due(1016, 1000, 30), false);
  assert.equal(V.due(1033, 1000, 30), true);
  assert.equal(V.due(5000, 0, 0), false);
});
