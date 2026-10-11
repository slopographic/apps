/* Slop Press — Export PDF, Export PNG and Print dialogs. */
(function () {
  'use strict';
  var PR = window.PR, U = PR.util, h = U.h, S = PR.state, P = PR.pages;
  var UI = PR.ui = PR.ui || {};
  var SU = function () { return window.SlopUI; };
  var ST = PR.store;

  function check(label, on, title) { var c = h('input', { type: 'checkbox' }); c.checked = !!on; return { el: h('label', { class: 'pr-check', title: title || '' }, c, label), input: c }; }
  function rangeField() {
    var mode = SU().select([['all', 'All pages'], ['current', 'Current page (' + P.label(S.doc, S.page) + ')'], ['range', 'Range…']], 'all');
    var txt = h('input', { class: 'sui-input', type: 'text', placeholder: 'e.g. 1-4, 8', value: '1-' + P.label(S.doc, S.doc.pages.length - 1) });
    var f = SU().field('Range', txt); f.hidden = true;
    mode.addEventListener('change', function () { f.hidden = mode.value !== 'range'; });
    return { els: [SU().field('Pages', mode), f], pages: function () { return mode.value === 'all' ? null : mode.value === 'current' ? [S.page] : UI.parseRange(txt.value); } };
  }
  function busy(label, p) {
    U.toast(label + '…', 60000);
    return p.then(function (r) { U.toast(label + ' done'); return r; }, function (e) { console.error(e); U.toast(label + ' failed: ' + e.message, 5000); throw e; });
  }

  UI.exportPDF = function () {
    var last = ST.pref('pdfopts') || { preset: 'press', bleed: true, cropMarks: true, bleedMarks: false, regMarks: true, pageInfo: true, embed: true };
    var preset = SU().select([['press', 'Press quality (bleed + printer’s marks)'], ['digital', 'Digital / screen (trim size, no marks)'], ['custom', 'Custom']], last.preset);
    var rg = rangeField();
    var bleed = check('Include bleed (' + U.fmt(S.doc.bleed.top, S.doc.unit, true) + ')', last.bleed), crop = check('Crop marks', last.cropMarks), bm = check('Bleed marks', last.bleedMarks),
      reg = check('Registration marks', last.regMarks), info = check('Page information (slug)', last.pageInfo), emb = check('Embed fonts (subset)', last.embed, 'Bundled Liberation Sans and loaded .ttf/.otf fonts are embedded; system fonts use PDF standard fonts');
    function applyPreset() {
      if (preset.value === 'press') { bleed.input.checked = crop.input.checked = reg.input.checked = info.input.checked = true; bm.input.checked = false; }
      if (preset.value === 'digital') { bleed.input.checked = crop.input.checked = reg.input.checked = info.input.checked = bm.input.checked = false; }
    }
    preset.addEventListener('change', applyPreset);
    [bleed, crop, bm, reg, info].forEach(function (c) { c.input.addEventListener('change', function () { preset.value = 'custom'; }); });
    var over = PR.engine.oversetStories().length, STD = { Helvetica: 1, Arial: 1, Times: 1, Courier: 1 };
    var subs = {}; PR.pdfDraw.fontKeys(S.doc, S.doc.pages.map(function (p, i) { return i; })).forEach(function (k) { var f = k.split('|')[0]; if (!STD[f] && PR.fonts.substituted(f)) subs[f] = PR.fonts.family(f).std || 'Helvetica'; });
    var subList = Object.keys(subs).map(function (f) { return f + ' → ' + subs[f]; }).join(', ');
    var body = h('div', { class: 'pr-form' }, SU().field('Preset', preset), rg.els, h('h4', null, 'Marks & bleed'), h('div', { class: 'pr-cols' }, bleed.el, crop.el, bm.el, reg.el, info.el, emb.el),
      h('p', { class: 'sui-p' }, 'TrimBox = page size, BleedBox = page + bleed, MediaBox grows to fit the marks. Process (CMYK) swatches are written as CMYK; marks use the Registration colour.'),
      subList ? h('p', { class: 'sui-p' }, 'ⓘ No font file to embed for: ' + subList + '. Text positions stay exact; load a .ttf/.otf (File ▸ Load Font File) to embed the real design.') : null,
      over ? h('p', { class: 'sui-p', style: { color: '#ff6b6b' } }, '⚠ ' + over + ' stor' + (over === 1 ? 'y has' : 'ies have') + ' overset text that will not be exported.') : null);
    SU().dialog({ title: 'Export PDF', body: body, cls: 'pr-mid', buttons: [{ label: 'Cancel' }, { label: 'Export', primary: true, act: function () {
      var o = { preset: preset.value, bleed: bleed.input.checked, cropMarks: crop.input.checked, bleedMarks: bm.input.checked, regMarks: reg.input.checked, pageInfo: info.input.checked, embed: emb.input.checked };
      ST.pref('pdfopts', o);
      busy('Exporting PDF', PR.pdf.download(U.assign({ pages: rg.pages() }, o)));
    } }] });
  };
  UI.exportPNG = function () {
    var rg = rangeField(), dpi = SU().select([['72', '72 ppi (screen)'], ['150', '150 ppi'], ['300', '300 ppi (print)']], '150');
    var fmt = SU().select([['image/png', 'PNG'], ['image/jpeg', 'JPEG']], 'image/png'), bleed = check('Include bleed', false), tr = check('Transparent paper (PNG)', false);
    SU().dialog({ title: 'Export Images', body: h('div', { class: 'pr-form' }, rg.els, SU().field('Resolution', dpi), SU().field('Format', fmt), bleed.el, tr.el, h('p', { class: 'sui-p' }, 'One file per page; several pages download as a .zip.')),
      buttons: [{ label: 'Cancel' }, { label: 'Export', primary: true, act: function () {
        var pages = rg.pages() || S.doc.pages.map(function (p, i) { return i; });
        busy('Exporting images', PR.raster.exportPNG(pages, +dpi.value, { bleed: bleed.input.checked, transparent: tr.input.checked && fmt.value === 'image/png', type: fmt.value, quality: 0.92 }));
      } }] });
  };
  UI.printDialog = function () {
    var rg = rangeField(), dpi = SU().select([['150', 'Draft (150 ppi)'], ['200', 'Normal (200 ppi)'], ['300', 'High (300 ppi)']], '200'), bleed = check('Include bleed', false);
    SU().dialog({ title: 'Print', body: h('div', { class: 'pr-form' }, rg.els, SU().field('Quality', dpi), bleed.el,
      h('p', { class: 'sui-p' }, 'Pages are rendered and sent to your browser’s print dialog at their real size. For a press, use Export PDF.')),
      buttons: [{ label: 'PDF instead…', act: function () { setTimeout(UI.exportPDF, 160); } }, { label: 'Cancel' }, { label: 'Print', primary: true, act: function () {
        var pages = rg.pages() || S.doc.pages.map(function (p, i) { return i; });
        busy('Preparing pages', PR.raster.print(pages, +dpi.value, { bleed: bleed.input.checked }));
      } }] });
  };
})();
