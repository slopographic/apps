/* SlopVector — ui: dialogs on the shared SlopUI kit */
(function () {
  'use strict';
  var G = window.SVGeom, SV = window.SV, S = SV.state, D = SV.dom, IO = SV.io, C = SV.cmd;
  var clone = SV.clone, getObj = SV.getObj, esc = SV.esc, fmt = G.fmt;
  var abs = Math.abs, min = Math.min, max = Math.max, round = Math.round, PI = Math.PI;
  var UI = SV.ui = SV.ui || {}; UI.st = UI.st || {};
  var IS_MAC = SV.IS_MAC;
  var $ = UI._p = UI._p || {};
  function act() { return $.act.apply(this, arguments); }
  function h() { return $.h.apply(this, arguments); }
  function keyLabel() { return $.keyLabel.apply(this, arguments); }
  function savePrefs() { return $.savePrefs.apply(this, arguments); }
  var A = $.A;
  var I = $.I;

  /* ================= dialogs (shared SlopUI kit) ================= */
  // Thin adapter: app dialogs describe { title, body, buttons:[{label, primary, danger, left, onClick}], cls }
  // and render through window.SlopUI (../shared/slopui.js), shared with PhotoSlop and Slop PDF.
  function dialog(opts) {
    var body = opts.body;
    if (typeof body === 'string') body = h('div', { class: 'sv-dlg-body', html: body });
    var specs = opts.buttons || [{ label: 'OK', primary: true }];
    var d = window.SlopUI.dialog({
      title: opts.title, body: body, dismissable: true,
      cls: 'sv-dlg ' + (opts.cls === 'wide' ? 'sui-wide' : (opts.cls || '')),
      buttons: specs.map(function (b) { return { label: b.label, primary: !!b.primary, danger: !!b.danger, act: b.onClick ? function () { return b.onClick(); } : undefined }; }),
      onClose: function (ok) { if (opts.onClose) opts.onClose(ok); }
    });
    var foot = d.box.querySelector('.sui-foot');
    if (foot) specs.forEach(function (b, i) { if (b.left && foot.children[i]) foot.children[i].classList.add('sv-left'); });
    return d;
  }
  UI.dialog = dialog;
  UI.handleGlobalKey = function (e) {
    if (UI.st.picker && e.key === 'Escape') { e.preventDefault(); UI.closePicker(); return true; }
    // SlopUI dialogs handle their own keys (and stop propagation); anything reaching us while one is open
    // came from outside it, so keep app shortcuts quiet.
    if (window.SlopUI && window.SlopUI.openDialogs > 0) {
      if (!(e.ctrlKey || e.metaKey) && !(e.target && /^(INPUT|SELECT|TEXTAREA)$/.test(e.target.tagName))) e.preventDefault();
      return true;
    }
    // A SlopUI menu (menubar dropdown or context menu) owns arrows/Enter/Escape while it has focus.
    if (document.querySelector('.sui-menu')) {
      if (e.key === 'Escape') { UI.closeMenus(); e.preventDefault(); return true; }
      if (e.target && e.target.closest && e.target.closest('.sui-menu')) return true;
    }
    return false;
  };
  function form(fields) {
    var U = window.SlopUI, wrap = h('div', { class: 'sv-form' }), refs = {};
    fields.forEach(function (f) {
      if (f.type === 'note') { wrap.appendChild(h('p', { class: 'sui-p', html: f.html || esc(f.text) })); return; }
      var inp;
      if (f.type === 'select') inp = U.select(f.options, f.value);
      else if (f.type === 'checkbox') { var c = U.check(f.label, f.value); c.input.id = 'f-' + f.id; refs[f.id] = c.input; wrap.appendChild(h('div', { class: 'sv-check' }, [c.el])); return; }
      else if (f.type === 'text') { inp = U.el('input', { class: 'sui-input', type: 'text' }); inp.value = f.value; }
      else inp = U.number(f.value, f.min, f.max, f.step || 'any');
      inp.id = 'f-' + f.id;
      if (f.onChange) inp.addEventListener(f.type === 'select' ? 'change' : 'input', function () { f.onChange(inp.value, refs); });
      refs[f.id] = inp;
      wrap.appendChild(U.field(f.label, inp, f.unit));
    });
    return { el: wrap, refs: refs, val: function (id) { var r = refs[id]; if (!r) return null; if (r.type === 'checkbox') return r.checked; if (r.type === 'number') return parseFloat(r.value); return r.value; } };
  }
  var PRESETS = [['letter', 'Letter (612 × 792)', 612, 792], ['a4', 'A4 (595 × 842)', 595.28, 841.89], ['square', 'Instagram (1080 × 1080)', 1080, 1080], ['hd', 'HD (1920 × 1080)', 1920, 1080], ['slop', 'Slop Default (1200 × 800)', 1200, 800], ['story', 'Story (1080 × 1920)', 1080, 1920], ['custom', 'Custom', null, null]];
  function newDocDialog() {
    var f = form([
      { id: 'name', label: 'Name', type: 'text', value: 'Untitled-' + S.docCounter },
      { id: 'preset', label: 'Preset', type: 'select', value: 'slop', options: PRESETS.map(function (p) { return [p[0], p[1]]; }), onChange: function (v, refs) { var p = PRESETS.filter(function (x) { return x[0] === v; })[0]; if (p && p[2]) { refs.w.value = p[2]; refs.h.value = p[3]; } } },
      { id: 'w', label: 'Width', value: 1200, min: 1, max: 20000, unit: 'px' },
      { id: 'h', label: 'Height', value: 800, min: 1, max: 20000, unit: 'px' },
      { type: 'note', text: 'The current document is replaced (Undo brings it back). Units: 1 px = 1 pt.' }
    ]);
    ['w', 'h'].forEach(function (k) { f.refs[k].addEventListener('input', function () { f.refs.preset.value = 'custom'; }); });
    dialog({ title: 'New Document', body: f.el, buttons: [{ label: 'Cancel' }, { label: 'Create', primary: true, onClick: function () {
      var w = f.val('w'), hh = f.val('h'); if (!(w > 0 && hh > 0)) { UI.toast('Enter a valid size', 'warn'); return false; }
      S.docCounter++;
      SV.loadDoc(SV.newDoc(w, hh, f.val('name') || 'Untitled'), { fit: true });
      S.fileName = null;
      SV.clearAutosave();
      SV.commit('new document'); SV.markSaved();
      UI.toast('New document · ' + w + ' × ' + hh + ' px');
    } }] });
  }
  function docSetupDialog() {
    var f = form([{ id: 'name', label: 'Name', type: 'text', value: S.doc.name }, { id: 'w', label: 'Width', value: S.doc.width, min: 1, unit: 'px' }, { id: 'h', label: 'Height', value: S.doc.height, min: 1, unit: 'px' }, { id: 'preset', label: 'Preset', type: 'select', value: 'custom', options: PRESETS.map(function (p) { return [p[0], p[1]]; }), onChange: function (v, refs) { var p = PRESETS.filter(function (x) { return x[0] === v; })[0]; if (p && p[2]) { refs.w.value = p[2]; refs.h.value = p[3]; } } }]);
    dialog({ title: 'Document Setup', body: f.el, buttons: [{ label: 'Cancel' }, { label: 'OK', primary: true, onClick: function () { var w = f.val('w'), hh = f.val('h'); if (!(w > 0 && hh > 0)) return false; S.doc.width = w; S.doc.height = hh; S.doc.name = f.val('name') || S.doc.name; SV.commit('document setup'); SV.fitArtboard(); } }] });
  }
  function saveAsDialog() {
    return window.SlopUI.prompt('Save As', 'File name', S.doc.name, { ok: 'Save' }).then(function (name) {
      if (name == null) return;
      IO.saveSVG((String(name).trim() || 'Untitled').replace(/\.svg$/i, ''));
    });
  }
  function rasterDialog(type) {
    var f = form([{ id: 'scale', label: 'Resolution', type: 'select', value: '1', options: [['1', '1× (' + S.doc.width + ' × ' + S.doc.height + ')'], ['2', '2× (' + S.doc.width * 2 + ' × ' + S.doc.height * 2 + ')'], ['4', '4× (' + S.doc.width * 4 + ' × ' + S.doc.height * 4 + ')']] }].concat(type === 'png' ? [{ id: 'transparent', type: 'checkbox', label: 'Transparent background', value: false }] : [{ id: 'q', label: 'Quality', value: 92, min: 10, max: 100, unit: '%' }]).concat([{ type: 'note', text: 'Artboard ' + S.doc.width + ' × ' + S.doc.height + ' px. Web fonts fall back to system fonts in raster exports.' }]));
    dialog({ title: 'Export as ' + type.toUpperCase(), body: f.el, buttons: [{ label: 'Cancel' }, { label: 'Export', primary: true, onClick: function () { IO.exportRaster(type, parseFloat(f.val('scale')) || 1, type === 'png' ? f.val('transparent') : false, type === 'jpg' ? (f.val('q') || 92) / 100 : undefined); } }] });
  }
  function pdfDialog(asAI) {
    var body = asAI
      ? '<p class="sui-p">Modern Adobe Illustrator <b>.ai</b> files are PDF-based, so Illustrator opens the same PDF bytes. SlopVector writes a clean PDF&nbsp;1.4 (vector paths, gradients, opacity, blend modes, Helvetica/Times/Courier text) and saves it with an <b>.ai</b> extension.</p><p class="sui-p">It opens in Illustrator, Affinity, Inkscape and every PDF viewer. Live effects stay as plain vectors; fonts map to the standard PDF fonts.</p>'
      : '<p class="sui-p">Writes a real vector PDF&nbsp;1.4 by hand: paths with fills and strokes, opacity and blend modes, linear and radial gradients (as PDF shadings), embedded images, and text set in the standard Helvetica/Times/Courier fonts.</p>';
    dialog({ title: asAI ? 'Export as .ai (PDF-compatible)' : 'Export as PDF', body: body, buttons: [{ label: 'Cancel' }, { label: 'Export', primary: true, onClick: function () { IO.exportPDF(asAI); } }] });
  }
  function prefsDialog() {
    var f = form([{ id: 'inc', label: 'Keyboard increment', value: S.prefs.keyInc, min: 0.01, unit: 'px' }, { id: 'grid', label: 'Grid size', value: S.prefs.gridSize, min: 1, unit: 'px' }, { id: 'scale', type: 'checkbox', label: 'Scale strokes when scaling objects', value: S.prefs.scaleStrokes }, { id: 'smart', type: 'checkbox', label: 'Smart guides & snapping', value: S.prefs.smart }]);
    dialog({ title: 'Preferences', body: f.el, buttons: [{ label: 'Cancel' }, { label: 'OK', primary: true, onClick: function () { S.prefs.keyInc = f.val('inc') || 1; S.prefs.gridSize = f.val('grid') || 10; S.prefs.scaleStrokes = f.val('scale'); S.prefs.smart = f.val('smart'); savePrefs(); SV.requestRender(true); } }] });
  }
  UI.shapeDialog = function (kind, p0) {
    var fields, make;
    var st = function () { return SV.newStyle(kind === 'line' ? 'line' : 'shape'); };
    if (kind === 'rect' || kind === 'rrect' || kind === 'ellipse') {
      fields = [{ id: 'w', label: 'Width', value: 100, min: 0, unit: 'px' }, { id: 'h', label: 'Height', value: 100, min: 0, unit: 'px' }];
      if (kind === 'rrect') fields.push({ id: 'r', label: 'Corner radius', value: S.shape.radius, min: 0, unit: 'px' });
      make = function (f) { var w = f.val('w'), hh = f.val('h'); if (!(w > 0 && hh > 0)) return null; return kind === 'ellipse' ? SV.mk.ellipse(p0.x + w / 2, p0.y + hh / 2, w / 2, hh / 2, st()) : SV.mk.rect(p0.x, p0.y, w, hh, kind === 'rrect' ? (S.shape.radius = f.val('r') || 0) : 0, st()); };
    } else if (kind === 'polygon') {
      fields = [{ id: 'r', label: 'Radius', value: 50, min: 0, unit: 'px' }, { id: 'n', label: 'Sides', value: S.shape.sides, min: 3, max: 64 }];
      make = function (f) { var r = f.val('r'); if (!(r > 0)) return null; S.shape.sides = SV.clamp(round(f.val('n')) || 6, 3, 64); return SV.mk.polygon(p0.x, p0.y, r, S.shape.sides, st()); };
    } else if (kind === 'star') {
      fields = [{ id: 'r1', label: 'Radius 1', value: 50, min: 0, unit: 'px' }, { id: 'r2', label: 'Radius 2', value: 25, min: 0, unit: 'px' }, { id: 'n', label: 'Points', value: S.shape.points, min: 2, max: 64 }];
      make = function (f) { var r1 = f.val('r1'), r2 = f.val('r2'); if (!(r1 > 0)) return null; S.shape.points = SV.clamp(round(f.val('n')) || 5, 2, 64); return SV.mk.star(p0.x, p0.y, r1, r2, S.shape.points, st()); };
    } else if (kind === 'line') {
      fields = [{ id: 'l', label: 'Length', value: 100, min: 0, unit: 'px' }, { id: 'a', label: 'Angle', value: 0, unit: '°' }];
      make = function (f) { var l = f.val('l'), a = -(f.val('a') || 0) * PI / 180; if (!(l > 0)) return null; return SV.mk.path([{ closed: false, pts: [G.A(p0.x, p0.y), G.A(p0.x + Math.cos(a) * l, p0.y + Math.sin(a) * l)] }], st()); };
    } else return;
    var f = form(fields);
    var names = { rect: 'Rectangle', rrect: 'Rounded Rectangle', ellipse: 'Ellipse', polygon: 'Polygon', star: 'Star', line: 'Line Segment Tool Options' };
    dialog({ title: names[kind], body: f.el, buttons: [{ label: 'Cancel' }, { label: 'OK', primary: true, onClick: function () { var o = make(f); if (!o) { UI.toast('Enter a size greater than zero', 'warn'); return false; } if (SV.insertObj(o)) { SV.select([o.id]); SV.commit(kind); } } }] });
  };
  var lastT = { move: { h: 10, v: 0 }, rotate: { a: 45 }, scale: { u: 100, h: 100, v: 100, uni: true }, reflect: { axis: 'v' } };
  function transformDialog(kind) {
    if (!S.sel.length) return UI.toast('Select objects first');
    var b = SV.selBBox(), c = S.origin || { x: b.x + b.w / 2, y: b.y + b.h / 2 }, f, build;
    if (kind === 'move') { f = form([{ id: 'h', label: 'Horizontal', value: lastT.move.h, unit: 'px' }, { id: 'v', label: 'Vertical', value: lastT.move.v, unit: 'px' }]); build = function () { lastT.move = { h: f.val('h') || 0, v: f.val('v') || 0 }; return G.translate(lastT.move.h, lastT.move.v); }; }
    else if (kind === 'rotate') { f = form([{ id: 'a', label: 'Angle', value: lastT.rotate.a, unit: '°' }, { type: 'note', text: 'Positive angles rotate counter-clockwise.' }]); build = function () { lastT.rotate.a = f.val('a') || 0; return G.rotate(-lastT.rotate.a * PI / 180, c.x, c.y); }; }
    else if (kind === 'scale') {
      f = form([{ id: 'uni', type: 'checkbox', label: 'Uniform', value: lastT.scale.uni }, { id: 'u', label: 'Scale', value: lastT.scale.u, unit: '%' }, { id: 'h', label: 'Horizontal', value: lastT.scale.h, unit: '%' }, { id: 'v', label: 'Vertical', value: lastT.scale.v, unit: '%' }]);
      build = function () { var uni = f.val('uni'); lastT.scale = { uni: uni, u: f.val('u') || 100, h: f.val('h') || 100, v: f.val('v') || 100 }; var sx = (uni ? lastT.scale.u : lastT.scale.h) / 100, sy = (uni ? lastT.scale.u : lastT.scale.v) / 100; return G.scale(sx, sy, c.x, c.y); };
    } else {
      f = form([{ id: 'axis', label: 'Axis', type: 'select', value: lastT.reflect.axis, options: [['h', 'Horizontal'], ['v', 'Vertical']] }]);
      build = function () { lastT.reflect.axis = f.val('axis') || 'v'; return lastT.reflect.axis === 'h' ? G.scale(1, -1, c.x, c.y) : G.scale(-1, 1, c.x, c.y); };
    }
    var titles = { move: 'Move', rotate: 'Rotate', scale: 'Scale', reflect: 'Reflect' };
    dialog({ title: titles[kind], body: f.el, buttons: [{ label: 'Copy', left: true, onClick: function () { C.transformSel(build(), true, kind + ' copy'); } }, { label: 'Cancel' }, { label: 'OK', primary: true, onClick: function () { var M = build(); var a = kind === 'rotate' ? -lastT.rotate.a : 0; C.transformSel(M, false, kind); if (a) SV.selObjs().forEach(function (o) { if (o.type === 'path' || o.type === 'group') o.rot = SV.normAng((o.rot || 0) + a); }); } }] });
  }
  UI.transformDialog = transformDialog;
  function shortcutsDialog() {
    var wrap = h('div', { class: 'shortcuts' });
    var col1 = h('div', { class: 'sc-col' }), col2 = h('div', { class: 'sc-col' }), col3 = h('div', { class: 'sc-col' });
    function section(col, title, rows) {
      col.appendChild(h('h4', { text: title }));
      var tb = h('table', { class: 'sc-table' });
      rows.forEach(function (r) { tb.appendChild(h('tr', {}, [h('td', { text: r[0] }), h('td', {}, [h('kbd', { text: r[1] })])])); });
      col.appendChild(tb);
    }
    section(col1, 'Tools', SV.TOOL_LIST.map(function (t) { return [t.name, t.key]; }).concat([['Hand (temporary)', 'Space'], ['Swap fill/stroke focus', 'X'], ['Swap fill & stroke colors', 'Shift+X'], ['Default fill & stroke', 'D'], ['Color / Gradient / None', ', . /']]));
    function fromActs(ids) { return ids.map(function (id) { var a = A[id]; return [a.label.replace('…', ''), a.keyText || keyLabel(a.keys[0])]; }).filter(function (r) { return r[1]; }); }
    section(col2, 'File & Edit', fromActs(['file.new', 'file.open', 'file.place', 'file.save', 'file.saveAs', 'file.exportPNG', 'file.docSetup', 'edit.undo', 'edit.redo', 'edit.cut', 'edit.copy', 'edit.paste', 'edit.pasteFront', 'edit.pasteBack', 'edit.duplicate', 'select.all', 'select.none', 'edit.prefs']).concat([['Delete', 'Del / Backspace'], ['Nudge (×10 with Shift)', 'Arrow keys'], ['Move dialog', 'Enter']]));
    section(col3, 'Object & View', fromActs(['object.group', 'object.ungroup', 'arrange.front', 'arrange.forward', 'arrange.backward', 'arrange.back', 'transform.move', 'object.lock', 'object.unlockAll', 'object.hide', 'object.showAll', 'compound.make', 'object.slopify', 'view.zoomIn', 'view.zoomOut', 'view.fit', 'view.actual', 'view.outline', 'view.rulers', 'view.grid', 'view.snapGrid', 'view.smart', 'view.guides', 'window.togglePanels', 'help.shortcuts']).concat([['Constrain / proportional', 'Shift'], ['From centre / duplicate drag', 'Alt'], ['Zoom', (IS_MAC ? '⌘' : 'Ctrl') + '+wheel / pinch']]));
    wrap.appendChild(col1); wrap.appendChild(col2); wrap.appendChild(col3);
    dialog({ title: 'Keyboard Shortcuts', body: wrap, cls: 'wide', buttons: [{ label: 'Close', primary: true }] });
  }
  function aboutDialog() {
    var body = '<div class="about"><div class="about-mark">' + I.drop + '</div><div><h3>SlopVector</h3><p class="mono">v1.0 · build ' + esc(String(SV.BUILD || '2026.10')) + '</p>' +
      '<p>A real vector editor that runs entirely in your browser: pen & pencil, live shapes, layers, gradients, pathfinder booleans, SVG/PDF/PNG export and a hand-written PDF writer. No accounts, no uploads, no tracking — your artwork never leaves this tab.</p>' +
      '<p>Part of <a href="../">Slopographic</a>, a museum of AI slop. The tool itself is, against all odds, not slop.</p>' +
      '<p class="sui-p">Tip: <b>File → Download App</b> saves a single offline .html copy of this whole editor.</p></div></div>';
    dialog({ title: 'About SlopVector', body: body, buttons: [{ label: 'Download App', left: true, onClick: function () { IO.downloadApp(); } }, { label: 'Close', primary: true }] });
  }

  $.aboutDialog = aboutDialog; $.dialog = dialog; $.docSetupDialog = docSetupDialog; $.newDocDialog = newDocDialog; $.pdfDialog = pdfDialog; $.prefsDialog = prefsDialog; $.rasterDialog = rasterDialog; $.saveAsDialog = saveAsDialog; $.shortcutsDialog = shortcutsDialog; $.transformDialog = transformDialog;
})();
