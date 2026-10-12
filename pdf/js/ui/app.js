/* Slop PDF — app shell: boot, tool rail, organizer/page-view modes, chrome (toolbar state, status
   bar, live announcements) and change handling. Actions live in ui/actions.js and ui/exports.js,
   menus/themes in ui/menus.js, drop/keyboard/autosave in ui/input.js, Slop Hub in ui/main.js. */
(function () {
  'use strict';
  var SP = window.SP, U = SP.util, E = SP.engine, O = SP.organizer, Ed = SP.editor, PN = SP.panels;
  var A = SP.app = {};
  A.tool = 'organize'; A.mode = 'grid';
  A.insertOpts = { size: 'a4', orient: 'portrait', where: 'after' };
  var $ = U.$, h = U.h;
  var S = A._ = { els: {}, fileNameTouched: false, savedSession: null }; // shared by ui/*.js
  var RAIL = [['organize', 'Organize', 'organize'], ['edit', 'Edit page', 'edit'], ['sign', 'Sign', 'sign'], ['redact', 'Redact', 'redact'], ['numbers', 'Page numbers', 'numbers'], ['watermark', 'Watermark', 'watermark'],
    ['forms', 'Forms', 'forms'], ['compress', 'Compress', 'compress'], ['convert', 'Convert', 'convert'], ['split', 'Split', 'split'], ['metadata', 'Metadata', 'info']];

  var PAGE_TOOLS = { edit: 1, sign: 1, redact: 1 };
  S.RAIL = RAIL;

  /* ---------------------------------------------------------------- boot */
  A.boot = function () {
    ['app', 'rail', 'stage', 'grid', 'viewer', 'empty', 'props', 'ctxGrid', 'ctxPage', 'status', 'fileName', 'btnDownload', 'btnUndo', 'btnRedo', 'menus', 'btnMore', 'btnPanel', 'live', 'busy', 'dropOverlay', 'restore', 'gridWrap']
      .forEach(function (id) { S.els[id] = document.getElementById(id); });
    S.buildRail(); S.buildMenus(); S.buildCtxBars();
    O.init(S.els.grid, S.els.gridWrap);
    Ed.init(S.els.viewer);
    PN.init(S.els.props);
    E.on('change', S.onChange);
    E.on('files', function () { PN.refresh('files'); });
    S.els.btnDownload.addEventListener('click', function () { A.download(); });
    S.els.btnUndo.addEventListener('click', function () { A.undo(); });
    S.els.btnRedo.addEventListener('click', function () { A.redo(); });
    S.els.btnPanel.addEventListener('click', function () { A.togglePanel(); });
    S.els.fileName.addEventListener('input', function () { S.fileNameTouched = true; });
    S.els.fileName.addEventListener('change', function () { S.els.fileName.value = U.safeName(S.els.fileName.value, 'pdf'); });
    $('#emptyOpen').addEventListener('click', function () { A.openDialog(); });
    $('#emptySample').addEventListener('click', function () { A.loadSample(); });
    S.els.restore.addEventListener('click', function () { A.restoreSession(); });
    S.setupDrop(); S.setupKeys();
    A.paintMeta(); // the shared theme script has already painted the page
    A.setTool('organize');
    S.refreshAll();
    E.initFonts().catch(function (e) { console.warn(e); });
    // warm up pdf.js so the first open is snappy
    E.pdfjs().catch(function (e) { A.status('Could not load the PDF engine: ' + e.message, 'err'); });
    A.restoreView(); // ui/view-state.js: the saved session (autosave) and the view it was left in
    if (SP.offline) document.documentElement.classList.add('is-offline');
    document.documentElement.classList.add('ready');
  };

  /* ---------------------------------------------------------------- rail */
  S.buildRail = function () {
    RAIL.forEach(function (t) {
      var b = h('button', { type: 'button', class: 'rail-b', role: 'tab', 'data-tool': t[0], 'aria-selected': 'false', title: t[1], html: U.icon(t[2]) + '<span>' + t[1] + '</span>' });
      b.addEventListener('click', function () { A.setTool(t[0]); if (window.innerWidth <= 900) A.togglePanel(true); });
      S.els.rail.appendChild(b);
    });
  }
  A.setTool = function (t) {
    if (Ed.isEditingText()) Ed.commitText();
    A.tool = t;
    U.$$('.rail-b', S.els.rail).forEach(function (b) { var on = b.dataset.tool === t; b.classList.toggle('on', on); b.setAttribute('aria-selected', on ? 'true' : 'false'); });
    if (PAGE_TOOLS[t]) { if (E.state.pages.length) A.ensurePage(); if (t === 'redact' && Ed.tool !== 'redact') Ed.setTool('redact'); }
    else if (A.mode === 'page') A.showGrid(true);
    PN.show(t);
    O.render();
    S.updateChrome();
  };
  A.ensurePage = function () {
    if (A.mode === 'page' && Ed.page()) return;
    var ids = O.selected(), id = ids[0] || O.focusId || (E.state.pages[0] && E.state.pages[0].id);
    if (id && E.pageById(id)) A.openPage(id, true);
  };
  A.openPage = function (id, keepTool) {
    if (!E.pageById(id)) return;
    A.mode = 'page';
    S.els.app.dataset.mode = 'page';
    if (!keepTool && !PAGE_TOOLS[A.tool]) { A.tool = 'edit'; U.$$('.rail-b', S.els.rail).forEach(function (b) { b.classList.toggle('on', b.dataset.tool === 'edit'); b.setAttribute('aria-selected', b.dataset.tool === 'edit' ? 'true' : 'false'); }); PN.show('edit'); }
    Ed.zoomMode = Ed.zoomMode === 'num' ? 'fit' : Ed.zoomMode;
    Ed.show(id);
    O.setSelection([id], id);
    S.updateChrome();
  };
  A.showGrid = function (fromTool) {
    if (Ed.isEditingText()) Ed.commitText();
    var id = Ed.pid;
    A.mode = 'grid'; S.els.app.dataset.mode = 'grid';
    Ed.hide();
    if (!fromTool && PAGE_TOOLS[A.tool]) { A.tool = 'organize'; A.setTool('organize'); }
    S.updateChrome();
    if (id) setTimeout(function () { O.reveal(id); O.focus(id, false); }, 0);
  };
  A.gotoPage = function (delta) {
    var i = E.indexOf(Ed.pid), j = U.clamp(i + delta, 0, E.state.pages.length - 1);
    if (j !== i) { Ed.show(E.state.pages[j].id); O.setSelection([E.state.pages[j].id], E.state.pages[j].id); S.updateChrome(); PN.refresh(); }
  };

  /** The active page changed (a scroll or a press in the continuous view): the page number, panel and selection follow. */
  A.pageChanged = function () {
    if (A.mode !== 'page' || !Ed.pid) return;
    O.setSelection([Ed.pid], Ed.pid);
    S.updateChrome(); PN.refresh('page');
  };
  A.zoomChanged = function (z) { var l = $('#zoomLbl'); if (l) l.textContent = Math.round(z * 72 / 96 * 100) + '%'; S.updateStatus(); };
  A.toolChanged = function () {
    U.$$('.pv-tools .tb', S.els.ctxPage).forEach(function (b) { b.classList.toggle('on', b.dataset.tool === Ed.tool); });
    PN.refresh('tool');
  };
  A.editorSelectionChanged = function () { PN.refresh('sel'); };
  A.selectionChanged = function () { PN.refresh('sel'); S.updateStatus(); };

  S.updateChrome = function () {
    var has = E.state.pages.length > 0;
    S.els.app.dataset.mode = has ? A.mode : 'empty';
    S.els.empty.hidden = has;
    S.els.ctxGrid.hidden = !has || A.mode !== 'grid';
    S.els.ctxPage.hidden = !has || A.mode !== 'page';
    if (A.mode === 'page') { var n = $('#pvNum'); if (n) n.textContent = (E.indexOf(Ed.pid) + 1) + ' / ' + E.state.pages.length; }
    S.els.btnDownload.disabled = !has;
    A.toolChanged();
    S.updateUndo(); S.updateStatus();
  }
  S.updateUndo = function () {
    S.els.btnUndo.disabled = !E.canUndo(); S.els.btnRedo.disabled = !E.canRedo();
    S.els.btnUndo.title = E.canUndo() ? 'Undo ' + E.undoLabel() + ' (Ctrl+Z)' : 'Nothing to undo';
    S.els.btnRedo.title = E.canRedo() ? 'Redo ' + E.redoLabel() + ' (Ctrl+Shift+Z)' : 'Nothing to redo';
  }
  var statusMsg = '', statusT = 0;
  A.status = function (msg, kind) {
    statusMsg = msg; clearTimeout(statusT);
    var m = $('#statusMsg'); if (m) { m.textContent = msg; m.className = 'st-msg ' + (kind || ''); }
    statusT = setTimeout(function () { statusMsg = ''; var m2 = $('#statusMsg'); if (m2) m2.textContent = ''; }, 6000);
  };
  S.updateStatus = function () {
    var n = E.state.pages.length, files = new Set(E.state.pages.filter(function (p) { return p.f; }).map(function (p) { return p.f; })).size;
    var left = n ? n + ' page' + (n === 1 ? '' : 's') + ' · ' + files + ' file' + (files === 1 ? '' : 's') + (O.sel.size ? ' · ' + O.sel.size + ' selected' : '') : 'No document';
    $('#statusLeft').textContent = left;
    $('#statusZoom').textContent = A.mode === 'page' && n ? 'Zoom ' + Math.round(Ed.zoom * 72 / 96 * 100) + '%' : '';
  }
  A.announce = function (msg) { S.els.live.textContent = ''; setTimeout(function () { S.els.live.textContent = msg; }, 30); A.status(msg); };

  S.onChange = function (info) {
    O.render();
    if (A.mode === 'page') {
      if (!Ed.page()) { var first = E.state.pages[0]; if (first) Ed.show(first.id); else A.showGrid(); }
      else Ed.layout();
    }
    if (!E.state.pages.length && A.mode === 'page') A.showGrid();
    PN.refresh(info && info.history ? 'history' : 'change');
    S.updateChrome();
    if (info && info.history && info.label) A.status(info.label);
    S.autosave();
  }
  S.refreshAll = function () { O.render(); PN.refresh(); S.updateChrome(); }

  /* --------------------------------------------------------- undo/redo */
  A.undo = function () { if (Ed.isEditingText()) { Ed.commitText(); } var l = E.undo(); if (l) A.announce('Undid: ' + l); };
  A.redo = function () { var l = E.redo(); if (l) A.announce('Redid: ' + l); };

})();
