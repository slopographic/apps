/* Slop PDF — File ▸ Rename. The open document's name is the output name in the top bar, which Download and Save use, and
   the name of its tab. The rename goes through the document tabs (ui/doc-tabs.js): the tab, the file name and a Drive-linked
   file (extension kept) all change together. A.rename(name) sets it, A.rename(null) edits the top-bar name in place (the field
   is focused and selected). The name the file was opened with is kept: it is shown as the name field's tooltip and never changes. */
(function () {
  'use strict';
  var SP = window.SP, U = SP.util, E = SP.engine, A = SP.app, S = A._;
  /** The name of the first file opened (a rename never changes it). */
  A.originalName = function () { var f = E.files.values().next().value; return f ? f.name : ''; };
  function paintOriginal() {
    if (!S.els || !S.els.fileName) return; // before the topbar exists
    var orig = A.originalName();
    S.els.fileName.title = orig ? 'Original name: ' + orig + ' (kept when you rename)' : 'Name of the document (used for Download and Save)';
  }
  A.rename = function (name) {
    var input = S.els.fileName;
    if (name == null) { input.focus(); input.select(); return true; }
    var base = String(name).replace(/[\\/:*?"<>|\u0000-\u001f]/g, '').replace(/\.pdf$/i, '').trim().slice(0, 120);
    if (!base) { A.status('The name is empty, so the document keeps its name.', 'err'); return false; }
    var next = U.safeName(base + '.pdf', 'pdf');
    SP.tabs.rename(base);
    A.announce('Renamed to ' + next);
    return true;
  };
  E.on('files', paintOriginal);
  document.addEventListener('DOMContentLoaded', paintOriginal);
  paintOriginal();
})();
