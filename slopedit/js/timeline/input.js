/* SlopEdit: timeline pointer input. Scrub, select (click, shift, marquee), move across tracks,
   trim (normal / ripple with the B tool or Ctrl), razor, fades, transition length, volume and keyframes,
   wheel zoom/scroll and two-finger pinch. Every drag is one undo step. */
(function () {
  'use strict';
  const SE = window.SE, U = SE.util, M = SE.model, E = SE.edit, TL = SE.timeline, A = SE.app;
  let drag = null;
  const pointers = new Map();

  /** Live drag edit: snapshot once, re-apply from the original on every move. */
  function live(label) {
    const orig = { clips: JSON.parse(JSON.stringify(SE.doc.clips)), markers: JSON.parse(JSON.stringify(SE.doc.markers)) };
    let begun = false;
    return {
      apply(fn) {
        if (!begun) { SE.history.begin(label); begun = true; }
        SE.doc.clips = JSON.parse(JSON.stringify(orig.clips)); SE.doc.markers = JSON.parse(JSON.stringify(orig.markers));
        fn(SE.doc);
        SE.emit('change', { label, live: true });
      },
      get moved() { return begun; }
    };
  }
  function local(e) { const r = SE.app.els.tlCanvas.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; }
  const ripple = (e) => TL.tool === 'ripple' || e.ctrlKey || e.metaKey;

  function startScrub(e, pt) {
    if (SE.player.playing) SE.player.pause();
    const go = (x) => SE.player.seek(TL.snapT(Math.max(0, TL.t(x)), null, false));
    go(pt.x);
    drag = { kind: 'scrub', move: (p) => go(p.x), end: () => { TL.snapLine = null; } };
  }
  function startMarker(e, pt, k) {
    const ed = live('Move marker'); const t0 = k.t, x0 = pt.x;
    SE.player.seek(k.t);
    drag = { kind: 'marker', move: (p) => ed.apply((d) => { const m = d.markers.find((x) => x.id === k.id); m.t = Math.max(0, TL.snapT(t0 + (p.x - x0) / TL.pps, null)); }), end: () => { TL.snapLine = null; } };
  }
  function startMove(e, pt, h) {
    const c = h.clip;
    if (!A.sel.has(c.id)) A.select([...E.group(SE.doc, [c.id])]);
    const ids = A.selectedIds(), g = E.group(SE.doc, ids);
    const clips = SE.doc.clips.filter((x) => g.has(x.id));
    const s0 = Math.min(...clips.map((x) => x.start)), e0 = Math.max(...clips.map(M.end));
    const ed = live(clips.length > 1 ? 'Move clips' : 'Move clip');
    const kind = h.row.track.kind, rows = TL.rows().filter((r) => r.track.kind === kind), r0 = rows.findIndex((r) => r.track.id === h.row.track.id);
    let started = false;
    drag = {
      kind: 'move',
      move(p) {
        if (!started && Math.abs(p.x - pt.x) < 4 && Math.abs(p.y - pt.y) < 4) return;
        started = true;
        let dt = (p.x - pt.x) / TL.pps;
        if (TL.snap && !p.alt) {
          const a = TL.snapT(s0 + dt, g), la = TL.snapLine; const b = TL.snapT(e0 + dt, g), lb = TL.snapLine;
          if (la != null && (lb == null || Math.abs(a - s0 - dt) <= Math.abs(b - e0 - dt))) { dt = a - s0; TL.snapLine = la; } else if (lb != null) { dt = b - e0; TL.snapLine = lb; }
        } else TL.snapLine = null;
        const row = TL.rowAt(p.y), ri = row ? rows.findIndex((r) => r.track.id === row.track.id) : -1;
        // rows are displayed top-down: for video V2 is above V1, so moving up is +1 in track index
        const dTrack = ri < 0 ? 0 : kind === 'video' ? r0 - ri : ri - r0;
        ed.apply((d) => { if (!E.move(d, ids, dt, dTrack, kind)) E.move(d, ids, dt, 0, kind); });
      },
      end() { TL.snapLine = null; }
    };
  }
  function startTrim(e, pt, h) {
    const c = h.clip, edge = h.part, rip = ripple(e);
    if (!A.sel.has(c.id)) A.select([...E.group(SE.doc, [c.id])]);
    const ed = live(rip ? 'Ripple trim' : 'Trim');
    const t0 = edge === 'in' ? c.start : M.end(c), g = E.group(SE.doc, [c.id]);
    drag = {
      kind: 'trim',
      move(p) {
        const t = TL.snapT(t0 + (p.x - pt.x) / TL.pps, g);
        ed.apply((d) => E.trim(d, c.id, edge, t, { ripple: rip }));
        const cc = M.clip(SE.doc, c.id);
        if (cc && !SE.player.playing) SE.player.seek(edge === 'in' ? cc.start : M.end(cc) - 1 / SE.doc.fps, { preview: true });
      },
      end() { TL.snapLine = null; }
    };
  }
  function startFade(e, pt, h) {
    const c = h.clip, which = h.part, key = c.kind === 'audio' ? (which === 'fadein' ? 'afIn' : 'afOut') : which === 'fadein' ? 'fadeIn' : 'fadeOut';
    const ed = live('Fade'), r = TL.clipRect(c);
    drag = { kind: 'fade', move(p) {
      const v = which === 'fadein' ? (p.x - r.x) / TL.pps : (r.x + r.w - p.x) / TL.pps;
      ed.apply((d) => { const cc = M.clip(d, c.id); cc[key] = U.round(U.clamp(v, 0, cc.dur), 3); });
    } };
  }
  function startTransition(e, pt, h) {
    const c = h.clip, cut = TL.x(c.start), ed = live('Transition length');
    A.select([c.id]);
    drag = { kind: 'tr', move(p) { ed.apply((d) => E.setTransition(d, c.id, c.trIn.type, Math.abs(p.x - cut) * 2 / TL.pps)); } };
  }
  function startVolume(e, pt, h) {
    const c = h.clip, r = TL.clipRect(c);
    if (h.part === 'volume' && (e.ctrlKey || e.metaKey || e.altKey)) {
      SE.change('Add keyframe', (d) => { const cc = M.clip(d, c.id); const u = U.round((pt.x - r.x) / TL.pps, 3); const v = TL.volFromY(r, pt.y) / (cc.vol || 1); cc.keys = (cc.keys || []).concat({ t: u, v: U.round(v, 3) }).sort((a, b) => a.t - b.t); });
      drag = { kind: 'none' }; return;
    }
    A.select([c.id], { add: e.shiftKey });
    const ed = live(h.part === 'key' ? 'Move keyframe' : 'Volume');
    drag = { kind: 'vol', move(p) {
      ed.apply((d) => {
        const cc = M.clip(d, c.id);
        if (h.part === 'key') {
          const k = cc.keys[h.key];
          k.t = U.round(U.clamp((p.x - r.x) / TL.pps, 0, cc.dur), 3); k.v = U.round(TL.volFromY(r, p.y) / (cc.vol || 1), 3);
          cc.keys.sort((a, b) => a.t - b.t);
        } else if (cc.keys && cc.keys.length) { const f = TL.volFromY(r, p.y) / Math.max(0.001, TL.volFromY(r, pt.y)); cc.keys.forEach((k, i) => { k.v = U.round(U.clamp(c.keys[i].v * f, 0, 4), 3); }); }
        else cc.vol = TL.volFromY(r, p.y);
      });
      SE.app.status('Volume ' + (20 * Math.log10(Math.max(1e-4, M.clip(SE.doc, c.id).vol))).toFixed(1) + ' dB');
    } };
  }
  function startMarquee(e, pt) {
    const base = e.shiftKey ? new Set(A.sel) : new Set();
    drag = { kind: 'marquee', move(p) {
      const x = Math.min(pt.x, p.x), y = Math.min(pt.y, p.y), w = Math.abs(p.x - pt.x), h = Math.abs(p.y - pt.y);
      TL.marquee = { x, y, w, h };
      const ids = SE.doc.clips.filter((c) => { const r = TL.clipRect(c); return r && r.x < x + w && r.x + r.w > x && r.y < y + h && r.y + r.h > y; }).map((c) => c.id);
      A.select([...base, ...ids]);
    }, end() { TL.marquee = null; TL.dirty(); } };
  }
  function startPan(e, pt) {
    const sx = TL.scrollX, sy = TL.scrollY;
    drag = { kind: 'pan', move(p) { TL.scrollX = sx - (p.x - pt.x) / TL.pps; TL.scrollY = sy - (p.y - pt.y); TL.clampScroll(); TL.syncHeads(); TL.dirty(); } };
  }

  function down(e) {
    const el = SE.app.els.tlCanvas;
    pointers.set(e.pointerId, local(e));
    if (pointers.size === 2) { // pinch zoom
      const [a, b] = [...pointers.values()]; drag = { kind: 'pinch', d0: Math.abs(a.x - b.x) || 1, pps0: TL.pps, cx: (a.x + b.x) / 2 };
      return;
    }
    if (e.button === 2) return;
    el.setPointerCapture(e.pointerId);
    SE.app.els.tlLanes.focus({ preventScroll: true });
    const touch = e.pointerType === 'touch';
    TL.EDGE = touch ? 16 : 7; // bigger trim handles for fingers
    const pt = local(e), h = TL.hit(pt.x, pt.y);
    if (h.area === 'ruler') return startScrub(e, pt);
    if (h.area === 'markers') return h.marker ? startMarker(e, pt, h.marker) : startScrub(e, pt);
    if (h.area === 'clip') {
      if (M.track(SE.doc, h.clip.track).lock) { A.select([h.clip.id]); drag = { kind: 'none' }; return; }
      if (TL.tool === 'razor') { SE.act.splitAt(TL.snapT(h.t), e.shiftKey ? null : [h.clip.id]); drag = { kind: 'none' }; return; }
      if (e.shiftKey || e.ctrlKey || e.metaKey) { if (h.part === 'body') { A.select([...E.group(SE.doc, [h.clip.id])], { toggle: true }); drag = { kind: 'none' }; return; } }
      if (h.part === 'in' || h.part === 'out') return startTrim(e, pt, h);
      if (h.part === 'fadein' || h.part === 'fadeout') return startFade(e, pt, h);
      if (h.part === 'transition') return startTransition(e, pt, h);
      if (h.part === 'volume' || h.part === 'key') return startVolume(e, pt, h);
      if (touch && !A.sel.has(h.clip.id)) { A.select([...E.group(SE.doc, [h.clip.id])]); return startPan(e, pt); }
      return startMove(e, pt, h);
    }
    if (touch) return startPan(e, pt);
    if (!e.shiftKey) A.select([]);
    startMarquee(e, pt);
  }
  function move(e) {
    if (pointers.has(e.pointerId)) pointers.set(e.pointerId, local(e));
    if (e.pointerType === 'mouse' && !drag) TL.EDGE = 7;
    const pt = local(e);
    if (drag && drag.kind === 'pinch' && pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      TL.setZoom(drag.pps0 * (Math.abs(a.x - b.x) || 1) / drag.d0, drag.cx); return;
    }
    if (drag && drag.move) { drag.move(Object.assign(pt, { alt: e.altKey })); return; }
    hover(pt);
  }
  function up(e) {
    pointers.delete(e.pointerId);
    if (drag) { if (drag.end) drag.end(); drag = null; TL.dirty(); }
  }
  function hover(pt) {
    const h = TL.hit(pt.x, pt.y), el = SE.app.els.tlCanvas;
    let cur = 'default';
    if (TL.tool === 'razor' && h.area === 'clip') cur = 'crosshair';
    else if (h.area === 'ruler' || (h.area === 'markers' && !h.marker)) cur = 'text';
    else if (h.area === 'markers') cur = 'ew-resize';
    else if (h.area === 'clip') cur = { in: 'w-resize', out: 'e-resize', fadein: 'ew-resize', fadeout: 'ew-resize', transition: 'ew-resize', volume: 'ns-resize', key: 'move', body: 'grab' }[h.part];
    if ((h.part === 'in' || h.part === 'out') && TL.tool === 'ripple') cur = h.part === 'in' ? 'w-resize' : 'e-resize';
    el.style.cursor = cur;
    const hov = h.clip ? h.clip.id : null;
    TL.razorX = TL.tool === 'razor' && h.area === 'clip' ? TL.x(TL.snapT(h.t)) : null;
    if (hov !== TL.hover || TL.tool === 'razor') { TL.hover = hov; TL.dirty(); }
  }
  function wheel(e) {
    e.preventDefault();
    const pt = local(e);
    if (e.ctrlKey || e.metaKey || e.altKey) { TL.zoomBy(Math.exp(-e.deltaY * 0.0025), pt.x); return; }
    const dx = e.shiftKey ? e.deltaY : e.deltaX, dy = e.shiftKey ? 0 : e.deltaY;
    const canV = TL.contentH() > TL.h;
    if (Math.abs(dx) > 0 || !canV) TL.scrollX += (dx || dy) / TL.pps;
    else TL.scrollY += dy;
    TL.clampScroll(); TL.syncHeads(); TL.dirty();
  }
  TL.initInput = function () {
    const el = SE.app.els.tlCanvas;
    el.style.touchAction = 'none';
    el.addEventListener('pointerdown', down);
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
    el.addEventListener('pointerleave', () => { if (!drag) { TL.hover = null; TL.razorX = null; TL.dirty(); } });
    el.addEventListener('wheel', wheel, { passive: false });
    el.addEventListener('dblclick', (e) => { const pt = local(e), h = TL.hit(pt.x, pt.y); if (TL.onDouble) TL.onDouble(h, e); });
    el.addEventListener('contextmenu', (e) => { e.preventDefault(); const pt = local(e), h = TL.hit(pt.x, pt.y); if (TL.contextMenu) TL.contextMenu(h, e.clientX, e.clientY); });
  };
})();
