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
   *   process(file, progress): the app's own reader for one accepted file. Resolves with a value (the item id,
   *     say) or throws Error(reason). progress(0..1) is optional; without it the bar shows motion while reading.
   *   begin(files)?: before the first file is read. done(summary)?: after the last one, summary = { added: [{ name,
   *     value }], skipped: [{ name, reason }] }. reveal(summary)?: returns the element to scroll into view and flash.
   *   targets?: elements that take drops (default: the zone). They are outlined while a file drag is over the window.
   *   input?: an existing <input type=file> to use for Choose files (its change event runs the same batch).
   *   label?, hint?: text for the zone. toast?: false to hide the toast. multiple?: default true.
   *  Returns { choose(), run(files), destroy() }. */
  SD.attach = function (zone, o) {
    const rules = o.accept || {};
    const targets = o.targets && o.targets.length ? o.targets : [zone];
    const ui = PN.build(zone, { label: o.label, hint: o.hint || rules.hint });
    const input = o.input || doc.createElement('input');
    input.type = 'file';
    input.multiple = o.multiple !== false;
    input.accept = R.acceptAttr(rules);
    if (!o.input) { input.hidden = true; zone.append(input); }
    ui.choose.addEventListener('click', () => input.click());
    const onPick = () => { const files = Array.from(input.files || []); input.value = ''; if (files.length) run(files); };
    input.addEventListener('change', onPick);

    let chain = Promise.resolve();
    /** Runs one batch after the previous one (drops during a batch queue up). */
    function run(list) {
      chain = chain.then(() => batch(list)).catch((err) => console.error('SlopDrop', err));
      return chain;
    }
    async function batch(list) {
      const files = Array.from(list || []);
      if (!files.length) return;
      ui.list.replaceChildren();
      const take = [], added = [], skipped = [];
      for (const f of files) {
        const c = R.check(f, rules);
        if (c.ok) { take.push(f); continue; }
        skipped.push({ name: f.name, reason: c.reason });
        PN.row(ui.list, f.name, R.size(f.size)).set('error', c.reason);
      }
      if (o.begin && take.length) { try { o.begin(take); } catch (err) { console.error('SlopDrop begin', err); } }
      for (const f of take) {
        const row = PN.row(ui.list, f.name, R.size(f.size));
        try {
          const value = await o.process(f, (p) => row.progress(p));
          row.set('ready', 'Ready');
          added.push({ name: f.name, value });
        } catch (err) {
          const msg = (err && err.message) || 'could not be read';
          const reason = msg.includes(f.name) ? msg : f.name + ' ' + msg;
          row.set('error', reason);
          skipped.push({ name: f.name, reason });
        }
      }
      const summary = { added, skipped };
      const text = R.describe(summary);
      ui.status.textContent = text;
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
      if (!shown) { shown = true; PN.showHints(targets, R.dragLabel(dragTypes(e.dataTransfer), rules)); }
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
      e.sdHandled = true;
      hide();
      const files = e.dataTransfer.files;
      if (files && files.length) run(files);
    };
    const win = root;
    win.addEventListener('dragenter', onEnter);
    win.addEventListener('dragleave', onLeave);
    win.addEventListener('dragover', onOver);
    win.addEventListener('drop', onWindowDrop);
    win.addEventListener('scroll', onScroll, { capture: true, passive: true });
    for (const t of targets) t.addEventListener('drop', onTargetDrop);

    return {
      choose: () => input.click(),
      run,
      destroy() {
        win.removeEventListener('dragenter', onEnter);
        win.removeEventListener('dragleave', onLeave);
        win.removeEventListener('dragover', onOver);
        win.removeEventListener('drop', onWindowDrop);
        win.removeEventListener('scroll', onScroll, { capture: true });
        for (const t of targets) t.removeEventListener('drop', onTargetDrop);
        input.removeEventListener('change', onPick);
        hide();
      },
    };
  };
})(typeof window !== 'undefined' ? window : globalThis);
