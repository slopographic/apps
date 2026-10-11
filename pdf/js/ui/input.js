/* Slop PDF — file drag & drop, global keyboard shortcuts and IndexedDB session autosave. */
(function () {
  'use strict';
  var SP = window.SP, U = SP.util, E = SP.engine, O = SP.organizer, Ed = SP.editor, PN = SP.panels, A = SP.app, S = A._;
  var $ = U.$, h = U.h;
  /* ---------------------------------------------------- drag & drop */
  S.setupDrop = function () {
    var depth = 0;
    function hasFiles(e) { var t = e.dataTransfer && e.dataTransfer.types; return t && Array.prototype.indexOf.call(t, 'Files') >= 0; }
    window.addEventListener('dragenter', function (e) { if (!hasFiles(e)) return; e.preventDefault(); depth++; S.els.dropOverlay.hidden = false; });
    window.addEventListener('dragover', function (e) { if (!hasFiles(e)) return; e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; });
    window.addEventListener('dragleave', function (e) { if (!hasFiles(e)) return; depth = Math.max(0, depth - 1); if (!depth) S.els.dropOverlay.hidden = true; });
    window.addEventListener('drop', function (e) {
      if (!hasFiles(e)) return;
      e.preventDefault(); depth = 0; S.els.dropOverlay.hidden = true;
      var files = Array.prototype.slice.call(e.dataTransfer.files || []);
      if (files.length) A.addFiles(files);
    });
  }

  /* --------------------------------------------------------- keyboard */
  S.setupKeys = function () {
    document.addEventListener('keydown', function (e) {
      if (SlopUI.openDialogs > 0 || document.querySelector('.sui-menu')) return;
      var t = e.target, typing = t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable);
      var mod = e.ctrlKey || e.metaKey, k = e.key;
      if (mod && !e.altKey) {
        var lk = k.toLowerCase();
        if (lk === 'z' && !typing) { e.preventDefault(); if (e.shiftKey) A.redo(); else A.undo(); return; }
        if (lk === 'y' && !typing) { e.preventDefault(); A.redo(); return; }
        if (lk === 'o') { e.preventDefault(); A.openDialog(); return; }
        if (lk === 's') { e.preventDefault(); A.download(); return; }
        if (typing) return;
        if (lk === 'a' && A.mode === 'grid') { e.preventDefault(); O.selectAll(); return; }
        if (lk === 'd') { e.preventDefault(); if (A.mode === 'page') { if (Ed.getSelected()) Ed.duplicateSelected(); } else A.duplicate(A.targetIds()); return; }
        if (A.mode === 'page' && lk === 'c') { if (Ed.copy()) e.preventDefault(); return; }
        if (A.mode === 'page' && lk === 'v') { if (Ed.paste()) e.preventDefault(); return; }
        if (k === '=' || k === '+') { e.preventDefault(); if (A.mode === 'page') Ed.zoomBy(1.25); return; }
        if (k === '-') { e.preventDefault(); if (A.mode === 'page') Ed.zoomBy(0.8); return; }
        return;
      }
      if (typing) return;
      if (k === '?') { S.showKeys(); return; }
      if (A.mode === 'page' && E.state.pages.length) {
        var sel = Ed.getSelected();
        if (k === 'Escape') { e.preventDefault(); if (sel) Ed.select(null); else if (Ed.tool !== 'select') Ed.setTool('select'); else A.showGrid(); return; }
        if ((k === 'Delete' || k === 'Backspace') && sel) { e.preventDefault(); Ed.deleteSelected(); return; }
        if (k.indexOf('Arrow') === 0 && sel) { e.preventDefault(); var d = e.shiftKey ? 10 : 1; Ed.nudgeSelected(k === 'ArrowLeft' ? -d : k === 'ArrowRight' ? d : 0, k === 'ArrowUp' ? -d : k === 'ArrowDown' ? d : 0); return; }
        if (k === 'PageDown' || (k === 'ArrowRight' && !sel) || (k === 'ArrowDown' && !sel && t === document.body)) { e.preventDefault(); A.gotoPage(1); return; }
        if (k === 'PageUp' || (k === 'ArrowLeft' && !sel) || (k === 'ArrowUp' && !sel && t === document.body)) { e.preventDefault(); A.gotoPage(-1); return; }
        if (k === '+' || k === '=') { Ed.zoomBy(1.25); return; }
        if (k === '-') { Ed.zoomBy(0.8); return; }
        if (k === '0') { Ed.fit('fit'); return; }
        if (k === 'Enter' && sel && sel.type === 'text') { e.preventDefault(); Ed.editSelectedText(); return; }
        var map = { v: 'select', t: 'text', p: 'pen', h: 'marker', r: 'rect', e: 'ellipse', l: 'line', a: 'arrow', w: 'whiteout', x: 'redact', b: 'hlbox', i: 'image', s: 'signature' };
        if (!e.altKey && map[k.toLowerCase()] && !e.shiftKey) { e.preventDefault(); Ed.setTool(map[k.toLowerCase()]); return; }
        return;
      }
      if (A.mode === 'grid' && E.state.pages.length && !t.closest('.thumb')) {
        if (k === 'Delete' && O.sel.size) { e.preventDefault(); A.remove(O.selected()); return; }
        if (k === 'Escape' && O.sel.size) { O.setSelection([]); return; }
        if (k.indexOf('Arrow') === 0 && !t.closest('#props, .topbar, .rail')) { e.preventDefault(); O.focus(O.focusId || E.state.pages[0].id); return; }
      }
    });
  }

  /* ---------------------------------------------------------- session */
  S.autosave = U.debounce(function () {
    if (!U.store.get('autosave', true)) return;
    if (!E.state.pages.length) { U.idb.del('session'); return; }
    try { var s = E.serialize(); s.fileName = S.els.fileName.value; U.idb.set('session', s); } catch (e) { console.warn('Slop PDF: S.autosave failed', e); }
  }, 1200);
  A.restoreSession = function () {
    var s = S.savedSession; if (!s) return;
    return S.guarded('Restoring your session…', async function () {
      await E.restore(s);
      if (s.fileName) { S.els.fileName.value = s.fileName; S.fileNameTouched = true; }
      S.els.restore.hidden = true; S.savedSession = null;
      A.announce('Session restored: ' + E.state.pages.length + ' pages');
    });
  };
  A.closeAll = function () {
    SlopUI.confirm('Close all files', 'Remove every page and file from Slop PDF? Unsaved changes are lost (download first if you need them).', 'Close all', { danger: true }).then(function (ok) {
      if (!ok) return;
      A.showGrid(true);
      E.closeAll(); U.idb.del('session'); S.fileNameTouched = false; S.els.fileName.value = 'document.pdf';
      A.setTool('organize');
    });
  };
})();
