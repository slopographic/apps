// Perches: the top edges of [data-perch] elements (headings, cards, the intro ledge).
import { M, navH, pageW } from './state.js';
import { size } from './look.js';

/** Cards knocked off the page: no longer perches until the page is restored. */
export const gone = new WeakSet();
const isHeading = (el) => /^H[1-6]$/.test(el.tagName);

/** The perch's top edge in viewport coordinates, or null when it is hidden. Headings use the top of their first line of text. */
export function rectOf(el) {
  if (!el || !el.isConnected || gone.has(el)) return null;
  const b = el.getBoundingClientRect();
  if (b.width < 40 || b.height <= 0) return null;
  if (isHeading(el)) {
    const rg = document.createRange();
    rg.selectNodeContents(el);
    const rs = [...rg.getClientRects()].filter((q) => q.width > 1 && q.height > 1);
    if (rs.length) {
      const top = Math.min(...rs.map((q) => q.top));
      const line = rs.filter((q) => q.top < top + q.height * 0.5);
      const h = Math.max(...line.map((q) => q.height));
      const left = Math.min(...line.map((q) => q.left)), right = Math.max(...line.map((q) => q.right));
      if (right - left >= 40) return { left, right, top: top + h * 0.17, bottom: b.bottom };
    }
  }
  return { left: b.left, right: b.right, top: b.top, bottom: b.bottom };
}

/** Every perch that is laid out right now: [{ el, r }]. */
export function all() {
  const out = [];
  for (const el of document.querySelectorAll('[data-perch]')) {
    const r = rectOf(el);
    if (r) out.push({ el, r });
  }
  return out;
}

/** Is this perch top comfortably inside the viewport (with room for him above it)? */
export const inView = (r) => r.top > navH() + 60 && r.top < innerHeight - 8 && r.right > 40 && r.left < innerWidth - 40;

/** Page coordinates of a spot on a perch, or null if the perch is hidden. */
export function point(p) {
  const r = p && rectOf(p.el);
  if (!r) return null;
  const pad = Math.min(30, (r.right - r.left) / 2);
  const x = Math.max(r.left + pad, Math.min(r.right - pad, r.left + p.frac * (r.right - r.left))) + scrollX;
  const edge = size() * 0.5;   // keep his puddle on the page
  return { x: Math.max(edge, Math.min(pageW() - edge, x)), y: r.top + scrollY };
}

/** A random visible perch, weighted toward nearby ones. filter(el) narrows the choice. */
export function pick({ exclude = null, filter = null, near = true } = {}) {
  const c = all().filter(({ el, r }) => el !== exclude && inView(r) && (!filter || filter(el)));
  if (!c.length) return null;
  const w = c.map(({ r }) => {
    const dx = (r.left + r.right) / 2 + scrollX - M.x, dy = r.top + scrollY - M.y;
    return near ? 1 / (1 + Math.hypot(dx, dy) / 260) : 1;
  });
  let k = Math.random() * w.reduce((a, b) => a + b, 0);
  for (let i = 0; i < c.length; i++) if ((k -= w[i]) <= 0) return { el: c[i].el, frac: 0.15 + Math.random() * 0.7 };
  return { el: c[c.length - 1].el, frac: 0.5 };
}

/** The highest perch top crossed while falling from y0 to y1 at x (page coordinates). */
export function landing(x, y0, y1) {
  let best = null;
  for (const { el, r } of all()) {
    const top = r.top + scrollY, l = r.left + scrollX, rr = r.right + scrollX;
    if (top >= y0 - 0.5 && top <= y1 && x >= l + 6 && x <= rr - 6 && (!best || top < best.top)) best = { el, top, frac: (x - l) / (rr - l) };
  }
  return best;
}
