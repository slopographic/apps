/* SlopIsolate — the preview canvas. Screen = image * scale + offset (CSS px, relative to #stage).
 * Views: result (composed picture over a checkerboard), before (original), split (original left of the
 * knob, result right; S.split is the knob's fraction of the stage width) and mask. Composed pictures are
 * cached per (act.rev, look), so pan and zoom never re-compose. */
(function () {
  'use strict';
  const CO = window.CO, U = CO.util, S = CO.state, C = CO.compose, P = CO.process;
  const V = CO.view = {};
  const MIN = 0.02, MAX = 40, PAD = 24;
  const T = { scale: 1, ox: 0, oy: 0 };
  let cv = null, cx = null, dpr = 1, fitted = null, frame = 0, checker = null;
  const memo = new Map();     // kind -> { act, key, canvas }
  const mips = new WeakMap(); // source canvas -> [half-size levels]
  const $ = U.$;

  const stageSize = () => { const st = $('#stage'); return { w: st ? st.clientWidth : 0, h: st ? st.clientHeight : 0 }; };
  /** Visible rectangle in image px: the crop box in the result view, else the whole image. */
  const rectOf = (act) => (S.view === 'result' ? C.boxOf(act.item, act) : { x: 0, y: 0, w: act.w, h: act.h });

  /** Reuse the last composed canvas of a kind while its act and key are unchanged. */
  function cached(kind, act, key, make) {
    const m = memo.get(kind);
    if (m && m.act === act && m.key === key) return m.canvas;
    const canvas = make();
    memo.set(kind, { act, key, canvas });
    return canvas;
  }
  /** Half-size levels of a source, so zoomed-out drawing samples fewer pixels. */
  function level(src, n) {
    if (n <= 0) return src;
    let lv = mips.get(src);
    if (!lv) mips.set(src, (lv = []));
    if (!lv[n]) {
      const prev = level(src, n - 1), c = U.canvas(prev.width / 2, prev.height / 2), g = U.ctx(c);
      g.imageSmoothingQuality = 'high';
      g.drawImage(prev, 0, 0, c.width, c.height);
      lv[n] = c;
    }
    return lv[n];
  }
  /** Draw a source covering the image rect (x, y, w, h) in image px. */
  function put(src, x, y, w, h) {
    const k = dpr * T.scale * w / src.width; // device px per source px
    const n = k < 1 ? Math.min(6, Math.floor(Math.log2(1 / k))) : 0;
    cx.drawImage(level(src, n), T.ox + x * T.scale, T.oy + y * T.scale, w * T.scale, h * T.scale);
  }
  function checkerboard() {
    if (!checker) {
      const c = U.canvas(16, 16), g = U.ctx(c);
      g.fillStyle = '#c9c9cf'; g.fillRect(0, 0, 16, 16);
      g.fillStyle = '#ffffff'; g.fillRect(0, 0, 8, 8); g.fillRect(8, 8, 8, 8);
      checker = cx.createPattern(c, 'repeat');
    }
    return checker;
  }
  function drawResult(act) {
    const it = act.item, b = C.boxOf(it, act);
    const c = cached('result', act, act.rev + '|' + JSON.stringify(S.lookOf(it)), () => C.render(it, act));
    if (it.bg.mode === 'transparent') {
      cx.fillStyle = checkerboard();
      cx.fillRect(T.ox + b.x * T.scale, T.oy + b.y * T.scale, b.w * T.scale, b.h * T.scale);
    }
    put(c, b.x, b.y, b.w, b.h);
  }
  /** Brush tools: the removed part is tinted so the matte can be seen on the picture while painting. */
  function drawTint(act) {
    const c = cached('tint', act, act.rev, () => {
      const t = U.canvas(act.w, act.h), g = t.getContext('2d'), img = g.createImageData(act.w, act.h), d = img.data, m = act.mask;
      for (let i = 0, n = act.w * act.h; i < n; i++) { d[i * 4] = 255; d[i * 4 + 1] = 40; d[i * 4 + 2] = 120; d[i * 4 + 3] = Math.round((255 - m[i]) * 0.5); }
      g.putImageData(img, 0, 0);
      return t;
    });
    put(c, 0, 0, act.w, act.h);
  }
  function drawMask(act) {
    const it = act.item, b = C.boxOf(it, act);
    put(cached('mask', act, act.rev + '|' + JSON.stringify(it.crop), () => C.maskCanvas(it, act)), b.x, b.y, b.w, b.h);
  }

  /** Centre the visible rect in the stage. */
  function place(act, sz) {
    const r = rectOf(act), k = Math.min(Math.max(1, sz.w - 2 * PAD) / r.w, Math.max(1, sz.h - 2 * PAD) / r.h);
    T.scale = U.clamp(k, MIN, MAX);
    T.ox = (sz.w - r.w * T.scale) / 2 - r.x * T.scale;
    T.oy = (sz.h - r.h * T.scale) / 2 - r.y * T.scale;
  }
  function zoomText() {
    const t = V.zoomPct() + '%';
    document.querySelectorAll('.tb-zoom, #statusZoom').forEach((el) => { el.textContent = t; });
  }
  function placeSplit(show, x) {
    const el = $('#split');
    if (!el) return;
    el.hidden = !show;
    if (show) el.style.left = x + 'px';
  }

  /* ---------- public API ---------- */
  V.init = function () {
    cv = $('#view');
    if (!cv) return;
    cx = U.ctx(cv);
    const schedule = () => { if (!frame) frame = requestAnimationFrame(() => { frame = 0; V.draw(); }); };
    if (window.ResizeObserver && $('#stage')) new ResizeObserver(schedule).observe($('#stage'));
    else window.addEventListener('resize', schedule);
    for (const t of ['active', 'activeItem', 'look', 'view', 'history', 'list', 'tool']) CO.on(t, schedule);
    CO.on('item', (it) => { if (P.active && P.active.item === it) schedule(); });
    V.draw();
  };

  /** Paint the canvas for the current active record and view. Cheap when nothing changed. */
  V.draw = function () {
    if (!cx) return;
    const act = P.active, sz = stageSize(), app = $('#app');
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    const W = Math.max(1, Math.round(sz.w * dpr)), H = Math.max(1, Math.round(sz.h * dpr));
    if (cv.width !== W || cv.height !== H) { cv.width = W; cv.height = H; }
    cx.setTransform(dpr, 0, 0, dpr, 0, 0);
    cx.clearRect(0, 0, sz.w, sz.h);
    cx.imageSmoothingEnabled = true;
    cx.imageSmoothingQuality = 'high';
    if (app) app.dataset.mode = act || S.items.length ? 'work' : 'empty';
    zoomText();
    if (!act) { placeSplit(false); return; }
    if (act !== fitted && sz.w > 2 && sz.h > 2) { fitted = act; place(act, sz); }
    if (S.view === 'split') {
      const sx = Math.round(U.clamp(S.split, 0, 1) * sz.w);
      cx.save(); cx.beginPath(); cx.rect(0, 0, sx, sz.h); cx.clip();
      put(act.bitmap, 0, 0, act.w, act.h);
      cx.restore();
      cx.save(); cx.beginPath(); cx.rect(sx, 0, sz.w - sx, sz.h); cx.clip();
      drawResult(act);
      cx.restore();
      placeSplit(true, sx);
    } else {
      if (S.view === 'before') put(act.bitmap, 0, 0, act.w, act.h);
      else if (S.view === 'mask') drawMask(act);
      else { drawResult(act); if (S.tool === 'keep' || S.tool === 'remove') drawTint(act); }
      placeSplit(false);
    }
  };

  /** Fit the visible picture into the stage. */
  V.fit = function () {
    const act = P.active, sz = stageSize();
    if (!act || sz.w < 3 || sz.h < 3) return;
    fitted = act;
    place(act, sz);
    V.draw();
  };
  V.geom = () => ({ scale: T.scale, ox: T.ox, oy: T.oy });
  /** Stage CSS px (relative to #stage) to image px. */
  V.toImage = (sx, sy) => ({ x: (sx - T.ox) / T.scale, y: (sy - T.oy) / T.scale });
  /** Zoom by factor keeping the point (sx, sy) in place. */
  V.zoomAt = function (f, sx, sy) {
    const s = U.clamp(T.scale * f, MIN, MAX), k = s / T.scale;
    T.ox = sx - (sx - T.ox) * k;
    T.oy = sy - (sy - T.oy) * k;
    T.scale = s;
    V.draw();
  };
  V.panBy = function (dx, dy) { T.ox += dx; T.oy += dy; V.draw(); };
  V.zoomPct = () => Math.round(T.scale * 100);
})();
