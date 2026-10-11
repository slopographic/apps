/* Slop PDF — page view & editor: large zoomable preview (wheel/S.pinch), and annotation tools:
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
    S.viewer.addEventListener('wheel', S.onWheel, { passive: false });
    S.viewer.addEventListener('pointerdown', S.onViewerDown, true);
    S.viewer.addEventListener('pointerdown', function (e) { if (e.target === S.viewer || e.target === S.pad) { if (e.pointerType === 'mouse' && e.button === 0) S.startPan(e); else if (e.pointerType !== 'mouse') S.startPan(e); Ed.select(null); } });
    S.ta.addEventListener('input', S.onTextInput);
    S.ta.addEventListener('blur', function () { S.finishText(true); });
    S.ta.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' || (e.key === 'Enter' && (e.ctrlKey || e.metaKey))) { e.preventDefault(); S.ta.blur(); }
      e.stopPropagation();
    });
    new ResizeObserver(function () { if (Ed.pid && Ed.zoomMode !== 'num') Ed.layout(); }).observe(S.viewer);
  };
  Ed.page = function () { return Ed.pid ? E.pageById(Ed.pid) : null; };
  Ed.show = function (pid) {
    if (Ed.pid !== pid) { S.finishText(true); Ed.selId = null; }
    Ed.pid = pid;
    Ed.layout(true);
  };
  Ed.hide = function () { S.finishText(true); Ed.pid = null; Ed.selId = null; };

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
    S.layer.style.transform = V.layerTransform(R, g.W, g.H, z);
    S.pageEl.dataset.tool = Ed.tool;
    S.pageEl.classList.toggle('is-redacted', !!p.redacted);
    Ed.paint();
    var key = (p.blank ? 'blank' : p.f + ':' + p.i + ':' + E.formKey(p.f)) + '@' + Math.round(z * 100);
    if (forceRaster || S.canvas._key !== key) S.scheduleRaster(key);
    if (SP.app) SP.app.zoomChanged(z);
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
  Ed.setZoom = function (z, anchor) {
    var old = Ed.zoom;
    z = U.clamp(z, 0.1, 8);
    var r = S.pageEl.getBoundingClientRect(), ax, ay, cxp, cyp;
    if (anchor) { ax = anchor.x; ay = anchor.y; } else { var vr = S.viewer.getBoundingClientRect(); ax = vr.left + vr.width / 2; ay = vr.top + vr.height / 2; }
    cxp = (ax - r.left) / old; cyp = (ay - r.top) / old;
    Ed.zoomMode = 'num'; Ed.zoom = z;
    Ed.layout();
    var r2 = S.pageEl.getBoundingClientRect();
    S.viewer.scrollLeft += (r2.left + cxp * z) - ax;
    S.viewer.scrollTop += (r2.top + cyp * z) - ay;
  };
  Ed.zoomBy = function (k, anchor) { Ed.setZoom(Ed.zoom * k, anchor); };
  Ed.fit = function (mode) { Ed.zoomMode = mode || 'fit'; Ed.layout(); };
  S.onWheel = function (e) {
    if (!(e.ctrlKey || e.metaKey)) return;
    e.preventDefault();
    Ed.zoomBy(Math.exp(-e.deltaY * 0.0022), { x: e.clientX, y: e.clientY });
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

  /* ------------------------------------------------------- pan & pinch */
  var touches = new Map();
  S.startPan = function (e) {
    var sx = e.clientX, sy = e.clientY, sl = S.viewer.scrollLeft, st = S.viewer.scrollTop, pid = e.pointerId;
    function mv(ev) { if (ev.pointerId !== pid || S.pinch) return; S.viewer.scrollLeft = sl - (ev.clientX - sx); S.viewer.scrollTop = st - (ev.clientY - sy); }
    function up(ev) { if (ev.pointerId !== pid) return; window.removeEventListener('pointermove', mv); window.removeEventListener('pointerup', up); window.removeEventListener('pointercancel', up); S.viewer.classList.remove('panning'); }
    S.viewer.classList.add('panning');
    window.addEventListener('pointermove', mv); window.addEventListener('pointerup', up); window.addEventListener('pointercancel', up);
  }
  S.onViewerDown = function (e) {
    if (e.pointerType !== 'touch') return;
    touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (touches.size === 2 && !S.pinch) {
      Ed.cancelInteraction();
      var pts = Array.from(touches.values());
      S.pinch = { d0: Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y) || 1, z0: Ed.zoom, mid: { x: (pts[0].x + pts[1].x) / 2, y: (pts[0].y + pts[1].y) / 2 } };
      var r = S.pageEl.getBoundingClientRect();
      S.pinch.cx = (S.pinch.mid.x - r.left) / Ed.zoom; S.pinch.cy = (S.pinch.mid.y - r.top) / Ed.zoom;
    }
  }
  window.addEventListener('pointermove', function (e) {
    if (!touches.has(e.pointerId)) return;
    touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (!S.pinch || touches.size < 2) return;
    var pts = Array.from(touches.values()), d = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
    var mid = { x: (pts[0].x + pts[1].x) / 2, y: (pts[0].y + pts[1].y) / 2 };
    var z = U.clamp(S.pinch.z0 * d / S.pinch.d0, 0.1, 8);
    Ed.zoomMode = 'num'; Ed.zoom = z; Ed.layout();
    var r = S.pageEl.getBoundingClientRect();
    S.viewer.scrollLeft += (r.left + S.pinch.cx * z) - mid.x;
    S.viewer.scrollTop += (r.top + S.pinch.cy * z) - mid.y;
  }, { passive: true });
  function endTouch(e) { touches.delete(e.pointerId); if (touches.size < 2) S.pinch = null; }
  window.addEventListener('pointerup', endTouch); window.addEventListener('pointercancel', endTouch);
})();
