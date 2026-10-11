/* SlopCut: the compositor. Works out which clips are visible at time t (including both sides of a
   transition) and draws them bottom (V1) to top with fit, crop, position, scale, rotation, opacity,
   fades, colour grading and the transition effect. Used by the live preview and by export.
   An effect layer (clip kind 'effect', see core/fx-random.js) is a layer with `effect` set: it changes the frame
   drawn so far, so it affects the tracks below it. Keyframes (core/anim.js) are read here as layer.xf.
   render(ctx, p, t, { W, H, source(clip, srcT) }) — source returns a drawable or null. */
(function () {
  'use strict';
  const SE = window.SE, U = SE.util, M = SE.model;
  const CMP = SE.compositor = {};

  /** Transition window of a clip with trIn: [a, b) and its outgoing clip (or null). */
  CMP.trWindow = function (p, c) {
    if (!c.trIn) return null;
    const prev = M.prevAdjacent(p, c), d = c.trIn.dur;
    return prev ? { a: c.start - d / 2, b: c.start + d / 2, out: prev, inc: c, type: c.trIn.type } : { a: c.start, b: c.start + d, out: null, inc: c, type: c.trIn.type };
  };
  /** Visible layers bottom to top: [{ clip, srcT, u, alpha, xf, tr: { type, q, role } }] and effect layers
      [{ clip, effect, u, t }]. Effect layers come before the clips of their own track (they act on what is below). */
  CMP.layers = function (p, t) {
    const out = [];
    for (const tk of M.videoTracks(p)) {
      if (!M.trackLive(p, tk)) continue;
      const all = M.clipsOn(p, tk.id);
      const fxc = all.find((c) => c.kind === 'effect' && t >= c.start && t < M.end(c));
      if (fxc) {
        const st = SE.fx.stateAt(fxc.fx, t - fxc.start);
        if (st) out.push({ clip: fxc, effect: Object.assign(st, { t }), u: t - fxc.start });
      }
      const clips = all.filter((c) => c.kind !== 'audio' && c.kind !== 'effect');
      let win = null;
      for (const c of clips) { const w = CMP.trWindow(p, c); if (w && t >= w.a && t < w.b) { win = w; break; } }
      if (win) {
        const q = U.clamp((t - win.a) / (win.b - win.a), 0, 1);
        if (win.out) out.push(layer(p, win.out, t, { type: win.type, q, role: 'out' }));
        out.push(layer(p, win.inc, t, { type: win.type, q, role: 'in', solo: !win.out }));
        continue;
      }
      const c = clips.find((x) => t >= x.start && t < M.end(x));
      if (c) out.push(layer(p, c, t, null));
    }
    return out;
  };
  function layer(p, c, t, tr) {
    const len = M.srcLen(p, c);
    const srcT = U.clamp(M.srcAt(c, t), 0, isFinite(len) ? Math.max(0, len - 1e-3) : Infinity);
    const u = U.clamp(t - c.start, 0, c.dur), xf = SE.anim.combine(c, u);
    return { clip: c, srcT, u, alpha: xf.opacity * M.fadeAt(c, u), tr, xf };
  }
  /** Natural size of a layer's drawable (title/colour layers are frame-sized). */
  function sizeOf(src) {
    return { w: src.displayWidth || src.videoWidth || src.naturalWidth || src.width || 1, h: src.displayHeight || src.videoHeight || src.naturalHeight || src.height || 1 };
  }
  /** Draw one layer. k = output pixels per project pixel. */
  function drawLayer(g, p, L, src, W, H, k) {
    const c = L.clip, tr = L.tr, xf = L.xf;
    let alpha = L.alpha, dx = 0, clip = null, overlay = null, sc = 1, dy = 0;
    if (tr) {
      const q = tr.q;
      if (tr.type === 'cross') { if (tr.role === 'in') alpha *= q; }
      else if (tr.type === 'black' || tr.type === 'white') {
        const col = tr.type === 'black' ? '#000' : '#fff';
        if (tr.solo) overlay = { col, a: 1 - q };
        else if (tr.role === 'out') { if (q >= 0.5) return; overlay = { col, a: q * 2 }; }
        else { if (q < 0.5) return; overlay = { col, a: (1 - q) * 2 }; }
      } else if (tr.type === 'wipe') { if (tr.role === 'in') clip = [0, 0, W * q, H]; }
      else if (tr.type === 'slide') { if (tr.role === 'in') dx = (1 - easeIO(q)) * W; }
      else if (tr.type === 'push') dx = tr.role === 'in' ? (1 - easeIO(q)) * W : -easeIO(q) * W;
    }
    if (c.kind === 'title') { const a = SE.text.animAt(c, L.u); alpha *= a.alpha; dy = a.dy * H; sc = a.scale; L.blur = a.blur; }
    if (alpha <= 0.002 && !overlay) return;
    if (c.mask && !L.flat) { // masked clip: draw it alone, then keep only what the mask covers (mask-draw.js)
      const T = { x: W / 2 + xf.x * k + dx, y: H / 2 + xf.y * k + dy, rot: xf.rot, s: Math.max(1e-6, xf.scale * sc * k) };
      return SE.maskDraw.layer(g, W, H, (lg) => drawLayer(lg, p, Object.assign({}, L, { flat: true }), src, W, H, k), c.mask, T);
    }
    g.save();
    if (clip) { g.beginPath(); g.rect(clip[0], clip[1], clip[2], clip[3]); g.clip(); }
    if (src && alpha > 0.002) {
      const s = sizeOf(src), frame = c.kind === 'title' || c.kind === 'color';
      const base = frame ? 1 : Math.min(W / s.w, H / s.h);
      let img = src;
      if (SE.grade.needed(c) && c.kind !== 'color') {
        const gw = Math.min(s.w, s.w * base * xf.scale * 1.05), gh = gw * s.h / s.w;
        const graded = SE.grade.apply(src, gw, gh, c);
        if (graded) img = graded; else g.filter = SE.grade.filter(c);
      }
      if (L.blur) g.filter = 'blur(' + (L.blur * k).toFixed(1) + 'px)';
      g.globalAlpha = U.clamp(alpha, 0, 1);
      g.translate(W / 2 + xf.x * k + dx, H / 2 + xf.y * k + dy);
      if (xf.rot) g.rotate((xf.rot * Math.PI) / 180);
      g.scale(base * xf.scale * sc, base * xf.scale * sc);
      const iw = sizeOf(img).w / s.w; // graded copies may be smaller than the source
      const cl = c.cropL, ct = c.cropT, cw = Math.max(0, 1 - c.cropL - c.cropR), ch = Math.max(0, 1 - c.cropT - c.cropB);
      if (cw > 0 && ch > 0) {
        if (c.kind === 'color') { g.fillStyle = c.color; g.fillRect(-s.w / 2 + cl * s.w, -s.h / 2 + ct * s.h, cw * s.w, ch * s.h); }
        else g.drawImage(img, cl * s.w * iw, ct * s.h * iw, cw * s.w * iw, ch * s.h * iw, -s.w / 2 + cl * s.w, -s.h / 2 + ct * s.h, cw * s.w, ch * s.h);
      }
    }
    g.restore();
    if (overlay && overlay.a > 0) { g.save(); g.globalAlpha = U.clamp(overlay.a, 0, 1); g.fillStyle = overlay.col; g.fillRect(0, 0, W, H); g.restore(); }
  }
  const easeIO = (x) => (x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2);
  /** Colour matte drawable: a frame-sized stand-in (drawn with fillRect). */
  CMP.frameStub = (W, H) => ({ width: W, height: H });
  /** Draw a frame. opts: { W, H, source(clip, srcT, layer) → drawable|null, bg } */
  CMP.render = function (g, p, t, opts) {
    const W = opts.W, H = opts.H, k = W / p.w;
    g.save();
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.globalAlpha = 1; g.filter = 'none';
    g.fillStyle = p.bg || '#000'; g.fillRect(0, 0, W, H);
    const layers = CMP.layers(p, t);
    for (const L of layers) {
      if (L.effect) { SE.fxDraw.apply(g, W, H, L.effect); continue; }
      const c = L.clip;
      let src = null;
      if (c.kind === 'color') src = CMP.frameStub(W, H);
      else if (c.kind === 'title') src = SE.text.canvas(c, W, H, k, SE.text.animAt(c, L.u).chars);
      else src = opts.source(c, L.srcT, L);
      if (c.matteMedia && src && c.kind === 'video') { // a matte pair: colour × matte (matte-pair.js)
        const msrc = opts.source(SE.matteDraw.clipOf(c), L.srcT, L);
        if (msrc) { SE.matteDraw.layer(g, W, H, (lg) => drawLayer(lg, p, L, src, W, H, k), (lg) => drawLayer(lg, p, Object.assign({}, L, { alpha: 1, tr: null, blur: 0 }), msrc, W, H, k)); continue; }
      }
      drawLayer(g, p, L, src, W, H, k);
    }
    g.restore();
    return layers;
  };
  /** Project-space bounding box corners of a visual clip at its transform (for the overlay). With time t the
      keyframes at t are included; without it the clip's own values are used. */
  CMP.bounds = function (p, c, t) {
    let w = p.w, h = p.h;
    if (c.kind === 'title') { const m = SE.text.measure(c); w = m.w; h = m.h; } else if (c.media) { const m = M.media(p, c.media); if (m && m.w && m.h) { const b = Math.min(p.w / m.w, p.h / m.h); w = m.w * b; h = m.h * b; } }
    const xf = t == null ? { x: c.x, y: c.y, scale: c.scale, rot: c.rot } : SE.anim.combine(c, U.clamp(t - c.start, 0, c.dur));
    const s = xf.scale, r = (xf.rot * Math.PI) / 180, cos = Math.cos(r), sin = Math.sin(r);
    const x0 = -w / 2 + c.cropL * w, x1 = w / 2 - c.cropR * w, y0 = -h / 2 + c.cropT * h, y1 = h / 2 - c.cropB * h;
    return [[x0, y0], [x1, y0], [x1, y1], [x0, y1]].map(([x, y]) => [p.w / 2 + xf.x + (x * cos - y * sin) * s, p.h / 2 + xf.y + (x * sin + y * cos) * s]);
  };
})();
