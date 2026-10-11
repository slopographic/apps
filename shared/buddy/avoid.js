// Keeping out of the way. When the mouse comes onto Sloppo he glides to a free spot nearby, once per
// approach, so the person can keep working. He never chases the pointer. A press over a control under
// him goes to the control: while the pointer is over one, his hit box lets clicks through. Touch never
// moves him. On a fresh load he goes back to the spot he rested on this page (glide.js).
import { M, navH, now, rand } from './state.js';
import { size } from './look.js';
import * as P from './perches.js';
import { place } from './motion.js';
import { glideTo, savedSpot } from './glide.js';

const CONTROL = 'a[href], button, input, select, textarea, label, summary, [role=button], [role=link], [role=tab], '
  + '[role=menuitem], [role=checkbox], [role=switch], [role=option], [contenteditable="true"], '
  + '[tabindex]:not([tabindex="-1"]), nav, header, footer, form, [role=toolbar], [role=menubar], .buddy-toggle, .sloppo-hud';
let dodged = false, passing = false;

/** His hit box for feet at page point (x, y), in viewport coordinates (the same box fit() in engine.js sizes). */
function boxAt(x, y) {
  const s = size();
  return { l: x - s * 0.62 - scrollX, r: x + s * 0.62 - scrollX, t: y - s * 1.16 - scrollY, b: y + s * 0.02 - scrollY };
}
const inside = (b, x, y, pad = 0) => x >= b.l - pad && x <= b.r + pad && y >= b.t - pad && y <= b.b + pad;
const isControl = (el) => !!(el && el.closest && el.closest(CONTROL));
const onScreen = (b) => b.l >= 8 && b.r <= innerWidth - 8 && b.t >= navH() + 8 && b.b <= innerHeight - 8;

/** Is a control under the viewport point (x, y), not counting Sloppo himself? */
export const controlAt = (x, y) => withoutHit(() => isControl(document.elementFromPoint(x, y)));

/** Run fn with his hit box switched off, so elementFromPoint sees the page under him. */
function withoutHit(fn) {
  const prev = M.hit.style.pointerEvents;
  M.hit.style.pointerEvents = 'none';
  try { return fn(); } finally { M.hit.style.pointerEvents = prev; }
}

/** A spot is free when no control lies under any sample point of his box. */
function free(b) {
  for (const fx of [0.1, 0.3, 0.5, 0.7, 0.9]) {
    for (const fy of [0.1, 0.35, 0.6, 0.85]) {
      if (isControl(document.elementFromPoint(b.l + (b.r - b.l) * fx, b.t + (b.b - b.t) * fy))) return false;
    }
  }
  return true;
}

/** The nearest free feet point beside him that does not sit under the pointer (px, py, viewport). Sideways first. */
function findSpot(px, py) {
  const s = size(), c = boxAt(M.x, M.y);
  const cx = (c.l + c.r) / 2, cy = (c.t + c.b) / 2, opts = [];
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2;
    for (const k of [1.4, 2, 2.8]) {
      const dx = Math.cos(a) * s * k, dy = Math.sin(a) * s * k * 0.7;
      const toward = dx * (px - cx) + dy * (py - cy) > 0;      // never run towards the pointer if avoidable
      opts.push({ dx, dy, score: Math.hypot(dx, dy) * (toward ? 2 : 1) });
    }
  }
  opts.sort((p, q) => p.score - q.score);
  for (const o of opts) {
    const x = M.x + o.dx, y = M.y + o.dy, b = boxAt(x, y);
    if (!onScreen(b) || inside(b, px, py, 14)) continue;
    if (withoutHit(() => free(b))) return { x, y };
  }
  return null;
}

/** Let clicks through his hit box (true) or take them again (false). */
function setPass(v) {
  if (passing === v) return;
  passing = v;
  M.hit.style.pointerEvents = v ? 'none' : '';
}

function onMove(e) {
  if (e.pointerType !== 'mouse' || !M.visible || !M.hit) return;
  const px = e.clientX, py = e.clientY;
  if (!inside(boxAt(M.x, M.y), px, py, 4)) { dodged = false; setPass(false); return; }
  if (e.buttons) return;                                  // a press is never an approach
  if (!dodged && (M.mode === 'perched' || M.mode === 'float')) {
    dodged = true;                                        // once per approach, even if no spot was free
    const spot = findSpot(px, py);
    if (spot) { glideTo(spot.x, spot.y); setPass(false); return; }
  }
  if (M.mode === 'glide' || M.mode === 'drag') return;
  setPass(controlAt(px, py));
}

/** Start watching the pointer (called once when he is built). */
export function bindAvoid() {
  document.addEventListener('pointermove', onMove, { capture: true, passive: true });
}

/**
 * On a fresh load, he goes back to where he rested on this page: onto the same perch, or floating in
 * the open if that spot is still free. Returns false when there is no usable spot (normal arrival).
 */
export function restoreSpot() {
  const s = savedSpot();
  if (!s) return false;
  const on = P.all().find(({ r }) => Math.abs(r.top + scrollY - s.y) < 3 && s.x >= r.left + scrollX - 2 && s.x <= r.right + scrollX + 2);
  if (on && P.inView(on.r)) {
    const frac = (s.x - (on.r.left + scrollX)) / Math.max(1, on.r.right - on.r.left);
    if (place({ el: on.el, frac })) return true;
  }
  const b = boxAt(s.x, s.y);
  if (!onScreen(b) || !withoutHit(() => free(b))) return false;
  Object.assign(M, { mode: 'float', perch: null, hop: null, x: s.x, y: s.y, vx: 0, vy: 0, rot: 0, vr: 0, offSince: 0, nextIdle: now() + 4000 + rand(0, 5000) });
  return true;
}
