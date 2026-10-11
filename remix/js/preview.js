/* Reel Remix: the preview player. Draws the plan at a time t on a canvas: each cut shows its clip in the slot
   region of the layout active at its start (R.regionFor), letterboxed inside the region. Stills and videos are
   the bin items' own elements; videos are seeked to the cut's in point. Play runs the playhead with
   requestAnimationFrame; there is no sound in the preview. */
(function () {
  'use strict';
  const RM = window.RM, SV = window.SlopVideo, R = SV.random;
  const PV = (RM.preview = { canvas: null, ctx: null, t: 0, playing: false, raf: 0, last: 0, items: [] });

  PV.attach = function (canvas) { PV.canvas = canvas; PV.ctx = canvas.getContext('2d'); };
  /** The plan's cut items, flat, with their media element. */
  PV.flat = function (plan) {
    const byId = new Map(RM.state.items.map((m) => [m.id, m]));
    return plan ? plan.cuts.flat().map((it) => Object.assign({}, it, { m: byId.get(it.media) })).filter((it) => it.m) : [];
  };
  PV.total = () => (RM.state.plan ? RM.state.plan.total : 0);
  /** Size the canvas to the preset frame (its width capped for speed). */
  PV.resize = function () {
    const sz = RM.size(), k = Math.min(1, 960 / sz.w);
    PV.canvas.width = Math.round(sz.w * k); PV.canvas.height = Math.round(sz.h * k);
  };
  /** Draw the plan at time t. */
  PV.draw = function (t) {
    const c = PV.ctx, W = PV.canvas.width, H = PV.canvas.height, plan = RM.state.plan;
    PV.t = Math.max(0, Math.min(t, PV.total()));
    c.fillStyle = '#000'; c.fillRect(0, 0, W, H);
    if (!plan) return;
    for (const it of PV.items) {
      if (!(PV.t >= it.start && PV.t < it.start + it.dur)) { if (it.m.kind === 'video') it.m.el.pause(); continue; }
      const reg = R.regionFor(plan, it);
      if (!reg) continue;
      const box = { x: reg.x * W, y: reg.y * H, w: reg.w * W, h: reg.h * H };
      drawMedia(it, box);
    }
  };
  /** Fit one media element into a box (contain), seeking videos to the cut's in point. */
  function drawMedia(it, box) {
    const el = it.m.el, c = PV.ctx;
    const nw = it.m.kind === 'video' ? el.videoWidth : el.naturalWidth, nh = it.m.kind === 'video' ? el.videoHeight : el.naturalHeight;
    if (!nw || !nh) return;
    if (it.m.kind === 'video') {
      const want = it.in + (PV.t - it.start);
      if (Math.abs(el.currentTime - want) > 0.25 && el.readyState >= 1) el.currentTime = want;
      if (el.readyState < 2) return;
    }
    const k = Math.min(box.w / nw, box.h / nh), dw = nw * k, dh = nh * k;
    c.drawImage(el, box.x + (box.w - dw) / 2, box.y + (box.h - dh) / 2, dw, dh);
  }
  /** Re-read the plan into the item list (call after each Remix). */
  PV.setPlan = function () { PV.items = PV.flat(RM.state.plan); PV.resize(); PV.draw(Math.min(PV.t, PV.total())); };
  PV.seek = (t) => { PV.draw(t); if (PV.onTick) PV.onTick(PV.t); };
  PV.play = function () {
    if (PV.playing) return;
    if (PV.t >= PV.total() - 0.01) PV.t = 0;
    PV.playing = true; PV.last = performance.now();
    const step = (now) => {
      if (!PV.playing) return;
      PV.t += (now - PV.last) / 1000; PV.last = now;
      if (PV.t >= PV.total()) { PV.t = PV.total(); PV.pause(); }
      PV.draw(PV.t);
      if (PV.onTick) PV.onTick(PV.t);
      if (PV.playing) PV.raf = requestAnimationFrame(step);
    };
    PV.raf = requestAnimationFrame(step);
  };
  PV.pause = function () {
    PV.playing = false; cancelAnimationFrame(PV.raf);
    for (const it of PV.items) if (it.m.kind === 'video') it.m.el.pause();
    if (PV.onTick) PV.onTick(PV.t);
  };
})();
