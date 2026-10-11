/* Slop Vector — ui: Properties and Appearance panels */
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
  function docSetupDialog() { return $.docSetupDialog.apply(this, arguments); }
  function field() { return $.field.apply(this, arguments); }
  function firstOfType() { return $.firstOfType.apply(this, arguments); }
  function h() { return $.h.apply(this, arguments); }
  function ibtn() { return $.ibtn.apply(this, arguments); }
  function numIn() { return $.numIn.apply(this, arguments); }
  function paintLabel() { return $.paintLabel.apply(this, arguments); }
  function runBinds() { return $.runBinds.apply(this, arguments); }
  function seg() { return $.seg.apply(this, arguments); }
  function selIn() { return $.selIn.apply(this, arguments); }
  var A = $.A;
  var I = $.I;
  var panelEls = $.panelEls;

  /* ---------- Properties ---------- */
  var refPt = 'nw', linkWH = true, propsSig = '';
  function refOf(b) { var fx = refPt.indexOf('w') >= 0 ? 0 : refPt.indexOf('e') >= 0 ? 1 : 0.5, fy = refPt.indexOf('n') >= 0 ? 0 : refPt.indexOf('s') >= 0 ? 1 : 0.5; if (refPt === 'c') { fx = fy = 0.5; } return { x: b.x + fx * b.w, y: b.y + fy * b.h, fx: fx, fy: fy }; }
  function setTransformField(k, v) {
    var ids = SV.zSorted(S.sel), b = SV.selBBox(ids); if (!b) return;
    var r = refOf(b), M;
    if (k === 'x') M = G.translate(v - r.x, 0);
    else if (k === 'y') M = G.translate(0, v - r.y);
    else if (k === 'w' || k === 'h') {
      var cur = k === 'w' ? b.w : b.h; if (cur < 1e-6 || v <= 0) return;
      var s = v / cur, sx = k === 'w' ? s : (linkWH ? s : 1), sy = k === 'h' ? s : (linkWH ? s : 1);
      M = G.scale(sx, sy, r.x, r.y);
    } else if (k === 'rot') {
      var o = getObj(ids[0]), curD = -SV.objRot(o), delta = v - curD, a = -delta * PI / 180;
      var c = { x: b.x + b.w / 2, y: b.y + b.h / 2 };
      M = G.rotate(a, c.x, c.y);
      ids.forEach(function (id) { var oo = getObj(id); SV.transformObj(oo, M); if (oo.type === 'path' || oo.type === 'group') oo.rot = SV.normAng((oo.rot || 0) + a * 180 / PI); });
      SV.commit('rotate'); return;
    }
    if (M) { ids.forEach(function (id) { SV.transformObj(getObj(id), M); }); SV.commit('transform'); }
  }
  function buildProperties() {
    var body = panelEls.properties.body, g = 'props';
    var none = h('div', { class: 'psec doc-sec' });
    none.appendChild(h('div', { class: 'psec-title', text: 'Document' }));
    none.appendChild(h('div', { class: 'grid2' }, [
      field('W', numIn(g, { label: 'Artboard width', min: 1, max: 20000, get: function () { return S.doc.width; }, set: function (v) { S.doc.width = v; SV.commit('artboard'); } }), 'px'),
      field('H', numIn(g, { label: 'Artboard height', min: 1, max: 20000, get: function () { return S.doc.height; }, set: function (v) { S.doc.height = v; SV.commit('artboard'); } }), 'px')
    ]));
    none.appendChild(h('div', { class: 'btnrow' }, [btn('Document Setup…', function () { docSetupDialog(); }), btn('Fit Artboard', function () { SV.fitArtboard(); })]));
    var toggles = h('div', { class: 'checks' });
    [['rulers', 'Rulers', 'view.rulers'], ['grid', 'Grid', 'view.grid'], ['snapGrid', 'Snap to grid', 'view.snapGrid'], ['smart', 'Smart guides', 'view.smart'], ['outline', 'Outline mode', 'view.outline']].forEach(function (t) {
      var cbx = h('input', { type: 'checkbox' });
      cbx.addEventListener('change', function () { if (!!S.prefs[t[0]] !== cbx.checked) SV.runAction(t[2]); });
      bind(g, function () { cbx.checked = !!S.prefs[t[0]]; });
      toggles.appendChild(h('label', { class: 'chk' }, [cbx, h('span', { text: t[1] })]));
    });
    none.appendChild(toggles);
    none.appendChild(h('div', { class: 'psec-title', text: 'Tip' }));
    none.appendChild(h('p', { class: 'tip', text: 'Select something to edit it. Double-click text to retype it. Press F1 for every shortcut.' }));
    // transform section
    var tr = h('div', { class: 'psec tr-sec' });
    tr.appendChild(h('div', { class: 'psec-title', text: 'Transform' }));
    var grid9 = h('div', { class: 'ref9', role: 'radiogroup', 'aria-label': 'Reference point' });
    ['nw', 'n', 'ne', 'w', 'c', 'e', 'sw', 's', 'se'].forEach(function (p) {
      var b = h('button', { type: 'button', class: 'refpt', title: 'Reference point', 'aria-label': 'Reference point ' + p });
      b.addEventListener('click', function () { refPt = p; runBinds(g); });
      bind(g, function () { b.classList.toggle('on', refPt === p); });
      grid9.appendChild(b);
    });
    var gv = function (k) { return function () { var b = SV.selBBox(); if (!b) return null; var r = refOf(b); return k === 'x' ? r.x : k === 'y' ? r.y : k === 'w' ? b.w : b.h; }; };
    var link = h('button', { type: 'button', class: 'ibtn link', title: 'Constrain width and height proportions', 'aria-label': 'Constrain proportions', html: I.link, onclick: function () { linkWH = !linkWH; runBinds(g); } });
    bind(g, function () { link.classList.toggle('on', linkWH); });
    tr.appendChild(h('div', { class: 'tr-grid' }, [grid9, h('div', { class: 'grid2 tight' }, [
      field('X', numIn(g, { label: 'X', step: 1, get: gv('x'), set: function (v) { setTransformField('x', v); } }), 'px'),
      field('W', numIn(g, { label: 'Width', step: 1, min: 0, get: gv('w'), set: function (v) { setTransformField('w', v); } }), 'px'),
      field('Y', numIn(g, { label: 'Y', step: 1, get: gv('y'), set: function (v) { setTransformField('y', v); } }), 'px'),
      field('H', numIn(g, { label: 'Height', step: 1, min: 0, get: gv('h'), set: function (v) { setTransformField('h', v); } }), 'px')
    ]), link]));
    tr.appendChild(h('div', { class: 'grid2 rotrow' }, [
      field('∠', numIn(g, { label: 'Rotation angle', step: 1, get: function () { var o = SV.selObjs()[0]; return o && S.sel.length === 1 ? SV.normAng(-SV.objRot(o)) : 0; }, set: function (v) { setTransformField('rot', v); } }), '°', 'Rotate'),
      h('div', { class: 'btnrow right' }, [ibtn(I.flipH, 'Flip Horizontal', function () { C.flip('h'); }), ibtn(I.flipV, 'Flip Vertical', function () { C.flip('v'); })])
    ]));
    // shape section
    var shp = h('div', { class: 'psec shape-sec' });
    shp.appendChild(h('div', { class: 'psec-title', text: 'Shape' }));
    var corners = $.cornerControls(g, '', function () { return !!firstOfType('rect'); });
    var shPoly = field('Sides', numIn(g, { label: 'Sides', min: 3, max: 64, get: function () { var r = firstOfType('polygon'); return r ? r.sides : 6; }, set: function (v) { SV.applyShapeOpt('sides', round(v)); } }));
    var shStar = field('Points', numIn(g, { label: 'Points', min: 2, max: 64, get: function () { var r = firstOfType('star'); return r ? r.points : 5; }, set: function (v) { SV.applyShapeOpt('points', round(v)); } }));
    var shStar2 = field('Inner radius', numIn(g, { label: 'Inner radius', min: 5, max: 100, get: function () { var r = firstOfType('star'); return r ? round(r.r2 / (r.r1 || 1) * 100) : 45; }, set: function (v) { SV.applyShapeOpt('inner', v / 100); } }), '%');
    shp.appendChild(h('div', { class: 'grid2' }, [corners.one, shPoly, shStar, shStar2]));
    shp.appendChild(corners.four); shp.appendChild(h('div', { class: 'btnrow' }, [corners.link]));
    bind(g, function () { shPoly.hidden = !firstOfType('polygon'); shStar.hidden = shStar2.hidden = !firstOfType('star'); });
    // character section
    var ch = h('div', { class: 'psec char-sec' });
    ch.appendChild(h('div', { class: 'psec-title', text: 'Character' }));
    ch.appendChild(selIn(g, Object.keys(SV.FONTS).map(function (f) { return [f, f]; }), function () { return curFont().family; }, function (v) { SV.applyFont('family', v); }, 'Font family'));
    ch.appendChild(h('div', { class: 'grid2' }, [
      selIn(g, [[300, 'Light'], [400, 'Regular'], [500, 'Medium'], [600, 'Semibold'], [700, 'Bold'], [800, 'ExtraBold'], [900, 'Black']], function () { return curFont().weight; }, function (v) { SV.applyFont('weight', +v); }, 'Font weight'),
      field('Size', numIn(g, { label: 'Font size', min: 1, get: function () { return curFont().size; }, set: function (v) { SV.applyFont('size', v); } }), 'px'),
      field('Leading', numIn(g, { label: 'Line height', min: 0.5, max: 5, step: 0.05, get: function () { return curFont().lh; }, set: function (v) { SV.applyFont('lh', v); } }), '×'),
      field('Tracking', numIn(g, { label: 'Tracking (1/1000 em)', min: -500, max: 2000, step: 10, get: function () { return curFont().tracking; }, set: function (v) { SV.applyFont('tracking', v); } }))
    ]));
    ch.appendChild(h('div', { class: 'btnrow' }, [seg(g, [['left', I.txtL, 'Align left'], ['center', I.txtC, 'Align center'], ['right', I.txtR, 'Align right']], function () { return curFont().align; }, function (v) { SV.applyFont('align', v); }, 'Alignment'),
      seg(g, [['normal', '<b style="font-style:normal">I</b>', 'Roman'], ['italic', '<i>I</i>', 'Italic']], function () { return curFont().style; }, function (v) { SV.applyFont('style', v); }, 'Style')]));
    // quick actions
    var qa = h('div', { class: 'psec qa-sec' });
    qa.appendChild(h('div', { class: 'psec-title', text: 'Quick Actions' }));
    var qbtns = h('div', { class: 'qbtns' });
    [['Group', 'object.group'], ['Ungroup', 'object.ungroup'], ['Duplicate', 'edit.duplicate'], ['Bring to Front', 'arrange.front'], ['Send to Back', 'arrange.back'], ['Expand', 'object.expand'], ['Lock', 'object.lock'], ['Delete', 'edit.clear']].forEach(function (q) {
      var b = btn(q[0], function () { SV.runAction(q[1]); }, 'small');
      bind(g, function () { var a = A[q[1]]; b.disabled = a.enabled ? !a.enabled() : false; });
      qbtns.appendChild(b);
    });
    qa.appendChild(qbtns);
    qa.appendChild(h('button', { type: 'button', class: 'btn slop wide', html: I.slop + '<span>Slopify selection</span>', onclick: function () { SV.runAction('object.slopify'); } }));
    [none, tr, shp, ch, qa].forEach(function (s) { body.appendChild(s); });
    bind(g, function () {
      var n = S.sel.length;
      none.hidden = n > 0; tr.hidden = !n; qa.hidden = !n;
      shp.hidden = !(firstOfType('rect') || firstOfType('polygon') || firstOfType('star'));
      ch.hidden = !(firstOfType('text') || S.tool === 'type');
    });
  }

  /* ---------- Appearance ---------- */
  function buildAppearance() {
    var body = panelEls.appearance.body, g = 'app';
    var fillLabel = h('span', { class: 'plabel mono' }), strokeLabel = h('span', { class: 'plabel mono' });
    bind(g, function () { fillLabel.textContent = paintLabel(SV.currentPaint('fill')); strokeLabel.textContent = paintLabel(SV.currentPaint('stroke')); });
    body.appendChild(h('div', { class: 'arow' }, [h('span', { class: 'alabel', text: 'Fill' }), chip(g, 'fill'), fillLabel]));
    body.appendChild(h('div', { class: 'arow' }, [h('span', { class: 'alabel', text: 'Stroke' }), chip(g, 'stroke'), strokeLabel]));
    body.appendChild(h('div', { class: 'grid2' }, [
      field('Weight', numIn(g, { label: 'Stroke weight', min: 0, max: 1000, step: 0.5, get: function () { return curStyle().sw; }, set: function (v) { SV.applyStyle('sw', v); if (v > 0 && !SV.currentPaint('stroke')) SV.applyStyle('stroke', '#0a0a0a'); } }), 'px'),
      field('Miter', numIn(g, { label: 'Miter limit', min: 1, max: 500, get: function () { return curStyle().miter; }, set: function (v) { SV.applyStyle('miter', v); } }), '×')
    ]));
    body.appendChild(h('div', { class: 'arow' }, [h('span', { class: 'alabel', text: 'Cap' }), seg(g, [['butt', I.capButt, 'Butt cap'], ['round', I.capRound, 'Round cap'], ['square', I.capSquare, 'Projecting cap']], function () { return curStyle().cap; }, function (v) { SV.applyStyle('cap', v); }, 'Cap'),
      h('span', { class: 'alabel', text: 'Join' }), seg(g, [['miter', I.joinMiter, 'Miter join'], ['round', I.joinRound, 'Round join'], ['bevel', I.joinBevel, 'Bevel join']], function () { return curStyle().join; }, function (v) { SV.applyStyle('join', v); }, 'Join')]));
    var dashChk = h('input', { type: 'checkbox' });
    var dashA = numIn(g, { label: 'Dash length', min: 0, max: 1000, get: function () { var d = curStyle().dash; return d ? d[0] : 12; }, set: function (v) { var d = curStyle().dash || [12, 6]; SV.applyStyle('dash', [v, d[1] == null ? v : d[1]]); }, enabled: function () { return !!curStyle().dash; } });
    var dashB = numIn(g, { label: 'Gap length', min: 0, max: 1000, get: function () { var d = curStyle().dash; return d ? (d[1] == null ? d[0] : d[1]) : 6; }, set: function (v) { var d = curStyle().dash || [12, 6]; SV.applyStyle('dash', [d[0], v]); }, enabled: function () { return !!curStyle().dash; } });
    dashChk.addEventListener('change', function () { SV.applyStyle('dash', dashChk.checked ? [12, 6] : null); });
    bind(g, function () { dashChk.checked = !!curStyle().dash; });
    body.appendChild(h('div', { class: 'arow dashrow' }, [h('label', { class: 'chk' }, [dashChk, h('span', { text: 'Dashed' })]), field('dash', dashA), field('gap', dashB)]));
    var op = h('input', { type: 'range', min: 0, max: 100, class: 'range', 'aria-label': 'Opacity' });
    var opBefore = null;
    op.addEventListener('input', function () { if (opBefore === null) opBefore = 1; SV.applyStyle('opacity', +op.value / 100, { commit: false }); });
    op.addEventListener('change', function () { opBefore = null; SV.commit('opacity'); });
    bind(g, function () { if (document.activeElement !== op) op.value = round((curStyle().opacity == null ? 1 : curStyle().opacity) * 100); });
    body.appendChild(h('div', { class: 'arow' }, [h('span', { class: 'alabel', text: 'Opacity' }), op, numIn(g, { label: 'Opacity %', min: 0, max: 100, get: function () { return round((curStyle().opacity == null ? 1 : curStyle().opacity) * 100); }, set: function (v) { SV.applyStyle('opacity', v / 100); }, cls: 'w44' }), h('span', { class: 'fu', text: '%' })]));
    body.appendChild(h('div', { class: 'grid2' }, [
      h('label', { class: 'fld col' }, [h('span', { class: 'fl', text: 'Blending' }), selIn(g, SV.BLENDS.map(function (b) { return [b, b.replace(/-/g, ' ').replace(/^./, function (c) { return c.toUpperCase(); })]; }), function () { return curStyle().blend || 'normal'; }, function (v) { SV.applyStyle('blend', v); }, 'Blend mode')]),
      h('label', { class: 'fld col' }, [h('span', { class: 'fl', text: 'Fill rule' }), selIn(g, [['nonzero', 'Non-zero'], ['evenodd', 'Even-odd']], function () { return curStyle().rule || 'nonzero'; }, function (v) { SV.applyStyle('rule', v); }, 'Fill rule')])
    ]));
  }

  $.buildAppearance = buildAppearance; $.buildProperties = buildProperties;
})();
