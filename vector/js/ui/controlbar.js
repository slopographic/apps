/* Slop Vector — ui: context-sensitive control bar */
(function () {
  'use strict';
  var G = window.SVGeom, SV = window.SV, S = SV.state, D = SV.dom, IO = SV.io, C = SV.cmd;
  var clone = SV.clone, getObj = SV.getObj, esc = SV.esc, fmt = G.fmt;
  var abs = Math.abs, min = Math.min, max = Math.max, round = Math.round, PI = Math.PI;
  var UI = SV.ui = SV.ui || {}; UI.st = UI.st || {};
  var IS_MAC = SV.IS_MAC;
  var $ = UI._p = UI._p || {};
  function bind() { return $.bind.apply(this, arguments); }
  function btn() { return $.btn.apply(this, arguments); }
  function chip() { return $.chip.apply(this, arguments); }
  function curFont() { return $.curFont.apply(this, arguments); }
  function curStyle() { return $.curStyle.apply(this, arguments); }
  function field() { return $.field.apply(this, arguments); }
  function firstOfType() { return $.firstOfType.apply(this, arguments); }
  function h() { return $.h.apply(this, arguments); }
  function ibtn() { return $.ibtn.apply(this, arguments); }
  function keyLabel() { return $.keyLabel.apply(this, arguments); }
  function numIn() { return $.numIn.apply(this, arguments); }
  function seg() { return $.seg.apply(this, arguments); }
  function selIn() { return $.selIn.apply(this, arguments); }
  function selLabel() { return $.selLabel.apply(this, arguments); }
  var I = $.I;
  var binds = $.binds;

  /* ================= control bar ================= */
  UI.st.cbSig = '';
  function controlContext() {
    var objs = SV.selObjs(), types = {};
    objs.forEach(function (o) { SV.leaves(o).forEach(function (l) { types[l.type] = 1; }); });
    return { n: objs.length, types: types, tool: S.tool, editing: !!S.editing };
  }
  var HINTS = {
    pen: 'Click for corner points · drag for curves · click the first point to close · Enter/Esc to finish',
    pencil: 'Drag to draw freehand — ends near the start close the path',
    brush: 'Drag to paint a smooth stroke',
    addAnchor: 'Click a path segment to add an anchor', deleteAnchor: 'Click an anchor to remove it',
    convertAnchor: 'Click an anchor to make it a corner · drag to pull out smooth handles',
    type: 'Click to place text · click existing text to edit · Esc to finish',
    eyedropper: 'Click an object to sample its appearance onto the selection',
    hand: 'Drag to pan (or hold Space with any tool)', zoom: 'Click to zoom in · Alt-click to zoom out · drag to zoom to an area',
    scissors: 'Click on a path to cut it', gradient: 'Drag across the selected object to set the gradient direction',
    rotate: 'Drag to rotate around the origin · click to move the origin · Alt-click for exact angle',
    scale: 'Drag to scale around the origin · Shift for uniform · Alt-click for exact values',
    direct: 'Drag anchors, handles and segments · marquee-select points', line: 'Drag to draw · Shift constrains to 45° · Alt draws from centre',
    rect: 'Drag to draw · Shift for a square · Alt from centre · click for exact size', ellipse: 'Drag to draw · Shift for a circle · Alt from centre · click for exact size',
    rrect: 'Drag to draw · Shift for a square · click for exact size', polygon: 'Drag from the centre · ↑/↓ while dragging changes sides', star: 'Drag from the centre · ↑/↓ while dragging changes points',
    select: 'Click to select · drag to move · Alt-drag duplicates · drag handles to scale · drag outside corners to rotate'
  };
  function buildControlBar(ctx) {
    var cb = document.getElementById('controlbar'); cb.innerHTML = ''; binds.cb = [];
    var g = 'cb';
    var label = h('span', { class: 'cb-label' }); bind(g, function () { label.textContent = S.editing ? 'Type' : selLabel(); });
    cb.appendChild(label);
    var showStyle = ctx.n > 0 || ['pen', 'pencil', 'brush', 'rect', 'rrect', 'ellipse', 'polygon', 'star', 'line', 'type'].indexOf(ctx.tool) >= 0;
    if (showStyle && !(ctx.n && Object.keys(ctx.types).length === 1 && ctx.types.image)) {
      cb.appendChild(h('span', { class: 'cb-sep' }));
      cb.appendChild(field('Fill', chip(g, 'fill', true)));
      cb.appendChild(field('Stroke', chip(g, 'stroke', true)));
      cb.appendChild(numIn(g, { label: 'Stroke weight', min: 0, max: 1000, step: 0.5, get: function () { return curStyle().sw; }, set: function (v) { SV.applyStyle('sw', v); if (v > 0 && !SV.currentPaint('stroke')) SV.applyStyle('stroke', '#0a0a0a'); }, cls: 'w52' }));
      cb.appendChild(h('span', { class: 'fu', text: 'px' }));
    }
    var hasType = ctx.types.text || ctx.tool === 'type';
    var shapeOpt = function (key) {
      return ctx.types[{ radius: 'rect', sides: 'polygon', points: 'star', inner: 'star' }[key]] || (!ctx.n && ({ radius: 'rrect', sides: 'polygon', points: 'star', inner: 'star' }[key] === ctx.tool));
    };
    if (shapeOpt('radius')) {
      cb.appendChild(h('span', { class: 'cb-sep' }));
      cb.appendChild(field('Corners', numIn(g, { label: 'Corner radius', min: 0, max: 5000, get: function () { var r = firstOfType('rect'); return r ? r.rx : S.shape.radius; }, set: function (v) { SV.applyShapeOpt('radius', v); }, cls: 'w52' }), 'px'));
    }
    if (shapeOpt('sides')) {
      cb.appendChild(h('span', { class: 'cb-sep' }));
      cb.appendChild(field('Sides', numIn(g, { label: 'Polygon sides', min: 3, max: 64, get: function () { var r = firstOfType('polygon'); return r ? r.sides : S.shape.sides; }, set: function (v) { SV.applyShapeOpt('sides', round(v)); }, cls: 'w44' })));
    }
    if (shapeOpt('points')) {
      cb.appendChild(h('span', { class: 'cb-sep' }));
      cb.appendChild(field('Points', numIn(g, { label: 'Star points', min: 2, max: 64, get: function () { var r = firstOfType('star'); return r ? r.points : S.shape.points; }, set: function (v) { SV.applyShapeOpt('points', round(v)); }, cls: 'w44' })));
      cb.appendChild(field('Inner', numIn(g, { label: 'Inner radius %', min: 5, max: 100, get: function () { var r = firstOfType('star'); return round((r ? r.r2 / (r.r1 || 1) : S.shape.inner) * 100); }, set: function (v) { SV.applyShapeOpt('inner', v / 100); }, cls: 'w44' }), '%'));
    }
    if (ctx.tool === 'brush' && !ctx.n) {
      cb.appendChild(h('span', { class: 'cb-sep' }));
      cb.appendChild(field('Brush', numIn(g, { label: 'Brush size', min: 0.5, max: 200, get: function () { return S.brush.size; }, set: function (v) { S.brush.size = v; } , cls: 'w52'}), 'px'));
    }
    if (hasType) {
      cb.appendChild(h('span', { class: 'cb-sep' }));
      cb.appendChild(selIn(g, Object.keys(SV.FONTS).map(function (f) { return [f, f]; }), function () { return curFont().family; }, function (v) { SV.applyFont('family', v); }, 'Font family'));
      cb.appendChild(selIn(g, [[300, 'Light'], [400, 'Regular'], [500, 'Medium'], [600, 'Semibold'], [700, 'Bold'], [800, 'ExtraBold'], [900, 'Black']], function () { return curFont().weight; }, function (v) { SV.applyFont('weight', +v); }, 'Font weight'));
      cb.appendChild(numIn(g, { label: 'Font size', min: 1, max: 2000, get: function () { return curFont().size; }, set: function (v) { SV.applyFont('size', v); }, cls: 'w52' }));
      cb.appendChild(h('span', { class: 'fu', text: 'px' }));
      cb.appendChild(seg(g, [['left', I.txtL, 'Align left'], ['center', I.txtC, 'Align center'], ['right', I.txtR, 'Align right']], function () { return curFont().align; }, function (v) { SV.applyFont('align', v); }, 'Paragraph alignment'));
    }
    if (ctx.n) {
      cb.appendChild(h('span', { class: 'cb-sep' }));
      cb.appendChild(field('Opacity', numIn(g, { label: 'Opacity', min: 0, max: 100, get: function () { return round((curStyle().opacity == null ? 1 : curStyle().opacity) * 100); }, set: function (v) { SV.applyStyle('opacity', v / 100); }, cls: 'w44' }), '%'));
    }
    cb.appendChild(h('span', { class: 'grow' }));
    if (ctx.n) {
      var al = h('div', { class: 'cb-align' }, [
        ibtn(I.alignL, 'Horizontal Align Left', function () { C.align('left'); }), ibtn(I.alignHC, 'Horizontal Align Center', function () { C.align('hcenter'); }), ibtn(I.alignR, 'Horizontal Align Right', function () { C.align('right'); }),
        ibtn(I.alignT, 'Vertical Align Top', function () { C.align('top'); }), ibtn(I.alignVC, 'Vertical Align Center', function () { C.align('vcenter'); }), ibtn(I.alignB, 'Vertical Align Bottom', function () { C.align('bottom'); })
      ]);
      cb.appendChild(al);
      cb.appendChild(h('span', { class: 'cb-sep' }));
      cb.appendChild(h('button', { type: 'button', class: 'btn slop', title: 'Slopify the selection (' + keyLabel('mod+alt+s') + ')', html: I.slop + '<span>Slopify</span>', onclick: function () { SV.runAction('object.slopify'); } }));
    } else {
      var hint = h('span', { class: 'cb-hint' }); bind(g, function () { hint.textContent = HINTS[S.tool] || ''; });
      cb.appendChild(hint);
    }
  }

  $.buildControlBar = buildControlBar; $.controlContext = controlContext;
})();
