/* Slop PDF — before a PDF leaves the app with old text under covers. Where Edit text (Lines, Paragraphs, the select tool's
   block), Remove, Replace or the selection's lift could not take the old text out of the page, a cover hides it
   (core/layers.js L.isCover): on screen it is gone, but the text is still in the file and anyone can copy or search it.
   This is the one place every way out asks first, once per save: Download (and Mod+S without Drive), Download with a
   password (ui/protect.js), Download selected pages, Split, Compress without rasterising, Save to Slop Drive and a tab's
   Save to Slop Drive, Send to and Convert (A.currentPdfBlob), and the assistant's export_pdf (ui/ai-commands.js). The
   choices: Save anyway; Make those pages images (each page with covers is drawn with its annotations and becomes an image
   page, as Apply redactions does: redact/apply.js R.rasterPage, R.imagePages; the old text is gone for good, the text on
   those pages can no longer be selected, the other pages stay as they are; one undo step); or Cancel (nothing is saved).
   Pages to images and lossy Compress draw every page as a picture anyway, so they do not ask. Classic script, loaded
   after ui/main.js. */
(function () {
  'use strict';
  var SP = window.SP, U = SP.util, E = SP.engine, A = SP.app, S = A._, L = SP.layers, R = SP.redact;

  /** The pages of a list that hold covers over old text: [{ p, n (its covers) }]. */
  A.coveredPages = function (pages) {
    return (pages || []).map(function (p) {
      return { p: p, n: (p.annots || []).filter(function (a) { return L.isCover(a) && !a.hidden; }).length };
    }).filter(function (x) { return x.n > 0; });
  };
  /** An error that ends a save the person cancelled: S.guarded (ui/exports.js) shows nothing for it. */
  function cancelled() { var e = new Error(U.t('pdf.io.cover_cancelled')); e.cancelled = true; return e; }

  /** The question, keyboard accessible (SlopUI.dialog: Tab stays in it, Enter takes the focused button, Escape cancels).
   * Resolves 'keep', 'images' or 'cancel'. */
  function ask(n) {
    return new Promise(function (res) {
      var choice = 'cancel', h = U.h;
      var body = h('div', null, h('p', { class: 'sui-p cover-warn' }, U.t('pdf.io.cover_body', { n: n })),
        h('p', { class: 'sui-p cover-images' }, U.t('pdf.io.cover_images_note')));
      SlopUI.dialog({
        title: U.t('pdf.io.cover_title'), body: body, cls: 'sui-narrow cover-save',
        buttons: [
          { label: U.t('menu.cancel') },
          { label: U.t('pdf.io.cover_keep'), act: function () { choice = 'keep'; } },
          { label: U.t('pdf.io.cover_images'), primary: true, act: function () { choice = 'images'; } }
        ],
        onClose: function () { res(choice); }
      });
    });
  }

  /** A page as it is drawn, annotations and all (no page numbers or watermark: those are stamped at the save), in a file
   * of its own that is not kept: what R.rasterPage draws for it. Comments and redaction marks stay annotations. */
  async function drawnPage(p) {
    var q = JSON.parse(JSON.stringify(p));
    q.annots = (p.annots || []).filter(function (a) { return !a.hidden && a.type !== 'note' && a.type !== 'redact'; });
    var bytes = await E.build({ pages: [q], stamps: false, meta: false });
    var f = await E.registerPdf(bytes, 'drawn.pdf', null, { id: U.uid('t'), silent: true, color: E.fileOfPage(p).color }); // i18n-ignore: an internal file
    f.noLog = true;
    return f;
  }
  /** Makes each page an image page with what it shows (the covers and the new text drawn in): one undo step. Resolves the
   * number of pages made images. */
  S.imageCovered = async function (pages, onProgress) {
    var temps = [], entries = [];
    try {
      for (var k = 0; k < pages.length; k++) {
        var p = pages[k];
        if (p.blank) continue;
        var f = await drawnPage(p);
        temps.push(f);
        entries.push({ p: p, from: { id: p.id, f: f.id, i: 0 }, boxes: [], cut: coverBoxes(p) }); // web links over old text go
        if (onProgress) onProgress((k + 1) / (2 * pages.length));
      }
      var made = await R.imagePages(entries, { name: U.t('pdf.io.cover_file_name'), onProgress: function (v) { if (onProgress) onProgress(0.5 + v / 2); } });
      if (!made.file) return 0;
      E.commit(U.t('pdf.io.cover_undo'), function (st) {
        st.pages.forEach(function (q) {
          if (!made.map.has(q.id)) return;
          // what the page showed is in its picture now; comments, redaction marks and hidden layers stay as they were
          q.annots = q.annots.filter(function (a) { return a.hidden || a.type === 'note' || a.type === 'redact'; });
          q.f = made.file.id; q.i = made.map.get(q.id); q.imaged = true;
        });
      });
      return made.map.size;
    } finally {
      temps.forEach(function (f) { E.files.delete(f.id); if (f.doc) f.doc.destroy(); });
    }
  };
  function coverBoxes(p) {
    var g = E.geom(p);
    return p.annots.filter(function (a) { return L.isCover(a) && !a.hidden; }).map(function (a) { return E.annotViewRect(a, 0, g.W, g.H); });
  }

  /** Asks before a save of these pages when some hold covers over old text. Resolves true to go on (as they are, or with
   * those pages made images first), false when the person cancelled or the pages could not be made images. */
  A.coverCheck = async function (pages) {
    var hit = A.coveredPages(pages);
    if (!hit.length) return true;
    if (Ed().isEditingText && Ed().isEditingText()) Ed().commitText();
    var choice = await ask(hit.reduce(function (s, x) { return s + x.n; }, 0));
    if (choice === 'keep') return true;
    if (choice !== 'images') return false;
    var label = U.t('pdf.io.cover_making');
    S.busy(label, 0);
    try {
      var n = await S.imageCovered(hit.map(function (x) { return x.p; }), function (f) { S.busy(label, f); });
      A.announce(U.t('pdf.io.cover_made', { n: n }));
      return true;
    } catch (e) {
      console.error(e);
      SlopUI.alert(U.t('pdf.act.err_title'), String((e && e.message) || e));
      return false;
    } finally { S.busy(null); }
  };
  function Ed() { return SP.editor; }

  /* --------------------------------------------- every way the PDF leaves */
  /** Wraps A[name]: pagesOf(args) are the pages it writes (null: it does not ask, as lossy Compress). */
  function guard(name, pagesOf) {
    var orig = A[name];
    A[name] = function () {
      var args = arguments, pages = E.state.pages.length ? pagesOf(args) : null;
      if (!pages || !A.coveredPages(pages).length) return orig.apply(A, args);
      return A.coverCheck(pages).then(function (go) { return go ? orig.apply(A, args) : null; });
    };
  }
  var all = function () { return E.state.pages; };
  guard('download', all);
  guard('extract', function (args) {
    var ids = new Set(Array.isArray(args[0]) ? args[0] : SP.organizer.selected());
    return E.state.pages.filter(function (p) { return ids.has(p.id); });
  });
  guard('split', function () {
    var groups; try { groups = SP.panels.splitGroups(); } catch (e) { return null; } // A.split says what is wrong
    var idx = new Set([].concat.apply([], groups));
    return E.state.pages.filter(function (p, i) { return idx.has(i); });
  });
  guard('compress', function (args) { return args[0] && args[0].mode === 'lossy' ? null : E.state.pages; });
  // Save to Slop Drive, a tab's Save to Slop Drive, Send to and Convert build the PDF here (ui/main.js, doc-tabs.js,
  // open-convert.js): inside their busy step, so a cancel is an error they show nothing for
  var blob = A.currentPdfBlob;
  A.currentPdfBlob = async function () {
    if (!(await A.coverCheck(E.state.pages))) throw cancelled();
    return blob.apply(A, arguments);
  };
})();
