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
  A.openFromDrive = function () {
    var H = hub(); if (!H) return;
    H.pickFromDrive({ accept: ['application/pdf', 'image/*'] }).then(function (rec) { if (rec && rec.blob) A.addFiles([recToFile(rec)]); });
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
    if (rec && rec.blob) { await A.addFiles([recToFile(rec)]); SlopUI.toast('Opened “' + (rec.name || 'file') + '” from Slop Drive'); }
  }
  function start() { A.boot(); launch(); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
