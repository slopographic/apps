/* Slop PDF — page view & editor: large zoomable preview (wheel/pinch), and annotation tools:
   text, pen, highlighter, rectangle, ellipse, line, arrow, whiteout, highlight box, image,
   signature. Annotations can be selected, moved, resized, edited and deleted. */
(function () {
  'use strict';
  var SP = window.SP, U = SP.util, E = SP.engine, V = SP.view;
  var Ed = SP.editor = {};
  Ed.pid = null; Ed.tool = 'select'; Ed.selId = null; Ed.zoomMode = 'fit'; Ed.zoom = 1;
  Ed.TOOLS = [
    ['select', 'Select & move', 'select', 'V'], ['text', 'Text', 'text', 'T'], ['pen', 'Draw', 'pen', 'P'], ['marker', 'Highlighter', 'marker', 'H'],
    ['rect', 'Rectangle', 'rect', 'R'], ['ellipse', 'Ellipse', 'ellipse', 'E'], ['line', 'Line', 'line', 'L'], ['arrow', 'Arrow', 'arrow', 'A'],
    ['whiteout', 'Whiteout (cover content)', 'whiteout', 'W'], ['hlbox', 'Highlight box', 'hlbox', 'B'], ['image', 'Image', 'image', 'I'], ['signature', 'Signature', 'sign', 'S']
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
    image: { opacity: 1 }
  };
  Ed.defaults = U.store.get('toolDefaults', null) || JSON.parse(JSON.stringify(DEF));
  Object.keys(DEF).forEach(function (k) { Ed.defaults[k] = Object.assign({}, DEF[k], Ed.defaults[k] || {}); });

  var viewer, pad, pageEl, layer, canvas, svg, overlay, ta, renderTimer = 0, renderTask = null, renderSeq = 0;
  Ed.init = function (viewerEl) {
    viewer = viewerEl;
    pad = U.h('div', { class: 'pv-pad' });
    pageEl = U.h('div', { class: 'pv-page' });
    layer = U.h('div', { class: 'sheet-layer' });
    canvas = U.h('canvas', { class: 'pv-canvas' });
    svg = U.s('svg', { class: 'sheet-svg pv-svg', preserveAspectRatio: 'none' });
    overlay = U.h('div', { class: 'pv-overlay' });
    ta = U.h('textarea', { class: 'pv-text', spellcheck: 'false', autocomplete: 'off', 'aria-label': 'Edit text', wrap: 'off', hidden: true });
    layer.append(canvas, svg); pageEl.append(layer, overlay, ta); pad.appendChild(pageEl); viewer.appendChild(pad);
    pageEl.addEventListener('pointerdown', onDown);
    pageEl.addEventListener('dblclick', onDbl);
    viewer.addEventListener('wheel', onWheel, { passive: false });
    viewer.addEventListener('pointerdown', onViewerDown, true);
    viewer.addEventListener('pointerdown', function (e) { if (e.target === viewer || e.target === pad) { if (e.pointerType === 'mouse' && e.button === 0) startPan(e); else if (e.pointerType !== 'mouse') startPan(e); Ed.select(null); } });
    ta.addEventListener('input', onTextInput);
    ta.addEventListener('blur', function () { finishText(true); });
    ta.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' || (e.key === 'Enter' && (e.ctrlKey || e.metaKey))) { e.preventDefault(); ta.blur(); }
      e.stopPropagation();
    });
    new ResizeObserver(function () { if (Ed.pid && Ed.zoomMode !== 'num') Ed.layout(); }).observe(viewer);
  };
  Ed.page = function () { return Ed.pid ? E.pageById(Ed.pid) : null; };
  Ed.show = function (pid) {
    if (Ed.pid !== pid) { finishText(true); Ed.selId = null; }
    Ed.pid = pid;
    Ed.layout(true);
  };
  Ed.hide = function () { finishText(true); Ed.pid = null; Ed.selId = null; };

  /* --------------------------------------------------------------- layout */
  function fitZoom(mode) {
    var p = Ed.page(); if (!p) return 1;
    var vs = E.viewSize(p), cw = Math.max(100, viewer.clientWidth - 48), ch = Math.max(100, viewer.clientHeight - 48);
    return mode === 'width' ? cw / vs.w : Math.min(cw / vs.w, ch / vs.h);
  }
  Ed.layout = function (forceRaster) {
    var p = Ed.page(); if (!p) return;
    if (Ed.zoomMode !== 'num') Ed.zoom = fitZoom(Ed.zoomMode);
    var z = Ed.zoom, g = E.geom(p), R = E.rotation(p), vs = E.viewSize(p);
    pageEl.style.width = (vs.w * z) + 'px'; pageEl.style.height = (vs.h * z) + 'px';
    layer.style.width = (g.W * z) + 'px'; layer.style.height = (g.H * z) + 'px';
    layer.style.transform = V.layerTransform(R, g.W, g.H, z);
    pageEl.dataset.tool = Ed.tool;
    Ed.paint();
    var key = (p.blank ? 'blank' : p.f + ':' + p.i + ':' + E.formKey(p.f)) + '@' + Math.round(z * 100);
    if (forceRaster || canvas._key !== key) scheduleRaster(key);
    if (SP.app) SP.app.zoomChanged(z);
  };
  function scheduleRaster(key) {
    clearTimeout(renderTimer);
    renderTimer = setTimeout(function () { renderRaster(key); }, canvas._key ? 120 : 0);
  }
  async function renderRaster(key) {
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
    canvas.width = off.width; canvas.height = off.height;
    canvas.getContext('2d').drawImage(off, 0, 0);
    off.width = off.height = 0;
    canvas._key = key;
    pageEl.classList.add('loaded');
  }
  Ed.setZoom = function (z, anchor) {
    var old = Ed.zoom;
    z = U.clamp(z, 0.1, 8);
    var r = pageEl.getBoundingClientRect(), ax, ay, cxp, cyp;
    if (anchor) { ax = anchor.x; ay = anchor.y; } else { var vr = viewer.getBoundingClientRect(); ax = vr.left + vr.width / 2; ay = vr.top + vr.height / 2; }
    cxp = (ax - r.left) / old; cyp = (ay - r.top) / old;
    Ed.zoomMode = 'num'; Ed.zoom = z;
    Ed.layout();
    var r2 = pageEl.getBoundingClientRect();
    viewer.scrollLeft += (r2.left + cxp * z) - ax;
    viewer.scrollTop += (r2.top + cyp * z) - ay;
  };
  Ed.zoomBy = function (k, anchor) { Ed.setZoom(Ed.zoom * k, anchor); };
  Ed.fit = function (mode) { Ed.zoomMode = mode || 'fit'; Ed.layout(); };
  function onWheel(e) {
    if (!(e.ctrlKey || e.metaKey)) return;
    e.preventDefault();
    Ed.zoomBy(Math.exp(-e.deltaY * 0.0022), { x: e.clientX, y: e.clientY });
  }

  /* ---------------------------------------------------------------- paint */
  Ed.paint = function () {
    var p = Ed.page(); if (!p) return;
    var idx = E.indexOf(p.id);
    V.paintAnnots(svg, p, idx, E.state.pages.length, { hide: editing ? editing.id : null, draft: draft });
    if (Ed.selId && !findAnnot(Ed.selId)) Ed.selId = null;
    drawSelection();
  };
  function findAnnot(id) { var p = Ed.page(); if (!p) return null; for (var i = 0; i < p.annots.length; i++) if (p.annots[i].id === id) return p.annots[i]; return null; }
  Ed.getSelected = function () { return Ed.selId ? findAnnot(Ed.selId) : null; };
  Ed.select = function (id) {
    if (Ed.selId === id) return;
    Ed.selId = id; drawSelection();
    if (SP.app) SP.app.editorSelectionChanged();
  };
  function ctx() { var p = Ed.page(), g = E.geom(p); return { p: p, g: g, R: E.rotation(p), W: g.W, H: g.H, z: Ed.zoom }; }
  function drawSelection() {
    overlay.innerHTML = '';
    var a = Ed.getSelected(); if (!a || (editing && editing.id === a.id)) return;
    var c = ctx(), r = E.annotViewRect(a, c.R, c.W, c.H), z = c.z;
    var box = U.h('div', { class: 'sel-box' + (a.type === 'line' || a.type === 'arrow' ? ' is-line' : '') });
    box.style.left = (r.x * z) + 'px'; box.style.top = (r.y * z) + 'px'; box.style.width = (r.w * z) + 'px'; box.style.height = (r.h * z) + 'px';
    overlay.appendChild(box);
    var hs;
    if (a.type === 'line' || a.type === 'arrow') {
      [0, a.pts.length - 1].forEach(function (k, n) {
        var q = E.toView(c.R, c.W, c.H, a.pts[k][0], a.pts[k][1]);
        var h = U.h('div', { class: 'handle h-pt', 'data-h': n ? 'p2' : 'p1' });
        h.style.left = (q[0] * z) + 'px'; h.style.top = (q[1] * z) + 'px';
        overlay.appendChild(h);
      });
      return;
    }
    hs = (a.type === 'text' || a.type === 'image') ? ['nw', 'ne', 'se', 'sw'] : ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'];
    hs.forEach(function (h) {
      var el = U.h('div', { class: 'handle h-' + h, 'data-h': h });
      el.style.left = ((r.x + (/w/.test(h) ? 0 : /e/.test(h) ? r.w : r.w / 2)) * z) + 'px';
      el.style.top = ((r.y + (/n/.test(h) ? 0 : /s/.test(h) ? r.h : r.h / 2)) * z) + 'px';
      overlay.appendChild(el);
    });
    var del = U.h('button', { class: 'sel-del', type: 'button', title: 'Delete (Del)', 'aria-label': 'Delete annotation', html: U.icon('trash') });
    del.style.left = ((r.x + r.w) * z + 8) + 'px'; del.style.top = (r.y * z - 30) + 'px';
    del.addEventListener('pointerdown', function (e) { e.stopPropagation(); });
    del.addEventListener('click', function (e) { e.stopPropagation(); Ed.deleteSelected(); });
    overlay.appendChild(del);
  }

  /* -------------------------------------------------------------- commits */
  function commitPage(label, fn, coalesce) {
    var pid = Ed.pid;
    return E.commit(label, function (st) { var p = st.pages.filter(function (x) { return x.id === pid; })[0]; if (p) return fn(p); }, coalesce);
  }
  Ed.addAnnot = function (a, label) {
    a.id = a.id || U.uid('a');
    commitPage(label || 'Add ' + a.type, function (p) { p.annots.push(a); });
    Ed.selId = a.id; Ed.paint();
    if (SP.app) SP.app.editorSelectionChanged();
    return a;
  };
  Ed.deleteSelected = function () {
    var id = Ed.selId; if (!id) return;
    commitPage('Delete annotation', function (p) { p.annots = p.annots.filter(function (a) { return a.id !== id; }); });
    Ed.select(null);
  };
  Ed.duplicateSelected = function () {
    var a = Ed.getSelected(); if (!a) return;
    var c = JSON.parse(JSON.stringify(a)); c.id = U.uid('a');
    nudge(c, 12, 12);
    Ed.addAnnot(c, 'Duplicate annotation');
  };
  var clip = null;
  Ed.copy = function () { var a = Ed.getSelected(); if (a) { clip = JSON.parse(JSON.stringify(a)); return true; } return false; };
  Ed.paste = function () { if (!clip || !Ed.page()) return false; var c = JSON.parse(JSON.stringify(clip)); c.id = U.uid('a'); nudge(c, 12, 12); Ed.addAnnot(c, 'Paste annotation'); clip = c; return true; };
  function nudge(a, dx, dy) {
    var c = ctx(), r = E.annotViewRect(a, c.R, c.W, c.H);
    E.setAnnotViewRect(a, { x: r.x + dx, y: r.y + dy, w: r.w, h: r.h }, c.R, c.W, c.H);
  }
  Ed.nudgeSelected = function (dx, dy) {
    var id = Ed.selId; if (!id) return;
    commitPage('Move annotation', function (p) { p.annots.forEach(function (a) { if (a.id === id) nudge(a, dx, dy); }); }, 'nudge:' + id);
  };
  /** Updates a property on the selection (and on the tool default). */
  Ed.setProp = function (key, val) {
    var a = Ed.getSelected(), type = a ? a.type : Ed.tool;
    if (DEF[type]) { Ed.defaults[type][key] = val; U.store.set('toolDefaults', Ed.defaults); }
    if (!a) return;
    var id = a.id;
    commitPage('Change ' + key, function (p) {
      p.annots.forEach(function (x) {
        if (x.id !== id) return;
        if (x.type === 'text' && (key === 'size' || key === 'font' || key === 'bold' || key === 'italic')) {
          var c = ctx(), r = E.annotViewRect(x, c.R, c.W, c.H);
          x[key] = val; var t = E.textLayout(x);
          var va = (((c.R - (x.rot || 0)) % 360) + 360) % 360;
          E.setAnnotViewRect(x, { x: r.x, y: r.y, w: va % 180 ? t.h : t.w, h: va % 180 ? t.w : t.h }, c.R, c.W, c.H);
        } else x[key] = val;
      });
    }, 'prop:' + id + ':' + key);
  };
  Ed.setTool = function (t) {
    finishText(true);
    if (t === 'image') { Ed.pickImage(); return; }
    if (t === 'signature') { SP.sign.open(function (asset) { Ed.placeImage(asset, 'Add signature'); }); return; }
    Ed.tool = t; if (pageEl) pageEl.dataset.tool = t;
    if (t !== 'select') Ed.select(null);
    if (SP.app) SP.app.toolChanged();
  };

  /* -------------------------------------------------------------- images */
  Ed.pickImage = function () {
    SlopUI.pickFiles({ accept: 'image/png,image/jpeg,image/webp,image/gif' }).then(async function (files) {
      if (!files || !files[0]) return;
      try {
        var bytes = await U.readFile(files[0]), im = await E.prepareImage(bytes);
        var asset = E.addAsset({ mime: im.mime, url: U.bytesToDataURL(im.bytes, im.mime), w: im.w, h: im.h, name: files[0].name });
        Ed.placeImage(asset, 'Add image');
      } catch (e) { SlopUI.alert('Image not added', 'That image could not be read: ' + (e.message || e)); }
    });
  };
  Ed.placeImage = function (asset, label) {
    var p = Ed.page(); if (!p) return;
    var c = ctx(), vs = E.viewSize(p);
    var maxW = vs.w * (label === 'Add signature' ? 0.32 : 0.45), w = Math.min(maxW, asset.w * 0.75), h = w * asset.h / asset.w;
    if (h > vs.h * 0.5) { h = vs.h * 0.5; w = h * asset.w / asset.h; }
    // centre of the visible part of the page
    var vr = viewer.getBoundingClientRect(), pr = pageEl.getBoundingClientRect();
    var cx = U.clamp(((vr.left + vr.width / 2) - pr.left) / c.z, w / 2, vs.w - w / 2), cy = U.clamp(((vr.top + vr.height / 2) - pr.top) / c.z, h / 2, vs.h - h / 2);
    var a = { type: 'image', asset: asset.id, opacity: 1, rot: c.R, cx: 0, cy: 0, w: w, h: h };
    if (label === 'Add signature') a.sig = true;
    E.setAnnotViewRect(a, { x: cx - w / 2, y: cy - h / 2, w: w, h: h }, c.R, c.W, c.H);
    Ed.tool = 'select'; pageEl.dataset.tool = 'select';
    Ed.addAnnot(a, label);
    if (SP.app) SP.app.toolChanged();
  };

  /* ---------------------------------------------------------- interaction */
  var act = null, draft = null, editing = null;
  function viewPt(e) { var r = pageEl.getBoundingClientRect(); return [(e.clientX - r.left) / Ed.zoom, (e.clientY - r.top) / Ed.zoom]; }
  function pagePt(e) { var c = ctx(), v = viewPt(e); return E.toPage(c.R, c.W, c.H, v[0], v[1]); }
  Ed.cancelInteraction = function () {
    if (act && act.orig) { var a = findAnnot(act.id); if (a) { Object.keys(a).forEach(function (k) { delete a[k]; }); Object.assign(a, act.orig); } }
    act = null; draft = null; Ed.paint();
  };
  function onDown(e) {
    if (pinch || e.button > 0) return;
    if (editing) { if (e.target === ta) return; finishText(true); }
    var p = Ed.page(); if (!p) return;
    var handle = e.target.closest('.handle'), hitG = e.target.closest('.annots [data-aid]');
    var t = Ed.tool;
    if (t === 'select') {
      if (handle && Ed.selId) { e.preventDefault(); startEdit(e, handle.dataset.h); return; }
      if (hitG) { e.preventDefault(); Ed.select(hitG.getAttribute('data-aid')); startEdit(e, 'move'); return; }
      Ed.select(null);
      startPan(e);
      return;
    }
    e.preventDefault();
    pageEl.setPointerCapture(e.pointerId);
    var c = ctx(), d = Ed.defaults[t] || {}, pt = pagePt(e), vp = viewPt(e);
    if (t === 'text') {
      var a = Object.assign({ type: 'text', text: '', rot: c.R, cx: 0, cy: 0, w: 10, h: 10 }, Ed.defaults.text);
      a.id = U.uid('a');
      var tl = E.textLayout(Object.assign({}, a, { text: 'M' }));
      E.setAnnotViewRect(a, { x: vp[0] - tl.pad, y: vp[1] - tl.h / 2, w: tl.w, h: tl.h }, c.R, c.W, c.H);
      p.annots.push(a); // temporary until text is committed
      editing = { id: a.id, isNew: true };
      openTextEditor(a);
      return;
    }
    if (t === 'pen' || t === 'marker') {
      draft = Object.assign({ id: 'draft', type: t, pts: [pt] }, d);
      act = { kind: 'draw', pid: e.pointerId };
    } else if (t === 'line' || t === 'arrow') {
      draft = Object.assign({ id: 'draft', type: t, pts: [pt, pt.slice()] }, d);
      act = { kind: 'line', pid: e.pointerId };
    } else {
      draft = Object.assign({ id: 'draft', type: t, rot: c.R, cx: pt[0], cy: pt[1], w: 1, h: 1 }, d);
      act = { kind: 'box', start: vp, pid: e.pointerId };
    }
    Ed.paint();
    pageEl.addEventListener('pointermove', onMove);
    pageEl.addEventListener('pointerup', onUp);
    pageEl.addEventListener('pointercancel', onUp);
  }
  function onMove(e) {
    if (!act || pinch) return;
    var c = ctx();
    if (act.kind === 'draw') {
      var pt = pagePt(e), last = draft.pts[draft.pts.length - 1];
      if (Math.hypot(pt[0] - last[0], pt[1] - last[1]) * c.z > 1.5) draft.pts.push([U.round(pt[0], 2), U.round(pt[1], 2)]);
    } else if (act.kind === 'line') {
      var q = pagePt(e);
      if (e.shiftKey) { var v0 = E.toView(c.R, c.W, c.H, draft.pts[0][0], draft.pts[0][1]), v1 = viewPt(e), ang = Math.round(Math.atan2(v1[1] - v0[1], v1[0] - v0[0]) / (Math.PI / 4)) * Math.PI / 4, len = Math.hypot(v1[0] - v0[0], v1[1] - v0[1]); q = E.toPage(c.R, c.W, c.H, v0[0] + Math.cos(ang) * len, v0[1] + Math.sin(ang) * len); }
      draft.pts[1] = q;
    } else if (act.kind === 'box') {
      var v = viewPt(e), s = act.start, w = v[0] - s[0], h = v[1] - s[1];
      if (e.shiftKey) { var m = Math.max(Math.abs(w), Math.abs(h)); w = Math.sign(w || 1) * m; h = Math.sign(h || 1) * m; }
      E.setAnnotViewRect(draft, { x: Math.min(s[0], s[0] + w), y: Math.min(s[1], s[1] + h), w: Math.abs(w), h: Math.abs(h) }, c.R, c.W, c.H);
    }
    Ed.paint();
  }
  function onUp() {
    pageEl.removeEventListener('pointermove', onMove);
    pageEl.removeEventListener('pointerup', onUp);
    pageEl.removeEventListener('pointercancel', onUp);
    if (!act || !draft) { act = null; draft = null; return; }
    var a = draft, kind = act.kind; draft = null; act = null;
    var c = ctx();
    if (kind === 'box') {
      var r = E.annotViewRect(a, c.R, c.W, c.H);
      if (r.w < 4 && r.h < 4) { var dw = a.type === 'whiteout' || a.type === 'hlbox' ? 140 : 120, dh = a.type === 'whiteout' || a.type === 'hlbox' ? 28 : 80; E.setAnnotViewRect(a, { x: r.x - dw / 2, y: r.y - dh / 2, w: dw, h: dh }, c.R, c.W, c.H); }
    }
    if (kind === 'line') {
      var l = Math.hypot(a.pts[1][0] - a.pts[0][0], a.pts[1][1] - a.pts[0][1]);
      if (l < 3) { var v0 = E.toView(c.R, c.W, c.H, a.pts[0][0], a.pts[0][1]); a.pts[1] = E.toPage(c.R, c.W, c.H, v0[0] + 100, v0[1]); }
    }
    a.id = U.uid('a');
    var names = { pen: 'Draw', marker: 'Highlight', rect: 'Add rectangle', ellipse: 'Add ellipse', line: 'Add line', arrow: 'Add arrow', whiteout: 'Add whiteout', hlbox: 'Add highlight' };
    Ed.addAnnot(a, names[a.type]);
    if (a.type === 'pen' || a.type === 'marker') { Ed.selId = null; Ed.paint(); }
    else if (!(a.type === 'whiteout' || a.type === 'hlbox')) { Ed.tool = 'select'; pageEl.dataset.tool = 'select'; if (SP.app) SP.app.toolChanged(); }
  }

  /* move / resize / endpoints */
  function startEdit(e, h) {
    var a = Ed.getSelected(); if (!a) return;
    var c = ctx();
    act = { kind: 'edit', h: h, id: a.id, orig: JSON.parse(JSON.stringify(a)), start: viewPt(e), r0: E.annotViewRect(a, c.R, c.W, c.H), moved: false };
    pageEl.setPointerCapture(e.pointerId);
    function mv(ev) {
      if (!act || pinch) return;
      var v = viewPt(ev), dx = v[0] - act.start[0], dy = v[1] - act.start[1];
      if (!act.moved && Math.hypot(dx, dy) * c.z < 2) return;
      act.moved = true;
      var x = findAnnot(act.id); if (!x) return;
      Object.keys(x).forEach(function (k) { delete x[k]; }); Object.assign(x, JSON.parse(JSON.stringify(act.orig)));
      var r = act.r0, n = { x: r.x, y: r.y, w: r.w, h: r.h };
      if (act.h === 'move') { n.x += dx; n.y += dy; E.setAnnotViewRect(x, n, c.R, c.W, c.H); }
      else if (act.h === 'p1' || act.h === 'p2') { var k = act.h === 'p1' ? 0 : x.pts.length - 1; x.pts[k] = E.toPage(c.R, c.W, c.H, v[0], v[1]); }
      else {
        var hh = act.h;
        if (/w/.test(hh)) { n.x = r.x + dx; n.w = r.w - dx; }
        if (/e/.test(hh)) n.w = r.w + dx;
        if (/n/.test(hh)) { n.y = r.y + dy; n.h = r.h - dy; }
        if (/s/.test(hh)) n.h = r.h + dy;
        var keep = x.type === 'text' || x.type === 'image' || ev.shiftKey;
        if (keep && hh.length === 2) {
          var k2 = Math.max(n.w / r.w, n.h / r.h, 0.05);
          n.w = r.w * k2; n.h = r.h * k2;
          if (/w/.test(hh)) n.x = r.x + r.w - n.w;
          if (/n/.test(hh)) n.y = r.y + r.h - n.h;
        }
        if (n.w < 0) { n.x += n.w; n.w = -n.w; } if (n.h < 0) { n.y += n.h; n.h = -n.h; }
        n.w = Math.max(n.w, 2); n.h = Math.max(n.h, 2);
        if (x.type === 'text') {
          var k3 = n.h / r.h; x.size = U.clamp(U.round(act.orig.size * k3, 1), 4, 400);
          var t = E.textLayout(x), va = (((c.R - (x.rot || 0)) % 360) + 360) % 360;
          var tw = va % 180 ? t.h : t.w, th = va % 180 ? t.w : t.h;
          n = { x: /w/.test(hh) ? r.x + r.w - tw : r.x, y: /n/.test(hh) ? r.y + r.h - th : r.y, w: tw, h: th };
        }
        E.setAnnotViewRect(x, n, c.R, c.W, c.H);
      }
      Ed.paint();
    }
    function up() {
      pageEl.removeEventListener('pointermove', mv); pageEl.removeEventListener('pointerup', up); pageEl.removeEventListener('pointercancel', up);
      if (!act) return;
      var x = findAnnot(act.id), A = act; act = null;
      if (!x || !A.moved) { Ed.paint(); return; }
      var fin = JSON.parse(JSON.stringify(x));
      Object.keys(x).forEach(function (k) { delete x[k]; }); Object.assign(x, A.orig);
      commitPage(A.h === 'move' ? 'Move annotation' : 'Resize annotation', function (p) { p.annots = p.annots.map(function (y) { return y.id === fin.id ? fin : y; }); });
    }
    pageEl.addEventListener('pointermove', mv); pageEl.addEventListener('pointerup', up); pageEl.addEventListener('pointercancel', up);
  }
  function onDbl(e) {
    var g = e.target.closest('.annots [data-aid]'); if (!g) return;
    var a = findAnnot(g.getAttribute('data-aid'));
    if (a && a.type === 'text') { editing = { id: a.id, isNew: false, before: a.text }; openTextEditor(a); }
  }
  Ed.editSelectedText = function () { var a = Ed.getSelected(); if (a && a.type === 'text') { editing = { id: a.id, isNew: false, before: a.text }; openTextEditor(a); return true; } return false; };

  /* -------------------------------------------------------------- text */
  function openTextEditor(a) {
    var c = ctx(), z = c.z, t = E.textLayout(Object.assign({}, a, { text: a.text || 'M' }));
    Ed.selId = a.id; Ed.paint();
    ta.hidden = false; ta.value = a.text || '';
    ta.style.fontFamily = E.CSSFONT[a.font] || E.CSSFONT.Helvetica;
    ta.style.fontSize = (t.size * z) + 'px'; ta.style.lineHeight = (t.lh * z) + 'px';
    ta.style.fontWeight = a.bold ? '700' : '400'; ta.style.fontStyle = a.italic ? 'italic' : 'normal';
    ta.style.color = a.color || '#000';
    ta.style.padding = (t.pad * z) + 'px';
    placeTA(a);
    setTimeout(function () { ta.focus(); ta.setSelectionRange(ta.value.length, ta.value.length); }, 0);
    if (SP.app) SP.app.editorSelectionChanged();
  }
  function placeTA(a) {
    var c = ctx(), z = c.z, t = E.textLayout(Object.assign({}, a, { text: a.text || 'M' }));
    var va = (((c.R - (a.rot || 0)) % 360) + 360) % 360, cv = E.toView(c.R, c.W, c.H, a.cx, a.cy);
    var w = Math.max(t.w, t.size * 2) + t.size, h = t.h;
    ta.style.width = (w * z) + 'px'; ta.style.height = (h * z) + 'px';
    // anchor: the annotation's local top-left stays put while typing
    var lx = -a.w / 2, ly = -a.h / 2;
    var ang = va * Math.PI / 180, ox = cv[0] + lx * Math.cos(ang) - ly * Math.sin(ang), oy = cv[1] + lx * Math.sin(ang) + ly * Math.cos(ang);
    ta.style.left = (ox * z) + 'px'; ta.style.top = (oy * z) + 'px';
    ta.style.transformOrigin = '0 0'; ta.style.transform = va ? 'rotate(' + va + 'deg)' : 'none';
  }
  function onTextInput() {
    if (!editing) return;
    var a = findAnnot(editing.id); if (!a) return;
    var c = ctx(), va = (((c.R - (a.rot || 0)) % 360) + 360) % 360;
    // keep local top-left fixed while the box grows
    var cv = E.toView(c.R, c.W, c.H, a.cx, a.cy), ang = va * Math.PI / 180;
    var ox = cv[0] + (-a.w / 2) * Math.cos(ang) - (-a.h / 2) * Math.sin(ang), oy = cv[1] + (-a.w / 2) * Math.sin(ang) + (-a.h / 2) * Math.cos(ang);
    a.text = ta.value;
    var t = E.textLayout(Object.assign({}, a, { text: a.text || 'M' }));
    a.w = t.w; a.h = t.h;
    var ncx = ox + (a.w / 2) * Math.cos(ang) - (a.h / 2) * Math.sin(ang), ncy = oy + (a.w / 2) * Math.sin(ang) + (a.h / 2) * Math.cos(ang);
    var pc = E.toPage(c.R, c.W, c.H, ncx, ncy); a.cx = pc[0]; a.cy = pc[1];
    placeTA(a);
  }
  function finishText(commit) {
    if (!editing) return;
    var ed = editing; editing = null;
    ta.hidden = true;
    var p = Ed.page(), a = findAnnot(ed.id);
    if (!p || !a) { Ed.paint(); return; }
    var fin = JSON.parse(JSON.stringify(a)), empty = !String(fin.text || '').trim();
    // undo the live (uncommitted) edits, then commit the result as one step
    if (ed.isNew) p.annots = p.annots.filter(function (x) { return x.id !== ed.id; });
    else { a.text = ed.before; var t0 = E.textLayout(a); void t0; }
    if (!ed.isNew) { var o = fin; o.text = ed.before; var tl = E.textLayout(o); void tl; }
    if (commit && !empty) {
      fin.text = ta.value;
      var t = E.textLayout(fin);
      if (ed.isNew) { Ed.addAnnot(fin, 'Add text'); Ed.tool = 'select'; pageEl.dataset.tool = 'select'; if (SP.app) SP.app.toolChanged(); }
      else if (fin.text !== ed.before) {
        void t;
        commitPage('Edit text', function (pp) { pp.annots = pp.annots.map(function (y) { return y.id === fin.id ? fin : y; }); });
      } else { restoreGeom(a, fin); Ed.paint(); }
    } else if (!ed.isNew && empty) {
      commitPage('Delete text', function (pp) { pp.annots = pp.annots.filter(function (y) { return y.id !== fin.id; }); });
      Ed.select(null);
    } else Ed.paint();
  }
  function restoreGeom(a, fin) { a.text = fin.text; a.w = fin.w; a.h = fin.h; a.cx = fin.cx; a.cy = fin.cy; }
  Ed.isEditingText = function () { return !!editing; };
  Ed.commitText = function () { finishText(true); };

  /* ------------------------------------------------------- pan & pinch */
  var pinch = null, touches = new Map();
  function startPan(e) {
    var sx = e.clientX, sy = e.clientY, sl = viewer.scrollLeft, st = viewer.scrollTop, pid = e.pointerId;
    function mv(ev) { if (ev.pointerId !== pid || pinch) return; viewer.scrollLeft = sl - (ev.clientX - sx); viewer.scrollTop = st - (ev.clientY - sy); }
    function up(ev) { if (ev.pointerId !== pid) return; window.removeEventListener('pointermove', mv); window.removeEventListener('pointerup', up); window.removeEventListener('pointercancel', up); viewer.classList.remove('panning'); }
    viewer.classList.add('panning');
    window.addEventListener('pointermove', mv); window.addEventListener('pointerup', up); window.addEventListener('pointercancel', up);
  }
  function onViewerDown(e) {
    if (e.pointerType !== 'touch') return;
    touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (touches.size === 2 && !pinch) {
      Ed.cancelInteraction();
      var pts = Array.from(touches.values());
      pinch = { d0: Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y) || 1, z0: Ed.zoom, mid: { x: (pts[0].x + pts[1].x) / 2, y: (pts[0].y + pts[1].y) / 2 } };
      var r = pageEl.getBoundingClientRect();
      pinch.cx = (pinch.mid.x - r.left) / Ed.zoom; pinch.cy = (pinch.mid.y - r.top) / Ed.zoom;
    }
  }
  window.addEventListener('pointermove', function (e) {
    if (!touches.has(e.pointerId)) return;
    touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (!pinch || touches.size < 2) return;
    var pts = Array.from(touches.values()), d = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
    var mid = { x: (pts[0].x + pts[1].x) / 2, y: (pts[0].y + pts[1].y) / 2 };
    var z = U.clamp(pinch.z0 * d / pinch.d0, 0.1, 8);
    Ed.zoomMode = 'num'; Ed.zoom = z; Ed.layout();
    var r = pageEl.getBoundingClientRect();
    viewer.scrollLeft += (r.left + pinch.cx * z) - mid.x;
    viewer.scrollTop += (r.top + pinch.cy * z) - mid.y;
  }, { passive: true });
  function endTouch(e) { touches.delete(e.pointerId); if (touches.size < 2) pinch = null; }
  window.addEventListener('pointerup', endTouch); window.addEventListener('pointercancel', endTouch);
})();
