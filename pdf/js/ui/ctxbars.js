/* Slop PDF — contextual toolbars above the workspace (organizer actions; page view nav, tools, zoom). */
(function () {
  'use strict';
  var SP = window.SP, U = SP.util, E = SP.engine, O = SP.organizer, Ed = SP.editor, PN = SP.panels, A = SP.app, S = A._;
  var $ = U.$, h = U.h;
  /* ------------------------------------------------------------ ctx bars */
  S.ib = function (icon, label, fn, extra) {
    var b = h('button', Object.assign({ type: 'button', class: 'tb', title: label, 'aria-label': label, html: U.icon(icon) }, extra || {}));
    b.addEventListener('click', fn);
    return b;
  }
  S.ibl = function (icon, label, fn, short) {
    var b = h('button', { type: 'button', class: 'tb tb-l', title: label, html: U.icon(icon) + '<span>' + (short || label) + '</span>' });
    b.addEventListener('click', fn);
    return b;
  }
  S.sep = function () { return h('span', { class: 'tb-sep', 'aria-hidden': 'true' }); }
  S.buildCtxBars = function () {
    var g = S.els.ctxGrid;
    var sizeSeg = O.sizeControl();
    g.append(
      S.ibl('selectall', 'Select all', function () { if (O.sel.size === E.state.pages.length) O.setSelection([]); else O.selectAll(); }, 'All'), S.sep(),
      S.ib('rotl', 'Rotate left', function () { A.rotate(A.targetIds(), -90); }),
      S.ib('rotr', 'Rotate right', function () { A.rotate(A.targetIds(), 90); }),
      S.ib('copy', 'Duplicate', function () { A.duplicate(A.targetIds()); }),
      S.ib('trash', 'Delete', function () { A.remove(A.targetIds()); }), S.sep(),
      S.ibl('extract', 'Extract selected pages to a new PDF', function () { A.extract(); }, 'Extract'),
      S.ibl('blank', 'Insert blank page', function () { A.insertBlank(); }, 'Blank'),
      S.ibl('insert', 'Insert pages from a file', function () { A.insertFromFile(); }, 'Insert'),
      S.ib('reverse', 'Reverse order', function () { A.reverse(); }),
      S.ib('eye', 'Open page view (Enter)', function () { A.ensurePage(); }),
      h('span', { class: 'tb-flex' }), sizeSeg);
    var p = S.els.ctxPage;
    var pageNo = h('span', { class: 'pv-num', id: 'pvNum' }, '');
    var zoomLbl = h('button', { type: 'button', class: 'tb tb-zoom', id: 'zoomLbl', title: 'Zoom presets' }, '100%');
    zoomLbl.addEventListener('click', function (e) {
      var r = zoomLbl.getBoundingClientRect();
      SlopUI.menu([{ label: 'Fit page', key: '0', act: function () { Ed.fit('fit'); } }, { label: 'Fit width', act: function () { Ed.fit('width'); } }, '-'].concat([0.5, 0.75, 1, 1.5, 2, 3, 4].map(function (z) { return { label: Math.round(z * 100) + '%', act: function () { Ed.setZoom(z * 96 / 72); } }; })), r.left, r.bottom + 4);
      e.stopPropagation();
    });
    var tools = h('div', { class: 'pv-tools', role: 'toolbar', 'aria-label': 'Annotation tools' });
    Ed.TOOLS.forEach(function (t) {
      var b = S.ib(t[2], t[1] + ' (' + t[3] + ')', function () { Ed.setTool(t[0]); }, { 'data-tool': t[0] });
      tools.appendChild(b);
    });
    p.append(
      S.ibl('organize', 'Back to all pages (Esc)', function () { A.showGrid(); }, 'Pages'), S.sep(),
      S.ib('prev', 'Previous page (PgUp)', function () { A.gotoPage(-1); }), pageNo, S.ib('next', 'Next page (PgDn)', function () { A.gotoPage(1); }), S.sep(),
      S.ib('rotl', 'Rotate page left', function () { A.rotate([Ed.pid], -90); }), S.ib('rotr', 'Rotate page right', function () { A.rotate([Ed.pid], 90); }), S.sep(),
      tools, h('span', { class: 'tb-flex' }),
      S.ib('zoomout', 'Zoom out (−)', function () { Ed.zoomBy(1 / 1.25); }), zoomLbl, S.ib('zoomin', 'Zoom in (+)', function () { Ed.zoomBy(1.25); }), S.ib('fit', 'Fit page (0)', function () { Ed.fit('fit'); }));
  }
})();
