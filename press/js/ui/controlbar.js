/* Slop Press — the control bar: type controls while editing text, geometry/paint for selected objects. */
(function () {
  'use strict';
  var PR = window.PR, U = PR.util, S = PR.state, K = PR.kit, H = PR.history, FM = PR.format, F = PR.fonts, h = U.h;
  var UI = PR.ui = PR.ui || {};
  var sig = '', refreshers = [];

  function textMode() { return !!S.text || (S.tool === 'text' && PR.selected().some(function (it) { return it.type === 'text'; })); }
  function sep() { return h('span', { class: 'cb-sep' }); }
  function reg(el, fn) { refreshers.push(fn || el.refresh); return el; }

  function typeControls(bar) {
    var cur = function () { return FM.current() || { ps: '', cs: '', char: {}, para: {} }; };
    var ps = K.select(PR.styles.names(S.doc, 'para'), cur().ps, function (v) { FM.paraStyle(v); }, 'wide');
    ps.title = 'Paragraph style';
    var cs = K.select(PR.styles.names(S.doc, 'char'), cur().cs, function (v) { FM.charStyle(v); });
    cs.title = 'Character style';
    reg(ps, function () { ps.value = cur().ps; }); reg(cs, function () { cs.value = cur().cs; });
    var fam = K.select(F.list(), cur().char.font, function (v) { FM.char({ font: v }); }, 'wide'); fam.title = 'Font family';
    var fonts = h('button', { type: 'button', class: 'btn small', title: 'Fonts: this document\'s fonts, and your own font file', onclick: function () { UI.openFonts([cur().char.font]); } }, 'Fonts…');
    var sty = K.select(F.STYLES, cur().char.fontStyle, function (v) { FM.char({ fontStyle: v }); }); sty.title = 'Font style';
    reg(fam, function () { fam.value = cur().char.font; }); reg(sty, function () { sty.value = cur().char.fontStyle || 'Regular'; });
    var size = reg(K.num({ unit: 'pt', cls: 'w48', title: 'Font size (pt)', get: function () { return cur().char.size; }, set: function (v) { FM.char({ size: Math.max(1, v) }); }, min: 1 }));
    var lead = reg(K.num({ unit: 'pt', cls: 'w48', title: 'Leading (pt or "auto")', allow: ['auto'], get: function () { var l = cur().char.leading; return l === 'auto' ? 'Auto' : l; }, set: function (v) { FM.char({ leading: v === 'auto' ? 'auto' : v }); } }));
    var track = reg(K.num({ unit: 'raw', cls: 'w48', title: 'Tracking (1/1000 em)', get: function () { return cur().char.tracking || 0; }, set: function (v) { FM.char({ tracking: v }); }, step: 10 }));
    var al = cur().para.align;
    var aligns = K.seg([['left', 'Left', 'Align left', 'left'], ['center', 'Center', 'Align center', 'center'], ['right', 'Right', 'Align right', 'right'], ['justify', 'Justify', 'Justify, last line left', 'justify'], ['justify-all', 'All', 'Justify all lines', 'justify-all']], al, function (v) { FM.para({ align: v }); });
    reg(aligns, function () { var a = cur().para.align; U.$$('.segb', aligns).forEach(function (b, i) { b.classList.toggle('on', ['left', 'center', 'right', 'justify', 'justify-all'][i] === a); }); });
    var color = h('span');
    reg(color, function () { color.innerHTML = ''; color.append(K.chip(cur().char.color, 'Text colour', function (c) { FM.char({ color: c || '#000000' }); })); });
    var sb = reg(K.num({ unit: 'pt', cls: 'w48', title: 'Space before', get: function () { return cur().para.spaceBefore || 0; }, set: function (v) { FM.para({ spaceBefore: v }); } }));
    var sa = reg(K.num({ unit: 'pt', cls: 'w48', title: 'Space after', get: function () { return cur().para.spaceAfter || 0; }, set: function (v) { FM.para({ spaceAfter: v }); } }));
    var fi = reg(K.num({ unit: 'doc', cls: 'w48', title: 'First-line indent', get: function () { return cur().para.indentFirst || 0; }, set: function (v) { FM.para({ indentFirst: v }); } }));
    bar.append(h('span', { class: 'cb-label' }, '¶'), ps, cs, sep(), fam, fonts, sty, K.field('Size', size), K.field('Lead', lead), K.field('Track', track), color, sep(), aligns, sep(),
      K.field('Before', sb), K.field('After', sa), K.field('Indent', fi));
  }
  function objControls(bar, its) {
    var it = its[0], unit = S.doc.unit;
    function geo(key, label) {
      return K.field(label, reg(K.num({ cls: 'w80', title: label + ' (' + unit + ')', get: function () { return it[key]; }, set: function (v) {
        var d = v - it[key]; its.forEach(function (x) { if (key === 'x' || key === 'y') x[key] += d; else x[key] = Math.max(1, v); }); H.commit('Transform');
      } })));
    }
    bar.append(h('span', { class: 'cb-label' }, its.length > 1 ? its.length + ' objects' : ({ text: 'Text frame', image: 'Image frame', rect: 'Rectangle', ellipse: 'Ellipse', line: 'Line', polygon: 'Polygon' }[it.type])),
      sep(), geo('x', 'X'), geo('y', 'Y'), geo('w', 'W'), geo('h', 'H'),
      K.field('∠', reg(K.num({ unit: '°', cls: 'w48', title: 'Rotation (degrees)', get: function () { return it.rot || 0; }, set: function (v) { its.forEach(function (x) { x.rot = ((v % 360) + 360) % 360; }); H.commit('Rotate'); } }))), sep());
    var fill = h('span'), stroke = h('span');
    reg(fill, function () { fill.innerHTML = ''; fill.append(K.chip(it.fill, 'Fill', function (c) { UI.setPaint('fill', c); })); });
    reg(stroke, function () { stroke.innerHTML = ''; stroke.append(K.chip(it.stroke, 'Stroke', function (c) { UI.setPaint('stroke', c); })); });
    bar.append(K.field('Fill', fill), K.field('Stroke', stroke),
      reg(K.num({ unit: 'pt', cls: 'w48', title: 'Stroke weight (pt)', get: function () { return it.sw; }, set: function (v) { its.forEach(function (x) { x.sw = Math.max(0, v); }); H.commit('Stroke weight'); }, min: 0, step: 0.5 })));
    if (it.type === 'rect' || it.type === 'image' || it.type === 'text') bar.append(K.field('Corner', reg(K.num({ unit: 'doc', cls: 'w48', title: 'Corner radius', get: function () { return it.radius || 0; }, set: function (v) { its.forEach(function (x) { x.radius = Math.max(0, v); }); H.commit('Corner radius'); }, min: 0 }))));
    bar.append(K.field('Opacity', reg(K.num({ unit: '%', cls: 'w48', title: 'Opacity (%)', get: function () { return Math.round((it.opacity == null ? 1 : it.opacity) * 100); }, set: function (v) { its.forEach(function (x) { x.opacity = U.clamp(v, 0, 100) / 100; }); H.commit('Opacity'); } }))));
    if (it.type === 'text') bar.append(sep(), K.field('Columns', reg(K.num({ unit: 'raw', cls: 'w48', title: 'Columns in frame', get: function () { return it.cols || 1; }, set: function (v) { it.cols = U.clamp(Math.round(v), 1, 12); H.commit('Columns'); }, min: 1 }))));
    if (it.type === 'image') bar.append(sep(), K.seg([['fill', 'Fill', 'Fill frame proportionally'], ['fit', 'Fit', 'Fit content proportionally'], ['center', 'Center', 'Center content'], ['stretch', 'Stretch', 'Fit content to frame']], it.fit, function (v) { its.forEach(function (x) { x.fit = v; }); H.commit('Fitting'); UI.refreshControlBar(true); }));
    bar.append(sep(), h('span', { class: 'fl' }, 'Wrap'), K.seg([['none', 'None', 'No text wrap'], ['box', 'Box', 'Wrap around bounding box'], ['contour', 'Shape', 'Wrap around object shape'], ['jump', 'Jump', 'Jump object']], (it.wrap || {}).type || 'none', function (v) { its.forEach(function (x) { x.wrap = U.assign({ off: 6 }, x.wrap, { type: v }); }); H.commit('Text wrap'); UI.refreshControlBar(true); }));
  }
  function idleControls(bar) {
    var d = S.doc, pre = U.presetFor(d.size.w, d.size.h);
    bar.append(h('span', { class: 'cb-label' }, (pre ? pre.name : 'Custom') + ' · ' + U.fmt(d.size.w, d.unit, true) + ' × ' + U.fmt(d.size.h, d.unit, true)),
      sep(), h('span', { class: 'cb-hint' }, d.pages.length + ' page' + (d.pages.length === 1 ? '' : 's') + (d.facing ? ' · facing' : '') + ' · ' + d.columns.count + ' col'), sep());
    var b1 = h('button', { type: 'button', class: 'btn small' }, 'Document Setup…'); b1.addEventListener('click', function () { PR.actions.run('file.docSetup'); });
    var b2 = h('button', { type: 'button', class: 'btn small' }, 'Margins & Columns…'); b2.addEventListener('click', function () { PR.actions.run('layout.marginsColumns'); });
    var b3 = h('button', { type: 'button', class: 'btn small primary' }, 'Export PDF…'); b3.addEventListener('click', function () { PR.actions.run('file.exportPDF'); });
    bar.append(b1, b2, b3, sep(), h('span', { class: 'cb-hint' }, hint()));
  }
  function hint() {
    return { select: 'Click to select · drag to move · Alt-drag duplicates · double-click text to edit', text: 'Drag to draw a text frame · click a frame to type', frame: 'Drag an image frame, then File ▸ Place', rect: 'Drag to draw · Shift for a square', ellipse: 'Drag to draw · Shift for a circle', line: 'Drag to draw · Shift for 45°', polygon: 'Drag to draw a polygon', hand: 'Drag to pan', zoom: 'Click to zoom in · Alt-click out · drag a box' }[S.tool] || '';
  }
  UI.refreshControlBar = function (force) {
    var bar = U.$('#controlbar'); if (!bar || !S.doc) return;
    var its = S.text ? [] : PR.selected();
    var s2 = (textMode() ? 'T' : its.length ? 'O' + S.sel.join(',') : 'I' + S.tool + S.doc.pages.length) + '|' + S.doc.unit;
    if (s2 === sig && !force) { refreshers.forEach(function (f) { try { f(); } catch (e) { /* stale */ } }); return; }
    sig = s2; refreshers = []; bar.innerHTML = '';
    if (textMode()) typeControls(bar); else if (its.length) objControls(bar, its); else idleControls(bar);
    refreshers.forEach(function (f) { try { f(); } catch (e) { /* ignore */ } });
  };
  var q = false;
  function later() { if (q) return; q = true; requestAnimationFrame(function () { q = false; UI.refreshControlBar(); }); }
  ['select', 'tool', 'textsel', 'commit', 'doc', 'fonts', 'change'].forEach(function (ev) { PR.on(ev, later); });
})();
