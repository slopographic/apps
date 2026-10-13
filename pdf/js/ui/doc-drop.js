/* Slop PDF — files dropped on the window. On the tab strip each file opens in a new tab. On the open document, the
   person chooses (shared/drop/choice.js, the same two choices as PhotoSlop): "Add to current" adds the pages at a
   place they pick, as one undo step; "Create new" opens each file in a new tab. With no document open, a drop simply
   opens the files. Files that cannot be opened are routed to Convert (ui/drop-route.js), never dropped silently. A PDF
   that is already open asks first. Classic script. */
(function () {
  'use strict';
  var SP = window.SP, U = SP.util, E = SP.engine, A = SP.app, S = A._, D = SP.docs;
  var $ = U.$, h = U.h;

  function onTabs(target) { return !!(target && target.closest && target.closest('#tabs')); }
  /** The SHA-256 of a dropped PDF (null for images and anything unreadable). */
  async function fingerprintOf(file) {
    try { var bytes = await U.readFile(file); return U.sniff(bytes) === 'pdf' ? await SP.editLog.fingerprint(bytes) : null; } catch (e) { return null; }
  }

  /** The one entry point for a drop (ui/input.js). */
  A.dropFiles = async function (files, target) {
    files = Array.prototype.slice.call(files || []);
    if (!files.length) return;
    if (A.isLocked()) { A.status('Wait for the current open to finish, then drop again.', 'err'); return; }
    var r = SP.dropRoute.split(files);
    if (r.open.length) {
      if (onTabs(target)) await openInTabs(r.open);
      else if (!E.state.pages.length) await A.addFiles(r.open);
      else await chooseAndAdd(r.open);
    }
    SP.dropRoute.notice(r);
  };

  /** A drop on the open document: Add to current or Create new (shared/drop/choice.js). Cancel adds nothing. */
  async function chooseAndAdd(files) {
    var where = window.SlopDropChoice ? await SlopDropChoice.ask({ files: files, hasDocument: true }) : 'current';
    if (where === 'new') return openInTabs(files);
    if (where === 'current') return addToDocument(files);
  }

  /** Each file opens in its own new tab. A PDF that is open in another tab asks first. */
  async function openInTabs(files) {
    for (var i = 0; i < files.length; i++) {
      var file = files[i], fp = await fingerprintOf(file);
      if (fp && D.holding(fp)) {
        var again = await SlopUI.confirm('Already open', '“' + file.name + '” is already open in a tab. Open this copy in a new tab too?', 'Open again');
        if (!again) continue;
      }
      await A.lockedOpen(async function () {
        A.newDocTab(file.name);
        await A.addFiles([file]);
        if (!E.state.pages.length) A.closeTab(); // the file did not open (an error was shown): no empty tab left behind
      });
    }
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

  /** While files are dragged over the window: the overlay says what the drop does here. */
  A.dropHint = function (target) {
    var tabs = onTabs(target), host = $('#tabs');
    if (host) host.classList.toggle('is-drop', tabs);
    var b = S.els.dropOverlay && S.els.dropOverlay.querySelector('b');
    if (!b) return;
    var msg = tabs ? 'Drop to open in a new tab' : (E.state.pages.length ? 'Drop to add pages' : 'Drop to open');
    if (b.textContent !== msg) b.textContent = msg;
  };
})();
