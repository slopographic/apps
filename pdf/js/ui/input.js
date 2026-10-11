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
    window.addEventListener('dragover', function (e) { if (!hasFiles(e)) return; e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; });
    window.addEventListener('dragleave', function (e) { if (!hasFiles(e)) return; depth = Math.max(0, depth - 1); if (!depth) S.els.dropOverlay.hidden = true; });
    window.addEventListener('drop', function (e) {
      if (!hasFiles(e)) return;
      e.preventDefault(); depth = 0; S.els.dropOverlay.hidden = true;
      var files = Array.prototype.slice.call(e.dataTransfer.files || []);
      if (files.length) A.addFiles(files);
    });
  }

  /* Keyboard shortcuts: ui/commands.js (SlopCmd). */

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
