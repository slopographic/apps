/* Slop PDF — page view zoom and navigation. Ed.zoom is in layout units: the status bar shows Ed.zoom × 72/96 (1 is 75%),
   so the 25% to 800% limits are ZMIN..ZMAX here. Ctrl/⌘ + wheel (a trackpad pinch arrives as Ctrl + wheel) zooms about the
   pointer, the plain wheel scrolls, and buttons, keys and Fit ease for ZOOM_MS keeping the point under the pointer (or the
   centre) in place. The document point is taken from whichever page is under the anchor, so zoom works in every layout. */
(function () {
  'use strict';
  var SP = window.SP, U = SP.util, E = SP.engine, Ed = SP.editor, S = Ed._;
  var ZOOM_MS = 120, ZMIN = 0.25 * 96 / 72, ZMAX = 8 * 96 / 72, ease = null, easeRaf = 0;
  Ed.ZOOM_MIN = ZMIN; Ed.ZOOM_MAX = ZMAX;
  Ed.percent = function (z) { return Math.round(z * 72 / 96 * 100); };
  S.stopEase = function () { if (easeRaf) cancelAnimationFrame(easeRaf); easeRaf = 0; ease = null; };
  function centre() { var vr = S.viewer.getBoundingClientRect(); return { x: vr.left + vr.width / 2, y: vr.top + vr.height / 2 }; }
  /** Zoom now to z, keeping the document point under client (ax, ay) in place. */
  function setRaw(z, ax, ay) {
    var hit = S.slotAt(ax, ay);
    if (!hit) { Ed.zoomMode = 'num'; Ed.zoom = U.clamp(z, ZMIN, ZMAX); Ed.layout(); return; }
    var old = Ed.zoom, r = hit.el.getBoundingClientRect(), fx = (ax - r.left) / old, fy = (ay - r.top) / old;
    Ed.zoomMode = 'num'; Ed.zoom = U.clamp(z, ZMIN, ZMAX); Ed.layout(); // the layout centres the rows again
    var r2 = hit.el.getBoundingClientRect();
    S.viewer.scrollLeft += (r2.left + fx * Ed.zoom) - ax;
    S.viewer.scrollTop += (r2.top + fy * Ed.zoom) - ay;
    // A stack smaller than the viewer cannot scroll, so what is left of the move is an offset on the pad itself.
    var r3 = hit.el.getBoundingClientRect();
    S.pad.style.left = ((ax - fx * Ed.zoom) - r3.left) + 'px';
    S.pad.style.top = ((ay - fy * Ed.zoom) - r3.top) + 'px';
  }
  function frame(now) {
    easeRaf = 0;
    var a = ease; if (!a) return;
    var t = U.clamp(((now == null ? performance.now() : now) - a.t0) / ZOOM_MS, 0, 1), k = 1 - Math.pow(1 - t, 3);
    if (t >= 1) { S.stopEase(); setRaw(a.zt, a.ax, a.ay); if (a.mode) { Ed.zoomMode = a.mode; Ed.layout(); } return; }
    setRaw(a.z0 + (a.zt - a.z0) * k, a.ax, a.ay);
    easeRaf = requestAnimationFrame(frame);
  }
  /** Eased zoom to zt from the zoom on screen now (a move in flight is continued); mode is kept after it lands. */
  function easeTo(zt, ax, ay, mode) {
    if (!Ed.page()) return;
    S.stopEase();
    ease = { z0: Ed.zoom, zt: U.clamp(zt, ZMIN, ZMAX), t0: performance.now(), ax: ax, ay: ay, mode: mode || null };
    easeRaf = requestAnimationFrame(frame);
  }
  /** The zoom the view is heading to (the current one when nothing moves). Wheel and key steps build on it. */
  Ed.targetZoom = function () { return ease ? ease.zt : Ed.zoom; };
  /** True while an eased zoom is running (tests wait for it to land). */
  Ed.easing = function () { return !!ease; };
  /** Immediate zoom (the zoom menu's entries, pinch). anchor is client coordinates; the centre when omitted. */
  Ed.setZoom = function (z, anchor) { S.stopEase(); var c = anchor || centre(); setRaw(z, c.x, c.y); };
  /** Eased zoom by a factor of the target zoom, about anchor (client coordinates) or the centre. */
  Ed.zoomBy = function (k, anchor) { var c = anchor || centre(); easeTo(Ed.targetZoom() * k, c.x, c.y, null); };
  /** Fit: 'fit' (the whole page) or 'width' (Ctrl/⌘ 0). It keeps following the window size after it lands. */
  Ed.fit = function (mode) {
    mode = mode || 'fit';
    if (!Ed.page()) { Ed.zoomMode = mode; return; }
    Ed.fitPid = Ed.pid;
    var c = centre(); easeTo(S.fitZoom(mode), c.x, c.y, mode);
  };
  /** 100%: 1 pt per CSS pixel is 96/72 layout units (Ed.zoom 4/3). */
  Ed.actual = function () { var c = centre(); easeTo(96 / 72, c.x, c.y, null); };

  /* Navigation: the wheel, Space or middle drag, keys and touch are shared/nav's engine on this viewer, with these
     fixed bindings (not the Navigation preset): Ctrl/⌘ + wheel zooms about the pointer, the plain wheel scrolls
     (passthrough: the viewer scrolls natively), Shift + wheel scrolls sideways, pinch zooms, two fingers pan. */
  var NAV = { zoomWheel: 'ctrl', panWheel: 'shift', spacePan: true, middlePan: true, pinch: 'zoom', touchPan: true, fitKey: 'Mod+0', actualKey: 'Mod+1', handKey: '', clickZoomKey: '', zoomInKeys: ['Mod+='], zoomOutKeys: ['Mod+-'] };
  /** The engine's adapter: its coordinates are relative to the viewer, so they are converted to client ones here. */
  function atViewer(x, y) { var r = S.viewer.getBoundingClientRect(); return { x: r.left + x, y: r.top + y }; }
  Ed.nav = {
    zoomAt: function (f, x, y, live) { var c = atViewer(x, y); if (live) Ed.setZoom(Ed.zoom * f, c); else easeTo(Ed.targetZoom() * f, c.x, c.y, null); },
    panBy: function (dx, dy) { S.viewer.scrollLeft -= dx; S.viewer.scrollTop -= dy; },
    fit: function () { Ed.fit('width'); },
    actual: function () { Ed.actual(); },
    zoomStep: function (dir, x, y) { var c = atViewer(x, y); easeTo(Ed.targetZoom() * (dir > 0 ? 1.25 : 0.8), c.x, c.y, null); },
    cancelStroke: function () { if (Ed.cancelInteraction) Ed.cancelInteraction(); if (S.cancelPan) S.cancelPan(); },
  };
  /** Attaches the engine to the viewer. Keys and Space are left to the app outside page view (grid). */
  function attachNav() {
    if (!window.SlopNav || !SlopNav.engine) return;
    SlopNav.engine.attach({
      host: S.viewer, adapter: Ed.nav, bindings: function () { return NAV; }, passthrough: true,
      skip: function () { return !SP.app || SP.app.mode !== 'page'; },
    });
  }

  /** The zoom controls: the phone cluster (a floating bar, shown at phone width) and the attached engine. */
  S.initZoom = function () {
    var zo = U.h('button', { type: 'button', class: 'pv-zf', title: 'Zoom out (Ctrl −)', 'aria-label': 'Zoom out' }, '−');
    var zi = U.h('button', { type: 'button', class: 'pv-zf', title: 'Zoom in (Ctrl +)', 'aria-label': 'Zoom in' }, '+');
    var zw = U.h('button', { type: 'button', class: 'pv-zf', title: 'Fit width (Ctrl 0)', 'aria-label': 'Fit width', html: U.icon('fit') });
    S.zoomPct = U.h('span', { class: 'pv-zpct' }, '100%');
    zo.addEventListener('click', function () { Ed.zoomBy(1 / 1.25); });
    zi.addEventListener('click', function () { Ed.zoomBy(1.25); });
    zw.addEventListener('click', function () { Ed.fit('width'); });
    S.zoomFab = U.h('div', { class: 'pv-zoomfab', role: 'toolbar', 'aria-label': 'Zoom' }, zo, S.zoomPct, zi, zw);
    S.viewer.parentNode.appendChild(S.zoomFab);
    attachNav();
  };

  /* ------------------------------------------------------------- pan
     A drag on the empty viewer (mouse, pen or one finger) scrolls it. Space or middle drag pans through the engine.
     S.cancelPan ends this drag; the engine calls it when a second finger lands (pinch and two-finger pan). */
  S.startPan = function (e) {
    if (S.cancelPan) S.cancelPan();
    var sx = e.clientX, sy = e.clientY, sl = S.viewer.scrollLeft, st = S.viewer.scrollTop, pid = e.pointerId;
    function mv(ev) { if (ev.pointerId === pid) { S.viewer.scrollLeft = sl - (ev.clientX - sx); S.viewer.scrollTop = st - (ev.clientY - sy); } }
    function up(ev) { if (ev.pointerId === pid) end(); }
    function end() {
      window.removeEventListener('pointermove', mv); window.removeEventListener('pointerup', up); window.removeEventListener('pointercancel', up);
      S.viewer.classList.remove('panning'); if (S.cancelPan === end) S.cancelPan = null;
    }
    S.cancelPan = end;
    S.viewer.classList.add('panning');
    window.addEventListener('pointermove', mv); window.addEventListener('pointerup', up); window.addEventListener('pointercancel', up);
  };
})();
