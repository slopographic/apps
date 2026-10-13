/* Slop PDF — Fonts (File ▸ Fonts…, and the top-bar button). The fonts the open document embeds, with what the file holds
   and what this device has, and a status: embedded (the file carries the whole font), available (this device has the
   family, or it is a standard font, or the closest font has been chosen), or missing (a subset the device lacks).
   A missing font offers Download from the library, Drop your own file (stored on this device) and Use the closest
   font. The answers are kept on the file (f.fontMap), the same ones the first-edit prompt (editor/font-check.js) uses,
   so the prompt does not come back for them. Reopen it any time. Classic script. */
(function () {
  'use strict';
  var SP = window.SP, U = SP.util, E = SP.engine, A = SP.app, S = A._, h = U.h;
  var C = function () { return window.SlopFontCatalog; };
  var LABEL = { embedded: 'Embedded', available: 'Available', missing: 'Missing' };

  /** The fonts of every open file, one row per family (a full embed in any file makes the family embedded). */
  async function gather() {
    var rows = new Map();
    for (var f of E.files.values()) {
      if (!f.doc) continue;
      for (var facts of (await S.scanFonts(f)).values()) {
        var row = rows.get(facts.family) || { family: facts.family, std: !!facts.std, subset: true, files: [] };
        if (!facts.subset) row.subset = false;
        if (row.files.indexOf(f) < 0) row.files.push(f);
        rows.set(facts.family, row);
      }
    }
    var out = [];
    for (var r of rows.values()) {
      r.installed = !r.std && await C().hasFamily(r.family);
      r.closest = C().closestFamily(r.family);
      r.pack = !r.std && !r.installed ? await C().packFor(r.family) : null;
      r.answer = null;
      r.files.forEach(function (f) { if (f.fontMap && f.fontMap.has(r.family)) r.answer = f.fontMap.get(r.family); });
      r.status = r.std ? 'available' : !r.subset ? 'embedded' : (r.installed || r.answer) ? 'available' : 'missing';
      out.push(r);
    }
    return out.sort(function (a, b) { return a.family.localeCompare(b.family); });
  }

  /** The line under the family name: what the file holds and what the device does. */
  function detail(r) {
    if (r.std) return 'Standard font, built into every reader';
    var inFile = r.subset ? 'subset embedded' : 'embedded in full';
    if (r.answer) return inFile + '. Using ' + r.answer + ' instead on this device';
    return inFile + (r.installed ? '. Installed on this device' : '. Not installed on this device');
  }
  function actions(r, redraw) {
    if (r.status !== 'missing') return [];
    var out = [];
    if (r.pack) out.push(h('button', { type: 'button', class: 'sui-btn sui-primary', onclick: function () { SlopLibrary.open({ packId: r.pack.id, onInstalled: redraw }); } }, 'Download'));
    out.push(h('button', { type: 'button', class: 'sui-btn', onclick: function () { dropFile(r, redraw); } }, 'Drop your own'));
    out.push(h('button', { type: 'button', class: 'sui-btn', onclick: function () { useClosest(r, redraw); } }, 'Use closest font'));
    return out;
  }
  /** Picks a font file from disk, stores it on the device and redraws the list. */
  function dropFile(r, redraw) {
    var input = h('input', { type: 'file', accept: '.ttf,.otf,.woff', hidden: '' });
    input.addEventListener('change', async function () {
      var file = input.files[0];
      if (!file) return;
      try { var got = await C().addUserFile(file); SlopUI.toast('Installed ' + got.family + ' on this device'); }
      catch (e) { SlopUI.toast(e.message || 'That font file could not be used'); }
      redraw();
    });
    document.body.append(input);
    input.click();
    input.remove();
  }
  /** Substitutes the closest bundled family for this font in every file that uses it (the same answer the prompt records). */
  function useClosest(r, redraw) {
    r.files.forEach(function (f) { f.fontMap = f.fontMap || new Map(); f.fontMap.set(r.family, r.closest); });
    SlopUI.toast('Using ' + r.closest + ' for ' + r.family);
    redraw();
  }
  function rowEl(r, redraw) {
    return h('div', { class: 'pf-row', 'data-family': r.family, 'data-status': r.status },
      h('div', { class: 'pf-main' }, h('div', { class: 'pf-name', style: { fontFamily: '"' + r.family.replace(/["\\]/g, '') + '", sans-serif' } }, r.family), h('div', { class: 'pf-detail' }, detail(r))),
      h('span', { class: 'pf-status pf-' + r.status }, LABEL[r.status]),
      h('div', { class: 'pf-actions' }, actions(r, redraw)));
  }
  /** The Fonts dialog. Reopening it reads the document again. */
  A.openFonts = function () {
    if (SP.offline || !window.SlopFontCatalog || !E.state.pages.length) return;
    var list = h('div', { class: 'pf-list', role: 'list' }, h('p', { class: 'sui-p' }, 'Reading the fonts…'));
    var note = h('p', { class: 'sui-p pf-note' }, 'Missing fonts are needed to edit text as it looks. Nothing is downloaded until you confirm it in the library.');
    async function redraw() {
      var rows = await gather();
      list.replaceChildren(...(rows.length ? rows.map(function (r) { return rowEl(r, redraw); }) :
        [h('p', { class: 'sui-p' }, 'This document embeds no fonts. Its text uses the standard fonts.')]));
    }
    SlopUI.dialog({ title: 'Fonts', body: h('div', null, note, list), cls: 'pf-dlg', buttons: [{ label: 'Close', primary: true }] });
    redraw();
  };
  var topBtn = document.getElementById('btnFonts');
  if (topBtn) topBtn.addEventListener('click', function () { A.openFonts(); });
})();
