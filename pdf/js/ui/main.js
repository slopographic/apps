/* Slop PDF — Slop Hub integration (shared Slop Drive, "Send to…", launching with ?drive=<id>)
   and startup. Loaded last. */
(function () {
  'use strict';
  var SP = window.SP, U = SP.util, E = SP.engine, A = SP.app, S = A._;
  function hub() { return window.SlopHub || null; }
  function recToFile(rec) {
    var name = rec.name || 'file', type = rec.type || (rec.blob && rec.blob.type) || '';
    try { return new File([rec.blob], name, { type: type }); } catch (e) { var b = rec.blob; try { b.name = name; } catch (er) { /* ignore */ } return b; }
  }
  // A.driveId: the Slop Drive record the open document came from (or was saved to). Only a document
  // that was empty when a Drive file arrived takes that file's id, so Save never overwrites a different file.
  A.driveId = null;
  function openDriveRecord(rec) {
    var wasEmpty = !E.state.pages.length;
    return A.addFiles([recToFile(rec)]).then(function () { if (wasEmpty && E.state.pages.length) A.driveId = rec.id; });
  }
  A.openFromDrive = function () {
    var H = hub(); if (!H) return;
    H.pickFromDrive({ accept: ['application/pdf', 'image/*'] }).then(function (rec) { if (rec && rec.blob) openDriveRecord(rec); });
  };
  // Starting a different document unlinks the Drive file.
  ['closeAll', 'loadSample'].forEach(function (k) {
    var orig = A[k]; if (!orig) return;
    A[k] = function () { A.driveId = null; return orig.apply(this, arguments); };
  });
  /** File ▸ Save: the PDF goes back to the linked Drive file, or a folder is asked for the first time. */
  A.saveToDrive = function () {
    var H = hub(); if (!H || !E.state.pages.length) return Promise.resolve(null);
    return S.guarded('Saving to Slop Drive…', function () { return A.currentPdfBlob(); }).then(function (blob) {
      var name = U.safeName(S.els.fileName.value || 'document.pdf', 'pdf');
      S.els.fileName.value = name;
      if (!A.driveId) return H.saveToDrive(blob, name, { from: 'pdf' }).then(function (id) { if (id) A.driveId = id; return id; });
      return H.update(A.driveId, { blob: blob, name: name, type: blob.type }).then(function (rec) {
        if (!rec) return H.put(blob, { id: A.driveId, name: name, from: 'pdf' });
        SlopUI.toast('Saved ' + name + ' to Slop Drive');
        return A.driveId;
      });
    });
  };
  /** The current document as a validated PDF blob. */
  A.currentPdfBlob = async function () {
    var bytes = await E.build();
    await E.validate(bytes, E.state.pages.length);
    return new Blob([bytes], { type: 'application/pdf' });
  };
  /** One page rendered as a PNG blob (150 dpi), annotations and stamps included. */
  A.pagePngBlob = async function (id) {
    var p = E.pageById(id); if (!p) throw new Error('That page no longer exists.');
    var idx = E.indexOf(id), all = E.state.pages;
    var bytes = await E.build({ pages: all });
    var files = await E.toImages(bytes, { format: 'png', dpi: 150, indices: [idx], base: 'page' });
    return new Blob([files[0].data], { type: 'image/png' });
  };
  function wrap(label, fn) { return function () { return S.guarded(label, function () { return fn(); }).then(function (b) { if (!b) throw new Error('nothing to send'); return b; }); }; }
  /** "Send to <App>" items for the whole PDF (File menu). */
  A.sendItems = function () {
    var H = hub(); if (!H || SP.offline || !E.state.pages.length) return [];
    return H.sendMenuItems(wrap('Preparing the PDF…', A.currentPdfBlob), function () { return U.safeName(S.els.fileName.value || 'document.pdf', 'pdf'); }, 'application/pdf');
  };
  /** "Send page as image to <App>" items (page context menu). */
  A.sendPageItems = function (id) {
    var H = hub(); if (!H || SP.offline || !id) return [];
    var n = E.indexOf(id) + 1;
    return H.sendMenuItems(wrap('Rendering page ' + n + '…', function () { return A.pagePngBlob(id); }), function () { return U.baseName(S.els.fileName.value || 'document') + '-page-' + n + '.png'; }, 'image/png');
  };
  async function launch() {
    var H = hub(); if (!H) return;
    try { H.register('pdf'); } catch (e) { console.warn('Slop PDF: hub register failed', e); }
    var rec = null;
    try { rec = await H.consumeLaunch(); } catch (e) { rec = null; }
    if (rec && rec.blob) { await openDriveRecord(rec); SlopUI.toast('Opened “' + (rec.name || 'file') + '” from Slop Drive'); }
  }
  function start() { A.boot(); launch(); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
