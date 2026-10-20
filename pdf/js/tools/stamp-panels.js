/* Slop PDF — Page numbers panel (live preview, undoable). The Watermark panel is tools/watermark-panel.js. */
(function () {
  'use strict';
  var SP = window.SP, U = SP.util, E = SP.engine, h = U.h, P = SP.panels, PANELS = P.PANELS, K = P.helpers;
  var section = K.section, row = K.row, btn = K.btn, seg = K.seg, select = K.select, num = K.num, text = K.text, slider = K.slider, colorPicker = K.colorPicker, check = K.check, note = K.note, needPages = K.needPages, onRefresh = K.onRefresh;
  PANELS.numbers = {
    title: 'Page numbers', icon: 'numbers', build: function (b) {
      var np = needPages(); if (np) { b.appendChild(np); return; }
      var cur = E.state.stamps.pageNumbers;
      var o = Object.assign({ position: 'bottom-center', format: 'n', start: 1, size: 11, font: 'Helvetica', bold: false, color: '#111111', margin: 28, skipFirst: false }, cur || U.store.get('pnOpts', {}));
      function apply(label) { U.store.set('pnOpts', o); if (E.state.stamps.pageNumbers) E.commit(label || 'Page numbers', function (st) { st.stamps.pageNumbers = Object.assign({}, o); }, 'pn'); }
      var posGrid = h('div', { class: 'pos-grid', role: 'radiogroup', 'aria-label': 'Position' });
      ['top-left', 'top-center', 'top-right', 'bottom-left', 'bottom-center', 'bottom-right'].forEach(function (p) {
        var bt = h('button', { type: 'button', class: 'pos-b' + (o.position === p ? ' on' : ''), role: 'radio', 'aria-checked': o.position === p ? 'true' : 'false', 'aria-label': p.replace('-', ' '), title: p.replace('-', ' ') }, h('i'));
        bt.addEventListener('click', function () { o.position = p; U.$$('.pos-b', posGrid).forEach(function (x) { x.classList.toggle('on', x === bt); x.setAttribute('aria-checked', x === bt ? 'true' : 'false'); }); apply(); });
        posGrid.appendChild(bt);
      });
      b.appendChild(section('Position', [posGrid]));
      b.appendChild(section('Format', [
        row('Style', select([['n', '1'], ['page', 'Page 1'], ['n-of', '1 / N'], ['page-of', 'Page 1 of N'], ['dash', '– 1 –']], o.format, function (v) { o.format = v; apply(); })),
        row('Start at', num(o.start, 0, 99999, 1, function (v) { o.start = Math.round(v); apply(); })),
        row('Size', num(o.size, 5, 72, 1, function (v) { o.size = v; apply(); }), 'pt'),
        row('Font', select([['Helvetica', 'Helvetica'], ['Times', 'Times'], ['Courier', 'Courier']], o.font, function (v) { o.font = v; apply(); })),
        row('Margin', num(o.margin, 4, 144, 1, function (v) { o.margin = v; apply(); }), 'pt'),
        row('Colour', colorPicker(o.color, function (v) { o.color = v; apply(); })),
        check('Bold', o.bold, function (v) { o.bold = v; apply(); }),
        check('Skip the first page (cover)', o.skipFirst, function (v) { o.skipFirst = v; apply(); })]));
      var acts = h('div', { class: 'btn-row' });
      b.appendChild(section(null, [acts, note('Numbers follow the final page order and each page’s rotation, and are drawn into the PDF on download.')]));
      onRefresh(function () {
        acts.innerHTML = '';
        if (E.state.stamps.pageNumbers) acts.append(btn('Remove page numbers', 'trash', function () { SlopUI.confirm('Remove page numbers', 'Take the page numbers off this document? Undo brings them back.', 'Remove', { danger: true }).then(function (ok) { if (ok) E.commit('Remove page numbers', function (st) { st.stamps.pageNumbers = null; }); }); }, 'danger-text'));
        else acts.append(btn('Add page numbers', 'numbers', function () { U.store.set('pnOpts', o); E.commit('Add page numbers', function (st) { st.stamps.pageNumbers = Object.assign({}, o); }); }, 'primary wide'));
      });
    }
  };

  /* -------------------------------------------------------------- forms */
})();
