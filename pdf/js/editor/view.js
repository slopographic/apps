/* Slop PDF — page view & editor: large zoomable preview (wheel, pinch and Space pan through shared/nav), and annotation tools:
   text, pen, highlighter, rectangle, ellipse, line, arrow, whiteout, highlight box, image,
   signature. Annotations can be selected, moved, resized, edited and deleted. */
(function () {
  'use strict';
  var SP = window.SP, U = SP.util, E = SP.engine, V = SP.view;
  var Ed = SP.editor = {};
  var S = Ed._ = {}; // DOM + interaction state shared by the editor/*.js files
  Ed.pid = null; Ed.tool = 'select'; Ed.selId = null; Ed.zoomMode = 'fit'; Ed.zoom = 1;
  Ed.TOOLS = [
    ['select', 'Select & move', 'select', 'V'], ['text', 'Text', 'text', 'T'], ['pen', 'Draw', 'pen', 'P'], ['marker', 'Highlighter', 'marker', 'H'],
    ['rect', 'Rectangle', 'rect', 'R'], ['ellipse', 'Ellipse', 'ellipse', 'E'], ['line', 'Line', 'line', 'L'], ['arrow', 'Arrow', 'arrow', 'A'],
    ['whiteout', 'Whiteout (cover content)', 'whiteout', 'W'], ['redact', 'Redact (remove content)', 'redact', 'X'], ['hlbox', 'Highlight box', 'hlbox', 'B'], ['image', 'Image', 'image', 'I'], ['signature', 'Signature', 'sign', 'S']
  ];
  var DEF = {
    text: { color: '#111111', font: 'Helvetica', size: 16, bold: false, italic: false, opacity: 1 },
    pen: { color: '#1d4ed8', width: 2.5, opacity: 1 },
    marker: { color: '#ffe14d', width: 14, opacity: 0.5 },
    rect: { color: '#e0245e', width: 2.5, fill: 'none', opacity: 1 },
    ellipse: { color: '#e0245e', width: 2.5, fill: 'none', opacity: 1 },
    line: { color: '#e0245e', width: 2.5, opacity: 1 },
    arrow: { color: '#e0245e', width: 2.5, opacity: 1 },
    whiteout: { fill: '#ffffff', opacity: 1 },
    hlbox: { fill: '#ffe14d', opacity: 0.4 },
    redact: {},
    image: { opacity: 1 }
  };
  Ed.DEF = DEF;
  Ed.defaults = U.store.get('toolDefaults', null) || JSON.parse(JSON.stringify(DEF));
  Object.keys(DEF).forEach(function (k) { Ed.defaults[k] = Object.assign({}, DEF[k], Ed.defaults[k] || {}); });

  var renderTimer = 0, renderTask = null, renderSeq = 0;
  Ed.init = function (viewerEl) {
    S.viewer = viewerEl;
    S.pad = U.h('div', { class: 'pv-pad' });
    S.pageEl = U.h('div', { class: 'pv-page' });
    S.layer = U.h('div', { class: 'sheet-layer' });
    S.canvas = U.h('canvas', { class: 'pv-canvas' });
    S.svg = U.s('svg', { class: 'sheet-svg pv-svg', preserveAspectRatio: 'none' });
    S.overlay = U.h('div', { class: 'pv-overlay' });
    S.ta = U.h('textarea', { class: 'pv-text', spellcheck: 'false', autocomplete: 'off', 'aria-label': 'Edit text', wrap: 'off', hidden: true });
    S.layer.append(S.canvas, S.svg); S.pageEl.append(S.layer, S.overlay, S.ta); S.pad.appendChild(S.pageEl); S.viewer.appendChild(S.pad);
    S.pageEl.addEventListener('pointerdown', S.onDown);
    S.pageEl.addEventListener('dblclick', S.onDbl);
    S.viewer.addEventListener('pointerdown', function (e) { if (e.target === S.viewer || e.target === S.pad) { if (e.pointerType === 'mouse' && e.button === 0) S.startPan(e); else if (e.pointerType !== 'mouse') S.startPan(e); Ed.select(null); } });
    S.ta.addEventListener('input', S.onTextInput);
    S.ta.addEventListener('blur', function () { S.finishText(true); });
    S.ta.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' || (e.key === 'Enter' && (e.ctrlKey || e.metaKey))) { e.preventDefault(); S.ta.blur(); }
      e.stopPropagation();
    });
    new ResizeObserver(function () { if (Ed.pid && Ed.zoomMode !== 'num') Ed.layout(); }).observe(S.viewer);
    // Phone width: the toolbar's zoom buttons sit off-screen and the status bar is hidden, so a small cluster floats here.
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
  Ed.page = function () { return Ed.pid ? E.pageById(Ed.pid) : null; };
  Ed.show = function (pid) {
    if (Ed.pid !== pid) { S.finishText(true); Ed.selId = null; }
    stopEase();
    Ed.pid = pid;
    Ed.layout(true);
  };
  Ed.hide = function () { S.finishText(true); stopEase(); Ed.pid = null; Ed.selId = null; };

  /* --------------------------------------------------------------- layout */
  S.fitZoom = function (mode) {
    var p = Ed.page(); if (!p) return 1;
    var vs = E.viewSize(p), cw = Math.max(100, S.viewer.clientWidth - 48), ch = Math.max(100, S.viewer.clientHeight - 48);
    return mode === 'width' ? cw / vs.w : Math.min(cw / vs.w, ch / vs.h);
  }
  Ed.layout = function (forceRaster) {
    var p = Ed.page(); if (!p) return;
    if (Ed.zoomMode !== 'num') Ed.zoom = S.fitZoom(Ed.zoomMode);
    var z = Ed.zoom, g = E.geom(p), R = E.rotation(p), vs = E.viewSize(p);
    S.pageEl.style.width = (vs.w * z) + 'px'; S.pageEl.style.height = (vs.h * z) + 'px';
    S.layer.style.width = (g.W * z) + 'px'; S.layer.style.height = (g.H * z) + 'px';
    S.pageEl.style.left = ''; S.pageEl.style.top = ''; // back to centred; setRaw re-applies its offset
    S.layer.style.transform = V.layerTransform(R, g.W, g.H, z);
    S.pageEl.dataset.tool = Ed.tool;
    S.pageEl.classList.toggle('is-redacted', !!p.redacted);
    Ed.paint();
    var key = (p.blank ? 'blank' : p.f + ':' + p.i + ':' + E.formKey(p.f)) + '@' + Math.round(z * 100);
    if (forceRaster || S.canvas._key !== key) S.scheduleRaster(key);
    if (SP.app) SP.app.zoomChanged(z);
    if (S.zoomPct) S.zoomPct.textContent = Ed.percent(z) + '%';
  };
  S.scheduleRaster = function (key) {
    clearTimeout(renderTimer);
    renderTimer = setTimeout(function () { S.renderRaster(key); }, S.canvas._key ? 120 : 0);
  }
  S.renderRaster = async function (key) {
    var p = Ed.page(); if (!p) return;
    var seq = ++renderSeq, g = E.geom(p), dpr = Math.min(3, window.devicePixelRatio || 1);
    var scale = Ed.zoom * dpr, maxPx = 16e6;
    if (g.W * g.H * scale * scale > maxPx) scale = Math.sqrt(maxPx / (g.W * g.H));
    if (renderTask) { try { renderTask.cancel(); } catch (e) { /* ignore */ } renderTask = null; }
    var off = document.createElement('canvas');
    try {
      if (p.blank) {
        off.width = Math.max(1, Math.round(g.W * scale)); off.height = Math.max(1, Math.round(g.H * scale));
        var cx = off.getContext('2d'); cx.fillStyle = '#fff'; cx.fillRect(0, 0, off.width, off.height);
      } else {
        var f = E.files.get(p.f);
        var prom = E.renderToCanvas(f, p.i, scale, off);
        renderTask = off._task;
        await prom;
      }
    } catch (e) {
      if (e && e.name === 'RenderingCancelledException') return;
      console.warn('Slop PDF: page render failed', e); return;
    }
    if (seq !== renderSeq || Ed.page() !== p) return;
    S.canvas.width = off.width; S.canvas.height = off.height;
    S.canvas.getContext('2d').drawImage(off, 0, 0);
    off.width = off.height = 0;
    S.canvas._key = key;
    S.pageEl.classList.add('loaded');
  }
  /* ----------------------------------------------------------------- zoom
     Ed.zoom is in layout units: the status bar shows Ed.zoom × 72/96 (1 is 75%), so the 10% to 800% limits are
     ZMIN..ZMAX here. Wheel, keys, buttons and fit ease for ZOOM_MS and keep the point under the pointer (or the
     centre) in place on every frame. Pinch and trackpad pinch are immediate, so they follow the fingers. */
  var ZOOM_MS = 120, ZMIN = 0.1 * 96 / 72, ZMAX = 8 * 96 / 72, ease = null, easeRaf = 0;
  Ed.ZOOM_MIN = ZMIN; Ed.ZOOM_MAX = ZMAX;
  Ed.percent = function (z) { return Math.round(z * 72 / 96 * 100); };
  function stopEase() { if (easeRaf) cancelAnimationFrame(easeRaf); easeRaf = 0; ease = null; }
  function centre() { var vr = S.viewer.getBoundingClientRect(); return { x: vr.left + vr.width / 2, y: vr.top + vr.height / 2 }; }
  /** Zoom now to z, keeping the page point under client (ax, ay) in place. */
  function setRaw(z, ax, ay) {
    var old = Ed.zoom, r = S.pageEl.getBoundingClientRect(), cxp = (ax - r.left) / old, cyp = (ay - r.top) / old;
    Ed.zoomMode = 'num'; Ed.zoom = U.clamp(z, ZMIN, ZMAX); Ed.layout(); // the layout centres the page again
    var r2 = S.pageEl.getBoundingClientRect();
    S.viewer.scrollLeft += (r2.left + cxp * Ed.zoom) - ax;
    S.viewer.scrollTop += (r2.top + cyp * Ed.zoom) - ay;
    // A page smaller than the viewer cannot scroll, so what is left of the move is an offset on the page itself.
    var r3 = S.pageEl.getBoundingClientRect();
    S.pageEl.style.left = ((ax - cxp * Ed.zoom) - r3.left) + 'px';
    S.pageEl.style.top = ((ay - cyp * Ed.zoom) - r3.top) + 'px';
  }
  function frame(now) {
    easeRaf = 0;
    var a = ease; if (!a) return;
    var t = U.clamp(((now == null ? performance.now() : now) - a.t0) / ZOOM_MS, 0, 1), k = 1 - Math.pow(1 - t, 3);
    if (t >= 1) { stopEase(); setRaw(a.zt, a.ax, a.ay); if (a.mode) { Ed.zoomMode = a.mode; Ed.layout(); } return; }
    setRaw(a.z0 + (a.zt - a.z0) * k, a.ax, a.ay);
    easeRaf = requestAnimationFrame(frame);
  }
  /** Eased zoom to zt from the zoom on screen now (a move in flight is continued); mode is kept after it lands. */
  function easeTo(zt, ax, ay, mode) {
    if (!Ed.page()) return;
    stopEase();
    ease = { z0: Ed.zoom, zt: U.clamp(zt, ZMIN, ZMAX), t0: performance.now(), ax: ax, ay: ay, mode: mode || null };
    easeRaf = requestAnimationFrame(frame);
  }
  /** The zoom the view is heading to (the current one when nothing moves). Wheel and key steps build on it. */
  Ed.targetZoom = function () { return ease ? ease.zt : Ed.zoom; };
  /** True while an eased zoom is running (tests wait for it to land). */
  Ed.easing = function () { return !!ease; };
  /** Immediate zoom (the zoom menu's entries, pinch). anchor is client coordinates; the centre when omitted. */
  Ed.setZoom = function (z, anchor) { stopEase(); var c = anchor || centre(); setRaw(z, c.x, c.y); };
  /** Eased zoom by a factor of the target zoom, about anchor (client coordinates) or the centre. */
  Ed.zoomBy = function (k, anchor) { var c = anchor || centre(); easeTo(Ed.targetZoom() * k, c.x, c.y, null); };
  /** Fit: 'fit' (the whole page) or 'width' (Ctrl/⌘ 0). It keeps following the window size after it lands. */
  Ed.fit = function (mode) {
    mode = mode || 'fit';
    if (!Ed.page()) { Ed.zoomMode = mode; return; }
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

  /* ---------------------------------------------------------------- paint */
  Ed.paint = function () {
    var p = Ed.page(); if (!p) return;
    var idx = E.indexOf(p.id);
    V.paintAnnots(S.svg, p, idx, E.state.pages.length, { hide: S.editing ? S.editing.id : null, draft: S.draft });
    if (Ed.selId && !S.findAnnot(Ed.selId)) Ed.selId = null;
    S.drawSelection();
  };
  S.findAnnot = function (id) { var p = Ed.page(); if (!p) return null; for (var i = 0; i < p.annots.length; i++) if (p.annots[i].id === id) return p.annots[i]; return null; }
  Ed.getSelected = function () { return Ed.selId ? S.findAnnot(Ed.selId) : null; };
  Ed.select = function (id) {
    if (Ed.selId === id) return;
    Ed.selId = id; S.drawSelection();
    if (SP.app) SP.app.editorSelectionChanged();
  };
  S.ctx = function () { var p = Ed.page(), g = E.geom(p); return { p: p, g: g, R: E.rotation(p), W: g.W, H: g.H, z: Ed.zoom }; }
  S.drawSelection = function () {
    S.overlay.innerHTML = '';
    var a = Ed.getSelected(); if (!a || (S.editing && S.editing.id === a.id)) return;
    var c = S.ctx(), r = E.annotViewRect(a, c.R, c.W, c.H), z = c.z;
    var box = U.h('div', { class: 'sel-box' + (a.type === 'line' || a.type === 'arrow' ? ' is-line' : '') });
    box.style.left = (r.x * z) + 'px'; box.style.top = (r.y * z) + 'px'; box.style.width = (r.w * z) + 'px'; box.style.height = (r.h * z) + 'px';
    S.overlay.appendChild(box);
    var hs;
    if (a.type === 'line' || a.type === 'arrow') {
      [0, a.pts.length - 1].forEach(function (k, n) {
        var q = E.toView(c.R, c.W, c.H, a.pts[k][0], a.pts[k][1]);
        var h = U.h('div', { class: 'handle h-pt', 'data-h': n ? 'p2' : 'p1' });
        h.style.left = (q[0] * z) + 'px'; h.style.top = (q[1] * z) + 'px';
        S.overlay.appendChild(h);
      });
      return;
    }
    hs = (a.type === 'text' || a.type === 'image') ? ['nw', 'ne', 'se', 'sw'] : ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'];
    hs.forEach(function (h) {
      var el = U.h('div', { class: 'handle h-' + h, 'data-h': h });
      el.style.left = ((r.x + (/w/.test(h) ? 0 : /e/.test(h) ? r.w : r.w / 2)) * z) + 'px';
      el.style.top = ((r.y + (/n/.test(h) ? 0 : /s/.test(h) ? r.h : r.h / 2)) * z) + 'px';
      S.overlay.appendChild(el);
    });
    var del = U.h('button', { class: 'sel-del', type: 'button', title: 'Delete (Del)', 'aria-label': 'Delete annotation', html: U.icon('trash') });
    del.style.left = ((r.x + r.w) * z + 8) + 'px'; del.style.top = (r.y * z - 30) + 'px';
    del.addEventListener('pointerdown', function (e) { e.stopPropagation(); });
    del.addEventListener('click', function (e) { e.stopPropagation(); Ed.deleteSelected(); });
    S.overlay.appendChild(del);
  }

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
  }
})();
