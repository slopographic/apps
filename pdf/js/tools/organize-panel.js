/* Slop PDF — Organize panel: files list, selection actions, insert blank / from file, ordering, merge notes, keys. */
(function () {
  'use strict';
  var SP = window.SP, U = SP.util, E = SP.engine, h = U.h, P = SP.panels, PANELS = P.PANELS, K = P.helpers;
  var section = K.section, row = K.row, btn = K.btn, seg = K.seg, select = K.select, num = K.num, text = K.text, slider = K.slider, colorPicker = K.colorPicker, check = K.check, note = K.note, needPages = K.needPages, onRefresh = K.onRefresh;
  /* ---------------------------------------------------------- organize */
  PANELS.organize = {
    title: 'Organize pages', icon: 'organize', build: function (b) {
      var files = h('div', { class: 'file-list' });
      b.appendChild(section('Files', [files, h('div', { class: 'btn-row' }, btn('Add PDFs or images', 'plus', function () { SP.app.openDialog(); }, 'wide'))]));
      onRefresh(function () {
        files.innerHTML = '';
        var counts = {};
        E.state.pages.forEach(function (p) { if (p.f) counts[p.f] = (counts[p.f] || 0) + 1; });
        if (!E.files.size) files.appendChild(note('No files open yet.'));
        E.files.forEach(function (f) {
          var n = counts[f.id] || 0;
          files.appendChild(h('div', { class: 'file-item' + (n ? '' : ' unused') },
            h('span', { class: 'fdot', style: { '--fc': f.color } }),
            h('span', { class: 'fi-name', title: f.name }, f.name),
            h('span', { class: 'fi-meta' }, n + '/' + f.numPages + ' p' + (f.decrypted ? ' · unlocked' : '') + (f.locked ? ' · locked' : '')),
            h('button', { type: 'button', class: 'ib', title: 'Select its pages', 'aria-label': 'Select pages from ' + f.name, html: U.icon('selectall'), onclick: function () { SP.organizer.setSelection(E.state.pages.filter(function (p) { return p.f === f.id; }).map(function (p) { return p.id; })); } }),
            h('button', { type: 'button', class: 'ib', title: n ? 'Remove its pages' : 'Add its pages again', 'aria-label': (n ? 'Remove pages of ' : 'Re-add pages of ') + f.name, html: U.icon(n ? 'trash' : 'plus'), onclick: function () {
              if (n) SP.app.remove(E.state.pages.filter(function (p) { return p.f === f.id; }).map(function (p) { return p.id; }));
              else E.commit('Add ' + f.name, function (st) { st.pages = st.pages.concat(E.pagesForFile(f)); });
            } })));
        });
      });
      var selInfo = h('p', { class: 'pp-note sel-info' });
      b.appendChild(section('Selection', [selInfo, h('div', { class: 'btn-grid' },
        btn('Rotate left', 'rotl', function () { SP.app.rotate(SP.app.targetIds(), -90); }),
        btn('Rotate right', 'rotr', function () { SP.app.rotate(SP.app.targetIds(), 90); }),
        btn('Duplicate', 'copy', function () { SP.app.duplicate(SP.app.targetIds()); }),
        btn('Delete', 'trash', function () { SP.app.remove(SP.app.targetIds()); }, 'danger-text'),
        btn('Extract to PDF', 'extract', function () { SP.app.extract(); }),
        btn('Select all', 'selectall', function () { SP.organizer.selectAll(); }))]));
      onRefresh(function () {
        var n = SP.organizer.sel.size, t = E.state.pages.length;
        selInfo.textContent = n ? n + ' of ' + t + ' pages selected' + (n ? ' (' + U.describeIdx(SP.organizer.selectedIndices()) + ')' : '') : 'No pages selected — actions apply to all ' + t + ' pages. Click, Shift-click, Ctrl/⌘-click or drag a box to select.';
      });
      var ins = SP.app.insertOpts;
      b.appendChild(section('Insert', [
        row('Page size', seg([['a4', 'A4'], ['letter', 'Letter'], ['same', 'Same as neighbour']], ins.size, function (v) { ins.size = v; }, 'Blank page size')),
        row('Orientation', seg([['portrait', 'Portrait'], ['landscape', 'Landscape']], ins.orient, function (v) { ins.orient = v; }, 'Orientation')),
        row('Position', select([['after', 'After selection'], ['before', 'Before selection'], ['start', 'At the start'], ['end', 'At the end']], ins.where, function (v) { ins.where = v; })),
        h('div', { class: 'btn-row' }, btn('Blank page', 'blank', function () { SP.app.insertBlank(); }), btn('From file…', 'insert', function () { SP.app.insertFromFile(); }))]));
      var sortSel = 'collate';
      b.appendChild(section('Order', [
        h('div', { class: 'btn-row' }, btn('Reverse', 'reverse', function () { SP.app.reverse(); })),
        row('Sort', select([['collate', 'Collate front/back scans (backs reversed)'], ['collate-same', 'Collate front/back scans (same order)'], ['odd-even', 'Odd pages first, then even'], ['even-odd', 'Even pages first, then odd'], ['source', 'Group by source file & page']], sortSel, function (v) { sortSel = v; })),
        h('div', { class: 'btn-row' }, btn('Apply sort', 'sort', function () { SP.app.sort(sortSel); })),
        note('Scanned a double-sided stack on a one-sided scanner? Scan all fronts, flip the stack, scan the backs, open both files, then “Collate”.')]));
      b.appendChild(section('Merge', [note('Every file you open is added to one document, colour-coded by source. Arrange pages, then press Download to save the merged PDF.')]));
      b.appendChild(section('Keyboard', [h('dl', { class: 'keys' },
        h('dt', null, '← → ↑ ↓'), h('dd', null, 'Move focus (Shift extends)'),
        h('dt', null, 'Alt + arrows'), h('dd', null, 'Move selected pages'),
        h('dt', null, 'Space'), h('dd', null, 'Toggle selection'),
        h('dt', null, 'R / Shift+R'), h('dd', null, 'Rotate right / left'),
        h('dt', null, 'Del'), h('dd', null, 'Delete pages'),
        h('dt', null, 'Enter'), h('dd', null, 'Open page view'),
        h('dt', null, 'Ctrl/⌘ Z, Shift Z'), h('dd', null, 'Undo / redo'))], { cls: 'pp-keys' }));
    }
  };

  /* -------------------------------------------------------------- edit */
})();
