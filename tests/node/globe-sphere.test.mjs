// The homepage app globe's pure maths (home/globe/sphere.js): tiers, the Fibonacci sphere, rotation, perspective,
// depth looks, spin with inertia damping, easing an icon to the front, the short way round, the text keep-out, the grid.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const G = createRequire(import.meta.url)('../../home/globe/sphere.js');
const near = (a, b, eps = 1e-9) => Math.abs(a - b) <= eps;
const len = (p) => Math.hypot(p.x, p.y, p.z);
const geom = { cx: 400, cy: 300, r: 200, d: 3.4 };

test('tiers: reduced motion is still, weak or small devices get the lite globe, the rest the full one', () => {
  assert.equal(G.tier({ reduced: true, cores: 16, width: 1600 }), 'static');
  assert.equal(G.tier({ cores: 16, memory: 16, width: 1600 }), 'full');
  for (const o of [{ cores: 4, width: 1600 }, { memory: 2, width: 1600 }, { saveData: true, width: 1600 }, { coarse: true, width: 1600 }, { cores: 16, width: 390 }]) assert.equal(G.tier(o), 'lite', JSON.stringify(o));
  assert.ok(G.TIERS.lite.icons < G.TIERS.full.icons && G.TIERS.lite.fps < G.TIERS.full.fps);
  assert.equal(G.TIERS.static.fps, 0);
});

test('fibonacci: n points on the unit sphere, spread evenly (no two close, both halves alike)', () => {
  for (const n of [12, 40, 63]) {
    const pts = G.fibonacci(n);
    assert.equal(pts.length, n);
    for (const p of pts) assert.ok(near(len(p), 1, 1e-9));
    let min = Infinity;
    for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) min = Math.min(min, Math.hypot(pts[i].x - pts[j].x, pts[i].y - pts[j].y, pts[i].z - pts[j].z));
    // an even spread keeps the nearest pair close to the ideal spacing for n points (about sqrt(4π/n))
    assert.ok(min > 0.6 * Math.sqrt((4 * Math.PI) / n), `${n}: nearest pair ${min.toFixed(3)}`);
    for (const k of ['x', 'y', 'z']) assert.ok(Math.abs(pts.reduce((a, p) => a + p[k], 0) / n) < 0.06, `${n}: centred on ${k}`);
    assert.ok(Math.abs(pts.filter((p) => p.z > 0).length - n / 2) <= Math.max(2, n * 0.08), `${n}: front and back halves`);
  }
});

test('rotate keeps lengths; yaw turns about the vertical axis, pitch tips the top towards the viewer', () => {
  const p = { x: 0.3, y: -0.5, z: 0.81 };
  for (const [yaw, pitch] of [[0, 0], [1, 0.3], [-2.5, -0.6]]) assert.ok(near(len(G.rotate(p, yaw, pitch)), len(p), 1e-12));
  const q = G.rotate({ x: 1, y: 0, z: 0 }, Math.PI / 2, 0);
  assert.ok(near(q.x, 0, 1e-12) && near(q.z, -1, 1e-12));
  const top = G.rotate({ x: 0, y: 1, z: 0 }, 0, 0.3);
  assert.ok(top.z > 0, 'a positive pitch brings the top towards the viewer');
});

test('project: true perspective, the front larger than the back, the centre on the centre', () => {
  const front = G.project({ x: 0, y: 0, z: 1 }, geom), back = G.project({ x: 0, y: 0, z: -1 }, geom);
  assert.ok(near(front.x, 400) && near(front.y, 300));
  assert.ok(front.scale > 1 && back.scale < 1 && near(front.scale, 3.4 / 2.4));
  const right = G.project({ x: 1, y: 0, z: 0 }, geom), up = G.project({ x: 0, y: 1, z: 0 }, geom);
  assert.ok(near(right.x, 600) && near(up.y, 100), 'y is up in space, down on screen');
  const nearRight = G.project({ x: 0.5, y: 0, z: 0.8 }, geom), farRight = G.project({ x: 0.5, y: 0, z: -0.8 }, geom);
  assert.ok(nearRight.x > farRight.x, 'near points spread wider than far ones');
});

test('look: the back is faint and blurred, the front clear and glowing', () => {
  const back = G.look(-1), mid = G.look(0), front = G.look(1);
  assert.ok(back.alpha < mid.alpha && mid.alpha < front.alpha && near(front.alpha, 1));
  assert.equal(back.blur, 2); assert.equal(G.look(-0.4).blur, 1); assert.equal(mid.blur, 0);
  assert.ok(front.front && !mid.front);
});

test('spin: a fling slows down to the idle turn (inertia damping), and with no idle speed it comes to rest', () => {
  let s = { yaw: 0, pitch: 0.3, vel: 0.004 };
  const idle = 0.0001;
  const speeds = [];
  for (let i = 0; i < 200; i++) { s = G.spin(s, 16, { idle, tau: 900 }); speeds.push(s.vel); }
  for (let i = 1; i < speeds.length; i++) assert.ok(speeds[i] <= speeds[i - 1] + 1e-15);
  assert.ok(near(s.vel, idle, 2e-4) && s.vel > idle);
  assert.ok(s.yaw > 0 && s.pitch === 0.3);
  let r = { yaw: 1, pitch: 0, vel: 0.003 };
  for (let i = 0; i < 600; i++) r = G.spin(r, 16, { idle: 0, tau: 500 });
  assert.ok(Math.abs(r.vel) < 1e-8);
  const a = G.spin({ yaw: 0, pitch: 0, vel: 0.002 }, 32, { idle: 0, tau: 900 }), b = G.spin(G.spin({ yaw: 0, pitch: 0, vel: 0.002 }, 16, { idle: 0, tau: 900 }), 16, { idle: 0, tau: 900 });
  assert.ok(near(a.vel, b.vel, 1e-12), 'the damping does not depend on the frame rate');
});

test('bring to front: the target turn faces the point to the viewer; seek eases there the short way', () => {
  for (const p of G.fibonacci(63)) {
    const f = G.frontOf(p, 0.3);
    const q = G.rotate(p, f.yaw, 0);
    assert.ok(near(q.x, 0, 1e-9) && q.z > 0, 'yaw alone brings it to the middle, facing');
    assert.ok(Math.abs(f.pitch) <= 0.6);
    const qq = G.rotate(p, f.yaw, f.pitch);
    assert.ok(qq.z > 0.55, `it ends near the front (z ${qq.z.toFixed(2)})`);
  }
  assert.ok(near(G.nearAngle(10, 0.5), 0.5 + 2 * Math.PI * 2, 1e-9));
  assert.ok(Math.abs(G.nearAngle(0.1, 6.2) - 0.1) < Math.PI);
  let s = { yaw: 0, pitch: 0.3, vel: 0.001 };
  const t = { yaw: 1.2, pitch: -0.2 };
  for (let i = 0; i < 120; i++) s = G.seek(s, t, 16, 420);
  assert.ok(near(s.yaw, 1.2, 0.02) && near(s.pitch, -0.2, 0.02) && s.vel === 0);
});

test('keepOut: over the copy an icon nearly vanishes, clear of it it shows fully', () => {
  const rects = [{ l: 100, t: 100, r: 400, b: 200 }];
  assert.ok(near(G.keepOut(250, 150, rects, 30), 0.05));
  assert.equal(G.keepOut(250, 300, rects, 30), 1);
  const a = G.keepOut(250, 210, rects, 30), b = G.keepOut(250, 220, rects, 30);
  assert.ok(a > 0.05 && a < b && b < 1);
});

test('grid: latitude rings and meridians on the unit sphere, closed loops', () => {
  const lines = G.grid(30, 30, 6);
  assert.equal(lines.length, 5 + 6);
  for (const l of lines) {
    for (const p of l) assert.ok(near(len(p), 1, 1e-9));
    assert.ok(near(l[0].x, l[l.length - 1].x, 1e-9) && near(l[0].z, l[l.length - 1].z, 1e-9));
  }
  assert.equal(G.due(1016, 1000, 30), false); assert.equal(G.due(1033, 1000, 30), true); assert.equal(G.due(5, 0, 0), false);
});
