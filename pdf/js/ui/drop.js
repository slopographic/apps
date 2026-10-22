/* Slop PDF — files dropped on the document area or the tab strip, and the zone on the empty page. SlopDrop
   (shared/drop) draws the zone and the outlines over the stage and the tabs, and reports each file. On the tab strip
   each file opens in a new tab. On the open document the person chooses (shared/drop/choice.js): "Add to current" adds
   the pages at a place they pick, as one undo step; "Create new" opens each file in a new tab. With no document open
   the files simply open. Every other file (SVG, Office files, text, HTML...) goes to the Convert dialog with its target set
   to PDF where it can make one; the PDF it makes opens in a new tab (A.openConverted). A PDF already open asks first.
   Classic script. */
(function () {
  'use strict';
  var SP = window.SP, U = SP.util, E = SP.engine, A = SP.app, S = A._, D = SP.docs;
  var h = U.h;
  var OPENS = ['pdf', 'png', 'jpg', 'jpeg', 'webp', 'gif', 'bmp'];
  var OPEN_TYPE = /^application\/pdf$|^image\/(png|jpe?g|webp|gif|bmp)$/;
  var RULES = { any: true, noun: 'a file' }; // every file is taken by the zone; the ones not opened here go to Convert
  var dest = new WeakMap(); // a file -> 'tab' (open in a new tab); set by the drop, read by process

  /** 'open' for a PDF or a raster image, 'convert' for any other file (the Convert dialog says what it can make of it). */
  function kind(file) {
    var ext = String(file.name || '').toLowerCase().split('.').pop(), type = String(file.type || '').toLowerCase();
    return OPENS.indexOf(ext) >= 0 || OPEN_TYPE.test(type) ? 'open' : 'convert';
  }
  function split(files) {
    var out = { open: [], convert: [] };
    files.forEach(function (f) { out[kind(f)].push(f); });
    return out;
  }
  function onTabs(target) { return !!(target && target.closest && target.closest('#tabs')); }

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

  /** A PDF the Convert dialog made (open-convert.js): opens in a new tab, then a toast names the files it came from. */
  A.openConverted = async function (outs, names) {
    for (var i = 0; i < outs.length; i++) {
      try { await openInTab(new File([outs[i].blob], outs[i].name, { type: 'application/pdf' })); } catch (err) {
        A.status('“' + outs[i].name + '” ' + err.message, 'err');
        return;
      }
    }
    SlopUI.toast('Converted ' + (names.length === 1 ? names[0] : names.length + ' files') + ' to PDF');
  };

  /** Files opened into split pane i (a drop on it, or Open a file in its empty state). Each opens in a tab; the first one is
   *  then shown live in pane i, and the document that was live goes to the pane that held it. */
  A.openFilesInPane = async function (pane, files) {
    if (A.isLocked()) { A.status('Wait for the current open to finish, then try again.', 'err'); return; }
    var conv = files.filter(function (f) { return kind(f) === 'convert'; });
    if (conv.length) A.convertFiles(conv);
    var opens = files.filter(function (f) { return kind(f) === 'open'; });
    if (!opens.length) return;
    var prev = SP.tabs.current(), first = null;
    for (var i = 0; i < opens.length; i++) {
      try { await openInTab(opens[i]); } catch (err) { A.status('“' + opens[i].name + '” ' + err.message, 'err'); continue; }
      if (!first) first = SP.tabs.current();
    }
    SP.panes.placeIn(pane, first, prev);
  };

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
    if (r.convert.length) A.convertFiles(r.convert);
    var opens = r.open;
    if (!opens.length) return [];
    var pane = SP.panes.paneAt(e && e.target);
    if (pane >= 0 && pane !== SP.panes.focused()) { await A.openFilesInPane(pane, opens); return []; }
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

  /** Choose files: the files that are not opened here go to the Convert dialog (process names them as not added). */
  function begin(list) {
    var conv = list.filter(function (f) { return kind(f) === 'convert'; });
    if (conv.length) A.convertFiles(conv);
  }

  /** One accepted file, from a drop or the zone's Choose files button. */
  async function process(file) {
    if (kind(file) === 'convert') throw new Error('is not opened here: it went to the Convert dialog');
    if (dest.get(file) === 'tab') { await openInTab(file); return file.name; }
    await A.addFiles([file]);
    if (!E.state.pages.length) throw new Error('could not be opened');
    return file.name;
  }

  /** Wires the zone (on the empty page) and the drop targets (the stage and the tab strip). Called from ui/app.js. */
  S.setupDrop = function () {
    if (!window.SlopDrop) return;
    SlopDrop.attach(document.getElementById('pdfDrop'), {
      accept: RULES, compact: true, label: 'Drop PDFs, images or other files here', chooseLabel: 'Choose files',
      targets: [document.getElementById('stage'), document.getElementById('tabs')],
      files: onDrop, begin: begin, process: process,
    });
  };
})();
