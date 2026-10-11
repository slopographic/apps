/* Slop PDF — page organizer grid: keyed thumbnail rendering with lazy pdf.js rasters and the
   selection model. Pointer drag & drop lives in organize/drag.js, keyboard in organize/keys.js. */
(function () {
  'use strict';
  var SP = window.SP, U = SP.util, E = SP.engine, V = SP.view;
  var O = SP.organizer = {};
  var grid, scroller, els = new Map(), io = null, size = U.clamp(+U.store.get('thumbSize', 168) || 168, 80, 4000);
  O.sel = new Set(); O.anchor = null; O.focusId = null;
  var S = O._ = { els: els }; // state shared with organize/drag.js and organize/keys.js

  O.init = function (gridEl, scrollEl) {
    grid = gridEl; scroller = scrollEl; S.grid = grid; S.scroller = scroller;
    grid.style.setProperty('--thumb', size + 'px');
    io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) { if (en.isIntersecting) { var el = en.target; el._visible = true; if (!S.zooming) loadThumb(el); } else en.target._visible = false; });
    }, { root: scroller, rootMargin: '400px 0px' });
    grid.addEventListener('pointerdown', function (e) { S.onDown(e); });
    grid.addEventListener('dblclick', function (e) { var t = e.target.closest('.thumb'); if (t && !e.target.closest('button')) SP.app.openPage(t.dataset.id); });
    grid.addEventListener('contextmenu', function (e) { S.onContext(e); });
    // once a touch drag has started, stop the browser from scrolling instead
    grid.addEventListener('touchmove', function (e) { if (S.dragging()) e.preventDefault(); }, { passive: false });
    grid.addEventListener('keydown', function (e) { S.onKey(e); });
    if (O.initZoom) O.initZoom();
    grid.addEventListener('focusin', function (e) { var t = e.target.closest('.thumb'); if (t) O.focusId = t.dataset.id; });
    grid.addEventListener('click', function (e) {
      var b = e.target.closest('[data-act]'); if (!b) return;
      var t = b.closest('.thumb'), id = t && t.dataset.id; if (!id) return;
      e.stopPropagation();
      var act = b.dataset.act;
      if (act === 'check') { toggle(id); return; }
      var ids = O.sel.has(id) ? O.selected() : [id];
      if (act === 'rotl') SP.app.rotate(ids, -90);
      else if (act === 'rotr') SP.app.rotate(ids, 90);
      else if (act === 'del') SP.app.remove(ids);
      else if (act === 'view') SP.app.openPage(id);
    });
  };
  O.MIN = 80;
  /** Largest useful size: one page per row across the grid's inner width. */
  O.maxSize = function () {
    if (!grid) return 1200;
    var cs = getComputedStyle(grid), w = (scroller || grid).clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
    return w > 0 ? Math.max(O.MIN + 40, Math.floor(w)) : 4000; // hidden grid: no limit yet
  };
  var saveSize = U.debounce(function () { U.store.set('thumbSize', size); }, 300), sizeFns = [];
  O.onSize = function (fn) { sizeFns.push(fn); };
  /** Sets the thumbnail size in CSS px (clamped to MIN..maxSize). Rasters follow once zooming settles. */
  O.setSize = function (px) {
    px = Math.round(U.clamp(px, O.MIN, O.maxSize()));
    if (px === size && grid.style.getPropertyValue('--thumb')) return;
    size = px; saveSize();
    grid.style.setProperty('--thumb', px + 'px');
    S.zooming = true; O.render(); settle();
    sizeFns.forEach(function (fn) { fn(px); });
  };
  var settle = U.debounce(function () { S.zooming = false; els.forEach(function (el) { if (el._visible) loadThumb(el); }); }, 160);
  O.getSize = function () { return size; };
  O.selected = function () { return E.state.pages.filter(function (p) { return O.sel.has(p.id); }).map(function (p) { return p.id; }); };
  O.selectedIndices = function () { var out = []; E.state.pages.forEach(function (p, i) { if (O.sel.has(p.id)) out.push(i); }); return out; };
  O.setSelection = function (ids, anchor) { O.sel = new Set(ids); if (anchor !== undefined) O.anchor = anchor; syncSel(); };
  O.selectAll = function () { O.setSelection(E.state.pages.map(function (p) { return p.id; })); };
  function toggle(id) { if (O.sel.has(id)) O.sel.delete(id); else O.sel.add(id); O.anchor = id; syncSel(); }

  function thumbBox() { var s = Math.min(size, O.maxSize()); return { w: s, h: Math.round(s * 1.3) }; }
  function makeThumb(p) {
    var el = U.h('div', { class: 'thumb', role: 'option', tabindex: '-1', 'data-id': p.id, 'aria-selected': 'false' },
      U.h('div', { class: 'thumb-box' }),
      U.h('button', { class: 'thumb-check', type: 'button', 'data-act': 'check', tabindex: '-1', 'aria-label': 'Toggle selection', html: U.icon('check') }),
      U.h('div', { class: 'thumb-tools' },
        U.h('button', { type: 'button', 'data-act': 'rotl', tabindex: '-1', title: 'Rotate left', 'aria-label': 'Rotate left', html: U.icon('rotl') }),
        U.h('button', { type: 'button', 'data-act': 'rotr', tabindex: '-1', title: 'Rotate right', 'aria-label': 'Rotate right', html: U.icon('rotr') }),
        U.h('button', { type: 'button', 'data-act': 'view', tabindex: '-1', title: 'Open page', 'aria-label': 'Open page', html: U.icon('zoomin') }),
        U.h('button', { type: 'button', 'data-act': 'del', tabindex: '-1', title: 'Delete', 'aria-label': 'Delete page', class: 'danger', html: U.icon('trash') })),
      U.h('div', { class: 'thumb-grip', 'aria-hidden': 'true', html: U.icon('grip') }),
      U.h('div', { class: 'thumb-cap' }, U.h('span', { class: 'fdot' }), U.h('span', { class: 'pnum' }), U.h('span', { class: 'psrc' })),
      U.h('span', { class: 'thumb-badge', hidden: true }),
      U.h('span', { class: 'thumb-part', hidden: true }),
      U.h('span', { class: 'thumb-redact', hidden: true }));
    io.observe(el);
    return el;
  }
  function loadThumb(el) {
    var p = E.pageById(el.dataset.id); if (!p || !el._sheet) return;
    var dpr = Math.min(2, window.devicePixelRatio || 1);
    var vs = E.viewSize(p), g = E.geom(p), sc = el._sheet._scale || 1;
    var px = Math.max(g.W, g.H) * sc * dpr;
    V.loadRaster(el._sheet, p, px);
  }
  /** Re-renders the grid from state (keyed; reuses elements). */
  O.render = function (force) {
    if (!grid) return;
    var pages = E.state.pages, total = pages.length, box = thumbBox(), seen = new Set();
    var parts = SP.app.splitPreview ? SP.app.splitPreview() : null;
    pages.forEach(function (p, i) {
      seen.add(p.id);
      var el = els.get(p.id);
      if (!el) { el = makeThumb(p); els.set(p.id, el); }
      var f = E.fileOfPage(p);
      el.style.setProperty('--fc', f ? f.color : 'var(--faint)');
      if (force) { if (el._sheet) el._sheet._sig = null; }
      el._sheet = V.sheet(el._sheet, p, box.w - 16, box.h - 16, i, total);
      var bx = el.firstChild; if (el._sheet.parentNode !== bx) bx.appendChild(el._sheet);
      el.querySelector('.pnum').textContent = String(i + 1);
      el.querySelector('.psrc').textContent = p.blank ? 'blank' : (E.files.size > 1 ? shortName(f.name) + ' · p' + (p.i + 1) : 'p' + (p.i + 1));
      el.setAttribute('aria-label', 'Page ' + (i + 1) + (p.blank ? ', blank' : ', from ' + (f ? f.name : '') + ' page ' + (p.i + 1)) + (p.rot ? ', rotated ' + p.rot + '°' : ''));
      el.title = p.blank ? 'Blank page' : f.name + ' — page ' + (p.i + 1);
      var badge = el.querySelector('.thumb-badge'), na = (p.annots || []).length;
      var nr = (p.annots || []).filter(function (a) { return a.type === 'redact'; }).length, rb = el.querySelector('.thumb-redact');
      na -= nr; badge.hidden = !na; if (na) badge.innerHTML = U.icon('edit') + na;
      rb.hidden = !(nr || p.redacted); rb.className = 'thumb-redact' + (nr ? ' pending' : '');
      rb.textContent = nr ? nr + ' to redact' : 'Redacted';
      var part = el.querySelector('.thumb-part');
      if (parts && parts[i]) { part.hidden = false; part.textContent = parts[i]; part.className = 'thumb-part' + (parts[i].charAt(0) === '✂' ? ' cut' : ''); } else part.hidden = true;
      if (grid.children[i] !== el) grid.insertBefore(el, grid.children[i] || null);
      if (el._visible && !S.zooming) loadThumb(el);
    });
    els.forEach(function (el, id) { if (!seen.has(id)) { io.unobserve(el); el.remove(); els.delete(id); } });
    O.sel.forEach(function (id) { if (!seen.has(id)) O.sel.delete(id); });
    syncSel();
  };
  function shortName(n) { n = U.baseName(n); return n.length > 14 ? n.slice(0, 12) + '…' : n; }
  function syncSel() {
    els.forEach(function (el, id) { var on = O.sel.has(id); el.classList.toggle('selected', on); el.setAttribute('aria-selected', on ? 'true' : 'false'); });
    var fid = O.focusId && els.has(O.focusId) ? O.focusId : (E.state.pages[0] && E.state.pages[0].id);
    els.forEach(function (el, id) { el.tabIndex = id === fid ? 0 : -1; });
    if (SP.app) SP.app.selectionChanged();
  }
  O.focus = function (id, scroll) {
    var el = els.get(id); if (!el) return;
    O.focusId = id;
    els.forEach(function (e2, i2) { e2.tabIndex = i2 === id ? 0 : -1; });
    el.focus({ preventScroll: true });
    if (scroll !== false) el.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  };
  O.reveal = function (id) { var el = els.get(id); if (el) el.scrollIntoView({ block: 'center' }); };

  S.syncSel = syncSel; S.toggle = toggle; S.loadThumb = loadThumb;
})();
