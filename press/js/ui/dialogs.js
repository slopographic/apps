/* Slop Press — document dialogs: New Document, Document Setup (size, margins, columns, bleed, slug, grid),
   Insert Pages, masters, Create Guides, Text Frame Options, fonts, placeholder text, About. */
(function () {
  'use strict';
  var PR = window.PR, U = PR.util, h = U.h, S = PR.state, H = PR.history, P = PR.pages, M = PR.model;
  var UI = PR.ui = PR.ui || {};
  var SU = function () { return window.SlopUI; };

  function lenInput(pt, unit) { var i = h('input', { class: 'sui-input', type: 'text', inputmode: 'decimal' }); i.value = U.fmt(pt, unit); i.dataset.unit = unit; return i; }
  function lenVal(i, fallback) { var v = U.parse(i.value, i.dataset.unit); return isNaN(v) ? fallback : Math.max(0, v); }
  function check(label, on) { var c = h('input', { type: 'checkbox' }); c.checked = !!on; return { el: h('label', { class: 'pr-check' }, c, label), input: c }; }
  function quad(title, vals, unit, labels) {
    var ins = {}, keys = Object.keys(labels);
    keys.forEach(function (k) { ins[k] = lenInput(vals[k], unit); });
    return { el: h('div', null, h('h4', null, title), h('div', { class: 'pr-cols' }, keys.map(function (k) { return SU().field(labels[k], ins[k], unit); }))), ins: ins };
  }
  /** Shared form for New Document and Document Setup. Returns { body, read() → settings }. */
  function setupForm(d, isNew, focusTab) {
    var unit = d.unit, preset = U.presetFor(d.size.w, d.size.h);
    var pre = SU().select([['custom', 'Custom']].concat(U.PRESETS.map(function (p) { return [p.id, p.name + ' (' + U.fmt(p.w, unit) + ' × ' + U.fmt(p.h, unit) + ' ' + unit + ')']; })), preset ? preset.id : 'custom');
    var units = SU().select(Object.keys(U.UNIT_NAMES).map(function (u) { return [u, U.UNIT_NAMES[u]]; }), unit);
    var w = lenInput(d.size.w, unit), hh = lenInput(d.size.h, unit);
    var orient = SU().select([['portrait', 'Portrait'], ['landscape', 'Landscape']], d.size.w > d.size.h ? 'landscape' : 'portrait');
    var pages = SU().number(d.pages.length, 1, 999, 1), start = SU().number(d.startPage || 1, 1, 9999, 1);
    var facing = check('Facing pages (spreads)', d.facing);
    var lbl = { top: 'Top', bottom: 'Bottom', inside: d.facing ? 'Inside' : 'Left', outside: d.facing ? 'Outside' : 'Right' };
    var mg = quad('Margins', d.margins, unit, lbl), bl = quad('Bleed', d.bleed, unit, lbl), sl = quad('Slug', d.slug, unit, lbl);
    var cols = SU().number(d.columns.count, 1, 24, 1), gut = lenInput(d.columns.gutter, unit);
    var bstart = lenInput(d.baseline.start, unit), bstep = SU().number(U.round(d.baseline.step, 2), 1, 200, 0.5);
    pre.addEventListener('change', function () {
      var p = U.PRESETS.filter(function (x) { return x.id === pre.value; })[0]; if (!p) return;
      orient.value = p.w > p.h ? 'landscape' : 'portrait'; w.value = U.fmt(p.w, w.dataset.unit); hh.value = U.fmt(p.h, hh.dataset.unit);
    });
    orient.addEventListener('change', function () { var a = w.value; if ((orient.value === 'landscape') !== (U.parse(w.value, w.dataset.unit) > U.parse(hh.value, hh.dataset.unit))) { w.value = hh.value; hh.value = a; } });
    units.addEventListener('change', function () {
      U.$$('input[data-unit]', body).forEach(function (i) { var v = U.parse(i.value, i.dataset.unit); i.dataset.unit = units.value; if (!isNaN(v)) i.value = U.fmt(v, units.value); });
      U.$$('.sui-unit', body).forEach(function (s) { if (U.UNITS[s.textContent]) s.textContent = units.value; });
    });
    var tabs = ['Page', 'Margins & Columns', 'Bleed & Slug', 'Grid'], panes = [
      h('div', null, SU().field('Preset', pre), SU().field('Width', w, unit), SU().field('Height', hh, unit), SU().field('Orientation', orient), SU().field('Units', units),
        isNew ? SU().field('Pages', pages) : null, SU().field('Start page #', start), facing.el),
      h('div', null, mg.el, h('h4', null, 'Columns'), h('div', { class: 'pr-cols' }, SU().field('Number', cols), SU().field('Gutter', gut, unit))),
      h('div', null, bl.el, sl.el),
      h('div', null, h('h4', null, 'Baseline grid'), SU().field('Start', bstart, unit), SU().field('Increment', bstep, 'pt'), h('p', { class: 'sui-p' }, 'Measured from the top of the page. Paragraphs with “Align to baseline grid” snap to it.'))];
    var tabBar = h('div', { class: 'pr-tabs', role: 'tablist' });
    var body = h('div', { class: 'pr-form' }, tabBar, panes);
    function show(k) { panes.forEach(function (p, i) { p.hidden = i !== k; }); U.$$('.pr-tab', tabBar).forEach(function (t, i) { t.classList.toggle('on', i === k); }); }
    tabs.forEach(function (t, i) { var b = h('button', { type: 'button', class: 'pr-tab', role: 'tab' }, t); b.addEventListener('click', function () { show(i); }); tabBar.append(b); });
    show(focusTab === 'margins' ? 1 : 0);
    function q(o) { var r = {}; for (var k in o.ins) r[k] = lenVal(o.ins[k], 0); return r; }
    return { body: body, read: function () {
      return { unit: units.value, w: Math.max(9, lenVal(w, d.size.w)), h: Math.max(9, lenVal(hh, d.size.h)), pages: Math.max(1, +pages.value || 1), startPage: Math.max(1, +start.value || 1), facing: facing.input.checked,
        margins: q(mg), bleed: q(bl), slug: q(sl), columns: { count: U.clamp(+cols.value || 1, 1, 24), gutter: lenVal(gut, d.columns.gutter) }, baseline: { start: lenVal(bstart, d.baseline.start), step: Math.max(1, +bstep.value || 12), show: d.baseline.show } };
    } };
  }
  UI.newDocument = function () {
    var proto = M.create({ pages: 4, facing: true });
    var f = setupForm(proto, true);
    SU().dialog({ title: 'New Document', body: f.body, cls: 'pr-mid', buttons: [{ label: 'Templates…', act: function () { setTimeout(UI.templates, 160); } }, { label: 'Cancel' }, { label: 'Create', primary: true, act: function () {
      var o = f.read(), doc = M.create({ name: 'Untitled', w: o.w, h: o.h, unit: o.unit, facing: o.facing, pages: o.pages, margins: o.margins, columns: o.columns, bleed: o.bleed, startPage: o.startPage });
      doc.slug = o.slug; doc.baseline = o.baseline;
      PR.setDoc(doc); PR.view.fitPage(); U.toast('New document');
    } }] });
  };
  UI.docSetup = function (tab) {
    var d = S.doc, f = setupForm(d, false, tab);
    SU().dialog({ title: tab === 'margins' ? 'Margins and Columns' : 'Document Setup', body: f.body, cls: 'pr-mid', buttons: [{ label: 'Cancel' }, { label: 'OK', primary: true, act: function () {
      var o = f.read();
      d.unit = o.unit; d.size = { w: o.w, h: o.h }; d.startPage = o.startPage; d.margins = o.margins; d.bleed = o.bleed; d.slug = o.slug; d.columns = o.columns; d.baseline = o.baseline;
      if (d.facing !== o.facing) { d.facing = o.facing; d.masters.forEach(function (m) { if (o.facing && m.pages.length === 1) m.pages.push(U.clone(m.pages[0])); if (!o.facing && m.pages.length === 2) m.pages = [m.pages[1]]; }); }
      PR.engine.clear(); H.commit('Document setup'); PR.view.fitPage();
    } }] });
  };
  UI.insertPages = function () {
    var n = SU().number(1, 1, 500, 1), where = SU().select([['after', 'After current page'], ['before', 'Before current page'], ['end', 'At end of document']], 'after');
    var ms = SU().select([['', '[None]']].concat(S.doc.masters.map(function (m) { return [m.id, m.prefix + '-' + m.name]; })), (S.doc.pages[S.page] || {}).master || '');
    SU().dialog({ title: 'Insert Pages', body: h('div', { class: 'pr-form' }, SU().field('Pages', n), SU().field('Insert', where), SU().field('Master', ms)), buttons: [{ label: 'Cancel' }, { label: 'OK', primary: true, act: function () {
      var at = where.value === 'after' ? S.page + 1 : where.value === 'before' ? S.page : S.doc.pages.length;
      P.insertPages(S.doc, at, U.clamp(+n.value || 1, 1, 500), ms.value || null); H.commit('Insert pages'); PR.goPage(at);
    } }] });
  };
  UI.editMaster = function (id, side) {
    if (PR.textEdit) PR.textEdit.exit();
    S.editMaster = { id: id, side: side || 0 }; S.sel = []; PR.emit('page'); PR.touch(); PR.view.fitSpread();
    U.toast('Editing master — Layout ▸ Edit Master again (or pick a page) to return');
  };
  UI.newMaster = function (existing) {
    var d = S.doc, name = h('input', { class: 'sui-input', type: 'text', value: existing ? existing.name : 'Master' });
    var prefix = h('input', { class: 'sui-input', type: 'text', maxlength: 4, value: existing ? existing.prefix : '' });
    var based = SU().select([['', '[None]']].concat(d.masters.filter(function (m) { return m !== existing; }).map(function (m) { return [m.id, m.prefix + '-' + m.name]; })), existing && existing.basedOn || '');
    SU().dialog({ title: existing ? 'Master Options' : 'New Master', body: h('div', { class: 'pr-form' }, SU().field('Prefix', prefix), SU().field('Name', name), SU().field('Based on', based)), buttons: [{ label: 'Cancel' }, { label: 'OK', primary: true, act: function () {
      var m = existing || P.newMaster(d, name.value || 'Master', based.value || null);
      m.name = name.value || m.name; if (prefix.value.trim()) m.prefix = prefix.value.trim().slice(0, 4); m.basedOn = based.value || null;
      H.commit(existing ? 'Master options' : 'New master'); if (!existing) UI.editMaster(m.id, 0);
    } }] });
  };
  UI.applyMaster = function () {
    var d = S.doc, ms = SU().select([['', '[None]']].concat(d.masters.map(function (m) { return [m.id, m.prefix + '-' + m.name]; })), (d.pages[S.page] || {}).master || '');
    var range = h('input', { class: 'sui-input', type: 'text', value: String(P.label(d, S.page)), placeholder: 'e.g. 1-4, 7' });
    SU().dialog({ title: 'Apply Master', body: h('div', { class: 'pr-form' }, SU().field('Master', ms), SU().field('To pages', range)), buttons: [{ label: 'Cancel' }, { label: 'OK', primary: true, act: function () {
      var idx = UI.parseRange(range.value); P.applyMaster(d, idx, ms.value || null); H.commit('Apply master');
    } }] });
  };
  /** "1-3, 5" (page numbers as shown) → page indexes. Empty or "all" = every page. */
  UI.parseRange = function (str) {
    var d = S.doc, out = [], off = d.startPage || 1;
    if (!str || /^\s*all\s*$/i.test(str)) return d.pages.map(function (p, i) { return i; });
    str.split(',').forEach(function (part) {
      var m = /^\s*(\d+)\s*(?:-\s*(\d+))?\s*$/.exec(part); if (!m) return;
      var a = +m[1] - off, b = (m[2] ? +m[2] : +m[1]) - off;
      for (var i = Math.min(a, b); i <= Math.max(a, b); i++) if (i >= 0 && i < d.pages.length && out.indexOf(i) < 0) out.push(i);
    });
    return out.sort(function (a, b) { return a - b; });
  };
  UI.createGuides = function () {
    var rows = SU().number(2, 0, 40, 1), cols = SU().number(3, 0, 40, 1), gut = lenInput(U.UNITS.mm * 5, S.doc.unit), clear = check('Remove existing guides', false);
    SU().dialog({ title: 'Create Guides', body: h('div', { class: 'pr-form' }, SU().field('Rows', rows), SU().field('Columns', cols), SU().field('Gutter', gut, S.doc.unit), clear.el,
      h('p', { class: 'sui-p' }, window.SlopGuides ? 'Tip: the shared GuideGuide panel is available too.' : 'Guides fit inside the margins of the current page (or master).')), buttons: [{ label: 'Cancel' }, { label: 'OK', primary: true, act: function () {
      var list = PR.layers.guideList(S.doc, S); if (clear.input.checked) list.length = 0;
      PR.layers.makeGrid(S.doc, S.editMaster ? P.masterSideName(S.doc, S.editMaster.side) : S.page, Math.max(1, +rows.value || 1), Math.max(1, +cols.value || 1), lenVal(gut, 0), list);
      H.commit('Create guides');
    } }] });
  };
  UI.textFrameOptions = function () {
    var its = PR.selected().filter(function (it) { return it.type === 'text'; }); if (!its.length) return;
    var it = its[0], u = S.doc.unit;
    var cols = SU().number(it.cols || 1, 1, 12, 1), gut = lenInput(it.gutter || 0, u), ins = lenInput(it.inset || 0, u);
    var va = SU().select([['top', 'Top'], ['center', 'Center'], ['bottom', 'Bottom']], it.valign || 'top');
    SU().dialog({ title: 'Text Frame Options', body: h('div', { class: 'pr-form' }, h('h4', null, 'Columns'), SU().field('Number', cols), SU().field('Gutter', gut, u), h('h4', null, 'Inset & alignment'), SU().field('Inset', ins, u), SU().field('Vertical align', va)),
      buttons: [{ label: 'Cancel' }, { label: 'OK', primary: true, act: function () { its.forEach(function (x) { x.cols = U.clamp(+cols.value || 1, 1, 12); x.gutter = lenVal(gut, 0); x.inset = lenVal(ins, 0); x.valign = va.value; }); H.commit('Text frame options'); } }] });
  };
  UI.currentParaStyle = function () { return S.doc.styles.para.Body ? 'Body' : '[Basic Paragraph]'; };
})();
