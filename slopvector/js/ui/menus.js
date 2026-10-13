/* SlopVector — ui: menu bar and dropdowns */
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
    { label: 'File', items: ['file.new', 'file.open', 'file.openDrive', 'file.sample', '-', 'file.place', 'file.placeDrive', '-', { label: 'Config', items: ['file.config.export', 'file.config.template', 'file.config.import', 'file.config.ai'] }, '-', 'file.save', 'file.saveAs', { label: 'Export', items: ['file.exportSVG', 'file.exportBuffer', 'file.exportPNG', 'file.exportJPG', 'file.exportPDF', 'file.exportAI'] }, { label: 'Send to', dyn: 'sendto' }, '-', 'file.docSetup', '-', 'file.downloadApp', '-', 'file.home'] },
    { label: 'Edit', items: ['edit.undo', 'edit.redo', '-', 'edit.cut', 'edit.copy', 'edit.copyBuffer', 'edit.paste', 'edit.pasteFront', 'edit.pasteBack', 'edit.clear', '-', 'edit.duplicate', 'select.all', 'select.none', '-', 'edit.prefs', { label: 'Preferences', items: ['edit.nav'] }] },
    { label: 'Object', items: [{ label: 'Transform', items: ['transform.move', 'transform.rotate', 'transform.scale', 'transform.reflect', '-', 'transform.flipH', 'transform.flipV', '-', 'transform.restoreAspect'] }, { label: 'Arrange', items: ['arrange.front', 'arrange.forward', 'arrange.backward', 'arrange.back'] }, '-', 'object.group', 'object.ungroup', '-', 'object.lock', 'object.unlockAll', 'object.hide', 'object.showAll', '-', 'object.expand', { label: 'Compound Path', items: ['compound.make', 'compound.release'] }, { label: 'Clipping Mask', items: ['clip.make', 'clip.release'] }, { label: 'Pathfinder', items: ['pf.unite', 'pf.minus', 'pf.intersect', 'pf.exclude'] }, '-', 'object.slopify'] },
    { label: 'Type', items: [{ label: 'Font', dyn: 'fonts' }, { label: 'Size', dyn: 'sizes' }, { label: 'Weight', dyn: 'weights' }, '-', 'type.alignLeft', 'type.alignCenter', 'type.alignRight', '-', { label: 'Change Case', items: ['type.upper', 'type.lower', 'type.title'] }, 'type.ipsum'] },
    { label: 'Select', items: ['select.all', 'select.none', 'select.inverse', '-', { label: 'Same', items: ['select.sameFill', 'select.sameStroke'] }, 'select.layer'] },
    { label: 'View', items: ['view.outline', '-', 'view.zoomIn', 'view.zoomOut', 'view.fit', 'view.actual', '-', 'view.rulers', 'view.grid', 'view.snapGrid', 'view.smart', '-', 'view.guides', 'view.lockGuides', 'view.snapGuides', 'view.clearGuides', 'view.newGuide', 'view.guideLayout', 'view.guidesFromSel', '-', { label: 'Theme', items: ['theme.pro', 'theme.light', 'theme.classic'] }] },
    { label: 'Window', items: PANEL_IDS.map(function (p) { return 'window.' + p; }).concat(['-', 'window.fillColor', 'window.strokeColor', '-', 'view.guideLayout', '-', 'window.togglePanels', 'window.reset']) },
    { label: 'Help', items: ['help.commands', 'help.shortcuts', 'help.about', '-', 'file.home'] }
  ];
  function dynItems(kind) {
    if (kind === 'fonts') return Object.keys(SV.FONTS).concat(window.SlopFonts ? window.SlopFonts.names().filter(function (n) { return !SV.FONTS[n]; }) : []).map(function (f) { return { label: f, run: function () { SV.applyFont('family', f); }, checked: function () { return curFont().family === f; }, font: f }; }).concat(['-', { label: 'Fonts…', run: function () { if (window.SlopFonts) window.SlopFonts.openPanel({ fonts: [curFont().family], standard: Object.keys(SV.FONTS), onUse: function (u) { SV.applyFont('family', u.use); } }); } }]);
    if (kind === 'sizes') return [8, 10, 12, 14, 18, 24, 36, 48, 72, 96, 144].map(function (s) { return { label: s + ' px', run: function () { SV.applyFont('size', s); }, checked: function () { return curFont().size === s; } }; });
    if (kind === 'sendto') return SV.hub.sendItems().map(function (it) { return it === '-' ? '-' : { label: it.label, run: it.act, disabled: it.disabled }; });
    if (kind === 'weights') return [[300, 'Light'], [400, 'Regular'], [500, 'Medium'], [600, 'Semibold'], [700, 'Bold'], [800, 'Extra Bold'], [900, 'Black']].map(function (w) { return { label: w[1] + ' (' + w[0] + ')', run: function () { SV.applyFont('weight', w[0]); }, checked: function () { return +curFont().weight === w[0]; } }; });
    return [];
  }
  function curFont() { var t = firstOfType('text'); return t ? t.font : S.font; }
  /* Dropdowns render through the shared SlopUI menu (../shared/slopui.js); this file only keeps the
     menubar buttons and the Illustrator-style "hover to switch menus" behaviour. */
  UI.st.openMenu = null;
  function clearBar() {
    UI.st.openMenu = null;
    document.querySelectorAll('.menu-btn.open').forEach(function (b) { b.classList.remove('open'); b.setAttribute('aria-expanded', 'false'); });
  }
  UI.closeMenus = function () {
    var had = UI.st.openMenu !== null || !!document.querySelector('.sui-menu');
    if (window.SlopUI) window.SlopUI.closeMenu();
    clearBar();
    return had;
  };
  function toItems(items) {
    return items.map(function (it) {
      if (it === '-') return '-';
      if (typeof it === 'string') {
        var a = A[it]; if (!a) return null;
        return { label: a.label, key: UI.actKey(a), disabled: a.enabled ? !a.enabled() : false, check: a.checked ? a.checked() : false, act: function () { clearBar(); SV.runAction(it); } };
      }
      if (it.items || it.dyn) { var sub = toItems(it.items || dynItems(it.dyn)); return { label: it.label, sub: sub.length ? sub : [{ label: '(none)', disabled: true }] }; }
      return { label: it.label, disabled: !!it.disabled, check: it.checked ? it.checked() : false, act: function () { clearBar(); it.run(); } };
    }).filter(Boolean);
  }
  UI.menuItems = function (label) { var m = MENUS.filter(function (x) { return x.label === label; })[0]; return m ? toItems(m.items) : []; };
  function openMenuAt(btn, idx) {
    UI.closeMenus();
    var r = btn.getBoundingClientRect();
    var m = window.SlopUI.menu(toItems(MENUS[idx].items), r.left, r.bottom);
    m.classList.add('sv-dropdown'); m.setAttribute('data-menu', MENUS[idx].label);
    m.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') { clearBar(); btn.focus(); }
      else if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
        e.preventDefault();
        var bs = document.querySelectorAll('#menus .menu-btn'), n = bs.length, j = (idx + (e.key === 'ArrowRight' ? 1 : n - 1)) % n;
        openMenuAt(bs[j], j);
      }
    });
    btn.classList.add('open'); btn.setAttribute('aria-expanded', 'true');
    UI.st.openMenu = idx;
  }
  function buildMenubar() {
    var nav = document.getElementById('menus');
    MENUS.forEach(function (m, i) {
      var b = h('button', { class: 'menu-btn', type: 'button', 'aria-haspopup': 'true', 'aria-expanded': 'false', text: m.label, 'data-menu': m.label });
      // SlopUI closes its menu on any outside pointerdown first (capture), so a second press on the open button just closes.
      b.addEventListener('pointerdown', function (e) { e.preventDefault(); if (UI.st.openMenu === i) clearBar(); else openMenuAt(b, i); });
      b.addEventListener('mouseenter', function () { if (UI.st.openMenu !== null && UI.st.openMenu !== i) openMenuAt(b, i); });
      b.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown') { e.preventDefault(); openMenuAt(b, i); } });
      nav.appendChild(b);
    });
    document.addEventListener('pointerdown', function (e) {
      if (UI.st.openMenu === null) return;
      if (e.target.closest && (e.target.closest('.sui-menu') || e.target.closest('.menu-btn'))) return;
      clearBar();
    }, true);
    window.addEventListener('resize', function () { if (UI.st.openMenu !== null) UI.closeMenus(); });
  }

  $.buildMenubar = buildMenubar; $.curFont = curFont;
})();
