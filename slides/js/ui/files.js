/* Slop Slides: files. Each presentation is a tab (ui/tabs.js). Save and Open from Slop Drive go through the strip, so a
   tab saves to its own Drive file (drive.js: the same id, in place) and a file opened with ?drive=<id> or from the Drive
   picker opens in a tab linked to it. A zero-byte .sslide (Drive's New menu) opens as a blank deck. Pictures open as a
   one-slide deck and other formats open as a blank deck, in a tab with no link, so Save can never overwrite a file this
   editor did not write. Also: the .sslide download, PowerPoint and PNG export, and the boot. Exposes SS.files. */
(function () {
  'use strict';
  var SS = window.SS, A = SS.app, N = SS.native, U = SS.util, D = SS.dom, R = SS.canvasRender;
  var F = SS.files = {};
  var PPTX = 'application/vnd.openxmlformats-officedocument.presentationml.presentation';
  var ODP = 'application/vnd.oasis.opendocument.presentation';
  var hub = function () { return window.SlopHub || null; };
  var api = function () { return SS.tabs.api(); };

  F.newDeck = function () { SS.tabs.newTab(); D.toast('New presentation'); };
  /** A new presentation built from one of the starter templates (they are ordinary, editable decks). */
  F.fromTemplate = function (id) {
    var t = SS.templates.byId(id);
    if (!t) return;
    SS.tabs.open(t.build(), {});
    D.toast('New presentation from ' + t.name);
  };
  /** A new presentation from one of "My templates" (a record from SS.templateStore; its deck is re-checked and copied). */
  F.fromStored = function (rec) {
    SS.tabs.open(N.normalize(U.clone(rec.deck)), {});
    D.toast('New presentation from ' + rec.name);
  };
  /** File ▸ Open: a native .sslide from Slop Drive, in a new tab linked to that file (the strip's picker and open). */
  F.openDrive = function () {
    if (!hub() || !api()) return null;
    return api().openFromDrive({ title: 'Open from Slop Drive' });
  };
  /** File ▸ Import: a PowerPoint, OpenDocument or picture file from Slop Drive, in a tab with no link. */
  F.importDrive = async function () {
    if (!hub()) return;
    var rec = await hub().pickFromDrive({ accept: [PPTX, ODP, 'image/*'], title: 'Import from Slop Drive' });
    if (rec) await F.openRecord(rec);
  };
  /** Opens a Drive record (full or summary) in a tab. A tab already showing that file is brought forward. Resolves true when a deck is open. */
  F.openRecord = async function (rec) {
    var full = rec.blob !== undefined ? rec : await hub().get(rec.id);
    if (!full) { D.toast('That file is no longer in Slop Drive'); return false; }
    var res;
    try { res = await N.read(full.blob, full.type, full.name); }
    catch (e) { D.toast('Could not open ' + full.name + ': ' + e.message); return false; }
    var named = N.fileName(res.deck.title);
    if (res.kind === 'foreign') {
      SS.tabs.open(res.deck, { name: named, origName: full.name });
      D.toast((res.type || 'This') + ' files cannot be opened in Slop Slides yet. Opened a blank presentation.', 4200);
    } else if (res.kind === 'image') {
      SS.tabs.open(res.deck, { name: named, origName: full.name });
      D.toast('Picture added to a new presentation');
    } else {
      var open = api().tabs().find(function (t) { return t.driveId === full.id; });
      if (open) api().activate(open.doc);
      else SS.tabs.open(res.deck, { name: full.name, origName: full.name }, full.id);
    }
    return true;
  };

  /** Saves the open presentation to Slop Drive: its own file (in place), or a new one. asNew: always a new file (Save as). Resolves true when written. */
  F.save = async function (asNew) {
    if (!hub()) { D.toast('Slop Drive is not available here'); return false; }
    var T = SS.tabs.current();
    if (!T) return false;
    SS.tabs.sync();
    var prev = api().driveIdOf(T);
    try {
      if (asNew) api().setDriveId(T, null);
      var id = await api().saveToDrive(T);
      if (!id && asNew) api().setDriveId(T, prev); // a cancelled Save as keeps the link
      return !!id;
    } catch (e) { D.toast('Could not save: ' + e.message, 4000); return false; }
  };
  F.download = function () {
    U.download(N.toBlob(A.deck), A.doc.name || N.fileName(A.deck.title));
    SlopSupport.afterExport('slides');
  };
  F.exportPptx = async function () {
    try {
      var r = await SS.pptx.write(A.deck);
      U.download(r.blob, N.fileName(A.deck.title).replace(/\.sslide$/, '.pptx'));
      SlopSupport.afterExport('slides');
      var left = r.skipped ? r.skipped + ' object' + (r.skipped === 1 ? ' was' : 's were') + ' left out (tables, charts and media are not in PowerPoint export yet). ' : '';
      D.toast(left + 'Slide transitions and object animations are not in the PowerPoint file. They are kept in the .sslide file.', 5200);
    } catch (e) { D.toast('Export failed: ' + e.message, 4000); }
  };
  F.exportPng = function () {
    var s = A.slide();
    if (!s) return;
    var cv = R.slideToCanvas(A.deck, s, 1920, { scene: { editor: false } });
    cv.toBlob(function (b) { U.download(b, (A.doc.name || 'slide').replace(/\.sslide$/, '') + ' ' + (A.idx + 1) + '.png'); SlopSupport.afterExport('slides'); }, 'image/png');
  };

  /** Boot: the tabs come back (session.js). A launch from Slop Drive opens in a tab of its own, and an untouched blank tab it
   * replaces is closed. The launch was read before this (main.js), because showing a tab rewrites the address bar. */
  F.boot = async function (launch) {
    var session = SS.tabs.mount();
    try { await session.restore(); } catch (e) { console.warn('Slop Slides: restore failed', e); }
    if (!SS.tabs.current()) SS.tabs.newTab();
    if (!launch) return;
    var blank = SS.tabs.isPristine(SS.tabs.current()) ? SS.tabs.current() : null;
    try { await F.openRecord(launch); } catch (e) { D.toast('Could not open: ' + e.message, 4000); }
    if (blank && SS.tabs.current() !== blank) await api().close(blank);
  };
})();
