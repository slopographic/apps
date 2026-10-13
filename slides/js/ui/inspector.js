/* Slop Slides: the inspector (right column; below the canvas on phones). Slide: layout, hidden, notes. Document:
   footer and slide numbers. Selection: position, size, rotation, opacity, fill, outline, text font, size, bold,
   italics, alignment and colour, arrange and copy actions, and the transition, Present and animation panels (anim-panel.js). Each field applies on change as one undo step. The
   fields refresh from the model when it changes under them (typing is never overwritten). Exposes window.SS.inspector. */
(function () {
  'use strict';
  var SS = window.SS, A = SS.app, O = SS.objects, TH = SS.themes, D = SS.dom, OP = SS.ops, F = SS.fonts;
  var I = SS.inspector = {};
  var root = null, binds = [];
  var r1 = function (v) { return Math.round(v * 10) / 10; };

  I.mount = function (el) {
    root = el;
    ['load', 'deck', 'slide', 'select'].forEach(function (ev) { A.on(ev, build); });
    A.on('change', sync);
    build();
  };
  /** One undo step for a field edit; repeated edits to the same field within 800 ms merge. */
  function edit(label, fn) { return A.change(label, fn, 'insp:' + label + ':' + A.sel.join() + ':' + A.idx); }
  function row(label, control) { return D.el('label', { class: 'row' }, D.el('span', { text: label }), control); }
  function section(title, kids) { return D.el('section', { class: 'grp' }, D.el('h2', { text: title }), kids); }
  function hexOf(ref) { return TH.color(SS.themes.of(A.deck), ref, 'text') || '#000000'; }

  /** type: number | text | color | check | select | area. get() reads the model; set(v) applies the edit. */
  function field(label, type, get, set, opts) {
    opts = opts || {};
    var el;
    if (type === 'select') el = D.el('select', null, (opts.options || []).map(function (o) { return D.option(o[0], o[1], ''); }));
    else if (type === 'area') el = D.el('textarea', { rows: 3, 'aria-label': label });
    else el = D.el('input', { type: type === 'check' ? 'checkbox' : type, min: opts.min, max: opts.max, step: type === 'number' ? (opts.step || 1) : null, 'aria-label': label });
    var b = { el: el, get: get, type: type };
    binds.push(b);
    var commit = function () {
      var v = type === 'check' ? el.checked : type === 'number' ? parseFloat(el.value) : el.value;
      if (type === 'number' && !isFinite(v)) { sync(); return; }
      set(v);
    };
    el.addEventListener('change', commit);
    if (type === 'color') el.addEventListener('input', commit);
    return row(label, el);
  }
  function sync() {
    binds.forEach(function (b) {
      if (document.activeElement === b.el) return;
      var v = b.get();
      if (v == null) v = '';
      if (b.type === 'check') b.el.checked = !!v;
      else if (String(b.el.value) !== String(v)) b.el.value = v;
    });
  }
  /** A field on the selection: reads the first selected object, writes every selected object. */
  function objField(label, type, get, put, opts) {
    return field(label, type, function () { var o = A.selObjs()[0]; return o ? get(o) : ''; },
      function (v) { edit(label, function () { A.selObjs().forEach(function (o) { put(o, v); }); }); }, opts);
  }
  /** Fonts…: the shared Fonts panel for the fonts the deck and the selection use. Slop Slides embeds only the TrueType
   * families it ships, so the panel has no library download; it offers the closest shipped family. */
  function openFonts() {
    if (!window.SlopFonts || !A.deck) return;
    SlopFonts.ready().then(function () {
      var th = SS.themes.of(A.deck) || {}, tf = th.fonts || {}, o = A.selObjs()[0];
      var names = [tf.body, tf.heading, o && o.style && o.style.font].filter(function (n) { return n && n !== 'body' && n !== 'heading'; });
      SlopFonts.openPanel({
        fonts: names, standard: F.LIST, title: 'Fonts', library: false, download: false,
        note: 'Downloads from the library are off in Slop Slides: its engine embeds only the TrueType families it ships. Use the closest family, or add your own TTF, OTF or WOFF file.',
        closest: { sans: 'Inter Tight', serif: 'Instrument Serif', mono: 'JetBrains Mono' },
        onUse: function (r) {
          edit('Font', function () {
            var t = A.deck.theme;
            if (t && t.fonts) ['body', 'heading'].forEach(function (k) { if (t.fonts[k] === r.family) t.fonts[k] = r.use; });
            A.selObjs().forEach(function (x) { if (x.style && x.style.font === r.family) x.style = Object.assign({}, x.style, { font: r.use }); });
          });
        }
      });
    });
  }
  function fillOf(o) { return o.fill && o.fill.type === 'solid' ? o.fill : null; }
  function textOf(o) { return SS.textEdit.canEdit(o); }

  function build() {
    if (!root || !A.deck) return;
    binds = [];
    var s = A.slide(), objs = A.selObjs(), o = objs[0], kids = [];
    var fonts = [['body', 'Body (theme)'], ['heading', 'Heading (theme)']].concat(F.LIST.map(function (f) { return [f, f]; }));
    kids.push(section('Slide', [
      field('Layout', 'select', function () { var c = A.slide(); return c ? c.layout : ''; }, function (v) { OP.setLayout(v); },
        { options: SS.layouts.list.map(function (l) { return [l.id, l.name]; }) }),
      field('Hidden in show', 'check', function () { var c = A.slide(); return !!(c && c.hidden); }, function (v) { OP.setHidden(v); }),
      field('Notes', 'area', function () { var c = A.slide(); return c ? c.notes || '' : ''; },
        function (v) { edit('Notes', function () { A.slide().notes = v; }); })
    ]));
    if (s) kids.push(SS.animPanel.transitionSection(s));
    kids.push(section('Document', [
      field('Footer', 'text', function () { return A.deck.master.footer || ''; }, function (v) { edit('Footer', function () { A.deck.master.footer = v; }); }),
      field('Slide numbers', 'check', function () { return !!A.deck.master.showNumber; }, function (v) { edit('Slide numbers', function () { A.deck.master.showNumber = v; }); }),
      D.el('button', { type: 'button', onclick: openFonts }, 'Fonts…')
    ]));
    kids.push(SS.animPanel.presentSection());
    if (o) {
      kids.push(section(objs.length > 1 ? objs.length + ' objects' : (o.name || o.type), [
        objField('X', 'number', function (x) { return r1(x.x); }, function (x, v) { x.x = v; }, { step: 0.5 }),
        objField('Y', 'number', function (x) { return r1(x.y); }, function (x, v) { x.y = v; }, { step: 0.5 }),
        objs.length === 1 && o.type !== 'group' ? objField('Width', 'number', function (x) { return r1(x.w); }, function (x, v) { x.w = Math.max(6, v); if (x.type === 'table') O.fixTable(x); }, { min: 6, step: 0.5 }) : null,
        objs.length === 1 && o.type !== 'group' ? objField('Height', 'number', function (x) { return r1(x.h); }, function (x, v) { x.h = Math.max(6, v); if (x.type === 'table') O.fixTable(x); }, { min: 6, step: 0.5 }) : null,
        objField('Rotation', 'number', function (x) { return r1(x.rot || 0); }, function (x, v) { x.rot = ((v % 360) + 360) % 360; }, { step: 1 }),
        objField('Opacity %', 'number', function (x) { return Math.round((x.opacity == null ? 1 : x.opacity) * 100); },
          function (x, v) { x.opacity = Math.max(0, Math.min(100, v)) / 100; }, { min: 0, max: 100 })
      ].filter(Boolean)));
      if (o.type === 'shape' || o.type === 'text') {
        kids.push(section('Fill and outline', [
          objField('Fill', 'check', function (x) { return !!fillOf(x); }, function (x, v) { x.fill = v ? { type: 'solid', color: (fillOf(x) || {}).color || 'accent1' } : null; }),
          objField('Fill colour', 'color', function (x) { return fillOf(x) ? hexOf(fillOf(x).color) : '#000000'; }, function (x, v) { x.fill = { type: 'solid', color: v }; }),
          objField('Outline width', 'number', function (x) { return x.stroke ? x.stroke.width : 0; }, function (x, v) {
            if (v > 0) x.stroke = Object.assign({ color: 'text', dash: 'solid' }, x.stroke || {}, { width: v });
            else if (O.isLine(x)) x.stroke = Object.assign({}, x.stroke, { width: 1 });
            else x.stroke = null;
          }, { min: 0, step: 0.5 }),
          objField('Outline colour', 'color', function (x) { return x.stroke ? hexOf(x.stroke.color) : '#000000'; }, function (x, v) { x.stroke = Object.assign({ width: 1, dash: 'solid' }, x.stroke || {}, { color: v }); })
        ].filter(Boolean)));
      }
      if (textOf(o)) {
        kids.push(section('Text', [
          objField('Font', 'select', function (x) { return x.style ? x.style.font : 'body'; }, function (x, v) { x.style = Object.assign({}, x.style, { font: v }); }, { options: fonts }),
          objField('Size', 'number', function (x) { return x.style ? x.style.size : 18; }, function (x, v) { x.style = Object.assign({}, x.style, { size: Math.max(4, Math.min(400, v)) }); }, { min: 4, max: 400, step: 1 }),
          objField('Bold', 'check', function (x) { return !!(x.style && x.style.bold); }, function (x, v) { x.style = Object.assign({}, x.style, { bold: v }); }),
          objField('Italic', 'check', function (x) { return !!(x.style && x.style.italic); }, function (x, v) { x.style = Object.assign({}, x.style, { italic: v }); }),
          objField('Align', 'select', function (x) { return x.style ? x.style.align : 'l'; }, function (x, v) { x.style = Object.assign({}, x.style, { align: v }); },
            { options: [['l', 'Left'], ['c', 'Centre'], ['r', 'Right'], ['j', 'Justify']] }),
          objField('Text colour', 'color', function (x) { return x.style ? hexOf(x.style.color) : '#000000'; }, function (x, v) { x.style = Object.assign({}, x.style, { color: v }); })
        ]));
      }
      if (objs.length === 1 && s && s.objects.indexOf(o) >= 0) kids.push(SS.animPanel.objectSection(o));
      kids.push(section('Arrange', [D.el('div', { class: 'btns' },
        D.el('button', { type: 'button', onclick: function () { OP.arrange('front'); } }, 'To front'),
        D.el('button', { type: 'button', onclick: function () { OP.arrange('forward'); } }, 'Forward'),
        D.el('button', { type: 'button', onclick: function () { OP.arrange('backward'); } }, 'Backward'),
        D.el('button', { type: 'button', onclick: function () { OP.arrange('back'); } }, 'To back'),
        D.el('button', { type: 'button', onclick: OP.duplicateSel }, 'Duplicate'),
        D.el('button', { type: 'button', class: 'danger', onclick: OP.deleteSel }, 'Delete'))]));
    }
    if (!s) kids.push(D.el('p', { class: 'hint', text: 'No slide.' }));
    root.replaceChildren(...kids);
    sync();
  }
})();
