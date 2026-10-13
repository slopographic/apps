/* Slop PDF — Fonts (File ▸ Fonts…, the top-bar button). Opens the shared Fonts panel (shared/fonts/panel.js,
   SlopFonts.openPanel) with the fonts of the open document: the families it embeds as a subset, and the standard ones.
   The panel offers Download (the library), Drop your own font and Use the closest font for a missing family. A closest
   font chosen there is kept on each file that uses the family (f.fontMap), the same answer the first-edit prompt uses
   (SlopFontCheck is a shim over the same panel). A font embedded in full needs no answer and is not listed. Reopens any
   time. Classic script. */
(function () {
  'use strict';
  var SP = window.SP, E = SP.engine, A = SP.app, S = SP.editor._;

  /** The families of the open files: names (subset or standard), the standard ones, and the files that use each. */
  async function gather() {
    var names = [], standard = [], filesOf = new Map();
    for (var f of E.files.values()) {
      if (!f.doc) continue;
      for (var facts of (await S.scanFonts(f)).values()) {
        if (facts.std) { if (standard.indexOf(facts.family) < 0) standard.push(facts.family); }
        else if (!facts.subset) continue;
        if (names.indexOf(facts.family) < 0) names.push(facts.family);
        if (!filesOf.has(facts.family)) filesOf.set(facts.family, []);
        if (filesOf.get(facts.family).indexOf(f) < 0) filesOf.get(facts.family).push(f);
      }
    }
    return { names: names, standard: standard, filesOf: filesOf };
  }

  /** File ▸ Fonts…: opens the shared panel for this document. */
  A.openFonts = async function () {
    if (SP.offline || !E.state.pages.length) return;
    var got = await gather();
    if (!got.names.length) { SlopUI.toast('This document embeds no fonts. Its text uses the standard fonts.'); return; }
    await window.SlopFonts.ready();
    window.SlopFonts.openPanel({
      title: 'Fonts',
      note: 'Fonts this document embeds as a subset. A missing one is needed to edit its text as it looks.',
      fonts: got.names,
      standard: got.standard,
      onUse: function (ans) {
        (got.filesOf.get(ans.family) || []).forEach(function (f) { f.fontMap = f.fontMap || new Map(); f.fontMap.set(ans.family, ans.use); });
        SlopUI.toast('Using ' + ans.use + ' for ' + ans.family);
      },
    });
  };
  var topBtn = document.getElementById('btnFonts');
  if (topBtn) topBtn.addEventListener('click', function () { A.openFonts(); });
})();
