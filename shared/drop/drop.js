/* SlopDrop: one call per app. SlopDrop.attach(zone, o) draws the drop zone (message, Choose files, progress list),
   outlines the targets and labels "Drop to add N files" while a file drag is over the window, takes only the files the
   rules allow (refusals say why), hands each accepted file to the app's own reader (o.process) one at a time, and then
   reports: o.done(summary), a toast, and the new item scrolled into view (o.reveal). Routing and feedback only: the
   app reads and decodes files as before. Loads after rules.js and panel.js. See shared/drop/HANDOFF.md. */
(function (root) {
  'use strict';
  const SD = (root.SlopDrop = root.SlopDrop || {});
  const R = SD.rules, PN = SD.panel, doc = root.document;

  const isFiles = (e) => !!e.dataTransfer && Array.from(e.dataTransfer.types || []).includes('Files');
  /** One MIME type per file in the drag ('' when the browser does not say). The names are hidden until the drop. */
  function dragTypes(dt) {
    const files = Array.from(dt.items || []).filter((i) => i.kind === 'file');
    return files.length ? files.map((i) => i.type || '') : [''];
  }
  function reveal(el) {
    if (!el) return;
    try { el.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); } catch (e) { /* older browsers */ }
    el.classList.remove('sd-flash');
    void el.offsetWidth;
    el.classList.add('sd-flash');
    setTimeout(() => el.classList.remove('sd-flash'), 1300);
  }

  /** Attach the drop feedback to a zone. o:
   *   accept: rules { types, exts, noun, maxBytes } (see rules.js); files that fail are refused with a reason.
   *   process(file, progress, ctx): the app's own reader for one accepted file. Resolves with a value (the item id,
   *     say) or throws Error(reason). progress(0..1) is optional; without it the bar shows motion while reading.
   *     ctx: { at: { x, y } client point of a drop (null from Choose files), index: the file's place among the added ones }.
   *   begin(files)?: before the first file is read. done(summary)?: after the last one, summary = { added: [{ name,
   *     value }], skipped: [{ name, reason }] }. reveal(summary)?: returns the element to scroll into view and flash.
   *   files?(dataTransfer, event) → File[] (or a Promise of one): the files of a drop, when the app reads them itself
   *     (folders). Called inside the drop event, so the event's own target is still the one the drop landed on.
   *   targets?: elements that take drops (default: the zone). A null in the list (a missing element) is skipped; with none
   *     left, the zone takes the drops. They are outlined while a file drag is over the window.
   *   input?: an existing <input type=file> to use for Choose files (its change event runs the same batch).
   *   limit?: most files taken in one drop (the rest are refused with a reason). overlay?: false to skip the outlines
   *     and label (for an app that marks its own drop areas). window?: false leaves the rest of the page alone: only the
   *     targets take drops (marked .sd-over while a file is over them). label?, hint?: text for the zone.
   *   toast?: false to hide the toast. multiple?: default true. compact?: one row (message and button), for a strip.
   *   preview?: { picture, steps }: what the app makes and how, shown in the zone above the prompt (not when compact).
   *     picture: { src, alt } | { flow: { from, to } } | an element; steps: three short lines.
   *   sample?: { label?, files: () => File[] | Promise<File[]> }: a "Try it with a sample" button whose files go
   *     through the same batch as a drop (shared/samples/samples.js makes sample files).
   *  Returns { choose(), run(files), sample(), destroy() }. */
  SD.attach = function (zone, o) {
    if (!zone) return null; // the page has no drop zone: nothing to attach, and no error
    o = o || {};
    const rules = o.accept || {};
    // A target that is missing from this page (a page without that element, a null from $('id')) is skipped, never an
    // error. When none is left, the zone itself takes the drops, so the zone still works.
    const listed = (o.targets || []).filter(Boolean);
    const targets = listed.length ? listed : [zone];
    const limit = o.limit || Infinity;
    const ui = PN.build(zone, { label: o.label, hint: o.hint || rules.hint, compact: o.compact, preview: o.preview, sample: o.sample });
    const input = o.input || doc.createElement('input');
    input.type = 'file';
    input.multiple = o.multiple !== false;
    input.accept = R.acceptAttr(rules);
    if (!o.input) { input.hidden = true; zone.append(input); }
    ui.choose.addEventListener('click', () => input.click());
    /** The sample's files, through the same batch as a drop. */
    /** Making the files can take a moment (recorded clips): the status line says so and the button waits. */
    const trySample = () => {
      if (!o.sample) return Promise.resolve();
      if (ui.sample) ui.sample.disabled = true;
      ui.status.textContent = 'Preparing the sample…';
      const files = Promise.resolve().then(() => o.sample.files()).finally(() => { if (ui.sample) ui.sample.disabled = false; });
      return run(files);
    };
    if (ui.sample) ui.sample.addEventListener('click', trySample);
    const onPick = () => { const files = Array.from(input.files || []); input.value = ''; if (files.length) run(files); };
    input.addEventListener('change', onPick);

    let chain = Promise.resolve();
    let tidy = null;
    /** After a batch with no problems the file rows and the status line go, so the strip is its plain prompt again. */
    /** The timers are optional: a host without them (a test sandbox) just keeps the rows. */
    const cancelTidy = () => { if (tidy && typeof clearTimeout === 'function') clearTimeout(tidy); tidy = null; };
    const tidyLater = () => {
      cancelTidy();
      if (typeof setTimeout !== 'function') return;
      tidy = setTimeout(() => { ui.list.replaceChildren(); ui.status.textContent = ''; }, 3000);
      if (tidy && tidy.unref) tidy.unref(); // a node test does not wait on this tidy-up
    };
    /** Runs one batch after the previous one (drops during a batch queue up). */
    function run(list, at) {
      chain = chain.then(() => batch(list, at)).catch((err) => console.error('SlopDrop', err));
      return chain;
    }
    // Paste is the same batch as a drop: a copied file (or a picture copied from a web page) that the rules accept goes
    // through o.process like a dropped one. o.paste may give hasOpen/openName (then pasting asks Add or New document) and
    // onAdd (the app's own add path; by default the batch runs as usual). Needs shared/intake (SlopIntake) on the page.
    if (root.SlopIntake && o.paste !== false) {
      const P = o.paste || {};
      root.SlopIntake.attach({
        accept: (f) => R.check(f, rules).ok,
        hasOpen: P.hasOpen,
        openName: P.openName,
        onAdd: P.onAdd ? (files) => P.onAdd(files) : (files) => run(files),
        onNew: (files) => run(files),
      });
    }
    async function batch(list, at) {
      let files;
      try { files = Array.from((await list) || []); } catch (err) { ui.status.textContent = ''; PN.toast('Could not read the dropped files', 'warn'); return; }
      if (!files.length) return;
      cancelTidy();
      ui.list.replaceChildren();
      const take = [], added = [], skipped = [];
      for (const f of files) {
        const c = R.check(f, rules);
        const reason = !c.ok ? c.reason : take.length >= limit ? f.name + ' is not taken: ' + (limit === 1 ? 'only one file at a time' : 'only ' + limit + ' files at a time') : '';
        if (!reason) { take.push(f); continue; }
        skipped.push({ name: f.name, reason });
        PN.row(ui.list, f.name, R.size(f.size)).set('error', reason);
      }
      if (o.begin && take.length) { try { o.begin(take); } catch (err) { console.error('SlopDrop begin', err); } }
      for (const f of take) {
        const row = PN.row(ui.list, f.name, R.size(f.size));
        try {
          const value = await o.process(f, (p) => row.progress(p), { at, index: added.length });
          row.set('ready', 'Ready');
          added.push({ name: f.name, value });
        } catch (err) {
          const msg = (err && err.message) || 'could not be read';
          const reason = msg.includes(f.name) ? msg : f.name + ' ' + msg;
          row.set('error', reason);
          skipped.push({ name: f.name, reason });
        }
      }
      if (added.length && ui.wrap) ui.wrap.classList.add('sd-has');
      const summary = { added, skipped };
      const text = R.describe(summary);
      ui.status.textContent = text;
      if (!skipped.length) tidyLater();
      if (o.done) { try { o.done(summary); } catch (err) { console.error('SlopDrop done', err); } }
      if (added.length && o.reveal) { try { reveal(o.reveal(summary)); } catch (err) { console.error('SlopDrop reveal', err); } }
      if (o.toast !== false) PN.toast(text, added.length ? '' : 'warn');
    }

    // Window: a file drag shows the outlines and the label over every target; a drop elsewhere says where to drop.
    let depth = 0, shown = false;
    const hide = () => { depth = 0; shown = false; PN.hideHints(); };
    const onEnter = (e) => {
      if (!isFiles(e)) return;
      depth++;
      if (!shown) { shown = true; if (o.overlay !== false) PN.showHints(targets, R.dragLabel(dragTypes(e.dataTransfer), rules)); }
    };
    const onLeave = (e) => { if (!isFiles(e)) return; depth = Math.max(0, depth - 1); if (!depth) hide(); };
    const onOver = (e) => { if (!isFiles(e)) return; e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; if (shown) PN.placeHints(); };
    const onWindowDrop = (e) => {
      if (!isFiles(e)) return;
      e.preventDefault();
      hide();
      if (!e.sdHandled && !e.sdSeen) PN.toast('Drop files on the highlighted area', 'warn');
      e.sdSeen = true;
    };
    const onScroll = () => { if (shown) PN.placeHints(); };
    const onTargetDrop = (e) => {
      if (!isFiles(e)) return;
      e.preventDefault();
      // A nearer target (a lane, a list) took this drop: the outer target must not import it again.
      if (e.sdHandled) return;
      e.sdHandled = true;
      hide();
      // o.files(dataTransfer) is read now, inside the drop event (folder entries must be), and may resolve later.
      const list = o.files ? o.files(e.dataTransfer, e) : Array.from((e.dataTransfer && e.dataTransfer.files) || []);
      run(list, { x: e.clientX, y: e.clientY });
    };
    const win = root;
    // window: false leaves the page alone (no window outline, no drops taken elsewhere): only the targets react.
    const winOn = o.window !== false;
    if (winOn) {
      win.addEventListener('dragenter', onEnter);
      win.addEventListener('dragleave', onLeave);
      win.addEventListener('dragover', onOver);
      win.addEventListener('drop', onWindowDrop);
      win.addEventListener('scroll', onScroll, { capture: true, passive: true });
    }
    const onTargetOver = (e) => { if (isFiles(e)) { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; } };
    const onTargetEnter = (e) => { if (isFiles(e)) e.currentTarget.classList.add('sd-over'); };
    const onTargetLeave = (e) => { if (!e.currentTarget.contains(e.relatedTarget)) e.currentTarget.classList.remove('sd-over'); };
    const onTargetEnd = (e) => e.currentTarget.classList.remove('sd-over');
    for (const t of targets) {
      t.addEventListener('dragover', onTargetOver);
      t.addEventListener('dragenter', onTargetEnter);
      t.addEventListener('dragleave', onTargetLeave);
      t.addEventListener('drop', onTargetEnd);
      t.addEventListener('drop', onTargetDrop);
    }

    return {
      choose: () => input.click(),
      run,
      sample: trySample,
      /** Whether the app has nothing in it yet: the preview and the sample button show only then. A batch that adds files
       *  sets it to false; an app's Clear sets it back with empty(true). */
      empty(v) { if (ui.wrap) ui.wrap.classList.toggle('sd-has', !v); },
      destroy() {
        if (winOn) {
          win.removeEventListener('dragenter', onEnter);
          win.removeEventListener('dragleave', onLeave);
          win.removeEventListener('dragover', onOver);
          win.removeEventListener('drop', onWindowDrop);
          win.removeEventListener('scroll', onScroll, { capture: true });
        }
        for (const t of targets) {
          t.removeEventListener('dragover', onTargetOver);
          t.removeEventListener('dragenter', onTargetEnter);
          t.removeEventListener('dragleave', onTargetLeave);
          t.removeEventListener('drop', onTargetEnd);
          t.removeEventListener('drop', onTargetDrop);
        }
        input.removeEventListener('change', onPick);
        hide();
      },
    };
  };
})(typeof window !== 'undefined' ? window : globalThis);
