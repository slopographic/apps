/* Slop PDF — right-hand properties panel: one panel per tool in the left rail. */
(function () {
  'use strict';
  var SP = window.SP, U = SP.util, E = SP.engine, h = U.h;
  var P = SP.panels = {};
  var root, current = null, refreshers = [];

  /* ------------------------------------------------------------ helpers */
  function section(title, kids, opts) {
    opts = opts || {};
    return h('section', { class: 'pp-sec' + (opts.cls ? ' ' + opts.cls : '') }, title ? h('h3', { class: 'pp-h' }, title) : null, kids);
  }
  function row(label, ctrl, hint) { return h('label', { class: 'pp-row' }, h('span', { class: 'pp-label' }, label), ctrl, hint ? h('span', { class: 'pp-hint' }, hint) : null); }
  function btn(label, icon, onclick, cls, title) {
    return h('button', { type: 'button', class: 'btn ' + (cls || ''), onclick: onclick, title: title || null, html: (icon ? U.icon(icon) : '') + '<span>' + U.esc(label) + '</span>' });
  }
  function seg(options, value, onChange, label) {
    var g = h('div', { class: 'seg', role: 'radiogroup', 'aria-label': label || null });
    options.forEach(function (o) {
      var b = h('button', { type: 'button', role: 'radio', class: 'seg-b' + (String(o[0]) === String(value) ? ' on' : ''), 'aria-checked': String(o[0]) === String(value) ? 'true' : 'false', title: o[2] || null, html: o[1] });
      b.addEventListener('click', function () {
        U.$$('.seg-b', g).forEach(function (x) { x.classList.remove('on'); x.setAttribute('aria-checked', 'false'); });
        b.classList.add('on'); b.setAttribute('aria-checked', 'true'); onChange(o[0]);
      });
      g.appendChild(b);
    });
    return g;
  }
  function select(options, value, onChange) {
    var s = h('select', { class: 'inp' }, options.map(function (o) { return h('option', { value: o[0], selected: String(o[0]) === String(value) }, o[1]); }));
    s.addEventListener('change', function () { onChange(s.value); });
    return s;
  }
  function num(value, min, max, step, onChange) {
    var i = h('input', { class: 'inp num', type: 'number', value: value, min: min, max: max, step: step || 1, inputmode: 'decimal' });
    i.addEventListener('input', function () { var v = parseFloat(i.value); if (!isNaN(v)) onChange(U.clamp(v, min, max)); });
    return i;
  }
  function text(value, onChange, ph, onCommit) {
    var i = h('input', { class: 'inp', type: 'text', value: value || '', placeholder: ph || '' });
    i.addEventListener('input', function () { onChange(i.value); });
    if (onCommit) i.addEventListener('change', function () { onCommit(i.value); });
    return i;
  }
  function slider(value, min, max, step, onChange, fmt) {
    var out = h('output', { class: 'sl-out' }, fmt ? fmt(value) : String(value));
    var r = h('input', { type: 'range', class: 'sl', min: min, max: max, step: step, value: value });
    r.addEventListener('input', function () { var v = parseFloat(r.value); out.textContent = fmt ? fmt(v) : String(v); onChange(v); });
    return h('div', { class: 'sl-wrap' }, r, out);
  }
  var SWATCHES = ['#111111', '#ffffff', '#e0245e', '#ff9f1c', '#ffe14d', '#c6f432', '#2ee6a8', '#1d4ed8', '#7c3aed'];
  function colorPicker(value, onChange, allowNone) {
    var wrap = h('div', { class: 'swatches' });
    var inp = h('input', { type: 'color', class: 'sw-input', value: value && value !== 'none' ? value : '#000000', 'aria-label': 'Custom colour' });
    function mark(v) { U.$$('.sw', wrap).forEach(function (s) { s.classList.toggle('on', s.dataset.c === v); }); }
    if (allowNone) {
      var n = h('button', { type: 'button', class: 'sw sw-none', 'data-c': 'none', title: 'None', 'aria-label': 'No colour' });
      n.addEventListener('click', function () { mark('none'); onChange('none'); }); wrap.appendChild(n);
    }
    SWATCHES.forEach(function (c) {
      var s = h('button', { type: 'button', class: 'sw', 'data-c': c, title: c, 'aria-label': 'Colour ' + c, style: { '--c': c } });
      s.addEventListener('click', function () { mark(c); inp.value = c; onChange(c); });
      wrap.appendChild(s);
    });
    inp.addEventListener('input', function () { mark(inp.value); onChange(inp.value); });
    wrap.appendChild(inp);
    mark(value || 'none');
    return wrap;
  }
  function check(label, checked, onChange) {
    var c = h('input', { type: 'checkbox', checked: !!checked });
    c.addEventListener('change', function () { onChange(c.checked); });
    return h('label', { class: 'chk' }, c, h('span', null, label));
  }
  function note(t, cls) { return h('p', { class: 'pp-note' + (cls ? ' ' + cls : '') }, t); }
  function needPages() {
    if (E.state.pages.length) return null;
    return section(null, [note('Open a PDF first — or try the sample.'), h('div', { class: 'btn-row' }, btn('Open PDF', 'open', function () { SP.app.openDialog(); }, 'primary'), btn('Try a sample', 'sparkle', function () { SP.app.loadSample(); }))]);
  }
  P.helpers = { section: section, row: row, btn: btn, seg: seg, select: select, num: num, text: text, slider: slider, colorPicker: colorPicker, check: check, note: note };

  /* -------------------------------------------------------------- core */
  P.init = function (el) { root = el; };
  P.show = function (tool) {
    current = tool; refreshers = [];
    root.innerHTML = '';
    var def = PANELS[tool] || PANELS.organize;
    root.appendChild(h('div', { class: 'pp-title' }, h('span', { html: U.icon(def.icon) }), h('h2', null, def.title)));
    var body = h('div', { class: 'pp-body' });
    root.appendChild(body);
    def.build(body);
  };
  /** Called on state changes; panels register small refreshers instead of rebuilding (keeps focus). */
  P.refresh = function (reason) { refreshers.forEach(function (fn) { try { fn(reason); } catch (e) { console.warn(e); } }); };
  P.rebuild = function () { if (current) P.show(current); };
  function onRefresh(fn) { refreshers.push(fn); fn(); }

  var PANELS = {};
  /* ---------------------------------------------------------- organize */
  PANELS.organize = {
    title: 'Organize pages', icon: 'organize', build: function (b) {
      var files = h('div', { class: 'file-list' });
      b.appendChild(section('Files', [files, h('div', { class: 'btn-row' }, btn('Add PDFs or images', 'plus', function () { SP.app.openDialog(); }, 'wide'))]));
      onRefresh(function () {
        files.innerHTML = '';
        var counts = {};
        E.state.pages.forEach(function (p) { if (p.f) counts[p.f] = (counts[p.f] || 0) + 1; });
        if (!E.files.size) files.appendChild(note('No files open yet.'));
        E.files.forEach(function (f) {
          var n = counts[f.id] || 0;
          files.appendChild(h('div', { class: 'file-item' + (n ? '' : ' unused') },
            h('span', { class: 'fdot', style: { '--fc': f.color } }),
            h('span', { class: 'fi-name', title: f.name }, f.name),
            h('span', { class: 'fi-meta' }, n + '/' + f.numPages + ' p' + (f.decrypted ? ' · unlocked' : '') + (f.locked ? ' · locked' : '')),
            h('button', { type: 'button', class: 'ib', title: 'Select its pages', 'aria-label': 'Select pages from ' + f.name, html: U.icon('selectall'), onclick: function () { SP.organizer.setSelection(E.state.pages.filter(function (p) { return p.f === f.id; }).map(function (p) { return p.id; })); } }),
            h('button', { type: 'button', class: 'ib', title: n ? 'Remove its pages' : 'Add its pages again', 'aria-label': (n ? 'Remove pages of ' : 'Re-add pages of ') + f.name, html: U.icon(n ? 'trash' : 'plus'), onclick: function () {
              if (n) SP.app.remove(E.state.pages.filter(function (p) { return p.f === f.id; }).map(function (p) { return p.id; }));
              else E.commit('Add ' + f.name, function (st) { st.pages = st.pages.concat(E.pagesForFile(f)); });
            } })));
        });
      });
      var selInfo = h('p', { class: 'pp-note sel-info' });
      b.appendChild(section('Selection', [selInfo, h('div', { class: 'btn-grid' },
        btn('Rotate left', 'rotl', function () { SP.app.rotate(SP.app.targetIds(), -90); }),
        btn('Rotate right', 'rotr', function () { SP.app.rotate(SP.app.targetIds(), 90); }),
        btn('Duplicate', 'copy', function () { SP.app.duplicate(SP.app.targetIds()); }),
        btn('Delete', 'trash', function () { SP.app.remove(SP.app.targetIds()); }, 'danger-text'),
        btn('Extract to PDF', 'extract', function () { SP.app.extract(); }),
        btn('Select all', 'selectall', function () { SP.organizer.selectAll(); }))]));
      onRefresh(function () {
        var n = SP.organizer.sel.size, t = E.state.pages.length;
        selInfo.textContent = n ? n + ' of ' + t + ' pages selected' + (n ? ' (' + U.describeIdx(SP.organizer.selectedIndices()) + ')' : '') : 'No pages selected — actions apply to all ' + t + ' pages. Click, Shift-click, Ctrl/⌘-click or drag a box to select.';
      });
      var ins = SP.app.insertOpts;
      b.appendChild(section('Insert', [
        row('Page size', seg([['a4', 'A4'], ['letter', 'Letter'], ['same', 'Same as neighbour']], ins.size, function (v) { ins.size = v; }, 'Blank page size')),
        row('Orientation', seg([['portrait', 'Portrait'], ['landscape', 'Landscape']], ins.orient, function (v) { ins.orient = v; }, 'Orientation')),
        row('Position', select([['after', 'After selection'], ['before', 'Before selection'], ['start', 'At the start'], ['end', 'At the end']], ins.where, function (v) { ins.where = v; })),
        h('div', { class: 'btn-row' }, btn('Blank page', 'blank', function () { SP.app.insertBlank(); }), btn('From file…', 'insert', function () { SP.app.insertFromFile(); }))]));
      var sortSel = 'collate';
      b.appendChild(section('Order', [
        h('div', { class: 'btn-row' }, btn('Reverse', 'reverse', function () { SP.app.reverse(); })),
        row('Sort', select([['collate', 'Collate front/back scans (backs reversed)'], ['collate-same', 'Collate front/back scans (same order)'], ['odd-even', 'Odd pages first, then even'], ['even-odd', 'Even pages first, then odd'], ['source', 'Group by source file & page']], sortSel, function (v) { sortSel = v; })),
        h('div', { class: 'btn-row' }, btn('Apply sort', 'sort', function () { SP.app.sort(sortSel); })),
        note('Scanned a double-sided stack on a one-sided scanner? Scan all fronts, flip the stack, scan the backs, open both files, then “Collate”.')]));
      b.appendChild(section('Merge', [note('Every file you open is added to one document, colour-coded by source. Arrange pages, then press Download to save the merged PDF.')]));
      b.appendChild(section('Keyboard', [h('dl', { class: 'keys' },
        h('dt', null, '← → ↑ ↓'), h('dd', null, 'Move focus (Shift extends)'),
        h('dt', null, 'Alt + arrows'), h('dd', null, 'Move selected pages'),
        h('dt', null, 'Space'), h('dd', null, 'Toggle selection'),
        h('dt', null, 'R / Shift+R'), h('dd', null, 'Rotate right / left'),
        h('dt', null, 'Del'), h('dd', null, 'Delete pages'),
        h('dt', null, 'Enter'), h('dd', null, 'Open page view'),
        h('dt', null, 'Ctrl/⌘ Z, Shift Z'), h('dd', null, 'Undo / redo'))], { cls: 'pp-keys' }));
    }
  };

  /* -------------------------------------------------------------- edit */
  PANELS.edit = {
    title: 'Edit page', icon: 'edit', build: function (b) {
      var np = needPages(); if (np) { b.appendChild(np); return; }
      var tools = h('div', { class: 'tool-grid', role: 'toolbar', 'aria-label': 'Annotation tools' });
      SP.editor.TOOLS.forEach(function (t) {
        var bt = h('button', { type: 'button', class: 'tool-b', 'data-tool': t[0], title: t[1] + ' (' + t[3] + ')', html: U.icon(t[2]) + '<span>' + U.esc(t[1].split(' (')[0]) + '</span>' });
        bt.addEventListener('click', function () { SP.editor.setTool(t[0]); });
        tools.appendChild(bt);
      });
      b.appendChild(section('Tools', [tools]));
      var props = h('div', { class: 'props-box' });
      b.appendChild(props);
      var pageSec = h('div');
      b.appendChild(pageSec);
      var lastKey = null;
      onRefresh(function (reason) {
        U.$$('.tool-b', tools).forEach(function (x) { x.classList.toggle('on', x.dataset.tool === SP.editor.tool); });
        var a = SP.editor.getSelected(), type = a ? a.type : SP.editor.tool;
        var key = (a ? a.id + ':' + a.type : 'tool:' + type) + ':' + SP.editor.pid;
        if (key !== lastKey || reason === 'history') { lastKey = key; buildProps(props, a, type); }
        var p = SP.editor.page();
        pageSec.innerHTML = '';
        if (p) {
          var n = p.annots.length;
          pageSec.appendChild(section('This page', [note('Page ' + (E.indexOf(p.id) + 1) + ' of ' + E.state.pages.length + ' · ' + (n ? n + ' annotation' + (n > 1 ? 's' : '') : 'no annotations yet') + '. Annotations are flattened into the page when you download.'),
            n ? h('div', { class: 'btn-row' }, btn('Clear page annotations', 'trash', function () { E.commit('Clear annotations', function (st) { st.pages.forEach(function (x) { if (x.id === p.id) x.annots = []; }); }); }, 'danger-text')) : null]));
        }
      });
    }
  };
  function buildProps(box, a, type) {
    box.innerHTML = '';
    var Ed = SP.editor, d = a || Ed.defaults[type] || {};
    var set = function (k) { return function (v) { Ed.setProp(k, v); }; };
    var kids = [];
    if (type === 'select' && !a) { box.appendChild(section('Selection', [note('Click an annotation to select it. Drag to move, use the handles to resize, double-click text to edit. Drag empty space to pan; Ctrl/⌘ + wheel or pinch to zoom.')])); return; }
    if (type === 'text') {
      kids.push(row('Font', select([['Helvetica', 'Helvetica (sans)'], ['Times', 'Times (serif)'], ['Courier', 'Courier (mono)']], d.font, set('font'))));
      kids.push(row('Size', num(d.size || 16, 4, 400, 1, set('size')), 'pt'));
      kids.push(h('div', { class: 'btn-row' },
        toggle('B', 'Bold', d.bold, set('bold'), 'bold'), toggle('I', 'Italic', d.italic, set('italic'), 'italic')));
      kids.push(row('Colour', colorPicker(d.color, set('color'))));
    }
    if (/^(pen|marker|line|arrow|rect|ellipse)$/.test(type)) {
      kids.push(row(type === 'rect' || type === 'ellipse' ? 'Stroke' : 'Colour', colorPicker(d.color, set('color'), type === 'rect' || type === 'ellipse')));
      kids.push(row('Width', slider(d.width || 2, 0.5, type === 'marker' ? 40 : 20, 0.5, set('width'), function (v) { return v + ' pt'; })));
    }
    if (type === 'rect' || type === 'ellipse') kids.push(row('Fill', colorPicker(d.fill || 'none', set('fill'), true)));
    if (type === 'whiteout' || type === 'hlbox') kids.push(row(type === 'whiteout' ? 'Cover colour' : 'Colour', colorPicker(d.fill, set('fill'))));
    if (type !== 'whiteout') kids.push(row('Opacity', slider(Math.round((d.opacity == null ? 1 : d.opacity) * 100), 5, 100, 1, function (v) { Ed.setProp('opacity', v / 100); }, function (v) { return v + '%'; })));
    if (type === 'whiteout') kids.push(note('Whiteout paints an opaque box over the page. It hides content visually; the original text underneath is still in the file.', 'warn'));
    var names = { text: 'Text', pen: 'Drawing', marker: 'Highlighter', rect: 'Rectangle', ellipse: 'Ellipse', line: 'Line', arrow: 'Arrow', whiteout: 'Whiteout', hlbox: 'Highlight box', image: a && a.sig ? 'Signature' : 'Image' };
    box.appendChild(section((a ? 'Selected: ' : 'New ') + (names[type] || type), kids));
    if (a) {
      box.appendChild(section(null, [h('div', { class: 'btn-grid' },
        a.type === 'text' ? btn('Edit text', 'text', function () { Ed.editSelectedText(); }) : null,
        btn('Duplicate', 'copy', function () { Ed.duplicateSelected(); }),
        btn('Bring to front', 'plus', function () { zorder(a.id, 1); }),
        btn('Send to back', 'reverse', function () { zorder(a.id, -1); }),
        btn('Delete', 'trash', function () { Ed.deleteSelected(); }, 'danger-text'))]));
    }
  }
  function zorder(id, dir) {
    var pid = SP.editor.pid;
    E.commit(dir > 0 ? 'Bring to front' : 'Send to back', function (st) {
      st.pages.forEach(function (p) { if (p.id !== pid) return; var a = p.annots.filter(function (x) { return x.id === id; })[0]; if (!a) return; p.annots = p.annots.filter(function (x) { return x.id !== id; }); if (dir > 0) p.annots.push(a); else p.annots.unshift(a); });
    });
  }
  function toggle(label, title, on, onChange, cls) {
    var b = h('button', { type: 'button', class: 'tog ' + (cls || '') + (on ? ' on' : ''), title: title, 'aria-pressed': on ? 'true' : 'false' }, label);
    b.addEventListener('click', function () { on = !on; b.classList.toggle('on', on); b.setAttribute('aria-pressed', on ? 'true' : 'false'); onChange(on); });
    return b;
  }

  /* -------------------------------------------------------------- sign */
  PANELS.sign = {
    title: 'Sign', icon: 'sign', build: function (b) {
      var np = needPages(); if (np) { b.appendChild(np); return; }
      b.appendChild(section(null, [note('Draw your signature or type it in a handwriting font, then drag it into place on the page. Saved signatures stay in this browser only.'),
        h('div', { class: 'btn-row' }, btn('Create signature…', 'sign', function () { SP.app.ensurePage(); SP.editor.setTool('signature'); }, 'primary wide'))]));
      var list = h('div', { class: 'sig-list' });
      b.appendChild(section('Saved signatures', [list]));
      function paint() {
        list.innerHTML = '';
        var saved = SP.sign.saved();
        if (!saved.length) { list.appendChild(note('None yet.')); return; }
        saved.forEach(function (sig) {
          list.appendChild(h('button', { type: 'button', class: 'sig-item', title: 'Place on the current page', onclick: function () { SP.app.ensurePage(); SP.editor.placeImage(SP.sign.toAsset(sig), 'Add signature'); } }, h('img', { src: sig.url, alt: 'Saved signature' })));
        });
        list.appendChild(h('div', { class: 'btn-row' }, btn('Clear saved signatures', 'trash', function () {
          SlopUI.confirm('Clear saved signatures', 'Remove every signature saved in this browser? Signatures already placed on pages stay.', 'Clear', { danger: true }).then(function (ok) { if (ok) { SP.sign.clear(); paint(); SlopUI.toast('Saved signatures cleared'); } });
        }, 'danger-text')));
      }
      paint();
      b.appendChild(section('Tips', [note('After placing, drag the corners to resize (the aspect ratio is kept). Use the Edit page tool for text like the date next to it.')]));
    }
  };

  /* ------------------------------------------------------ page numbers */
  PANELS.numbers = {
    title: 'Page numbers', icon: 'numbers', build: function (b) {
      var np = needPages(); if (np) { b.appendChild(np); return; }
      var cur = E.state.stamps.pageNumbers;
      var o = Object.assign({ position: 'bottom-center', format: 'n', start: 1, size: 11, font: 'Helvetica', bold: false, color: '#111111', margin: 28, skipFirst: false }, cur || U.store.get('pnOpts', {}));
      function apply(label) { U.store.set('pnOpts', o); if (E.state.stamps.pageNumbers) E.commit(label || 'Page numbers', function (st) { st.stamps.pageNumbers = Object.assign({}, o); }, 'pn'); }
      var posGrid = h('div', { class: 'pos-grid', role: 'radiogroup', 'aria-label': 'Position' });
      ['top-left', 'top-center', 'top-right', 'bottom-left', 'bottom-center', 'bottom-right'].forEach(function (p) {
        var bt = h('button', { type: 'button', class: 'pos-b' + (o.position === p ? ' on' : ''), role: 'radio', 'aria-checked': o.position === p ? 'true' : 'false', 'aria-label': p.replace('-', ' '), title: p.replace('-', ' ') }, h('i'));
        bt.addEventListener('click', function () { o.position = p; U.$$('.pos-b', posGrid).forEach(function (x) { x.classList.toggle('on', x === bt); x.setAttribute('aria-checked', x === bt ? 'true' : 'false'); }); apply(); });
        posGrid.appendChild(bt);
      });
      b.appendChild(section('Position', [posGrid]));
      b.appendChild(section('Format', [
        row('Style', select([['n', '1'], ['page', 'Page 1'], ['n-of', '1 / N'], ['page-of', 'Page 1 of N'], ['dash', '– 1 –']], o.format, function (v) { o.format = v; apply(); })),
        row('Start at', num(o.start, 0, 99999, 1, function (v) { o.start = Math.round(v); apply(); })),
        row('Size', num(o.size, 5, 72, 1, function (v) { o.size = v; apply(); }), 'pt'),
        row('Font', select([['Helvetica', 'Helvetica'], ['Times', 'Times'], ['Courier', 'Courier']], o.font, function (v) { o.font = v; apply(); })),
        row('Margin', num(o.margin, 4, 144, 1, function (v) { o.margin = v; apply(); }), 'pt'),
        row('Colour', colorPicker(o.color, function (v) { o.color = v; apply(); })),
        check('Bold', o.bold, function (v) { o.bold = v; apply(); }),
        check('Skip the first page (cover)', o.skipFirst, function (v) { o.skipFirst = v; apply(); })]));
      var acts = h('div', { class: 'btn-row' });
      b.appendChild(section(null, [acts, note('Numbers follow the final page order and each page’s rotation, and are drawn into the PDF on download.')]));
      onRefresh(function () {
        acts.innerHTML = '';
        if (E.state.stamps.pageNumbers) acts.append(btn('Remove page numbers', 'trash', function () { E.commit('Remove page numbers', function (st) { st.stamps.pageNumbers = null; }); }, 'danger-text'));
        else acts.append(btn('Add page numbers', 'numbers', function () { U.store.set('pnOpts', o); E.commit('Add page numbers', function (st) { st.stamps.pageNumbers = Object.assign({}, o); }); }, 'primary wide'));
      });
    }
  };

  /* --------------------------------------------------------- watermark */
  PANELS.watermark = {
    title: 'Watermark', icon: 'watermark', build: function (b) {
      var np = needPages(); if (np) { b.appendChild(np); return; }
      var o = Object.assign({ text: 'CONFIDENTIAL', size: 60, color: '#ff3b6b', opacity: 0.25, angle: 45, font: 'Helvetica', bold: true }, E.state.stamps.watermark || U.store.get('wmOpts', {}));
      function apply() { U.store.set('wmOpts', o); if (E.state.stamps.watermark) E.commit('Watermark', function (st) { st.stamps.watermark = Object.assign({}, o); }, 'wm'); }
      b.appendChild(section('Text', [
        text(o.text, function (v) { o.text = v; apply(); }, 'Watermark text'),
        row('Font', select([['Helvetica', 'Helvetica'], ['Times', 'Times'], ['Courier', 'Courier']], o.font, function (v) { o.font = v; apply(); })),
        check('Bold', o.bold, function (v) { o.bold = v; apply(); }),
        row('Size', slider(o.size, 12, 200, 1, function (v) { o.size = v; apply(); }, function (v) { return v + ' pt'; })),
        row('Opacity', slider(Math.round(o.opacity * 100), 5, 100, 1, function (v) { o.opacity = v / 100; apply(); }, function (v) { return v + '%'; })),
        row('Rotation', slider(o.angle, -90, 90, 1, function (v) { o.angle = v; apply(); }, function (v) { return v + '°'; })),
        row('Colour', colorPicker(o.color, function (v) { o.color = v; apply(); }))]));
      var acts = h('div', { class: 'btn-row' });
      b.appendChild(section(null, [acts, note('The watermark is drawn centred on every page, on top of the content.')]));
      onRefresh(function () {
        acts.innerHTML = '';
        if (E.state.stamps.watermark) acts.append(btn('Remove watermark', 'trash', function () { E.commit('Remove watermark', function (st) { st.stamps.watermark = null; }); }, 'danger-text'));
        else acts.append(btn('Add watermark', 'watermark', function () { if (!o.text.trim()) { SlopUI.toast('Type the watermark text first.'); return; } U.store.set('wmOpts', o); E.commit('Add watermark', function (st) { st.stamps.watermark = Object.assign({}, o); }); }, 'primary wide'));
      });
    }
  };

  /* -------------------------------------------------------------- forms */
  PANELS.forms = {
    title: 'Fill forms', icon: 'forms', build: function (b) {
      var np = needPages(); if (np) { b.appendChild(np); return; }
      var list = h('div', { class: 'form-list' }, note('Looking for form fields…'));
      b.appendChild(list);
      var flatten = check('Flatten forms on download (fields become plain page content)', E.state.flattenForms, function (v) { E.commit(v ? 'Flatten forms' : 'Keep forms editable', function (st) { st.flattenForms = v; }); });
      b.appendChild(section('Output', [flatten, h('div', { class: 'btn-row' }, btn('Reset values', 'undo', function () { E.commit('Reset form values', function (st) { st.forms = {}; }); P.rebuild(); }))]));
      (async function () {
        var used = new Set(E.state.pages.map(function (p) { return p.f; })), any = false;
        list.innerHTML = '';
        for (var f of E.files.values()) {
          if (!used.has(f.id)) continue;
          var fields = await E.loadFields(f);
          if (!fields.length) continue;
          any = true;
          list.appendChild(section(null, [h('div', { class: 'form-file' }, h('span', { class: 'fdot', style: { '--fc': f.color } }), h('b', null, f.name), h('span', { class: 'fi-meta' }, fields.length + ' fields'))].concat(fields.map(function (fld) { return fieldRow(f, fld); }))));
        }
        if (!any) list.appendChild(section(null, [note('None of the open PDFs has fillable form fields (AcroForm). The sample’s last page has some — or use the Edit page tool to type onto any page.')]));
      })();
    }
  };
  function fieldRow(f, fld) {
    var vals = E.state.forms[f.id] || {}, has = Object.prototype.hasOwnProperty.call(vals, fld.name), v = has ? vals[fld.name] : fld.value;
    function set(val) { E.commit('Fill “' + fld.name + '”', function (st) { st.forms[f.id] = Object.assign({}, st.forms[f.id] || {}); st.forms[f.id][fld.name] = val; }, 'form:' + f.id + ':' + fld.name); }
    var ctrl, label = fld.name.split('.').pop();
    if (fld.type === 'checkbox') ctrl = check(label, !!v, set);
    else if (fld.type === 'radiobutton') ctrl = row(label, select([['', '—']].concat(fld.options.map(function (o) { return [o, o]; })), v || '', set));
    else if (fld.type === 'combobox' || fld.type === 'listbox') ctrl = row(label, select([['', '—']].concat(fld.options.map(function (o) { return [o[0], o[1] || o[0]]; })), v || '', set));
    else {
      var inp = fld.multiline ? h('textarea', { class: 'inp', rows: 3 }) : h('input', { class: 'inp', type: 'text' });
      inp.value = v == null ? '' : v;
      inp.addEventListener('input', function () { set(inp.value); });
      ctrl = row(label, inp);
    }
    var wrap = h('div', { class: 'form-field' + (fld.readOnly ? ' ro' : '') }, ctrl, h('span', { class: 'ff-page' }, 'p' + ((fld.page || 0) + 1)));
    wrap.title = fld.name;
    return wrap;
  }

  /* ----------------------------------------------------------- compress */
  PANELS.compress = {
    title: 'Compress', icon: 'compress', build: function (b) {
      var np = needPages(); if (np) { b.appendChild(np); return; }
      var o = { mode: 'lossless', dpi: 110, quality: 0.65 };
      var lossy = h('div', { hidden: true },
        row('Resolution', slider(o.dpi, 50, 200, 5, function (v) { o.dpi = v; }, function (v) { return v + ' dpi'; })),
        row('JPEG quality', slider(Math.round(o.quality * 100), 20, 95, 5, function (v) { o.quality = v / 100; }, function (v) { return v + '%'; })),
        note('Lossy: every page becomes a JPEG picture. Text is no longer selectable or searchable, and forms and links are lost. Best for scans and photo-heavy files.', 'warn'));
      b.appendChild(section('Mode', [seg([['lossless', 'Lossless'], ['lossy', 'Strong (lossy)']], o.mode, function (v) { o.mode = v; lossy.hidden = v !== 'lossy'; }, 'Compression mode'),
        note('Lossless re-saves with compressed object streams and drops unused objects. Text and vectors stay intact.'), lossy]));
      var result = h('div', { class: 'result' });
      b.appendChild(section(null, [h('div', { class: 'btn-row' }, btn('Compress & download', 'compress', function () { SP.app.compress(o, result); }, 'primary wide')), result]));
    }
  };

  /* ------------------------------------------------------------ convert */
  PANELS.convert = {
    title: 'Convert', icon: 'convert', build: function (b) {
      var o = { format: 'png', dpi: 150, quality: 0.9, which: 'all' };
      if (E.state.pages.length) {
        b.appendChild(section('PDF pages → images', [
          row('Format', seg([['png', 'PNG'], ['jpeg', 'JPEG']], o.format, function (v) { o.format = v; }, 'Image format')),
          row('Resolution', select([['72', '72 dpi (screen)'], ['150', '150 dpi'], ['300', '300 dpi (print)'], ['600', '600 dpi']], o.dpi, function (v) { o.dpi = +v; })),
          row('JPEG quality', slider(90, 30, 100, 5, function (v) { o.quality = v / 100; }, function (v) { return v + '%'; })),
          row('Pages', seg([['all', 'All'], ['sel', 'Selected']], o.which, function (v) { o.which = v; }, 'Which pages')),
          h('div', { class: 'btn-row' }, btn('Download images', 'image', function () { SP.app.toImages(o); }, 'primary wide')),
          note('Several pages download as one .zip file.')]));
      }
      var io = { size: 'a4', margin: 24, orientation: 'auto', add: E.state.pages.length > 0 };
      b.appendChild(section('Images → PDF', [
        row('Page size', select([['fit', 'Fit each image'], ['a4', 'A4'], ['letter', 'US Letter']], io.size, function (v) { io.size = v; })),
        row('Orientation', select([['auto', 'Auto (match image)'], ['portrait', 'Portrait'], ['landscape', 'Landscape']], io.orientation, function (v) { io.orientation = v; })),
        row('Margin', select([['0', 'None'], ['24', 'Small'], ['48', 'Large']], io.margin, function (v) { io.margin = +v; })),
        h('div', { class: 'btn-row' }, btn('Choose images…', 'image', function () { SP.app.imagesToPdf(io); }, 'primary wide')),
        check('Add the pages to the open document (otherwise download a new PDF)', io.add, function (v) { io.add = v; }),
        note('PNG, JPEG, WebP or GIF. Phone photos are turned upright automatically.')]));
      if (E.state.pages.length) {
        b.appendChild(section('PDF → text', [note('Extracts the text layer of the final document (scans without OCR have none).'),
          h('div', { class: 'btn-row' }, btn('Extract text', 'textfile', function () { SP.app.extractText(); }, 'wide'))]));
      }
    }
  };

  /* -------------------------------------------------------------- split */
  P.split = { mode: 'ranges', ranges: '1-2, 3-', every: 2, output: 'zip' };
  PANELS.split = {
    title: 'Split', icon: 'split', build: function (b) {
      var np = needPages(); if (np) { b.appendChild(np); return; }
      var o = P.split, rangeIn, everyIn, preview = h('div', { class: 'split-preview' });
      var rangesBox = h('div', null, row('Ranges', (rangeIn = text(o.ranges, function (v) { o.ranges = v; upd(); }, 'e.g. 1-3, 5, 8-'))), note('Each comma-separated range becomes its own PDF. “8-” means page 8 to the end.'));
      var everyBox = h('div', { hidden: true }, row('Pages per file', (everyIn = num(o.every, 1, 9999, 1, function (v) { o.every = Math.max(1, Math.round(v)); upd(); }))));
      function modeVis() { rangesBox.hidden = o.mode !== 'ranges'; everyBox.hidden = o.mode !== 'every'; }
      b.appendChild(section('Split by', [seg([['ranges', 'Page ranges'], ['every', 'Every N pages'], ['each', 'Each page']], o.mode, function (v) { o.mode = v; modeVis(); upd(); }, 'Split mode'), rangesBox, everyBox]));
      b.appendChild(section('Result', [preview]));
      b.appendChild(section('Download as', [seg([['zip', 'One .zip'], ['files', 'Separate PDFs']], o.output, function (v) { o.output = v; }, 'Output'),
        h('div', { class: 'btn-row' }, btn('Split & download', 'split', function () { SP.app.split(); }, 'primary wide'))]));
      function upd() {
        preview.innerHTML = '';
        var groups;
        try { groups = P.splitGroups(); rangeIn.classList.remove('bad'); } catch (e) { rangeIn.classList.add('bad'); preview.appendChild(note(e.message, 'err')); SP.organizer.render(); return; }
        preview.appendChild(note(groups.length + ' file' + (groups.length === 1 ? '' : 's') + ':'));
        var ul = h('ol', { class: 'split-list' });
        groups.slice(0, 50).forEach(function (g, i) { ul.appendChild(h('li', null, h('b', null, 'Part ' + (i + 1)), ' — pages ' + U.describeIdx(g) + ' (' + g.length + ')')); });
        if (groups.length > 50) ul.appendChild(h('li', null, '…and ' + (groups.length - 50) + ' more'));
        preview.appendChild(ul);
        SP.organizer.render();
      }
      modeVis(); upd();
      void everyIn;
    }
  };
  /** Groups of page indices for the current split settings. */
  P.splitGroups = function () {
    var o = P.split, n = E.state.pages.length;
    if (o.mode === 'each') return E.state.pages.map(function (_, i) { return [i]; });
    if (o.mode === 'every') { var out = []; for (var i = 0; i < n; i += o.every) { var g = []; for (var j = i; j < Math.min(n, i + o.every); j++) g.push(j); out.push(g); } return out; }
    return U.parseRanges(o.ranges, n);
  };

  /* ----------------------------------------------------------- metadata */
  PANELS.metadata = {
    title: 'Metadata', icon: 'info', build: function (b) {
      var np = needPages(); if (np) { b.appendChild(np); return; }
      var m = E.state.meta;
      function field(k, label, ph) {
        return row(label, text(m[k], function (v) { E.commit('Edit ' + label.toLowerCase(), function (st) { st.meta[k] = v; }, 'meta:' + k); }, ph));
      }
      b.appendChild(section('Document properties', [field('title', 'Title', 'Shown in the viewer’s title bar'), field('author', 'Author', ''), field('subject', 'Subject', ''), field('keywords', 'Keywords', 'comma, separated')]));
      b.appendChild(section(null, [note('Saved into the PDF’s document information when you download. Producer is set to “Slop PDF”.')]));
    }
  };
  P.PANELS = PANELS;
})();
