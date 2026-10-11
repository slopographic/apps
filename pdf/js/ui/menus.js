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
  var THEMES = [['pro', 'Pro (dark)'], ['light', 'Light'], ['classic', 'Classic 98']];
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
      SlopUI.menu([{ label: 'File', sub: S.fileMenu() }, { label: 'Edit', sub: S.editMenu() }, { label: 'View', sub: S.viewMenu() }, { label: 'Help', sub: S.helpMenu() }], r.right - 220, r.bottom + 4);
    });
  }
  S.fileMenu = function () {
    var has = E.state.pages.length > 0;
    return [
      { label: 'Open PDFs or images…', key: 'Ctrl+O', act: A.openDialog },
      window.SlopHub ? { label: 'Open from Slop Drive…', act: A.openFromDrive } : null,
      { label: 'Try the sample PDF', act: A.loadSample },
      S.savedSession && !has ? { label: 'Restore last session', act: A.restoreSession } : null,
      '-',
      { label: 'Download PDF', key: 'Ctrl+S', act: A.download, disabled: !has },
      { label: 'Download selected pages', act: A.extract, disabled: !O.sel.size },
      { label: 'Extract text…', act: A.extractText, disabled: !has },
      { label: 'Pages to images…', act: function () { A.setTool('convert'); }, disabled: !has },
      '-',
      sendSub(A.sendItems(), 'Send to', 'No other app opens PDFs yet'),
      window.SlopHub && !SP.offline && has ? '-' : null,
      { label: 'Download app (offline .html)', act: A.downloadApp },
      { label: 'Autosave session in this browser', check: U.store.get('autosave', true), act: function () { var v = !U.store.get('autosave', true); U.store.set('autosave', v); if (!v) U.idb.del('session'); SlopUI.toast(v ? 'Autosave on (stored only in this browser)' : 'Autosave off; saved session deleted'); } },
      '-',
      { label: 'Close all', act: A.closeAll, disabled: !has }
    ];
  }
  S.editMenu = function () {
    var has = E.state.pages.length > 0, pg = A.mode === 'page';
    return [
      { label: E.canUndo() ? 'Undo ' + E.undoLabel() : 'Undo', key: 'Ctrl+Z', act: A.undo, disabled: !E.canUndo() },
      { label: E.canRedo() ? 'Redo ' + E.redoLabel() : 'Redo', key: 'Ctrl+Shift+Z', act: A.redo, disabled: !E.canRedo() },
      '-',
      { label: 'Select all pages', key: 'Ctrl+A', act: function () { O.selectAll(); }, disabled: !has },
      { label: 'Select none', act: function () { O.setSelection([]); }, disabled: !O.sel.size },
      '-',
      { label: 'Rotate right', key: 'R', act: function () { A.rotate(pg ? [Ed.pid] : A.targetIds(), 90); }, disabled: !has },
      { label: 'Rotate left', key: 'Shift+R', act: function () { A.rotate(pg ? [Ed.pid] : A.targetIds(), -90); }, disabled: !has },
      { label: 'Duplicate pages', key: 'Ctrl+D', act: function () { A.duplicate(A.targetIds()); }, disabled: !has },
      { label: 'Delete pages', key: 'Del', act: function () { A.remove(pg ? [Ed.pid] : A.targetIds()); }, disabled: !has },
      { label: 'Reverse order', act: A.reverse, disabled: !has },
      { label: 'Insert blank page', act: A.insertBlank, disabled: !has },
      { label: 'Insert pages from file…', act: A.insertFromFile, disabled: !has }
    ];
  }
  S.viewMenu = function () {
    var theme = document.documentElement.getAttribute('data-theme');
    return [
      { label: 'All pages (organizer)', act: function () { A.showGrid(); }, check: A.mode === 'grid' },
      { label: 'Page view', act: function () { A.ensurePage(); }, check: A.mode === 'page', disabled: !E.state.pages.length },
      '-',
      { label: 'Zoom in', key: '+', act: function () { if (A.mode === 'page') Ed.zoomBy(1.25); else O.zoomBy(1.25); } },
      { label: 'Zoom out', key: '-', act: function () { if (A.mode === 'page') Ed.zoomBy(0.8); else O.zoomBy(0.8); } },
      { label: 'Fit page', key: '0', act: function () { Ed.fit('fit'); }, disabled: A.mode !== 'page' },
      '-',
      { label: 'Theme', sub: THEMES.map(function (t) { return { label: t[1], check: theme === t[0], act: function () { A.setTheme(t[0]); } }; }) },
      { label: 'Properties panel', check: !S.els.app.classList.contains('no-panel'), act: function () { A.togglePanel(); } }
    ];
  }
  S.helpMenu = function () {
    return [
      { label: 'Keyboard shortcuts', key: '?', act: S.showKeys },
      { label: 'About Slop PDF & privacy', act: S.showAbout },
      '-',
      { label: 'Slopographic home', act: function () { location.href = SP.offline ? 'https://slopographic.com/' : '../'; } }
    ];
  }
  S.showKeys = function () {
    var rows = [['Ctrl/⌘ O', 'Open files'], ['Ctrl/⌘ S', 'Download PDF'], ['Ctrl/⌘ Z / Shift Z', 'Undo / redo'], ['Ctrl/⌘ A', 'Select all pages'], ['Arrows', 'Move focus between pages'], ['Alt + arrows', 'Move selected pages'], ['Space', 'Toggle page selection'],
      ['R / Shift R', 'Rotate right / left'], ['Del', 'Delete pages or annotation'], ['Enter', 'Open page view'], ['Esc', 'Back to all pages'], ['PgUp / PgDn', 'Previous / next page'], ['+ / − / 0', 'Zoom in / out / fit'],
      ['V T P H', 'Select, Text, Draw, Highlighter'], ['R E L A', 'Rectangle, Ellipse, Line, Arrow (page view)'], ['W B I S', 'Whiteout, Highlight box, Image, Signature'], ['Ctrl/⌘ D, C, V', 'Duplicate, copy, paste annotation']];
    SlopUI.dialog({ title: 'Keyboard shortcuts', body: h('dl', { class: 'keys keys-dlg' }, rows.map(function (r) { return [h('dt', null, r[0]), h('dd', null, r[1])]; })), buttons: [{ label: 'Close', primary: true }] });
  }
  S.showAbout = function () {
    SlopUI.dialog({ title: 'About Slop PDF', body: h('div', null,
      h('p', { class: 'sui-p' }, 'Slop PDF is a free PDF editor that runs entirely in your browser. Your files are never uploaded: they are read, edited and written on this device.'),
      h('p', { class: 'sui-p' }, 'Built on pdf.js (Mozilla, Apache-2.0) for rendering and pdf-lib (MIT) for writing. Page content is copied as-is, so text and vector graphics stay sharp; only the optional lossy compression turns pages into pictures.'),
      h('p', { class: 'sui-p' }, 'Autosave keeps your session in this browser’s IndexedDB so a refresh doesn’t lose work. Turn it off in File ▸ Autosave.')), buttons: [{ label: 'Nice', primary: true }] });
  }

  /* ------------------------------------------------------------ themes */
  A.setTheme = function (t, silent) {
    if (!THEMES.some(function (x) { return x[0] === t; })) t = 'pro';
    document.documentElement.setAttribute('data-theme', t);
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', t === 'light' ? '#f1ede4' : t === 'classic' ? '#c0c0c0' : '#0e0e10');
    document.documentElement.style.colorScheme = t === 'pro' ? 'dark' : 'light';
    U.store.set('theme', t);
    if (!silent) A.status('Theme: ' + THEMES.filter(function (x) { return x[0] === t; })[0][1]);
  };
  A.togglePanel = function (force) {
    var narrow = window.innerWidth <= 900;
    if (narrow) { var open = force != null ? force : !S.els.app.classList.contains('sheet-open'); S.els.app.classList.toggle('sheet-open', open); S.els.btnPanel.setAttribute('aria-expanded', open ? 'true' : 'false'); }
    else { S.els.app.classList.toggle('no-panel', force != null ? !force : undefined); S.els.btnPanel.setAttribute('aria-expanded', S.els.app.classList.contains('no-panel') ? 'false' : 'true'); }
    if (A.mode === 'page') setTimeout(function () { Ed.layout(); }, 200);
  };
})();
