/* Slop Vector — ui: context menus, theme, prefs and UI refresh */
(function () {
  'use strict';
  var G = window.SVGeom, SV = window.SV, S = SV.state, D = SV.dom, IO = SV.io, C = SV.cmd;
  var clone = SV.clone, getObj = SV.getObj, esc = SV.esc, fmt = G.fmt;
  var abs = Math.abs, min = Math.min, max = Math.max, round = Math.round, PI = Math.PI;
  var UI = SV.ui = SV.ui || {}; UI.st = UI.st || {};
  var IS_MAC = SV.IS_MAC;
  var $ = UI._p = UI._p || {};
  function act() { return $.act.apply(this, arguments); }
  function buildControlBar() { return $.buildControlBar.apply(this, arguments); }
  function controlContext() { return $.controlContext.apply(this, arguments); }
  function keyLabel() { return $.keyLabel.apply(this, arguments); }
  function newLayer() { return $.newLayer.apply(this, arguments); }
  function renderLayers() { return $.renderLayers.apply(this, arguments); }
  function runBinds() { return $.runBinds.apply(this, arguments); }
  function swatches() { return $.swatches.apply(this, arguments); }
  var A = $.A;

  /* ================= context menus (shared SlopUI kit) ================= */
  function mi(id, label) {
    var a = A[id]; if (!a) return null;
    return { label: label || a.label, key: UI.actKey(a), disabled: a.enabled ? !a.enabled() : false, check: a.checked ? a.checked() : false, act: function () { SV.runAction(id); } };
  }
  UI.canvasMenu = function (x, y) {
    var any = S.sel.length > 0;
    var items = [mi('edit.undo'), mi('edit.redo'), '-'];
    if (any) items.push(mi('edit.cut'), mi('edit.copy'));
    items.push(mi('edit.paste'), mi('edit.pasteFront'));
    if (any) {
      items.push(mi('edit.duplicate'), mi('edit.clear'), '-', mi('object.group'), mi('object.ungroup'),
        { label: 'Arrange', sub: [mi('arrange.front'), mi('arrange.forward'), mi('arrange.backward'), mi('arrange.back')] },
        { label: 'Transform', sub: [mi('transform.move'), mi('transform.rotate'), mi('transform.scale'), mi('transform.reflect'), '-', mi('transform.flipH'), mi('transform.flipV')] },
        { label: 'Pathfinder', sub: [mi('pf.unite'), mi('pf.minus'), mi('pf.intersect'), mi('pf.exclude')] },
        mi('compound.make'), mi('object.expand'), '-', mi('object.lock'), mi('object.hide'), '-', mi('object.slopify'));
    } else {
      items.push('-', mi('select.all'), mi('object.unlockAll'), mi('object.showAll'), '-', mi('view.fit'), mi('view.outline'), mi('view.grid'), mi('view.rulers'), '-', mi('file.docSetup'));
    }
    return window.SlopUI.menu(items, x, y);
  };
  UI.layerMenu = function (id, x, y) {
    var L = SV.getLayer(id), o = L ? null : getObj(id), it = L || o; if (!it) return null;
    var rename = { label: 'Rename…', act: function () { UI.st.renaming = id; UI.st.layersSig = ''; renderLayers(); } };
    var vis = { label: it.hidden ? 'Show' : 'Hide', act: function () { it.hidden = !it.hidden; SV.commit(it.hidden ? 'hide' : 'show'); } };
    var lock = { label: it.locked ? 'Unlock' : 'Lock', act: function () { it.locked = !it.locked; SV.commit(it.locked ? 'lock' : 'unlock'); } };
    var items;
    if (L) {
      S.activeLayer = id; SV.requestRender(true);
      items = [rename, vis, lock, '-', { label: 'Select All on Layer', act: function () { C.selectLayer(); } }, { label: 'New Layer', act: newLayer },
        { label: 'Delete Layer', disabled: S.doc.layers.length <= 1, act: function () { var i = S.doc.layers.indexOf(L); if (i < 0 || S.doc.layers.length <= 1) return; S.doc.layers.splice(i, 1); S.activeLayer = S.doc.layers[Math.max(0, i - 1)].id; SV.commit('delete layer'); } }];
    } else {
      if (SV.isEditable(o) && S.sel.indexOf(id) < 0) SV.select([id]);
      items = [rename, vis, lock, '-', mi('edit.duplicate'), mi('edit.clear'), '-', mi('arrange.front'), mi('arrange.back'), mi('object.group'), mi('object.ungroup')];
    }
    return window.SlopUI.menu(items, x, y);
  };
  function bindContextMenus() {
    D.stage.addEventListener('contextmenu', function (e) {
      e.preventDefault();
      if (S.editing) SV.commitTextEdit();
      if (S.pen) SV.finishPen();
      var hit = SV.hitTest(SV.evDoc(e));
      if (hit) {
        var t = S.sel.indexOf(hit.obj.id) >= 0 ? hit.obj.id : hit.top.id;
        if (S.sel.indexOf(t) < 0) SV.select([t]);
      }
      UI.closeMenus();
      UI.canvasMenu(e.clientX, e.clientY);
    });
    document.getElementById('dock').addEventListener('contextmenu', function (e) {
      var r = e.target.closest && e.target.closest('.lrow'); if (!r) return;
      e.preventDefault();
      UI.layerMenu(r.getAttribute('data-id'), e.clientX, e.clientY);
    });
  }

  /* ================= theme & prefs ================= */
  UI.st.currentTheme = 'pro';
  function setTheme(t) {
    UI.st.currentTheme = t;
    document.documentElement.setAttribute('data-theme', t);
    SV.lsSet('slopvector.theme', t);
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', t === 'light' ? '#e8e8e8' : t === 'classic' ? '#008080' : '#1e1e1e');
    var cs = document.querySelector('meta[name="color-scheme"]'); if (cs) cs.setAttribute('content', t === 'pro' ? 'dark' : 'light');
    UI.st.rulerColors = null;
    SV.requestRender(true);
  }
  UI.setTheme = setTheme;
  function savePrefs() { SV.lsSet('slopvector.prefs', JSON.stringify({ prefs: S.prefs, tabs: UI.st.activeTabs, collapsed: UI.st.collapsed })); }
  function loadPrefs() {
    try { var o = JSON.parse(SV.lsGet('slopvector.prefs') || 'null'); if (o) { Object.assign(S.prefs, o.prefs || {}); Object.assign(UI.st.activeTabs, o.tabs || {}); UI.st.collapsed = o.collapsed || {}; } } catch (e) { /* ignore */ }
    S.prefs.outline = false;
  }

  /* ================= update ================= */
  UI.update = function () {
    var ctx = controlContext(), sig = JSON.stringify([ctx.n > 0, Object.keys(ctx.types).sort(), ctx.tool, ctx.editing]);
    if (sig !== UI.st.cbSig) { UI.st.cbSig = sig; buildControlBar(ctx); }
    ['toolbar', 'cb', 'props', 'app', 'layers', 'swatches', 'grad', 'align', 'status'].forEach(runBinds);
    document.getElementById('stage').setAttribute('data-tool', S.tool);
  };

  $.bindContextMenus = bindContextMenus; $.loadPrefs = loadPrefs; $.mi = mi; $.savePrefs = savePrefs; $.setTheme = setTheme;
})();
