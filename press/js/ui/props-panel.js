/* Slop Press — Properties panel: object geometry/appearance/frame options/wrap, paragraph details while
   editing text, document basics when nothing is selected. */
(function () {
  'use strict';
  var PR = window.PR, U = PR.util, h = U.h, S = PR.state, K = PR.kit, H = PR.history, FM = PR.format;
  var UI = PR.ui = PR.ui || {};
  var refs = [];
  function sec(title) { return h('div', { class: 'psec' }, h('div', { class: 'psec-title' }, title)); }
  function r(el) { refs.push(el.refresh); return el; }
  function f(label, el, title) { var x = K.field(label, el, title); return x; }
  function n(o) { return r(K.num(o)); }

  function objectProps(body, its) {
    var it = its[0], set = function (fn, label) { return function (v) { its.forEach(function (x) { fn(x, v); }); H.commit(label); }; };
    var tr = sec('Transform'), g = h('div', { class: 'grid2' });
    [['x', 'X'], ['y', 'Y'], ['w', 'W'], ['h', 'H']].forEach(function (k) {
      g.append(f(k[1], n({ get: function () { return it[k[0]]; }, set: set(function (x, v) { x[k[0]] = k[0] === 'w' || k[0] === 'h' ? Math.max(1, v) : v; }, 'Transform') })));
    });
    g.append(f('∠', n({ unit: '°', get: function () { return it.rot || 0; }, set: set(function (x, v) { x.rot = ((v % 360) + 360) % 360; }, 'Rotate') }), 'Rotation'));
    tr.append(g); body.append(tr);
    var ap = sec('Appearance'), row = h('div', { class: 'row' });
    row.append(f('Fill', K.chip(it.fill, 'Fill', function (c) { UI.setPaint('fill', c); })), f('Stroke', K.chip(it.stroke, 'Stroke', function (c) { UI.setPaint('stroke', c); })),
      f('pt', n({ unit: 'pt', cls: 'w48', get: function () { return it.sw; }, set: set(function (x, v) { x.sw = Math.max(0, v); }, 'Stroke weight'), min: 0, step: 0.5 }), 'Stroke weight'));
    var g2 = h('div', { class: 'grid2' });
    g2.append(f('◜', n({ get: function () { return it.radius || 0; }, set: set(function (x, v) { x.radius = Math.max(0, v); }, 'Corner radius'), min: 0 }), 'Corner radius'),
      f('%', n({ unit: '%', get: function () { return Math.round((it.opacity == null ? 1 : it.opacity) * 100); }, set: set(function (x, v) { x.opacity = U.clamp(v, 0, 100) / 100; }, 'Opacity') }), 'Opacity'));
    var dash = K.select([['', 'Solid'], ['dash', 'Dashed'], ['dot', 'Dotted']], it.dash ? (it.dash[0] < 1 ? 'dot' : 'dash') : '', set(function (x, v) { x.dash = v === 'dash' ? [4, 2] : v === 'dot' ? [0.01, 2] : null; }, 'Stroke style'));
    ap.append(row, g2, h('div', { class: 'row' }, h('span', { class: 'fl' }, 'Stroke type'), dash)); body.append(ap);
    if (it.type === 'polygon') {
      var pg = sec('Polygon'), g3 = h('div', { class: 'grid2' });
      g3.append(f('#', n({ unit: 'raw', get: function () { return it.sides; }, set: set(function (x, v) { x.sides = U.clamp(Math.round(v), 3, 64); }, 'Sides'), min: 3 }), 'Number of sides'),
        f('★', n({ unit: '%', get: function () { return Math.round((it.inset || 0) * 100); }, set: set(function (x, v) { x.inset = U.clamp(v, 0, 95) / 100; }, 'Star inset') }), 'Star inset'));
      pg.append(g3); body.append(pg);
    }
    if (it.type === 'text') {
      var tf = sec('Text Frame'), g4 = h('div', { class: 'grid2' });
      g4.append(f('Col', n({ unit: 'raw', get: function () { return it.cols || 1; }, set: set(function (x, v) { x.cols = U.clamp(Math.round(v), 1, 12); }, 'Columns'), min: 1 }), 'Columns'),
        f('Gut', n({ get: function () { return it.gutter || 0; }, set: set(function (x, v) { x.gutter = Math.max(0, v); }, 'Gutter'), min: 0 }), 'Gutter'),
        f('Ins', n({ get: function () { return it.inset || 0; }, set: set(function (x, v) { x.inset = Math.max(0, v); }, 'Inset'), min: 0 }), 'Inset spacing'));
      var va = K.seg([['top', 'Top'], ['center', 'Mid'], ['bottom', 'Bot']], it.valign || 'top', function (v) { its.forEach(function (x) { x.valign = v; }); H.commit('Vertical justification'); });
      var info = PR.engine.story(it.story), st = S.doc.stories[it.story];
      tf.append(g4, h('div', { class: 'row' }, h('span', { class: 'fl' }, 'Align'), va),
        h('p', { class: 'tip' }, (st ? st.text.length : 0) + ' characters' + (info && info.overset ? ' · ' : '') , info && info.overset ? h('b', { style: { color: '#ff6b6b' } }, 'overset') : null,
          ' · ' + PR.model.storyFrames(S.doc, it.story).length + ' frame(s) in thread'));
      var bt = h('div', { class: 'row' });
      var b1 = h('button', { type: 'button', class: 'btn small' }, 'Edit text'); b1.addEventListener('click', function () { PR.textEdit.enter(it, 0); });
      var b2 = h('button', { type: 'button', class: 'btn small' }, 'Autoflow'); b2.addEventListener('click', function () { PR.actions.run('layout.autoflow'); });
      bt.append(b1, info && info.overset ? b2 : null); tf.append(bt); body.append(tf);
    }
    if (it.type === 'image') {
      var im = sec('Image'), b = h('button', { type: 'button', class: 'btn small' }, it.asset ? 'Replace image…' : 'Place image…');
      b.addEventListener('click', function () { PR.place.pick(it); });
      var fit = K.select([['fill', 'Fill frame'], ['fit', 'Fit proportionally'], ['center', 'Center'], ['stretch', 'Stretch'], ['custom', 'Custom']], it.fit, set(function (x, v) { x.fit = v; }, 'Fitting'));
      var g5 = h('div', { class: 'grid2' });
      g5.append(f('%', n({ unit: '%', get: function () { return Math.round((it.sc || 1) * 100); }, set: set(function (x, v) { x.sc = Math.max(1, v) / 100; x.fit = x.fit === 'fill' || x.fit === 'fit' || x.fit === 'stretch' ? 'custom' : x.fit; }, 'Image scale') }), 'Scale (center/custom)'),
        f('↔', n({ get: function () { return it.ox || 0; }, set: set(function (x, v) { x.ox = v; x.fit = 'custom'; }, 'Image offset') }), 'Offset X'),
        f('↕', n({ get: function () { return it.oy || 0; }, set: set(function (x, v) { x.oy = v; x.fit = 'custom'; }, 'Image offset') }), 'Offset Y'));
      im.append(h('div', { class: 'row' }, b, fit), g5); body.append(im);
    }
    var wr = sec('Text Wrap'), w = it.wrap || { type: 'none', off: 6 };
    wr.append(K.seg([['none', 'None'], ['box', 'Box'], ['contour', 'Shape'], ['jump', 'Jump']], w.type, function (v) { its.forEach(function (x) { x.wrap = U.assign({ off: 6 }, x.wrap, { type: v }); }); H.commit('Text wrap'); }),
      f('Offset', n({ get: function () { return (it.wrap || {}).off || 0; }, set: set(function (x, v) { x.wrap = U.assign({ type: 'none' }, x.wrap, { off: Math.max(0, v) }); }, 'Wrap offset') })));
    body.append(wr);
  }
  function paraProps(body) {
    var cur = function () { return FM.current() || { para: {}, char: {} }; }, p = function (k) { return function () { return cur().para[k] || 0; }; };
    var set = function (k) { return function (v) { var o = {}; o[k] = v; FM.para(o); }; };
    var ind = sec('Indents & Spacing'), g = h('div', { class: 'grid2' });
    g.append(f('⇤', n({ get: p('indentLeft'), set: set('indentLeft') }), 'Left indent'), f('⇥', n({ get: p('indentRight'), set: set('indentRight') }), 'Right indent'),
      f('1st', n({ get: p('indentFirst'), set: set('indentFirst') }), 'First-line indent'), f('', h('span')),
      f('↥', n({ unit: 'pt', get: p('spaceBefore'), set: set('spaceBefore') }), 'Space before'), f('↧', n({ unit: 'pt', get: p('spaceAfter'), set: set('spaceAfter') }), 'Space after'));
    ind.append(g); body.append(ind);
    var dc = sec('Drop Cap'), g2 = h('div', { class: 'grid2' });
    g2.append(f('Ln', n({ unit: 'raw', get: p('dropLines'), set: function (v) { FM.para({ dropLines: U.clamp(Math.round(v), 0, 10) }); } }), 'Lines (0 = off)'),
      f('Ch', n({ unit: 'raw', get: function () { return cur().para.dropChars || 1; }, set: function (v) { FM.para({ dropChars: U.clamp(Math.round(v), 1, 10) }); } }), 'Characters'));
    dc.append(g2); body.append(dc);
    var ko = sec('Keep Options & Hyphenation');
    function chk(label, key) {
      var c = h('input', { type: 'checkbox' }); refs.push(function () { c.checked = !!cur().para[key]; });
      c.addEventListener('change', function () { var o = {}; o[key] = c.checked; FM.para(o); });
      return h('label', { class: 'chk' }, c, label);
    }
    var g3 = h('div', { class: 'grid2' });
    g3.append(f('First', n({ unit: 'raw', get: function () { return cur().para.keepFirst || 1; }, set: function (v) { FM.para({ keepFirst: U.clamp(Math.round(v), 1, 5) }); } }), 'Keep first lines together'),
      f('Last', n({ unit: 'raw', get: function () { return cur().para.keepLast || 1; }, set: function (v) { FM.para({ keepLast: U.clamp(Math.round(v), 1, 5) }); } }), 'Keep last lines together'));
    ko.append(chk('Keep with next paragraph', 'keepNext'), chk('Keep all lines together', 'keepLines'), g3, chk('Hyphenate', 'hyphenate'), chk('Align to baseline grid', 'gridAlign'),
      h('div', { class: 'row' }, h('span', { class: 'fl' }, 'Composer'), K.select([['kp', 'Paragraph (Knuth–Plass)'], ['greedy', 'Single-line (greedy)']], cur().para.composer || 'kp', function (v) { FM.para({ composer: v }); })));
    body.append(ko);
    var ru = sec('Paragraph Rules');
    ['ruleAbove', 'ruleBelow'].forEach(function (k) {
      var c = h('input', { type: 'checkbox' }); refs.push(function () { c.checked = !!(cur().para[k] && cur().para[k].weight); });
      c.addEventListener('change', function () { var o = {}; o[k] = c.checked ? { weight: 1, color: cur().char.color || '#000', offset: 6 } : null; FM.para(o); });
      ru.append(h('label', { class: 'chk' }, c, k === 'ruleAbove' ? 'Rule above' : 'Rule below'));
    });
    var more = h('button', { type: 'button', class: 'btn small' }, 'Edit paragraph style…');
    more.addEventListener('click', function () { UI.styleEditor('para', cur().ps); });
    ru.append(more); body.append(ru);
  }
  function docProps(body) {
    var d = S.doc, s = sec('Document');
    s.append(h('p', { class: 'tip' }, d.name + ' · ' + d.pages.length + ' pages · ' + U.fmt(d.size.w, d.unit, true) + ' × ' + U.fmt(d.size.h, d.unit, true)),
      h('div', { class: 'row' }, h('span', { class: 'fl' }, 'Units'), K.select(Object.keys(U.UNIT_NAMES).map(function (u) { return [u, U.UNIT_NAMES[u]]; }), d.unit, function (v) { d.unit = v; H.commit('Units'); UI.refreshPanels(); PR.view.request(); })));
    var b = h('button', { type: 'button', class: 'btn small' }, 'Document Setup…'); b.addEventListener('click', function () { PR.actions.run('file.docSetup'); });
    var b2 = h('button', { type: 'button', class: 'btn small' }, 'Margins & Columns…'); b2.addEventListener('click', function () { PR.actions.run('layout.marginsColumns'); });
    s.append(h('div', { class: 'row' }, b, b2), h('p', { class: 'tip' }, 'Select an object to edit it, or click into text with the Type tool (T) to format paragraphs.'));
    body.append(s);
  }
  UI.panel({
    id: 'props', title: 'Properties',
    build: function (body) {
      refs = [];
      if (S.text) paraProps(body);
      else if (S.sel.length) objectProps(body, PR.selected());
      else docProps(body);
      refs.forEach(function (fn) { try { fn(); } catch (e) { /* ignore */ } });
    },
    refresh: function () { refs.forEach(function (fn) { try { fn(); } catch (e) { /* ignore */ } }); }
  });
  var sig = '';
  function soon() {
    var s2 = (S.text ? 'T' : 'S' + S.sel.join(',')) + (S.doc && S.doc.unit);
    if (s2 !== sig) { sig = s2; UI.panels.props.refresh = null; UI.refreshPanels('props'); UI.panels.props.refresh = function () { refs.forEach(function (fn) { try { fn(); } catch (e) { /* ignore */ } }); }; }
    else UI.refreshPanels('props');
  }
  var later = U.debounce(soon, 60);
  ['select', 'textsel', 'commit', 'doc', 'tool'].forEach(function (e) { PR.on(e, later); });
})();
