/* Slop PDF — app shell: boot, top bar menus, tool rail, file opening (drag & drop, picker,
   passwords), organizer/page-view modes, downloads, split/extract/convert/compress actions,
   keyboard shortcuts, themes, IndexedDB autosave and the offline single-file download. */
(function () {
  'use strict';
  var SP = window.SP, U = SP.util, E = SP.engine, O = SP.organizer, Ed = SP.editor, PN = SP.panels;
  var A = SP.app = {};
  A.tool = 'organize'; A.mode = 'grid';
  A.insertOpts = { size: 'a4', orient: 'portrait', where: 'after' };
  var $ = U.$, h = U.h, els = {}, fileNameTouched = false, savedSession = null;
  var RAIL = [['organize', 'Organize', 'organize'], ['edit', 'Edit page', 'edit'], ['sign', 'Sign', 'sign'], ['numbers', 'Page numbers', 'numbers'], ['watermark', 'Watermark', 'watermark'],
    ['forms', 'Forms', 'forms'], ['compress', 'Compress', 'compress'], ['convert', 'Convert', 'convert'], ['split', 'Split', 'split'], ['metadata', 'Metadata', 'info']];
  var THEMES = [['pro', 'Pro (dark)'], ['light', 'Light'], ['classic', 'Classic 98']];

  /* ---------------------------------------------------------------- boot */
  A.boot = function () {
    ['app', 'rail', 'stage', 'grid', 'viewer', 'empty', 'props', 'ctxGrid', 'ctxPage', 'status', 'fileName', 'btnDownload', 'btnUndo', 'btnRedo', 'menus', 'btnMore', 'btnPanel', 'live', 'busy', 'dropOverlay', 'restore', 'gridWrap']
      .forEach(function (id) { els[id] = document.getElementById(id); });
    buildRail(); buildMenus(); buildCtxBars();
    O.init(els.grid, els.gridWrap);
    Ed.init(els.viewer);
    PN.init(els.props);
    E.on('change', onChange);
    E.on('files', function () { PN.refresh('files'); });
    els.btnDownload.addEventListener('click', function () { A.download(); });
    els.btnUndo.addEventListener('click', function () { A.undo(); });
    els.btnRedo.addEventListener('click', function () { A.redo(); });
    els.btnPanel.addEventListener('click', function () { A.togglePanel(); });
    els.fileName.addEventListener('input', function () { fileNameTouched = true; });
    els.fileName.addEventListener('change', function () { els.fileName.value = U.safeName(els.fileName.value, 'pdf'); });
    $('#emptyOpen').addEventListener('click', function () { A.openDialog(); });
    $('#emptySample').addEventListener('click', function () { A.loadSample(); });
    els.restore.addEventListener('click', function () { A.restoreSession(); });
    setupDrop(); setupKeys();
    A.setTheme(document.documentElement.getAttribute('data-theme') || 'pro', true);
    A.setTool('organize');
    refreshAll();
    E.initFonts().catch(function (e) { console.warn(e); });
    // warm up pdf.js so the first open is snappy
    E.pdfjs().catch(function (e) { A.status('Could not load the PDF engine: ' + e.message, 'err'); });
    if (U.store.get('autosave', true)) U.idb.get('session').then(function (s) {
      if (s && s.state && s.state.pages && s.state.pages.length && !E.state.pages.length) {
        savedSession = s;
        els.restore.hidden = false;
        els.restore.querySelector('span').textContent = 'Restore last session (' + s.files.length + ' file' + (s.files.length === 1 ? '' : 's') + ', ' + s.state.pages.length + ' pages)';
      }
    });
    if (SP.offline) document.documentElement.classList.add('is-offline');
    document.documentElement.classList.add('ready');
  };

  /* ---------------------------------------------------------------- rail */
  function buildRail() {
    RAIL.forEach(function (t) {
      var b = h('button', { type: 'button', class: 'rail-b', role: 'tab', 'data-tool': t[0], 'aria-selected': 'false', title: t[1], html: U.icon(t[2]) + '<span>' + t[1] + '</span>' });
      b.addEventListener('click', function () { A.setTool(t[0]); if (window.innerWidth <= 900) A.togglePanel(true); });
      els.rail.appendChild(b);
    });
  }
  A.setTool = function (t) {
    if (Ed.isEditingText()) Ed.commitText();
    A.tool = t;
    U.$$('.rail-b', els.rail).forEach(function (b) { var on = b.dataset.tool === t; b.classList.toggle('on', on); b.setAttribute('aria-selected', on ? 'true' : 'false'); });
    if (t === 'edit' || t === 'sign') { if (E.state.pages.length) A.ensurePage(); }
    else if (A.mode === 'page') A.showGrid(true);
    PN.show(t);
    O.render();
    updateChrome();
  };
  A.ensurePage = function () {
    if (A.mode === 'page' && Ed.page()) return;
    var ids = O.selected(), id = ids[0] || O.focusId || (E.state.pages[0] && E.state.pages[0].id);
    if (id && E.pageById(id)) A.openPage(id, true);
  };
  A.openPage = function (id, keepTool) {
    if (!E.pageById(id)) return;
    A.mode = 'page';
    els.app.dataset.mode = 'page';
    if (!keepTool && A.tool !== 'edit' && A.tool !== 'sign') { A.tool = 'edit'; U.$$('.rail-b', els.rail).forEach(function (b) { b.classList.toggle('on', b.dataset.tool === 'edit'); b.setAttribute('aria-selected', b.dataset.tool === 'edit' ? 'true' : 'false'); }); PN.show('edit'); }
    Ed.zoomMode = Ed.zoomMode === 'num' ? 'fit' : Ed.zoomMode;
    Ed.show(id);
    O.setSelection([id], id);
    updateChrome();
  };
  A.showGrid = function (fromTool) {
    if (Ed.isEditingText()) Ed.commitText();
    var id = Ed.pid;
    A.mode = 'grid'; els.app.dataset.mode = 'grid';
    Ed.hide();
    if (!fromTool && (A.tool === 'edit' || A.tool === 'sign')) { A.tool = 'organize'; A.setTool('organize'); }
    updateChrome();
    if (id) setTimeout(function () { O.reveal(id); O.focus(id, false); }, 0);
  };
  A.gotoPage = function (delta) {
    var i = E.indexOf(Ed.pid), j = U.clamp(i + delta, 0, E.state.pages.length - 1);
    if (j !== i) { Ed.show(E.state.pages[j].id); O.setSelection([E.state.pages[j].id], E.state.pages[j].id); updateChrome(); PN.refresh(); }
  };

  /* ------------------------------------------------------------ ctx bars */
  function ib(icon, label, fn, extra) {
    var b = h('button', Object.assign({ type: 'button', class: 'tb', title: label, 'aria-label': label, html: U.icon(icon) }, extra || {}));
    b.addEventListener('click', fn);
    return b;
  }
  function ibl(icon, label, fn, short) {
    var b = h('button', { type: 'button', class: 'tb tb-l', title: label, html: U.icon(icon) + '<span>' + (short || label) + '</span>' });
    b.addEventListener('click', fn);
    return b;
  }
  function sep() { return h('span', { class: 'tb-sep', 'aria-hidden': 'true' }); }
  function buildCtxBars() {
    var g = els.ctxGrid;
    var sizeSeg = h('div', { class: 'seg seg-sm', role: 'radiogroup', 'aria-label': 'Thumbnail size' });
    [[128, 'S'], [168, 'M'], [228, 'L']].forEach(function (s) {
      var b = h('button', { type: 'button', class: 'seg-b' + (O.getSize() === s[0] ? ' on' : ''), role: 'radio', 'aria-label': 'Thumbnail size ' + s[1], 'aria-checked': O.getSize() === s[0] ? 'true' : 'false' }, s[1]);
      b.addEventListener('click', function () { O.setSize(s[0]); U.$$('.seg-b', sizeSeg).forEach(function (x) { x.classList.toggle('on', x === b); x.setAttribute('aria-checked', x === b ? 'true' : 'false'); }); });
      sizeSeg.appendChild(b);
    });
    g.append(
      ibl('selectall', 'Select all', function () { if (O.sel.size === E.state.pages.length) O.setSelection([]); else O.selectAll(); }, 'All'), sep(),
      ib('rotl', 'Rotate left', function () { A.rotate(A.targetIds(), -90); }),
      ib('rotr', 'Rotate right', function () { A.rotate(A.targetIds(), 90); }),
      ib('copy', 'Duplicate', function () { A.duplicate(A.targetIds()); }),
      ib('trash', 'Delete', function () { A.remove(A.targetIds()); }), sep(),
      ibl('extract', 'Extract selected pages to a new PDF', function () { A.extract(); }, 'Extract'),
      ibl('blank', 'Insert blank page', function () { A.insertBlank(); }, 'Blank'),
      ibl('insert', 'Insert pages from a file', function () { A.insertFromFile(); }, 'Insert'),
      ib('reverse', 'Reverse order', function () { A.reverse(); }),
      ib('eye', 'Open page view (Enter)', function () { A.ensurePage(); }),
      h('span', { class: 'tb-flex' }), sizeSeg);
    var p = els.ctxPage;
    var pageNo = h('span', { class: 'pv-num', id: 'pvNum' }, '');
    var zoomLbl = h('button', { type: 'button', class: 'tb tb-zoom', id: 'zoomLbl', title: 'Zoom presets' }, '100%');
    zoomLbl.addEventListener('click', function (e) {
      var r = zoomLbl.getBoundingClientRect();
      SlopUI.menu([{ label: 'Fit page', key: '0', act: function () { Ed.fit('fit'); } }, { label: 'Fit width', act: function () { Ed.fit('width'); } }, '-'].concat([0.5, 0.75, 1, 1.5, 2, 3, 4].map(function (z) { return { label: Math.round(z * 100) + '%', act: function () { Ed.setZoom(z * 96 / 72); } }; })), r.left, r.bottom + 4);
      e.stopPropagation();
    });
    var tools = h('div', { class: 'pv-tools', role: 'toolbar', 'aria-label': 'Annotation tools' });
    Ed.TOOLS.forEach(function (t) {
      var b = ib(t[2], t[1] + ' (' + t[3] + ')', function () { Ed.setTool(t[0]); }, { 'data-tool': t[0] });
      tools.appendChild(b);
    });
    p.append(
      ibl('organize', 'Back to all pages (Esc)', function () { A.showGrid(); }, 'Pages'), sep(),
      ib('prev', 'Previous page (PgUp)', function () { A.gotoPage(-1); }), pageNo, ib('next', 'Next page (PgDn)', function () { A.gotoPage(1); }), sep(),
      ib('rotl', 'Rotate page left', function () { A.rotate([Ed.pid], -90); }), ib('rotr', 'Rotate page right', function () { A.rotate([Ed.pid], 90); }), sep(),
      tools, h('span', { class: 'tb-flex' }),
      ib('zoomout', 'Zoom out (−)', function () { Ed.zoomBy(1 / 1.25); }), zoomLbl, ib('zoomin', 'Zoom in (+)', function () { Ed.zoomBy(1.25); }), ib('fit', 'Fit page (0)', function () { Ed.fit('fit'); }));
  }
  A.zoomChanged = function (z) { var l = $('#zoomLbl'); if (l) l.textContent = Math.round(z * 72 / 96 * 100) + '%'; updateStatus(); };
  A.toolChanged = function () {
    U.$$('.pv-tools .tb', els.ctxPage).forEach(function (b) { b.classList.toggle('on', b.dataset.tool === Ed.tool); });
    PN.refresh('tool');
  };
  A.editorSelectionChanged = function () { PN.refresh('sel'); };
  A.selectionChanged = function () { PN.refresh('sel'); updateStatus(); };

  function updateChrome() {
    var has = E.state.pages.length > 0;
    els.app.dataset.mode = has ? A.mode : 'empty';
    els.empty.hidden = has;
    els.ctxGrid.hidden = !has || A.mode !== 'grid';
    els.ctxPage.hidden = !has || A.mode !== 'page';
    if (A.mode === 'page') { var n = $('#pvNum'); if (n) n.textContent = (E.indexOf(Ed.pid) + 1) + ' / ' + E.state.pages.length; }
    els.btnDownload.disabled = !has;
    A.toolChanged();
    updateUndo(); updateStatus();
  }
  function updateUndo() {
    els.btnUndo.disabled = !E.canUndo(); els.btnRedo.disabled = !E.canRedo();
    els.btnUndo.title = E.canUndo() ? 'Undo ' + E.undoLabel() + ' (Ctrl+Z)' : 'Nothing to undo';
    els.btnRedo.title = E.canRedo() ? 'Redo ' + E.redoLabel() + ' (Ctrl+Shift+Z)' : 'Nothing to redo';
  }
  var statusMsg = '', statusT = 0;
  A.status = function (msg, kind) {
    statusMsg = msg; clearTimeout(statusT);
    var m = $('#statusMsg'); if (m) { m.textContent = msg; m.className = 'st-msg ' + (kind || ''); }
    statusT = setTimeout(function () { statusMsg = ''; var m2 = $('#statusMsg'); if (m2) m2.textContent = ''; }, 6000);
  };
  function updateStatus() {
    var n = E.state.pages.length, files = new Set(E.state.pages.filter(function (p) { return p.f; }).map(function (p) { return p.f; })).size;
    var left = n ? n + ' page' + (n === 1 ? '' : 's') + ' · ' + files + ' file' + (files === 1 ? '' : 's') + (O.sel.size ? ' · ' + O.sel.size + ' selected' : '') : 'No document';
    $('#statusLeft').textContent = left;
    $('#statusZoom').textContent = A.mode === 'page' && n ? 'Zoom ' + Math.round(Ed.zoom * 72 / 96 * 100) + '%' : '';
  }
  A.announce = function (msg) { els.live.textContent = ''; setTimeout(function () { els.live.textContent = msg; }, 30); A.status(msg); };

  function onChange(info) {
    O.render();
    if (A.mode === 'page') {
      if (!Ed.page()) { var first = E.state.pages[0]; if (first) Ed.show(first.id); else A.showGrid(); }
      else Ed.layout();
    }
    if (!E.state.pages.length && A.mode === 'page') A.showGrid();
    PN.refresh(info && info.history ? 'history' : 'change');
    updateChrome();
    if (info && info.history && info.label) A.status(info.label);
    autosave();
  }
  function refreshAll() { O.render(); PN.refresh(); updateChrome(); }

  /* ---------------------------------------------------------- page ops */
  A.targetIds = function () { var s = O.selected(); return s.length ? s : E.state.pages.map(function (p) { return p.id; }); };
  A.rotate = function (ids, d) { if (!ids.length) return; E.commit('Rotate ' + (ids.length > 1 ? ids.length + ' pages' : 'page'), function (st) { E.ops.rotate(st, ids, d); }); A.announce('Rotated ' + ids.length + ' page' + (ids.length > 1 ? 's' : '') + (d > 0 ? ' right' : ' left')); };
  A.remove = function (ids) {
    if (!ids.length) return;
    var idx = E.indexOf(ids[0]);
    E.commit('Delete ' + (ids.length > 1 ? ids.length + ' pages' : 'page'), function (st) { E.ops.remove(st, ids); });
    var next = E.state.pages[Math.min(idx, E.state.pages.length - 1)];
    if (next) { O.setSelection([next.id], next.id); if (A.mode === 'grid') O.focus(next.id); }
    A.announce('Deleted ' + ids.length + ' page' + (ids.length > 1 ? 's' : '') + '. Ctrl+Z to undo.');
  };
  A.duplicate = function (ids) {
    if (!ids.length) return;
    var added = E.commit('Duplicate ' + (ids.length > 1 ? ids.length + ' pages' : 'page'), function (st) { return E.ops.duplicate(st, ids); });
    O.setSelection(added, added[0]); A.announce('Duplicated ' + ids.length + ' page' + (ids.length > 1 ? 's' : ''));
  };
  A.reverse = function () { var ids = O.selected(); E.commit('Reverse order', function (st) { E.ops.reverse(st, ids.length > 1 ? ids : null); }); A.announce(ids.length > 1 ? 'Reversed the selected pages' : 'Reversed all pages'); };
  A.sort = function (mode) { E.commit('Sort pages', function (st) { E.ops.sort(st, mode); }); A.announce('Pages sorted'); };
  function insertIndex() {
    var idx = O.selectedIndices(), w = A.insertOpts.where, n = E.state.pages.length;
    if (w === 'start') return 0;
    if (w === 'end' || !idx.length) return n;
    return w === 'before' ? idx[0] : idx[idx.length - 1] + 1;
  }
  A.insertBlank = function () {
    var o = A.insertOpts, at = insertIndex(), w, hh;
    if (o.size === 'same') {
      var nb = E.state.pages[at - 1] || E.state.pages[at];
      if (nb) { var vs = E.viewSize(nb); w = vs.w; hh = vs.h; } else { w = E.SIZES.a4[0]; hh = E.SIZES.a4[1]; }
    } else {
      var s = E.SIZES[o.size] || E.SIZES.a4; w = s[0]; hh = s[1];
      if (o.orient === 'landscape') { var t = w; w = hh; hh = t; }
    }
    var p = E.blankPage(U.round(w, 2), U.round(hh, 2));
    E.commit('Insert blank page', function (st) { E.ops.insert(st, at, [p]); });
    O.setSelection([p.id], p.id); O.reveal(p.id);
    A.announce('Inserted a blank page at position ' + (at + 1));
  };
  A.insertFromFile = function () {
    SlopUI.pickFiles({ accept: 'application/pdf,.pdf,image/png,image/jpeg,image/webp,image/gif', multiple: true }).then(function (files) { if (files.length) A.addFiles(files, { at: insertIndex() }); });
  };
  A.pageMenuItems = function () {
    var ids = A.targetIds(), one = ids.length === 1;
    return [
      { label: 'Open page view', key: 'Enter', act: function () { A.openPage(ids[0]); }, disabled: !one },
      '-',
      { label: 'Rotate right', key: 'R', act: function () { A.rotate(ids, 90); } },
      { label: 'Rotate left', key: 'Shift+R', act: function () { A.rotate(ids, -90); } },
      { label: 'Duplicate', key: 'Ctrl+D', act: function () { A.duplicate(ids); } },
      { label: 'Extract to new PDF', act: function () { A.extract(); } },
      '-',
      { label: 'Insert blank page after', act: function () { A.insertOpts.where = 'after'; A.insertBlank(); } },
      { label: 'Insert pages from file after…', act: function () { A.insertOpts.where = 'after'; A.insertFromFile(); } },
      { label: 'Move to start', act: function () { E.commit('Move pages', function (st) { E.ops.move(st, ids, 0); }); } },
      { label: 'Move to end', act: function () { E.commit('Move pages', function (st) { E.ops.move(st, ids, st.pages.length); }); } },
      '-',
      { label: 'Delete', key: 'Del', act: function () { A.remove(ids); } }
    ];
  };
  A.splitPreview = function () {
    if (A.tool !== 'split' || !E.state.pages.length) return null;
    var groups; try { groups = PN.splitGroups(); } catch (e) { return null; }
    var labels = {}, used = new Set();
    groups.forEach(function (g, k) { g.forEach(function (i, j) { used.add(i); if (j === 0 && labels[i] == null) labels[i] = '✂ Part ' + (k + 1); else if (labels[i] == null) labels[i] = 'Part ' + (k + 1); }); });
    E.state.pages.forEach(function (_, i) { if (!used.has(i)) labels[i] = 'not included'; });
    return labels;
  };

  /* -------------------------------------------------------- open files */
  A.openDialog = function () {
    SlopUI.pickFiles({ accept: 'application/pdf,.pdf,image/png,image/jpeg,image/webp,image/gif', multiple: true }).then(function (files) { if (files.length) A.addFiles(files); });
  };
  A.askPassword = function (name, wrong) {
    return new Promise(function (res) {
      var inp = h('input', { class: 'sui-input', type: 'password', autocomplete: 'off', 'aria-label': 'Password' });
      var body = h('div', null, h('p', { class: 'sui-p' + (wrong ? ' sp-err' : '') }, wrong ? 'That password didn’t work. Try again.' : '“' + name + '” is password-protected. The password never leaves this device.'), SlopUI.field('Password', inp));
      var val = null;
      SlopUI.dialog({ title: wrong ? 'Wrong password' : 'Password required', body: body, cls: 'sui-narrow', buttons: [{ label: 'Cancel' }, { label: 'Unlock', primary: true, act: function () { val = inp.value; } }], onClose: function (ok) { res(ok ? val : null); } });
    });
  };
  /** Adds PDFs/images. opts.at = insertion index (default end). */
  A.addFiles = async function (files, opts) {
    opts = opts || {};
    var newPages = [], errors = [], imgs = [], firstFile = null, total = files.length, k = 0;
    busy('Opening ' + (total > 1 ? total + ' files' : '“' + files[0].name + '”') + '…', 0);
    async function flushImages() {
      if (!imgs.length) return;
      var name = imgs.length === 1 ? imgs[0].name : 'Images (' + imgs.length + ')';
      try {
        var pdf = await E.imagesToPdf(imgs, { size: 'fit' });
        var f = await E.registerPdf(pdf, name.replace(/\.(png|jpe?g|webp|gif)$/i, '') + '.pdf', null);
        firstFile = firstFile || f; newPages = newPages.concat(E.pagesForFile(f));
      } catch (e) { errors.push('Images could not be converted: ' + (e.message || e)); }
      imgs = [];
    }
    try {
      for (var i = 0; i < files.length; i++) {
        var file = files[i];
        busy('Opening “' + file.name + '”…', k++ / total);
        var bytes;
        try { bytes = await U.readFile(file); } catch (e) { errors.push('“' + file.name + '” could not be read.'); continue; }
        var kind = U.sniff(bytes);
        if (kind === 'pdf') {
          await flushImages();
          try {
            var f = await E.registerPdf(bytes, file.name, A.askPassword);
            if (f.locked) errors.push('“' + file.name + '” opened, but its encryption could not be removed (' + f.locked + '). Its pages can be viewed but not exported.');
            firstFile = firstFile || f; newPages = newPages.concat(E.pagesForFile(f));
          } catch (e) { var msg = E.friendlyError(e, file.name); if (msg) errors.push(msg); }
        } else if (kind === 'png' || kind === 'jpeg' || kind === 'webp' || kind === 'gif' || kind === 'bmp') {
          imgs.push({ bytes: bytes, kind: kind, name: file.name });
        } else errors.push('“' + file.name + '” is not a PDF or a supported image (PNG, JPEG, WebP, GIF).');
      }
      await flushImages();
    } finally { busy(null); }
    if (newPages.length) {
      var at = opts.at == null ? E.state.pages.length : opts.at, wasEmpty = !E.state.pages.length;
      if (wasEmpty && firstFile) { var md = await E.readMeta(firstFile); if (md) E.state.meta = md; }
      E.commit(wasEmpty ? 'Open ' + (files.length > 1 ? files.length + ' files' : files[0].name) : 'Add pages', function (st) { E.ops.insert(st, at, newPages); });
      if (!fileNameTouched) els.fileName.value = E.files.size > 1 ? 'merged.pdf' : U.safeName(U.baseName(firstFile.name) + '-edited', 'pdf');
      if (!wasEmpty) { O.setSelection(newPages.map(function (p) { return p.id; }), newPages[0].id); O.reveal(newPages[0].id); }
      A.announce('Added ' + newPages.length + ' page' + (newPages.length === 1 ? '' : 's'));
      els.restore.hidden = true;
    }
    if (errors.length) SlopUI.alert(errors.length > 1 ? 'Some files could not be opened' : 'Could not open file', h('div', null, errors.map(function (e) { return h('p', { class: 'sui-p' }, e); })));
  };
  A.loadSample = async function () {
    busy('Mixing a fresh batch of goo…', 0.3);
    try {
      var bytes = await E.makeSample();
      var f = await E.registerPdf(bytes, "Sloppo's Guide to Goo.pdf", null);
      var wasEmpty = !E.state.pages.length;
      if (wasEmpty) { var md = await E.readMeta(f); if (md) E.state.meta = md; }
      E.commit('Open sample', function (st) { E.ops.insert(st, st.pages.length, E.pagesForFile(f)); });
      if (!fileNameTouched) els.fileName.value = 'sloppos-guide-to-goo.pdf';
      els.restore.hidden = true;
      A.announce('Sample loaded: 4 pages');
    } catch (e) { SlopUI.alert('Sample failed', String(e.message || e)); console.error(e); }
    finally { busy(null); }
  };

  /* ------------------------------------------------------------ busy */
  function busy(msg, frac) {
    if (msg == null) { els.busy.hidden = true; els.app.removeAttribute('aria-busy'); return; }
    els.busy.hidden = false; els.app.setAttribute('aria-busy', 'true');
    els.busy.querySelector('.busy-msg').textContent = msg;
    var bar = els.busy.querySelector('.busy-bar i');
    if (frac == null) bar.parentNode.classList.add('indet'); else { bar.parentNode.classList.remove('indet'); bar.style.width = Math.round(U.clamp(frac, 0, 1) * 100) + '%'; }
  }
  A.busy = busy;
  async function guarded(label, fn) {
    if (Ed.isEditingText()) Ed.commitText();
    busy(label, 0);
    try { return await fn(function (f, m) { busy(m || label, f); }); }
    catch (e) { console.error(e); SlopUI.alert('Something went wrong', String((e && e.message) || e)); return null; }
    finally { busy(null); }
  }
  function outName(suffix, ext) {
    var b = U.baseName(els.fileName.value || 'document');
    return U.safeName(b + (suffix ? '-' + suffix : ''), ext || 'pdf');
  }

  /* --------------------------------------------------------- downloads */
  A.download = function () {
    if (!E.state.pages.length) return;
    return guarded('Building your PDF…', async function (prog) {
      var n = E.state.pages.length;
      var bytes = await E.build({ onProgress: function (f) { prog(f * 0.85); } });
      prog(0.92, 'Checking the result…');
      await E.validate(bytes, n);
      var name = U.safeName(els.fileName.value || 'document.pdf', 'pdf');
      els.fileName.value = name;
      U.download(bytes, name, 'application/pdf');
      A.lastOutput = bytes;
      A.status('Saved ' + name + ' · ' + n + ' pages · ' + U.fmtBytes(bytes.length) + ' · validated ✓', 'ok');
      SlopUI.toast('Downloaded ' + name + ' (' + U.fmtBytes(bytes.length) + ')');
      return bytes;
    });
  };
  A.extract = function () {
    var ids = O.selected();
    if (!ids.length) { SlopUI.toast('Select the pages to extract first.'); return; }
    return guarded('Extracting pages…', async function (prog) {
      var set = new Set(ids), pages = E.state.pages.filter(function (p) { return set.has(p.id); });
      var bytes = await E.build({ pages: pages, onProgress: prog });
      await E.validate(bytes, pages.length);
      var name = outName('pages-' + U.describeIdx(O.selectedIndices()).replace(/[–, ]+/g, function (m) { return m.indexOf(',') >= 0 ? '_' : '-'; }));
      U.download(bytes, name, 'application/pdf');
      A.status('Extracted ' + pages.length + ' pages to ' + name, 'ok');
      return bytes;
    });
  };
  A.split = function () {
    var groups;
    try { groups = PN.splitGroups(); } catch (e) { SlopUI.alert('Check the ranges', e.message); return; }
    if (!groups.length) return;
    return guarded('Splitting…', async function (prog) {
      var files = [], width = String(groups.length).length;
      for (var i = 0; i < groups.length; i++) {
        var pages = groups[i].map(function (k) { return E.state.pages[k]; });
        var bytes = await E.build({ pages: pages });
        await E.validate(bytes, pages.length);
        files.push({ name: outName('part' + String(i + 1).padStart(width, '0') + '-p' + U.describeIdx(groups[i]).replace(/[–]/g, '-').replace(/[, ]+/g, '_')), data: bytes });
        prog((i + 1) / groups.length, 'Splitting… ' + (i + 1) + ' / ' + groups.length);
      }
      if (PN.split.output === 'zip' && files.length > 1) {
        U.download(U.makeZip(files), outName('split', 'zip'));
        A.status('Split into ' + files.length + ' PDFs (zip)', 'ok');
      } else {
        for (var j = 0; j < files.length; j++) { U.download(files[j].data, files[j].name, 'application/pdf'); await U.sleep(350); }
        A.status('Split into ' + files.length + ' PDFs', 'ok');
        if (files.length > 3) SlopUI.toast('If only some files arrived, allow multiple downloads or choose “One .zip”.');
      }
      return files;
    });
  };
  A.compress = function (o, resultEl) {
    return guarded('Compressing…', async function (prog) {
      var n = E.state.pages.length, before = 0;
      new Set(E.state.pages.filter(function (p) { return p.f; }).map(function (p) { return p.f; })).forEach(function (fid) { before += E.files.get(fid).bytes.length; });
      var bytes = await E.build({ onProgress: function (f) { prog(f * (o.mode === 'lossy' ? 0.3 : 0.9)); } });
      if (o.mode === 'lossy') bytes = await E.rasterize(bytes, { dpi: o.dpi, quality: o.quality, onProgress: function (f) { prog(0.3 + f * 0.65, 'Rasterising page ' + Math.ceil(f * n) + ' / ' + n + '…'); } });
      else bytes = await E.resave(bytes);
      await E.validate(bytes, n);
      var name = outName('compressed');
      U.download(bytes, name, 'application/pdf');
      var pct = before ? Math.round((1 - bytes.length / before) * 100) : 0;
      if (resultEl) {
        resultEl.innerHTML = '';
        resultEl.append(h('div', { class: 'res-sizes' }, h('span', null, U.fmtBytes(before)), h('i', { html: U.icon('next') }), h('b', null, U.fmtBytes(bytes.length))),
          h('p', { class: 'pp-note' }, pct > 0 ? pct + '% smaller · downloaded as ' + name : 'No size saving (the original was already compact) · downloaded as ' + name));
      }
      A.status('Compressed: ' + U.fmtBytes(before) + ' → ' + U.fmtBytes(bytes.length), 'ok');
      return bytes;
    });
  };
  A.toImages = function (o) {
    return guarded('Rendering images…', async function (prog) {
      var pages = E.state.pages, idx = null;
      if (o.which === 'sel') { var s = O.selectedIndices(); if (!s.length) { SlopUI.toast('Select some pages first.'); return null; } idx = s; }
      var bytes = await E.build({ onProgress: function (f) { prog(f * 0.3); } });
      var files = await E.toImages(bytes, { format: o.format, dpi: o.dpi, quality: o.quality, indices: idx, base: U.baseName(els.fileName.value || 'page'), onProgress: function (f) { prog(0.3 + f * 0.7, 'Rendering images… ' + Math.round(f * 100) + '%'); } });
      if (files.length === 1) U.download(files[0].data, files[0].name, files[0].mime);
      else U.download(U.makeZip(files), outName('images', 'zip'));
      A.status('Exported ' + files.length + ' image' + (files.length === 1 ? '' : 's') + ' at ' + o.dpi + ' dpi', 'ok');
      void pages;
      return files;
    });
  };
  A.imagesToPdf = function (io) {
    SlopUI.pickFiles({ accept: 'image/png,image/jpeg,image/webp,image/gif', multiple: true }).then(function (files) {
      if (!files.length) return;
      guarded('Converting images…', async function (prog) {
        var items = [];
        for (var i = 0; i < files.length; i++) { var b = await U.readFile(files[i]), k = U.sniff(b); if (/png|jpeg|webp|gif|bmp/.test(k)) items.push({ bytes: b, kind: k, name: files[i].name }); }
        if (!items.length) { SlopUI.alert('No images', 'None of those files is a PNG, JPEG, WebP or GIF image.'); return; }
        var pdf = await E.imagesToPdf(items, io);
        prog(0.8);
        if (io.add && E.state.pages.length) {
          var f = await E.registerPdf(pdf, (items.length === 1 ? U.baseName(items[0].name) : 'Images (' + items.length + ')') + '.pdf', null);
          var pages = E.pagesForFile(f);
          E.commit('Add images', function (st) { E.ops.insert(st, st.pages.length, pages); });
          A.announce('Added ' + pages.length + ' image page' + (pages.length === 1 ? '' : 's'));
        } else {
          U.download(pdf, items.length === 1 ? U.safeName(U.baseName(items[0].name), 'pdf') : 'images.pdf', 'application/pdf');
          A.status('Converted ' + items.length + ' image' + (items.length === 1 ? '' : 's') + ' to PDF', 'ok');
        }
      });
    });
  };
  A.extractText = function () {
    return guarded('Extracting text…', async function () {
      var bytes = await E.build({ stamps: true });
      var txt = await E.extractText(bytes);
      var ta = h('textarea', { class: 'sui-input sp-textout', readonly: true, rows: 16, spellcheck: 'false', 'aria-label': 'Extracted text' });
      ta.value = txt;
      var words = (txt.match(/\S+/g) || []).length;
      SlopUI.dialog({ title: 'Extracted text', cls: 'sui-wide', body: h('div', null, h('p', { class: 'sui-p' }, words + ' words from ' + E.state.pages.length + ' pages.'), ta), buttons: [
        { label: 'Copy', act: function () { ta.select(); var ok = false; try { if (navigator.clipboard) { navigator.clipboard.writeText(txt); ok = true; } } catch (e) { /* ignore */ } if (!ok) try { document.execCommand('copy'); } catch (e) { /* ignore */ } SlopUI.toast('Copied to clipboard'); return false; } },
        { label: 'Download .txt', primary: true, act: function () { U.download(new Blob([txt], { type: 'text/plain;charset=utf-8' }), outName('', 'txt')); } }] });
      return txt;
    });
  };
  A.downloadApp = function () {
    return guarded('Packing the offline app…', async function () {
      var html = await SP.build.make();
      U.download(new Blob([html], { type: 'text/html;charset=utf-8' }), 'slop-pdf.html');
      A.status('Offline app saved: slop-pdf.html (' + U.fmtBytes(html.length) + '). Open it from your disk; it works without a connection.', 'ok');
      return html;
    });
  };

  /* --------------------------------------------------------- undo/redo */
  A.undo = function () { if (Ed.isEditingText()) { Ed.commitText(); } var l = E.undo(); if (l) A.announce('Undid: ' + l); };
  A.redo = function () { var l = E.redo(); if (l) A.announce('Redid: ' + l); };

  /* ------------------------------------------------------------- menus */
  function buildMenus() {
    var defs = [['File', fileMenu], ['Edit', editMenu], ['View', viewMenu], ['Help', helpMenu]];
    defs.forEach(function (d) {
      var b = h('button', { type: 'button', class: 'menu-b', 'aria-haspopup': 'menu' }, d[0]);
      b.addEventListener('click', function (e) { e.stopPropagation(); var r = b.getBoundingClientRect(); SlopUI.menu(d[1](), r.left, r.bottom + 2); });
      els.menus.appendChild(b);
    });
    els.btnMore.addEventListener('click', function (e) {
      e.stopPropagation(); var r = els.btnMore.getBoundingClientRect();
      SlopUI.menu([{ label: 'File', sub: fileMenu() }, { label: 'Edit', sub: editMenu() }, { label: 'View', sub: viewMenu() }, { label: 'Help', sub: helpMenu() }], r.right - 220, r.bottom + 4);
    });
  }
  function fileMenu() {
    var has = E.state.pages.length > 0;
    return [
      { label: 'Open PDFs or images…', key: 'Ctrl+O', act: A.openDialog },
      { label: 'Try the sample PDF', act: A.loadSample },
      savedSession && !has ? { label: 'Restore last session', act: A.restoreSession } : null,
      '-',
      { label: 'Download PDF', key: 'Ctrl+S', act: A.download, disabled: !has },
      { label: 'Download selected pages', act: A.extract, disabled: !O.sel.size },
      { label: 'Extract text…', act: A.extractText, disabled: !has },
      { label: 'Pages to images…', act: function () { A.setTool('convert'); }, disabled: !has },
      '-',
      { label: 'Download app (offline .html)', act: A.downloadApp },
      { label: 'Autosave session in this browser', check: U.store.get('autosave', true), act: function () { var v = !U.store.get('autosave', true); U.store.set('autosave', v); if (!v) U.idb.del('session'); SlopUI.toast(v ? 'Autosave on (stored only in this browser)' : 'Autosave off; saved session deleted'); } },
      '-',
      { label: 'Close all', act: A.closeAll, disabled: !has }
    ];
  }
  function editMenu() {
    var has = E.state.pages.length > 0, pg = A.mode === 'page';
    return [
      { label: E.canUndo() ? 'Undo ' + E.undoLabel() : 'Undo', key: 'Ctrl+Z', act: A.undo, disabled: !E.canUndo() },
      { label: E.canRedo() ? 'Redo ' + E.redoLabel() : 'Redo', key: 'Ctrl+Shift+Z', act: A.redo, disabled: !E.canRedo() },
      '-',
      { label: 'Select all pages', key: 'Ctrl+A', act: function () { O.selectAll(); }, disabled: !has },
      { label: 'Select none', act: function () { O.setSelection([]); }, disabled: !O.sel.size },
      '-',
      { label: 'Rotate right', key: 'R', act: function () { A.rotate(pg ? [Ed.pid] : A.targetIds(), 90); }, disabled: !has },
      { label: 'Rotate left', key: 'Shift+R', act: function () { A.rotate(pg ? [Ed.pid] : A.targetIds(), -90); }, disabled: !has },
      { label: 'Duplicate pages', key: 'Ctrl+D', act: function () { A.duplicate(A.targetIds()); }, disabled: !has },
      { label: 'Delete pages', key: 'Del', act: function () { A.remove(pg ? [Ed.pid] : A.targetIds()); }, disabled: !has },
      { label: 'Reverse order', act: A.reverse, disabled: !has },
      { label: 'Insert blank page', act: A.insertBlank, disabled: !has },
      { label: 'Insert pages from file…', act: A.insertFromFile, disabled: !has }
    ];
  }
  function viewMenu() {
    var theme = document.documentElement.getAttribute('data-theme');
    return [
      { label: 'All pages (organizer)', act: function () { A.showGrid(); }, check: A.mode === 'grid' },
      { label: 'Page view', act: function () { A.ensurePage(); }, check: A.mode === 'page', disabled: !E.state.pages.length },
      '-',
      { label: 'Zoom in', key: '+', act: function () { if (A.mode === 'page') Ed.zoomBy(1.25); else O.setSize(Math.min(300, O.getSize() + 40)); } },
      { label: 'Zoom out', key: '-', act: function () { if (A.mode === 'page') Ed.zoomBy(0.8); else O.setSize(Math.max(110, O.getSize() - 40)); } },
      { label: 'Fit page', key: '0', act: function () { Ed.fit('fit'); }, disabled: A.mode !== 'page' },
      '-',
      { label: 'Theme', sub: THEMES.map(function (t) { return { label: t[1], check: theme === t[0], act: function () { A.setTheme(t[0]); } }; }) },
      { label: 'Properties panel', check: !els.app.classList.contains('no-panel'), act: function () { A.togglePanel(); } }
    ];
  }
  function helpMenu() {
    return [
      { label: 'Keyboard shortcuts', key: '?', act: showKeys },
      { label: 'About Slop PDF & privacy', act: showAbout },
      '-',
      { label: 'Slopographic home', act: function () { location.href = SP.offline ? 'https://slopographic.com/' : '../'; } }
    ];
  }
  function showKeys() {
    var rows = [['Ctrl/⌘ O', 'Open files'], ['Ctrl/⌘ S', 'Download PDF'], ['Ctrl/⌘ Z / Shift Z', 'Undo / redo'], ['Ctrl/⌘ A', 'Select all pages'], ['Arrows', 'Move focus between pages'], ['Alt + arrows', 'Move selected pages'], ['Space', 'Toggle page selection'],
      ['R / Shift R', 'Rotate right / left'], ['Del', 'Delete pages or annotation'], ['Enter', 'Open page view'], ['Esc', 'Back to all pages'], ['PgUp / PgDn', 'Previous / next page'], ['+ / − / 0', 'Zoom in / out / fit'],
      ['V T P H', 'Select, Text, Draw, Highlighter'], ['R E L A', 'Rectangle, Ellipse, Line, Arrow (page view)'], ['W B I S', 'Whiteout, Highlight box, Image, Signature'], ['Ctrl/⌘ D, C, V', 'Duplicate, copy, paste annotation']];
    SlopUI.dialog({ title: 'Keyboard shortcuts', body: h('dl', { class: 'keys keys-dlg' }, rows.map(function (r) { return [h('dt', null, r[0]), h('dd', null, r[1])]; })), buttons: [{ label: 'Close', primary: true }] });
  }
  function showAbout() {
    SlopUI.dialog({ title: 'About Slop PDF', body: h('div', null,
      h('p', { class: 'sui-p' }, 'Slop PDF is a free PDF editor that runs entirely in your browser. Your files are never uploaded: they are read, edited and written on this device.'),
      h('p', { class: 'sui-p' }, 'Built on pdf.js (Mozilla, Apache-2.0) for rendering and pdf-lib (MIT) for writing. Page content is copied as-is, so text and vector graphics stay sharp; only the optional lossy compression turns pages into pictures.'),
      h('p', { class: 'sui-p' }, 'Autosave keeps your session in this browser’s IndexedDB so a refresh doesn’t lose work. Turn it off in File ▸ Autosave.')), buttons: [{ label: 'Nice', primary: true }] });
  }

  /* ------------------------------------------------------------ themes */
  A.setTheme = function (t, silent) {
    if (!THEMES.some(function (x) { return x[0] === t; })) t = 'pro';
    document.documentElement.setAttribute('data-theme', t);
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', t === 'light' ? '#f1ede4' : t === 'classic' ? '#c0c0c0' : '#0e0e10');
    document.documentElement.style.colorScheme = t === 'pro' ? 'dark' : 'light';
    U.store.set('theme', t);
    if (!silent) A.status('Theme: ' + THEMES.filter(function (x) { return x[0] === t; })[0][1]);
  };
  A.togglePanel = function (force) {
    var narrow = window.innerWidth <= 900;
    if (narrow) { var open = force != null ? force : !els.app.classList.contains('sheet-open'); els.app.classList.toggle('sheet-open', open); els.btnPanel.setAttribute('aria-expanded', open ? 'true' : 'false'); }
    else { els.app.classList.toggle('no-panel', force != null ? !force : undefined); els.btnPanel.setAttribute('aria-expanded', els.app.classList.contains('no-panel') ? 'false' : 'true'); }
    if (A.mode === 'page') setTimeout(function () { Ed.layout(); }, 200);
  };

  /* ---------------------------------------------------- drag & drop */
  function setupDrop() {
    var depth = 0;
    function hasFiles(e) { var t = e.dataTransfer && e.dataTransfer.types; return t && Array.prototype.indexOf.call(t, 'Files') >= 0; }
    window.addEventListener('dragenter', function (e) { if (!hasFiles(e)) return; e.preventDefault(); depth++; els.dropOverlay.hidden = false; });
    window.addEventListener('dragover', function (e) { if (!hasFiles(e)) return; e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; });
    window.addEventListener('dragleave', function (e) { if (!hasFiles(e)) return; depth = Math.max(0, depth - 1); if (!depth) els.dropOverlay.hidden = true; });
    window.addEventListener('drop', function (e) {
      if (!hasFiles(e)) return;
      e.preventDefault(); depth = 0; els.dropOverlay.hidden = true;
      var files = Array.prototype.slice.call(e.dataTransfer.files || []);
      if (files.length) A.addFiles(files);
    });
  }

  /* --------------------------------------------------------- keyboard */
  function setupKeys() {
    document.addEventListener('keydown', function (e) {
      if (SlopUI.openDialogs > 0 || document.querySelector('.sui-menu')) return;
      var t = e.target, typing = t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable);
      var mod = e.ctrlKey || e.metaKey, k = e.key;
      if (mod && !e.altKey) {
        var lk = k.toLowerCase();
        if (lk === 'z' && !typing) { e.preventDefault(); if (e.shiftKey) A.redo(); else A.undo(); return; }
        if (lk === 'y' && !typing) { e.preventDefault(); A.redo(); return; }
        if (lk === 'o') { e.preventDefault(); A.openDialog(); return; }
        if (lk === 's') { e.preventDefault(); A.download(); return; }
        if (typing) return;
        if (lk === 'a' && A.mode === 'grid') { e.preventDefault(); O.selectAll(); return; }
        if (lk === 'd') { e.preventDefault(); if (A.mode === 'page') { if (Ed.getSelected()) Ed.duplicateSelected(); } else A.duplicate(A.targetIds()); return; }
        if (A.mode === 'page' && lk === 'c') { if (Ed.copy()) e.preventDefault(); return; }
        if (A.mode === 'page' && lk === 'v') { if (Ed.paste()) e.preventDefault(); return; }
        if (k === '=' || k === '+') { e.preventDefault(); if (A.mode === 'page') Ed.zoomBy(1.25); return; }
        if (k === '-') { e.preventDefault(); if (A.mode === 'page') Ed.zoomBy(0.8); return; }
        return;
      }
      if (typing) return;
      if (k === '?') { showKeys(); return; }
      if (A.mode === 'page' && E.state.pages.length) {
        var sel = Ed.getSelected();
        if (k === 'Escape') { e.preventDefault(); if (sel) Ed.select(null); else if (Ed.tool !== 'select') Ed.setTool('select'); else A.showGrid(); return; }
        if ((k === 'Delete' || k === 'Backspace') && sel) { e.preventDefault(); Ed.deleteSelected(); return; }
        if (k.indexOf('Arrow') === 0 && sel) { e.preventDefault(); var d = e.shiftKey ? 10 : 1; Ed.nudgeSelected(k === 'ArrowLeft' ? -d : k === 'ArrowRight' ? d : 0, k === 'ArrowUp' ? -d : k === 'ArrowDown' ? d : 0); return; }
        if (k === 'PageDown' || (k === 'ArrowRight' && !sel) || (k === 'ArrowDown' && !sel && t === document.body)) { e.preventDefault(); A.gotoPage(1); return; }
        if (k === 'PageUp' || (k === 'ArrowLeft' && !sel) || (k === 'ArrowUp' && !sel && t === document.body)) { e.preventDefault(); A.gotoPage(-1); return; }
        if (k === '+' || k === '=') { Ed.zoomBy(1.25); return; }
        if (k === '-') { Ed.zoomBy(0.8); return; }
        if (k === '0') { Ed.fit('fit'); return; }
        if (k === 'Enter' && sel && sel.type === 'text') { e.preventDefault(); Ed.editSelectedText(); return; }
        var map = { v: 'select', t: 'text', p: 'pen', h: 'marker', r: 'rect', e: 'ellipse', l: 'line', a: 'arrow', w: 'whiteout', b: 'hlbox', i: 'image', s: 'signature' };
        if (!e.altKey && map[k.toLowerCase()] && !e.shiftKey) { e.preventDefault(); Ed.setTool(map[k.toLowerCase()]); return; }
        return;
      }
      if (A.mode === 'grid' && E.state.pages.length && !t.closest('.thumb')) {
        if (k === 'Delete' && O.sel.size) { e.preventDefault(); A.remove(O.selected()); return; }
        if (k === 'Escape' && O.sel.size) { O.setSelection([]); return; }
        if (k.indexOf('Arrow') === 0 && !t.closest('#props, .topbar, .rail')) { e.preventDefault(); O.focus(O.focusId || E.state.pages[0].id); return; }
      }
    });
  }

  /* ---------------------------------------------------------- session */
  var autosave = U.debounce(function () {
    if (!U.store.get('autosave', true)) return;
    if (!E.state.pages.length) { U.idb.del('session'); return; }
    try { var s = E.serialize(); s.fileName = els.fileName.value; U.idb.set('session', s); } catch (e) { console.warn('Slop PDF: autosave failed', e); }
  }, 1200);
  A.restoreSession = function () {
    var s = savedSession; if (!s) return;
    return guarded('Restoring your session…', async function () {
      await E.restore(s);
      if (s.fileName) { els.fileName.value = s.fileName; fileNameTouched = true; }
      els.restore.hidden = true; savedSession = null;
      A.announce('Session restored: ' + E.state.pages.length + ' pages');
    });
  };
  A.closeAll = function () {
    SlopUI.confirm('Close all files', 'Remove every page and file from Slop PDF? Unsaved changes are lost (download first if you need them).', 'Close all', { danger: true }).then(function (ok) {
      if (!ok) return;
      A.showGrid(true);
      E.closeAll(); U.idb.del('session'); fileNameTouched = false; els.fileName.value = 'document.pdf';
      A.setTool('organize');
    });
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', A.boot); else A.boot();
})();
