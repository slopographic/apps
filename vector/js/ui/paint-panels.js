/* Slop Vector — ui: Swatches, Gradient, Align and Pathfinder panels */
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
  function field() { return $.field.apply(this, arguments); }
  function gradCSS() { return $.gradCSS.apply(this, arguments); }
  function h() { return $.h.apply(this, arguments); }
  function hexToRgb() { return $.hexToRgb.apply(this, arguments); }
  function ibtn() { return $.ibtn.apply(this, arguments); }
  function numIn() { return $.numIn.apply(this, arguments); }
  function paintBG() { return $.paintBG.apply(this, arguments); }
  function rgbToHex() { return $.rgbToHex.apply(this, arguments); }
  function savePrefs() { return $.savePrefs.apply(this, arguments); }
  function seg() { return $.seg.apply(this, arguments); }
  function selIn() { return $.selIn.apply(this, arguments); }
  var I = $.I;
  var panelEls = $.panelEls;

  /* ---------- Swatches ---------- */
  var DEFAULT_SWATCHES = [null, '#ffffff', '#0a0a0a', '#f1ede4', '#d4ff3a', '#b8e600', '#7fae00', '#ff3d8b', '#ff7eb6', '#7a5cff', '#3a7bff', '#00c2b8', '#2ecc71', '#ffe14d', '#ff8a00', '#ff4d4d', '#8b5a2b', '#e6e6e6', '#bdbdbd', '#8a8a8a', '#4a4a4a', '#262626',
    { type: 'radial', cx: 0.4, cy: 0.35, r: 0.7, fx: 0.35, fy: 0.3, stops: [{ o: 0, c: '#f6ffc4', a: 1 }, { o: 0.45, c: '#d4ff3a', a: 1 }, { o: 1, c: '#6e9a00', a: 1 }], name: 'Slime' },
    { type: 'linear', x1: 0, y1: 0, x2: 1, y2: 1, stops: [{ o: 0, c: '#ff3d8b', a: 1 }, { o: 1, c: '#ff8a00', a: 1 }], name: 'Toxic Sunset' },
    { type: 'linear', x1: 0, y1: 0, x2: 1, y2: 0, stops: [{ o: 0, c: '#7a5cff', a: 1 }, { o: 1, c: '#00c2b8', a: 1 }], name: 'Synth' },
    { type: 'linear', x1: 0.5, y1: 0, x2: 0.5, y2: 1, stops: [{ o: 0, c: '#f1ede4', a: 1 }, { o: 1, c: '#0a0a0a', a: 1 }], name: 'Bone to Ink' }];
  var selSwatch = -1;
  function swatches() { return S.doc.swatches || DEFAULT_SWATCHES; }
  /** Apply swatch i to 'fill' or 'stroke' (the swatch click and its context menu). */
  function applySwatch(i, which) { selSwatch = i; var v = clone(swatches()[i]); if (v && typeof v === 'object') delete v.name; SV.applyStyle(which, v); }
  /** Delete swatch i from the document's swatches. */
  function deleteSwatch(i) { var list = swatches().slice(); list.splice(i, 1); S.doc.swatches = list; selSwatch = -1; SV.commit('delete swatch'); }
  function buildSwatches() {
    var body = panelEls.swatches.body;
    var grid = h('div', { class: 'swgrid', id: 'swgrid', role: 'listbox', 'aria-label': 'Swatches' });
    body.appendChild(grid);
    body.appendChild(h('div', { class: 'layers-foot' }, [
      h('span', { class: 'lcount', text: 'Click to apply to ' }), h('span', { class: 'lcount strong', id: 'swFocus' }), h('span', { class: 'grow' }),
      ibtn(I.plus, 'New Swatch from current ' + 'color', function () {
        var p = SV.currentPaint(S.focus); if (p === undefined) return;
        var list = swatches().slice(); list.push(clone(p)); S.doc.swatches = list; SV.commit('add swatch'); UI.toast('Swatch added');
      }),
      ibtn(I.trash, 'Delete Swatch', function () {
        if (selSwatch < 0) return UI.toast('Alt-click or select a swatch first');
        deleteSwatch(selSwatch);
      })
    ]));
    var sig = '';
    bind('swatches', function () {
      document.getElementById('swFocus').textContent = S.focus === 'fill' ? 'Fill' : 'Stroke';
      var s = JSON.stringify([swatches(), selSwatch]); if (s === sig) return; sig = s;
      grid.innerHTML = '';
      swatches().forEach(function (p, i) {
        var b = h('button', { type: 'button', class: 'sw' + (p && typeof p === 'object' ? ' grad' : '') + (i === selSwatch ? ' on' : ''), role: 'option', title: !p ? 'None' : typeof p === 'string' ? p.toUpperCase() : (p.name || 'Gradient'), 'aria-label': !p ? 'None' : typeof p === 'string' ? p : (p.name || 'Gradient') }, [h('span', { class: 'chip-in' })]);
        paintBG(b.firstChild, p);
        b.addEventListener('click', function (e) {
          if (e.altKey) { deleteSwatch(i); return; }
          applySwatch(i, S.focus);
        });
        grid.appendChild(b);
      });
    });
  }

  /* ---------- Gradient ---------- */
  var gStop = 0;
  function gradTargetPaint() { var p = SV.currentPaint(S.focus); return p && typeof p === 'object' ? p : null; }
  function setGrad(fn, commit) {
    var p = clone(gradTargetPaint()); if (!p) return;
    fn(p); SV.applyStyle(S.focus, p, { commit: commit !== false });
  }
  function buildGradient() {
    var body = panelEls.gradient.body, g = 'grad';
    var empty = h('div', { class: 'gempty' }, [h('div', { class: 'gpreview big', style: { background: 'linear-gradient(90deg,#fff,#d4ff3a)' } }), h('p', { class: 'tip', text: 'The current ' }), btn('Apply Gradient', function () { SV.applyStyle(S.focus, SV.defaultGradient(SV.currentPaint(S.focus))); }, 'primary')]);
    var tipP = empty.querySelector('.tip');
    var ed = h('div', { class: 'geditor' });
    var target = seg(g, [['fill', 'Fill', 'Edit fill'], ['stroke', 'Stroke', 'Edit stroke']], function () { return S.focus; }, function (v) { S.focus = v; SV.requestRender(true); }, 'Gradient target');
    var typeSeg = seg(g, [['linear', 'Linear', 'Linear gradient'], ['radial', 'Radial', 'Radial gradient']], function () { var p = gradTargetPaint(); return p && p.type; }, function (v) {
      setGrad(function (p) { if (p.type === v) return; p.type = v; if (v === 'radial') { p.cx = p.cy = p.fx = p.fy = 0.5; p.r = 0.5; delete p.x1; delete p.y1; delete p.x2; delete p.y2; } else { p.x1 = 0; p.y1 = 0.5; p.x2 = 1; p.y2 = 0.5; delete p.cx; delete p.cy; delete p.r; delete p.fx; delete p.fy; } });
    }, 'Gradient type');
    var bar = h('div', { class: 'gbar', title: 'Click to add a stop · drag stops · drag a stop down to remove' });
    var barFill = h('div', { class: 'gbar-fill' }); bar.appendChild(barFill);
    var stopsBox = h('div', { class: 'gstops' }); bar.appendChild(stopsBox);
    var angle = numIn(g, { label: 'Angle', step: 1, get: function () { var p = gradTargetPaint(); if (!p || p.type !== 'linear') return null; return round(-Math.atan2(p.y2 - p.y1, p.x2 - p.x1) * 180 / PI); }, set: function (v) { setGrad(function (p) { var a = -v * PI / 180, c = Math.cos(a) / 2, s = Math.sin(a) / 2; p.x1 = 0.5 - c; p.y1 = 0.5 - s; p.x2 = 0.5 + c; p.y2 = 0.5 + s; }); }, enabled: function () { var p = gradTargetPaint(); return p && p.type === 'linear'; } });
    var stopChip = h('button', { type: 'button', class: 'chip small', title: 'Stop color', 'aria-label': 'Stop color' }, [h('span', { class: 'chip-in' })]);
    stopChip.addEventListener('click', function () {
      var p = gradTargetPaint(); if (!p) return; var sIdx = min(gStop, p.stops.length - 1);
      UI.pickColor(stopChip, p.stops[sIdx].c, function (hex) { setGrad(function (q) { q.stops[sIdx].c = hex; }, false); }, function (v, changed) { if (changed) SV.commit('gradient stop'); }, { title: 'Gradient stop' });
    });
    var stopOp = numIn(g, { label: 'Stop opacity', min: 0, max: 100, get: function () { var p = gradTargetPaint(); if (!p) return null; var s = p.stops[min(gStop, p.stops.length - 1)]; return round((s.a == null ? 1 : s.a) * 100); }, set: function (v) { setGrad(function (p) { p.stops[min(gStop, p.stops.length - 1)].a = v / 100; }); }, cls: 'w44' });
    var stopLoc = numIn(g, { label: 'Stop location', min: 0, max: 100, get: function () { var p = gradTargetPaint(); if (!p) return null; return round(p.stops[min(gStop, p.stops.length - 1)].o * 100); }, set: function (v) { setGrad(function (p) { p.stops[min(gStop, p.stops.length - 1)].o = v / 100; }); }, cls: 'w44' });
    ed.appendChild(h('div', { class: 'arow' }, [target, typeSeg]));
    ed.appendChild(bar);
    ed.appendChild(h('div', { class: 'arow' }, [field('Angle', angle, '°'), h('span', { class: 'grow' }), btn('Reverse', function () { setGrad(function (p) { p.stops = p.stops.map(function (s) { return { o: 1 - s.o, c: s.c, a: s.a }; }).reverse(); }); }, 'small')]));
    ed.appendChild(h('div', { class: 'arow' }, [h('span', { class: 'alabel', text: 'Stop' }), stopChip, field('Opacity', stopOp, '%'), field('Location', stopLoc, '%'), ibtn(I.trash, 'Delete stop', function () { setGrad(function (p) { if (p.stops.length > 2) { p.stops.splice(min(gStop, p.stops.length - 1), 1); gStop = 0; } }); })]));
    body.appendChild(empty); body.appendChild(ed);
    bar.addEventListener('pointerdown', function (e) {
      if (e.target.closest('.gstop')) return;
      var p = gradTargetPaint(); if (!p) return;
      var r = bar.getBoundingClientRect(), o = SV.clamp((e.clientX - r.left) / r.width, 0, 1);
      var sorted = p.stops.slice().sort(function (a, b) { return a.o - b.o; }), c = sorted[0].c;
      for (var i = 0; i < sorted.length - 1; i++) if (o >= sorted[i].o && o <= sorted[i + 1].o) { var t = (o - sorted[i].o) / ((sorted[i + 1].o - sorted[i].o) || 1), A1 = hexToRgb(sorted[i].c), B1 = hexToRgb(sorted[i + 1].c); c = rgbToHex(A1[0] + (B1[0] - A1[0]) * t, A1[1] + (B1[1] - A1[1]) * t, A1[2] + (B1[2] - A1[2]) * t); }
      if (o > sorted[sorted.length - 1].o) c = sorted[sorted.length - 1].c;
      setGrad(function (q) { q.stops.push({ o: o, c: c, a: 1 }); gStop = q.stops.length - 1; });
    });
    var sig = '';
    bind(g, function () {
      var p = gradTargetPaint();
      empty.hidden = !!p; ed.hidden = !p;
      tipP.textContent = 'The current ' + (S.focus === 'fill' ? 'fill' : 'stroke') + ' is ' + (SV.currentPaint(S.focus) ? 'a solid color' : 'none') + '. Turn it into a gradient:';
      if (!p) return;
      barFill.style.background = gradCSS(Object.assign({}, p, { type: 'linear', x1: 0, y1: 0, x2: 1, y2: 0 }));
      paintBG(stopChip.firstChild, p.stops[min(gStop, p.stops.length - 1)].c);
      var s = JSON.stringify([p.stops, gStop]); if (s === sig) return; sig = s;
      stopsBox.innerHTML = '';
      p.stops.forEach(function (st, i) {
        var m = h('div', { class: 'gstop' + (i === gStop ? ' on' : ''), style: { left: (st.o * 100) + '%' }, title: 'Stop ' + round(st.o * 100) + '%' }, [h('span', { style: { background: st.c } })]);
        m.addEventListener('pointerdown', function (e) {
          e.preventDefault(); e.stopPropagation(); gStop = i; sig = '';
          var r = bar.getBoundingClientRect(), moved = false, removed = false;
          var mv = function (ev) {
            moved = true;
            removed = ev.clientY - r.bottom > 30 && p.stops.length > 2;
            m.style.opacity = removed ? 0.3 : 1;
            var o = SV.clamp((ev.clientX - r.left) / r.width, 0, 1);
            setGrad(function (q) { q.stops[i].o = o; }, false);
          };
          var up = function () {
            window.removeEventListener('pointermove', mv); window.removeEventListener('pointerup', up);
            if (removed) setGrad(function (q) { q.stops.splice(i, 1); gStop = 0; });
            else if (moved) SV.commit('gradient stop');
            else SV.requestRender(true);
          };
          window.addEventListener('pointermove', mv); window.addEventListener('pointerup', up);
        });
        stopsBox.appendChild(m);
      });
    });
  }

  /* ---------- Align ---------- */
  function buildAlign() {
    var body = panelEls.align.body, g = 'align';
    body.appendChild(h('div', { class: 'psec-title', text: 'Align Objects' }));
    body.appendChild(h('div', { class: 'ibtnrow' }, [ibtn(I.alignL, 'Horizontal Align Left', function () { C.align('left'); }), ibtn(I.alignHC, 'Horizontal Align Center', function () { C.align('hcenter'); }), ibtn(I.alignR, 'Horizontal Align Right', function () { C.align('right'); }), ibtn(I.alignT, 'Vertical Align Top', function () { C.align('top'); }), ibtn(I.alignVC, 'Vertical Align Center', function () { C.align('vcenter'); }), ibtn(I.alignB, 'Vertical Align Bottom', function () { C.align('bottom'); })]));
    body.appendChild(h('div', { class: 'psec-title', text: 'Distribute Objects' }));
    body.appendChild(h('div', { class: 'ibtnrow' }, [ibtn(I.distH, 'Horizontal Distribute Center', function () { C.distribute('hcenter'); }), ibtn(I.distV, 'Vertical Distribute Center', function () { C.distribute('vcenter'); }), ibtn(I.spaceH, 'Horizontal Distribute Space', function () { C.distribute('hspace'); }), ibtn(I.spaceV, 'Vertical Distribute Space', function () { C.distribute('vspace'); })]));
    body.appendChild(h('label', { class: 'fld col' }, [h('span', { class: 'fl', text: 'Align To' }), selIn(g, [['selection', 'Selection'], ['artboard', 'Artboard']], function () { return S.prefs.alignTo; }, function (v) { S.prefs.alignTo = v; savePrefs(); }, 'Align to')]));
  }
  /* ---------- Pathfinder ---------- */
  function buildPathfinder() {
    var body = panelEls.pathfinder.body;
    body.appendChild(h('div', { class: 'psec-title', text: 'Shape Modes' }));
    var pf = function (icon, label, id) { return h('button', { type: 'button', class: 'pfbtn', title: label, 'aria-label': label, html: icon + '<span>' + label + '</span>', onclick: function () { SV.runAction(id); } }); };
    body.appendChild(h('div', { class: 'pfrow' }, [pf(I.unite, 'Unite', 'pf.unite'), pf(I.minus, 'Minus Front', 'pf.minus'), pf(I.intersect, 'Intersect', 'pf.intersect'), pf(I.exclude, 'Exclude', 'pf.exclude')]));
    body.appendChild(h('div', { class: 'psec-title', text: 'Paths' }));
    body.appendChild(h('div', { class: 'btnrow' }, [btn('Make Compound', function () { SV.runAction('compound.make'); }, 'small'), btn('Release', function () { SV.runAction('compound.release'); }, 'small'), btn('Expand', function () { SV.runAction('object.expand'); }, 'small')]));
    body.appendChild(h('button', { type: 'button', class: 'btn slop wide', html: I.slop + '<span>Slopify</span>', title: 'Turn the selection into dripping slime', onclick: function () { SV.runAction('object.slopify'); } }));
  }

  $.buildAlign = buildAlign; $.buildGradient = buildGradient; $.buildPathfinder = buildPathfinder; $.buildSwatches = buildSwatches; $.swatches = swatches; $.applySwatch = applySwatch; $.deleteSwatch = deleteSwatch;
})();
