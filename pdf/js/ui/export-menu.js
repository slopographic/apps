/* Slop PDF — File ▸ Export as. Word, Excel, PowerPoint and image files open the Convert dialog (shared/convert) with that
   target chosen. The document is converted as it is now, edits included, and the dialog states each target's fidelity
   (its note): Word and Excel are text-based, PowerPoint is one picture per page. Classic script. */
(function () {
  'use strict';
  var SP = window.SP, A = SP.app, E = SP.engine;
  var TARGETS = [['pdf-to-docx', 'Word (.docx)'], ['pdf-to-xlsx', 'Excel (.xlsx)'], ['pdf-to-pptx', 'PowerPoint (.pptx)'],
    ['pdf-to-png', 'PNG images'], ['pdf-to-jpg', 'JPG images']];
  /** The File ▸ Export as submenu. */
  A.exportItems = function () {
    var has = E.state.pages.length > 0;
    return [{ label: 'PDF (download)', act: A.download, disabled: !has }, '-']
      .concat(TARGETS.map(function (t) { return { label: t[1], act: function () { A.openConvert(t[0]); }, disabled: !has }; }))
      .concat(['-', { label: 'Other formats…', act: function () { A.openConvert(null); }, disabled: !has }]);
  };
})();
