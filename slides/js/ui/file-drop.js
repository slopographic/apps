/* Slop Slides: presentations from this computer. A PowerPoint (.pptx) or Slop Slides (.sslide) file dropped anywhere on
   the editor, or picked with File ▸ Open a file from this computer, opens in a new tab with no Drive link (SS.files.openFile),
   so Save makes a new Slop Slides file and never writes over the original. The feedback (the outline while a file is
   dragged over, a refusal that says why, a progress row) is the shared SlopDrop strip (shared/drop), quiet at rest on the
   stage. Exposes SS.fileDrop: mount(), choose(). */
(function () {
  'use strict';
  var SS = window.SS, N = SS.native;
  var FD = SS.fileDrop = {};
  var drop = null;

  FD.mount = function () {
    var zone = document.getElementById('ssDrop');
    if (drop || !zone || !window.SlopDrop) return;
    drop = SlopDrop.attach(zone, {
      accept: { types: [N.PPTX, N.MIME, 'application/json'], exts: ['.pptx', '.sslide'], noun: 'a PowerPoint (.pptx) or Slop Slides file' },
      targets: [document.getElementById('app')],
      compact: true, toast: false, multiple: true,
      label: 'Drop a .pptx or .sslide file to open it', chooseLabel: 'Open a file',
      process: async function (file) {
        if (SS.app.mode !== 'edit') throw new Error('End the slide show first');
        await SS.files.openFile(file);
        return file.name;
      }
    });
  };
  /** The file picker of the same strip (File ▸ Open a file from this computer). */
  FD.choose = function () { if (!drop) FD.mount(); if (drop) drop.choose(); };
})();
