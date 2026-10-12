/* Slop PDF — Convert. The open document (its edits included, as Download would write it) goes to the Slop Convert dialog
   (shared/convert/dialog.js, window.SlopConvert) from the toolbar button and File ▸ Convert…. The dialog runs the converters
   on this device; a Drive-linked document offers Save to Slop Drive for the results. Classic script. */
(function () {
  'use strict';
  var SP = window.SP, U = SP.util, E = SP.engine, A = SP.app, S = A._;

  A.openConvert = function () {
    if (!window.SlopConvert) { SlopUI.toast('Convert is not in the offline file. Use the online Slop PDF.'); return; }
    if (!E.state.pages.length) return;
    return S.guarded('Preparing the document…', function () { return A.currentPdfBlob(); }).then(function (blob) {
      if (!blob) return;
      var name = U.safeName(S.els.fileName.value || 'document.pdf', 'pdf');
      window.SlopConvert.open({ file: new File([blob], name, { type: 'application/pdf' }), drive: !!A.driveId });
    });
  };

  var btn = document.getElementById('btnConvert');
  if (btn) {
    btn.addEventListener('click', function () { A.openConvert(); });
    if (SP.offline) btn.hidden = true;
  }
})();
