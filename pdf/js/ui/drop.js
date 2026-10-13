/* Slop PDF — files dropped on the document area or the tab strip, and the zone on the empty page. SlopDrop
   (shared/drop) draws the zone and the outlines over the stage and the tabs, and reports each file. On the tab strip
   each file opens in a new tab. On the open document the person chooses (shared/drop/choice.js): "Add to current" adds
   the pages at a place they pick, as one undo step; "Create new" opens each file in a new tab. With no document open
   the files simply open. SVG is offered Convert to PDF (the Convert dialog), and other files are named and refused. A PDF
   already open asks first. Classic script. */
(function () {
  'use strict';
  var SP = window.SP, U = SP.util, E = SP.engine, A = SP.app, S = A._, D = SP.docs;
  var h = U.h;
  var OPENS = ['pdf', 'png', 'jpg', 'jpeg', 'webp', 'gif', 'bmp'];
  var CONVERTS = ['svg'];
  var OPEN_TYPE = /^application\/pdf$|^image\/(png|jpe?g|webp|gif|bmp)$/;
  var NOT_HERE = 'Office files (XLSX, DOCX, ODT, ODS, PPTX) and text files (CSV, TXT, MD, HTML, JSON) cannot be converted to PDF here.';
  var RULES = {
    types: ['application/pdf', 'image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/bmp'],
    exts: ['.pdf', '.png', '.jpg', '.jpeg', '.webp', '.gif', '.bmp'],
    noun: 'a PDF or an image (PNG, JPEG, WebP, GIF or BMP)',
  };
  var dest = new WeakMap(); // a file -> 'tab' (open in a new tab); set by the drop, read by process

  /** 'open', 'convert' or 'refused', from the extension and the browser's type. */
  function kind(file) {
    var ext = String(file.name || '').toLowerCase().split('.').pop(), type = String(file.type || '').toLowerCase();
    if (OPENS.indexOf(ext) >= 0 || OPEN_TYPE.test(type)) return 'open';
    if (CONVERTS.indexOf(ext) >= 0 || type === 'image/svg+xml') return 'convert';
    return 'refused';
  }
  function split(files) {
    var out = { open: [], convert: [], refused: [] };
    files.forEach(function (f) { out[kind(f)].push(f); });
    return out;
  }
  function names(list) { return list.map(function (f) { return '“' + f.name + '”'; }).join(', '); }
  function onTabs(target) { return !!(target && target.closest && target.closest('#tabs')); }

  /** Tells the person what was not added, and offers Convert to PDF for the files it can convert. */
  function notice(r) {
    if (!r.convert.length && !r.refused.length) return;
    var body = h('div', null);
    if (r.convert.length) body.appendChild(h('p', { class: 'sui-p' }, 'Can be converted to PDF: ' + names(r.convert) + '. The conversion runs on this device.'));
    if (r.refused.length) {
      body.appendChild(h('p', { class: 'sui-p' }, 'Not supported, not added: ' + names(r.refused) + '.'));
      body.appendChild(h('p', { class: 'sui-p' }, 'Slop PDF opens PDF, PNG, JPEG, WebP, GIF and BMP files, and converts SVG to PDF. ' + NOT_HERE));
    }
    A.status('Not added: ' + r.refused.length + ' file' + (r.refused.length === 1 ? '' : 's') + ' not supported' + (r.convert.length ? '; ' + r.convert.length + ' can be converted to PDF' : ''), 'err');
    var buttons = r.convert.length ? [{ label: 'Close' }, { label: 'Convert to PDF', primary: true }] : [{ label: 'OK', primary: true }];
    SlopUI.dialog({
      title: r.convert.length ? 'Convert to PDF?' : 'File not supported', body: body, cls: 'sui-narrow', buttons: buttons,
      onClose: function (ok) { if (ok && r.convert.length) A.convertFiles(r.convert); },
    });
  }

  /** The SHA-256 of a dropped PDF (null for images and anything unreadable). */
  async function fingerprintOf(file) {
    try { var bytes = await U.readFile(file); return U.sniff(bytes) === 'pdf' ? await SP.editLog.fingerprint(bytes) : null; } catch (e) { return null; }
  }

  /** One file in a new tab. A PDF that is open in another tab asks first. Throws the reason when it is not opened. */
  async function openInTab(file) {
    var fp = await fingerprintOf(file);
    if (fp && D.holding(fp)) {
      var again = await SlopUI.confirm('Already open', '“' + file.name + '” is already open in a tab. Open this copy in a new tab too?', 'Open again');
      if (!again) throw new Error('is already open in a tab and was not opened again');
    }
    await A.lockedOpen(async function () {
      A.newDocTab(file.name);
      await A.addFiles([file]);
      if (!E.state.pages.length) A.closeTab(); // the file did not open (an error was shown): no empty tab left behind
    });
    if (!E.state.pages.length) throw new Error('could not be opened');
  }

  /** Adds the files' pages to the open document. A PDF that is already in it asks first; the position is asked once. */
  async function addToDocument(files) {
    var keep = [];
    for (var i = 0; i < files.length; i++) {
      var file = files[i], fp = await fingerprintOf(file);
      var inDoc = !!fp && Array.from(E.files.values()).some(function (f) { return f.fp === fp; });
      if (inDoc) {
        var again = await SlopUI.confirm('Already in this document', '“' + file.name + '” is already in this document. Add its pages again?', 'Add again');
        if (!again) continue;
      }
      keep.push(file);
    }
    if (!keep.length) return;
    var at = await askPosition(E.state.pages.length);
    if (at == null) return;
    await A.lockedOpen(function () { return A.addFiles(keep, { at: at }); });
  }

  /** Where the pages go: at the start, at the end, or after page N. Resolves the page index, or null when cancelled. */
  function askPosition(n) {
    return new Promise(function (res) {
      var sel = document.createElement('select');
      sel.className = 'sui-input';
      sel.setAttribute('aria-label', 'Insert position');
      var choices = [['start', 'At the start of the document'], ['end', 'At the end of the document']];
      for (var p = 1; p <= n; p++) choices.push(['after:' + p, 'After page ' + p]);
      choices.forEach(function (c) { var o = document.createElement('option'); o.value = c[0]; o.textContent = c[1]; sel.append(o); });
      sel.value = 'end';
      var val = null;
      var body = h('div', null, h('p', { class: 'sui-p' }, 'Where should the new pages go?'), SlopUI.field('Position', sel));
      SlopUI.dialog({
        title: 'Add pages', body: body, cls: 'sui-narrow',
        buttons: [{ label: 'Cancel' }, { label: 'Add pages', primary: true, act: function () { val = sel.value; } }],
        onClose: function (ok) {
          if (!ok) { res(null); return; }
          res(val === 'start' ? 0 : val && val.indexOf('after:') === 0 ? Number(val.slice(6)) : n);
        },
      });
    });
  }

  /** The drop (SlopDrop's files hook, read inside the drop event). Returns the files SlopDrop should open one by one. */
  async function onDrop(dt, e) {
    var list = Array.prototype.slice.call((dt && dt.files) || []);
    if (A.isLocked()) { A.status('Wait for the current open to finish, then drop again.', 'err'); return []; }
    var r = split(list);
    notice(r);
    var opens = r.open;
    if (!opens.length) return [];
    if (onTabs(e && e.target) || !E.state.pages.length) {
      // on the strip, or with no document open: each file opens in a tab (the strip) or the first file opens here
      if (onTabs(e && e.target)) opens.forEach(function (f) { dest.set(f, 'tab'); });
      return opens;
    }
    var where = window.SlopDropChoice ? await SlopDropChoice.ask({ files: opens, hasDocument: true }) : 'current';
    if (where === 'new') { opens.forEach(function (f) { dest.set(f, 'tab'); }); return opens; }
    if (where === 'current') await addToDocument(opens);
    return [];
  }

  /** One accepted file, from a drop or the zone's Choose files button. */
  async function process(file) {
    if (dest.get(file) === 'tab') { await openInTab(file); return file.name; }
    await A.addFiles([file]);
    if (!E.state.pages.length) throw new Error('could not be opened');
    return file.name;
  }

  /** Wires the zone (on the empty page) and the drop targets (the stage and the tab strip). Called from ui/app.js. */
  S.setupDrop = function () {
    if (!window.SlopDrop) return;
    SlopDrop.attach(document.getElementById('pdfDrop'), {
      accept: RULES, compact: true, label: 'Drop PDFs or images here', chooseLabel: 'Choose files',
      targets: [document.getElementById('stage'), document.getElementById('tabs')],
      files: onDrop, process: process,
    });
  };
})();
