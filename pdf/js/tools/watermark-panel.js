/* Slop PDF — Watermark panel: layers stacked bottom to top (text or logo). Each layer has a position (a 3 by 3 anchor
   plus an offset), a size, an opacity, a rotation, a colour (text) and the pages it covers. Every add, remove, move and
   change is one undo step (E.commit). The layer maths is core/watermark.js; drawing is core/watermark-annots.js. */
(function () {
  'use strict';
  var SP = window.SP, U = SP.util, E = SP.engine, Ed = SP.editor, h = U.h, P = SP.panels, PANELS = P.PANELS, K = P.helpers;
  var WM = window.SlopPdfWm;
  var section = K.section, row = K.row, btn = K.btn, seg = K.seg, select = K.select, num = K.num, text = K.text, slider = K.slider,
    colorPicker = K.colorPicker, check = K.check, note = K.note, needPages = K.needPages, onRefresh = K.onRefresh;
  var selId = null, editorKey = null;
  var IMG = 'image/png,image/jpeg,image/webp,image/gif';

  function list() { return WM.fromStamps(E.state.stamps); }
  /** One undoable change to the layer list (coalesce: repeated edits of one field become one step). */
  function setList(label, next, coalesce) {
    E.commit(label, function (st) { st.stamps.watermarks = next; delete st.stamps.watermark; }, coalesce || null);
  }
  function current() { var id = selId; return list().filter(function (x) { return x.id === id; })[0] || null; }
  function patch(label, p, field) {
    var L = current(); if (!L) return;
    setList(label, WM.update(list(), L.id, p), field ? 'wm:' + L.id + ':' + field : null);
  }
  function curIndex() { var i = Ed.pid ? E.indexOf(Ed.pid) : 0; return i < 0 ? 0 : i; }
  /** Stores an image file as an asset (kept with the document) and returns it. */
  function storeLogo(file) {
    return U.readFile(file).then(function (bytes) { return E.prepareImage(bytes); }).then(function (im) {
      return E.addAsset({ mime: im.mime, url: U.bytesToDataURL(im.bytes, im.mime), w: im.w, h: im.h, name: file.name });
    });
  }
  /** Adds a logo layer on top, from a picked or dropped image file. */
  function addLogo(file) {
    return storeLogo(file).then(function (asset) {
      var L = WM.defaults('image'); L.asset = asset.id;
      selId = L.id;
      setList('Add logo', WM.add(list(), L));
    }, function () { SlopUI.alert('Logo not added', 'That image could not be read. Use a PNG, JPEG, WebP or GIF.'); });
  }
  /** The logo comes in through the intake (shared/intake), a part of its own: picked (Logo…, Change) or dropped on the
   *  panel. A dropped file that is not a picture goes to the app's own intake ('pdf'), like a drop on the page. */
  var logoSpec = false;
  function registerLogo() {
    if (logoSpec) return;
    logoSpec = true;
    SlopIntake.register({
      id: 'pdf.logo', main: false, paste: false, limit: 1, toast: false,
      accept: { any: true }, pickAccept: IMG, // any file is taken here; route keeps the pictures
      route: function (files) {
        var img = files.filter(function (f) { return IMG.split(',').indexOf(f.type) >= 0; });
        var rest = files.filter(function (f) { return img.indexOf(f) < 0; });
        if (rest.length) SlopIntake.take(rest, { to: 'pdf', source: 'drop' });
        return img;
      },
      process: function (file, ctx) {
        if (!(ctx.data && ctx.data.change)) return addLogo(file);
        return storeLogo(file).then(function (asset) { patch('Change logo', { asset: asset.id }); },
          function () { SlopUI.toast('That image could not be read.'); });
      },
    });
  }
  function pickLogo(change) { registerLogo(); return SlopIntake.pick({ to: 'pdf.logo', multiple: false, data: { change: !!change } }); }

  /** The fields of the selected layer. Rebuilt only when the selection or history changes (keeps focus while typing). */
  function editor(L) {
    var box = h('div', { class: 'wm-editor' });
    var isImg = L.kind === 'image', asset = isImg ? E.assets.get(L.asset) : null;
    box.appendChild(row('Layer type', seg([['text', 'Text'], ['image', 'Logo']], L.kind, function (v) { patch('Change layer type', { kind: v }); }, 'Layer type')));
    if (!isImg) {
      box.appendChild(section('Text', [
        text(L.text, function (v) { patch('Edit watermark text', { text: v }, 'text'); }, 'Watermark text'),
        row('Font', select([['Helvetica', 'Helvetica'], ['Times', 'Times'], ['Courier', 'Courier']], L.font, function (v) { patch('Change font', { font: v }); })),
        check('Bold', L.bold, function (v) { patch('Change bold', { bold: v }); }),
        row('Colour', colorPicker(L.colour, function (v) { patch('Change colour', { colour: v }, 'colour'); }))
      ]));
    } else {
      box.appendChild(section('Logo', [
        note(asset ? (asset.name || 'Logo') + ' · ' + asset.w + '×' + asset.h + ' px' : 'The logo is missing. Choose an image.'),
        h('div', { class: 'btn-row' }, btn(asset ? 'Change logo…' : 'Choose logo…', 'image', function () { pickLogo(true); }))
      ]));
    }
    box.appendChild(section('Size and look', [
      row(isImg ? 'Width' : 'Size', slider(L.size, isImg ? 10 : 6, isImg ? 800 : 200, 1, function (v) { patch('Change size', { size: v }, 'size'); }, function (v) { return v + ' pt'; })),
      row('Opacity', slider(Math.round(L.opacity * 100), 0, 100, 1, function (v) { patch('Change opacity', { opacity: v / 100 }, 'opacity'); }, function (v) { return v + '%'; })),
      row('Rotation', slider(L.rot, -180, 180, 1, function (v) { patch('Change rotation', { rot: v }, 'rot'); }, function (v) { return v + '°'; }))
    ]));
    var grid = h('div', { class: 'pos-grid wm-anchor', role: 'radiogroup', 'aria-label': 'Anchor on the page' });
    WM.ANCHORS.forEach(function (a) {
      var on = L.anchor === a, bt = h('button', { type: 'button', class: 'pos-b' + (on ? ' on' : ''), role: 'radio', 'aria-checked': on ? 'true' : 'false', 'aria-label': WM.ANCHOR_LABELS[a], title: WM.ANCHOR_LABELS[a] }, h('i'));
      bt.addEventListener('click', function () { patch('Move layer', { anchor: a }); });
      grid.appendChild(bt);
    });
    box.appendChild(section('Position', [grid,
      row('Offset across', num(L.dx, -2000, 2000, 1, function (v) { patch('Move layer', { dx: Math.round(v) }, 'dx'); }), 'pt, + to the right'),
      row('Offset down', num(L.dy, -2000, 2000, 1, function (v) { patch('Move layer', { dy: Math.round(v) }, 'dy'); }), 'pt, + downwards')]));
    box.appendChild(pagesSection(L));
    return box;
  }
  /** Which pages the layer covers: all, the page in view, or a range (checked before it is saved). */
  function pagesSection(L) {
    var cur = String(curIndex() + 1), trimmed = String(L.pages || '').trim();
    var mode = !trimmed ? 'all' : trimmed === cur ? 'current' : 'range';
    var errNote = note('Use page numbers such as 2 or 1-3, or the words all, odd, even, last.', 'warn');
    errNote.hidden = true;
    var rangeIn = text(mode === 'range' ? L.pages : '', function (v) {
      var bad = false; try { WM.parsePages(v, E.state.pages.length); } catch (e) { bad = true; }
      rangeIn.classList.toggle('bad', bad); errNote.hidden = !bad;
      if (!bad) patch('Change pages', { pages: v.trim() }, 'pages');
    }, 'e.g. 1-3, 5, last');
    rangeIn.setAttribute('aria-label', 'Page range');
    rangeIn.hidden = mode !== 'range';
    var s = seg([['all', 'All pages'], ['current', 'Current page'], ['range', 'Pages…']], mode, function (v) {
      rangeIn.hidden = v !== 'range';
      if (v === 'all') patch('Apply to all pages', { pages: '' });
      else if (v === 'current') patch('Apply to current page', { pages: cur });
      else rangeIn.focus();
    }, 'Apply to');
    return section('Apply to', [s, rangeIn, errNote]);
  }
  /** Stack actions for the selected layer: move, duplicate, remove. Moves are disabled at the ends of the stack. */
  function stackButtons(L, all) {
    var i = WM.indexOf(all, L.id), up = btn('Move up', 'plus', function () { setList('Move layer up', WM.move(all, L.id, 1)); }),
      down = btn('Move down', 'reverse', function () { setList('Move layer down', WM.move(all, L.id, -1)); });
    up.disabled = i >= all.length - 1; down.disabled = i <= 0;
    up.title = 'Move the layer up the stack (drawn later, over the others)'; down.title = 'Move the layer down the stack';
    return h('div', { class: 'btn-grid wm-stack' }, up, down,
      btn('Duplicate', 'copy', function () { var copy = WM.duplicate(all, L.id); selId = copy[i + 1].id; setList('Duplicate layer', copy); }),
      btn('Remove', 'trash', function () { SlopUI.confirm('Remove watermark', 'Remove this watermark layer? Undo brings it back.', 'Remove', { danger: true }).then(function (ok) { if (ok) { selId = null; setList('Remove layer', WM.remove(all, L.id)); } }); }, 'danger-text'));
  }

  PANELS.watermark = {
    title: 'Watermark', icon: 'watermark', build: function (b) {
      var np = needPages(); if (np) { b.appendChild(np); return; }
      var head = h('div', { class: 'btn-row' },
        btn('Text layer', 'plus', function () { var L = WM.defaults('text'); selId = L.id; setList('Add text layer', WM.add(list(), L)); }, 'primary'),
        btn('Logo…', 'image', function () { pickLogo(false); }));
      var listBox = h('ol', { class: 'wm-list', 'aria-label': 'Layers, top first' });
      var editBox = h('div');
      var hint = note('Layers stack like sheets: the top layer is drawn last, over the others. Drop a PNG, JPEG, WebP or GIF here to add it as a logo.');
      var root = h('div', { class: 'wm-drop' }, section('Layers', [head, listBox, hint]), editBox);
      b.appendChild(root);
      registerLogo();
      SlopIntake.dropTarget(root, { to: 'pdf.logo' }); // a picture is the logo; any other file goes to the app's intake
      onRefresh(function (reason) {
        var all = list();
        if (selId && !WM.get(all, selId)) selId = null;
        listBox.innerHTML = '';
        if (!all.length) listBox.appendChild(h('li', { class: 'wm-empty' }, 'No layers yet. Add a text layer or a logo.'));
        all.slice().reverse().forEach(function (L) {
          var on = L.id === selId, asset = L.kind === 'image' ? E.assets.get(L.asset) : null, label = WM.label(L, asset && asset.name);
          var cb = h('input', { type: 'checkbox', checked: L.show, 'aria-label': 'Show layer' });
          cb.addEventListener('change', function () { selId = L.id; patch(cb.checked ? 'Show layer' : 'Hide layer', { show: cb.checked }); });
          var name = h('button', { type: 'button', class: 'wm-item' + (on ? ' on' : ''), 'aria-pressed': on ? 'true' : 'false', title: label }, label);
          name.addEventListener('click', function () { selId = L.id; P.refresh('sel'); });
          listBox.appendChild(h('li', { class: 'wm-row' + (L.show ? '' : ' hidden-layer') }, cb, name,
            h('span', { class: 'wm-meta' }, (L.kind === 'image' ? 'logo' : 'text') + (L.pages ? ' · ' + L.pages : ''))));
        });
        var L = current(), key = L ? L.id : 'none';
        if (key !== editorKey || reason === 'history' || reason === 'sel') {
          editorKey = key;
          editBox.innerHTML = '';
          if (!L) editBox.appendChild(section(null, [note('Select a layer to change it, or add one above.')]));
          else editBox.appendChild(section('Selected layer', [editor(L), stackButtons(L, all)]));
        }
      });
    }
  };
})();
