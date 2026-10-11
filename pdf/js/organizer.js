/* Slop PDF — page organizer: thumbnail grid with lazy pdf.js rendering, multi-select
   (click / shift / ctrl-cmd / marquee / keyboard), pointer drag-and-drop reordering
   (mouse drag, touch long-press or grip handle), keyboard reordering (Alt+Arrows). */
(function () {
  'use strict';
  var SP = window.SP, U = SP.util, E = SP.engine, V = SP.view;
  var O = SP.organizer = {};
  var grid, scroller, els = new Map(), io = null, size = U.store.get('thumbSize', 168);
  O.sel = new Set(); O.anchor = null; O.focusId = null;

  O.init = function (gridEl, scrollEl) {
    grid = gridEl; scroller = scrollEl;
    grid.style.setProperty('--thumb', size + 'px');
    io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) { if (en.isIntersecting) { var el = en.target; el._visible = true; loadThumb(el); } else en.target._visible = false; });
    }, { root: scroller, rootMargin: '400px 0px' });
    grid.addEventListener('pointerdown', onDown);
    grid.addEventListener('dblclick', function (e) { var t = e.target.closest('.thumb'); if (t && !e.target.closest('button')) SP.app.openPage(t.dataset.id); });
    grid.addEventListener('contextmenu', onContext);
    // once a touch drag has started, stop the browser from scrolling instead
    grid.addEventListener('touchmove', function (e) { if (drag) e.preventDefault(); }, { passive: false });
    grid.addEventListener('keydown', onKey);
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
  O.setSize = function (px) { size = px; U.store.set('thumbSize', px); grid.style.setProperty('--thumb', px + 'px'); O.render(true); };
  O.getSize = function () { return size; };
  O.selected = function () { return E.state.pages.filter(function (p) { return O.sel.has(p.id); }).map(function (p) { return p.id; }); };
  O.selectedIndices = function () { var out = []; E.state.pages.forEach(function (p, i) { if (O.sel.has(p.id)) out.push(i); }); return out; };
  O.setSelection = function (ids, anchor) { O.sel = new Set(ids); if (anchor !== undefined) O.anchor = anchor; syncSel(); };
  O.selectAll = function () { O.setSelection(E.state.pages.map(function (p) { return p.id; })); };
  function toggle(id) { if (O.sel.has(id)) O.sel.delete(id); else O.sel.add(id); O.anchor = id; syncSel(); }

  function thumbBox() { return { w: size, h: Math.round(size * 1.3) }; }
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
      U.h('span', { class: 'thumb-part', hidden: true }));
    io.observe(el);
    return el;
  }
  function loadThumb(el) {
    var p = E.pageById(el.dataset.id); if (!p || !el._sheet) return;
    var dpr = Math.min(2.5, window.devicePixelRatio || 1);
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
      badge.hidden = !na; if (na) badge.innerHTML = U.icon('edit') + na;
      var part = el.querySelector('.thumb-part');
      if (parts && parts[i]) { part.hidden = false; part.textContent = parts[i]; part.className = 'thumb-part' + (parts[i].charAt(0) === '✂' ? ' cut' : ''); } else part.hidden = true;
      if (grid.children[i] !== el) grid.insertBefore(el, grid.children[i] || null);
      if (el._visible) loadThumb(el);
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

  /* ------------------------------------------------------------ pointer */
  var press = null, drag = null, marquee = null;
  function onDown(e) {
    if (e.button > 0) return;
    if (e.target.closest('.thumb-tools button, .thumb-check')) return;
    var t = e.target.closest('.thumb');
    if (!t) { startMarquee(e); return; }
    var id = t.dataset.id, touch = e.pointerType !== 'mouse', grip = !!e.target.closest('.thumb-grip');
    var mod = e.ctrlKey || e.metaKey, shift = e.shiftKey;
    O.focusId = id;
    if (!touch) {
      if (shift && O.anchor && els.has(O.anchor)) { rangeSelect(O.anchor, id, mod); }
      else if (mod) toggle(id);
      else if (!O.sel.has(id)) { O.setSelection([id], id); }
      t.focus({ preventScroll: true });
    }
    press = { id: id, x: e.clientX, y: e.clientY, pid: e.pointerId, touch: touch, mod: mod || shift, timer: null, el: t, started: false };
    if (touch) {
      if (grip) { if (!O.sel.has(id)) O.setSelection([id], id); beginDrag(e); }
      else press.timer = setTimeout(function () {
        if (!press) return;
        if (!O.sel.has(id)) { O.sel.add(id); O.anchor = id; syncSel(); }
        if (navigator.vibrate) try { navigator.vibrate(12); } catch (er) { /* ignore */ }
        beginDrag({ clientX: press.x, clientY: press.y });
      }, 380);
    }
    window.addEventListener('pointermove', onMove, { passive: false });
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onCancel);
    if (!touch || grip) e.preventDefault();
  }
  function rangeSelect(a, b, add) {
    var ia = E.indexOf(a), ib = E.indexOf(b); if (ia < 0 || ib < 0) return;
    var lo = Math.min(ia, ib), hi = Math.max(ia, ib), ids = add ? Array.from(O.sel) : [];
    for (var i = lo; i <= hi; i++) ids.push(E.state.pages[i].id);
    O.sel = new Set(ids); syncSel();
  }
  function onMove(e) {
    if (!press) return;
    if (drag) { e.preventDefault(); moveDrag(e); return; }
    var d = Math.hypot(e.clientX - press.x, e.clientY - press.y);
    if (press.touch) { if (d > 10 && press.timer) { clearTimeout(press.timer); press.timer = null; cleanupPress(); } return; }
    if (d > 6) { beginDrag(e); moveDrag(e); }
  }
  function onUp(e) {
    if (!press) return;
    if (drag) { endDrag(e, true); }
    else {
      if (press.timer) clearTimeout(press.timer);
      if (press.touch) {
        // tap selects one page; the round check button adds/removes pages for multi-select
        O.setSelection([press.id], press.id);
        press.el.focus({ preventScroll: true });
      } else if (!press.mod && O.sel.size > 1) O.setSelection([press.id], press.id);
      else if (!press.mod) O.anchor = press.id;
    }
    cleanupPress();
  }
  function onCancel() { if (drag) endDrag(null, false); cleanupPress(); }
  function cleanupPress() {
    if (press && press.timer) clearTimeout(press.timer);
    press = null;
    window.removeEventListener('pointermove', onMove);
    window.removeEventListener('pointerup', onUp);
    window.removeEventListener('pointercancel', onCancel);
  }
  function beginDrag(e) {
    if (drag || !press) return;
    if (!O.sel.has(press.id)) O.setSelection([press.id], press.id);
    var ids = O.selected();
    var ghost = U.h('div', { class: 'drag-ghost' });
    var src = els.get(press.id) && els.get(press.id).querySelector('.sheet');
    if (src) { var c = src.cloneNode(true); c.style.transform = 'scale(' + (90 / Math.max(src.offsetWidth, src.offsetHeight, 1)) + ')'; c.style.transformOrigin = '0 0'; ghost.appendChild(U.h('div', { class: 'drag-ghost-sheet' }, c)); }
    if (ids.length > 1) ghost.appendChild(U.h('span', { class: 'drag-count' }, String(ids.length)));
    document.body.appendChild(ghost);
    var marker = U.h('div', { class: 'drop-marker' });
    grid.appendChild(marker);
    ids.forEach(function (id) { var el = els.get(id); if (el) el.classList.add('dragging'); });
    drag = { ids: ids, ghost: ghost, marker: marker, before: null, raf: 0, lastE: e };
    document.body.classList.add('is-dragging');
    autoScroll();
  }
  function moveDrag(e) {
    drag.lastE = e;
    drag.ghost.style.transform = 'translate(' + (e.clientX + 12) + 'px,' + (e.clientY + 12) + 'px)';
    var r = computeBefore(e.clientX, e.clientY);
    drag.before = r.before;
    if (r.rect) {
      var gr = grid.getBoundingClientRect();
      drag.marker.style.display = 'block';
      drag.marker.style.left = (r.x - gr.left - 3) + 'px';
      drag.marker.style.top = (r.rect.top - gr.top) + 'px';
      drag.marker.style.height = r.rect.height + 'px';
    }
  }
  function computeBefore(x, y) {
    var kids = Array.prototype.filter.call(grid.children, function (c) { return c.classList.contains('thumb'); });
    if (!kids.length) return { before: 0 };
    var best = null, bd = Infinity;
    kids.forEach(function (k, i) {
      var r = k.getBoundingClientRect();
      var dy = y < r.top ? r.top - y : y > r.bottom ? y - r.bottom : 0;
      var dx = x < r.left ? r.left - x : x > r.right ? x - r.right : 0;
      var d = dy * 4 + dx;
      if (d < bd) { bd = d; best = { i: i, r: r }; }
    });
    var after = x > best.r.left + best.r.width / 2;
    var gap = 8;
    return { before: best.i + (after ? 1 : 0), rect: best.r, x: after ? best.r.right + gap / 2 : best.r.left - gap / 2 };
  }
  function autoScroll() {
    if (!drag) return;
    var e = drag.lastE;
    if (e && e.clientY != null) {
      var r = scroller.getBoundingClientRect(), edge = 60, v = 0;
      if (e.clientY < r.top + edge) v = -Math.ceil((r.top + edge - e.clientY) / 4);
      else if (e.clientY > r.bottom - edge) v = Math.ceil((e.clientY - (r.bottom - edge)) / 4);
      if (v) { scroller.scrollTop += v; moveDrag(e); }
    }
    drag.raf = requestAnimationFrame(autoScroll);
  }
  function endDrag(e, commit) {
    var d = drag; drag = null;
    cancelAnimationFrame(d.raf);
    d.ghost.remove(); d.marker.remove();
    document.body.classList.remove('is-dragging');
    els.forEach(function (el) { el.classList.remove('dragging'); });
    if (!commit || d.before == null) return;
    var before = d.before, idx = O.selectedIndices();
    // no-op if dropping in place
    var contiguous = idx.every(function (v, k) { return k === 0 || v === idx[k - 1] + 1; });
    if (contiguous && before >= idx[0] && before <= idx[idx.length - 1] + 1) return;
    E.commit('Move ' + (d.ids.length > 1 ? d.ids.length + ' pages' : 'page'), function (st) { E.ops.move(st, d.ids, before); });
    var ni = E.indexOf(d.ids[0]);
    SP.app.announce('Moved ' + (d.ids.length > 1 ? d.ids.length + ' pages' : 'page') + ' to position ' + (ni + 1));
  }

  function startMarquee(e) {
    if (e.pointerType !== 'mouse') return;
    var gr = grid.getBoundingClientRect();
    var base = (e.ctrlKey || e.metaKey || e.shiftKey) ? new Set(O.sel) : new Set();
    if (!base.size) O.setSelection([]);
    var box = U.h('div', { class: 'marquee' }); grid.appendChild(box);
    marquee = { x: e.clientX, y: e.clientY, box: box, base: base };
    var rects = null;
    function mv(ev) {
      var x1 = Math.min(marquee.x, ev.clientX), y1 = Math.min(marquee.y, ev.clientY), x2 = Math.max(marquee.x, ev.clientX), y2 = Math.max(marquee.y, ev.clientY);
      var g2 = grid.getBoundingClientRect();
      box.style.left = (x1 - g2.left) + 'px'; box.style.top = (y1 - g2.top) + 'px'; box.style.width = (x2 - x1) + 'px'; box.style.height = (y2 - y1) + 'px';
      if (x2 - x1 < 3 && y2 - y1 < 3) return;
      rects = rects || Array.from(els.entries());
      var s = new Set(marquee.base);
      rects.forEach(function (kv) { var r = kv[1].getBoundingClientRect(); if (r.right > x1 && r.left < x2 && r.bottom > y1 && r.top < y2) s.add(kv[0]); });
      O.sel = s; syncSel();
    }
    function up() { box.remove(); marquee = null; window.removeEventListener('pointermove', mv); window.removeEventListener('pointerup', up); }
    window.addEventListener('pointermove', mv); window.addEventListener('pointerup', up);
    e.preventDefault();
    void gr;
  }

  function onContext(e) {
    var t = e.target.closest('.thumb'); if (!t) return;
    e.preventDefault();
    if (drag || (press && press.touch)) return; // long-press on touch starts a drag, not a menu
    var id = t.dataset.id;
    if (!O.sel.has(id)) O.setSelection([id], id);
    SlopUI.menu(SP.app.pageMenuItems(), e.clientX, e.clientY);
  }

  /* ------------------------------------------------------------ keyboard */
  function columns() {
    var kids = Array.prototype.filter.call(grid.children, function (c) { return c.classList.contains('thumb'); });
    if (kids.length < 2) return 1;
    var top = kids[0].offsetTop, n = 0;
    for (var i = 0; i < kids.length; i++) { if (kids[i].offsetTop !== top) break; n++; }
    return Math.max(1, n);
  }
  function onKey(e) {
    var t = e.target.closest('.thumb'); if (!t) return;
    var pages = E.state.pages, i = E.indexOf(t.dataset.id), cols = columns(), step = 0;
    var mod = e.ctrlKey || e.metaKey;
    switch (e.key) {
      case 'ArrowLeft': step = -1; break;
      case 'ArrowRight': step = 1; break;
      case 'ArrowUp': step = -cols; break;
      case 'ArrowDown': step = cols; break;
      case 'Home': step = -i; break;
      case 'End': step = pages.length - 1 - i; break;
    }
    if (step) {
      e.preventDefault();
      if (e.altKey || (mod && e.shiftKey)) { // move selection
        if (!O.sel.size) O.setSelection([t.dataset.id], t.dataset.id);
        var idx = O.selectedIndices(), ids = O.selected(), before;
        if (step < 0) before = Math.max(0, idx[0] + step); else before = Math.min(pages.length, idx[idx.length - 1] + 1 + step);
        E.commit('Move ' + (ids.length > 1 ? ids.length + ' pages' : 'page'), function (st) { E.ops.move(st, ids, before); });
        O.focus(t.dataset.id);
        SP.app.announce((ids.length > 1 ? ids.length + ' pages' : 'Page') + ' moved to position ' + (E.indexOf(ids[0]) + 1) + ' of ' + E.state.pages.length);
        return;
      }
      var j = U.clamp(i + step, 0, pages.length - 1), nid = pages[j].id;
      if (e.shiftKey) { rangeSelect(O.anchor || t.dataset.id, nid, false); }
      else if (!mod) O.setSelection([nid], nid);
      O.focus(nid);
      return;
    }
    if (e.key === ' ' || e.key === 'Spacebar') { e.preventDefault(); if (mod) toggle(t.dataset.id); else if (O.sel.has(t.dataset.id) && O.sel.size === 1) toggle(t.dataset.id); else toggle(t.dataset.id); return; }
    if (e.key === 'Enter') { e.preventDefault(); SP.app.openPage(t.dataset.id); return; }
    if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); var ids2 = O.sel.size ? O.selected() : [t.dataset.id]; SP.app.remove(ids2); return; }
    if ((e.key === 'r' || e.key === 'R') && !mod) { e.preventDefault(); SP.app.rotate(O.sel.size ? O.selected() : [t.dataset.id], e.shiftKey ? -90 : 90); return; }
    if (e.key === 'ContextMenu' || (e.shiftKey && e.key === 'F10')) { e.preventDefault(); var r = t.getBoundingClientRect(); if (!O.sel.has(t.dataset.id)) O.setSelection([t.dataset.id], t.dataset.id); SlopUI.menu(SP.app.pageMenuItems(), r.left + 20, r.top + 20); }
  }
})();
