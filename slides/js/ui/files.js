/* Slop Slides: files. Opening and saving go through Slop Drive: a file opened with ?drive=<id> (or picked from the
   Drive) is saved back to the same id with SlopHub.put, and a new presentation is saved with SlopHub.saveToDrive the
   first time. A zero-byte .sslide (Drive's New menu) opens as a blank deck. Pictures open as a one-slide deck and
   other formats open as a blank deck with no link, so Save can never overwrite a file this editor did not write.
   Also: the .sslide download, PowerPoint and PNG export, and restoring the autosaved draft at boot. Exposes SS.files. */
(function () {
  'use strict';
  var SS = window.SS, A = SS.app, N = SS.native, U = SS.util, D = SS.dom, R = SS.canvasRender;
  var F = SS.files = {};
  var PPTX = 'application/vnd.openxmlformats-officedocument.presentationml.presentation';
  var ODP = 'application/vnd.oasis.opendocument.presentation';
  var hub = function () { return window.SlopHub || null; };

  /** Puts the Drive id in the address bar (so a reload reopens the same file) or takes it out. */
  function setUrl(id) {
    try {
      var u = new URL(location.href);
      if (id) u.searchParams.set('drive', id); else u.searchParams.delete('drive');
      history.replaceState(null, '', u.pathname + u.search + u.hash);
    } catch (e) { /* not a real URL (file://) */ }
  }
  /** Runs fn now, or after the user agrees to drop unsaved edits (the draft is kept in this browser either way). */
  F.confirm = async function (fn) {
    if (!A.dirty || !window.SlopUI) return fn();
    var ok = await SlopUI.confirm('Leave unsaved changes?', 'This presentation has changes that are not saved to Slop Drive. They stay in a draft in this browser, but this action replaces the open presentation.', 'Continue', { danger: true });
    if (ok) return fn();
  };
  F.newDeck = function () {
    F.confirm(function () { A.load(N.blank(), {}); setUrl(null); D.toast('New presentation'); });
  };
  /** A new presentation built from one of the starter templates (they are ordinary, editable decks). */
  F.fromTemplate = function (id) {
    var t = SS.templates.byId(id);
    if (!t) return;
    F.confirm(function () { A.load(t.build(), {}); setUrl(null); D.toast('New presentation from ' + t.name); });
  };
  /** A new presentation from one of "My templates" (a record from SS.templateStore; its deck is re-checked and copied). */
  F.fromStored = function (rec) {
    F.confirm(function () { A.load(N.normalize(U.clone(rec.deck)), {}); setUrl(null); D.toast('New presentation from ' + rec.name); });
  };
  F.openDrive = function () {
    if (!hub()) return;
    F.confirm(async function () {
      var rec = await hub().pickFromDrive({ accept: [N.MIME, PPTX, ODP, 'image/*'] });
      if (rec) await F.openRecord(rec);
    });
  };
  /** Opens a Drive record (full or summary). Resolves true when a deck is now open. */
  F.openRecord = async function (rec) {
    var full = rec.blob !== undefined ? rec : await hub().get(rec.id);
    if (!full) { D.toast('That file is no longer in Slop Drive'); return false; }
    var res;
    try { res = await N.read(full.blob, full.type); }
    catch (e) { D.toast('Could not open ' + full.name + ': ' + e.message); return false; }
    var named = N.fileName(res.deck.title);
    if (res.kind === 'foreign') {
      A.load(res.deck, { driveId: null, name: named });
      setUrl(null);
      D.toast((res.type || 'This') + ' files cannot be opened in Slop Slides yet. Opened a blank presentation.', 4200);
    } else if (res.kind === 'image') {
      A.load(res.deck, { driveId: null, name: named });
      setUrl(null);
      D.toast('Picture added to a new presentation');
    } else {
      A.load(res.deck, { driveId: full.id, name: full.name });
      setUrl(full.id);
    }
    return true;
  };

  /** Saves to Slop Drive. asNew: always ask for a new file (Save as). Resolves true when the file is written. */
  F.save = async function (asNew) {
    if (!hub()) { D.toast('Slop Drive is not available here'); return false; }
    var deck = A.deck, blob = N.toBlob(deck), id = asNew ? null : A.doc.driveId;
    try {
      if (id) {
        var old = await hub().get(id);
        await hub().put(blob, { id: id, name: A.doc.name || N.fileName(deck.title), from: 'slides', folderId: old ? old.folderId : null });
        if (old && (old.starred || old.trashedAt)) await hub().update(id, { starred: old.starred, trashedAt: old.trashedAt }, { touch: false });
        A.markSaved(id, A.doc.name || N.fileName(deck.title));
        setUrl(id);
        D.toast('Saved to Slop Drive');
        return true;
      }
      var name = N.fileName(deck.title);
      var nid = await hub().saveToDrive(blob, name, { from: 'slides' });
      if (!nid) return false;
      A.markSaved(nid, name);
      setUrl(nid);
      return true;
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

  /** Boot: a launch from Slop Drive, else the autosaved draft, else a blank deck. */
  F.boot = async function (launch) {
    var draft = SS.draft ? await SS.draft.load() : null;
    if (launch) {
      if (draft && draft.driveId === launch.id && draft.savedAt > (launch.modified || launch.time || 0)) {
        A.load(N.normalize(draft.deck), { driveId: launch.id, name: launch.name, dirty: true });
        setUrl(launch.id);
        D.toast('Restored your unsaved changes');
        return;
      }
      if (!(await F.openRecord(launch))) A.load(N.blank(), {});
      return;
    }
    if (draft && draft.deck) {
      try {
        A.load(N.normalize(draft.deck), { driveId: draft.driveId || null, name: draft.name || N.DEFAULT_NAME, dirty: true });
        setUrl(draft.driveId || null);
        D.toast('Restored your draft');
        return;
      } catch (e) { /* damaged draft: start blank */ }
    }
    A.load(N.blank(), {});
  };
})();
