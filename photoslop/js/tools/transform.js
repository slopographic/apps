/* PhotoSLOP tools: free transform */
'use strict';

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
    if (d.h.move) {
      const cs = tfCorners(), dx0 = t.tx - d.tx, dy0 = t.ty - d.ty, xs = cs.map((q) => q.x - dx0), ys = cs.map((q) => q.y - dy0);
      const box = { x: Math.min(...xs), y: Math.min(...ys), w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys) };
      const sn = snapDelta(box, p.x - d.start.x, p.y - d.start.y);
      t.tx = d.tx + sn.dx; t.ty = d.ty + sn.dy;
    }
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
