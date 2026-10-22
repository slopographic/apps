/* Slop PDF — a document in a split pane that is not the focused one. It is a read-only preview: the pages are drawn with
 * pdf.js at this pane's own zoom, and it scrolls on its own. Annotations, text and the tools come with the focus: a click
 * on the pane makes it the live editor (ui/panes.js). Pages are drawn when they come into view.
 *
 * The engine reads the open document's globals (E.files, E.state) for page sizes. withDoc lends them the preview's document
 * for the moment a size is read, and puts the open document back at once. Classic script; exposes SP.panePreview. */
(function () {
  'use strict';
  var SP = window.SP, E = SP.engine, U = SP.util;
  var PV = SP.panePreview = {};
  var ZMIN = 0.2, ZMAX = 8, STEP = 1.25;

  /** Runs fn with the engine looking at doc's files and pages. Synchronous only: the open document is put back at once. */
  function withDoc(doc, fn) {
    var files = E.files, state = E.state;
    E.files = doc.files; E.state = doc.state;
    try { return fn(); } finally { E.files = files; E.state = state; }
  }
  PV.withDoc = withDoc;

  /** The pages of a document as the preview draws them: layout size (points at zoom 1), rotation and the pdf.js page source. */
  function pagesOf(doc) {
    return withDoc(doc, function () {
      return doc.state.pages.map(function (p) {
        var vs = E.viewSize(p);
        return { p: p, w: vs.w, h: vs.h, R: E.rotation(p), blank: !!p.blank, file: p.blank ? null : doc.files.get(p.f), index: p.blank ? -1 : p.i };
      });
    });
  }

  /** A preview of doc in host (a pane element). opts: { title, zoom }. Returns the view: setDoc, setZoom, zoom, destroy. */
  PV.create = function (host, doc, opts) {
    var o = opts || {};
    var root = U.h('div', { class: 'pv-pv' });
    var head = U.h('div', { class: 'pv-pv-head' });
    var name = U.h('span', { class: 'pv-pv-name' }, o.title || 'Document');
    var zo = U.h('button', { type: 'button', class: 'pv-pv-btn', 'aria-label': 'Zoom out' }, '−');
    var pct = U.h('span', { class: 'pv-pv-pct' }, '');
    var zi = U.h('button', { type: 'button', class: 'pv-pv-btn', 'aria-label': 'Zoom in' }, '+');
    var fit = U.h('button', { type: 'button', class: 'pv-pv-btn' }, 'Fit');
    var body = U.h('div', { class: 'pv-pv-body' });
    var note = U.h('p', { class: 'pv-pv-note', role: 'status' }, 'Click to edit this document.');
    head.append(name, zo, pct, zi, fit);
    root.append(head, body, note);
    host.append(root);

    var cur = doc || null, pages = [], tasks = new Map(), zoom = o.zoom || 0, fitting = !o.zoom, io = null, gen = 0;
    var dpr = window.devicePixelRatio || 1;

    function fitZoom() {
      var widest = 0;
      for (var i = 0; i < pages.length; i++) widest = Math.max(widest, pages[i].w);
      var cw = Math.max(120, body.clientWidth - 32);
      return widest ? cw / widest : 1;
    }
    function show() { pct.textContent = Math.round(zoom * 100 / (96 / 72)) + '%'; }
    function cancel(entry) { var t = tasks.get(entry); if (t) { try { t.cancel(); } catch (e) { /* already done */ } tasks.delete(entry); } }
    function drawn(entry) { return entry.zoom === zoom && entry.canvas.dataset.drawn === '1'; }

    /** One page: its box at the zoom, and its canvas drawn once per zoom when it is near the view. */
    function paint(entry) {
      if (drawn(entry)) return;
      cancel(entry);
      var px = Math.max(1, Math.round(entry.p.w * zoom)), py = Math.max(1, Math.round(entry.p.h * zoom));
      var c = entry.canvas;
      c.style.width = px + 'px'; c.style.height = py + 'px';
      c.width = Math.round(px * dpr); c.height = Math.round(py * dpr);
      entry.zoom = zoom; c.dataset.drawn = '0';
      var ctx = c.getContext('2d');
      var mine = gen;
      if (entry.p.blank || !entry.p.file || !entry.p.file.doc) { ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height); c.dataset.drawn = '1'; return; }
      var pending = entry.p.file.doc.getPage(entry.p.index + 1).then(function (pg) {
        if (mine !== gen) return;
        var vp = pg.getViewport({ scale: zoom * dpr, rotation: entry.p.R });
        var task = pg.render({ canvasContext: ctx, viewport: vp });
        tasks.set(entry, task);
        return task.promise;
      }).then(function () { if (mine === gen) { c.dataset.drawn = '1'; tasks.delete(entry); } }, function () { tasks.delete(entry); });
      return pending;
    }
    function watch() {
      if (io) io.disconnect();
      io = new IntersectionObserver(function (list) {
        list.forEach(function (x) { if (x.isIntersecting) paint(x.target.__entry); else cancel(x.target.__entry); });
      }, { root: body, rootMargin: '400px 0px' });
      pages.forEach(function (e) { io.observe(e.box); });
    }
    function build() {
      gen++;
      tasks.forEach(function (t) { try { t.cancel(); } catch (e) { /* done */ } }); tasks.clear();
      body.replaceChildren();
      pages = [];
      note.textContent = '';
      if (!cur) { note.textContent = 'Open a document here from the strip, or pick it in the pane list.'; return; }
      if (cur.pending) { note.textContent = 'Open this document to see its pages.'; return; }
      pages = pagesOf(cur).map(function (pg) {
        var box = U.h('div', { class: 'pv-pv-page' }), canvas = U.h('canvas', { class: 'pv-pv-canvas', 'aria-label': 'Page ' + (pages.length + 1) });
        box.append(canvas);
        body.append(box);
        var entry = { p: pg, box: box, canvas: canvas, zoom: 0 };
        box.__entry = entry;
        return entry;
      });
      if (!pages.length) note.textContent = 'This document has no pages.';
      if (fitting) zoom = fitZoom();
      show();
      pages.forEach(function (e) { e.box.style.width = Math.round(e.p.w * zoom) + 'px'; e.box.style.height = Math.round(e.p.h * zoom) + 'px'; });
      watch();
    }
    function setZoom(z, keepFit) {
      var next = Math.min(ZMAX, Math.max(ZMIN, z));
      if (!keepFit) fitting = false;
      if (next === zoom && pages.length) return;
      zoom = next;
      show();
      gen++;   // canvases drawn at the old zoom are stale
      tasks.forEach(function (t) { try { t.cancel(); } catch (e) { /* done */ } }); tasks.clear();
      pages.forEach(function (e) {
        e.box.style.width = Math.round(e.p.w * zoom) + 'px'; e.box.style.height = Math.round(e.p.h * zoom) + 'px';
        e.canvas.dataset.drawn = '0';
      });
      watch();
    }

    zo.addEventListener('click', function () { setZoom(zoom / STEP); });
    zi.addEventListener('click', function () { setZoom(zoom * STEP); });
    fit.addEventListener('click', function () { fitting = true; setZoom(fitZoom(), true); });
    body.addEventListener('wheel', function (e) {
      if (!e.ctrlKey) return;
      e.preventDefault();
      setZoom(zoom * (e.deltaY < 0 ? STEP : 1 / STEP));
    }, { passive: false });

    build();
    return {
      el: root,
      doc: function () { return cur; },
      /** Shows another document (or none) in this pane, with the same zoom where it fits. */
      setDoc: function (d, title) {
        cur = d || null;
        if (title) name.textContent = title;
        build();
      },
      setTitle: function (t) { name.textContent = t; },
      setZoom: function (z) { setZoom(z); },
      zoom: function () { return zoom; },
      destroy: function () {
        gen++;
        tasks.forEach(function (t) { try { t.cancel(); } catch (e) { /* done */ } }); tasks.clear();
        if (io) io.disconnect();
        root.remove();
      },
    };
  };
})();
