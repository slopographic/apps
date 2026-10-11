/* Slop Shop: tools. Each tool: { id, name, key, icon, down, move, up, hover, overlay, cancel, activate, deactivate, brushCursor }. */
'use strict';

const C = { fg: store.get('fg', '#000000'), bg: store.get('bg', '#ffffff') };
const T = Object.assign({
  brush: { size: 30, hardness: 0.7, opacity: 1, flow: 1, spacing: 0.12, pressure: true, blend: 'normal', tip: 'round' },
  pencil: { size: 2, opacity: 1 },
  eraser: { size: 40, hardness: 0.6, opacity: 1, flow: 1, spacing: 0.12, pressure: true, tip: 'round' },
  blur: { size: 50, hardness: 0.3, strength: 0.5 },
  sharpen: { size: 50, hardness: 0.3, strength: 0.4 },
  sponge: { size: 60, hardness: 0.3, flow: 0.4, mode: 'saturate' },
  clone: { size: 60, hardness: 0.5, opacity: 1, flow: 1, aligned: true, sampleAll: false },
  smudge: { size: 40, hardness: 0.4, strength: 0.6 },
  dodge: { size: 70, hardness: 0.3, exposure: 0.35, mode: 'dodge' },
  select: { mode: 'replace', feather: 0 },
  wand: { tol: 32, contiguous: true, sampleAll: false },
  bucket: { tol: 32, contiguous: true, sampleAll: false, opacity: 1 },
  gradient: { type: 'linear', mode: 'fgbg', reverse: false, opacity: 1 },
  shape: { kind: 'rect', fill: true, stroke: false, strokeW: 6, radius: 32, sides: 5, strokeColor: '#000000' },
  type: { font: 'Archivo', size: 96, bold: true, italic: false, align: 'left' },
  move: { auto: false },
  crop: { del: true },
  eyedrop: { size: 1, all: true },
}, {});
(function loadToolOptions() { const saved = store.get('tools', null); if (saved) for (const k in saved) if (T[k]) Object.assign(T[k], saved[k]); })();
let saveOptsTimer = 0;
function saveToolOptions() { clearTimeout(saveOptsTimer); saveOptsTimer = setTimeout(() => store.set('tools', T), 300); }
const UI = { tool: 'brush', prevTool: null, editMask: false };

function setColor(which, hex) { C[which] = hex; store.set(which, hex); emit('color'); }

/* ---------- helpers ---------- */
function editableLayer(forPixels = true) {
  let L = activeLayer();
  if (!L) return null;
  if (!L.visible) { toast('The target layer is hidden. Show it first.'); return null; }
  if (L.locked) { toast('That layer is locked'); return null; }
  if (forPixels && L.text && !UI.editMask) { L = rasterizeText(L, true); toast('Type layer rasterized'); }
  return L;
}
function maskTarget(L) { return UI.editMask && L.mask; }
function docCanvasOf(L) { const c = mkCanvas(D.w, D.h); cx(c).drawImage(L.canvas, L.x, L.y); return c; }
function sampleSource(all) { return all ? flattenCanvas() : docCanvasOf(activeLayer()); }
function pickColor(p, all, size = 1) {
  const src = sampleSource(all), x = Math.floor(p.x), y = Math.floor(p.y);
  if (x < 0 || y < 0 || x >= D.w || y >= D.h) return null;
  const r = Math.floor(size / 2), x0 = clamp(x - r, 0, D.w - 1), y0 = clamp(y - r, 0, D.h - 1), w = Math.min(size, D.w - x0), hh = Math.min(size, D.h - y0);
  const d = cxr(src).getImageData(x0, y0, w, hh).data;
  let R0 = 0, G = 0, B = 0, A = 0;
  for (let i = 0; i < d.length; i += 4) { R0 += d[i] * d[i + 3]; G += d[i + 1] * d[i + 3]; B += d[i + 2] * d[i + 3]; A += d[i + 3]; }
  if (!A) return null;
  return rgbToHex(R0 / A, G / A, B / A);
}
const dabCache = new Map();
/** Brush tips. 'round' is the classic soft/hard round; the others are shaped tips. */
const TIPS = [['round', 'Round'], ['square', 'Square'], ['flat', 'Flat (calligraphy)'], ['spray', 'Spray'], ['chalk', 'Chalk'], ['slime', 'Slime drip']];
const TIP_VARIANTS = { spray: 6, chalk: 4 };
function tipPath(g, tip, cxp, cyp, r) {
  g.beginPath();
  if (tip === 'square') g.rect(cxp - r * 0.88, cyp - r * 0.88, r * 1.76, r * 1.76);
  else if (tip === 'flat') g.ellipse(cxp, cyp, r, Math.max(0.6, r * 0.26), -Math.PI / 4, 0, Math.PI * 2);
  else if (tip === 'slime') {
    g.arc(cxp, cyp - r * 0.25, r * 0.7, 0, Math.PI * 2);
    for (const [dx, len, w] of [[-0.38, 0.95, 0.16], [0.05, 1.2, 0.2], [0.42, 0.75, 0.14]]) { g.moveTo(cxp + dx * r + w * r, cyp); g.ellipse(cxp + dx * r, cyp + (len - 0.6) * r * 0.5, w * r, len * r * 0.62, 0, 0, Math.PI * 2); }
  } else g.arc(cxp, cyp, Math.max(0.5, r), 0, Math.PI * 2);
}
function dabCanvas(size, hardness, color, tip = 'round', variant = 0) {
  const key = `${Math.ceil(size)}|${hardness.toFixed(2)}|${color}|${tip}|${variant}`;
  if (dabCache.has(key)) return dabCache.get(key);
  if (dabCache.size > 80) dabCache.clear();
  const d = Math.max(2, Math.ceil(size) + 2), c = mkCanvas(d, d), g = cx(c), r = size / 2;
  const [R0, G, B] = hexToRgb(color);
  g.fillStyle = color;
  if (tip === 'round' && (hardness >= 0.99 || size < 3)) { g.beginPath(); g.arc(d / 2, d / 2, Math.max(0.5, r), 0, Math.PI * 2); g.fill(); }
  else if (tip === 'round') {
    const gr = g.createRadialGradient(d / 2, d / 2, 0, d / 2, d / 2, r);
    gr.addColorStop(0, `rgba(${R0},${G},${B},1)`); gr.addColorStop(clamp(hardness, 0, 0.98), `rgba(${R0},${G},${B},1)`);
    for (let i = 1; i <= 6; i++) { const t = i / 6, a = Math.pow(1 - t, 1.6); gr.addColorStop(hardness + (1 - hardness) * t, `rgba(${R0},${G},${B},${a})`); }
    g.fillStyle = gr; g.fillRect(0, 0, d, d);
  } else if (tip === 'spray') {
    const rnd = rng(variant * 977 + 13), n = Math.max(6, Math.round(size * 1.4)), dot = Math.max(0.6, size * 0.025);
    for (let i = 0; i < n; i++) { const a = rnd() * Math.PI * 2, rr = Math.sqrt(rnd()) * (r - dot); g.globalAlpha = 0.5 + rnd() * 0.5; g.beginPath(); g.arc(d / 2 + Math.cos(a) * rr, d / 2 + Math.sin(a) * rr, dot * (0.6 + rnd()), 0, Math.PI * 2); g.fill(); }
    g.globalAlpha = 1;
  } else {
    // Shaped tips: stack shrinking copies for a soft edge.
    const steps = hardness >= 0.99 ? 1 : 8;
    for (let i = 0; i < steps; i++) { const k = steps === 1 ? 1 : 1 - (i / (steps - 1)) * (1 - hardness); g.globalAlpha = steps === 1 ? 1 : 1 / steps + 0.06; tipPath(g, tip, d / 2, d / 2, r * k); g.fill(); }
    g.globalAlpha = 1;
    if (tip === 'chalk') {
      const rnd = rng(variant * 331 + 7), img = g.getImageData(0, 0, d, d), px = img.data;
      for (let i = 3; i < px.length; i += 4) px[i] *= rnd() < 0.42 ? rnd() * 0.3 : 0.75 + rnd() * 0.25;
      g.putImageData(img, 0, 0);
    }
  }
  dabCache.set(key, c);
  return c;
}
/** A hard, aliased pixel disc for the pencil. */
function pixelDisc(size, color) {
  const key = `px|${size}|${color}`;
  if (dabCache.has(key)) return dabCache.get(key);
  const n = Math.max(1, Math.round(size)), c = mkCanvas(n, n), g = cx(c), r = n / 2;
  g.fillStyle = color;
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) if ((x + 0.5 - r) ** 2 + (y + 0.5 - r) ** 2 <= r * r + (n <= 2 ? 1 : 0.25)) g.fillRect(x, y, 1, 1);
  dabCache.set(key, c);
  return c;
}

/** Dab spacing/interpolation. onDab(x, y, pressure) is called along the path. */
class Stroker {
  constructor(spacing, onDab) { this.spacing = spacing; this.onDab = onDab; this.last = null; this.rest = 0; }
  begin(p) { this.last = p; this.rest = 0; this.onDab(p.x, p.y, p.pressure); }
  to(p) {
    const a = this.last; if (!a) return this.begin(p);
    const dx = p.x - a.x, dy = p.y - a.y, dist = Math.hypot(dx, dy);
    const step = Math.max(0.5, this.spacing(p.pressure));
    let t = step - this.rest;
    while (t <= dist) { const k = t / dist; this.onDab(a.x + dx * k, a.y + dy * k, lerp(a.pressure, p.pressure, k)); t += step; }
    this.rest = dist - (t - step);
    this.last = p;
  }
}
function maskedBuffer(buf) {
  if (!D.sel) return buf;
  const t = scratchCanvas('c', D.w, D.h), g = cx(t);
  g.drawImage(buf, 0, 0); g.globalCompositeOperation = 'destination-in'; g.drawImage(D.sel.mask, 0, 0); g.globalCompositeOperation = 'source-over';
  return t;
}
/** Apply a doc-space stroke buffer to a layer (or its mask). Returns a new canvas. */
function bakeStroke(L, buf, opts, into) {
  const target = into || (opts.mask ? L.mask.canvas : L.canvas), ox = opts.mask ? L.mask.x : L.x, oy = opts.mask ? L.mask.y : L.y;
  const c = into ? target : copyCanvas(target), g = cx(c);
  const mb = maskedBuffer(buf);
  if (opts.mask) {
    g.globalAlpha = opts.opacity; g.globalCompositeOperation = 'destination-out'; g.drawImage(mb, -ox, -oy);
    g.globalAlpha = opts.opacity * opts.value; g.globalCompositeOperation = 'lighter'; g.drawImage(mb, -ox, -oy);
  } else {
    g.globalAlpha = opts.opacity; g.globalCompositeOperation = opts.erase ? 'destination-out' : BLEND_OP[opts.blend || 'normal'] || 'source-over';
    if (!opts.erase && opts.blend && opts.blend !== 'normal') {
      // Blend modes only apply where the stroke lands: composite through a clipped copy.
      const t = mkCanvas(c.width, c.height), tg = cx(t); tg.drawImage(c, 0, 0); tg.globalCompositeOperation = BLEND_OP[opts.blend]; tg.drawImage(mb, -ox, -oy);
      tg.globalCompositeOperation = 'destination-in'; tg.drawImage(mb, -ox, -oy);
      g.globalCompositeOperation = 'source-over'; g.drawImage(t, 0, 0);
    } else g.drawImage(mb, -ox, -oy);
  }
  g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
  return c;
}
/** Start a buffered paint stroke (brush, pencil, eraser, clone). */
function startBufferedStroke(L, opts) {
  const S = { L, buf: mkCanvas(D.w, D.h), opts };
  S.g = cx(S.buf);
  if (opts.mask) {
    const work = mkCanvas(L.mask.canvas.width, L.mask.canvas.height), wg = cx(work);
    live = { layerId: L.id, maskSurface: (LL) => { const m = LL.mask; wg.globalCompositeOperation = 'copy'; wg.globalAlpha = 1; wg.drawImage(m.canvas, 0, 0); wg.globalCompositeOperation = 'source-over'; bakeStroke(LL, S.buf, opts, work); return { canvas: work, x: m.x, y: m.y, def: m.def }; } };
  } else {
    live = { layerId: L.id, surface: (LL) => { const t = scratchCanvas('b', LL.canvas.width, LL.canvas.height); cx(t).drawImage(LL.canvas, 0, 0); bakeStroke(LL, S.buf, opts, t); return { canvas: t, x: LL.x, y: LL.y, w: LL.canvas.width, h: LL.canvas.height }; } };
  }
  return S;
}
function finishBufferedStroke(S, label) {
  const L = D.layers.find((l) => l.id === S.L.id);
  live = null;
  if (!L) return;
  if (S.opts.mask) patchLayer(L.id, { mask: Object.assign({}, L.mask, { canvas: bakeStroke(L, S.buf, S.opts) }) });
  else patchLayer(L.id, { canvas: bakeStroke(L, S.buf, S.opts) });
  commit(label);
}

/* ---------- flood region (magic wand / bucket) ---------- */
function regionMask(src, sx, sy, tol, contiguous) {
  const w = src.width, hh = src.height, d = cxr(src).getImageData(0, 0, w, hh).data, out = new Uint8Array(w * hh);
  sx = Math.floor(sx); sy = Math.floor(sy);
  if (sx < 0 || sy < 0 || sx >= w || sy >= hh) return null;
  const i0 = (sy * w + sx) * 4, r0 = d[i0], g0 = d[i0 + 1], b0 = d[i0 + 2], a0 = d[i0 + 3];
  const match = (i) => { const j = i * 4; return Math.abs(d[j + 3] - a0) <= tol && (a0 === 0 && d[j + 3] === 0 || (Math.abs(d[j] - r0) <= tol && Math.abs(d[j + 1] - g0) <= tol && Math.abs(d[j + 2] - b0) <= tol)); };
  if (!contiguous) { for (let i = 0; i < w * hh; i++) if (match(i)) out[i] = 1; return out; }
  const stack = [sx, sy];
  while (stack.length) {
    const y = stack.pop(); let x = stack.pop();
    let i = y * w + x;
    while (x >= 0 && !out[i] && match(i)) { x--; i--; }
    x++; i++;
    let up = false, dn = false;
    while (x < w && !out[i] && match(i)) {
      out[i] = 1;
      if (y > 0) { const u = i - w; if (!out[u] && match(u)) { if (!up) { stack.push(x, y - 1); up = true; } } else up = false; }
      if (y < hh - 1) { const v = i + w; if (!out[v] && match(v)) { if (!dn) { stack.push(x, y + 1); dn = true; } } else dn = false; }
      x++; i++;
    }
  }
  return out;
}
function maskToCanvas(m, w, hh) {
  const c = mkCanvas(w, hh), g = cxr(c), img = g.createImageData(w, hh), d = img.data;
  for (let i = 0; i < m.length; i++) if (m[i]) d[i * 4 + 3] = 255;
  g.putImageData(img, 0, 0);
  return c;
}
function modeFrom(e) {
  if (e.shiftKey && e.altKey) return 'int';
  if (e.shiftKey) return 'add';
  if (e.altKey) return 'sub';
  return T.select.mode;
}

/* ---------- shapes ---------- */
function rectFrom(a, b, square, centre) {
  let w = b.x - a.x, hh = b.y - a.y;
  if (square) { const s = Math.max(Math.abs(w), Math.abs(hh)); w = Math.sign(w || 1) * s; hh = Math.sign(hh || 1) * s; }
  if (centre) return { x: a.x - Math.abs(w), y: a.y - Math.abs(hh), w: Math.abs(w) * 2, h: Math.abs(hh) * 2 };
  return { x: Math.min(a.x, a.x + w), y: Math.min(a.y, a.y + hh), w: Math.abs(w), h: Math.abs(hh) };
}
function shapePath(g, kind, r, o = {}) {
  g.beginPath();
  if (kind === 'rect') g.rect(r.x, r.y, r.w, r.h);
  else if (kind === 'rounded') { const rad = Math.min(o.radius || 0, r.w / 2, r.h / 2); if (g.roundRect) g.roundRect(r.x, r.y, r.w, r.h, rad); else g.rect(r.x, r.y, r.w, r.h); }
  else if (kind === 'ellipse') g.ellipse(r.x + r.w / 2, r.y + r.h / 2, Math.max(0.1, r.w / 2), Math.max(0.1, r.h / 2), 0, 0, Math.PI * 2);
  else if (kind === 'polygon' || kind === 'star') {
    const n = Math.max(3, o.sides || 5), cxp = r.x + r.w / 2, cyp = r.y + r.h / 2, pts = kind === 'star' ? n * 2 : n;
    for (let i = 0; i < pts; i++) { const a = -Math.PI / 2 + (i * Math.PI * 2) / pts, k = kind === 'star' && i % 2 ? 0.45 : 1; const x = cxp + Math.cos(a) * (r.w / 2) * k, y = cyp + Math.sin(a) * (r.h / 2) * k; i ? g.lineTo(x, y) : g.moveTo(x, y); }
    g.closePath();
  } else if (kind === 'heart') {
    const { x, y, w, h: hh } = r;
    g.moveTo(x + w / 2, y + hh * 0.28);
    g.bezierCurveTo(x + w / 2, y, x, y, x, y + hh * 0.32);
    g.bezierCurveTo(x, y + hh * 0.62, x + w / 2, y + hh * 0.8, x + w / 2, y + hh);
    g.bezierCurveTo(x + w / 2, y + hh * 0.8, x + w, y + hh * 0.62, x + w, y + hh * 0.32);
    g.bezierCurveTo(x + w, y, x + w / 2, y, x + w / 2, y + hh * 0.28);
    g.closePath();
  }
}

/* ---------- tool definitions ---------- */
const ICON = (d) => `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${d}"/></svg>`;
const TOOLS = [];
const TOOL = {};
function defTool(t) { TOOLS.push(t); TOOL[t.id] = t; return t; }
function currentTool() { return TRANSFORM.active ? TRANSFORM_TOOL : TOOL[UI.tool]; }
function selectTool(id) {
  if (!TOOL[id]) return;
  if (TRANSFORM.active) commitTransform();
  const prev = TOOL[UI.tool];
  if (prev && prev.deactivate) prev.deactivate();
  UI.tool = id; store.set('tool', id);
  const t = TOOL[id];
  if (t.activate) t.activate();
  V.el && (V.el.dataset.tool = id);
  emit('tool'); dirty();
}

/* Move */
defTool({ id: 'move', name: 'Move Tool', key: 'V', icon: ICON('M12 2v20M2 12h20M12 2l-3 3M12 2l3 3M12 22l-3-3M12 22l3-3M2 12l3-3M2 12l3 3M22 12l-3-3M22 12l-3 3'),
  down(p, e) {
    let L = activeLayer();
    if (T.move.auto || e.ctrlKey || e.metaKey) { const hit = layerAt(p); if (hit) { L = hit; D.activeId = hit.id; emit('doc'); } }
    if (!L || L.locked) { if (L) toast('That layer is locked'); this.s = null; return; }
    const s = this.s = { L, start: p, dx: 0, dy: 0 };
    if (D.sel && !e.altKey) {
      // Lift the selected pixels and float them.
      if (L.text) s.L = L = rasterizeText(L, true);
      const sel = selInLayer(L);
      s.lift = copyCanvas(L.canvas); const lg = cx(s.lift); lg.globalCompositeOperation = 'destination-in'; lg.drawImage(sel, 0, 0);
      s.rest = copyCanvas(L.canvas); const rg = cx(s.rest); rg.globalCompositeOperation = 'destination-out'; rg.drawImage(sel, 0, 0);
      s.sel = D.sel;
      live = { layerId: L.id, hideSel: true, surface: (LL) => { const t = scratchCanvas('b', LL.canvas.width, LL.canvas.height), g = cx(t); g.drawImage(s.rest, 0, 0); g.drawImage(s.lift, Math.round(s.dx), Math.round(s.dy)); return { canvas: t, x: LL.x, y: LL.y, w: LL.canvas.width, h: LL.canvas.height }; } };
    } else {
      live = { layerId: L.id, surface: (LL) => ({ canvas: LL.canvas, x: LL.x + Math.round(s.dx), y: LL.y + Math.round(s.dy) }), maskSurface: (LL) => LL.mask && Object.assign({}, LL.mask, { x: LL.mask.x + Math.round(s.dx), y: LL.mask.y + Math.round(s.dy) }) };
    }
  },
  move(p, e) {
    const s = this.s; if (!s) return;
    s.dx = p.x - s.start.x; s.dy = p.y - s.start.y;
    if (e.shiftKey) { if (Math.abs(s.dx) > Math.abs(s.dy)) s.dy = 0; else s.dx = 0; }
    dirty(true);
  },
  up() { const s = this.s; this.s = null; if (!s) return; live = null; moveBy(s, Math.round(s.dx), Math.round(s.dy)); },
  cancel() { this.s = null; live = null; dirty(true); },
  overlay(g) {
    const s = this.s;
    if (s && s.sel) drawAnts(g, s.sel, { x: Math.round(s.dx), y: Math.round(s.dy) });
    const L = activeLayer();
    if (!L || !store.get('showBounds', true)) return;
    const b = s ? null : layerBoundsDoc(L);
    if (b) { const a = toScreen(b.x, b.y); g.strokeStyle = 'rgba(80,160,255,.9)'; g.lineWidth = 1; g.setLineDash([]); g.strokeRect(Math.round(a.x) + 0.5, Math.round(a.y) + 0.5, Math.round(b.w * V.zoom), Math.round(b.h * V.zoom)); }
  },
});
function layerBoundsDoc(L) {
  if (!L._bounds || L._bounds.c !== L.canvas) { const b = alphaBounds(L.canvas); L._bounds = { c: L.canvas, b }; }
  const b = L._bounds.b; return b && { x: b.x + L.x, y: b.y + L.y, w: b.w, h: b.h };
}
function layerAt(p) {
  for (let i = D.layers.length - 1; i >= 0; i--) {
    const L = D.layers[i]; if (!L.visible) continue;
    const x = Math.floor(p.x - L.x), y = Math.floor(p.y - L.y);
    if (x < 0 || y < 0 || x >= L.canvas.width || y >= L.canvas.height) continue;
    if (cxr(L.canvas).getImageData(x, y, 1, 1).data[3] > 10) return L;
  }
  return null;
}
function moveBy(s, dx, dy) {
  if (!dx && !dy) return;
  const L = D.layers.find((l) => l.id === s.L.id); if (!L) return;
  if (s.lift) {
    const x0 = Math.min(0, dx), y0 = Math.min(0, dy), x1 = Math.max(L.canvas.width, L.canvas.width + dx), y1 = Math.max(L.canvas.height, L.canvas.height + dy);
    const c = mkCanvas(x1 - x0, y1 - y0), g = cx(c);
    g.drawImage(s.rest, -x0, -y0); g.drawImage(s.lift, dx - x0, dy - y0);
    let mask = L.mask;
    patchLayer(L.id, { canvas: c, x: L.x + x0, y: L.y + y0, mask });
    const m = mkCanvas(D.w, D.h); cx(m).drawImage(s.sel.mask, dx, dy);
    D.sel = makeSel(m);
  } else {
    patchLayer(L.id, { x: L.x + dx, y: L.y + dy, mask: L.mask && Object.assign({}, L.mask, { x: L.mask.x + dx, y: L.mask.y + dy }), text: L.text && Object.assign({}, L.text, { x: L.text.x + dx, y: L.text.y + dy }) });
  }
  commit('Move');
}
function nudge(dx, dy) {
  const L = activeLayer(); if (!L || L.locked) return;
  const s = { L };
  if (D.sel) {
    const sel = selInLayer(L);
    s.lift = copyCanvas(L.canvas); const lg = cx(s.lift); lg.globalCompositeOperation = 'destination-in'; lg.drawImage(sel, 0, 0);
    s.rest = copyCanvas(L.canvas); const rg = cx(s.rest); rg.globalCompositeOperation = 'destination-out'; rg.drawImage(sel, 0, 0);
    s.sel = D.sel;
  }
  moveBy(s, dx, dy);
}

/* Marquees & lassos */
function selectionTool(def) {
  return defTool(Object.assign({
    down(p, e) {
      const mode = modeFrom(e);
      if (mode === 'replace' && D.sel && this.id !== 'polylasso' && insideSel(p)) { this.s = { moveSel: true, start: p, dx: 0, dy: 0, sel: D.sel }; live = { hideSel: true, animate: false }; return; }
      this.s = { mode, start: p, pts: [p], cur: p };
    },
    move(p, e) {
      const s = this.s; if (!s) return;
      if (s.moveSel) { s.dx = Math.round(p.x - s.start.x); s.dy = Math.round(p.y - s.start.y); return; }
      s.cur = p; s.e = e; if (this.freehand) s.pts.push(p);
    },
    up(p, e) {
      const s = this.s; this.s = null; if (!s) return;
      if (s.moveSel) {
        live = null;
        if (s.dx || s.dy) { const m = mkCanvas(D.w, D.h); cx(m).drawImage(s.sel.mask, s.dx, s.dy); D.sel = makeSel(m); commit('Move Selection'); }
        return;
      }
      if (Math.hypot(p.x - s.start.x, p.y - s.start.y) * V.zoom < 3 && !this.freehand) { if (s.mode === 'replace' && D.sel) deselect(); return; }
      this.apply(s, e);
    },
    cancel() { this.s = null; live = null; },
    overlay(g) {
      const s = this.s; if (!s) return;
      if (s.moveSel) { drawAnts(g, s.sel, { x: s.dx, y: s.dy }); return; }
      g.save(); g.translate(V.ox, V.oy); g.scale(V.zoom, V.zoom); g.lineWidth = 1 / V.zoom;
      this.path(g, s);
      g.setLineDash([4 / V.zoom, 4 / V.zoom]); g.strokeStyle = '#000'; g.stroke(); g.lineDashOffset = 4 / V.zoom; g.strokeStyle = '#fff'; g.stroke();
      g.restore();
    },
  }, def));
}
function insideSel(p) {
  if (!D.sel) return false;
  const x = Math.floor(p.x), y = Math.floor(p.y);
  if (x < 0 || y < 0 || x >= D.w || y >= D.h) return false;
  return cxr(D.sel.mask).getImageData(x, y, 1, 1).data[3] >= 128;
}
selectionTool({ id: 'marquee', name: 'Rectangular Marquee Tool', key: 'M', icon: ICON('M4 4h3M10 4h4M17 4h3v3M20 10v4M20 17v3h-3M14 20h-4M7 20H4v-3M4 14v-4M4 7V4'),
  rect(s) { const e = s.e || {}; return rectFrom(s.start, s.cur, e.shiftKey && s.mode === 'replace', e.altKey && s.mode === 'replace'); },
  path(g, s) { const r = this.rect(s); g.beginPath(); g.rect(r.x, r.y, r.w, r.h); },
  apply(s) { const r = this.rect(s); selectShape((g) => g.fillRect(Math.round(r.x), Math.round(r.y), Math.round(r.w), Math.round(r.h)), s.mode, T.select.feather); commit('Rectangular Marquee'); } });
selectionTool({ id: 'ellipse', name: 'Elliptical Marquee Tool', key: 'M', icon: ICON('M12 4c4.4 0 8 3.6 8 8s-3.6 8-8 8-8-3.6-8-8 3.6-8 8-8z'),
  rect(s) { const e = s.e || {}; return rectFrom(s.start, s.cur, e.shiftKey && s.mode === 'replace', e.altKey && s.mode === 'replace'); },
  path(g, s) { const r = this.rect(s); g.beginPath(); g.ellipse(r.x + r.w / 2, r.y + r.h / 2, Math.max(0.1, r.w / 2), Math.max(0.1, r.h / 2), 0, 0, Math.PI * 2); },
  apply(s) { const r = this.rect(s); selectShape((g) => { g.beginPath(); g.ellipse(r.x + r.w / 2, r.y + r.h / 2, Math.max(0.1, r.w / 2), Math.max(0.1, r.h / 2), 0, 0, Math.PI * 2); g.fill(); }, s.mode, T.select.feather); commit('Elliptical Marquee'); } });
selectionTool({ id: 'lasso', name: 'Lasso Tool', key: 'L', freehand: true, icon: ICON('M7 15c-3-1.5-4-4-2.5-6.5C6.5 5 12 4 16 5.5s5 5 2 7.5-8 3-11 2zM7 15c-1 2 0 4 2 5'),
  path(g, s) { g.beginPath(); s.pts.forEach((q, i) => (i ? g.lineTo(q.x, q.y) : g.moveTo(q.x, q.y))); },
  apply(s) { if (s.pts.length < 3) { if (s.mode === 'replace') deselect(); return; } selectShape((g) => { g.beginPath(); s.pts.forEach((q, i) => (i ? g.lineTo(q.x, q.y) : g.moveTo(q.x, q.y))); g.closePath(); g.fill(); }, s.mode, T.select.feather); commit('Lasso'); } });
defTool({ id: 'polylasso', name: 'Polygonal Lasso Tool', key: 'L', icon: ICON('M4 18 7 5l7 4 6-3-2 12z'),
  down(p, e) {
    const s = this.s;
    if (!s) { this.s = { mode: modeFrom(e), pts: [p], cur: p }; return; }
    const first = s.pts[0];
    if (s.pts.length > 2 && Math.hypot(p.x - first.x, p.y - first.y) * V.zoom < 8) { this.finish(); return; }
    s.pts.push(p);
  },
  hover(p) { if (this.s) this.s.cur = p; },
  move(p) { if (this.s) this.s.cur = p; },
  dblclick() { this.finish(); },
  finish() {
    const s = this.s; this.s = null; if (!s || s.pts.length < 3) return;
    selectShape((g) => { g.beginPath(); s.pts.forEach((q, i) => (i ? g.lineTo(q.x, q.y) : g.moveTo(q.x, q.y))); g.closePath(); g.fill(); }, s.mode, T.select.feather);
    commit('Polygonal Lasso');
  },
  onKey(e) { if (!this.s) return false; if (e.key === 'Enter') { this.finish(); return true; } if (e.key === 'Escape') { this.s = null; dirty(); return true; } if (e.key === 'Backspace' || e.key === 'Delete') { this.s.pts.pop(); if (!this.s.pts.length) this.s = null; dirty(); return true; } return false; },
  cancel() { this.s = null; },
  deactivate() { this.s = null; },
  overlay(g) {
    const s = this.s; if (!s) return;
    g.save(); g.translate(V.ox, V.oy); g.scale(V.zoom, V.zoom); g.lineWidth = 1 / V.zoom;
    g.beginPath(); s.pts.forEach((q, i) => (i ? g.lineTo(q.x, q.y) : g.moveTo(q.x, q.y))); g.lineTo(s.cur.x, s.cur.y);
    g.setLineDash([4 / V.zoom, 4 / V.zoom]); g.strokeStyle = '#000'; g.stroke(); g.lineDashOffset = 4 / V.zoom; g.strokeStyle = '#fff'; g.stroke();
    g.restore();
  },
});
defTool({ id: 'wand', name: 'Magic Wand Tool', key: 'W', icon: ICON('M4 20 14 10M14 10l2-2M17 3v3M17 12v3M12 7.5h3M19 7.5h3M14.5 5l1.5 1.5M19.5 10l-1.5-1.5M19.5 5 18 6.5'),
  down(p, e) {
    const src = sampleSource(T.wand.sampleAll), m = regionMask(src, p.x, p.y, T.wand.tol, T.wand.contiguous);
    if (!m) { if (modeFrom(e) === 'replace') deselect(); return; }
    const mc = maskToCanvas(m, D.w, D.h);
    selectShape((g) => g.drawImage(mc, 0, 0), modeFrom(e), T.select.feather);
    commit('Magic Wand');
  } });
defTool({ id: 'crop', name: 'Crop Tool', key: 'C', icon: ICON('M6 2v16h16M2 6h16v16'),
  activate() { this.r = { x: 0, y: 0, w: D.w, h: D.h }; },
  deactivate() { this.r = null; this.s = null; },
  handleAt(p) {
    const r = this.r; if (!r) return null;
    const tol = 9 / V.zoom, xs = [r.x, r.x + r.w / 2, r.x + r.w], ys = [r.y, r.y + r.h / 2, r.y + r.h];
    for (let j = 0; j < 3; j++) for (let i = 0; i < 3; i++) { if (i === 1 && j === 1) continue; if (Math.abs(p.x - xs[i]) < tol && Math.abs(p.y - ys[j]) < tol) return { hx: i - 1, hy: j - 1 }; }
    if (p.x > r.x && p.x < r.x + r.w && p.y > r.y && p.y < r.y + r.h) return { move: true };
    return null;
  },
  down(p) { if (!this.r) this.activate(); const h = this.handleAt(p); this.s = { h: h || { draw: true }, start: p, r0: Object.assign({}, this.r) }; },
  move(p, e) {
    const s = this.s; if (!s) return;
    const dx = p.x - s.start.x, dy = p.y - s.start.y, r0 = s.r0;
    if (s.h.draw) this.r = rectFrom(s.start, p, e.shiftKey, e.altKey);
    else if (s.h.move) this.r = { x: r0.x + dx, y: r0.y + dy, w: r0.w, h: r0.h };
    else {
      let { x, y, w, h: hh } = r0;
      if (s.h.hx < 0) { x += dx; w -= dx; } if (s.h.hx > 0) w += dx;
      if (s.h.hy < 0) { y += dy; hh -= dy; } if (s.h.hy > 0) hh += dy;
      if (w < 0) { x += w; w = -w; } if (hh < 0) { y += hh; hh = -hh; }
      this.r = { x, y, w, h: hh };
    }
  },
  up() { this.s = null; },
  hover(p) { const h = this.handleAt(p); V.el.style.cursor = !h ? 'crosshair' : h.move ? 'move' : (h.hx * h.hy > 0 ? 'nwse-resize' : h.hx * h.hy < 0 ? 'nesw-resize' : h.hx ? 'ew-resize' : 'ns-resize'); },
  onKey(e) { if (e.key === 'Enter') { this.apply(); return true; } if (e.key === 'Escape') { this.activate(); dirty(); return true; } return false; },
  dblclick() { this.apply(); },
  apply() { const r = this.r; if (!r || r.w < 1 || r.h < 1) return; cropTo(r, T.crop.del); this.activate(); fitView(); },
  overlay(g) {
    const r = this.r; if (!r) return;
    const a = toScreen(r.x, r.y), w = r.w * V.zoom, hh = r.h * V.zoom;
    g.fillStyle = 'rgba(0,0,0,.5)';
    g.beginPath(); g.rect(0, 0, V.W, V.H); g.rect(a.x, a.y, w, hh); g.fill('evenodd');
    g.strokeStyle = '#fff'; g.lineWidth = 1; g.strokeRect(a.x + 0.5, a.y + 0.5, w, hh);
    g.strokeStyle = 'rgba(255,255,255,.45)'; g.beginPath();
    for (let i = 1; i < 3; i++) { g.moveTo(a.x + (w * i) / 3, a.y); g.lineTo(a.x + (w * i) / 3, a.y + hh); g.moveTo(a.x, a.y + (hh * i) / 3); g.lineTo(a.x + w, a.y + (hh * i) / 3); }
    g.stroke();
    g.fillStyle = '#fff';
    for (const [i, j] of [[0, 0], [0.5, 0], [1, 0], [0, 0.5], [1, 0.5], [0, 1], [0.5, 1], [1, 1]]) g.fillRect(a.x + w * i - 4, a.y + hh * j - 4, 8, 8);
    g.font = '11px "JetBrains Mono", monospace'; g.fillStyle = '#fff'; g.fillText(`${Math.round(r.w)} × ${Math.round(r.h)} px · Enter to crop`, a.x + 4, a.y - 8);
  },
});
defTool({ id: 'eyedropper', name: 'Eyedropper Tool', key: 'I', icon: ICON('M19 5a2.8 2.8 0 0 0-4 0l-2 2-1-1-2 2 1 1-7 7v4h4l7-7 1 1 2-2-1-1 2-2a2.8 2.8 0 0 0 0-4z'),
  down(p, e) { this.pick(p, e); }, move(p, e) { this.pick(p, e); },
  pick(p, e) { const c = pickColor(p, T.eyedrop.all, T.eyedrop.size); if (c) setColor(e.altKey ? 'bg' : 'fg', c); } });

/* Painting */
function brushTool(def) {
  return defTool(Object.assign({
    coalesce: true,
    brushCursor() { return this.opt().size; },
    down(p, e) {
      const L = editableLayer(); if (!L) { this.s = null; return; }
      const Lc = coverDoc(L), o = this.opt(), mask = maskTarget(Lc);
      const color = mask ? '#000000' : C.fg;
      const opts = { opacity: o.opacity, erase: !!this.erase, blend: o.blend, mask: !!mask, value: mask ? luma(...hexToRgb(C.fg)) / 255 : 1 };
      if (this.erase && mask) { opts.erase = false; opts.value = 0; }
      const S = this.s = startBufferedStroke(Lc, opts);
      const usePressure = o.pressure && p.pen;
      if (this.aliased) {
        S.stroker = new Stroker(() => 1, (x, y) => { const dc = pixelDisc(o.size, color), n = Math.max(1, Math.round(o.size)); S.g.drawImage(dc, Math.round(x - n / 2), Math.round(y - n / 2)); });
      } else {
        const tip = o.tip || 'round', nv = TIP_VARIANTS[tip] || 1;
        const dabs = Array.from({ length: nv }, (_, v) => dabCanvas(o.size, o.hardness, color, tip, v));
        const spacing = tip === 'spray' ? Math.max(o.spacing, 0.3) : tip === 'slime' ? Math.max(o.spacing, 0.18) : o.spacing;
        S.stroker = new Stroker((pr) => Math.max(0.5, o.size * (usePressure ? clamp(pr, 0.05, 1) : 1) * spacing), (x, y, pr) => {
          const dab = dabs[(Math.random() * nv) | 0];
          const s = o.size * (usePressure ? clamp(pr, 0.05, 1) : 1), d = (dab.width * s) / o.size;
          S.g.globalAlpha = o.flow; S.g.drawImage(dab, x - d / 2, y - d / 2, d, d);
        });
      }
      if (e.shiftKey && this.lastPoint) { S.stroker.begin(this.lastPoint); S.stroker.to(p); } else S.stroker.begin(p);
      dirty(true);
    },
    move(p) { if (this.s) { this.s.stroker.to(p); dirty(true); } },
    up(p) { const S = this.s; this.s = null; if (!S) return; this.lastPoint = p; finishBufferedStroke(S, this.name.replace(' Tool', '')); },
    cancel() { this.s = null; live = null; dirty(true); },
  }, def));
}
brushTool({ id: 'brush', name: 'Brush Tool', key: 'B', icon: ICON('M18.4 3.6a2 2 0 0 1 2.9 2.9L12 15.8 8.2 12zM8 13c-2.5 0-4 1.8-4 4 0 1.6-.8 2.6-2 3 4 .8 8-.5 8-4.2z'), opt: () => T.brush });
brushTool({ id: 'pencil', name: 'Pencil Tool', key: 'B', aliased: true, icon: ICON('M16 3l5 5L8 21H3v-5zM13.5 5.5l5 5'), opt: () => Object.assign({ hardness: 1, flow: 1, spacing: 0.1, pressure: false }, T.pencil) });
brushTool({ id: 'eraser', name: 'Eraser Tool', key: 'E', erase: true, icon: ICON('M16.2 3.8 21 8.6 10.6 19H6l-3-3zM9 10l5.6 5.6M10.6 19H21'), opt: () => T.eraser });
defTool({ id: 'clone', name: 'Clone Stamp Tool', key: 'S', icon: ICON('M9 3h6v6l3 2v3H6v-3l3-2zM4 17h16v4H4z'),
  coalesce: true,
  brushCursor() { return T.clone.size; },
  down(p, e) {
    if (e.altKey) { this.src = { x: p.x, y: p.y }; this.off = null; toast('Clone source set'); return; }
    if (!this.src) { toast('Alt-click (Option-click) to set a clone source first'); return; }
    const L = editableLayer(); if (!L) return;
    const Lc = coverDoc(L), o = T.clone;
    if (!T.clone.aligned || !this.off) this.off = { x: this.src.x - p.x, y: this.src.y - p.y };
    const source = T.clone.sampleAll ? flattenCanvas() : docCanvasOf(Lc);
    const S = this.s = startBufferedStroke(Lc, { opacity: o.opacity });
    const dab = dabCanvas(o.size, o.hardness, '#000000');
    const tmp = mkCanvas(dab.width, dab.height), tg = cx(tmp);
    S.cur = p;
    S.stroker = new Stroker(() => Math.max(1, o.size * 0.1), (x, y) => {
      const d = dab.width;
      tg.globalCompositeOperation = 'copy'; tg.drawImage(source, -(x + this.off.x - d / 2), -(y + this.off.y - d / 2));
      tg.globalCompositeOperation = 'destination-in'; tg.drawImage(dab, 0, 0);
      S.g.globalAlpha = o.flow; S.g.drawImage(tmp, x - d / 2, y - d / 2);
      S.cur = { x, y };
    });
    S.stroker.begin(p); dirty(true);
  },
  move(p) { if (this.s) { this.s.stroker.to(p); dirty(true); } },
  up() { const S = this.s; this.s = null; if (S) finishBufferedStroke(S, 'Clone Stamp'); },
  cancel() { this.s = null; live = null; },
  overlay(g) {
    if (!this.src) return;
    const c = this.s && this.off ? { x: this.s.cur.x + this.off.x, y: this.s.cur.y + this.off.y } : this.off && V.cursor ? { x: V.cursor.x + this.off.x, y: V.cursor.y + this.off.y } : this.src;
    const s = toScreen(c.x, c.y), r = (T.clone.size * V.zoom) / 2;
    g.strokeStyle = 'rgba(255,255,255,.8)'; g.setLineDash([3, 3]); g.beginPath(); g.arc(s.x, s.y, Math.max(3, r), 0, Math.PI * 2); g.stroke();
    g.setLineDash([]); g.beginPath(); g.moveTo(s.x - 6, s.y); g.lineTo(s.x + 6, s.y); g.moveTo(s.x, s.y - 6); g.lineTo(s.x, s.y + 6); g.stroke();
  },
});
/** Tools that edit a working copy of the layer directly (smudge, dodge/burn). */
function directTool(def) {
  return defTool(Object.assign({
    coalesce: true,
    down(p) {
      const L = editableLayer(); if (!L) { this.s = null; return; }
      if (UI.editMask) { toast('Switch to the layer pixels to use this tool'); return; }
      const Lc = coverDoc(L), work = copyCanvas(Lc.canvas);
      const s = this.s = { L: Lc, work, g: cxr(work) };
      live = { layerId: Lc.id, surface: (LL) => ({ canvas: s.work, x: LL.x, y: LL.y }) };
      this.begin(s, p);
      s.stroker = new Stroker(() => Math.max(1, this.opt().size * 0.12), (x, y) => this.dab(s, x - Lc.x, y - Lc.y));
      s.stroker.begin(p);
      dirty(true);
    },
    move(p) { if (this.s) { this.s.stroker.to(p); dirty(true); } },
    up() {
      const s = this.s; this.s = null; if (!s) return;
      live = null;
      const L = D.layers.find((l) => l.id === s.L.id); if (!L) return;
      patchLayer(L.id, { canvas: D.sel ? mixBySel(L.canvas, s.work, selInLayer(L)) : s.work });
      commit(this.name.replace(' Tool', ''));
    },
    cancel() { this.s = null; live = null; },
    brushCursor() { return this.opt().size; },
  }, def));
}
directTool({ id: 'smudge', name: 'Smudge Tool', key: 'R', icon: ICON('M8 21v-6.5L5.5 8a1.5 1.5 0 0 1 2.8-1l1.7 4V4.5a1.5 1.5 0 0 1 3 0V10V3.5a1.5 1.5 0 0 1 3 0V11V6a1.5 1.5 0 0 1 3 0v8c0 3.9-2.5 7-6 7z'),
  opt: () => T.smudge,
  begin(s, p) {
    const o = T.smudge, d = Math.max(2, Math.ceil(o.size));
    s.pick = mkCanvas(d, d); s.pg = cx(s.pick);
    s.pg.drawImage(s.work, -(p.x - s.L.x - d / 2), -(p.y - s.L.y - d / 2));
    s.mask = dabCanvas(o.size, o.hardness, '#000000'); s.tmp = mkCanvas(d, d); s.tg = cx(s.tmp);
  },
  dab(s, x, y) {
    const o = T.smudge, d = s.pick.width, md = s.mask.width;
    s.tg.globalCompositeOperation = 'copy'; s.tg.drawImage(s.pick, 0, 0);
    s.tg.globalCompositeOperation = 'destination-in'; s.tg.drawImage(s.mask, (d - md) / 2, (d - md) / 2);
    s.g.globalAlpha = o.strength; s.g.drawImage(s.tmp, x - d / 2, y - d / 2); s.g.globalAlpha = 1;
    s.pg.globalAlpha = 1 - o.strength * 0.85; s.pg.drawImage(s.work, -(x - d / 2), -(y - d / 2)); s.pg.globalAlpha = 1;
  } });
directTool({ id: 'dodge', name: 'Dodge / Burn Tool', key: 'O', icon: ICON('M12 3a5 5 0 1 1 0 10 5 5 0 0 1 0-10zM12 13v8'),
  opt: () => T.dodge,
  begin() {},
  dab(s, x, y) {
    const o = T.dodge, r = o.size / 2, x0 = Math.max(0, Math.floor(x - r)), y0 = Math.max(0, Math.floor(y - r));
    const x1 = Math.min(s.work.width, Math.ceil(x + r)), y1 = Math.min(s.work.height, Math.ceil(y + r)), w = x1 - x0, hh = y1 - y0;
    if (w <= 0 || hh <= 0) return;
    const img = s.g.getImageData(x0, y0, w, hh), d = img.data, k = o.exposure * 0.18, burn = o.mode === 'burn';
    for (let j = 0; j < hh; j++) for (let i = 0; i < w; i++) {
      const dist = Math.hypot(x0 + i + 0.5 - x, y0 + j + 0.5 - y) / r; if (dist >= 1) continue;
      const f = (dist < o.hardness ? 1 : 1 - (dist - o.hardness) / (1 - o.hardness || 1)) * k, q = (j * w + i) * 4;
      for (let c = 0; c < 3; c++) { const v = d[q + c]; d[q + c] = burn ? v * (1 - f * (0.4 + (v / 255) * 0.6)) : v + (255 - v) * f * (0.4 + (1 - v / 255) * 0.3); }
    }
    s.g.putImageData(img, x0, y0);
  } });

/** Soft falloff weight 0..1 for a pixel at distance dist (in radii). */
const falloff = (dist, hardness) => (dist >= 1 ? 0 : dist < hardness ? 1 : 1 - (dist - hardness) / (1 - hardness || 1));
function dabRegion(s, x, y, r, pad = 0) {
  const x0 = Math.max(0, Math.floor(x - r - pad)), y0 = Math.max(0, Math.floor(y - r - pad));
  const x1 = Math.min(s.work.width, Math.ceil(x + r + pad)), y1 = Math.min(s.work.height, Math.ceil(y + r + pad));
  return x1 > x0 && y1 > y0 ? { x0, y0, w: x1 - x0, h: y1 - y0 } : null;
}
function blurSharpenDab(s, x, y, o, sharpen) {
  const r = o.size / 2, pad = 6, R0 = dabRegion(s, x, y, r, pad); if (!R0) return;
  const img = s.g.getImageData(R0.x0, R0.y0, R0.w, R0.h), d = img.data;
  const bl = new ImageData(new Uint8ClampedArray(d), R0.w, R0.h);
  blurImageData(bl, sharpen ? 2.2 : 2 + o.size * 0.04);
  const b = bl.data, k = o.strength * (sharpen ? 1.6 : 0.85);
  for (let j = 0; j < R0.h; j++) for (let i = 0; i < R0.w; i++) {
    const f = falloff(Math.hypot(R0.x0 + i + 0.5 - x, R0.y0 + j + 0.5 - y) / r, o.hardness) * k; if (!f) continue;
    const q = (j * R0.w + i) * 4;
    for (let c = 0; c < 4; c++) d[q + c] = sharpen ? d[q + c] + (d[q + c] - b[q + c]) * f : d[q + c] + (b[q + c] - d[q + c]) * Math.min(1, f);
  }
  s.g.putImageData(img, R0.x0, R0.y0);
}
directTool({ id: 'blur', name: 'Blur Tool', key: 'R', icon: ICON('M12 3s6 6.6 6 11a6 6 0 0 1-12 0c0-4.4 6-11 6-11z'), opt: () => T.blur, begin() {}, dab(s, x, y) { blurSharpenDab(s, x, y, T.blur, false); } });
directTool({ id: 'sharpen', name: 'Sharpen Tool', key: 'R', icon: ICON('M12 3 20 20H4z'), opt: () => T.sharpen, begin() {}, dab(s, x, y) { blurSharpenDab(s, x, y, T.sharpen, true); } });
directTool({ id: 'sponge', name: 'Sponge Tool', key: 'O', icon: ICON('M5 8c0-2 2-4 7-4s7 2 7 4v8c0 2-2 4-7 4s-7-2-7-4zM9 9h.01M14 11h.01M10 14h.01M15 16h.01'),
  opt: () => T.sponge, begin() {},
  dab(s, x, y) {
    const o = T.sponge, r = o.size / 2, R0 = dabRegion(s, x, y, r); if (!R0) return;
    const img = s.g.getImageData(R0.x0, R0.y0, R0.w, R0.h), d = img.data, sat = o.mode === 'saturate';
    for (let j = 0; j < R0.h; j++) for (let i = 0; i < R0.w; i++) {
      const f = falloff(Math.hypot(R0.x0 + i + 0.5 - x, R0.y0 + j + 0.5 - y) / r, o.hardness) * o.flow * 0.25; if (!f) continue;
      const q = (j * R0.w + i) * 4, l = luma(d[q], d[q + 1], d[q + 2]), k = sat ? 1 + f : 1 - f;
      d[q] = l + (d[q] - l) * k; d[q + 1] = l + (d[q + 1] - l) * k; d[q + 2] = l + (d[q + 2] - l) * k;
    }
    s.g.putImageData(img, R0.x0, R0.y0);
  } });

/* Fill tools */
defTool({ id: 'gradient', name: 'Gradient Tool', key: 'G', icon: ICON('M3 3h18v18H3zM3 21 21 3'),
  down(p, e) { const L = editableLayer(); if (!L) return; this.s = { L: coverDoc(L), a: p, b: p }; },
  move(p, e) {
    const s = this.s; if (!s) return;
    let b = p;
    if (e.shiftKey) { const a = Math.atan2(p.y - s.a.y, p.x - s.a.x), sn = Math.round(a / (Math.PI / 4)) * (Math.PI / 4), d = Math.hypot(p.x - s.a.x, p.y - s.a.y); b = { x: s.a.x + Math.cos(sn) * d, y: s.a.y + Math.sin(sn) * d }; }
    s.b = b;
    const grad = gradientCanvas(s.a, s.b);
    const opts = { opacity: T.gradient.opacity, mask: !!maskTarget(s.L), value: 1 };
    if (opts.mask) {
      live = { layerId: s.L.id, maskSurface: (LL) => { const m = LL.mask, t = copyCanvas(m.canvas); applyGradToMask(t, m, grad); return { canvas: t, x: m.x, y: m.y, def: m.def }; } };
    } else live = { layerId: s.L.id, surface: (LL) => { const t = scratchCanvas('b', LL.canvas.width, LL.canvas.height); cx(t).drawImage(LL.canvas, 0, 0); bakeStroke(LL, grad, opts, t); return { canvas: t, x: LL.x, y: LL.y, w: LL.canvas.width, h: LL.canvas.height }; } };
    dirty(true);
  },
  up() {
    const s = this.s; this.s = null; if (!s) return;
    live = null;
    if (Math.hypot(s.b.x - s.a.x, s.b.y - s.a.y) < 1) return;
    const L = D.layers.find((l) => l.id === s.L.id), grad = gradientCanvas(s.a, s.b);
    if (maskTarget(L)) { const t = copyCanvas(L.mask.canvas); applyGradToMask(t, L.mask, grad); patchLayer(L.id, { mask: Object.assign({}, L.mask, { canvas: t }) }); }
    else patchLayer(L.id, { canvas: bakeStroke(L, grad, { opacity: T.gradient.opacity }) });
    commit('Gradient');
  },
  cancel() { this.s = null; live = null; },
  overlay(g) {
    const s = this.s; if (!s) return;
    const a = toScreen(s.a.x, s.a.y), b = toScreen(s.b.x, s.b.y);
    g.lineWidth = 3; g.strokeStyle = 'rgba(0,0,0,.6)'; g.beginPath(); g.moveTo(a.x, a.y); g.lineTo(b.x, b.y); g.stroke();
    g.lineWidth = 1; g.strokeStyle = '#fff'; g.stroke();
    for (const q of [a, b]) { g.fillStyle = '#fff'; g.beginPath(); g.arc(q.x, q.y, 4, 0, Math.PI * 2); g.fill(); g.stroke(); }
  },
});
function applyGradToMask(t, m, grad) {
  // Mask value = gradient luminance; drawn as alpha.
  const lum = mkCanvas(D.w, D.h), lg = cxr(lum), img = cxr(grad).getImageData(0, 0, D.w, D.h), d = img.data;
  for (let i = 0; i < d.length; i += 4) { d[i + 3] = (luma(d[i], d[i + 1], d[i + 2]) * d[i + 3]) / 255; d[i] = d[i + 1] = d[i + 2] = 0; }
  lg.putImageData(img, 0, 0);
  const g = cx(t);
  const mb = maskedBuffer(lum);
  if (D.sel) { g.globalCompositeOperation = 'destination-out'; g.globalAlpha = T.gradient.opacity; g.drawImage(D.sel.mask, -m.x, -m.y); g.globalCompositeOperation = 'lighter'; g.drawImage(mb, -m.x, -m.y); }
  else { g.globalCompositeOperation = 'copy'; g.globalAlpha = 1; g.drawImage(mb, -m.x, -m.y); }
  g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
}
function gradientCanvas(a, b) {
  const c = mkCanvas(D.w, D.h), g = cx(c), o = T.gradient;
  const [fr, fg, fb] = hexToRgb(C.fg);
  let c0 = C.fg, c1 = o.mode === 'fgbg' ? C.bg : `rgba(${fr},${fg},${fb},0)`;
  if (o.mode === 'slop') { c0 = '#d4ff3a'; c1 = '#1f3d00'; }
  if (o.reverse) [c0, c1] = [c1, c0];
  const stops = o.mode === 'spectrum' ? ['#ff0040', '#ff9900', '#ffee00', '#33dd55', '#00aaff', '#7a33ff', '#ff00aa'] : [c0, c1];
  const add = (gr, mirrored) => {
    const list = mirrored ? stops.slice().reverse().concat(stops.slice(1)) : stops;
    list.forEach((col, i) => gr.addColorStop(i / (list.length - 1), col));
  };
  let gr;
  const len = Math.hypot(b.x - a.x, b.y - a.y) || 1;
  if (o.type === 'radial') gr = g.createRadialGradient(a.x, a.y, 0, a.x, a.y, len);
  else if (o.type === 'reflected') gr = g.createLinearGradient(a.x - (b.x - a.x), a.y - (b.y - a.y), b.x, b.y);
  else if (o.type === 'angle' && g.createConicGradient) gr = g.createConicGradient(Math.atan2(b.y - a.y, b.x - a.x), a.x, a.y);
  else gr = g.createLinearGradient(a.x, a.y, b.x, b.y);
  add(gr, o.type === 'reflected');
  g.fillStyle = gr; g.fillRect(0, 0, D.w, D.h);
  return c;
}
defTool({ id: 'bucket', name: 'Paint Bucket Tool', key: 'G', icon: ICON('M5 11 12 4l7 7-7 7zM19 15s2 2.4 2 3.5a2 2 0 0 1-4 0c0-1.1 2-3.5 2-3.5zM3 21h12'),
  down(p, e) {
    const L0 = editableLayer(); if (!L0) return;
    const L = coverDoc(L0), src = T.bucket.sampleAll ? flattenCanvas() : docCanvasOf(L);
    const m = regionMask(src, p.x, p.y, T.bucket.tol, T.bucket.contiguous); if (!m) return;
    const region = maskToCanvas(m, D.w, D.h), g = cx(region);
    g.globalCompositeOperation = 'source-in'; g.fillStyle = C.fg; g.fillRect(0, 0, D.w, D.h);
    if (maskTarget(L)) { const v = luma(...hexToRgb(C.fg)) / 255; patchLayer(L.id, { mask: Object.assign({}, L.mask, { canvas: bakeStroke(L, region, { opacity: T.bucket.opacity, mask: true, value: v }) }) }); }
    else patchLayer(L.id, { canvas: bakeStroke(L, region, { opacity: T.bucket.opacity }) });
    commit('Paint Bucket');
  } });

/* Type */
const TE = { el: null, layerId: null, x: 0, y: 0 };
function typeFont(t, z = 1) { return `${t.italic ? 'italic ' : ''}${t.bold ? '700 ' : '400 '}${t.size * z}px ${fontStack(t.font)}`; }
function fontStack(f) { return `"${f}", ${/Mono|Courier/.test(f) ? 'ui-monospace, monospace' : /Serif|Georgia|Times/.test(f) ? 'Georgia, serif' : 'system-ui, -apple-system, "Segoe UI", sans-serif'}`; }
function renderTextCanvas(t) {
  const meas = cx(mkCanvas(1, 1)); meas.font = typeFont(t);
  const lines = String(t.str).split('\n'), lh = t.size * 1.2, pad = Math.ceil(t.size * 0.35);
  const widths = lines.map((l) => meas.measureText(l).width), maxW = Math.max(1, ...widths);
  const c = mkCanvas(maxW + pad * 2, lines.length * lh + pad * 2), g = cx(c);
  g.font = typeFont(t); g.fillStyle = t.color; g.textBaseline = 'top';
  lines.forEach((l, i) => { const x = t.align === 'center' ? (maxW - widths[i]) / 2 : t.align === 'right' ? maxW - widths[i] : 0; g.fillText(l, pad + x, pad + i * lh + (lh - t.size) / 2); });
  return { canvas: c, x: Math.round(t.x - pad), y: Math.round(t.y - pad) };
}
function textLayerAt(p) {
  for (let i = D.layers.length - 1; i >= 0; i--) { const L = D.layers[i]; if (!L.text || !L.visible) continue; if (p.x >= L.x && p.y >= L.y && p.x <= L.x + L.canvas.width && p.y <= L.y + L.canvas.height) return L; }
  return null;
}
function startTypeEdit(p, L) {
  endTypeEdit();
  const t = L ? Object.assign({}, L.text) : Object.assign({ str: '', x: Math.round(p.x), y: Math.round(p.y), color: C.fg }, T.type);
  if (L) { Object.assign(T.type, { font: t.font, size: t.size, bold: t.bold, italic: t.italic, align: t.align }); emit('tool'); }
  const el = h('textarea', { class: 'type-edit', spellcheck: 'false', 'aria-label': 'Type layer text' });
  el.value = t.str;
  TE.el = el; TE.layerId = L ? L.id : null; TE.t = t;
  if (L) live = { layerId: L.id, surface: () => ({ canvas: scratchCanvas('b', 1, 1), x: 0, y: 0, w: 1, h: 1 }) };
  V.el.append(el);
  el.addEventListener('input', () => { TE.t.str = el.value; layoutTypeEdit(); });
  el.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { e.preventDefault(); endTypeEdit(true); }
    else if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); endTypeEdit(); }
    e.stopPropagation();
  });
  layoutTypeEdit();
  setTimeout(() => el.focus(), 0);
  dirty(true);
}
function layoutTypeEdit() {
  if (!TE.el) return;
  const t = TE.t, el = TE.el, s = toScreen(t.x, t.y), z = V.zoom;
  Object.assign(el.style, { left: s.x + 'px', top: s.y + 'px', font: typeFont(t, z), color: t.color, textAlign: t.align, lineHeight: 1.2 });
  el.style.height = '0px'; el.style.width = '0px';
  el.style.width = Math.max(t.size * z * 0.7, el.scrollWidth + t.size * z * 0.5) + 'px';
  el.style.height = el.scrollHeight + 'px';
}
async function endTypeEdit(cancel) {
  if (!TE.el) return;
  const el = TE.el, t = TE.t, id = TE.layerId;
  TE.el = null; el.remove();
  live = null;
  if (cancel) { dirty(true); return; }
  t.str = el.value.replace(/\s+$/, '');
  try { await document.fonts.load(typeFont(t)); } catch (e) { /* offline: fallback font */ }
  if (!t.str) { if (id) { const i = layerIndex(id); if (i >= 0 && D.layers.length > 1) { D.layers.splice(i, 1); D.activeId = D.layers[Math.max(0, i - 1)].id; commit('Delete Type'); } } dirty(true); return; }
  const r = renderTextCanvas(t);
  const name = t.str.split('\n')[0].slice(0, 32);
  if (id && layerIndex(id) >= 0) { patchLayer(id, { canvas: r.canvas, x: r.x, y: r.y, text: t, name }); commit('Edit Type'); }
  else addLayer({ name, canvas: r.canvas, x: r.x, y: r.y, text: t }, 'Type Layer');
}
function updateEditingType() { if (TE.el) { Object.assign(TE.t, T.type, { color: TE.t.color }); layoutTypeEdit(); } }
listeners.add((w) => { if (w === 'zoom' && TE.el) layoutTypeEdit(); });
defTool({ id: 'type', name: 'Horizontal Type Tool', key: 'T', icon: ICON('M5 5V3h14v2M12 3v18M9 21h6'),
  down(p) { if (TE.el) { endTypeEdit(); return; } startTypeEdit(p, textLayerAt(p)); },
  deactivate() { endTypeEdit(); },
  hover(p) { V.el.style.cursor = textLayerAt(p) ? 'text' : 'text'; },
  overlay(g) {
    if (!TE.el) return;
    layoutTypeEdit();
  },
});

/* Shapes */
defTool({ id: 'shape', name: 'Shape Tool', key: 'U', icon: ICON('M3 3h10v10H3zM16 11a5 5 0 1 1 0 10 5 5 0 0 1 0-10z'),
  down(p) { const L = activeLayer(); if (!L) return; this.s = { a: p, b: p, e: {} }; },
  move(p, e) {
    const s = this.s; if (!s) return; s.b = p; s.e = e;
    live = { overlayDoc: (g) => this.paint(g, s) };
    dirty(true);
  },
  paint(g, s) {
    const o = T.shape;
    if (o.kind === 'line') {
      let b = s.b;
      if (s.e.shiftKey) { const a = Math.atan2(b.y - s.a.y, b.x - s.a.x), sn = Math.round(a / (Math.PI / 4)) * (Math.PI / 4), d = Math.hypot(b.x - s.a.x, b.y - s.a.y); b = { x: s.a.x + Math.cos(sn) * d, y: s.a.y + Math.sin(sn) * d }; }
      g.beginPath(); g.moveTo(s.a.x, s.a.y); g.lineTo(b.x, b.y); g.lineCap = 'round'; g.lineWidth = o.strokeW; g.strokeStyle = C.fg; g.stroke();
      return;
    }
    const r = rectFrom(s.a, s.b, s.e.shiftKey, s.e.altKey);
    shapePath(g, o.kind, r, o);
    if (o.fill) { g.fillStyle = C.fg; g.fill(); }
    if (o.stroke || !o.fill) { g.lineJoin = 'round'; g.lineWidth = o.strokeW; g.strokeStyle = o.fill ? C.bg : C.fg; g.stroke(); }
  },
  up() {
    const s = this.s; this.s = null; live = null;
    if (!s || Math.hypot(s.b.x - s.a.x, s.b.y - s.a.y) < 2) { dirty(true); return; }
    const c = mkCanvas(D.w, D.h); this.paint(cx(c), s);
    const names = { rect: 'Rectangle', rounded: 'Rounded Rectangle', ellipse: 'Ellipse', polygon: 'Polygon', star: 'Star', line: 'Line', heart: 'Heart' };
    addLayer({ name: nextName(names[T.shape.kind] || 'Shape'), canvas: c }, names[T.shape.kind] || 'Shape');
  },
  cancel() { this.s = null; live = null; },
});
defTool({ id: 'hand', name: 'Hand Tool', key: 'H', icon: ICON('M8 13V5.5a1.5 1.5 0 0 1 3 0V12M11 11V3.5a1.5 1.5 0 0 1 3 0V11M14 11V5.5a1.5 1.5 0 0 1 3 0V12M17 9.5a1.5 1.5 0 0 1 3 0V15a6 6 0 0 1-6 6h-2a6 6 0 0 1-4.6-2.2L4.3 15a1.6 1.6 0 0 1 2.4-2l1.3 1.4'),
  dblclick() { fitView(); } });
defTool({ id: 'zoom', name: 'Zoom Tool', key: 'Z', icon: ICON('M10.5 3a7.5 7.5 0 1 1 0 15 7.5 7.5 0 0 1 0-15zM21 21l-5.2-5.2M7.5 10.5h6M10.5 7.5v6'),
  down(p, e) { this.s = { start: p, sx: e.clientX, alt: e.altKey || e.button === 2 }; },
  move(p, e) { const s = this.s; if (!s) return; const dx = e.clientX - s.sx; if (Math.abs(dx) > 3) { s.scrub = true; setZoom(V.zoom * Math.exp(dx * 0.01), toScreen(s.start.x, s.start.y)); s.sx = e.clientX; } },
  up(p, e) { const s = this.s; this.s = null; if (!s || s.scrub) return; zoomStep(s.alt ? -1 : 1, toScreen(p.x, p.y)); },
  dblclick() { actualPixels(); } });

/* ---------- Free Transform (Ctrl+T) ---------- */
const TRANSFORM = { active: false };
function startTransform() {
  if (TRANSFORM.active) return;
  let L = activeLayer(); if (!L) return;
  if (L.locked) { toast('That layer is locked'); return; }
  if (!L.visible) { toast('Show the layer first'); return; }
  if (TE.el) endTypeEdit();
  if (L.text) L = rasterizeText(L, true);
  let float, rest = null, b;
  if (D.sel) {
    const sel = selInLayer(L);
    float = copyCanvas(L.canvas); const fg = cx(float); fg.globalCompositeOperation = 'destination-in'; fg.drawImage(sel, 0, 0);
    rest = copyCanvas(L.canvas); const rg = cx(rest); rg.globalCompositeOperation = 'destination-out'; rg.drawImage(sel, 0, 0);
    b = alphaBounds(float);
  } else { float = L.canvas; b = alphaBounds(float); }
  if (!b) { toast('Nothing to transform: the layer is empty there'); return; }
  const crop = mkCanvas(b.w, b.h); cx(crop).drawImage(float, -b.x, -b.y);
  const x = L.x + b.x, y = L.y + b.y;
  Object.assign(TRANSFORM, { active: true, L, float: crop, rest, x, y, w: b.w, h: b.h, cx: x + b.w / 2, cy: y + b.h / 2, tx: 0, ty: 0, sx: 1, sy: 1, rot: 0, sel: D.sel, drag: null });
  live = { layerId: L.id, hideSel: true, surface: (LL) => transformSurface(LL) };
  emit('tool'); dirty(true);
}
function tfMatrix(tf = TRANSFORM) {
  // doc point = C' + R·S·(p − C)
  const c = Math.cos(tf.rot), s = Math.sin(tf.rot);
  const a = c * tf.sx, b = s * tf.sx, cc = -s * tf.sy, d = c * tf.sy;
  const ex = tf.cx + tf.tx - (a * tf.cx + cc * tf.cy), fy = tf.cy + tf.ty - (b * tf.cx + d * tf.cy);
  return new DOMMatrix([a, b, cc, d, ex, fy]);
}
function tfCorners() {
  const m = tfMatrix(), t = TRANSFORM, pts = [[t.x, t.y], [t.x + t.w, t.y], [t.x + t.w, t.y + t.h], [t.x, t.y + t.h]];
  return pts.map(([x, y]) => { const p = m.transformPoint(new DOMPoint(x, y)); return { x: p.x, y: p.y }; });
}
function transformSurface(L) {
  const t = TRANSFORM, cs = tfCorners();
  const xs = cs.map((p) => p.x).concat([L.x, L.x + L.canvas.width]), ys = cs.map((p) => p.y).concat([L.y, L.y + L.canvas.height]);
  const x0 = Math.floor(Math.min(...xs)), y0 = Math.floor(Math.min(...ys)), x1 = Math.ceil(Math.max(...xs)), y1 = Math.ceil(Math.max(...ys));
  const c = scratchCanvas('b', x1 - x0, y1 - y0), g = cx(c);
  if (t.rest) g.drawImage(t.rest, L.x - x0, L.y - y0);
  g.save(); g.setTransform(new DOMMatrix([1, 0, 0, 1, -x0, -y0]).multiply(tfMatrix()));
  g.imageSmoothingQuality = 'high'; g.drawImage(t.float, t.x, t.y); g.restore();
  return { canvas: c, x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}
function commitTransform() {
  const t = TRANSFORM; if (!t.active) return;
  const L = D.layers.find((l) => l.id === t.L.id);
  live = null; t.active = false;
  if (!L) return;
  const s = transformSurface(L), c = mkCanvas(s.w, s.h); cx(c).drawImage(s.canvas, 0, 0);
  const m = tfMatrix();
  let mask = L.mask;
  if (mask && !t.rest) {
    const mc = mkCanvas(s.w, s.h), mg = cx(mc);
    if (mask.def) { mg.fillStyle = '#000'; mg.fillRect(0, 0, s.w, s.h); }
    mg.setTransform(new DOMMatrix([1, 0, 0, 1, -s.x, -s.y]).multiply(m));
    if (mask.def) { mg.globalCompositeOperation = 'destination-out'; mg.fillRect(mask.x, mask.y, mask.canvas.width, mask.canvas.height); mg.globalCompositeOperation = 'source-over'; }
    mg.drawImage(mask.canvas, mask.x, mask.y);
    mask = Object.assign({}, mask, { canvas: mc, x: s.x, y: s.y });
  }
  patchLayer(L.id, { canvas: c, x: s.x, y: s.y, mask });
  if (t.sel) { const sm = mkCanvas(D.w, D.h), sg = cx(sm); sg.setTransform(m); sg.drawImage(t.sel.mask, 0, 0); D.sel = makeSel(sm); }
  commit('Free Transform');
  emit('tool');
}
function cancelTransform() { if (!TRANSFORM.active) return; TRANSFORM.active = false; live = null; emit('tool'); dirty(true); }
function transformLayerQuick(kind) {
  // Flip / rotate the active layer (or selection) about its centre, committed immediately.
  startTransform(); if (!TRANSFORM.active) return;
  if (kind === 'flipH') TRANSFORM.sx = -1; else if (kind === 'flipV') TRANSFORM.sy = -1;
  else if (kind === 'cw') TRANSFORM.rot = Math.PI / 2; else if (kind === 'ccw') TRANSFORM.rot = -Math.PI / 2; else if (kind === '180') TRANSFORM.rot = Math.PI;
  commitTransform();
}
const TRANSFORM_TOOL = {
  id: 'transform', name: 'Free Transform',
  handleAt(p) {
    const cs = tfCorners().map((q) => toScreen(q.x, q.y)), s = toScreen(p.x, p.y);
    const mids = [0, 1, 2, 3].map((i) => ({ x: (cs[i].x + cs[(i + 1) % 4].x) / 2, y: (cs[i].y + cs[(i + 1) % 4].y) / 2 }));
    const H = [[cs[0], -1, -1], [mids[0], 0, -1], [cs[1], 1, -1], [mids[1], 1, 0], [cs[2], 1, 1], [mids[2], 0, 1], [cs[3], -1, 1], [mids[3], -1, 0]];
    for (const [q, hx, hy] of H) if (Math.hypot(q.x - s.x, q.y - s.y) < 9) return { hx, hy };
    // inside?
    let inside = false;
    for (let i = 0, j = 3; i < 4; j = i++) { const a = cs[i], b = cs[j]; if ((a.y > s.y) !== (b.y > s.y) && s.x < ((b.x - a.x) * (s.y - a.y)) / (b.y - a.y) + a.x) inside = !inside; }
    return inside ? { move: true } : { rotate: true };
  },
  down(p) { const t = TRANSFORM; t.drag = { h: this.handleAt(p), start: p, tx: t.tx, ty: t.ty, sx: t.sx, sy: t.sy, rot: t.rot, a0: Math.atan2(p.y - (t.cy + t.ty), p.x - (t.cx + t.tx)) }; },
  move(p, e) {
    const t = TRANSFORM, d = t.drag; if (!d) return;
    if (d.h.move) { t.tx = d.tx + p.x - d.start.x; t.ty = d.ty + p.y - d.start.y; }
    else if (d.h.rotate) { let a = d.rot + Math.atan2(p.y - (t.cy + t.ty), p.x - (t.cx + t.tx)) - d.a0; if (e.shiftKey) a = Math.round(a / (Math.PI / 12)) * (Math.PI / 12); t.rot = a; }
    else {
      const { hx, hy } = d.h, c = Math.cos(d.rot), s = Math.sin(d.rot);
      const Cx = t.cx + d.tx, Cy = t.cy + d.ty;
      // pointer in the box's local (unrotated) frame
      const lx = c * (p.x - Cx) + s * (p.y - Cy), ly = -s * (p.x - Cx) + c * (p.y - Cy);
      const hw = (t.w * d.sx) / 2, hh = (t.h * d.sy) / 2;
      let nsx = d.sx, nsy = d.sy, ncx = 0, ncy = 0;
      if (e.altKey) { if (hx) nsx = (lx * hx * 2) / t.w; if (hy) nsy = (ly * hy * 2) / t.h; }
      else {
        if (hx) { const ax = -hx * hw; nsx = ((lx - ax) * hx) / t.w; ncx = (ax + lx) / 2; }
        if (hy) { const ay = -hy * hh; nsy = ((ly - ay) * hy) / t.h; ncy = (ay + ly) / 2; }
      }
      if (e.shiftKey && hx && hy) {
        const k = Math.max(Math.abs(nsx / d.sx), Math.abs(nsy / d.sy));
        nsx = d.sx * k * Math.sign(nsx / d.sx || 1); nsy = d.sy * k * Math.sign(nsy / d.sy || 1);
        if (!e.altKey) { ncx = -hx * hw + (hx * t.w * nsx) / 2; ncy = -hy * hh + (hy * t.h * nsy) / 2; }
      }
      t.sx = Math.abs(nsx) < 0.002 ? 0.002 * Math.sign(nsx || 1) : nsx; t.sy = Math.abs(nsy) < 0.002 ? 0.002 * Math.sign(nsy || 1) : nsy;
      t.tx = d.tx + c * ncx - s * ncy; t.ty = d.ty + s * ncx + c * ncy;
    }
    dirty(true); emit('transform');
  },
  up() { TRANSFORM.drag = null; },
  hover(p) { const h = this.handleAt(p); V.el.style.cursor = h.move ? 'move' : h.rotate ? 'alias' : (h.hx * h.hy > 0 ? 'nwse-resize' : h.hx * h.hy < 0 ? 'nesw-resize' : h.hx ? 'ew-resize' : 'ns-resize'); },
  dblclick() { commitTransform(); },
  onKey(e) { if (e.key === 'Enter') { commitTransform(); return true; } if (e.key === 'Escape') { cancelTransform(); return true; } return false; },
  cancel() { TRANSFORM.drag = null; },
  overlay(g) {
    if (!TRANSFORM.active) return;
    const cs = tfCorners().map((q) => toScreen(q.x, q.y));
    g.strokeStyle = '#1e90ff'; g.lineWidth = 1; g.beginPath(); cs.forEach((q, i) => (i ? g.lineTo(q.x, q.y) : g.moveTo(q.x, q.y))); g.closePath(); g.stroke();
    const mids = [0, 1, 2, 3].map((i) => ({ x: (cs[i].x + cs[(i + 1) % 4].x) / 2, y: (cs[i].y + cs[(i + 1) % 4].y) / 2 }));
    for (const q of cs.concat(mids)) { g.fillStyle = '#fff'; g.fillRect(q.x - 4, q.y - 4, 8, 8); g.strokeRect(q.x - 4 + 0.5, q.y - 4 + 0.5, 7, 7); }
    const c = toScreen(TRANSFORM.cx + TRANSFORM.tx, TRANSFORM.cy + TRANSFORM.ty);
    g.beginPath(); g.arc(c.x, c.y, 4, 0, Math.PI * 2); g.stroke();
  },
};
