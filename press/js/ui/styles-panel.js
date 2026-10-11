/* Slop Press — Paragraph Styles and Character Styles panels. Click applies (Alt-click clears overrides). */
(function () {
  'use strict';
  var PR = window.PR, U = PR.util, h = U.h, S = PR.state, ST = PR.styles, FM = PR.format, H = PR.history;
  var UI = PR.ui = PR.ui || {};

  function build(kind) {
    return function (body, foot) {
      var doc = S.doc, cur = FM.current(), use = ST.usage(doc), list = h('div', { class: 'list', role: 'listbox', 'aria-label': kind === 'para' ? 'Paragraph styles' : 'Character styles' });
      var curName = cur ? (kind === 'para' ? cur.ps : cur.cs) : null, ov = cur ? Object.keys(kind === 'para' ? cur.paraOv : cur.charOv).length > 0 : false;
      ST.names(doc, kind).forEach(function (n) {
        var st = doc.styles[kind][n] || {}, eff = kind === 'para' ? ST.para(doc, n) : ST.char(doc, n);
        var sample = h('span', { class: 'sname', style: { fontFamily: eff.font ? PR.fonts.family(eff.font).css : '', fontWeight: PR.fonts.isBold(eff.fontStyle) ? 700 : '', fontStyle: PR.fonts.isItalic(eff.fontStyle) ? 'italic' : '' } }, n);
        var edit = h('button', { type: 'button', class: 'sedit', title: 'Edit style', 'aria-label': 'Edit ' + n, html: PR.kit.icon('edit') });
        var row = h('div', { class: 'srow' + (curName === n ? ' on' : ''), role: 'option', 'aria-selected': String(curName === n), title: (st.basedOn ? 'Based on ' + st.basedOn + ' · ' : '') + 'Click to apply · Alt-click: apply and clear overrides' },
          sample, curName === n && ov ? h('span', { class: 'plus', title: 'Local overrides' }, '+') : null, h('span', { class: 'smeta' }, use[kind][n] || ''), /^\[/.test(n) && kind === 'char' ? null : edit);
        row.addEventListener('click', function (e) {
          if (e.target.closest('.sedit')) return;
          if (!FM.hasText()) { PR.util.toast('Select text or a text frame first'); return; }
          if (kind === 'para') FM.paraStyle(n, e.altKey); else FM.charStyle(n);
        });
        row.addEventListener('dblclick', function () { UI.styleEditor(kind, n); });
        edit.addEventListener('click', function () { UI.styleEditor(kind, n); });
        row.addEventListener('contextmenu', function (e) {
          e.preventDefault();
          var fixed = /^\[/.test(n);
          window.SlopUI.menu([{ label: 'Edit “' + n + '”…', disabled: fixed && kind === 'char', act: function () { UI.styleEditor(kind, n); } },
            { label: 'Duplicate Style', disabled: fixed && kind === 'char', act: function () { var nn = n.replace(/^\[|\]$/g, '') + ' copy'; while (doc.styles[kind][nn]) nn += '+'; doc.styles[kind][nn] = U.clone(doc.styles[kind][n]); ST.invalidate(); H.commit('Duplicate style'); } },
            { label: 'New Style Based on “' + n + '”…', act: function () { UI.styleEditor(kind, null, n); } },
            { label: 'Redefine from Selection', disabled: curName !== n || !ov, act: function () { FM.redefine(kind); } },
            '-', { label: 'Delete Style', disabled: fixed, act: function () { ST.remove(doc, kind, n); H.commit('Delete style'); } }], e.clientX, e.clientY);
        });
        list.append(row);
      });
      body.append(list);
      foot.append(h('span', { class: 'count' }, (curName ? curName + (ov ? '+' : '') : 'No text selected')),
        UI.footBtn('edit', 'Clear overrides', function () { FM.clearOverrides(); }),
        UI.footBtn('plus', 'New ' + (kind === 'para' ? 'paragraph' : 'character') + ' style', function () { UI.styleEditor(kind, null, curName && !/^\[None/.test(curName) ? curName : null); }));
    };
  }
  UI.panel({ id: 'parastyles', title: 'Paragraph Styles', build: build('para') });
  UI.panel({ id: 'charstyles', title: 'Character Styles', build: build('char') });
  var soon = U.debounce(function () { UI.refreshPanels('parastyles'); UI.refreshPanels('charstyles'); }, 150);
  PR.on('commit', soon); PR.on('doc', soon); PR.on('textsel', soon); PR.on('select', soon);
})();
