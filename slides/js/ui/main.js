/* Slop Slides: boot. Loads the fonts, wires each view to the app state, registers with Slop Drive, then opens what the
   page was launched with (?drive=<id>), else the autosaved draft, else a blank deck. The "ready" class on <body> is
   what the tests wait for. */
(function () {
  'use strict';
  var SS = window.SS;
  async function boot() {
    try { await SS.fonts.load(); } catch (e) { console.warn('Slop Slides: fonts did not load', e); }
    if (window.SlopHub) SlopHub.register('slides');
    var canvas = document.getElementById('canvas');
    SS.stage.mount(document.getElementById('stage'), canvas);
    SS.pointer.bind(canvas);
    SS.textEdit.mount(document.getElementById('editor'));
    SS.sorter.mount(document.getElementById('slides-list'));
    SS.inspector.mount(document.getElementById('inspector'));
    SS.toolbar.mount();
    SS.commands.setup();
    var launch = window.SlopHub ? await SlopHub.consumeLaunch() : null;
    await SS.files.boot(launch);
    document.body.classList.add('ready');
  }
  boot();
})();
