/* Slop PDF — Extract assets (File menu and command palette): the embedded images (size, colour space, page) and fonts
   of the document in a checkbox list, saved as one zip or one file each, or to Slop Drive in a folder named after the PDF.
   Items that cannot be saved are listed with the reason. The scan and the saving are in io/assets-scan.js and assets-save.js. */
(function () {
  'use strict';
  var SP = window.SP, U = SP.util, E = SP.engine, Ed = SP.editor, A = SP.app, X = SP.assets, Mod = window.SlopPdfAssets, h = U.h;

  A.extractAssets = async function () {
    if (!E.state.pages.length) return;
    if (Ed.isEditingText()) Ed.commitText();
    A.busy('Reading the images and fonts…', 0);
    var found;
    try { found = await X.scan(); }
    catch (e) { console.error(e); SlopUI.alert('Could not read the assets', String((e && e.message) || e)); return; }
    finally { A.busy(null); }
    if (!found.images.length && !found.fonts.length) { SlopUI.alert('No assets', 'These pages have no embedded images or fonts.'); return; }
    openList(found);
  };

  function openList(found) {
    var rows = Mod.rows(found.images, found.fonts), chosen = new Set(), boxes = [], fmt = 'zip';
    var base = X.baseName(), canDrive = !!window.SlopHub && !SP.offline;
    var sum = h('p', { class: 'sui-p ea-sum' });
    function count() { sum.textContent = chosen.size + ' of ' + rows.counts.selectable + ' selected · ' + rows.counts.images + ' images, ' + rows.counts.fonts + ' fonts'; }
    function setAll(on) {
      boxes.forEach(function (b) { if (!b.cb.disabled) { b.cb.checked = on; if (on) chosen.add(b.id); else chosen.delete(b.id); } });
      count();
    }
    function row(r) {
      var cb = h('input', { type: 'checkbox', disabled: r.disabled });
      cb.checked = chosen.has(r.id);
      cb.addEventListener('change', function () { if (cb.checked) chosen.add(r.id); else chosen.delete(r.id); count(); });
      boxes.push({ id: r.id, cb: cb });
      return h('label', { class: 'ea-row' + (r.disabled ? ' is-off' : '') }, cb,
        h('span', { class: 'ea-main' }, h('span', { class: 'ea-title' }, r.title), h('span', { class: 'ea-meta' }, r.meta.join(' · ')),
          r.reason ? h('span', { class: 'ea-reason' }, r.reason) : null));
    }
    function section(title, list) {
      if (!list.length) return null;
      return h('section', { class: 'ea-sec' }, h('h3', { class: 'ea-h' }, title + ' (' + list.length + ')'), h('div', { class: 'ea-items' }, list.map(row)));
    }
    rows.images.concat(rows.fonts).forEach(function (r) { if (r.checked) chosen.add(r.id); });
    var sel = h('select', { class: 'ea-fmt', 'aria-label': 'Output' }, h('option', { value: 'zip' }, 'One .zip'), h('option', { value: 'files' }, 'One file each'));
    sel.addEventListener('change', function () { fmt = sel.value; });
    var body = h('div', { class: 'ea-body' },
      h('div', { class: 'ea-tools' }, sum, h('button', { type: 'button', class: 'sui-btn', onclick: function () { setAll(true); } }, 'All'),
        h('button', { type: 'button', class: 'sui-btn', onclick: function () { setAll(false); } }, 'None')),
      h('p', { class: 'sui-p ea-note' }, 'JPEG images are saved as stored. Other images are saved as PNG. Fonts are the font files the PDF embeds; a subset font holds only the glyphs the PDF uses, so it may be incomplete.'),
      section('Images', rows.images), section('Fonts', rows.fonts),
      h('label', { class: 'ea-fmtrow' }, 'Output ', sel));
    count();
    var buttons = [{ label: 'Close' }];
    if (canDrive) buttons.push({ label: 'Save to Slop Drive', act: function () { return run('drive'); } });
    buttons.push({ label: 'Download', primary: true, act: function () { return run('download'); } });
    SlopUI.dialog({ title: 'Extract assets', cls: 'sui-wide ea-dlg', body: body, buttons: buttons });

    async function run(dest) {
      var imgs = found.images.filter(function (i) { return chosen.has(i.id); }), fonts = found.fonts.filter(function (f) { return chosen.has(f.id); });
      if (!imgs.length && !fonts.length) { SlopUI.toast('Select some items first.'); return false; }
      A.busy('Preparing the files…', 0);
      var out, asZip = fmt === 'zip', zipName = base + '-assets.zip';
      try {
        out = await X.entries(imgs, fonts);
        if (!out.entries.length) { A.busy(null); SlopUI.alert('Nothing to save', skipText(out.skipped)); return false; }
        A.busy(dest === 'drive' ? 'Saving to Slop Drive…' : 'Saving…', 0.5);
        if (dest === 'drive') await X.saveToDrive(out.entries, zipName, base, asZip);
        else await X.download(out.entries, zipName, asZip);
      } catch (e) {
        console.error(e); SlopUI.alert('Could not save the assets', String((e && e.message) || e)); return false;
      } finally { A.busy(null); }
      var n = out.entries.length, where = dest === 'drive' ? ' to Slop Drive' : '';
      var what = asZip ? 'Saved ' + n + ' asset' + (n === 1 ? '' : 's') + ' in ' + zipName : 'Saved ' + n + ' file' + (n === 1 ? '' : 's') + where;
      SlopUI.toast(what + (asZip && dest === 'drive' ? where : '') + (out.skipped.length ? ' · ' + out.skipped.length + ' skipped' : ''));
      A.status(what, 'ok');
      if (out.skipped.length) SlopUI.alert('Some items were skipped', skipText(out.skipped));
      return true;
    }
  }
  function skipText(list) { return list.length ? list.map(function (s) { return s.name + ': ' + s.reason; }).join('. ') : 'Nothing was skipped.'; }
})();
