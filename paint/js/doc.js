/* Slop Shop: document model, history, compositing, selection.
 *
 * Every layer record and every canvas attached to one is treated as immutable
 * once it is in the document: edits make a new canvas and a new record. That
 * makes a history snapshot just a shallow copy of the layer list, and undo
 * shares unchanged pixels between states. */
'use strict';

const BLENDS = [
  // key, label, canvas composite op, PSD key
  ['normal', 'Normal', 'source-over', 'norm'],
  ['darken', 'Darken', 'darken', 'dark'],
  ['multiply', 'Multiply', 'multiply', 'mul '],
  ['color-burn', 'Color Burn', 'color-burn', 'idiv'],
  ['lighten', 'Lighten', 'lighten', 'lite'],
  ['screen', 'Screen', 'screen', 'scrn'],
  ['color-dodge', 'Color Dodge', 'color-dodge', 'div '],
  ['add', 'Linear Dodge (Add)', 'lighter', 'lddg'],
  ['overlay', 'Overlay', 'overlay', 'over'],
  ['soft-light', 'Soft Light', 'soft-light', 'sLit'],
  ['hard-light', 'Hard Light', 'hard-light', 'hLit'],
  ['difference', 'Difference', 'difference', 'diff'],
  ['exclusion', 'Exclusion', 'exclusion', 'smud'],
  ['hue', 'Hue', 'hue', 'hue '],
  ['saturation', 'Saturation', 'saturation', 'sat '],
  ['color', 'Color', 'color', 'colr'],
  ['luminosity', 'Luminosity', 'luminosity', 'lum '],
];
const BLEND_OP = Object.fromEntries(BLENDS.map((b) => [b[0], b[2]]));
const BLEND_PSD = Object.fromEntries(BLENDS.map((b) => [b[0], b[3]]));
const PSD_BLEND = Object.fromEntries(BLENDS.map((b) => [b[3], b[0]]));

const D = { w: 1200, h: 800, name: 'Untitled', layers: [], activeId: 0, sel: null, dirty: false, fileHandleName: null };
const Hist = { states: [], idx: -1 };
/** Live (uncommitted) edit shown in previews: brush strokes, filter previews, transforms. */
let live = null;
const listeners = new Set();
function emit(what) { for (const f of listeners) f(what); }

/* ---------- layers ---------- */
function newLayerRecord(props) {
  return Object.assign({ id: uid(), name: 'Layer', canvas: mkCanvas(D.w, D.h), x: 0, y: 0, visible: true, opacity: 1, blend: 'normal', locked: false, mask: null, text: null }, props);
}
const activeLayer = () => D.layers.find((l) => l.id === D.activeId) || D.layers[D.layers.length - 1];
const layerIndex = (id) => D.layers.findIndex((l) => l.id === id);
/** Replace a layer record (immutably) with a patched copy. */
function patchLayer(id, patch) {
  const i = layerIndex(id); if (i < 0) return null;
  const L = Object.assign({}, D.layers[i], patch);
  D.layers[i] = L;
  return L;
}
function nextName(base) {
  let n = 1; const names = new Set(D.layers.map((l) => l.name));
  while (names.has(`${base} ${n}`)) n++;
  return `${base} ${n}`;
}
/** A copy of the layer whose canvas covers at least the whole document (painting may go anywhere on the page). */
function coverDoc(L) {
  const x0 = Math.min(L.x, 0), y0 = Math.min(L.y, 0);
  const x1 = Math.max(L.x + L.canvas.width, D.w), y1 = Math.max(L.y + L.canvas.height, D.h);
  if (x0 === L.x && y0 === L.y && x1 === L.x + L.canvas.width && y1 === L.y + L.canvas.height) return L;
  const c = mkCanvas(x1 - x0, y1 - y0);
  cx(c).drawImage(L.canvas, L.x - x0, L.y - y0);
  let mask = L.mask;
  if (mask) {
    const m = mkCanvas(c.width, c.height), g = cx(m);
    if (mask.def) { g.fillStyle = '#000'; g.fillRect(0, 0, m.width, m.height); g.clearRect(mask.x - x0, mask.y - y0, mask.canvas.width, mask.canvas.height); }
    g.drawImage(mask.canvas, mask.x - x0, mask.y - y0);
    mask = Object.assign({}, mask, { canvas: m, x: x0, y: y0 });
  }
  return patchLayer(L.id, { canvas: c, x: x0, y: y0, mask });
}

/* ---------- history ---------- */
function snapshot(label) { return { label, w: D.w, h: D.h, layers: D.layers.slice(), activeId: D.activeId, sel: D.sel }; }
function restore(s) {
  D.w = s.w; D.h = s.h; D.layers = s.layers.slice(); D.activeId = s.activeId; D.sel = s.sel;
  live = null; emit('doc');
}
function histReset(label) { Hist.states = [snapshot(label)]; Hist.idx = 0; D.dirty = false; emit('history'); emit('doc'); }
function commit(label) {
  Hist.states.length = Hist.idx + 1;
  Hist.states.push(snapshot(label));
  Hist.idx++;
  trimHistory();
  D.dirty = true;
  emit('history'); emit('doc');
}
function trimHistory() {
  const MAX_STATES = 60, MAX_BYTES = 900e6;
  while (Hist.states.length > MAX_STATES) { Hist.states.shift(); Hist.idx--; }
  for (;;) {
    const seen = new Set(); let bytes = 0;
    for (const s of Hist.states) for (const L of s.layers) for (const c of [L.canvas, L.mask && L.mask.canvas]) if (c && !seen.has(c)) { seen.add(c); bytes += c.width * c.height * 4; }
    if (bytes <= MAX_BYTES || Hist.idx < 2) break;
    Hist.states.shift(); Hist.idx--;
  }
}
function undo() { if (Hist.idx > 0) { Hist.idx--; restore(Hist.states[Hist.idx]); D.dirty = true; emit('history'); } }
function redo() { if (Hist.idx < Hist.states.length - 1) { Hist.idx++; restore(Hist.states[Hist.idx]); D.dirty = true; emit('history'); } }
function jumpHistory(i) { if (i >= 0 && i < Hist.states.length) { Hist.idx = i; restore(Hist.states[i]); emit('history'); } }

/* ---------- compositing ---------- */
const scratch = { a: null, b: null };
function scratchCanvas(key, w, hh) {
  let c = scratch[key];
  if (!c || c.width < w || c.height < hh) { c = scratch[key] = mkCanvas(Math.max(w, c ? c.width : 0), Math.max(hh, c ? c.height : 0)); }
  const g = cx(c); g.setTransform(1, 0, 0, 1, 0, 0); g.globalAlpha = 1; g.globalCompositeOperation = 'source-over'; g.clearRect(0, 0, w, hh);
  return c;
}
/** A mask ({canvas,x,y,def}) as an alpha canvas aligned to a w×h surface at (ox,oy). */
const maskCache = new WeakMap();
function alignedMask(mask, w, hh, ox, oy, cacheable) {
  if (cacheable && maskCache.has(mask)) { const e = maskCache.get(mask); if (e.w === w && e.h === hh && e.x === ox && e.y === oy) return e.c; }
  const c = mkCanvas(w, hh), g = cx(c);
  if (mask.def) { g.fillStyle = '#000'; g.fillRect(0, 0, w, hh); g.clearRect(mask.x - ox, mask.y - oy, mask.canvas.width, mask.canvas.height); }
  g.drawImage(mask.canvas, mask.x - ox, mask.y - oy);
  if (cacheable) maskCache.set(mask, { c, w, h: hh, x: ox, y: oy });
  return c;
}
/** The pixels a layer contributes: its canvas, plus any live edit, with its mask applied. */
function layerSurface(L) {
  let src = L.canvas, sx = L.x, sy = L.y, w = src.width, hh = src.height;
  const lv = live && live.layerId === L.id ? live : null;
  if (lv && lv.surface) { const s = lv.surface(L); if (s) { src = s.canvas; sx = s.x; sy = s.y; w = s.w || src.width; hh = s.h || src.height; } }
  if (!L.mask || L.mask.enabled === false) return { canvas: src, x: sx, y: sy, w, h: hh };
  const liveMask = lv && lv.maskSurface ? lv.maskSurface(L) : null;
  const m = alignedMask(liveMask || L.mask, w, hh, sx, sy, !liveMask && src === L.canvas);
  const tmp = scratchCanvas('a', w, hh), g = cx(tmp);
  g.drawImage(src, 0, 0, w, hh, 0, 0, w, hh);
  g.globalCompositeOperation = 'destination-in';
  g.drawImage(m, 0, 0);
  g.globalCompositeOperation = 'source-over';
  return { canvas: tmp, x: sx, y: sy, w, h: hh };
}
/** Composite visible layers (bottom→top) onto ctx in document space. */
function compositeInto(g, opts = {}) {
  for (const L of D.layers) {
    if (!L.visible && !(opts.includeHidden)) continue;
    if (opts.only && !opts.only.includes(L)) continue;
    const s = layerSurface(L);
    g.globalAlpha = L.opacity;
    g.globalCompositeOperation = BLEND_OP[L.blend] || 'source-over';
    g.drawImage(s.canvas, 0, 0, s.w, s.h, s.x, s.y, s.w, s.h);
  }
  g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
  if (live && live.overlayDoc) live.overlayDoc(g);
}
function flattenCanvas(bg) {
  const c = mkCanvas(D.w, D.h), g = cx(c);
  if (bg) { g.fillStyle = bg; g.fillRect(0, 0, D.w, D.h); }
  const keep = live; live = null; compositeInto(g); live = keep;
  return c;
}
/** A layer's pixels baked with its mask, in document space (for merge/export). */
function bakedLayer(L) {
  const keep = live; live = null;
  const s = layerSurface(L); live = keep;
  const c = mkCanvas(s.w, s.h);
  cx(c).drawImage(s.canvas, 0, 0, s.w, s.h, 0, 0, s.w, s.h);
  return { canvas: c, x: s.x, y: s.y };
}

/* ---------- selection (alpha mask, document sized) ---------- */
function makeSel(maskCanvas) {
  const b = alphaBounds(maskCanvas);
  return b ? { mask: maskCanvas, bounds: b, ver: uid() } : null;
}
/** mode: replace | add | sub | int. draw(g) paints the new shape in opaque black. */
function selectShape(draw, mode = 'replace', feather = 0) {
  const shape = mkCanvas(D.w, D.h), sg = cx(shape);
  sg.fillStyle = '#000'; draw(sg);
  if (feather > 0) blurAlphaCanvas(shape, feather);
  let out;
  if (!D.sel) out = mode === 'replace' || mode === 'add' ? shape : null;
  else if (mode === 'replace') out = shape;
  else {
    out = copyCanvas(D.sel.mask); const g = cx(out);
    g.globalCompositeOperation = mode === 'add' ? 'source-over' : mode === 'sub' ? 'destination-out' : 'destination-in';
    g.drawImage(shape, 0, 0);
  }
  D.sel = out ? makeSel(out) : null;
}
function selectAll() { selectShape((g) => g.fillRect(0, 0, D.w, D.h)); commit('Select All'); }
function deselect() { if (!D.sel) return; D.sel = null; commit('Deselect'); }
function selectInverse() {
  const c = mkCanvas(D.w, D.h), g = cx(c);
  g.fillStyle = '#000'; g.fillRect(0, 0, D.w, D.h);
  if (D.sel) { g.globalCompositeOperation = 'destination-out'; g.drawImage(D.sel.mask, 0, 0); }
  D.sel = makeSel(c); commit('Select Inverse');
}
function featherSel(r) {
  if (!D.sel || r <= 0) return;
  const c = copyCanvas(D.sel.mask); blurAlphaCanvas(c, r);
  D.sel = makeSel(c); commit('Feather');
}
/** Grow (+) or shrink (−) the selection by r pixels. */
function growSel(r) {
  if (!D.sel || !r) return;
  const c = copyCanvas(D.sel.mask); blurAlphaCanvas(c, Math.abs(r) * 1.4);
  const g = cxr(c), img = g.getImageData(0, 0, c.width, c.height), d = img.data;
  const t = r > 0 ? 18 : 236;
  for (let i = 3; i < d.length; i += 4) d[i] = d[i] >= t ? 255 : 0;
  g.putImageData(img, 0, 0);
  D.sel = makeSel(c); commit(r > 0 ? 'Expand' : 'Contract');
}
/** Selection mask placed in layer space (layer canvas sized). */
function selInLayer(L, sel = D.sel) {
  const c = mkCanvas(L.canvas.width, L.canvas.height);
  cx(c).drawImage(sel.mask, -L.x, -L.y);
  return c;
}
/** out = orig·(1−s) + proc·s, all in layer space. */
function mixBySel(orig, proc, selLayer) {
  const out = copyCanvas(orig), g = cx(out);
  g.globalCompositeOperation = 'destination-out'; g.drawImage(selLayer, 0, 0);
  const t = copyCanvas(proc), tg = cx(t);
  tg.globalCompositeOperation = 'destination-in'; tg.drawImage(selLayer, 0, 0);
  g.globalCompositeOperation = 'lighter'; g.drawImage(t, 0, 0);
  return out;
}

/* ---------- document ops ---------- */
function newDocument(w, hh, bg = '#ffffff', name = 'Untitled') {
  D.w = w; D.h = hh; D.name = name; D.sel = null; live = null;
  const L = newLayerRecord({ name: 'Background' });
  if (bg && bg !== 'transparent') { const g = cx(L.canvas); g.fillStyle = bg; g.fillRect(0, 0, w, hh); }
  D.layers = [L]; D.activeId = L.id;
  histReset('New');
}
function addLayer(props = {}, label = 'New Layer', above = true) {
  const L = newLayerRecord(Object.assign({ name: nextName('Layer') }, props));
  const i = layerIndex(D.activeId);
  D.layers.splice(above && i >= 0 ? i + 1 : D.layers.length, 0, L);
  D.activeId = L.id;
  commit(label);
  return L;
}
function deleteLayer(id = D.activeId) {
  if (D.layers.length <= 1) { toast('A document needs at least one layer'); return; }
  const i = layerIndex(id); if (i < 0) return;
  D.layers.splice(i, 1);
  D.activeId = D.layers[Math.max(0, i - 1)].id;
  commit('Delete Layer');
}
function duplicateLayer(id = D.activeId) {
  const i = layerIndex(id); if (i < 0) return;
  const S = D.layers[i];
  const L = Object.assign({}, S, { id: uid(), name: S.name + ' copy', canvas: copyCanvas(S.canvas), mask: S.mask && Object.assign({}, S.mask, { canvas: copyCanvas(S.mask.canvas) }), text: S.text && Object.assign({}, S.text) });
  D.layers.splice(i + 1, 0, L); D.activeId = L.id;
  commit('Duplicate Layer');
}
function moveLayer(id, toIndex) {
  const i = layerIndex(id); if (i < 0) return;
  toIndex = clamp(toIndex, 0, D.layers.length - 1);
  if (toIndex === i) return;
  const [L] = D.layers.splice(i, 1);
  D.layers.splice(toIndex, 0, L);
  commit('Move Layer');
}
function mergeLayers(list, name, label) {
  if (list.length < 1) return;
  const bottomIdx = layerIndex(list[0].id);
  const c = mkCanvas(D.w, D.h), g = cx(c);
  // Respect the bottom layer's own opacity/blend by compositing everything with their settings.
  for (const L of list) {
    if (!L.visible) continue;
    const s = bakedLayer(L);
    g.globalAlpha = L.opacity; g.globalCompositeOperation = BLEND_OP[L.blend] || 'source-over';
    g.drawImage(s.canvas, s.x, s.y);
  }
  g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
  const M = newLayerRecord({ name: name || list[0].name, canvas: c });
  D.layers = D.layers.filter((l) => !list.includes(l));
  D.layers.splice(Math.min(bottomIdx, D.layers.length), 0, M);
  D.activeId = M.id;
  commit(label);
}
function mergeDown() {
  const i = layerIndex(D.activeId);
  if (i <= 0) { toast('There is no layer below to merge into'); return; }
  const below = D.layers[i - 1], top = D.layers[i];
  if (!top.visible) { toast('Show the layer before merging it'); return; }
  mergeLayers([below, top], below.name, 'Merge Down');
}
function mergeVisible() { const v = D.layers.filter((l) => l.visible); if (v.length) mergeLayers(v, v[0].name, 'Merge Visible'); }
function flattenImage() {
  const c = flattenCanvas('#ffffff');
  const L = newLayerRecord({ name: 'Background', canvas: c });
  D.layers = [L]; D.activeId = L.id;
  commit('Flatten Image');
}
function setLayerProps(id, patch, label) {
  const L = patchLayer(id, patch);
  if (label) commit(label); else emit('doc');
  return L;
}

/** Apply a pixel function to the active layer (respecting selection). fn(canvas) → new canvas in same layer space. */
function applyToLayer(label, fn, L = activeLayer()) {
  if (!L) return;
  if (L.locked) { toast('That layer is locked'); return; }
  if (L.text) L = rasterizeText(L, true);
  const proc = fn(L.canvas, L);
  if (!proc) return;
  const out = D.sel ? mixBySel(L.canvas, proc, selInLayer(L)) : proc;
  patchLayer(L.id, { canvas: out });
  commit(label);
}
function rasterizeText(L, quiet) { const R = patchLayer(L.id, { text: null }); if (!quiet) commit('Rasterize Type'); return R; }

/** Resize/crop the canvas. dx,dy = where the old (0,0) lands. */
function resizeCanvas(w, hh, dx, dy, label = 'Canvas Size') {
  D.layers = D.layers.map((L) => Object.assign({}, L, { x: L.x + dx, y: L.y + dy, mask: L.mask && Object.assign({}, L.mask, { x: L.mask.x + dx, y: L.mask.y + dy }), text: L.text && Object.assign({}, L.text, { x: L.text.x + dx, y: L.text.y + dy }) }));
  D.w = Math.round(w); D.h = Math.round(hh);
  D.sel = null;
  commit(label);
}
function resampleCanvas(c, w, hh) {
  // Step down in halves for smooth downscaling.
  let src = c;
  while (src.width / 2 >= w && src.height / 2 >= hh && src.width > 2) {
    const t = mkCanvas(src.width / 2, src.height / 2), g = cx(t); g.imageSmoothingQuality = 'high'; g.drawImage(src, 0, 0, t.width, t.height); src = t;
  }
  const out = mkCanvas(w, hh), g = cx(out); g.imageSmoothingQuality = 'high'; g.drawImage(src, 0, 0, w, hh);
  return out;
}
function imageSize(w, hh, smooth = true) {
  const sx = w / D.w, sy = hh / D.h;
  D.layers = D.layers.map((L) => {
    const nw = Math.max(1, Math.round(L.canvas.width * sx)), nh = Math.max(1, Math.round(L.canvas.height * sy));
    let c;
    if (smooth) c = resampleCanvas(L.canvas, nw, nh); else { c = mkCanvas(nw, nh); const g = cx(c); g.imageSmoothingEnabled = false; g.drawImage(L.canvas, 0, 0, nw, nh); }
    let mask = L.mask;
    if (mask) mask = Object.assign({}, mask, { canvas: resampleCanvas(mask.canvas, Math.max(1, Math.round(mask.canvas.width * sx)), Math.max(1, Math.round(mask.canvas.height * sy))), x: Math.round(mask.x * sx), y: Math.round(mask.y * sy) });
    return Object.assign({}, L, { canvas: c, x: Math.round(L.x * sx), y: Math.round(L.y * sy), mask, text: L.text && Object.assign({}, L.text, { x: L.text.x * sx, y: L.text.y * sy, size: L.text.size * Math.sqrt(sx * sy) }) });
  });
  D.w = Math.round(w); D.h = Math.round(hh); D.sel = null;
  commit('Image Size');
}
/** Transform every layer: kind = cw | ccw | 180 | flipH | flipV. */
function transformCanvas(kind) {
  const ow = D.w, oh = D.h, swap = kind === 'cw' || kind === 'ccw';
  const tf = (c, x, y) => {
    const w = c.width, hh = c.height;
    const out = mkCanvas(swap ? hh : w, swap ? w : hh), g = cx(out);
    let nx, ny;
    if (kind === 'cw') { g.translate(hh, 0); g.rotate(Math.PI / 2); nx = oh - (y + hh); ny = x; }
    else if (kind === 'ccw') { g.translate(0, w); g.rotate(-Math.PI / 2); nx = y; ny = ow - (x + w); }
    else if (kind === '180') { g.translate(w, hh); g.rotate(Math.PI); nx = ow - (x + w); ny = oh - (y + hh); }
    else if (kind === 'flipH') { g.translate(w, 0); g.scale(-1, 1); nx = ow - (x + w); ny = y; }
    else { g.translate(0, hh); g.scale(1, -1); nx = x; ny = oh - (y + hh); }
    g.drawImage(c, 0, 0);
    return { c: out, x: nx, y: ny };
  };
  D.layers = D.layers.map((L) => {
    const r = tf(L.canvas, L.x, L.y);
    let mask = L.mask;
    if (mask) { const m = tf(mask.canvas, mask.x, mask.y); mask = Object.assign({}, mask, { canvas: m.c, x: m.x, y: m.y }); }
    return Object.assign({}, L, { canvas: r.c, x: r.x, y: r.y, mask, text: null });
  });
  if (swap) { D.w = oh; D.h = ow; }
  D.sel = null;
  commit({ cw: 'Rotate 90° CW', ccw: 'Rotate 90° CCW', 180: 'Rotate 180°', flipH: 'Flip Canvas Horizontal', flipV: 'Flip Canvas Vertical' }[kind]);
}
/** Trim the document to the selection bounds (or a given rect). */
function cropTo(r, deletePixels = true) {
  r = { x: Math.round(r.x), y: Math.round(r.y), w: Math.max(1, Math.round(r.w)), h: Math.max(1, Math.round(r.h)) };
  if (deletePixels) {
    D.layers = D.layers.map((L) => {
      const c = mkCanvas(r.w, r.h); cx(c).drawImage(L.canvas, L.x - r.x, L.y - r.y);
      let mask = L.mask;
      if (mask) { const m = mkCanvas(r.w, r.h), g = cx(m); if (mask.def) { g.fillStyle = '#000'; g.fillRect(0, 0, r.w, r.h); g.clearRect(mask.x - r.x, mask.y - r.y, mask.canvas.width, mask.canvas.height); } g.drawImage(mask.canvas, mask.x - r.x, mask.y - r.y); mask = Object.assign({}, mask, { canvas: m, x: 0, y: 0 }); }
      return Object.assign({}, L, { canvas: c, x: 0, y: 0, mask, text: L.text && Object.assign({}, L.text, { x: L.text.x - r.x, y: L.text.y - r.y }) });
    });
    D.w = r.w; D.h = r.h; D.sel = null;
    commit('Crop');
  } else resizeCanvas(r.w, r.h, -r.x, -r.y, 'Crop');
}

/* ---------- selection → layer ops ---------- */
function copySelectionPixels(merged) {
  const r = D.sel ? D.sel.bounds : { x: 0, y: 0, w: D.w, h: D.h };
  const c = mkCanvas(r.w, r.h), g = cx(c);
  if (merged) { g.drawImage(flattenCanvas(), -r.x, -r.y); }
  else { const L = activeLayer(); const s = bakedLayer(L); g.drawImage(s.canvas, s.x - r.x, s.y - r.y); }
  if (D.sel) { g.globalCompositeOperation = 'destination-in'; g.drawImage(D.sel.mask, -r.x, -r.y); }
  return { canvas: c, x: r.x, y: r.y };
}
function clearSelectionPixels(label = 'Clear') {
  const L = activeLayer(); if (!L || !D.sel) return;
  if (L.locked) { toast('That layer is locked'); return; }
  const c = copyCanvas(L.canvas), g = cx(c);
  g.globalCompositeOperation = 'destination-out'; g.drawImage(D.sel.mask, -L.x, -L.y);
  patchLayer(L.id, { canvas: c, text: null });
  commit(label);
}
function fillSelection(color, label = 'Fill', opacity = 1, blend = 'normal', ignoreSel = false) {
  const L0 = activeLayer(); if (!L0) return;
  if (L0.locked) { toast('That layer is locked'); return; }
  const L = coverDoc(L0.text ? rasterizeText(L0, true) : L0);
  const c = copyCanvas(L.canvas), g = cx(c);
  const f = mkCanvas(D.w, D.h), fg = cx(f);
  if (color instanceof HTMLCanvasElement) fg.drawImage(color, 0, 0); else { fg.fillStyle = color; fg.fillRect(0, 0, D.w, D.h); }
  if (D.sel && !ignoreSel) { fg.globalCompositeOperation = 'destination-in'; fg.drawImage(D.sel.mask, 0, 0); }
  g.globalAlpha = opacity; g.globalCompositeOperation = BLEND_OP[blend] || 'source-over';
  g.drawImage(f, -L.x, -L.y);
  patchLayer(L.id, { canvas: c });
  commit(label);
}
