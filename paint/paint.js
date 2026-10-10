/* Slop Paint — slopographic.com
 * A real, working Win98-era paint program, with a few extra drips. */
(() => {
'use strict';

/* =====================================================================
 * Helpers
 * ===================================================================== */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
function h(tag, attrs, ...kids) {
  const e = document.createElement(tag);
  if (attrs) for (const k in attrs) {
    const v = attrs[k];
    if (v == null || v === false) continue;
    if (k === 'class') e.className = v;
    else if (k === 'text') e.textContent = v;
    else if (k === 'html') e.innerHTML = v;
    else if (k === 'style' && typeof v === 'object') Object.assign(e.style, v);
    else if (k.startsWith('on') && typeof v === 'function') e.addEventListener(k.slice(2), v);
    else e.setAttribute(k, v === true ? '' : v);
  }
  for (const kid of kids.flat()) if (kid != null && kid !== false) e.append(kid);
  return e;
}
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const mkCanvas = (w, hh) => { const c = document.createElement('canvas'); c.width = Math.max(1, w | 0); c.height = Math.max(1, hh | 0); return c; };
const ctx2d = (c, o) => { const x = c.getContext('2d', o); x.imageSmoothingEnabled = false; return x; };
const copyCanvas = src => { const c = mkCanvas(src.width, src.height); ctx2d(c).drawImage(src, 0, 0); return c; };
const loadImage = src => new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error('bad image')); i.src = src; });
async function loadBlobImage(blob) {
  const url = URL.createObjectURL(blob);
  try { return await loadImage(url); } finally { setTimeout(() => URL.revokeObjectURL(url), 2000); }
}
const hexToRgb = hx => { const n = parseInt(hx.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
const rgbHex = (r, g, b) => '#' + [r, g, b].map(v => clamp(Math.round(v), 0, 255).toString(16).padStart(2, '0')).join('');
const pack = hx => { const [r, g, b] = hexToRgb(hx); return ((255 << 24) | (b << 16) | (g << 8) | r) >>> 0; };
const isTyping = t => t && t.closest && !!t.closest('input, textarea, select, [contenteditable]');
const EMOJI_FONT = '"Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", "Twemoji Mozilla", sans-serif';

function rgbToHsl(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2;
  let hh = 0, s = 0;
  if (mx !== mn) {
    const d = mx - mn;
    s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
    hh = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
    hh /= 6;
  }
  return [hh, s, l];
}
function hslToRgb(hh, s, l) {
  if (s === 0) { const v = Math.round(l * 255); return [v, v, v]; }
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s, p = 2 * l - q;
  const f = t => { if (t < 0) t += 1; if (t > 1) t -= 1; if (t < 1 / 6) return p + (q - p) * 6 * t; if (t < 1 / 2) return q; if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6; return p; };
  return [f(hh + 1 / 3), f(hh), f(hh - 1 / 3)].map(v => Math.round(v * 255));
}

/* =====================================================================
 * Aliased pixel primitives (everything is drawn with fillRect spans,
 * so the bitmap stays crisp like real Paint)
 * ===================================================================== */
function bres(x0, y0, x1, y1, fn) {
  const dx = Math.abs(x1 - x0), sx = x0 < x1 ? 1 : -1, dy = -Math.abs(y1 - y0), sy = y0 < y1 ? 1 : -1;
  let err = dx + dy;
  for (let guard = 0; guard < 100000; guard++) {
    fn(x0, y0);
    if (x0 === x1 && y0 === y1) break;
    const e2 = 2 * err;
    if (e2 >= dy) { err += dy; x0 += sx; }
    if (e2 <= dx) { err += dx; y0 += sy; }
  }
}
function stamp(ctx, x, y, spans) {
  for (let i = 0; i < spans.length; i++) { const s = spans[i]; ctx.fillRect(x + s[0], y + s[1], s[2], 1); }
}
const spanCache = new Map();
function discSpans(d) {
  const key = 'd' + d;
  if (spanCache.has(key)) return spanCache.get(key);
  const r = d / 2, off = (d - 1) / 2, o = Math.floor(off), out = [];
  for (let j = 0; j < d; j++) {
    const yy = j - off; let xl = -1, len = 0;
    for (let i = 0; i < d; i++) { const xx = i - off; if (xx * xx + yy * yy <= r * r + 0.01) { if (xl < 0) xl = i; len++; } }
    if (len) out.push([xl - o, j - o, len]);
  }
  spanCache.set(key, out);
  return out;
}
function squareSpans(d) { const o = Math.floor((d - 1) / 2); return Array.from({ length: d }, (_, j) => [-o, j - o, d]); }
function slashSpans(n, back) {
  const o = Math.floor(n / 2), out = [];
  for (let i = 0; i < n; i++) out.push([(back ? i : n - 1 - i) - o, i - o, 1]);
  return out;
}
function line(ctx, x0, y0, x1, y1, w) {
  if (w <= 1) bres(x0, y0, x1, y1, (x, y) => ctx.fillRect(x, y, 1, 1));
  else { const sp = discSpans(w); bres(x0, y0, x1, y1, (x, y) => stamp(ctx, x, y, sp)); }
}
function polyline(ctx, pts, w, closed) {
  if (pts.length === 1) line(ctx, pts[0].x, pts[0].y, pts[0].x, pts[0].y, w);
  for (let i = 1; i < pts.length; i++) line(ctx, pts[i - 1].x, pts[i - 1].y, pts[i].x, pts[i].y, w);
  if (closed && pts.length > 2) line(ctx, pts[pts.length - 1].x, pts[pts.length - 1].y, pts[0].x, pts[0].y, w);
}
function hline(ctx, x0, x1, y) { if (x1 >= x0) ctx.fillRect(x0, y, x1 - x0 + 1, 1); }

// Shapes as per-row spans {y0, n, xl[], xr[]}
const RR = 9; // rounded-rect corner radius
function rowsOf(type, x0, y0, x1, y1, t) {
  const a = x0 + t, b = y0 + t, c = x1 - t, d = y1 - t;
  if (c < a || d < b) return null;
  const n = d - b + 1, xl = new Array(n), xr = new Array(n);
  if (type === 'ellipse') {
    const ra = (c - a + 1) / 2, rb = n / 2, cx = a + ra, cy = b + rb;
    for (let i = 0; i < n; i++) {
      const dy = (b + i + 0.5 - cy) / rb, k = Math.max(0, 1 - dy * dy), dx = ra * Math.sqrt(k);
      let l = Math.round(cx - dx), r = Math.round(cx + dx) - 1;
      if (r < l) { const tmp = l; l = r; r = tmp; }
      xl[i] = l; xr[i] = r;
    }
  } else if (type === 'rrect') {
    const w = c - a + 1, rr = Math.min(Math.max(0, RR - t), w / 2, n / 2);
    for (let i = 0; i < n; i++) {
      const yy = i + 0.5; let dd = 0;
      if (yy < rr) dd = rr - yy; else if (yy > n - rr) dd = yy - (n - rr);
      const off = dd > 0 ? Math.round(rr - Math.sqrt(Math.max(0, rr * rr - dd * dd))) : 0;
      xl[i] = a + off; xr[i] = c - off;
    }
  } else {
    for (let i = 0; i < n; i++) { xl[i] = a; xr[i] = c; }
  }
  return { y0: b, n, xl, xr };
}
function fillRows(ctx, R) { if (R) for (let i = 0; i < R.n; i++) hline(ctx, R.xl[i], R.xr[i], R.y0 + i); }
// mode 0 = outline, 1 = outline (fg) + fill (bg), 2 = fill only (fg)
function drawShape(ctx, type, x0, y0, x1, y1, t, mode, fg, bg) {
  const out = rowsOf(type, x0, y0, x1, y1, 0);
  if (!out) return;
  if (mode === 2) { ctx.fillStyle = fg; fillRows(ctx, out); return; }
  const inn = rowsOf(type, x0, y0, x1, y1, t);
  if (mode === 1 && inn) { ctx.fillStyle = bg; fillRows(ctx, inn); }
  ctx.fillStyle = fg;
  for (let i = 0; i < out.n; i++) {
    const y = out.y0 + i, xl = out.xl[i], xr = out.xr[i];
    const j = inn ? y - inn.y0 : -1;
    if (!inn || j < 0 || j >= inn.n) hline(ctx, xl, xr, y);
    else { hline(ctx, xl, inn.xl[j] - 1, y); hline(ctx, inn.xr[j] + 1, xr, y); }
  }
}
function polySpans(pts) {
  let mn = Infinity, mx = -Infinity;
  for (const p of pts) { mn = Math.min(mn, p.y); mx = Math.max(mx, p.y); }
  const spans = [];
  for (let y = mn; y <= mx; y++) {
    const yc = y + 0.5, xs = [];
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i], b = pts[(i + 1) % pts.length];
      const ay = a.y + 0.5, by = b.y + 0.5;
      if ((ay <= yc && by > yc) || (by <= yc && ay > yc)) xs.push(a.x + 0.5 + (yc - ay) / (by - ay) * (b.x - a.x));
    }
    xs.sort((p, q) => p - q);
    for (let k = 0; k + 1 < xs.length; k += 2) spans.push([y, Math.ceil(xs[k] - 0.5), Math.floor(xs[k + 1] - 0.5)]);
  }
  return spans;
}
function drawPolygon(ctx, pts, t, mode, fg, bg) {
  if (pts.length < 3) { ctx.fillStyle = fg; polyline(ctx, pts, t, false); return; }
  if (mode >= 1) {
    ctx.fillStyle = mode === 1 ? bg : fg;
    for (const [y, l, r] of polySpans(pts)) hline(ctx, l, r, y);
  }
  ctx.fillStyle = fg;
  if (mode < 2) polyline(ctx, pts, t, true);
  else polyline(ctx, pts, 1, true);
}
function bezierPts(p0, p1, p2, p3) {
  const d = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  const n = Math.max(8, Math.ceil((d(p0, p1) + d(p1, p2) + d(p2, p3)) / 3));
  const out = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n, m = 1 - t;
    const x = m * m * m * p0.x + 3 * m * m * t * p1.x + 3 * m * t * t * p2.x + t * t * t * p3.x;
    const y = m * m * m * p0.y + 3 * m * m * t * p1.y + 3 * m * t * t * p2.y + t * t * t * p3.y;
    const q = { x: Math.round(x), y: Math.round(y) };
    if (!out.length || out[out.length - 1].x !== q.x || out[out.length - 1].y !== q.y) out.push(q);
  }
  return out;
}
function snap45(a, b) {
  const dx = b.x - a.x, dy = b.y - a.y;
  const oct = ((Math.round(Math.atan2(dy, dx) / (Math.PI / 4)) % 8) + 8) % 8;
  if (oct === 0 || oct === 4) return { x: b.x, y: a.y };
  if (oct === 2 || oct === 6) return { x: a.x, y: b.y };
  const d = Math.max(Math.abs(dx), Math.abs(dy));
  return { x: a.x + Math.sign(dx || 1) * d, y: a.y + Math.sign(dy || 1) * d };
}
function boxOf(a, b, square) {
  let bx = b.x, by = b.y;
  if (square) {
    const d = Math.max(Math.abs(b.x - a.x), Math.abs(b.y - a.y));
    bx = a.x + (b.x < a.x ? -d : d); by = a.y + (b.y < a.y ? -d : d);
  }
  return { x0: Math.min(a.x, bx), y0: Math.min(a.y, by), x1: Math.max(a.x, bx), y1: Math.max(a.y, by) };
}

/* =====================================================================
 * DOM + state
 * ===================================================================== */
const win = $('#win'), ws = $('#ws'), stage = $('#stage'), wrap = $('#wrap');
const main = $('#main'), over = $('#overlay'), gridEl = $('#grid');
const selBox = $('#selbox'), ghost = $('#ghost'), optbox = $('#optbox');
const fontbar = $('#fontbar'), toastEl = $('#toast');
const mctx = ctx2d(main, { alpha: false, willReadFrequently: true });
const octx = ctx2d(over);

const BRUSHES = [
  ['circle', 8], ['circle', 5], ['circle', 2],
  ['square', 8], ['square', 5], ['square', 2],
  ['slash', 8], ['slash', 5], ['slash', 3],
  ['back', 8], ['back', 5], ['back', 3],
];
const EMOJIS = ['🦐', '🙏', '😇', '🍞', '🥦', '🦀', '🔥', '✨', '💀', '😭'];
const FONTS = [
  ['Arial', 'Arial, "Liberation Sans", Helvetica, sans-serif'],
  ['Times New Roman', '"Times New Roman", "Liberation Serif", Times, serif'],
  ['Courier New', '"Courier New", "Liberation Mono", Courier, monospace'],
  ['Comic Sans MS', '"Comic Sans MS", "Comic Sans", "Chalkboard SE", "Comic Neue", cursive'],
  ['Impact', 'Impact, "Arial Black", "Haettenschweiler", sans-serif'],
  ['Georgia', 'Georgia, "DejaVu Serif", serif'],
  ['Verdana', 'Verdana, "DejaVu Sans", sans-serif'],
  ['Trebuchet MS', '"Trebuchet MS", "Lucida Grande", sans-serif'],
  ['Tahoma', 'Tahoma, "DejaVu Sans", sans-serif'],
];
const FONT_SIZES = [8, 9, 10, 11, 12, 14, 16, 18, 20, 22, 24, 28, 32, 36, 48, 60, 72, 96];
const PALETTE = [
  '#000000', '#808080', '#800000', '#808000', '#008000', '#008080', '#000080', '#800080', '#808040', '#004040', '#0080ff', '#004080', '#8000ff', '#804000', '#9fcc00',
  '#ffffff', '#c0c0c0', '#ff0000', '#ffff00', '#00ff00', '#00ffff', '#0000ff', '#ff00ff', '#ffff80', '#00ff80', '#80ffff', '#8080ff', '#ff0080', '#ff8040', '#d4ff3a',
];
const DEFAULT_MSG = 'For Help, click Help Topics on the Help Menu.';

const S = {
  w: 800, h: 500, zoom: 1,
  tool: 'pencil', prevTool: 'pencil',
  primary: '#000000', secondary: '#ffffff',
  lineWidth: 1, fillMode: 0,
  brush: 1, eraser: 8, air: 8, magZoom: 4,
  transparent: false, textOpaque: false,
  slop: 14, emoji: '🦐', emojiSize: 40,
  grid: false, dirty: false, fileName: 'untitled',
  font: { family: 0, size: 18, bold: false, italic: false, underline: false },
  fontbarClosed: false,
};

let op = null;          // current pointer operation
let sel = null;         // selection {x,y,w,h,canvas?,mask?,ver}
let text = null;        // active text box
let curve = null;       // curve tool state
let poly = null;        // polygon tool state
let clip = null;        // internal clipboard canvas
let clipInternalNewer = false;
let pan = null;         // two-finger pan state
const touches = new Map();
const undoStack = [], redoStack = [];

/* =====================================================================
 * Icons (inline SVG, 16x16, drawn crisp)
 * ===================================================================== */
const svg = inner => `<svg viewBox="0 0 16 16" aria-hidden="true" shape-rendering="crispEdges">${inner}</svg>`;
const ICONS = {
  freesel: svg('<path d="M5.5 1.5l4 1 1 3 3 1-1 4 1 3-4-1-3 2-2-3-3-1 2-3-1-3z" fill="none" stroke="#000" stroke-dasharray="1 1"/>'),
  select: svg('<rect x="1.5" y="2.5" width="13" height="11" fill="none" stroke="#000" stroke-dasharray="1 1"/>'),
  eraser: svg('<path d="M6.5 3.5h8l-4 5h-8z" fill="#fff" stroke="#000"/><path d="M2.5 8.5h8v4h-8z" fill="#ffb7cf" stroke="#000"/><path d="M10.5 8.5l4-5v4l-4 5z" fill="#c8668a" stroke="#000"/>'),
  fill: svg('<path d="M1.5 7.5l5-5 6 6-5 5z" fill="#c0c0c0" stroke="#000"/><path d="M3.5 7.5l3-3 3 3z" fill="#fff"/><path d="M6.5 2.5c-2-2-4-1-4 1" fill="none" stroke="#000"/><path d="M12.5 8.5c1 1 2 2.5 2 4.5 0 1-1 1-1 0v-3" fill="#9fcc00" stroke="#2c3d00"/>'),
  picker: svg('<path d="M10.5 1.5l1-1 4 4-1 1-1-0.2-3.8-3.8z" fill="#000"/><path d="M9.5 3.5l3 3-7 7h-2l-1 1-1-1 1-1v-2z" fill="#fff" stroke="#000"/><path d="M4 12l6-6" stroke="#9ab" />'),
  zoom: svg('<circle cx="6" cy="6" r="4.5" fill="#cfe7ff" stroke="#000"/><path d="M4 4.5q1-1.5 2.5-1" fill="none" stroke="#fff"/><path d="M9 9l5 5" stroke="#000" stroke-width="2.6" stroke-linecap="square"/>'),
  pencil: svg('<path d="M1.5 14.5l1-4 8.5-8.5 3 3-8.5 8.5z" fill="#ffd400" stroke="#000"/><path d="M1.5 14.5l1-4 3 3z" fill="#f2cf9a" stroke="#000"/><path d="M1 15l1-2.5 1.5 1.5z" fill="#000"/><path d="M11 2l1.5-1.5 3 3L14 5z" fill="#ff8fb0" stroke="#000"/><path d="M4 11l7-7" stroke="#b08a00"/>'),
  brush: svg('<path d="M15 1l-5.5 5.5" stroke="#8b4a1a" stroke-width="2.6"/><path d="M9.5 4.5l2 2-2 2-2-2z" fill="#c0c0c0" stroke="#000"/><path d="M6.5 7.5c-2 0-2.8 1.5-3.2 3.2-.4 1.5-1.2 2.6-2.3 3.8 3 0 5.4-.8 6.6-2.7.8-1.4.6-2.8-1.1-4.3z" fill="#000"/>'),
  airbrush: svg('<rect x="8.5" y="6.5" width="5" height="8" fill="#c0c0c0" stroke="#000"/><path d="M9.5 7.5v6" stroke="#fff"/><rect x="9.5" y="4.5" width="3" height="2" fill="#808080" stroke="#000"/><rect x="10" y="2" width="2" height="2" fill="#000"/><g fill="#000"><rect x="7" y="1" width="1" height="1"/><rect x="5" y="2" width="1" height="1"/><rect x="7" y="3" width="1" height="1"/><rect x="3" y="1" width="1" height="1"/><rect x="4" y="4" width="1" height="1"/><rect x="2" y="3" width="1" height="1"/><rect x="6" y="5" width="1" height="1"/><rect x="1" y="5" width="1" height="1"/><rect x="3" y="6" width="1" height="1"/></g>'),
  text: svg('<path d="M2.5 14l4.2-12h2.6l4.2 12h-2.4l-1-3H5.9l-1 3zM6.6 9h2.8L8 4.6z" fill="#000" fill-rule="evenodd"/>'),
  line: svg('<path d="M2.5 13.5l11-11" stroke="#000" fill="none"/>'),
  curve: svg('<path d="M1.5 13.5C2.5 4 6 3 8 8s5.5 4 6.5-6" fill="none" stroke="#000"/>'),
  rect: svg('<rect x="2.5" y="3.5" width="11" height="9" fill="#808080" stroke="#000"/>'),
  poly: svg('<path d="M2.5 2.5h7l-2 4.5h6.5v6.5h-11.5z" fill="#808080" stroke="#000"/>'),
  ellipse: svg('<ellipse cx="8" cy="8" rx="6.5" ry="4.5" fill="#808080" stroke="#000"/>'),
  rrect: svg('<rect x="2.5" y="3.5" width="11" height="9" rx="3" fill="#808080" stroke="#000"/>'),
  slop: svg('<path d="M1.5 3.5h13v3c0 1-1 1-1 2v2c0 1.6-2 1.6-2 0V8.2c0-.9-1.5-.9-1.5 0v5c0 1.7-2.2 1.7-2.2 0V8.6c0-.9-1.5-.9-1.5 0v1.2c0 1.5-2 1.5-2 0V7.4c0-.6-.6-.8-.8-1.3z" fill="#9fcc00" stroke="#2c3d00"/><path d="M3 5h6" stroke="#eaff9a"/><rect x="8" y="10" width="1" height="2" fill="#eaff9a"/>'),
  stamp: svg('<rect x="6" y="1" width="4" height="4" rx="2" fill="#8b4a1a" stroke="#000"/><rect x="7" y="5" width="2" height="3" fill="#8b4a1a" stroke="#000" stroke-width=".8"/><rect x="2.5" y="8.5" width="11" height="3" fill="#c0c0c0" stroke="#000"/><rect x="2.5" y="11.5" width="11" height="2" fill="#d4ff3a" stroke="#000"/><path d="M13 1l.6 1.4L15 3l-1.4.6L13 5l-.6-1.4L11 3l1.4-.6z" fill="#ffd400"/>'),
};
const CURSORS = (() => {
  const cur = (inner, x, y, fb = 'crosshair') => `url("data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 16 16" shape-rendering="crispEdges">${inner}</svg>`)}") ${x} ${y}, ${fb}`;
  return {
    pencil: cur('<path d="M1.5 14.5l1-4 8.5-8.5 3 3-8.5 8.5z" fill="#ffd400" stroke="#000"/><path d="M1.5 14.5l1-4 3 3z" fill="#f2cf9a" stroke="#000"/><path d="M1 15l1-2.5 1.5 1.5z" fill="#000"/>', 1, 23),
    fill: cur('<path d="M1.5 7.5l5-5 6 6-5 5z" fill="#c0c0c0" stroke="#000"/><path d="M12.5 8.5c1 1 2 2.5 2 4.5 0 1-1 1-1 0v-3" fill="#000" stroke="#000"/>', 21, 22),
    picker: cur('<path d="M10.5 1.5l1-1 4 4-1 1z" fill="#000"/><path d="M9.5 3.5l3 3-7 7h-2l-1 1-1-1 1-1v-2z" fill="#fff" stroke="#000"/>', 1, 23),
    zoom: cur('<circle cx="6" cy="6" r="4.5" fill="none" stroke="#000"/><circle cx="6" cy="6" r="3.5" fill="none" stroke="#fff"/><path d="M9 9l5 5" stroke="#000" stroke-width="2.6"/>', 9, 9, 'zoom-in'),
    airbrush: cur('<rect x="8.5" y="6.5" width="5" height="8" fill="#c0c0c0" stroke="#000"/><rect x="9.5" y="4.5" width="3" height="2" fill="#808080" stroke="#000"/><rect x="10" y="2" width="2" height="2" fill="#000"/>', 16, 3),
  };
})();

const TOOLS = [
  ['freesel', 'Free-Form Select', 'Selects a free-form part of the picture to move, copy, or edit.'],
  ['select', 'Select', 'Selects a rectangular part of the picture to move, copy, or edit.'],
  ['eraser', 'Eraser/Color Eraser', 'Erases a portion of the picture, using the selected eraser shape. Right-drag erases only the primary color.'],
  ['fill', 'Fill With Color', 'Fills an area with the current drawing color.'],
  ['picker', 'Pick Color', 'Picks up a color from the picture for drawing.'],
  ['zoom', 'Magnifier', 'Changes the magnification.'],
  ['pencil', 'Pencil', 'Draws a free-form line one pixel wide.'],
  ['brush', 'Brush', 'Draws using a brush with the selected shape and size.'],
  ['airbrush', 'Airbrush', 'Draws using an airbrush of the selected size.'],
  ['text', 'Text', 'Inserts text into the picture.'],
  ['line', 'Line', 'Draws a straight line with the selected line width. Shift snaps to 45°.'],
  ['curve', 'Curve', 'Draws a curved line: drag a line, then click twice to bend it.'],
  ['rect', 'Rectangle', 'Draws a rectangle with the selected fill style. Shift for a square.'],
  ['poly', 'Polygon', 'Draws a polygon: drag the first side, click for more, double-click to finish.'],
  ['ellipse', 'Ellipse', 'Draws an ellipse with the selected fill style. Shift for a circle.'],
  ['rrect', 'Rounded Rectangle', 'Draws a rounded rectangle with the selected fill style.'],
  ['slop', 'Slop Brush', 'Paints thick green slime that drips. Right-click for the dark batch.'],
  ['stamp', 'Slop Stamp', 'Stamps premium emoji slop. Right-click for a surprise slop.'],
];
const TOOL_INFO = Object.fromEntries(TOOLS.map(t => [t[0], t]));

/* =====================================================================
 * Status bar, title, toast
 * ===================================================================== */
const sbMsg = $('#sbMsg'), sbPos = $('#sbPos'), sbSize = $('#sbSize'), sbCanvas = $('#sbCanvas');
function status(msg) { sbMsg.textContent = msg || DEFAULT_MSG; }
function setPos(p) { sbPos.textContent = p ? `${p.x},${p.y}` : ''; }
function setSizeStatus(w, hh) { sbSize.textContent = w == null ? '' : `${w}x${hh}`; }
function updateSize() { if (sel) setSizeStatus(sel.w, sel.h); else setSizeStatus(null); }
function updateTitle() {
  const t = `${S.fileName} - Slop Paint`;
  $('#title').textContent = t; $('#taskTitle').textContent = t;
}
function markDirty() { S.dirty = true; }
let toastTimer = 0;
function toast(msg) {
  toastEl.textContent = msg;
  toastEl.classList.remove('show'); void toastEl.offsetWidth; toastEl.classList.add('show');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => toastEl.classList.remove('show'), 1500);
}

/* =====================================================================
 * Canvas size, zoom, layout
 * ===================================================================== */
function layout() {
  const z = S.zoom, W = S.w * z, Hh = S.h * z;
  wrap.style.width = W + 'px'; wrap.style.height = Hh + 'px';
  for (const c of [main, over]) { c.style.width = W + 'px'; c.style.height = Hh + 'px'; }
  stage.style.width = (W + 3 + 18) + 'px'; stage.style.height = (Hh + 3 + 18) + 'px';
  gridEl.hidden = !(S.grid && z >= 4);
  gridEl.style.backgroundSize = `${z}px ${z}px`;
  updateSelBox();
  if (text) styleTextBox();
  sbCanvas.textContent = `${S.w}x${S.h}`;
}
function setCanvasSize(nw, nh, keep = true, fill = S.secondary) {
  nw = clamp(Math.round(nw), 1, 6000); nh = clamp(Math.round(nh), 1, 6000);
  const tmp = keep ? copyCanvas(main) : null;
  main.width = nw; main.height = nh; over.width = nw; over.height = nh;
  mctx.imageSmoothingEnabled = false; octx.imageSmoothingEnabled = false;
  mctx.fillStyle = fill; mctx.fillRect(0, 0, nw, nh);
  if (tmp) mctx.drawImage(tmp, 0, 0);
  S.w = nw; S.h = nh;
  layout();
}
function setZoom(z, anchor) {
  z = clamp(z, 1, 8);
  if (z === S.zoom && !anchor) return;
  commitText();
  S.zoom = z;
  layout();
  if (anchor) {
    ws.scrollLeft = anchor.ix * z + 3 - anchor.cx;
    ws.scrollTop = anchor.iy * z + 3 - anchor.cy;
  }
  if (S.tool === 'zoom') renderOptions();
  status(`Zoom ${z * 100}%`);
}
function clearOverlay() { octx.clearRect(0, 0, over.width, over.height); }
function toImg(e) {
  const r = wrap.getBoundingClientRect();
  return { x: Math.floor((e.clientX - r.left) / S.zoom), y: Math.floor((e.clientY - r.top) / S.zoom) };
}
const inCanvas = p => p.x >= 0 && p.y >= 0 && p.x < S.w && p.y < S.h;

/* =====================================================================
 * Undo / redo
 * ===================================================================== */
const maxUndo = () => clamp(Math.floor(320e6 / (S.w * S.h * 4)), 5, 50);
function snapshot() { return { w: S.w, h: S.h, data: mctx.getImageData(0, 0, S.w, S.h) }; }
function restore(s) {
  if (s.w !== S.w || s.h !== S.h) setCanvasSize(s.w, s.h, false);
  mctx.putImageData(s.data, 0, 0);
}
function pushUndo() {
  undoStack.push(snapshot());
  const m = maxUndo();
  while (undoStack.length > m) undoStack.shift();
  redoStack.length = 0;
  markDirty();
}
function undo() {
  if (op) cancelOp();
  if (curve || poly) { cancelCurve(); cancelPoly(); return; }
  commitText(); commitSel(); stopDrips();
  if (!undoStack.length) { status('Nothing to undo.'); return; }
  redoStack.push(snapshot());
  restore(undoStack.pop());
  markDirty();
}
function redo() {
  if (op) cancelOp();
  finishPending(); stopDrips();
  if (!redoStack.length) return;
  undoStack.push(snapshot());
  restore(redoStack.pop());
  markDirty();
}

/* =====================================================================
 * Colors
 * ===================================================================== */
function setColor(which, hex) {
  if (which === 2) S.secondary = hex; else S.primary = hex;
  $('#ccFg').style.background = S.primary;
  $('#ccBg').style.background = S.secondary;
  if (text) styleTextBox();
  if (sel && sel.canvas && S.transparent) renderFloating();
}
function renderPalette() {
  const pal = $('#palette');
  pal.textContent = '';
  PALETTE.forEach((c, i) => {
    let lp = 0;
    const b = h('button', { class: 'sw', type: 'button', 'aria-label': `Color ${c}`, title: 'Left-click: primary · Right-click: secondary · Double-click: edit', style: { background: c } });
    b.addEventListener('pointerdown', e => {
      if (e.button === 2) { e.preventDefault(); setColor(2, PALETTE[i]); return; }
      if (e.button !== 0) return;
      const prev = S.primary;
      setColor(0, PALETTE[i]);
      if (e.pointerType === 'touch') {
        clearTimeout(lp);
        lp = setTimeout(() => { setColor(0, prev); setColor(2, PALETTE[i]); status('Secondary color set. Long-press = right-click.'); if (navigator.vibrate) navigator.vibrate(15); }, 550);
      }
    });
    const stop = () => clearTimeout(lp);
    b.addEventListener('pointerup', stop); b.addEventListener('pointerleave', stop); b.addEventListener('pointercancel', stop);
    b.addEventListener('click', e => { if (e.detail === 0) setColor(0, PALETTE[i]); });
    b.addEventListener('dblclick', () => editSwatch(i));
    b.addEventListener('contextmenu', e => e.preventDefault());
    pal.append(b);
  });
}
async function editSwatch(i) {
  const res = await editColorsDialog(PALETTE[i]);
  if (!res) return;
  PALETTE[i] = res;
  renderPalette();
  setColor(0, res);
}

/* =====================================================================
 * Selection
 * ===================================================================== */
function updateSelBox(r = sel, marquee = false) {
  if (!r) { selBox.hidden = true; return; }
  const z = S.zoom;
  selBox.hidden = false;
  selBox.style.left = (r.x * z - 1) + 'px';
  selBox.style.top = (r.y * z - 1) + 'px';
  selBox.style.width = (r.w * z + 2) + 'px';
  selBox.style.height = (r.h * z + 2) + 'px';
  selBox.classList.toggle('handles', !marquee && r === sel);
}
const transCache = { key: null, canvas: null };
function selImage() {
  if (!S.transparent) return sel.canvas;
  const key = `${sel.ver}|${S.secondary}|${sel.canvas.width}x${sel.canvas.height}`;
  if (transCache.key === key && transCache.src === sel.canvas) return transCache.canvas;
  const c = copyCanvas(sel.canvas), x = c.getContext('2d', { willReadFrequently: true });
  const img = x.getImageData(0, 0, c.width, c.height), d = img.data;
  const [r, g, b] = hexToRgb(S.secondary);
  for (let i = 0; i < d.length; i += 4) if (d[i] === r && d[i + 1] === g && d[i + 2] === b) d[i + 3] = 0;
  x.putImageData(img, 0, 0);
  Object.assign(transCache, { key, canvas: c, src: sel.canvas });
  return c;
}
function renderFloating() {
  clearOverlay();
  if (sel && sel.canvas) octx.drawImage(selImage(), sel.x, sel.y, sel.w, sel.h);
}
function getRegion(s) {
  const c = mkCanvas(s.w, s.h), x = ctx2d(c);
  x.drawImage(main, -s.x, -s.y);
  if (s.mask) { x.globalCompositeOperation = 'destination-in'; x.drawImage(s.mask, 0, 0); }
  return c;
}
function tinted(mask, color) {
  const c = copyCanvas(mask), x = ctx2d(c);
  x.globalCompositeOperation = 'source-in'; x.fillStyle = color; x.fillRect(0, 0, c.width, c.height);
  return c;
}
function lift() {
  if (!sel || sel.canvas) return;
  pushUndo();
  sel.canvas = getRegion(sel);
  sel.ver = (sel.ver || 0) + 1;
  if (sel.mask) mctx.drawImage(tinted(sel.mask, S.secondary), sel.x, sel.y);
  else { mctx.fillStyle = S.secondary; mctx.fillRect(sel.x, sel.y, sel.w, sel.h); }
  sel.mask = null;
  renderFloating();
}
function commitSel() {
  if (!sel) return;
  if (sel.canvas) { mctx.drawImage(selImage(), sel.x, sel.y, sel.w, sel.h); markDirty(); }
  sel = null;
  clearOverlay();
  updateSelBox(null);
  updateSize();
}
function selCanvas() {
  if (!sel) return null;
  if (sel.canvas) { const c = mkCanvas(sel.w, sel.h); ctx2d(c).drawImage(selImage(), 0, 0, sel.w, sel.h); return c; }
  return getRegion(sel);
}
function clearSelection() {
  if (!sel) return;
  if (!sel.canvas) {
    pushUndo();
    if (sel.mask) mctx.drawImage(tinted(sel.mask, S.secondary), sel.x, sel.y);
    else { mctx.fillStyle = S.secondary; mctx.fillRect(sel.x, sel.y, sel.w, sel.h); }
  }
  sel = null; clearOverlay(); updateSelBox(null); updateSize(); markDirty();
}
function copySel() {
  if (op) return false;
  commitText();
  const c = selCanvas();
  if (!c) { status('Select something first.'); return false; }
  clip = c; clipInternalNewer = true;
  try {
    if (navigator.clipboard && navigator.clipboard.write && window.ClipboardItem) {
      const item = new ClipboardItem({ 'image/png': new Promise(res => c.toBlob(res, 'image/png')) });
      navigator.clipboard.write([item]).catch(() => {});
    }
  } catch (_) { /* in-app clipboard still works */ }
  status(`Copied ${c.width}x${c.height} pixels of premium slop.`);
  return true;
}
function cutSel() { if (copySel()) clearSelection(); }
function viewOrigin() {
  return { x: clamp(Math.floor((ws.scrollLeft - 3) / S.zoom), 0, S.w - 1), y: clamp(Math.floor((ws.scrollTop - 3) / S.zoom), 0, S.h - 1) };
}
async function pasteCanvas(src) {
  if (op) cancelOp();
  finishPending();
  if (src.width > S.w || src.height > S.h) {
    const r = await msgBox('The image in the clipboard is larger than the bitmap.\nWould you like the bitmap enlarged?', ['Yes', 'No', 'Cancel'], 'question');
    if (r === 'Cancel' || r == null) return;
    if (r === 'Yes') { pushUndo(); setCanvasSize(Math.max(S.w, src.width), Math.max(S.h, src.height)); }
  }
  setTool('select');
  pushUndo();
  const v = viewOrigin();
  sel = { x: v.x, y: v.y, w: src.width, h: src.height, canvas: copyCanvas(src), ver: 1 };
  renderFloating(); updateSelBox(); updateSize();
  status('Pasted. Drag it into place, then click outside to drop it.');
}
async function pasteBlob(blob) {
  try {
    const img = await loadBlobImage(blob);
    const c = mkCanvas(img.naturalWidth, img.naturalHeight); ctx2d(c).drawImage(img, 0, 0);
    await pasteCanvas(c);
  } catch (_) { msgBox('Slop Paint cannot paste this.\nZe clipboard contains no picture.', ['OK'], 'warn'); }
}
async function pasteMenu() {
  if (clipInternalNewer && clip) return pasteCanvas(clip);
  try {
    if (navigator.clipboard && navigator.clipboard.read) {
      const items = await navigator.clipboard.read();
      for (const it of items) {
        const t = it.types.find(x => x.startsWith('image/'));
        if (t) return pasteBlob(await it.getType(t));
      }
    }
  } catch (_) { /* permission denied: fall back */ }
  if (clip) return pasteCanvas(clip);
  status('The clipboard is empty. Copy something first (or press Ctrl+V).');
}
function selectAll() {
  if (op) return;
  finishPending();
  setTool('select');
  sel = { x: 0, y: 0, w: S.w, h: S.h, ver: 0 };
  updateSelBox(); updateSize();
}
function insideSel(p) { return sel && p.x >= sel.x && p.y >= sel.y && p.x < sel.x + sel.w && p.y < sel.y + sel.h; }

/* =====================================================================
 * Text tool
 * ===================================================================== */
const fontCss = (z = 1) => { const f = S.font; return `${f.italic ? 'italic ' : ''}${f.bold ? 'bold ' : ''}${Math.round(f.size * z)}px ${FONTS[f.family][1]}`; };
const lineH = () => Math.round(S.font.size * 1.25);
function createTextBox(x, y, w, hh) {
  const box = h('div', { class: 'textbox' });
  const ta = h('textarea', { spellcheck: 'false', autocomplete: 'off', autocapitalize: 'off', 'aria-label': 'Text to insert into the picture' });
  box.append(ta);
  box.addEventListener('pointerdown', e => e.stopPropagation());
  ta.addEventListener('input', growText);
  ta.addEventListener('keydown', e => { if (e.key === 'Escape') { e.preventDefault(); commitText(); } });
  wrap.append(box);
  text = { x, y, w, h: hh, box, ta };
  styleTextBox();
  showFontbar();
  setTimeout(() => ta.focus({ preventScroll: true }), 0);
}
function styleTextBox() {
  if (!text) return;
  const z = S.zoom, { box, ta } = text;
  Object.assign(box.style, { left: text.x * z + 'px', top: text.y * z + 'px', width: text.w * z + 'px', height: text.h * z + 'px' });
  ta.style.font = fontCss(z);
  ta.style.lineHeight = lineH() * z + 'px';
  ta.style.color = S.primary;
  ta.style.caretColor = S.primary;
  ta.style.textDecoration = S.font.underline ? 'underline' : 'none';
  ta.style.background = S.textOpaque ? S.secondary : 'transparent';
}
function growText() {
  if (!text) return;
  const need = Math.ceil(text.ta.scrollHeight / S.zoom);
  if (need > text.h) { text.h = Math.min(need, S.h - text.y); styleTextBox(); }
}
function wrapLines(x, str, maxW) {
  const out = [];
  for (const para of str.split('\n')) {
    if (!para) { out.push(''); continue; }
    const words = para.split(/(\s+)/);
    let cur = '';
    for (const wd of words) {
      if (!wd) continue;
      const test = cur + wd;
      if (x.measureText(test).width <= maxW || !cur) {
        if (x.measureText(test).width > maxW && !/\s/.test(wd)) {
          // a single word longer than the box: break it by characters
          let part = cur;
          for (const ch of wd) {
            if (x.measureText(part + ch).width > maxW && part) { out.push(part); part = ch; } else part += ch;
          }
          cur = part;
        } else cur = test;
      } else if (/^\s+$/.test(wd)) {
        cur += wd;
      } else {
        out.push(cur.replace(/\s+$/, ''));
        cur = wd;
      }
    }
    out.push(cur);
  }
  return out;
}
function commitText() {
  if (!text) return;
  const t = text; text = null;
  const str = t.ta.value;
  t.box.remove();
  if (!str.trim()) return;
  pushUndo();
  const c = mkCanvas(t.w, t.h), x = ctx2d(c, { willReadFrequently: true });
  x.font = fontCss(1); x.fillStyle = S.primary; x.textBaseline = 'middle';
  const lh = lineH();
  wrapLines(x, str, t.w).forEach((ln, i) => {
    const yy = i * lh + lh / 2;
    x.fillText(ln, 0, yy);
    if (S.font.underline && ln) x.fillRect(0, Math.round(yy + S.font.size * 0.42), Math.ceil(x.measureText(ln).width), Math.max(1, Math.round(S.font.size / 14)));
  });
  // threshold to aliased pixels, like Win98 text rendering
  const img = x.getImageData(0, 0, c.width, c.height), d = img.data, [r, g, b] = hexToRgb(S.primary);
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] >= 100) { d[i] = r; d[i + 1] = g; d[i + 2] = b; d[i + 3] = 255; } else d[i + 3] = 0;
  }
  x.putImageData(img, 0, 0);
  if (S.textOpaque) { mctx.fillStyle = S.secondary; mctx.fillRect(t.x, t.y, t.w, t.h); }
  mctx.drawImage(c, t.x, t.y);
  markDirty();
}
function showFontbar() { fontbar.hidden = S.fontbarClosed; }
function syncFontbar() {
  $('#fFamily').value = String(S.font.family);
  $('#fSize').value = String(S.font.size);
  $('#fBold').setAttribute('aria-pressed', S.font.bold);
  $('#fItalic').setAttribute('aria-pressed', S.font.italic);
  $('#fUnder').setAttribute('aria-pressed', S.font.underline);
}
function initFontbar() {
  const fam = $('#fFamily'), size = $('#fSize');
  FONTS.forEach(([name], i) => fam.append(h('option', { value: i, text: name })));
  FONT_SIZES.forEach(s => size.append(h('option', { value: s, text: s })));
  const after = () => { styleTextBox(); growText(); if (text) text.ta.focus({ preventScroll: true }); };
  fam.addEventListener('change', () => { S.font.family = +fam.value; after(); });
  size.addEventListener('change', () => { S.font.size = +size.value; after(); });
  for (const [id, k] of [['fBold', 'bold'], ['fItalic', 'italic'], ['fUnder', 'underline']]) {
    const b = $('#' + id);
    b.addEventListener('pointerdown', e => e.preventDefault()); // keep textarea focus
    b.addEventListener('click', () => { S.font[k] = !S.font[k]; syncFontbar(); after(); });
  }
  $('#fbClose').addEventListener('click', () => { S.fontbarClosed = true; fontbar.hidden = true; });
  syncFontbar();
}

/* =====================================================================
 * Curve & polygon (multi-click tools)
 * ===================================================================== */
const colorFor = btn => btn === 2 ? S.secondary : S.primary;
const otherFor = btn => btn === 2 ? S.primary : S.secondary;
function drawCurve(ctx) {
  ctx.fillStyle = colorFor(curve.btn);
  if (curve.stage === 0) line(ctx, curve.p0.x, curve.p0.y, curve.p3.x, curve.p3.y, S.lineWidth);
  else polyline(ctx, bezierPts(curve.p0, curve.c1, curve.c2, curve.p3), S.lineWidth, false);
}
function previewCurve() { clearOverlay(); if (curve) drawCurve(octx); }
function commitCurve() {
  if (!curve) return;
  pushUndo(); drawCurve(mctx); curve = null; clearOverlay();
}
function cancelCurve() { if (curve) { curve = null; clearOverlay(); } }
function previewPoly() {
  clearOverlay();
  if (!poly) return;
  octx.fillStyle = colorFor(poly.btn);
  polyline(octx, poly.pts, S.lineWidth, false);
}
function commitPoly() {
  if (!poly) return;
  const pts = poly.pts.filter((p, i, a) => i === 0 || p.x !== a[i - 1].x || p.y !== a[i - 1].y);
  const btn = poly.btn;
  poly = null; clearOverlay();
  if (!pts.length) return;
  pushUndo();
  drawPolygon(mctx, pts, S.lineWidth, S.fillMode, colorFor(btn), otherFor(btn));
}
function cancelPoly() { if (poly) { poly = null; clearOverlay(); } }

/* =====================================================================
 * Flood fill (scanline, exact match)
 * ===================================================================== */
function floodFill(sx, sy, hex) {
  const W = S.w, Hh = S.h;
  const img = mctx.getImageData(0, 0, W, Hh), d = new Uint32Array(img.data.buffer);
  const target = d[sy * W + sx], fill = pack(hex);
  if (target === fill) return false;
  pushUndo();
  const stack = [sx, sy];
  while (stack.length) {
    const y = stack.pop(); let x = stack.pop();
    let i = y * W + x;
    while (x > 0 && d[i - 1] === target) { x--; i--; }
    let up = false, down = false;
    while (x < W && d[i] === target) {
      d[i] = fill;
      if (y > 0) { const m = d[i - W] === target; if (m && !up) { stack.push(x, y - 1); up = true; } else if (!m) up = false; }
      if (y < Hh - 1) { const m = d[i + W] === target; if (m && !down) { stack.push(x, y + 1); down = true; } else if (!m) down = false; }
      x++; i++;
    }
  }
  mctx.putImageData(img, 0, 0);
  return true;
}

/* =====================================================================
 * Slop brush (layered slime + animated drips)
 * ===================================================================== */
const SLOP_PAL = { shadow: '#3d5200', body: '#9fcc00', shine: '#e6ff8c' };
const SLOP_DARK = { shadow: '#1f2a00', body: '#4d6600', shine: '#9fcc00' };
let slopStroke = null, drips = [], dripRAF = 0;
function slopStamp(x, y) {
  const st = slopStroke, pal = st.pal, d = S.slop, r = d / 2;
  const [sh, bo, sn] = st.X;
  sh.fillStyle = pal.shadow; stamp(sh, x + 1, y + 2, discSpans(d));
  bo.fillStyle = pal.body; stamp(bo, x, y, discSpans(d));
  sn.fillStyle = pal.shine; stamp(sn, x - Math.round(r * 0.38), y - Math.round(r * 0.42), discSpans(Math.max(2, Math.round(d * 0.26))));
  st.dist++;
  if (st.dist > st.nextDrip) {
    st.dist = 0; st.nextDrip = 6 + Math.random() * (14 + d);
    const w = Math.max(2, Math.round(2 + Math.random() * r * 0.55));
    drips.push({ x: x + Math.round((Math.random() * 1.1 - 0.55) * r) - (w >> 1), y: y + Math.round(r * 0.45), w, len: 8 + Math.random() * (14 + d * 3), done: 0, pal, X: st.X });
    if (!dripRAF) dripRAF = requestAnimationFrame(dripStep);
  }
}
function slopComposite() { clearOverlay(); if (slopStroke) for (const c of slopStroke.L) octx.drawImage(c, 0, 0); }
function dripStep() {
  dripRAF = 0;
  let alive = false, touchedLayers = false;
  for (const d of drips) {
    if (d.done >= d.len) continue;
    const speed = 0.35 + (1 - d.done / d.len) * 1.4;
    const y0 = Math.floor(d.y + d.done); d.done = Math.min(d.len, d.done + speed);
    const y1 = Math.floor(d.y + d.done);
    const [sh, bo, sn] = d.X || [mctx, mctx, mctx];
    if (d.X) touchedLayers = true; else markDirty();
    if (y1 > y0) {
      sh.fillStyle = d.pal.shadow; sh.fillRect(d.x + 1, y0 + 1, d.w, y1 - y0 + 1);
      bo.fillStyle = d.pal.body; bo.fillRect(d.x, y0, d.w, y1 - y0 + 1);
      if (d.w >= 3) { sn.fillStyle = d.pal.shine; sn.fillRect(d.x + 1, y0, 1, y1 - y0 + 1); }
    }
    if (d.done >= d.len) {
      const bd = d.w + 2, cx = d.x + (d.w >> 1), cy = y1;
      sh.fillStyle = d.pal.shadow; stamp(sh, cx + 1, cy + 1, discSpans(bd));
      bo.fillStyle = d.pal.body; stamp(bo, cx, cy, discSpans(bd));
      sn.fillStyle = d.pal.shine; sn.fillRect(cx - Math.floor(bd / 4), cy - Math.floor(bd / 4), 1, 1);
    } else alive = true;
  }
  drips = drips.filter(d => d.done < d.len);
  if (touchedLayers) slopComposite();
  if (alive) dripRAF = requestAnimationFrame(dripStep);
}
function stopDrips() { drips = []; if (dripRAF) cancelAnimationFrame(dripRAF); dripRAF = 0; }
function slopCommit() {
  if (!slopStroke) return;
  for (const c of slopStroke.L) mctx.drawImage(c, 0, 0);
  for (const d of drips) if (d.X === slopStroke.X) d.X = null;
  slopStroke = null;
  clearOverlay();
}

/* =====================================================================
 * Tool handlers
 * ===================================================================== */
const fg = () => colorFor(op.btn);
const bg = () => otherFor(op.btn);
function beginStroke() { pushUndo(); op.mutated = true; }
function brushSpans() {
  const [shape, size] = BRUSHES[S.brush];
  const key = shape + size;
  if (!spanCache.has(key)) spanCache.set(key, shape === 'circle' ? discSpans(size) : shape === 'square' ? squareSpans(size) : slashSpans(size, shape === 'back'));
  return spanCache.get(key);
}
function erase(a, b) {
  const s = S.eraser, o = Math.floor(s / 2);
  if (op.btn !== 2) {
    mctx.fillStyle = S.secondary;
    bres(a.x, a.y, b.x, b.y, (x, y) => mctx.fillRect(x - o, y - o, s, s));
    return;
  }
  // color eraser: replace primary with secondary under the eraser
  const x0 = Math.max(0, Math.min(a.x, b.x) - o), y0 = Math.max(0, Math.min(a.y, b.y) - o);
  const x1 = Math.min(S.w, Math.max(a.x, b.x) - o + s), y1 = Math.min(S.h, Math.max(a.y, b.y) - o + s);
  if (x1 <= x0 || y1 <= y0) return;
  const W = x1 - x0, img = mctx.getImageData(x0, y0, W, y1 - y0), d = new Uint32Array(img.data.buffer);
  const from = pack(S.primary), to = pack(S.secondary);
  let changed = false;
  bres(a.x, a.y, b.x, b.y, (x, y) => {
    for (let yy = Math.max(y - o, y0); yy < Math.min(y - o + s, y1); yy++)
      for (let xx = Math.max(x - o, x0); xx < Math.min(x - o + s, x1); xx++) {
        const i = (yy - y0) * W + (xx - x0);
        if (d[i] === from) { d[i] = to; changed = true; }
      }
  });
  if (changed) mctx.putImageData(img, x0, y0);
}
function eraserCursor(p) {
  clearOverlay();
  const s = S.eraser, o = Math.floor(s / 2);
  octx.fillStyle = '#000'; octx.fillRect(p.x - o - 1, p.y - o - 1, s + 2, s + 2);
  octx.fillStyle = S.secondary; octx.fillRect(p.x - o, p.y - o, s, s);
}
function spray(p) {
  const r = S.air, n = Math.round(r * 1.1) + 3;
  mctx.fillStyle = fg();
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2, d = Math.sqrt(Math.random()) * r;
    mctx.fillRect(Math.round(p.x + Math.cos(a) * d), Math.round(p.y + Math.sin(a) * d), 1, 1);
  }
}
function stampEmoji(p, emoji = S.emoji, ctx = mctx) {
  ctx.font = `${S.emojiSize}px ${EMOJI_FONT}`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillStyle = S.primary;
  ctx.fillText(emoji, p.x + 0.5, p.y + 0.5);
  ctx.textAlign = 'start'; ctx.textBaseline = 'alphabetic';
}
function magRect(p, z) {
  const vw = Math.min(S.w, Math.floor(ws.clientWidth / z)), vh = Math.min(S.h, Math.floor(ws.clientHeight / z));
  return { x: clamp(Math.round(p.x - vw / 2), 0, S.w - vw), y: clamp(Math.round(p.y - vh / 2), 0, S.h - vh), w: vw, h: vh };
}

const H = {};
H.pencil = {
  down(p) { beginStroke(); mctx.fillStyle = fg(); mctx.fillRect(p.x, p.y, 1, 1); },
  move(p) { mctx.fillStyle = fg(); line(mctx, op.last.x, op.last.y, p.x, p.y, 1); },
};
H.brush = {
  down(p) { beginStroke(); mctx.fillStyle = fg(); stamp(mctx, p.x, p.y, brushSpans()); },
  move(p) { mctx.fillStyle = fg(); const sp = brushSpans(); bres(op.last.x, op.last.y, p.x, p.y, (x, y) => stamp(mctx, x, y, sp)); },
};
H.eraser = {
  down(p) { beginStroke(); erase(p, p); eraserCursor(p); },
  move(p) { erase(op.last, p); eraserCursor(p); },
  hover(p) { eraserCursor(p); },
};
H.airbrush = {
  down(p) { beginStroke(); spray(p); const o = op; o.timer = setInterval(() => { if (op === o) spray(o.last); }, 28); },
  move(p) { spray(p); },
  up() { clearInterval(op.timer); },
};
H.fill = {
  down(p) { if (inCanvas(p)) floodFill(p.x, p.y, fg()); },
};
H.picker = {
  move(p) { if (inCanvas(p)) { const d = mctx.getImageData(p.x, p.y, 1, 1).data; status(`Color under cursor: ${rgbHex(d[0], d[1], d[2])}`); } },
  up(p) {
    if (!inCanvas(p)) return;
    const d = mctx.getImageData(p.x, p.y, 1, 1).data;
    setColor(op.btn, rgbHex(d[0], d[1], d[2]));
    setTool(S.prevTool);
  },
};
H.zoom = {
  hover(p) {
    clearOverlay();
    if (S.zoom !== 1) return;
    const r = magRect(p, S.magZoom === 1 ? 4 : S.magZoom);
    octx.fillStyle = '#000';
    octx.fillRect(r.x, r.y, r.w, 1); octx.fillRect(r.x, r.y + r.h - 1, r.w, 1);
    octx.fillRect(r.x, r.y, 1, r.h); octx.fillRect(r.x + r.w - 1, r.y, 1, r.h);
  },
  up(p, e) {
    clearOverlay();
    if (S.zoom === 1 && op.btn !== 2) {
      const z = S.magZoom === 1 ? 4 : S.magZoom, r = magRect(p, z);
      setZoom(z);
      ws.scrollLeft = r.x * z; ws.scrollTop = r.y * z;
    } else {
      const wr = ws.getBoundingClientRect();
      setZoom(1, { ix: p.x, iy: p.y, cx: e.clientX - wr.left, cy: e.clientY - wr.top });
    }
    setTool(S.prevTool);
  },
};
H.line = {
  down(p) { this.move(p); },
  move(p) {
    const q = op.shift ? snap45(op.start, p) : p;
    clearOverlay(); octx.fillStyle = fg(); line(octx, op.start.x, op.start.y, q.x, q.y, S.lineWidth);
    setSizeStatus(Math.abs(q.x - op.start.x), Math.abs(q.y - op.start.y));
  },
  up(p) {
    const q = op.shift ? snap45(op.start, p) : p;
    clearOverlay(); pushUndo(); mctx.fillStyle = fg(); line(mctx, op.start.x, op.start.y, q.x, q.y, S.lineWidth);
  },
};
for (const type of ['rect', 'ellipse', 'rrect']) {
  H[type] = {
    down(p) { this.move(p); },
    move(p) {
      const b = boxOf(op.start, p, op.shift);
      clearOverlay(); drawShape(octx, type, b.x0, b.y0, b.x1, b.y1, S.lineWidth, S.fillMode, fg(), bg());
      setSizeStatus(b.x1 - b.x0 + 1, b.y1 - b.y0 + 1);
    },
    up(p) {
      const b = boxOf(op.start, p, op.shift);
      clearOverlay(); pushUndo(); drawShape(mctx, type, b.x0, b.y0, b.x1, b.y1, S.lineWidth, S.fillMode, fg(), bg());
    },
  };
}
H.curve = {
  down(p) {
    if (!curve) curve = { stage: 0, btn: op.btn, p0: p, p3: p, c1: p, c2: p };
    else if (curve.stage === 1) curve.c1 = curve.c2 = p;
    else curve.c2 = p;
    previewCurve();
  },
  move(p) {
    if (!curve) return;
    if (curve.stage === 0) curve.p3 = op.shift ? snap45(curve.p0, p) : p;
    else if (curve.stage === 1) curve.c1 = curve.c2 = p;
    else curve.c2 = p;
    previewCurve();
  },
  up() {
    if (!curve) return;
    if (curve.stage < 2) { curve.stage++; status(curve.stage === 1 ? 'Click or drag to bend the curve (1 of 2).' : 'Click or drag to bend it once more (2 of 2).'); }
    else { commitCurve(); status(); }
  },
};
H.poly = {
  down(p) {
    if (!poly) poly = { btn: op.btn, pts: [p, { ...p }], lastUp: 0 };
    else poly.pts.push(op.shift ? snap45(poly.pts[poly.pts.length - 1], p) : p);
    previewPoly();
  },
  move(p) {
    if (!poly) return;
    const n = poly.pts.length;
    poly.pts[n - 1] = op.shift ? snap45(poly.pts[n - 2], p) : p;
    previewPoly();
  },
  up() {
    if (!poly) return;
    const pts = poly.pts, n = pts.length, last = pts[n - 1], now = performance.now();
    const tol = Math.max(2, Math.ceil(5 / S.zoom));
    const near = (a, b) => Math.abs(a.x - b.x) <= tol && Math.abs(a.y - b.y) <= tol;
    if (n >= 3 && (near(last, pts[0]) || (now - poly.lastUp < 450 && near(last, pts[n - 2])))) {
      pts.pop();
      commitPoly();
      return;
    }
    poly.lastUp = now;
  },
};
function selDown(p, e) {
  if (sel && insideSel(p)) {
    if (!sel.canvas) lift();
    else if (op.ctrl) { pushUndo(); mctx.drawImage(selImage(), sel.x, sel.y, sel.w, sel.h); }
    op.mode = 'move'; op.dx = p.x - sel.x; op.dy = p.y - sel.y; op.ox = sel.x; op.oy = sel.y;
    return;
  }
  commitSel();
  if (S.tool === 'freesel') { op.mode = 'lasso'; op.pts = [clampPt(p)]; clearOverlay(); }
  else { op.mode = 'marquee'; updateSelBox({ x: p.x, y: p.y, w: 0, h: 0 }, true); }
}
const clampPt = p => ({ x: clamp(p.x, 0, S.w - 1), y: clamp(p.y, 0, S.h - 1) });
function marqueeRect(a, b) {
  a = clampPt(a); const q = { x: clamp(b.x, 0, S.w), y: clamp(b.y, 0, S.h) };
  return { x: Math.min(a.x, q.x), y: Math.min(a.y, q.y), w: Math.abs(q.x - a.x), h: Math.abs(q.y - a.y) };
}
function selMove(p) {
  if (op.mode === 'move') {
    sel.x = p.x - op.dx; sel.y = p.y - op.dy;
    renderFloating(); updateSelBox();
  } else if (op.mode === 'marquee') {
    const r = marqueeRect(op.start, p);
    updateSelBox(r, true); setSizeStatus(r.w, r.h);
  } else if (op.mode === 'lasso') {
    const q = clampPt(p), l = op.pts[op.pts.length - 1];
    if (q.x === l.x && q.y === l.y) return;
    op.pts.push(q);
    octx.fillStyle = '#000'; line(octx, l.x, l.y, q.x, q.y, 1);
  }
}
function selUp(p) {
  if (op.mode === 'marquee') {
    const r = marqueeRect(op.start, p);
    if (r.w > 0 && r.h > 0) { sel = { ...r, ver: 0 }; updateSelBox(); }
    else updateSelBox(null);
  } else if (op.mode === 'lasso') {
    clearOverlay();
    const pts = op.pts;
    if (pts.length < 3) return;
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const q of pts) { x0 = Math.min(x0, q.x); y0 = Math.min(y0, q.y); x1 = Math.max(x1, q.x); y1 = Math.max(y1, q.y); }
    const w = x1 - x0 + 1, hh = y1 - y0 + 1;
    if (w < 2 || hh < 2) return;
    const mask = mkCanvas(w, hh), mx = ctx2d(mask, { willReadFrequently: true });
    mx.fillStyle = '#000';
    mx.beginPath(); pts.forEach((q, i) => (i ? mx.lineTo : mx.moveTo).call(mx, q.x - x0 + 0.5, q.y - y0 + 0.5)); mx.closePath(); mx.fill();
    for (let i = 1; i < pts.length; i++) line(mx, pts[i - 1].x - x0, pts[i - 1].y - y0, pts[i].x - x0, pts[i].y - y0, 1);
    const img = mx.getImageData(0, 0, w, hh), d = img.data;
    for (let i = 3; i < d.length; i += 4) d[i] = d[i] >= 128 ? 255 : 0;
    mx.putImageData(img, 0, 0);
    sel = { x: x0, y: y0, w, h: hh, mask, ver: 0 };
    updateSelBox();
  }
}
H.select = { down: selDown, move: selMove, up: selUp };
H.freesel = { down: selDown, move: selMove, up: selUp };
H.text = {
  down(p) {
    if (text) { commitText(); op.mode = 'done'; return; }
    op.mode = 'rect';
    updateSelBox({ x: p.x, y: p.y, w: 0, h: 0 }, true);
  },
  move(p) { if (op.mode === 'rect') { const r = marqueeRect(op.start, p); updateSelBox(r, true); setSizeStatus(r.w, r.h); } },
  up(p) {
    if (op.mode !== 'rect') return;
    updateSelBox(null);
    const r = marqueeRect(op.start, p);
    if (!inCanvas(op.start)) return;
    if (r.w < 8 || r.h < 8) { r.x = op.start.x; r.y = op.start.y; r.w = Math.max(r.w, Math.min(S.w - r.x, Math.max(160, S.font.size * 9))); r.h = Math.max(r.h, lineH() + 2); }
    r.w = Math.min(r.w, S.w - r.x); r.h = Math.min(r.h, S.h - r.y);
    if (r.w < 4 || r.h < 4) return;
    createTextBox(r.x, r.y, r.w, r.h);
  },
};
H.slop = {
  down(p) {
    beginStroke();
    const L = [0, 1, 2].map(() => mkCanvas(S.w, S.h));
    slopStroke = { L, X: L.map(c => ctx2d(c)), pal: op.btn === 2 ? SLOP_DARK : SLOP_PAL, dist: 0, nextDrip: 3 };
    slopStamp(p.x, p.y); slopComposite();
  },
  move(p) { if (!slopStroke) return; bres(op.last.x, op.last.y, p.x, p.y, (x, y) => slopStamp(x, y)); slopComposite(); },
  up() { slopCommit(); },
};
H.stamp = {
  down(p) { beginStroke(); clearOverlay(); op.ls = p; stampEmoji(p, op.btn === 2 ? EMOJIS[Math.random() * EMOJIS.length | 0] : S.emoji); },
  move(p) {
    if (Math.hypot(p.x - op.ls.x, p.y - op.ls.y) >= S.emojiSize * 0.85) {
      op.ls = p; stampEmoji(p, op.btn === 2 ? EMOJIS[Math.random() * EMOJIS.length | 0] : S.emoji);
    }
  },
  hover(p) { clearOverlay(); octx.globalAlpha = 0.45; stampEmoji(p, S.emoji, octx); octx.globalAlpha = 1; },
};

function cancelOp() {
  const o = op;
  if (!o) return;
  op = null;
  if (o.timer) clearInterval(o.timer);
  if (o.kind === 'canvasResize') { ghost.hidden = true; return; }
  if (o.kind === 'selResize') { if (sel) { Object.assign(sel, o.r0); renderFloating(); updateSelBox(); } return; }
  const t = S.tool;
  if (o.mutated) {
    if (t === 'slop') { slopStroke = null; stopDrips(); }
    if (undoStack.length) { mctx.putImageData(undoStack.pop().data, 0, 0); }
    clearOverlay();
    return;
  }
  if (t === 'curve') cancelCurve();
  else if (t === 'poly') cancelPoly();
  else if (t === 'select' || t === 'freesel') {
    if (o.mode === 'move' && sel) { sel.x = o.ox; sel.y = o.oy; renderFloating(); updateSelBox(); }
    else { if (o.mode === 'lasso') clearOverlay(); updateSelBox(sel); }
  } else if (t === 'text') updateSelBox(null);
  else clearOverlay();
  updateSize();
}

/* =====================================================================
 * Pointer plumbing
 * ===================================================================== */
const pt = e => ({ x: e.clientX, y: e.clientY });
function midpoint() { let x = 0, y = 0; for (const p of touches.values()) { x += p.x; y += p.y; } return { x: x / touches.size, y: y / touches.size }; }
function onDown(e) {
  if (document.querySelector('.modal-back')) return;
  if (e.pointerType === 'touch') {
    touches.set(e.pointerId, pt(e));
    if (touches.size >= 2) {
      if (op && op.kind === 'tool') cancelOp(); else if (op) cancelOp();
      pan = { last: midpoint() };
      try { wrap.setPointerCapture(e.pointerId); } catch (_) {}
      return;
    }
    if (pan) return;
  }
  if (e.button !== 0 && e.button !== 2) return;
  if (op) { if (e.pointerType === 'mouse') cancelOp(); return; }
  e.preventDefault();
  closeMenus(); closeStart();
  const ae = document.activeElement;
  if (ae && ae !== document.body && !(text && ae === text.ta)) ae.blur();
  const p = toImg(e);
  try { wrap.setPointerCapture(e.pointerId); } catch (_) {}
  op = { kind: 'tool', id: e.pointerId, btn: e.button === 2 ? 2 : 0, start: p, last: p, shift: e.shiftKey, ctrl: e.ctrlKey || e.metaKey, mode: null };
  const T = H[S.tool];
  if (T.down) T.down.call(T, p, e);
  setPos(p);
}
function onMove(e) {
  if (e.pointerType === 'touch' && touches.has(e.pointerId)) {
    touches.set(e.pointerId, pt(e));
    if (pan) {
      const m = midpoint();
      ws.scrollLeft -= m.x - pan.last.x; ws.scrollTop -= m.y - pan.last.y;
      pan.last = m;
      return;
    }
  }
  const p = toImg(e);
  setPos(inCanvas(p) || op ? p : null);
  if (!op) {
    const T = H[S.tool];
    if (T.hover && e.pointerType !== 'touch') T.hover(p, e);
    if (S.tool === 'select' || S.tool === 'freesel') wrap.style.cursor = insideSel(p) ? 'move' : 'crosshair';
    return;
  }
  if (e.pointerId !== op.id) return;
  if (e.pointerType === 'mouse' && op.kind === 'tool' && (e.button === 0 || e.button === 2) && e.button !== op.btn) { cancelOp(); return; }
  op.shift = e.shiftKey;
  if (op.kind === 'canvasResize') { moveCanvasResize(e); return; }
  if (op.kind === 'selResize') { moveSelResize(e); return; }
  const T = H[S.tool];
  if (T.move) T.move.call(T, p, e);
  if (op) op.last = p;
}
function onUp(e) {
  if (e.pointerType === 'touch') {
    touches.delete(e.pointerId);
    if (pan) { if (touches.size === 0) pan = null; else pan.last = midpoint(); return; }
  }
  if (!op || e.pointerId !== op.id) return;
  const p = toImg(e);
  if (op.kind === 'canvasResize') endCanvasResize();
  else if (op.kind === 'selResize') endSelResize();
  else { const T = H[S.tool]; if (T.up) T.up.call(T, p, e); }
  if (op && op.timer) clearInterval(op.timer);
  op = null;
  if (!['line', 'rect', 'ellipse', 'rrect'].includes(S.tool) || true) updateSize();
}
function onCancel(e) {
  touches.delete(e.pointerId);
  if (pan && touches.size === 0) pan = null;
  if (op && e.pointerId === op.id) cancelOp();
}
wrap.addEventListener('pointerdown', onDown);
wrap.addEventListener('pointermove', onMove);
wrap.addEventListener('pointerup', onUp);
wrap.addEventListener('pointercancel', onCancel);
wrap.addEventListener('lostpointercapture', e => { if (op && e.pointerId === op.id && op.kind === 'tool' && e.pointerType !== 'touch') { /* released elsewhere */ } });
wrap.addEventListener('pointerleave', () => {
  if (op) return;
  setPos(null);
  if (['eraser', 'stamp', 'zoom'].includes(S.tool)) clearOverlay();
});
document.addEventListener('contextmenu', e => { if (!isTyping(e.target)) e.preventDefault(); });

// click on the gray workspace commits text / selection, like Paint
ws.addEventListener('pointerdown', e => {
  if (e.target === ws || e.target === stage) {
    closeMenus();
    if (text) commitText();
    if (sel && !op) commitSel();
    if (curve) commitCurve();
    if (poly) commitPoly();
  }
});
// Ctrl+wheel zoom
ws.addEventListener('wheel', e => {
  if (!(e.ctrlKey || e.metaKey)) return;
  e.preventDefault();
  const levels = [1, 2, 4, 6, 8], i = levels.indexOf(S.zoom);
  const ni = clamp((i < 0 ? 0 : i) + (e.deltaY < 0 ? 1 : -1), 0, levels.length - 1);
  if (levels[ni] === S.zoom) return;
  const wr = ws.getBoundingClientRect(), p = toImg(e);
  setZoom(levels[ni], { ix: p.x, iy: p.y, cx: e.clientX - wr.left, cy: e.clientY - wr.top });
}, { passive: false });

// canvas resize handles
$$('.hdl').forEach(hd => {
  hd.addEventListener('pointerdown', e => {
    if (e.button !== 0) return;
    e.stopPropagation(); e.preventDefault();
    if (op) return;
    finishPending();
    try { hd.setPointerCapture(e.pointerId); } catch (_) {}
    op = { kind: 'canvasResize', id: e.pointerId, dir: hd.dataset.dir, w: S.w, h: S.h };
    moveCanvasResize(e);
  });
});
function moveCanvasResize(e) {
  const r = wrap.getBoundingClientRect(), z = S.zoom;
  if (op.dir.includes('e')) op.w = clamp(Math.round((e.clientX - r.left) / z), 1, 6000);
  if (op.dir.includes('s')) op.h = clamp(Math.round((e.clientY - r.top) / z), 1, 6000);
  ghost.hidden = false;
  ghost.style.width = op.w * z + 'px'; ghost.style.height = op.h * z + 'px';
  setSizeStatus(op.w, op.h);
}
function endCanvasResize() {
  ghost.hidden = true;
  if (op.w !== S.w || op.h !== S.h) { pushUndo(); setCanvasSize(op.w, op.h); status(`Canvas resized to ${S.w}x${S.h}. More room for slop.`); }
}
// selection stretch handles
$$('.sh', selBox).forEach(hd => {
  hd.addEventListener('pointerdown', e => {
    if (e.button !== 0 || !sel) return;
    e.stopPropagation(); e.preventDefault();
    if (op) return;
    lift();
    try { hd.setPointerCapture(e.pointerId); } catch (_) {}
    op = { kind: 'selResize', id: e.pointerId, dir: hd.dataset.dir, r0: { x: sel.x, y: sel.y, w: sel.w, h: sel.h } };
  });
});
function moveSelResize(e) {
  const r = wrap.getBoundingClientRect(), z = S.zoom, r0 = op.r0, d = op.dir;
  const px = Math.round((e.clientX - r.left) / z), py = Math.round((e.clientY - r.top) / z);
  let { x, y, w, h: hh } = r0;
  if (d.includes('e')) w = Math.max(1, px - r0.x);
  if (d.includes('s')) hh = Math.max(1, py - r0.y);
  if (d.includes('w')) { x = Math.min(px, r0.x + r0.w - 1); w = r0.x + r0.w - x; }
  if (d.includes('n')) { y = Math.min(py, r0.y + r0.h - 1); hh = r0.y + r0.h - y; }
  Object.assign(sel, { x, y, w, h: hh });
  renderFloating(); updateSelBox(); setSizeStatus(w, hh);
}
function endSelResize() {
  if (!sel || !sel.canvas) return;
  if (sel.w !== sel.canvas.width || sel.h !== sel.canvas.height) {
    const c = mkCanvas(sel.w, sel.h); ctx2d(c).drawImage(sel.canvas, 0, 0, sel.w, sel.h);
    sel.canvas = c; sel.ver++;
  }
}

/* =====================================================================
 * Tools UI + options box
 * ===================================================================== */
function cursorFor(id) {
  if (CURSORS[id]) return CURSORS[id];
  if (id === 'text') return 'text';
  if (id === 'eraser') return 'none';
  return 'crosshair';
}
function finishPending() { commitText(); commitCurve(); commitPoly(); commitSel(); }
function setTool(id) {
  if (op) cancelOp();
  if (id !== S.tool) {
    finishPending();
    clearOverlay();
    if ((id === 'picker' || id === 'zoom') && S.tool !== 'picker' && S.tool !== 'zoom') S.prevTool = S.tool;
    S.tool = id;
  }
  $$('.tool').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.tool === id)));
  wrap.style.cursor = cursorFor(id);
  fontbar.hidden = id !== 'text' || S.fontbarClosed;
  renderOptions();
}
function buildTools() {
  const box = $('#tools');
  for (const [id, name, desc] of TOOLS) {
    if (id === 'slop') box.append(h('div', { class: 'tool-sep', 'aria-hidden': 'true' }));
    const b = h('button', { class: 'tool', type: 'button', 'aria-label': name, title: name, 'aria-pressed': 'false', 'data-tool': id, html: ICONS[id] });
    const pick = () => { if (id === 'text') S.fontbarClosed = false; setTool(id); };
    b.addEventListener('pointerdown', e => { if (e.button === 0) pick(); });
    b.addEventListener('click', e => { if (e.detail === 0) pick(); });
    b.addEventListener('pointerenter', () => status(desc));
    b.addEventListener('pointerleave', () => status());
    b.addEventListener('focus', () => status(desc));
    box.append(b);
  }
}
function prev(w, hh, draw, inv = true) {
  const c = mkCanvas(w, hh), x = ctx2d(c);
  x.fillStyle = '#000'; draw(x);
  c.style.width = w + 'px'; c.style.height = hh + 'px';
  if (inv) c.className = 'inv';
  return c;
}
function opt(content, selected, onpick, label) {
  const b = h('button', { class: 'opt' + (selected ? ' sel' : '') + (typeof content === 'string' ? ' txt' : ''), type: 'button', 'aria-label': label, title: label, 'aria-pressed': String(!!selected) }, content);
  const pick = () => { onpick(); renderOptions(); };
  b.addEventListener('pointerdown', e => { if (e.button === 0) { e.preventDefault(); pick(); } });
  b.addEventListener('click', e => { if (e.detail === 0) pick(); });
  return b;
}
function section(cols, items) { const s = h('div', { class: 'optsec', style: { '--cols': cols } }); s.append(...items); return s; }
function lineWidthSection() {
  return section(1, [1, 2, 3, 4, 5].map(w => opt(prev(34, 7, x => x.fillRect(2, 3 - Math.floor((w - 1) / 2), 30, w)), S.lineWidth === w, () => { S.lineWidth = w; if (curve) previewCurve(); if (poly) previewPoly(); }, `Line width ${w}px`)));
}
function opaqueSection(get, set) {
  const icon = transparent => prev(34, 22, x => {
    if (!transparent) { x.fillStyle = '#000'; x.fillRect(5, 3, 24, 16); x.fillStyle = '#fff'; x.fillRect(6, 4, 22, 14); }
    x.fillStyle = '#ff0000'; stamp(x, 12, 10, discSpans(9));
    x.fillStyle = '#0000ff'; for (let i = 0; i < 9; i++) x.fillRect(19 - i / 2 | 0, 6 + i, i + 1, 1);
    x.fillStyle = '#9fcc00'; x.fillRect(9, 14, 5, 4);
  }, false);
  return section(1, [
    opt(icon(false), !get(), () => set(false), 'Opaque: background color is drawn'),
    opt(icon(true), get(), () => set(true), 'Transparent: background color is see-through'),
  ]);
}
function renderOptions() {
  optbox.textContent = '';
  const t = S.tool, add = s => optbox.append(s);
  if (t === 'select' || t === 'freesel') {
    add(opaqueSection(() => S.transparent, v => { S.transparent = v; renderFloating(); }));
  } else if (t === 'text') {
    add(opaqueSection(() => !S.textOpaque, v => { S.textOpaque = !v; styleTextBox(); }));
  } else if (t === 'eraser') {
    add(section(1, [4, 6, 8, 10].map(s => opt(prev(16, 12, x => x.fillRect(8 - (s >> 1), 6 - (s >> 1), s, s)), S.eraser === s, () => { S.eraser = s; }, `Eraser size ${s}px`))));
  } else if (t === 'brush') {
    add(section(3, BRUSHES.map(([shape, size], i) => opt(prev(11, 11, x => {
      const sp = shape === 'circle' ? discSpans(size) : shape === 'square' ? squareSpans(size) : slashSpans(size, shape === 'back');
      stamp(x, 5, 5, sp);
    }), S.brush === i, () => { S.brush = i; }, `${shape === 'back' ? 'backslash' : shape} brush, ${size}px`))));
  } else if (t === 'airbrush') {
    add(section(1, [4, 8, 12].map(r => opt(prev(30, 26, x => {
      let seed = r * 99;
      const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
      for (let i = 0; i < r * 5; i++) { const a = rnd() * 6.283, d = Math.sqrt(rnd()) * r; x.fillRect(Math.round(15 + Math.cos(a) * d), Math.round(13 + Math.sin(a) * d), 1, 1); }
    }), S.air === r, () => { S.air = r; }, `Airbrush radius ${r}px`))));
  } else if (t === 'zoom') {
    add(section(1, [1, 2, 4, 6, 8].map(z => opt(z + 'x', z === 1 ? S.zoom === 1 : S.zoom === z || (S.zoom === 1 && S.magZoom === z && false), () => {
      S.magZoom = z === 1 ? S.magZoom : z;
      setZoom(z); setTool(S.prevTool);
    }, `Zoom ${z * 100}%`))));
  } else if (t === 'line' || t === 'curve') {
    add(lineWidthSection());
  } else if (['rect', 'poly', 'ellipse', 'rrect'].includes(t)) {
    add(section(1, [0, 1, 2].map(m => opt(prev(34, 13, x => {
      if (m === 1) { x.fillStyle = '#808080'; x.fillRect(5, 3, 24, 7); }
      if (m === 2) { x.fillStyle = '#808080'; x.fillRect(4, 2, 26, 9); return; }
      x.fillStyle = '#000'; x.fillRect(4, 2, 26, 1); x.fillRect(4, 10, 26, 1); x.fillRect(4, 2, 1, 9); x.fillRect(29, 2, 1, 9);
    }, false), S.fillMode === m, () => { S.fillMode = m; }, ['Outline only', 'Outline with fill (secondary color)', 'Filled, no outline'][m]))));
    add(lineWidthSection());
  } else if (t === 'slop') {
    add(section(1, [8, 14, 22].map(s => opt(prev(34, 26, x => {
      x.fillStyle = SLOP_PAL.shadow; stamp(x, 18, 12, discSpans(s));
      x.fillStyle = SLOP_PAL.body; stamp(x, 17, 10, discSpans(s));
      x.fillRect(17 - (s >> 3), 10, Math.max(2, s >> 3), Math.min(15, s));
      x.fillStyle = SLOP_PAL.shine; stamp(x, 17 - Math.round(s * 0.2), 10 - Math.round(s * 0.2), discSpans(Math.max(2, Math.round(s * 0.26))));
    }, false), S.slop === s, () => { S.slop = s; }, `Slop size ${s}px`))));
  } else if (t === 'stamp') {
    add(section(2, EMOJIS.map(em => { const b = opt(em, S.emoji === em, () => { S.emoji = em; }, `Stamp ${em}`); b.classList.remove('txt'); b.classList.add('emo'); return b; })));
    add(section(1, [[24, 'S'], [40, 'M'], [64, 'L']].map(([s, l]) => opt(l, S.emojiSize === s, () => { S.emojiSize = s; }, `Stamp size ${s}px`))));
  }
}

/* =====================================================================
 * Image operations
 * ===================================================================== */
function flipH(c) { const o = mkCanvas(c.width, c.height), x = ctx2d(o); x.setTransform(-1, 0, 0, 1, c.width, 0); x.drawImage(c, 0, 0); return o; }
function flipV(c) { const o = mkCanvas(c.width, c.height), x = ctx2d(o); x.setTransform(1, 0, 0, -1, 0, c.height); x.drawImage(c, 0, 0); return o; }
function rotate(c, deg) {
  const sw = deg === 180, o = mkCanvas(sw ? c.width : c.height, sw ? c.height : c.width), x = ctx2d(o);
  if (deg === 90) x.setTransform(0, 1, -1, 0, c.height, 0);
  else if (deg === 180) x.setTransform(-1, 0, 0, -1, c.width, c.height);
  else x.setTransform(0, -1, 1, 0, 0, c.width);
  x.drawImage(c, 0, 0);
  return o;
}
function invert(c) {
  const o = copyCanvas(c), x = o.getContext('2d', { willReadFrequently: true });
  const img = x.getImageData(0, 0, o.width, o.height), d = img.data;
  for (let i = 0; i < d.length; i += 4) { d[i] = 255 - d[i]; d[i + 1] = 255 - d[i + 1]; d[i + 2] = 255 - d[i + 2]; }
  x.putImageData(img, 0, 0);
  return o;
}
function stretchSkew(c, sx, sy, kx, ky) {
  let cur = c;
  if (sx !== 100 || sy !== 100) {
    const o = mkCanvas(Math.max(1, Math.round(c.width * sx / 100)), Math.max(1, Math.round(c.height * sy / 100)));
    ctx2d(o).drawImage(c, 0, 0, o.width, o.height); cur = o;
  }
  if (kx) {
    const t = Math.tan(kx * Math.PI / 180), extra = Math.round(Math.abs(t) * cur.height);
    const o = mkCanvas(cur.width + extra, cur.height), x = ctx2d(o);
    x.setTransform(1, 0, -t, 1, t > 0 ? extra : 0, 0); x.drawImage(cur, 0, 0); cur = o;
  }
  if (ky) {
    const t = Math.tan(ky * Math.PI / 180), extra = Math.round(Math.abs(t) * cur.width);
    const o = mkCanvas(cur.width, cur.height + extra), x = ctx2d(o);
    x.setTransform(1, -t, 0, 1, 0, t > 0 ? extra : 0); x.drawImage(cur, 0, 0); cur = o;
  }
  return cur;
}
function blackAndWhite(c) {
  const o = copyCanvas(c), x = o.getContext('2d', { willReadFrequently: true });
  const img = x.getImageData(0, 0, o.width, o.height), d = img.data;
  for (let i = 0; i < d.length; i += 4) { const v = (d[i] * 0.3 + d[i + 1] * 0.59 + d[i + 2] * 0.11) >= 128 ? 255 : 0; d[i] = d[i + 1] = d[i + 2] = v; }
  x.putImageData(img, 0, 0);
  return o;
}
async function slopify(c) {
  const w = c.width, hh = c.height;
  const out = mkCanvas(w, hh), x = out.getContext('2d', { willReadFrequently: true });
  x.drawImage(c, 0, 0);
  // 1. deep-fried jpeg crunch (half-res, potato quality)
  try {
    const small = mkCanvas(Math.max(1, w >> 1), Math.max(1, hh >> 1)), sx = small.getContext('2d');
    sx.fillStyle = '#fff'; sx.fillRect(0, 0, small.width, small.height);
    sx.drawImage(c, 0, 0, small.width, small.height);
    const img = await loadImage(small.toDataURL('image/jpeg', 0.08));
    x.imageSmoothingEnabled = false;
    x.globalAlpha = 0.85; x.drawImage(img, 0, 0, w, hh); x.globalAlpha = 1;
  } catch (_) { /* crunch is optional slop */ }
  // 2. slop-green tint + posterize + saturation boost
  const img = x.getImageData(0, 0, w, hh), d = img.data;
  const q = v => Math.round(v / 255 * 4) / 4 * 255;
  for (let i = 0; i < d.length; i += 4) {
    let r = d[i], g = d[i + 1], b = d[i + 2];
    const l = (r + g + b) / 3;
    r = l + (r - l) * 1.6; g = l + (g - l) * 1.6; b = l + (b - l) * 1.6;
    r = r * 0.62 + 159 * 0.38; g = g * 0.62 + 204 * 0.38 + 10; b = b * 0.55;
    d[i] = q(clamp(r, 0, 255)); d[i + 1] = q(clamp(g, 0, 255)); d[i + 2] = q(clamp(b, 0, 255));
  }
  x.putImageData(img, 0, 0);
  // 3. sparkle slop
  const n = 5 + Math.round(Math.sqrt(w * hh) / 45);
  const pool = ['✨', '✨', '✨', '🦐', '🙏', '💀', '🔥', '😭', '😇'];
  x.textAlign = 'center'; x.textBaseline = 'middle';
  for (let i = 0; i < n; i++) {
    const s = Math.round(12 + Math.random() * Math.max(12, Math.min(w, hh) / 7));
    x.font = `${s}px ${EMOJI_FONT}`;
    x.fillText(pool[Math.random() * pool.length | 0], Math.random() * w, Math.random() * hh);
  }
  // 4. a little "authenticity" watermark
  if (w > 120 && hh > 40) {
    const fs = clamp(Math.round(w / 40), 9, 18);
    x.font = `bold ${fs}px ${FONTS[0][1]}`; x.textAlign = 'right'; x.textBaseline = 'bottom';
    x.fillStyle = 'rgba(10,10,10,.55)'; x.fillText('certified slop · slopographic.com', w - 3, hh - 2);
    x.fillStyle = 'rgba(212,255,58,.95)'; x.fillText('certified slop · slopographic.com', w - 4, hh - 3);
  }
  return out;
}
async function applyImage(fn) {
  if (op) cancelOp();
  commitText(); commitCurve(); commitPoly();
  if (sel) {
    lift();
    const out = await fn(selCanvas());
    if (!sel) return;
    sel.canvas = out; sel.w = out.width; sel.h = out.height; sel.ver++;
    renderFloating(); updateSelBox(); updateSize(); markDirty();
    return;
  }
  pushUndo();
  const out = await fn(copyCanvas(main));
  if (out.width !== S.w || out.height !== S.h) setCanvasSize(out.width, out.height, false);
  else { mctx.fillStyle = S.secondary; mctx.fillRect(0, 0, S.w, S.h); }
  mctx.drawImage(out, 0, 0);
}
function clearImage() {
  if (op) cancelOp();
  commitText(); commitCurve(); commitPoly();
  if (sel) { clearSelection(); return; }
  pushUndo(); mctx.fillStyle = S.secondary; mctx.fillRect(0, 0, S.w, S.h);
}

/* =====================================================================
 * Files
 * ===================================================================== */
const fileInput = $('#fileInput');
let fileMode = 'open';
fileInput.addEventListener('change', () => {
  const f = fileInput.files && fileInput.files[0];
  fileInput.value = '';
  if (!f) return;
  if (fileMode === 'paste') pasteBlob(f); else openBlob(f, f.name);
});
async function openBlob(blob, name = 'untitled') {
  let img;
  try { img = await loadBlobImage(blob); }
  catch (_) { msgBox(`Slop Paint cannot read this file.\nThis is not a valid bitmap file, or its format is not currently supported.\n(Not enough slop.)`, ['OK'], 'warn'); return; }
  if (op) cancelOp();
  finishPending();
  let w = img.naturalWidth, hh = img.naturalHeight;
  const k = Math.min(1, 4096 / Math.max(w, hh));
  w = Math.max(1, Math.round(w * k)); hh = Math.max(1, Math.round(hh * k));
  pushUndo();
  setCanvasSize(w, hh, false, '#ffffff');
  mctx.imageSmoothingEnabled = k < 1;
  mctx.drawImage(img, 0, 0, w, hh);
  mctx.imageSmoothingEnabled = false;
  S.fileName = (name.replace(/\.[^.]+$/, '') || 'untitled').slice(0, 60);
  updateTitle(); S.dirty = false;
  status(`Opened ${name} (${w}x${hh}). Ready to be slopped.`);
}
function savePNG(name = S.fileName) {
  if (op) cancelOp();
  finishPending();
  return new Promise(res => {
    main.toBlob(b => {
      if (!b) { res(false); return; }
      const a = h('a', { href: URL.createObjectURL(b), download: name.replace(/\.png$/i, '') + '.png' });
      document.body.append(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 8000);
      S.dirty = false; S.fileName = name.replace(/\.png$/i, ''); updateTitle();
      status(`Saved ${S.fileName}.png. Your masterpiece is safe.`);
      res(true);
    }, 'image/png');
  });
}
async function confirmSave() {
  if (!S.dirty) return true;
  const r = await msgBox(`Save changes to ${S.fileName}?`, ['Yes', 'No', 'Cancel'], 'warn');
  if (r === 'Yes') { await savePNG(); return true; }
  return r === 'No';
}
// drag & drop an image onto the app
['dragenter', 'dragover'].forEach(t => win.addEventListener(t, e => { if (e.dataTransfer && [...e.dataTransfer.types].includes('Files')) { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; } }));
win.addEventListener('drop', e => {
  const f = e.dataTransfer && [...e.dataTransfer.files].find(x => x.type.startsWith('image/'));
  if (!f) return;
  e.preventDefault();
  openBlob(f, f.name);
});
document.addEventListener('paste', e => {
  if (document.querySelector('.modal-back') || isTyping(e.target)) return;
  e.preventDefault();
  if (clipInternalNewer && clip) { pasteCanvas(clip); return; }
  const cd = e.clipboardData;
  const f = cd && ([...cd.files].find(x => x.type.startsWith('image/')) || [...cd.items].filter(i => i.kind === 'file' && i.type.startsWith('image/')).map(i => i.getAsFile()).find(Boolean));
  if (f) { pasteBlob(f); return; }
  if (clip) pasteCanvas(clip);
  else status('The clipboard has no picture in it.');
});
window.addEventListener('blur', () => { clipInternalNewer = false; });

/* =====================================================================
 * Dialogs
 * ===================================================================== */
const xSvg = '<svg viewBox="0 0 8 7" width="8" height="7"><path d="M0 0h2l2 2 2-2h2v1L5 3.5 8 6v1H6L4 5 2 7H0V6l3-2.5L0 1z"/></svg>';
function openDialog({ title, content, buttons, width = 320, init }) {
  return new Promise(resolve => {
    closeMenus(); closeStart();
    const prevFocus = document.activeElement;
    const back = h('div', { class: 'modal-back' });
    const close = h('button', { class: 'tbtn close', type: 'button', 'aria-label': 'Close', html: xSvg });
    const tb = h('div', { class: 'titlebar' }, h('span', { class: 'ttl', text: title }), close);
    const body = h('div', { class: 'dlg-body' }, content);
    const row = h('div', { class: 'btnrow' });
    const dlg = h('div', { class: 'win dialog', role: 'dialog', 'aria-modal': 'true', 'aria-label': title, tabindex: '-1', style: { '--w': width + 'px' } }, tb, body, row);
    let defBtn = null;
    const done = v => {
      back.remove();
      document.removeEventListener('keydown', onKey, true);
      win.classList.remove('inactive');
      if (prevFocus && prevFocus.focus && document.contains(prevFocus)) prevFocus.focus({ preventScroll: true });
      resolve(v);
    };
    for (const b of buttons) {
      const btn = h('button', { class: 'btn' + (b.default ? ' default' : ''), type: 'button', text: b.label });
      btn.addEventListener('click', () => { if (b.validate && !b.validate()) return; done(b.value); });
      if (b.default) defBtn = btn;
      row.append(btn);
    }
    close.addEventListener('click', () => done(null));
    function onKey(e) {
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); done(null); return; }
      if (e.key === 'Enter' && defBtn && !(e.target instanceof HTMLButtonElement) && e.target.tagName !== 'TEXTAREA' && e.target.tagName !== 'SELECT') { e.preventDefault(); defBtn.click(); return; }
      if (e.key === 'Tab') {
        const f = $$('button, input:not([disabled]), select, a[href], [tabindex="0"]', dlg).filter(x => x.offsetParent !== null);
        if (!f.length) return;
        const i = f.indexOf(document.activeElement);
        if (e.shiftKey && i <= 0) { e.preventDefault(); f[f.length - 1].focus(); }
        else if (!e.shiftKey && i === f.length - 1) { e.preventDefault(); f[0].focus(); }
      }
      e.stopPropagation();
    }
    document.addEventListener('keydown', onKey, true);
    back.append(dlg);
    document.body.append(back);
    win.classList.add('inactive');
    // center, then make draggable by the title bar
    const place = () => {
      const r = dlg.getBoundingClientRect();
      dlg.style.left = Math.max(6, (innerWidth - r.width) / 2) + 'px';
      dlg.style.top = Math.max(6, (innerHeight - r.height) / 2.4) + 'px';
    };
    place();
    tb.addEventListener('pointerdown', e => {
      if (e.target.closest('button')) return;
      const r = dlg.getBoundingClientRect(), ox = e.clientX - r.left, oy = e.clientY - r.top;
      tb.setPointerCapture(e.pointerId);
      const mv = ev => { dlg.style.left = clamp(ev.clientX - ox, -r.width + 60, innerWidth - 60) + 'px'; dlg.style.top = clamp(ev.clientY - oy, 0, innerHeight - 30) + 'px'; };
      const up = () => { tb.removeEventListener('pointermove', mv); tb.removeEventListener('pointerup', up); };
      tb.addEventListener('pointermove', mv); tb.addEventListener('pointerup', up);
    });
    if (init) init(dlg);
    const first = $('input:not([disabled]):not([type=radio]), input[type=radio]:checked, select', body);
    (first || defBtn || dlg).focus({ preventScroll: true });
    if (first && first.select) first.select();
  });
}
const ICON_SVG = {
  warn: '<svg width="32" height="32" viewBox="0 0 32 32" aria-hidden="true"><path d="M16 2L31 29H1z" fill="#ffd400" stroke="#000" stroke-width="1.5"/><rect x="14.5" y="10" width="3" height="11" fill="#000"/><rect x="14.5" y="23" width="3" height="3" fill="#000"/></svg>',
  question: '<svg width="32" height="32" viewBox="0 0 32 32" aria-hidden="true"><path d="M4 3h24v18H13l-7 7v-7H4z" fill="#fff" stroke="#000" stroke-width="1.5"/><text x="16" y="18" text-anchor="middle" font-family="Times New Roman, serif" font-weight="bold" font-size="15" fill="#0000c0">?</text></svg>',
  info: '<svg width="32" height="32" viewBox="0 0 32 32" aria-hidden="true"><circle cx="16" cy="16" r="14" fill="#fff" stroke="#000" stroke-width="1.5"/><rect x="14" y="13" width="4" height="11" fill="#0000c0"/><rect x="14" y="7" width="4" height="4" fill="#0000c0"/></svg>',
  slop: '<svg width="32" height="32" viewBox="0 0 32 32" aria-hidden="true"><path d="M16 2S5 14 5 21a11 11 0 0 0 22 0C27 14 16 2 16 2z" fill="#d4ff3a" stroke="#000" stroke-width="1.5"/><path d="M10.5 21.5a5.5 5.5 0 0 0 4.5 5" fill="none" stroke="#fff" stroke-width="2"/></svg>',
};
function msgBox(message, buttons = ['OK'], icon = 'info', title = 'Slop Paint') {
  const content = h('div', { class: 'msg-wrap', html: ICON_SVG[icon] || '' }, h('p', { text: message }));
  return openDialog({ title, content, width: 360, buttons: buttons.map((b, i) => ({ label: b, value: b, default: i === 0 })) });
}
async function attributesDialog() {
  const content = h('div', { html: `
    <div class="row"><span>File last saved:</span><span>Not Available (it's slop)</span></div>
    <div class="row" style="margin-bottom:12px"><span>Size on disk:</span><span>Not Available</span></div>
    <div class="field-row" style="margin-bottom:12px">
      <label for="atW"><u>W</u>idth:</label><input id="atW" type="number" min="1" max="6000" value="${S.w}">
      <label for="atH"><u>H</u>eight:</label><input id="atH" type="number" min="1" max="6000" value="${S.h}">
    </div>
    <fieldset><legend>Units</legend><div class="row">
      <label class="disabled"><input type="radio" name="atU" disabled>Inches</label>
      <label class="disabled"><input type="radio" name="atU" disabled>Cm</label>
      <label><input type="radio" name="atU" checked>Pels</label></div></fieldset>
    <fieldset><legend>Colors</legend><div class="row">
      <label><input type="radio" name="atC" id="atBW">Black and white</label>
      <label><input type="radio" name="atC" checked>Colors</label></div></fieldset>` });
  const r = await openDialog({ title: 'Attributes', content, width: 300, buttons: [
    { label: 'OK', value: 'ok', default: true }, { label: 'Cancel', value: null },
    { label: 'Default', value: 'default' },
  ] });
  if (!r) return;
  if (op) cancelOp();
  finishPending();
  let w = +$('#atW', content).value, hh = +$('#atH', content).value;
  if (r === 'default') { w = 800; hh = 500; }
  if (!(w >= 1 && hh >= 1)) { msgBox('Please enter a whole number between 1 and 6000.\nEven slop has limits.', ['OK'], 'warn'); return; }
  w = clamp(Math.round(w), 1, 6000); hh = clamp(Math.round(hh), 1, 6000);
  const bw = $('#atBW', content).checked;
  if (w !== S.w || hh !== S.h || bw) {
    pushUndo();
    if (w !== S.w || hh !== S.h) setCanvasSize(w, hh);
    if (bw) { const o = blackAndWhite(main); mctx.drawImage(o, 0, 0); }
  }
}
async function flipRotateDialog() {
  const content = h('div', { html: `
    <fieldset><legend>Flip or rotate</legend>
      <div class="row"><label><input type="radio" name="fr" value="h" checked>Flip <u>h</u>orizontal</label></div>
      <div class="row"><label><input type="radio" name="fr" value="v">Flip <u>v</u>ertical</label></div>
      <div class="row"><label><input type="radio" name="fr" value="r">Rotate by angle</label></div>
      <div class="indent">
        <div class="row"><label><input type="radio" name="deg" value="90" checked>90°</label></div>
        <div class="row"><label><input type="radio" name="deg" value="180">180°</label></div>
        <div class="row"><label><input type="radio" name="deg" value="270">270°</label></div>
      </div>
    </fieldset>` });
  $$('input[name=deg]', content).forEach(i => i.addEventListener('change', () => { $('input[value=r]', content).checked = true; }));
  const r = await openDialog({ title: 'Flip and Rotate', content, width: 260, buttons: [{ label: 'OK', value: 'ok', default: true }, { label: 'Cancel', value: null }] });
  if (!r) return;
  const m = $('input[name=fr]:checked', content).value, deg = +$('input[name=deg]:checked', content).value;
  applyImage(c => m === 'h' ? flipH(c) : m === 'v' ? flipV(c) : rotate(c, deg));
}
async function stretchSkewDialog() {
  const content = h('div', { html: `
    <fieldset><legend>Stretch</legend><div class="field-row">
      <label for="ssH">Horizontal:</label><span><input id="ssH" type="number" value="100" min="1" max="500"> %</span>
      <label for="ssV">Vertical:</label><span><input id="ssV" type="number" value="100" min="1" max="500"> %</span></div></fieldset>
    <fieldset><legend>Skew</legend><div class="field-row">
      <label for="skH">Horizontal:</label><span><input id="skH" type="number" value="0" min="-89" max="89"> Degrees</span>
      <label for="skV">Vertical:</label><span><input id="skV" type="number" value="0" min="-89" max="89"> Degrees</span></div></fieldset>` });
  const r = await openDialog({ title: 'Stretch and Skew', content, width: 290, buttons: [{ label: 'OK', value: 'ok', default: true }, { label: 'Cancel', value: null }] });
  if (!r) return;
  const v = id => +$(id, content).value || 0;
  const sx = clamp(v('#ssH') || 100, 1, 500), sy = clamp(v('#ssV') || 100, 1, 500), kx = clamp(v('#skH'), -89, 89), ky = clamp(v('#skV'), -89, 89);
  const big = (S.w * sx / 100) * (S.h * sy / 100);
  if (big > 36e6) { msgBox('That is too much slop, even for us.', ['OK'], 'warn'); return; }
  applyImage(c => stretchSkew(c, sx, sy, kx, ky));
}
async function customZoomDialog() {
  const content = h('div', { html: `<div class="row" style="margin-bottom:10px">Current zoom: ${S.zoom * 100}%</div>
    <fieldset><legend>Zoom to</legend><div class="field-row" style="grid-template-columns:auto auto">
      ${[1, 2, 4, 6, 8].map(z => `<label><input type="radio" name="cz" value="${z}" ${z === S.zoom ? 'checked' : ''}>${z * 100}%</label>`).join('')}
    </div></fieldset>` });
  const r = await openDialog({ title: 'Custom Zoom', content, width: 240, buttons: [{ label: 'OK', value: 'ok', default: true }, { label: 'Cancel', value: null }] });
  if (r) setZoom(+$('input[name=cz]:checked', content).value);
}
async function saveAsDialog() {
  const content = h('div', { html: `<div class="field-row" style="grid-template-columns:auto 1fr">
      <label for="saN">File <u>n</u>ame:</label><input id="saN" type="text" value="${S.fileName.replace(/"/g, '')}" maxlength="80" style="width:100%">
      <label for="saT">Save as <u>t</u>ype:</label><select id="saT"><option>PNG (*.png) — premium slop</option></select></div>` });
  const r = await openDialog({ title: 'Save As', content, width: 360, buttons: [{ label: 'Save', value: 'ok', default: true }, { label: 'Cancel', value: null }] });
  if (!r) return;
  const n = ($('#saN', content).value || 'untitled').replace(/[\\/:*?"<>|]+/g, '').trim() || 'untitled';
  savePNG(n);
}
function aboutDialog() {
  const content = h('div', { class: 'about', html: `
    <div class="logo">${ICON_SVG.slop.replace(/width="32" height="32"/, 'width="56" height="56"')}</div>
    <div>
      <p class="big">Slop Paint</p>
      <p>Version 98.0.5L0P (Build 1998)<br>Copyright © 1998–2026 slopographic.com</p>
      <hr>
      <p>This product is licensed to:<br>&nbsp;&nbsp;Whoever is holding the mouse<br>&nbsp;&nbsp;Department of Pixels</p>
      <hr>
      <p>Hand-made pixels. Machine-made drips.<br>No AI was harmed in the making of this program.</p>
      <p>Physical memory available to Slop Paint: 640 KB (plenty)<br>System resources: 98% Free</p>
      <p><a href="../">slopographic.com</a> · more slop where this came from</p>
    </div>` });
  return openDialog({ title: 'About Slop Paint', content, width: 400, buttons: [{ label: 'OK', value: 'ok', default: true }] });
}
function helpDialog() {
  const content = h('div', { html: `
    <ul class="helplist">
      <li><b>Left button</b> draws with the primary color, <b>right button</b> with the secondary color. On touch, long-press a palette color to set the secondary.</li>
      <li><b>Shift</b> makes perfect squares and circles, and snaps lines to 45°.</li>
      <li><b>Curve:</b> drag a straight line, then click (or drag) twice to bend it.</li>
      <li><b>Polygon:</b> drag the first side, click to add corners, double-click (or click the start) to finish.</li>
      <li><b>Select:</b> drag to select, drag inside to move, Ctrl+drag to leave a copy, drag the blue handles to stretch. Delete clears it.</li>
      <li><b>Ctrl+C / Ctrl+X / Ctrl+V</b> copy, cut and paste. You can also paste images from other apps.</li>
      <li><b>Text:</b> click or drag a box, type, pick the font in the Fonts toolbar, click outside to stamp it down.</li>
      <li>Drag the little blue handles at the canvas edges to resize it.</li>
      <li>Drop an image file onto the window to open it.</li>
      <li><b>Ctrl+Z / Ctrl+Y</b> undo and redo. <b>Ctrl+mouse wheel</b> zooms. Two fingers scroll on touch screens.</li>
      <li>Double-click a palette color to edit it. Click the color well to swap colors.</li>
      <li><b>Slop Brush</b> drips, <b>Slop Stamp</b> stamps emoji, <b>Image → SLOPIFY</b> deep-fries the picture (Ctrl+Z undoes it).</li>
    </ul>` });
  return openDialog({ title: 'Slop Paint Help Topics', content, width: 440, buttons: [{ label: 'OK', value: 'ok', default: true }] });
}
const BASIC_COLORS = [
  '#ff8080', '#ffff80', '#80ff80', '#00ff80', '#80ffff', '#0080ff', '#ff80c0', '#ff80ff',
  '#ff0000', '#ffff00', '#80ff00', '#00ff40', '#00ffff', '#0080c0', '#8080c0', '#ff00ff',
  '#804040', '#ff8040', '#00ff00', '#008080', '#004080', '#8080ff', '#800040', '#ff0080',
  '#800000', '#ff8000', '#008000', '#008040', '#0000ff', '#0000a0', '#800080', '#8000ff',
  '#400000', '#804000', '#004000', '#004040', '#000080', '#000040', '#400040', '#400080',
  '#000000', '#808000', '#808040', '#808080', '#408080', '#c0c0c0', '#d4ff3a', '#ffffff',
];
const customColors = Array(16).fill('#ffffff');
let customSlot = 0;
function editColorsDialog(initial) {
  let [r, g, b] = hexToRgb(initial);
  let [hu, sa, lu] = rgbToHsl(r, g, b);
  const SW = 176, SH = 150;
  const content = h('div', { class: 'ec', html: `
    <div class="ec-left">
      <div>Basic colors:</div><div class="ec-grid" id="ecBasic"></div>
      <div>Custom colors:</div><div class="ec-grid" id="ecCustom"></div>
      <button class="btn" type="button" disabled style="width:100%">Define Custom Colors &gt;&gt;</button>
    </div>
    <div class="ec-right">
      <div class="ec-spec-row">
        <div class="ec-spec" id="ecSpec"><canvas width="${SW}" height="${SH}" aria-label="Hue and saturation"></canvas><div class="ec-cross" id="ecCross"></div></div>
        <div class="ec-lumwrap"><div class="ec-lum" id="ecLum"><canvas width="12" height="${SH}" aria-label="Luminosity"></canvas></div><div class="ec-arrow" id="ecArrow"></div></div>
      </div>
      <div class="ec-bottom">
        <div><div class="ec-prev"><span id="ecPrev"></span></div><div style="text-align:center;margin-top:2px">Color|Solid</div></div>
        <div class="ec-fields">
          <label for="ecH">Hue:</label><input id="ecH" type="number" min="0" max="239">
          <label for="ecR">Red:</label><input id="ecR" type="number" min="0" max="255">
          <label for="ecS">Sat:</label><input id="ecS" type="number" min="0" max="240">
          <label for="ecG">Green:</label><input id="ecG" type="number" min="0" max="255">
          <label for="ecL">Lum:</label><input id="ecL" type="number" min="0" max="240">
          <label for="ecB">Blue:</label><input id="ecB" type="number" min="0" max="255">
        </div>
      </div>
      <div class="ec-hex"><label for="ecHex">Hex:</label><input id="ecHex" type="text" maxlength="7"><button class="btn" type="button" id="ecAdd">Add to Custom Colors</button></div>
    </div>` });
  const q = s => $(s, content);
  const specC = q('#ecSpec canvas'), lumC = q('#ecLum canvas');
  // spectrum: hue across, saturation down, at mid luminosity
  {
    const x = specC.getContext('2d'), img = x.createImageData(SW, SH), d = img.data;
    for (let j = 0; j < SH; j++) for (let i = 0; i < SW; i++) {
      const [rr, gg, bb] = hslToRgb(i / (SW - 1) * 0.999, 1 - j / (SH - 1), 0.5), k = (j * SW + i) * 4;
      d[k] = rr; d[k + 1] = gg; d[k + 2] = bb; d[k + 3] = 255;
    }
    x.putImageData(img, 0, 0);
  }
  const lx = lumC.getContext('2d');
  const fillGrid = (el, colors, onpick, cls) => {
    el.textContent = '';
    colors.forEach((c, i) => {
      const bt = h('button', { type: 'button', style: { background: c }, 'aria-label': c, title: c, class: cls && cls(i) ? 'cur' : null });
      bt.addEventListener('click', () => onpick(c, i));
      el.append(bt);
    });
  };
  const sync = (from) => {
    if (from !== 'rgb') [r, g, b] = hslToRgb(hu, sa, lu);
    if (from !== 'hsl') [hu, sa, lu] = rgbToHsl(r, g, b);
    const set = (id, v) => { const el = q(id); if (document.activeElement !== el) el.value = v; };
    set('#ecR', r); set('#ecG', g); set('#ecB', b);
    set('#ecH', Math.round(hu * 239)); set('#ecS', Math.round(sa * 240)); set('#ecL', Math.round(lu * 240));
    set('#ecHex', rgbHex(r, g, b));
    q('#ecPrev').style.background = rgbHex(r, g, b);
    q('#ecCross').style.left = (2 + hu * (SW - 1)) + 'px';
    q('#ecCross').style.top = (2 + (1 - sa) * (SH - 1)) + 'px';
    q('#ecArrow').style.top = (2 + (1 - lu) * (SH - 1)) + 'px';
    for (let j = 0; j < SH; j++) { const [rr, gg, bb] = hslToRgb(hu, sa, 1 - j / (SH - 1)); lx.fillStyle = rgbHex(rr, gg, bb); lx.fillRect(0, j, 12, 1); }
  };
  const pickHex = c => { [r, g, b] = hexToRgb(c); sync('rgb'); };
  fillGrid(q('#ecBasic'), BASIC_COLORS, pickHex);
  const drawCustom = () => fillGrid(q('#ecCustom'), customColors, (c, i) => { customSlot = i; pickHex(c); drawCustom(); }, i => i === customSlot);
  drawCustom();
  const drag = (el, fn) => {
    el.addEventListener('pointerdown', e => {
      el.setPointerCapture(e.pointerId); fn(e);
      const mv = ev => fn(ev);
      const up = () => { el.removeEventListener('pointermove', mv); el.removeEventListener('pointerup', up); };
      el.addEventListener('pointermove', mv); el.addEventListener('pointerup', up);
    });
  };
  drag(q('#ecSpec'), e => {
    const rc = specC.getBoundingClientRect();
    hu = clamp((e.clientX - rc.left) / (SW - 1), 0, 0.999); sa = clamp(1 - (e.clientY - rc.top) / (SH - 1), 0, 1);
    if (lu <= 0.02 || lu >= 0.98) lu = 0.5;
    sync('hsl');
  });
  drag(q('.ec-lumwrap'), e => { const rc = lumC.getBoundingClientRect(); lu = clamp(1 - (e.clientY - rc.top) / (SH - 1), 0, 1); sync('hsl'); });
  const num = (id, mx) => clamp(Math.round(+q(id).value || 0), 0, mx);
  ['#ecR', '#ecG', '#ecB'].forEach(id => q(id).addEventListener('input', () => { r = num('#ecR', 255); g = num('#ecG', 255); b = num('#ecB', 255); sync('rgb'); }));
  ['#ecH', '#ecS', '#ecL'].forEach(id => q(id).addEventListener('input', () => { hu = num('#ecH', 239) / 239 * 0.999; sa = num('#ecS', 240) / 240; lu = num('#ecL', 240) / 240; sync('hsl'); }));
  q('#ecHex').addEventListener('input', e => { const v = e.target.value.trim(); if (/^#?[0-9a-f]{6}$/i.test(v)) { pickHex(v[0] === '#' ? v : '#' + v); } });
  q('#ecAdd').addEventListener('click', () => { customColors[customSlot] = rgbHex(r, g, b); customSlot = (customSlot + 1) % 16; drawCustom(); });
  sync('rgb');
  return openDialog({ title: 'Edit Colors', content, width: 470, buttons: [{ label: 'OK', value: 'ok', default: true }, { label: 'Cancel', value: null }] })
    .then(v => v ? rgbHex(r, g, b) : null);
}
function viewBitmap() {
  finishPending();
  const img = h('img', { src: main.toDataURL(), alt: 'Your picture, at full size' });
  const v = h('div', { class: 'viewbmp', tabindex: '-1', role: 'dialog', 'aria-label': 'View bitmap. Click or press any key to return.' }, img);
  const close = () => { v.remove(); document.removeEventListener('keydown', key, true); };
  const key = e => { e.preventDefault(); e.stopPropagation(); close(); };
  v.addEventListener('pointerdown', close);
  document.addEventListener('keydown', key, true);
  document.body.append(v); v.focus();
}

/* =====================================================================
 * Menus
 * ===================================================================== */
const ui = { toolbox: true, colorbox: true, statusbar: true };
const ACTIONS = {
  new: async () => { if (op) cancelOp(); finishPending(); if (!await confirmSave()) return; mctx.fillStyle = '#ffffff'; mctx.fillRect(0, 0, S.w, S.h); undoStack.length = 0; redoStack.length = 0; S.fileName = 'untitled'; S.dirty = false; updateTitle(); status(); },
  open: async () => { if (op) cancelOp(); finishPending(); if (!await confirmSave()) return; fileMode = 'open'; fileInput.click(); },
  save: () => savePNG(),
  saveAs: saveAsDialog,
  home: () => { location.href = '../'; },
  exit: async () => { if (op) cancelOp(); finishPending(); if (await confirmSave()) location.href = '../'; },
  undo, redo,
  cut: cutSel, copy: copySel, paste: pasteMenu,
  clearSel: () => { if (text) return; clearSelection(); },
  selectAll,
  copyTo: async () => { const c = selCanvas(); if (!c) return; c.toBlob(b => { const a = h('a', { href: URL.createObjectURL(b), download: 'selection.png' }); document.body.append(a); a.click(); a.remove(); }); },
  pasteFrom: () => { fileMode = 'paste'; fileInput.click(); },
  toolbox: () => { ui.toolbox = !ui.toolbox; $('#toolbox').hidden = !ui.toolbox; },
  colorbox: () => { ui.colorbox = !ui.colorbox; $('#colorbox').hidden = !ui.colorbox; },
  statusbar: () => { ui.statusbar = !ui.statusbar; $('#statusbar').hidden = !ui.statusbar; },
  textbar: () => { S.fontbarClosed = !S.fontbarClosed; fontbar.hidden = S.fontbarClosed || S.tool !== 'text'; if (!S.fontbarClosed && S.tool !== 'text') setTool('text'); },
  zoomNormal: () => setZoom(1), zoomLarge: () => setZoom(4), zoomCustom: customZoomDialog,
  zoomIn: () => setZoom([1, 2, 4, 6, 8].find(z => z > S.zoom) || 8),
  zoomOut: () => setZoom([8, 6, 4, 2, 1].find(z => z < S.zoom) || 1),
  grid: () => { S.grid = !S.grid; layout(); if (S.grid && S.zoom < 4) status('The grid appears at 400% zoom and up.'); },
  viewBitmap,
  flipRotate: flipRotateDialog, stretchSkew: stretchSkewDialog,
  invert: () => applyImage(invert),
  attributes: attributesDialog,
  clearImage,
  opaque: () => { S.transparent = !S.transparent; renderFloating(); renderOptions(); },
  slopify: async () => { await applyImage(slopify); toast('SLOPIFIED'); status('Slopified. Ctrl+Z if you regret it.'); },
  editColors: async () => { const res = await editColorsDialog(S.primary); if (res) setColor(0, res); },
  help: helpDialog, about: aboutDialog,
};
const hasSel = () => !!sel;
const MENUS = [
  { label: '&File', items: [
    { label: '&New', act: 'new' },
    { label: '&Open...', key: 'Ctrl+O', act: 'open' },
    { label: '&Save', key: 'Ctrl+S', act: 'save' },
    { label: 'Save &As...', act: 'saveAs' },
    '-',
    { label: 'Back to &slopographic.com', act: 'home' },
    '-',
    { label: 'E&xit', act: 'exit' },
  ] },
  { label: '&Edit', items: [
    { label: '&Undo', key: 'Ctrl+Z', act: 'undo', enabled: () => undoStack.length > 0 || !!text || !!sel || !!curve || !!poly },
    { label: '&Repeat', key: 'Ctrl+Y', act: 'redo', enabled: () => redoStack.length > 0 },
    '-',
    { label: 'Cu&t', key: 'Ctrl+X', act: 'cut', enabled: hasSel },
    { label: '&Copy', key: 'Ctrl+C', act: 'copy', enabled: hasSel },
    { label: '&Paste', key: 'Ctrl+V', act: 'paste' },
    { label: 'C&lear Selection', key: 'Del', act: 'clearSel', enabled: hasSel },
    { label: 'Select &All', key: 'Ctrl+A', act: 'selectAll' },
    '-',
    { label: 'C&opy To...', act: 'copyTo', enabled: hasSel },
    { label: 'Paste &From...', act: 'pasteFrom' },
  ] },
  { label: '&View', items: [
    { label: '&Tool Box', act: 'toolbox', checked: () => ui.toolbox },
    { label: '&Color Box', act: 'colorbox', checked: () => ui.colorbox },
    { label: '&Status Bar', act: 'statusbar', checked: () => ui.statusbar },
    { label: 'T&ext Toolbar', act: 'textbar', checked: () => !S.fontbarClosed && S.tool === 'text' },
    '-',
    { label: '&Normal Size', key: 'Ctrl+PgUp', act: 'zoomNormal', checked: () => S.zoom === 1 },
    { label: '&Large Size', key: 'Ctrl+PgDn', act: 'zoomLarge', checked: () => S.zoom === 4 },
    { label: 'C&ustom...', act: 'zoomCustom' },
    { label: 'Show &Grid', key: 'Ctrl+G', act: 'grid', checked: () => S.grid },
    '-',
    { label: '&View Bitmap', key: 'Ctrl+F', act: 'viewBitmap' },
  ] },
  { label: '&Image', items: [
    { label: '&Flip/Rotate...', key: 'Ctrl+R', act: 'flipRotate' },
    { label: '&Stretch/Skew...', key: 'Ctrl+Shift+W', act: 'stretchSkew' },
    { label: '&Invert Colors', key: 'Ctrl+I', act: 'invert' },
    { label: '&Attributes...', key: 'Ctrl+E', act: 'attributes' },
    { label: '&Clear Image', key: 'Ctrl+Shift+X', act: 'clearImage' },
    { label: '&Draw Opaque', act: 'opaque', checked: () => !S.transparent },
    '-',
    { label: 'S&LOPIFY', act: 'slopify', cls: 'slopify' },
  ] },
  { label: '&Colors', items: [
    { label: '&Edit Colors...', act: 'editColors' },
  ] },
  { label: '&Help', items: [
    { label: '&Help Topics', key: 'F1', act: 'help' },
    '-',
    { label: '&About Slop Paint', act: 'about' },
    { label: 'Back to &slopographic.com', act: 'home' },
  ] },
];
const accel = label => { const i = label.indexOf('&'); if (i < 0) return document.createTextNode(label); const s = h('span'); s.append(label.slice(0, i), h('u', { text: label[i + 1] }), label.slice(i + 2)); return s; };
const accKey = label => { const i = label.indexOf('&'); return i < 0 ? '' : label[i + 1].toLowerCase(); };
const menubar = $('#menubar');
let openMenu = -1, menuEl = null;
function run(act) { const f = ACTIONS[act]; if (f) f(); }
function closeMenus() {
  if (menuEl) { menuEl.remove(); menuEl = null; }
  $$('.mb-item', menubar).forEach(b => { b.classList.remove('open'); b.setAttribute('aria-expanded', 'false'); });
  openMenu = -1;
}
function showMenu(i, focusFirst) {
  closeMenus();
  closeStart();
  openMenu = i;
  const btn = menubar.children[i];
  btn.classList.add('open'); btn.setAttribute('aria-expanded', 'true');
  const m = h('div', { class: 'menu', role: 'menu', tabindex: '-1', 'aria-label': MENUS[i].label.replace('&', '') });
  for (const it of MENUS[i].items) {
    if (it === '-') { m.append(h('div', { class: 'sep', role: 'separator' })); continue; }
    const dis = it.enabled ? !it.enabled() : false;
    const chk = it.checked ? it.checked() : null;
    const b = h('button', { class: 'mi' + (it.cls ? ' ' + it.cls : ''), type: 'button', role: chk == null ? 'menuitem' : 'menuitemcheckbox', 'aria-checked': chk == null ? null : String(chk), 'aria-disabled': dis ? 'true' : null, 'data-acc': accKey(it.label) },
      h('span', { class: 'chk', text: chk ? '✓' : '' }), h('span', { class: 'lbl' }, accel(it.label)), h('span', { class: 'k', text: it.key || '' }));
    b.addEventListener('pointerenter', () => b.focus({ preventScroll: true }));
    b.addEventListener('click', () => { if (dis) return; closeMenus(); run(it.act); });
    m.append(b);
  }
  m.addEventListener('keydown', menuKey);
  document.body.append(m);
  menuEl = m;
  const r = btn.getBoundingClientRect();
  const mw = m.offsetWidth;
  m.style.left = clamp(r.left, 0, innerWidth - mw) + 'px';
  m.style.top = r.bottom + 'px';
  if (focusFirst) { const f = $('.mi:not([aria-disabled])', m); if (f) f.focus(); } else m.focus({ preventScroll: true });
}
function menuKey(e) {
  const items = $$('.mi', menuEl);
  const i = items.indexOf(document.activeElement);
  const enabled = items.filter(x => !x.hasAttribute('aria-disabled'));
  if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
    e.preventDefault();
    const dir = e.key === 'ArrowDown' ? 1 : -1;
    let j = i;
    for (let k = 0; k < items.length; k++) { j = (j + dir + items.length) % items.length; if (!items[j].hasAttribute('aria-disabled')) break; }
    if (i < 0) j = dir > 0 ? items.indexOf(enabled[0]) : items.indexOf(enabled[enabled.length - 1]);
    if (items[j]) items[j].focus();
  } else if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
    e.preventDefault();
    showMenu((openMenu + (e.key === 'ArrowRight' ? 1 : -1) + MENUS.length) % MENUS.length, true);
  } else if (e.key === 'Escape') {
    e.preventDefault(); e.stopPropagation();
    const k = openMenu; closeMenus(); menubar.children[k].focus();
  } else if (e.key === 'Tab') {
    e.preventDefault();
  } else if (e.key.length === 1 && !e.ctrlKey && !e.metaKey) {
    const hit = items.find(x => x.dataset.acc === e.key.toLowerCase() && !x.hasAttribute('aria-disabled'));
    if (hit) { e.preventDefault(); hit.click(); }
  }
}
MENUS.forEach((m, i) => {
  const b = h('button', { class: 'mb-item', type: 'button', role: 'menuitem', 'aria-haspopup': 'true', 'aria-expanded': 'false' }, accel(m.label));
  b.addEventListener('pointerdown', e => { if (e.button !== 0) return; e.preventDefault(); if (openMenu === i) closeMenus(); else showMenu(i); });
  b.addEventListener('pointerenter', () => { if (openMenu >= 0 && openMenu !== i) showMenu(i); });
  b.addEventListener('keydown', e => {
    if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown') { e.preventDefault(); showMenu(i, true); }
    else if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') { e.preventDefault(); menubar.children[(i + (e.key === 'ArrowRight' ? 1 : -1) + MENUS.length) % MENUS.length].focus(); }
  });
  menubar.append(b);
});
document.addEventListener('pointerdown', e => {
  if (openMenu >= 0 && !(menuEl && menuEl.contains(e.target)) && !menubar.contains(e.target)) closeMenus();
  if (!$('#startmenu').hidden && !e.target.closest('#startmenu, #startBtn')) closeStart();
}, true);

/* =====================================================================
 * Keyboard
 * ===================================================================== */
document.addEventListener('keydown', e => {
  if (document.querySelector('.modal-back, .viewbmp')) return;
  const ctrl = e.ctrlKey || e.metaKey, k = e.key.toLowerCase();
  if (e.key === 'Escape') {
    if (openMenu >= 0) { closeMenus(); return; }
    if (!$('#startmenu').hidden) { closeStart(); return; }
    if (op) { cancelOp(); return; }
    if (curve) { cancelCurve(); return; }
    if (poly) { cancelPoly(); return; }
    if (text) { commitText(); return; }
    if (sel) { commitSel(); return; }
    return;
  }
  if (e.altKey && !ctrl && k.length === 1) {
    const i = MENUS.findIndex(m => accKey(m.label) === k);
    if (i >= 0) { e.preventDefault(); showMenu(i, true); return; }
  }
  if (e.key === 'F10' && !e.shiftKey) { e.preventDefault(); menubar.children[0].focus(); return; }
  if (isTyping(e.target)) return;
  if (openMenu >= 0) return;
  const go = act => { e.preventDefault(); run(act); };
  if (e.key === 'F1') return go('help');
  if (e.key === 'F4') return go('redo');
  if (e.key === 'Enter' && poly) { e.preventDefault(); commitPoly(); return; }
  if (e.key === 'Enter' && curve) { e.preventDefault(); commitCurve(); return; }
  if ((e.key === 'Delete' || e.key === 'Backspace') && !ctrl) { if (sel) go('clearSel'); return; }
  if (sel && sel.canvas !== undefined && e.key.startsWith('Arrow') && !ctrl) {
    e.preventDefault();
    lift();
    const d = e.shiftKey ? 10 : 1;
    if (e.key === 'ArrowLeft') sel.x -= d; if (e.key === 'ArrowRight') sel.x += d;
    if (e.key === 'ArrowUp') sel.y -= d; if (e.key === 'ArrowDown') sel.y += d;
    renderFloating(); updateSelBox();
    return;
  }
  if (!ctrl) {
    if (k === 'x' && !e.altKey) { const p = S.primary; setColor(0, S.secondary); setColor(2, p); }
    return;
  }
  if (e.shiftKey && k === 'z') return go('redo');
  if (e.shiftKey && k === 'w') return go('stretchSkew');
  if (e.shiftKey && k === 'x') return go('clearImage');
  if (e.shiftKey) return;
  switch (k) {
    case 'z': return go('undo');
    case 'y': return go('redo');
    case 'x': return go('cut');
    case 'c': if (sel) return go('copy'); return;
    case 'v': return; // handled by the paste event (reads the OS clipboard too)
    case 'a': return go('selectAll');
    case 'o': return go('open');
    case 's': return go('save');
    case 'e': return go('attributes');
    case 'r': return go('flipRotate');
    case 'i': return go('invert');
    case 'g': return go('grid');
    case 'f': return go('viewBitmap');
    case 'pageup': return go('zoomNormal');
    case 'pagedown': return go('zoomLarge');
    case '=': case '+': return go('zoomIn');
    case '-': return go('zoomOut');
  }
});

/* =====================================================================
 * Window chrome, taskbar, start menu
 * ===================================================================== */
const startMenu = $('#startmenu'), startBtn = $('#startBtn');
function closeStart() { startMenu.hidden = true; startBtn.setAttribute('aria-expanded', 'false'); }
startBtn.addEventListener('click', () => {
  const open = startMenu.hidden;
  closeMenus();
  startMenu.hidden = !open; startBtn.setAttribute('aria-expanded', String(open));
  if (open) { const f = $('.sm-item', startMenu); if (f) f.focus(); }
});
startMenu.addEventListener('keydown', e => {
  const items = $$('.sm-item', startMenu), i = items.indexOf(document.activeElement);
  if (e.key === 'ArrowDown') { e.preventDefault(); items[(i + 1) % items.length].focus(); }
  if (e.key === 'ArrowUp') { e.preventDefault(); items[(i - 1 + items.length) % items.length].focus(); }
  if (e.key === 'Escape') { closeStart(); startBtn.focus(); }
});
$$('[data-act]', startMenu).forEach(b => b.addEventListener('click', () => { closeStart(); if (win.hidden) restoreWin(); run(b.dataset.act); }));
function minimizeWin() { finishPending(); win.hidden = true; $('#taskBtn').classList.remove('active'); }
function restoreWin() { win.hidden = false; $('#taskBtn').classList.add('active'); }
$('#btnMin').addEventListener('click', minimizeWin);
$('#btnMax').addEventListener('click', () => win.classList.toggle('max'));
$('#titlebar').addEventListener('dblclick', e => { if (!e.target.closest('button')) win.classList.toggle('max'); });
$('#btnClose').addEventListener('click', () => run('exit'));
$('#taskBtn').addEventListener('click', () => (win.hidden ? restoreWin() : minimizeWin()));
$('#dIconPaint').addEventListener('dblclick', restoreWin);
$('#dIconPaint').addEventListener('click', e => { if (e.detail === 0 || matchMedia('(pointer: coarse)').matches) restoreWin(); });
$('#curcolors').addEventListener('click', () => { const p = S.primary; setColor(0, S.secondary); setColor(2, p); });
function tick() {
  const d = new Date();
  $('#clock').textContent = d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}
tick(); setInterval(tick, 20000);

/* =====================================================================
 * Boot
 * ===================================================================== */
buildTools();
renderPalette();
initFontbar();
setColor(0, S.primary); setColor(2, S.secondary);
{
  // fit the default canvas to small screens (phones), like Paint sizing to the screen
  const fw = ws.clientWidth - 24, fh = ws.clientHeight - 24;
  const w = fw > 60 && fw < 800 ? fw : 800, hh = fh > 60 && fh < 500 ? fh : 500;
  setCanvasSize(w, hh, false, '#ffffff');
}
setTool('pencil');
updateTitle();
status();
// expose a tiny hook for automated tests / curious slop scientists
window.slopPaint = { state: S, get selection() { return sel; }, undoDepth: () => undoStack.length, redoDepth: () => redoStack.length, canvas: main };
})();
