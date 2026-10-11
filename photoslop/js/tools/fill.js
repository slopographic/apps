/* PhotoSLOP tools: gradient, bucket, type, shape and navigation tools */
'use strict';

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
