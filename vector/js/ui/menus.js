/* Slop Vector — ui: menu bar and dropdowns */
(function () {
  'use strict';
  var G = window.SVGeom, SV = window.SV, S = SV.state, D = SV.dom, IO = SV.io, C = SV.cmd;
  var clone = SV.clone, getObj = SV.getObj, esc = SV.esc, fmt = G.fmt;
  var abs = Math.abs, min = Math.min, max = Math.max, round = Math.round, PI = Math.PI;
  var UI = SV.ui = SV.ui || {}; UI.st = UI.st || {};
  var IS_MAC = SV.IS_MAC;
  var $ = UI._p = UI._p || {};
  function btn() { return $.btn.apply(this, arguments); }
  function firstOfType() { return $.firstOfType.apply(this, arguments); }
  function h() { return $.h.apply(this, arguments); }
  function keyLabel() { return $.keyLabel.apply(this, arguments); }
  function mi() { return $.mi.apply(this, arguments); }
  function row() { return $.row.apply(this, arguments); }
  var A = $.A;
  var I = $.I;
  var PANEL_IDS = $.PANEL_IDS;

  /* ================= menus ================= */
  var MENUS = [
    { label: 'File', items: ['file.new', 'file.open', 'file.sample', '-', 'file.place', '-', 'file.save', 'file.saveAs', { label: 'Export', items: ['file.exportSVG', 'file.exportPNG', 'file.exportJPG', 'file.exportPDF', 'file.exportAI'] }, '-', 'file.docSetup', '-', 'file.downloadApp', '-', 'file.home'] },
    { label: 'Edit', items: ['edit.undo', 'edit.redo', '-', 'edit.cut', 'edit.copy', 'edit.paste', 'edit.pasteFront', 'edit.pasteBack', 'edit.clear', '-', 'edit.duplicate', 'select.all', 'select.none', '-', 'edit.prefs'] },
    { label: 'Object', items: [{ label: 'Transform', items: ['transform.move', 'transform.rotate', 'transform.scale', 'transform.reflect', '-', 'transform.flipH', 'transform.flipV'] }, { label: 'Arrange', items: ['arrange.front', 'arrange.forward', 'arrange.backward', 'arrange.back'] }, '-', 'object.group', 'object.ungroup', '-', 'object.lock', 'object.unlockAll', 'object.hide', 'object.showAll', '-', 'object.expand', { label: 'Compound Path', items: ['compound.make', 'compound.release'] }, { label: 'Pathfinder', items: ['pf.unite', 'pf.minus', 'pf.intersect', 'pf.exclude'] }, '-', 'object.slopify'] },
    { label: 'Type', items: [{ label: 'Font', dyn: 'fonts' }, { label: 'Size', dyn: 'sizes' }, { label: 'Weight', dyn: 'weights' }, '-', 'type.alignLeft', 'type.alignCenter', 'type.alignRight', '-', { label: 'Change Case', items: ['type.upper', 'type.lower', 'type.title'] }, 'type.ipsum'] },
    { label: 'Select', items: ['select.all', 'select.none', 'select.inverse', '-', { label: 'Same', items: ['select.sameFill', 'select.sameStroke'] }, 'select.layer'] },
    { label: 'View', items: ['view.outline', '-', 'view.zoomIn', 'view.zoomOut', 'view.fit', 'view.actual', '-', 'view.rulers', 'view.grid', 'view.snapGrid', 'view.smart', '-', 'view.guides', 'view.lockGuides', 'view.clearGuides', '-', { label: 'Theme', items: ['theme.pro', 'theme.light', 'theme.classic'] }] },
    { label: 'Window', items: PANEL_IDS.map(function (p) { return 'window.' + p; }).concat(['-', 'window.togglePanels', 'window.reset']) },
    { label: 'Help', items: ['help.shortcuts', 'help.about', '-', 'file.home'] }
  ];
  function dynItems(kind) {
    if (kind === 'fonts') return Object.keys(SV.FONTS).map(function (f) { return { label: f, run: function () { SV.applyFont('family', f); }, checked: function () { return curFont().family === f; }, font: f }; });
    if (kind === 'sizes') return [8, 10, 12, 14, 18, 24, 36, 48, 72, 96, 144].map(function (s) { return { label: s + ' px', run: function () { SV.applyFont('size', s); }, checked: function () { return curFont().size === s; } }; });
    if (kind === 'weights') return [[300, 'Light'], [400, 'Regular'], [500, 'Medium'], [600, 'Semibold'], [700, 'Bold'], [800, 'Extra Bold'], [900, 'Black']].map(function (w) { return { label: w[1] + ' (' + w[0] + ')', run: function () { SV.applyFont('weight', w[0]); }, checked: function () { return +curFont().weight === w[0]; } }; });
    return [];
  }
  function curFont() { var t = firstOfType('text'); return t ? t.font : S.font; }
  UI.st.openMenu = null;
  UI.closeMenus = function () {
    var layer = document.getElementById('menuLayer');
    if (UI.st.openMenu === null) return false;
    layer.innerHTML = ''; UI.st.openMenu = null;
    document.querySelectorAll('.menu-btn.open').forEach(function (b) { b.classList.remove('open'); b.setAttribute('aria-expanded', 'false'); });
    return true;
  };
  function buildMenuList(items, level) {
    var list = h('div', { class: 'menu-list', role: 'menu' });
    items.forEach(function (it) {
      if (it === '-') { list.appendChild(h('div', { class: 'menu-sep', role: 'separator' })); return; }
      var a, label, keys, enabled = true, checked = null, run, sub = null;
      if (typeof it === 'string') { a = A[it]; if (!a) return; label = a.label; keys = a.keyText || keyLabel(a.keys[0]); enabled = !a.enabled || a.enabled(); checked = a.checked ? a.checked() : null; run = function () { SV.runAction(it); }; }
      else if (it.items || it.dyn) { label = it.label; sub = it.items || dynItems(it.dyn); }
      else { label = it.label; run = it.run; checked = it.checked ? it.checked() : null; }
      var row = h('div', { class: 'menu-item' + (enabled ? '' : ' disabled') + (sub ? ' has-sub' : ''), role: 'menuitem', tabindex: '-1', 'aria-disabled': enabled ? null : 'true', 'data-action': typeof it === 'string' ? it : null },
        [h('span', { class: 'mi-check', text: checked ? '✓' : '' }), h('span', { class: 'mi-label', text: label, style: it.font ? { 'font-family': SV.fontStack(it.font) } : null }), h('span', { class: 'mi-key', text: sub ? '' : (keys || '') }), sub ? h('span', { class: 'mi-arrow', html: I.caret }) : null]);
      if (sub) {
        var openSub = function () {
          Array.prototype.forEach.call(list.querySelectorAll(':scope > .menu-item > .menu-list'), function (l) { if (l.parentNode !== row) l.remove(); });
          list.querySelectorAll(':scope > .menu-item.sub-open').forEach(function (r) { if (r !== row) r.classList.remove('sub-open'); });
          if (row.querySelector('.menu-list')) return;
          var sl = buildMenuList(sub, level + 1); sl.classList.add('submenu'); row.appendChild(sl); row.classList.add('sub-open');
          var rr = sl.getBoundingClientRect();
          if (rr.right > window.innerWidth - 4) { sl.classList.add('left'); }
          if (rr.bottom > window.innerHeight - 4) sl.style.top = Math.max(-rr.top + 4, window.innerHeight - 4 - rr.bottom) + 'px';
        };
        row.addEventListener('mouseenter', openSub);
        row.addEventListener('click', function (e) { e.stopPropagation(); openSub(); });
      } else {
        row.addEventListener('mouseenter', function () {
          list.querySelectorAll(':scope > .menu-item.sub-open').forEach(function (r) { r.classList.remove('sub-open'); var l = r.querySelector('.menu-list'); if (l) l.remove(); });
        });
        if (enabled) row.addEventListener('click', function (e) { e.stopPropagation(); UI.closeMenus(); run(); });
      }
      list.appendChild(row);
    });
    return list;
  }
  function openMenuAt(btn, idx) {
    UI.closeMenus();
    var layer = document.getElementById('menuLayer');
    var list = buildMenuList(MENUS[idx].items, 0); list.classList.add('dropdown');
    layer.appendChild(list);
    var r = btn.getBoundingClientRect();
    var left = min(r.left, window.innerWidth - list.offsetWidth - 4);
    list.style.left = max(4, left) + 'px'; list.style.top = r.bottom + 'px';
    list.style.maxHeight = (window.innerHeight - r.bottom - 8) + 'px';
    btn.classList.add('open'); btn.setAttribute('aria-expanded', 'true');
    UI.st.openMenu = idx;
  }
  function buildMenubar() {
    var nav = document.getElementById('menus');
    MENUS.forEach(function (m, i) {
      var b = h('button', { class: 'menu-btn', type: 'button', 'aria-haspopup': 'true', 'aria-expanded': 'false', text: m.label, 'data-menu': m.label });
      b.addEventListener('pointerdown', function (e) { e.preventDefault(); if (UI.st.openMenu === i) UI.closeMenus(); else openMenuAt(b, i); });
      b.addEventListener('mouseenter', function () { if (UI.st.openMenu !== null && UI.st.openMenu !== i) openMenuAt(b, i); });
      b.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown') { e.preventDefault(); openMenuAt(b, i); } });
      nav.appendChild(b);
    });
    document.addEventListener('pointerdown', function (e) {
      if (UI.st.openMenu === null) return;
      if (e.target.closest && (e.target.closest('#menuLayer') || e.target.closest('.menu-btn'))) return;
      UI.closeMenus();
    }, true);
    window.addEventListener('resize', function () { UI.closeMenus(); });
  }

  $.buildMenubar = buildMenubar; $.curFont = curFont;
})();
