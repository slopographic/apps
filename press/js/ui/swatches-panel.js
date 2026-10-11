/* Slop Press — Swatches panel: document colours (RGB or CMYK process), applied to fill/stroke or text. */
(function () {
  'use strict';
  var PR = window.PR, U = PR.util, h = U.h, S = PR.state, H = PR.history, K = PR.kit;
  var UI = PR.ui = PR.ui || {};
  var target = 'fill';
  UI.panel({
    id: 'swatches', title: 'Swatches',
    build: function (body, foot) {
      var doc = S.doc;
      var seg = K.seg([['fill', 'Fill'], ['stroke', 'Stroke']], target, function (v) { target = v; UI.refreshPanels('swatches'); });
      var none = h('button', { type: 'button', class: 'sw', title: 'None', style: { background: '#fff' } });
      none.classList.add('none');
      none.innerHTML = '<svg viewBox="0 0 10 10" style="width:100%;height:100%;display:block"><path d="M0 10L10 0" stroke="#e5484d" stroke-width="1.4"/></svg>';
      none.addEventListener('click', function () { UI.setPaint(target, null); });
      var grid = h('div', { class: 'swgrid' }, none);
      doc.swatches.forEach(function (sw, i) {
        var b = h('button', { type: 'button', class: 'sw' + (U.parseCMYK(sw.color) ? ' cmyk' : ''), title: sw.name + ' · ' + sw.color, 'aria-label': sw.name, style: { background: U.css(sw.color) } });
        b.addEventListener('click', function () { UI.setPaint(S.text ? 'fill' : target, sw.color); });
        b.addEventListener('dblclick', function () { editSwatch(i); });
        b.addEventListener('contextmenu', function (e) {
          e.preventDefault();
          window.SlopUI.menu([{ label: 'Edit “' + sw.name + '”…', act: function () { editSwatch(i); } },
            { label: 'Delete Swatch', disabled: /^\[/.test(sw.name), act: function () { doc.swatches.splice(i, 1); H.commit('Delete swatch'); UI.refreshPanels('swatches'); } }], e.clientX, e.clientY);
        });
        grid.append(b);
      });
      body.append(h('div', { class: 'swrow' }, h('span', { class: 'fl' }, 'Apply to'), seg), grid, h('p', { class: 'tip' }, 'Swatches marked with a CMYK dot export as process colours in PDF. While typing, swatches colour the text.'));
      foot.append(h('span', { class: 'count' }, doc.swatches.length + ' swatches'), UI.footBtn('plus', 'New swatch', function () { editSwatch(-1); }));
    }
  });
  function editSwatch(i) {
    var doc = S.doc, sw = doc.swatches[i] || { name: 'New Swatch', color: '#2f6fed' };
    K.customColor(sw.color, function (c) {
      window.SlopUI.prompt(i < 0 ? 'New Swatch' : 'Swatch Name', 'Name', sw.name).then(function (name) {
        if (name == null) return;
        var rec = { name: name || 'Swatch', color: c };
        if (i < 0) doc.swatches.push(rec);
        else {
          var old = sw.color; doc.swatches[i] = rec;
          // recolour objects that used the old swatch value
          PR.model.containers(doc).forEach(function (cn) { cn.items.forEach(function (it) { if (it.fill === old) it.fill = c; if (it.stroke === old) it.stroke = c; }); });
        }
        H.commit(i < 0 ? 'New swatch' : 'Edit swatch'); UI.refreshPanels('swatches');
      });
    }, i < 0 ? 'New Swatch' : 'Edit Swatch');
  }
  PR.on('doc', function () { UI.refreshPanels('swatches'); });
})();
