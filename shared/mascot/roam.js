// A slotted mascot that roams the page (profile "mascot": { "roam": "float" | "hop" | true }; true is float). It rests
// beside the edges of the page's content, now and then travels to another clear spot, and moves out of the way when the
// pointer comes close over something it covers. It never rests on a control, on content or on a [data-mascot-avoid]
// area (shared/roam/spots.js), stays inside the window below the header, and holds still while the person types or
// scrolls. The paths are the buddy's own (shared/roam/path.js):
//   float  gentle curves with ease in and out, a soft hover bob and drift at rest, a lean into the direction of travel
//   hop    the buddy's arc between spots, no bob
// It stays docked (where ui.js placed it) with reduced motion and on a phone or a touch screen; a plain-tone build roams
// calmly (longer rests, slower trips, a smaller bob). A press or Move to the other side parks it where it is for a while
// (PARK_MS); Hide stops it. It moves only by transform (the dock, and the stage for the bob and lean), so it never
// shifts the page's layout. The overlay hears its travel through react('travel', { on, dx, dy, style }) and look().
// Tests: tests/buddy/roam.test.html.
import { easeInOut, curve, arc, floatTime, hopTime, bob, drift, leanOf, approach, ringSpots, chooseSpot, restMs, within, overlaps } from '../roam/path.js';
import { candidates, clearSpots, clearBox, blocks } from '../roam/spots.js';
import { view } from './ui.js';

export const STYLES = ['float', 'hop'];
/** The roaming style of a profile value: true is float, a known style is itself, anything else is off (''). */
export const styleOf = (v) => (v === true ? 'float' : STYLES.includes(v) ? v : '');
/** How long a press or a move keeps it parked (ms); the pause after a key or a scroll (ms). */
export const PARK_MS = 90000, TYPE_MS = 2500, SCROLL_MS = 1200;
const MARGIN = 8, NEAR = 28;

/** o: { style, calm, reduce(), phone(), hook(name, ...args), ui (ui.js's attach() result) }. Returns the controller. */
export function createRoam(dock, stage, o) {
  const now = () => performance.now();
  let off = { x: 0, y: 0 }, trip = null, lean = 0, raf = 0, last = 0, on = false, dodged = false, hover = false;
  let restUntil = 0, pauseUntil = 0, parkUntil = 0, checkAt = 0, drift_ = { x: 0, y: 0 }, bobY = 0;
  const t0 = now();
  const enabled = () => !!o.style && !o.reduce() && !o.phone();
  const size = () => ({ w: dock.offsetWidth, h: dock.offsetHeight });
  /** The dock's box where it is drawn now, and where it would be with no offset (its docked place). */
  const rect = () => { const r = dock.getBoundingClientRect(); return { l: r.left, t: r.top, r: r.right, b: r.bottom }; };
  const home = () => { const r = rect(); return { x: r.l - off.x - drift_.x, y: r.t - off.y }; };
  function bounds() {
    const v = view(dock), s = v.safe;
    return { l: s.left + MARGIN, t: Math.max(v.top, s.top) + MARGIN, r: v.w - s.right - MARGIN, b: v.h - s.bottom - MARGIN };
  }
  function apply() {
    dock.style.transform = off.x || off.y || drift_.x ? `translate(${(off.x + drift_.x).toFixed(1)}px, ${off.y.toFixed(1)}px)` : '';
    stage.style.translate = bobY ? `0 ${bobY.toFixed(1)}px` : '';
    stage.style.rotate = Math.abs(lean) > 0.05 ? `${lean.toFixed(2)}deg` : '';
  }
  function reset() { off = { x: 0, y: 0 }; drift_ = { x: 0, y: 0 }; bobY = 0; lean = 0; endTrip(); apply(); }
  function endTrip() {
    if (!trip) return;
    trip = null;
    o.hook('react', 'travel', { on: false });
    o.hook('look', 0, 0);
  }

  /** Starts a trip from where it is to the top-left corner (x, y). fast: out of the pointer's way. */
  function go(x, y, fast = false) {
    const h = home(), a = { x: h.x + off.x, y: h.y + off.y }, b = { x, y }, d = Math.hypot(b.x - a.x, b.y - a.y);
    if (d < 2) return false;
    const T = (o.style === 'hop' ? hopTime(d) * 1.3 : floatTime(d, o.calm)) * (fast ? 0.55 : 1);
    trip = { h, path: o.style === 'hop' ? arc(a, b) : curve(a, b, Math.random() * 2 - 1), t: 0, T, px: a.x };
    const dx = Math.sign(b.x - a.x), dy = Math.sign(b.y - a.y);
    o.hook('react', 'travel', { on: true, dx, dy, style: o.style });
    o.hook('look', dx * 0.8, dy * 0.3);
    return true;
  }
  /** Picks a clear spot and travels there. Returns false when none is free (it stays). */
  function next() {
    if (!enabled() || dock.hidden) return false;
    const { w, h } = size(), here = home(), from = { x: here.x + off.x, y: here.y + off.y };
    const spot = chooseSpot(clearSpots(candidates(w, h, bounds()), w, h, dock), from, Math.random());
    restUntil = now() + restMs(Math.random(), o.calm);
    return !!spot && go(spot.x, spot.y);
  }
  /** Out of the pointer's way (px, py): the nearest clear spot around it, away from the pointer. */
  function dodge(px, py) {
    const { w, h } = size(), r = rect(), b = bounds(), cx = (r.l + r.r) / 2, cy = (r.t + r.b) / 2;
    for (const s of ringSpots(w * 0.8, h * 0.6, px - cx, py - cy)) {
      const box = { l: r.l + s.dx, t: r.t + s.dy, r: r.r + s.dx, b: r.b + s.dy };
      if (!within(box, b) || overlaps(box, { l: px, t: py, r: px, b: py }, NEAR)) continue;
      if (clearBox(box, dock)) { restUntil = now() + restMs(Math.random(), o.calm); return go(box.l - drift_.x, box.t, true); }
    }
    return false;
  }

  function frame() {
    raf = on ? requestAnimationFrame(frame) : 0;
    const t = now(), dt = Math.min(0.05, (t - (last || t)) / 1000);
    last = t;
    if (!enabled() || dock.hidden) { if (off.x || off.y || trip || bobY) reset(); return; }
    const sec = (t - t0) / 1000, calm = o.calm, held = t < pauseUntil || t < parkUntil;
    if (trip && t < pauseUntil) endTrip();                 // a key or a scroll: it stops where it is
    if (trip) {
      trip.t += dt;
      const u = Math.min(1, trip.t / trip.T), p = trip.path(o.style === 'hop' ? u : easeInOut(u));
      const vx = (p.x - trip.px) / Math.max(dt, 0.001);
      trip.px = p.x;
      off = { x: p.x - trip.h.x, y: p.y - trip.h.y };
      lean = o.style === 'float' ? approach(lean, leanOf(vx, calm ? 5 : 8), dt) : 0;
      if (u >= 1) endTrip();
    } else {
      lean = approach(lean, 0, dt);
      if (!held && !hover && t > restUntil) next();
      else if (!held && !hover && t > checkAt) {                      // the page changed under it: a control or content came
        checkAt = t + 1500;
        const r = rect();
        if (!clearBox(r, dock) && !next()) restUntil = t + 3000;
      }
    }
    const still = o.style !== 'float' || held;
    bobY = still ? approach(bobY, 0, dt) : bob(sec, calm ? 2 : 3.5, calm ? 4 : 3.2);
    const d = still || trip ? { x: 0, y: 0 } : drift(sec, calm ? 3 : 5);
    drift_ = { x: approach(drift_.x, d.x, dt, 0.05), y: 0 };
    keepInside();
    apply();
  }
  /** Never outside the window: a resize or the header growing pulls it back in. */
  function keepInside() {
    const r = rect(), b = bounds();
    const dx = r.l < b.l ? b.l - r.l : r.r > b.r ? b.r - r.r : 0, dy = r.t < b.t ? b.t - r.t : r.b > b.b ? b.b - r.b : 0;
    if (!dx && !dy) return;
    off = { x: off.x + dx, y: off.y + dy };
    if (trip) { trip.h = { x: trip.h.x - dx, y: trip.h.y - dy }; }
  }

  const onKey = () => { pauseUntil = now() + TYPE_MS; };
  const onScroll = () => { pauseUntil = Math.max(pauseUntil, now() + SCROLL_MS); checkAt = 0; };
  const onPointer = (e) => {
    if (e.pointerType !== 'mouse' || !on || dock.hidden || !enabled() || trip || e.buttons) return;
    const r = rect(), near = e.clientX > r.l - NEAR && e.clientX < r.r + NEAR && e.clientY > r.t - NEAR && e.clientY < r.b + NEAR;
    if (!near) { dodged = false; return; }
    if (dodged || now() < parkUntil) return;
    const prev = dock.style.visibility;
    dock.style.visibility = 'hidden';
    const under = document.elementFromPoint(e.clientX, e.clientY);
    dock.style.visibility = prev;
    if (blocks(under)) { dodged = true; dodge(e.clientX, e.clientY); }   // it covers what the pointer is going for
  };
  const onEnter = () => { hover = true; };
  const onLeave = () => { hover = false; };
  const onResize = () => { reset(); restUntil = now() + 2000; };
  addEventListener('keydown', onKey, true);
  addEventListener('input', onKey, true);
  addEventListener('scroll', onScroll, { capture: true, passive: true });
  addEventListener('pointermove', onPointer, { passive: true });
  addEventListener('resize', onResize);
  dock.addEventListener('pointerenter', onEnter);
  dock.addEventListener('pointerleave', onLeave);

  return {
    /** Shown (true): roaming starts after a first rest; hidden: it stops, back at its place. */
    run(v) {
      if (v && !on) { on = true; last = 0; restUntil = now() + 3500 + Math.random() * 2500; raf = requestAnimationFrame(frame); }
      if (!v) { on = false; cancelAnimationFrame(raf); raf = 0; reset(); }
    },
    /** Before a press or a move (ui.js): fold where it floats into its place, and stay parked there for a while. */
    settle() {
      parkUntil = now() + PARK_MS;
      if (!off.x && !off.y && !drift_.x) return;
      const p = o.ui.pos(), dx = off.x + drift_.x, dy = off.y;
      reset();
      if (p) o.ui.moveTo({ right: p.right - dx, bottom: p.bottom - dy });
    },
    /** For tests: travel to a clear spot now (false when none is free or it may not roam). */
    next: () => { parkUntil = 0; pauseUntil = 0; return next(); },
    /** For tests: travel to the top-left corner (x, y) now. */
    to: (x, y) => { parkUntil = 0; pauseUntil = 0; restUntil = now() + restMs(Math.random(), o.calm); return enabled() && go(x, y); },
    state: () => ({ on, enabled: enabled(), style: o.style, travelling: !!trip, off: { x: Math.round(off.x), y: Math.round(off.y) }, lean, parked: now() < parkUntil, paused: now() < pauseUntil }),
    dispose() {
      this.run(false);
      removeEventListener('keydown', onKey, true); removeEventListener('input', onKey, true);
      removeEventListener('scroll', onScroll, { capture: true }); removeEventListener('pointermove', onPointer); removeEventListener('resize', onResize);
      dock.removeEventListener('pointerenter', onEnter); dock.removeEventListener('pointerleave', onLeave);
    },
  };
}
