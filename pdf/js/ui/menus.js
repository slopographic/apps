/* Slop PDF — top-bar menus (File/Edit/View/Help), shortcuts and about dialogs, themes, panel toggle. */
(function () {
  'use strict';
  var SP = window.SP, U = SP.util, E = SP.engine, O = SP.organizer, Ed = SP.editor, PN = SP.panels, A = SP.app, S = A._;
  var $ = U.$, h = U.h;
  function sendSub(items, label, emptyLabel) {
    if (!window.SlopHub || SP.offline || !E.state.pages.length) return null;
    return { label: label, sub: items.length ? items : [{ label: emptyLabel, disabled: true }] };
  }
  A.sendSub = sendSub;
  /* The app's names and the shared theme ids (shared/theme/theme.js): the choice is saved through SlopTheme.set. */
  var THEMES = [['pro', 'Pro (dark)', 'dark'], ['light', 'Light', 'light'], ['classic', 'Classic 98', 'classic']];
  /* ------------------------------------------------------------- menus */
  S.buildMenus = function () {
    var defs = [['File', S.fileMenu], ['Edit', S.editMenu], ['View', S.viewMenu], ['Help', S.helpMenu]];
    defs.forEach(function (d) {
      var b = h('button', { type: 'button', class: 'menu-b', 'aria-haspopup': 'menu' }, d[0]);
      b.addEventListener('click', function (e) { e.stopPropagation(); var r = b.getBoundingClientRect(); SlopUI.menu(d[1](), r.left, r.bottom + 2); });
      S.els.menus.appendChild(b);
    });
    S.els.btnMore.addEventListener('click', function (e) {
      e.stopPropagation(); var r = S.els.btnMore.getBoundingClientRect();
      SlopUI.menu(S.moreMenu(), r.right - 220, r.bottom + 4);
    });
  }
  /* The overflow (More) menu, shown at 900 px and below where the toolbar has no room: Convert is listed here directly
     (the toolbar button is hidden at that width) and the four top-bar menus follow. */
  S.moreMenu = function () {
    var has = E.state.pages.length > 0;
    var convert = window.SlopConvert && !SP.offline ? [{ label: 'Convert this document…', act: A.openConvert, disabled: !has }, '-'] : [];
    return convert.concat([{ label: 'File', sub: S.fileMenu() }, { label: 'Edit', sub: S.editMenu() }, { label: 'View', sub: S.viewMenu() }, { label: 'Help', sub: S.helpMenu() }]);
  };
  S.fileMenu = function () {
    var has = E.state.pages.length > 0;
    return [
      { label: 'Open PDFs or images…', key: A.key('file.open'), act: A.openDialog },
      window.SlopHub ? { label: 'Open from Slop Drive…', act: A.openFromDrive } : null,
      { label: 'Try the sample PDF', act: A.loadSample },
      { label: 'New tab', key: 'Ctrl+T', act: function () { A.newTab(); } },
      { label: 'Close tab', key: 'Ctrl+W', act: function () { A.closeTab(); } },
      S.savedSession && !has ? { label: 'Restore last session', act: A.restoreSession } : null,
      '-',
      { label: 'Rename…', key: A.key('file.rename'), act: function () { A.rename(null); } },
      '-',
      window.SlopHub && !SP.offline ? { label: 'Save to Slop Drive', key: A.key('file.save'), act: function () { A.saveToDrive(); }, disabled: !has } : null,
      window.SlopHub && !SP.offline && has ? { label: 'Versions', sub: A.versionItems() } : null,
      { label: 'Download PDF', key: A.key('file.download'), act: A.download, disabled: !has },
      { label: 'Download selected pages', act: A.extract, disabled: !O.sel.size },
      { label: 'Extract text…', act: A.extractText, disabled: !has },
      !SP.offline && window.SlopAITools ? { label: 'Recognise text on this page', act: function () { A.recognisePage(); }, disabled: !has } : null,
      !SP.offline && window.SlopAITools ? { label: 'Recognise text on all pages', act: function () { A.recogniseAll(); }, disabled: !has } : null,
      { label: 'Extract assets…', act: A.extractAssets, disabled: !has },
      { label: 'Pages to images…', act: function () { A.setTool('convert'); }, disabled: !has },
      window.SlopConvert && !SP.offline ? { label: 'Export as', sub: A.exportItems(), disabled: !has } : null,
      window.SlopConvert && !SP.offline ? { label: 'Convert…', act: A.openConvert, disabled: !has } : null,
      !SP.offline ? { label: 'Fonts…', act: A.openFonts, disabled: !has } : null,
      '-',
      sendSub(A.sendItems(), 'Send to', 'No other app opens PDFs yet'),
      window.SlopHub && !SP.offline && has ? '-' : null,
      window.SlopHub && !SP.offline ? { label: 'Save opened PDFs to Slop Drive', check: U.store.get('driveAutosave', true), act: function () { var v = !U.store.get('driveAutosave', true); U.store.set('driveAutosave', v); SlopUI.toast(v ? 'Opened PDFs are saved to Slop Drive' : 'Opened PDFs stay on this device'); } } : null,
      { label: 'Download app (offline .html)', act: A.downloadApp },
      { label: 'Autosave session in this browser', check: U.store.get('autosave', true), act: function () { var v = !U.store.get('autosave', true); U.store.set('autosave', v); A.setAutosave(v); if (!v) U.idb.del('session'); SlopUI.toast(v ? 'Autosave on (stored only in this browser)' : 'Autosave off; saved session deleted'); } },
      '-',
      { label: 'Close all', act: A.closeAll, disabled: !has }
    ];
  }
  S.editMenu = function () {
    var has = E.state.pages.length > 0, pg = A.mode === 'page';
    return [
      { label: E.canUndo() ? 'Undo ' + E.undoLabel() : 'Undo', key: A.key('edit.undo'), act: A.undo, disabled: !E.canUndo() },
      { label: E.canRedo() ? 'Redo ' + E.redoLabel() : 'Redo', key: A.key('edit.redo'), act: A.redo, disabled: !E.canRedo() },
      '-',
      { label: 'Select all pages', key: A.key('edit.selectAll'), act: function () { O.selectAll(); }, disabled: !has },
      { label: 'Select none', act: function () { O.setSelection([]); }, disabled: !O.sel.size },
      '-',
      { label: 'Rotate right', key: A.key('pages.rotateRight'), act: function () { A.rotate(pg ? [Ed.pid] : A.targetIds(), 90); }, disabled: !has },
      { label: 'Rotate left', key: A.key('pages.rotateLeft'), act: function () { A.rotate(pg ? [Ed.pid] : A.targetIds(), -90); }, disabled: !has },
      { label: 'Duplicate pages', key: A.key('edit.duplicate'), act: function () { A.duplicate(A.targetIds()); }, disabled: !has },
      { label: 'Delete pages', key: A.key('edit.delete'), act: function () { A.remove(pg ? [Ed.pid] : A.targetIds()); }, disabled: !has },
      { label: 'Reverse order', act: A.reverse, disabled: !has },
      { label: 'Insert blank page', act: A.insertBlank, disabled: !has },
      { label: 'Insert pages from file…', act: A.insertFromFile, disabled: !has }
    ];
  }
  S.viewMenu = function () {
    var theme = window.SlopTheme ? SlopTheme.get() : 'dark';
    return [
      { label: 'All pages (organizer)', act: function () { A.showGrid(); }, check: A.mode === 'grid' },
      { label: 'Page view', act: function () { A.ensurePage(); }, check: A.mode === 'page', disabled: !E.state.pages.length },
      { label: 'Split view', disabled: A.mode !== 'page' || E.state.pages.length < 1, sub: SP.panes.items() },
      '-',
      { label: 'Zoom in', key: A.key('view.zoomIn'), act: function () { if (A.mode === 'page') Ed.zoomBy(1.25); else O.zoomBy(1.25); } },
      { label: 'Zoom out', key: A.key('view.zoomOut'), act: function () { if (A.mode === 'page') Ed.zoomBy(0.8); else O.zoomBy(0.8); } },
      { label: 'Fit page', key: A.key('view.fit'), act: function () { Ed.fit('fit'); }, disabled: A.mode !== 'page' },
      { label: 'Page layout', disabled: A.mode !== 'page', sub: [['continuous', 'Continuous scroll'], ['single', 'Single page'], ['two', 'Two pages side by side']].map(function (m) { return { label: m[1], check: Ed.layoutMode === m[0], act: function () { Ed.setLayout(m[0]); } }; }) },
      '-',
      { label: 'Theme', sub: THEMES.map(function (t) { return { label: t[1], check: theme === t[2], act: function () { A.setTheme(t[0]); } }; }) },
      { label: 'Properties panel', check: !S.els.app.classList.contains('no-panel'), act: function () { A.togglePanel(); } }
    ];
  }
  S.helpMenu = function () {
    return [
      { label: 'Search commands…', key: A.key('cmd.palette'), act: function () { if (window.SlopCmd) SlopCmd.open(); }, disabled: !window.SlopCmd },
      { label: 'Keyboard shortcuts…', key: A.key('cmd.keymap'), act: S.showKeys },
      { label: 'About Slop PDF & privacy', act: S.showAbout },
      '-',
      { label: 'Slopographic home', act: function () { location.href = SP.offline ? 'https://slopographic.com/' : '../'; } }
    ];
  }
  /** The shared shortcut editor (search, record, conflicts, reset, export/import). */
  S.showKeys = function () { if (window.SlopCmd) SlopCmd.openKeymap(); };
  S.showAbout = function () {
    SlopUI.dialog({ title: 'About Slop PDF', body: h('div', null,
      h('p', { class: 'sui-p' }, 'Slop PDF is a free PDF editor that runs entirely in your browser. Your files are never uploaded: they are read, edited and written on this device.'),
      h('p', { class: 'sui-p' }, 'Built on pdf.js (Mozilla, Apache-2.0) for rendering and pdf-lib (MIT) for writing. Page content is copied as-is, so text and vector graphics stay sharp; only the optional lossy compression turns pages into pictures.'),
      h('p', { class: 'sui-p' }, 'Autosave keeps your session in this browser’s IndexedDB so a refresh doesn’t lose work. Turn it off in File ▸ Autosave.'),
      h('p', { class: 'sui-p' }, 'Edits are kept on this device, and Save or Export writes a new PDF.')), buttons: [{ label: 'Nice', primary: true }] });
  }

  /* ------------------------------------------------------------ themes */
  /* The choice is saved for every page by the shared switcher; this page only shows it. */
  A.paintMeta = function () {
    var meta = document.querySelector('meta[name="theme-color"]');
    var id = document.documentElement.getAttribute('data-slop-theme');
    if (meta) meta.setAttribute('content', id === 'light' ? '#f1ede4' : id === 'classic' ? '#c0c0c0' : '#0e0e10');
  };
  A.setTheme = function (t) {
    var row = THEMES.filter(function (x) { return x[0] === t; })[0] || THEMES[0];
    var r = window.SlopTheme ? SlopTheme.set(row[2]) : { ok: false, error: 'The theme script did not load.' };
    if (!r.ok) { if (window.SlopTheme) SlopTheme.apply(row[2]); A.status(r.error, 'err'); }
    else A.status('Theme: ' + row[1]);
    A.paintMeta();
  };
  A.togglePanel = function (force) {
    var narrow = window.innerWidth <= 900;
    if (narrow) { var open = force != null ? force : !S.els.app.classList.contains('sheet-open'); S.els.app.classList.toggle('sheet-open', open); S.els.btnPanel.setAttribute('aria-expanded', open ? 'true' : 'false'); }
    else { S.els.app.classList.toggle('no-panel', force != null ? !force : undefined); S.els.btnPanel.setAttribute('aria-expanded', S.els.app.classList.contains('no-panel') ? 'false' : 'true'); }
    if (A.mode === 'page') setTimeout(function () { Ed.layout(); }, 200);
  };
})();
