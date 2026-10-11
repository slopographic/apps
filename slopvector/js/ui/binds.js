/* SlopVector — ui: control bindings and the tools panel */
(function () {
  'use strict';
  var G = window.SVGeom, SV = window.SV, S = SV.state, D = SV.dom, IO = SV.io, C = SV.cmd;
  var clone = SV.clone, getObj = SV.getObj, esc = SV.esc, fmt = G.fmt;
  var abs = Math.abs, min = Math.min, max = Math.max, round = Math.round, PI = Math.PI;
  var UI = SV.ui = SV.ui || {}; UI.st = UI.st || {};
  var IS_MAC = SV.IS_MAC;
  var $ = UI._p = UI._p || {};
  function editPaint() { return $.editPaint.apply(this, arguments); }
  function h() { return $.h.apply(this, arguments); }
  function paintBG() { return $.paintBG.apply(this, arguments); }

  /* ================= bindings ================= */
  var binds = {};
  function bind(group, fn) { (binds[group] = binds[group] || []).push(fn); }
  function runBinds(group) { (binds[group] || []).forEach(function (f) { try { f(); } catch (e) { if (window.console) console.warn(e); } }); }
  function setVal(inp, v) { if (document.activeElement !== inp) inp.value = v; }
  function numIn(group, opts) {
    var inp = h('input', { class: 'num mono' + (opts.cls ? ' ' + opts.cls : ''), type: 'number', step: opts.step || 1, min: opts.min, max: opts.max, 'aria-label': opts.label, title: opts.title || opts.label });
    inp.addEventListener('change', function () { var v = parseFloat(inp.value); if (isNaN(v)) return; if (opts.min != null) v = max(opts.min, v); if (opts.max != null) v = min(opts.max, v); opts.set(v); });
    inp.addEventListener('keydown', function (e) { if (e.key === 'Enter') { inp.blur(); } });
    bind(group, function () { var v = opts.get(); setVal(inp, v == null || isNaN(v) ? '' : (Math.round(v * 100) / 100)); inp.disabled = opts.enabled ? !opts.enabled() : false; });
    return inp;
  }
  function field(label, input, unit, title) { return h('label', { class: 'fld', title: title || null }, [h('span', { class: 'fl', text: label }), input, unit ? h('span', { class: 'fu', text: unit }) : null]); }
  function selIn(group, options, get, set, label) {
    var s = h('select', { class: 'sel', 'aria-label': label, title: label });
    options.forEach(function (o) { s.appendChild(h('option', { value: o[0], text: o[1] })); });
    s.addEventListener('change', function () { set(s.value); });
    bind(group, function () { var v = get(); if (document.activeElement !== s) s.value = v == null ? '' : String(v); });
    return s;
  }
  /** Font family select backed by the shared picker: standard names, bundled and downloaded families, and a
   * Get more button after it (the button is the second child of the returned span). */
  function fontSel(group, get, set, label) {
    var s = h('select', { class: 'sel', 'aria-label': label, title: label });
    var pick = window.SlopFonts.attach(s, { legacy: Object.keys(SV.FONTS), onPick: function (f) { set(f); } });
    bind(group, function () {
      var v = get();
      if (document.activeElement === s) return;
      if (v && !Array.prototype.some.call(s.options, function (o) { return o.value === v; })) s.add(new Option(v, v));
      s.value = v == null ? '' : String(v);
    });
    return h('span', { class: 'font-pick' }, [s, pick.button]);
  }
  function seg(group, items, get, set, label) {
    var wrap = h('div', { class: 'seg', role: 'group', 'aria-label': label });
    items.forEach(function (it) {
      var b = h('button', { type: 'button', class: 'segb', title: it[2] || it[0], 'aria-label': it[2] || it[0], html: it[1] });
      b.addEventListener('click', function () { set(it[0]); });
      wrap.appendChild(b);
      bind(group, function () { b.classList.toggle('on', get() === it[0]); b.setAttribute('aria-pressed', get() === it[0] ? 'true' : 'false'); });
    });
    return wrap;
  }
  function ibtn(icon, title, onclick, cls) { var b = h('button', { type: 'button', class: 'ibtn' + (cls ? ' ' + cls : ''), title: title, 'aria-label': title, html: icon }); b.addEventListener('click', onclick); return b; }
  function btn(text, onclick, cls, title) { return h('button', { type: 'button', class: 'btn' + (cls ? ' ' + cls : ''), text: text, title: title || null, onclick: onclick }); }
  function chip(group, which, small) {
    var b = h('button', { type: 'button', class: 'chip ' + which + (small ? ' small' : ''), title: which === 'fill' ? 'Fill — click to edit' : 'Stroke — click to edit', 'aria-label': which === 'fill' ? 'Fill color' : 'Stroke color' }, [h('span', { class: 'chip-in' })]);
    b.addEventListener('click', function () { editPaint(which, b); });
    bind(group, function () { paintBG(b.firstChild, SV.currentPaint(which)); });
    return b;
  }

  /* selection info */
  function firstLeaf() { var o = SV.selObjs()[0]; if (!o) return null; return SV.leaves(o).filter(function (l) { return l.style && l.type !== 'image'; })[0] || SV.leaves(o)[0] || o; }
  function firstOfType(t) { var r = null; SV.selObjs().forEach(function (o) { SV.leaves(o).forEach(function (l) { if (!r && l.type === t) r = l; }); }); return r; }
  function curStyle() { var l = firstLeaf(); return l && l.style ? l.style : S.style; }
  UI.curStyle = curStyle;
  var TYPE_NAMES = { path: 'Path', rect: 'Rectangle', ellipse: 'Ellipse', polygon: 'Polygon', star: 'Star', text: 'Text', image: 'Image', group: 'Group' };
  function selLabel() {
    var objs = SV.selObjs();
    if (!objs.length) return 'No Selection';
    if (objs.length > 1) return objs.length + ' Objects';
    var o = objs[0];
    if (o.type === 'path' && o.subpaths.length > 1) return 'Compound Path';
    if (o.type === 'path' && o.subpaths.length === 1 && o.subpaths[0].pts.length === 2 && !o.subpaths[0].closed) return 'Line';
    if (o.type === 'rect' && o.rx > 0) return 'Rounded Rectangle';
    return TYPE_NAMES[o.type] || 'Object';
  }
  SV.objDisplayName = function (o) {
    if (o.name) return o.name;
    if (o.type === 'text') return o.text.split('\n')[0].slice(0, 24) || '<Text>';
    return '<' + (TYPE_NAMES[o.type] || 'Object') + '>';
  };

  /* ================= toolbar ================= */
  function buildToolbar() {
    var tb = document.getElementById('toolbar');
    var grid = h('div', { class: 'tools', role: 'toolbar', 'aria-label': 'Tools' });
    SV.TOOL_LIST.forEach(function (t) {
      var b = h('button', { type: 'button', class: 'tool', 'data-tool': t.id, title: t.name + ' (' + t.key + ')', 'aria-label': t.name + ' (' + t.key + ')', html: SV.ICONS[t.id] });
      b.addEventListener('pointerdown', function (e) { if (e.button === 0) { e.preventDefault(); SV.setTool(t.id); } });
      b.addEventListener('click', function (e) { if (e.detail === 0) SV.setTool(t.id); });
      grid.appendChild(b);
      bind('toolbar', function () { var on = S.tool === t.id; b.classList.toggle('on', on); b.setAttribute('aria-pressed', on ? 'true' : 'false'); });
    });
    tb.appendChild(grid);
    // fill / stroke widget
    var fs = h('div', { class: 'fswidget', 'aria-label': 'Fill and stroke' });
    var fillB = h('button', { type: 'button', class: 'fs fill', title: 'Fill (click, then click again to edit; right-click to edit)', 'aria-label': 'Fill' }, [h('span', { class: 'chip-in' })]);
    var strokeB = h('button', { type: 'button', class: 'fs stroke', title: 'Stroke (click, then click again to edit; right-click to edit)', 'aria-label': 'Stroke' }, [h('span', { class: 'chip-in' }), h('span', { class: 'hole' })]);
    function fsClick(which, el) { return function () { if (S.focus === which) editPaint(which, el); else { S.focus = which; SV.requestRender(true); } }; }
    fillB.addEventListener('click', fsClick('fill', fillB));
    strokeB.addEventListener('click', fsClick('stroke', strokeB));
    fillB.addEventListener('contextmenu', function (e) { e.preventDefault(); S.focus = 'fill'; editPaint('fill', fillB); });
    strokeB.addEventListener('contextmenu', function (e) { e.preventDefault(); S.focus = 'stroke'; editPaint('stroke', strokeB); });
    var swapB = h('button', { type: 'button', class: 'fs-mini swapb', title: 'Swap Fill and Stroke (Shift+X)', 'aria-label': 'Swap fill and stroke', html: '<svg viewBox="0 0 16 16"><path d="M3 5h7a3 3 0 0 1 3 3v5M11 11l2 2 2-2M5 3L3 5l2 2" fill="none" stroke="currentColor" stroke-width="1.4"/></svg>', onclick: function () { SV.swapFillStroke(); } });
    var defB = h('button', { type: 'button', class: 'fs-mini defb', title: 'Default Fill and Stroke (D)', 'aria-label': 'Default fill and stroke', html: '<svg viewBox="0 0 16 16"><rect x="1.5" y="1.5" width="7" height="7" fill="#fff" stroke="#000"/><rect x="5.5" y="5.5" width="7" height="7" fill="none" stroke="#000" stroke-width="2"/></svg>', onclick: function () { SV.defaultFillStroke(); } });
    fs.appendChild(h('div', { class: 'fs-stack' }, [strokeB, fillB, swapB, defB]));
    var modes = h('div', { class: 'fs-modes' }, [
      h('button', { type: 'button', class: 'fs-mode', title: 'Color (,)', 'aria-label': 'Solid color', html: '<span class="m-solid"></span>', onclick: function () { var p = SV.currentPaint(S.focus); SV.applyStyle(S.focus, typeof p === 'string' ? p : (p && p.stops ? p.stops[p.stops.length - 1].c : '#d4ff3a')); } }),
      h('button', { type: 'button', class: 'fs-mode', title: 'Gradient (.)', 'aria-label': 'Gradient', html: '<span class="m-grad"></span>', onclick: function () { var p = SV.currentPaint(S.focus); SV.applyStyle(S.focus, p && typeof p === 'object' ? p : SV.defaultGradient(p)); } }),
      h('button', { type: 'button', class: 'fs-mode', title: 'None (/)', 'aria-label': 'None', html: '<span class="m-none"></span>', onclick: function () { SV.applyStyle(S.focus, null); } })
    ]);
    fs.appendChild(modes);
    tb.appendChild(fs);
    bind('toolbar', function () {
      paintBG(fillB.firstChild, SV.currentPaint('fill')); paintBG(strokeB.firstChild, SV.currentPaint('stroke'));
      fillB.classList.toggle('front', S.focus === 'fill'); strokeB.classList.toggle('front', S.focus === 'stroke');
    });
  }

  $.fontSel = fontSel; $.bind = bind; $.binds = binds; $.btn = btn; $.buildToolbar = buildToolbar; $.chip = chip; $.curStyle = curStyle; $.field = field; $.firstOfType = firstOfType; $.ibtn = ibtn; $.numIn = numIn; $.runBinds = runBinds; $.seg = seg; $.selIn = selIn; $.selLabel = selLabel; $.setVal = setVal;
})();
