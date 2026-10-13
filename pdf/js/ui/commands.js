/* Slop PDF — every command (tools, page operations, menu actions) registered with SlopCmd: the shared
   Spotlight palette (Mod+K) and customizable shortcuts (Help ▸ Keyboard shortcuts). Keyboard handling
   lives here; organize/keys.js only keeps the page grid's listbox navigation (arrows, Space, Enter). */
(function () {
  'use strict';
  var SP = window.SP, U = SP.util, E = SP.engine, O = SP.organizer, Ed = SP.editor, A = SP.app, S = A._;
  var C = window.SlopCmd;
  function noMenu() { return !document.querySelector('.sui-menu'); }
  function inField() { var a = document.activeElement; return !!(a && a.closest && a.closest('input, select, textarea, [contenteditable="true"]')); }
  function idle() { return noMenu() && !inField(); }
  /** The text selection bar is up: Escape belongs to it (sel-bar.js), not to the page. */
  function selBarOpen() { return !!(window.SlopSelBar && SlopSelBar.isOpen()); }
  function has() { return E.state.pages.length > 0; }
  function pg() { return A.mode === 'page' && has(); }
  function grid() { return A.mode !== 'page' && has(); }
  /** Selected pages, else the focused thumbnail. */
  function gridIds() {
    if (O.sel.size) return O.selected();
    var a = document.activeElement, t = a && a.closest && a.closest('#grid .thumb');
    return t ? [t.dataset.id] : [];
  }
  function pageIds() { return pg() ? [Ed.pid] : A.targetIds(); }
  function zoom(k) { if (A.mode === 'page') Ed.zoomBy(k); else O.zoomBy(k); }
  /** Display key for a menu label ('' when unbound or SlopCmd is missing). */
  A.key = function (id) { return C ? C.keyFor(id) : ''; };

  function cmd(id, title, group, keys, run, when, extra) {
    return Object.assign({ id: id, title: title, group: group, keys: keys || [], run: run, when: when }, extra || {});
  }
  function all() {
    var L = [
      cmd('file.open', 'Open PDFs or images…', 'File', ['Mod+O'], function () { A.openDialog(); }, noMenu, { keywords: ['add', 'import', 'merge'] }),
      cmd('file.drive', 'Open from Slop Drive…', 'File', [], function () { A.openFromDrive(); }, function () { return !!window.SlopHub && !SP.offline; }),
      cmd('file.sample', 'Try the sample PDF', 'File', [], function () { A.loadSample(); }),
      cmd('file.fonts', 'Fonts…', 'File', [], function () { A.openFonts(); }, has, { keywords: ['font', 'typeface', 'missing', 'embedded'] }),
      cmd('file.extractAssets', 'Extract assets…', 'File', [], function () { A.extractAssets(); }, has, { keywords: ['images', 'fonts', 'save', 'export'] }),
      cmd('file.save', 'Save', 'File', ['Mod+S'], function () { if (window.SlopHub && !SP.offline) A.saveToDrive(); else A.download(); }, function () { return has() && noMenu(); }, { keywords: ['save', 'drive'] }),
      cmd('file.download', 'Download PDF', 'File', [], function () { A.download(); }, function () { return has() && noMenu(); }, { keywords: ['save', 'export'] }),
      cmd('file.extract', 'Download selected pages', 'File', [], function () { A.extract(); }, function () { return O.sel.size > 0; }),
      cmd('file.text', 'Extract text…', 'File', [], function () { A.extractText(); }, has),
      cmd('file.images', 'Pages to images…', 'File', [], function () { A.setTool('convert'); }, has, { keywords: ['png', 'jpeg', 'convert'] }),
      cmd('file.app', 'Download app (offline .html)', 'File', [], function () { A.downloadApp(); }),
      cmd('file.rename', 'Rename…', 'File', [], function () { A.rename(null); }, null, { keywords: ['name', 'title'] }),
      cmd('file.closeAll', 'Close all', 'File', [], function () { A.closeAll(); }, has),
      cmd('edit.text', 'Edit text in place', 'Edit', ['Mod+E'], function () { Ed.toggleEditText(); }, pg, { keywords: ['replace', 'change', 'type over'] }),
      cmd('edit.find', 'Find in document…', 'Edit', ['Mod+F'], function () { SlopPdfFind.open(); }, function () { return has() && noMenu(); }, { keywords: ['search', 'highlight', 'text'] }),
      cmd('edit.undo', 'Undo', 'Edit', ['Mod+Z'], function () { A.undo(); }, function () { return E.canUndo() && !inField() && noMenu(); }),
      cmd('edit.redo', 'Redo', 'Edit', ['Shift+Mod+Z', 'Mod+Y'], function () { A.redo(); }, function () { return E.canRedo() && !inField() && noMenu(); }),
      cmd('edit.selectAll', 'Select all pages', 'Edit', ['Mod+A'], function () { O.selectAll(); }, function () { return grid() && idle(); }),
      cmd('edit.selectNone', 'Select none', 'Edit', [], function () { O.setSelection([]); }, function () { return O.sel.size > 0; }),
      cmd('edit.duplicate', 'Duplicate', 'Edit', ['Mod+D'], function () { if (pg()) Ed.duplicateSelected(); else A.duplicate(A.targetIds()); }, function () { return idle() && (pg() ? !!Ed.getSelected() : has()); }, { keywords: ['copy', 'pages', 'annotation'] }),
      cmd('edit.copy', 'Copy annotation', 'Edit', ['Mod+C'], function () { Ed.copy(); }, function () { return pg() && idle() && !!Ed.getSelected(); }),
      cmd('edit.paste', 'Paste annotation', 'Edit', ['Mod+V'], function () { Ed.paste(); }, function () { return pg() && idle() && Ed.canPaste(); }),
      cmd('edit.delete', 'Delete', 'Edit', ['Delete', 'Backspace'], function () { if (pg()) Ed.deleteSelected(); else A.remove(gridIds()); }, function () { return idle() && (pg() ? !!Ed.getSelected() : gridIds().length > 0); }, { keywords: ['remove', 'pages', 'annotation'] }),
      cmd('edit.escape', 'Back / deselect', 'View', ['Escape'], function () {
        if (!pg()) { O.setSelection([]); return; }
        if (Ed.getSelected()) Ed.select(null); else if (Ed.tool !== 'select') Ed.setTool('select'); else A.showGrid();
      }, function () { return idle() && !selBarOpen() && (pg() || (grid() && O.sel.size > 0)); }, { hidden: true }),
      cmd('pages.rotateRight', 'Rotate right', 'Pages', ['R'], function () { A.rotate(grid() ? gridIds() : [Ed.pid], 90); }, function () { return idle() && (grid() ? gridIds().length > 0 : false); }),
      cmd('pages.rotateLeft', 'Rotate left', 'Pages', ['Shift+R'], function () { A.rotate(grid() ? gridIds() : [Ed.pid], -90); }, function () { return idle() && grid() && gridIds().length > 0; }),
      cmd('pages.rotateAllRight', 'Rotate pages right', 'Pages', [], function () { A.rotate(pageIds(), 90); }, has),
      cmd('pages.rotateAllLeft', 'Rotate pages left', 'Pages', [], function () { A.rotate(pageIds(), -90); }, has),
      cmd('pages.duplicate', 'Duplicate pages', 'Pages', [], function () { A.duplicate(A.targetIds()); }, has),
      cmd('pages.delete', 'Delete pages', 'Pages', [], function () { A.remove(pageIds()); }, has),
      cmd('pages.reverse', 'Reverse page order', 'Pages', [], function () { A.reverse(); }, has),
      cmd('pages.blank', 'Insert blank page', 'Pages', [], function () { A.insertBlank(); }, has),
      cmd('pages.insert', 'Insert pages from file…', 'Pages', [], function () { A.insertFromFile(); }, has),
      cmd('pages.focus', 'Focus the page grid', 'Pages', ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'], function () { O.focus(O.focusId || E.state.pages[0].id); }, function () {
        var a = document.activeElement; return grid() && idle() && !(a && a.closest && a.closest('.thumb, #props, .topbar, .rail, .ctxbar'));
      }, { hidden: true }),
      cmd('view.grid', 'All pages (organizer)', 'View', [], function () { A.showGrid(); }, has, { checked: function () { return A.mode !== 'page'; } }),
      cmd('view.page', 'Page view', 'View', ['Enter'], function () { A.ensurePage(); }, function () { var a = document.activeElement; return grid() && idle() && !(a && a.closest && a.closest('.thumb, button, a')); }, { checked: function () { return A.mode === 'page'; } }),
      cmd('annot.editText', 'Edit selected text', 'Annotation', ['Enter'], function () { Ed.editSelectedText(); }, function () { var a = Ed.getSelected(); return pg() && idle() && !!a && a.type === 'text'; }),
      cmd('view.next', 'Next page', 'View', ['PageDown', 'ArrowRight'], function () { A.gotoPage(1); }, function () { return pg() && idle() && !Ed.getSelected(); }),
      cmd('view.prev', 'Previous page', 'View', ['PageUp', 'ArrowLeft'], function () { A.gotoPage(-1); }, function () { return pg() && idle() && !Ed.getSelected(); }),
      cmd('view.continuous', 'Continuous scroll', 'View', [], function () { Ed.setLayout('continuous'); }, function () { return pg() && idle(); }, { checked: function () { return Ed.layoutMode === 'continuous'; } }),
      cmd('view.single', 'Single page layout', 'View', [], function () { Ed.setLayout('single'); }, function () { return pg() && idle(); }, { checked: function () { return Ed.layoutMode === 'single'; } }),
      cmd('view.two', 'Two pages side by side', 'View', [], function () { Ed.setLayout('two'); }, function () { return pg() && idle(); }, { checked: function () { return Ed.layoutMode === 'two'; } }),
      cmd('view.zoomIn', 'Zoom in', 'View', ['+', '=', 'Mod+=', 'Mod++'], function () { zoom(1.25); }, function () { return has() && !inField(); }, { repeat: true }),
      cmd('view.zoomOut', 'Zoom out', 'View', ['-', 'Mod+-'], function () { zoom(0.8); }, function () { return has() && !inField(); }, { repeat: true }),
      cmd('view.fit', 'Fit page', 'View', ['0'], function () { Ed.fit('fit'); }, function () { return pg() && idle(); }),
      cmd('view.fitWidth', 'Fit width', 'View', [], function () { Ed.fit('width'); }, pg),
      cmd('view.thumbsRow', 'Thumbnails: one page per row', 'View', [], function () { O.zoomTo(O.maxSize()); }, grid),
      cmd('view.panel', 'Properties panel', 'View', [], function () { A.togglePanel(); }, null, { checked: function () { return !S.els.app.classList.contains('no-panel'); } }),
      cmd('redact.panel', 'Find & redact…', 'Redact', [], function () { A.setTool('redact'); }, has, { keywords: ['remove', 'black out', 'censor', 'privacy', 'gdpr'] }),
      cmd('redact.apply', 'Apply redactions…', 'Redact', [], function () { A.applyRedactions(); }, function () { return SP.redact.pending().length > 0; }),
      cmd('help.about', 'About Slop PDF & privacy', 'Help', [], function () { S.showAbout(); }),
      cmd('help.home', 'Slopographic home', 'Help', [], function () { location.href = SP.offline ? 'https://slopographic.com/' : '../'; })
    ];
    O.PRESETS.forEach(function (p) { L.push(cmd('view.thumbs' + p[1], 'Thumbnail size ' + p[1], 'View', [], function () { O.zoomTo(p[0]); }, grid)); });
    Ed.TOOLS.forEach(function (t) {
      L.push(cmd('tool.' + t[0], t[1].split(' (')[0] + ' tool', 'Tools', [t[3]], function () { Ed.setTool(t[0]); }, function () { return pg() && idle(); }, { icon: U.icon(t[2]), keywords: ['annotate', 'draw'] }));
    });
    [[-1, 0, 'Left'], [1, 0, 'Right'], [0, -1, 'Up'], [0, 1, 'Down']].forEach(function (d) {
      [[1, ''], [10, 'Shift+']].forEach(function (s) {
        L.push(cmd('annot.nudge' + d[2] + (s[0] > 1 ? '10' : ''), 'Nudge annotation ' + d[2].toLowerCase() + (s[0] > 1 ? ' (10 pt)' : ''), 'Annotation', [s[1] + 'Arrow' + d[2]], function () { Ed.nudgeSelected(d[0] * s[0], d[1] * s[0]); }, function () { return pg() && idle() && !!Ed.getSelected(); }, { repeat: true, hidden: true }));
      });
    });
    if (!SP.offline && window.SlopAITools) L.push(
      cmd('tools.ocrPage', 'Recognise text on this page', 'Tools', [], function () { A.recognisePage(); }, has, { keywords: ['ocr', 'scan', 'read text'] }),
      cmd('tools.ocrAll', 'Recognise text on all pages', 'Tools', [], function () { A.recogniseAll(); }, has, { keywords: ['ocr', 'scan', 'read text'] }));
    S.RAIL.forEach(function (r) { L.push(cmd('panel.' + r[0], r[1], 'Panels', [], function () { A.setTool(r[0]); }, null, { icon: U.icon(r[2]), keywords: ['tool', 'panel'] })); });
    return L;
  }

  S.setupKeys = function () {
    if (!C) { console.warn('Slop PDF: SlopCmd is missing; keyboard shortcuts are off'); return; }
    C.init({ app: 'pdf' });
    C.register(all());
    var b = U.h('button', { type: 'button', class: 'tb', id: 'btnCmd', title: 'Search commands (' + C.keyFor('cmd.palette') + ')', 'aria-label': 'Search commands', html: U.icon('zoomin') });
    b.addEventListener('click', function () { C.open(); });
    S.els.btnPanel.parentNode.insertBefore(b, S.els.btnPanel);
    C.on('change', function () { b.title = 'Search commands (' + C.keyFor('cmd.palette') + ')'; });
  };
})();
