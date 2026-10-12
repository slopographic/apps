/* Slop PDF — file drag & drop and IndexedDB session autosave. */
(function () {
  'use strict';
  var SP = window.SP, U = SP.util, E = SP.engine, O = SP.organizer, Ed = SP.editor, PN = SP.panels, A = SP.app, S = A._;
  var $ = U.$, h = U.h;
  /* ---------------------------------------------------- drag & drop */
  S.setupDrop = function () {
    var depth = 0;
    function hasFiles(e) { var t = e.dataTransfer && e.dataTransfer.types; return t && Array.prototype.indexOf.call(t, 'Files') >= 0; }
    window.addEventListener('dragenter', function (e) { if (!hasFiles(e)) return; e.preventDefault(); depth++; S.els.dropOverlay.hidden = false; });
    window.addEventListener('dragover', function (e) { if (!hasFiles(e)) return; e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; A.dropHint(e.target); });
    window.addEventListener('dragleave', function (e) { if (!hasFiles(e)) return; depth = Math.max(0, depth - 1); if (!depth) { S.els.dropOverlay.hidden = true; A.dropHint(null); } });
    window.addEventListener('drop', function (e) {
      if (!hasFiles(e)) return;
      e.preventDefault(); depth = 0; S.els.dropOverlay.hidden = true; A.dropHint(null);
      var files = Array.prototype.slice.call(e.dataTransfer.files || []);
      if (files.length) A.dropFiles(files, e.target); // ui/doc-drop.js: a new tab on the strip, pages added to the document otherwise
    });
  }

  /* Keyboard shortcuts: ui/commands.js (SlopCmd). */

  /* ---------------------------------------------------------- session */
  // The open tabs are stored by the document tabs (ui/doc-tabs.js); 'session' keeps the open document's pages (no file bytes).
  S.autosave = U.debounce(function () {
    A.tabsFlush();
    if (!U.store.get('autosave', true)) return;
    if (!E.state.pages.length) { U.idb.del('session'); return; }
    try { var s = SP.docs.summary(); s.fileName = S.els.fileName.value; U.idb.set('session', s); } catch (e) { console.warn('Slop PDF: S.autosave failed', e); }
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
