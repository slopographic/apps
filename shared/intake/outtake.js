/* SlopOuttake: the one way files go OUT of an app, the counterpart of SlopIntake. One builder makes the "Open in…" items
   for the toolbar button, the More menu, File ▸ Send to and every context menu, so they cannot drift apart:
     1. the handovers apps registered for this output (richer than a plain file: PhotoSlop as a layer with its mask...),
     2. every app in the registry that takes the output's type (SlopHub.appsAccepting), the file going through Slop Drive
        (SlopHub.sendTo: the target opens on ?drive=<id> and takes it with SlopIntake.launch),
     3. Slop Workflows' "Run a workflow…" and "Add to a workflow…" (SlopWorkflowEntry.menuItems, shared/ops/entry.js, when
        the page has it; they stand in for "Open in Slop Workflows"), the items other shared features add
        (SlopOuttake.extend), and the listeners of the 'slop:outtake' event (phase 'items': detail.add(item)),
     4. "Save to Slop Drive…".
   SlopHub.openIn(o) and SlopHub.sendMenuItems (shared/hub.js) are this builder. Classic script, after shared/hub.js (it
   needs SlopHub; without it the list is only the extensions). See
   shared/intake/HANDOFF.md.
     SlopOuttake.items(o) → menu items ({ label, act, to? (the app it opens) }, for SlopUI.menu or an app menu; separators: true adds '-' lines)
       o: { get() → Blob | Promise<Blob>, name: string | () => string, type, from? (the app id, default the page's),
            verb? ('Open in'; 'Send to' for the older menus), folder? (Save to Slop Drive…, default true), exclude? [ids] }
     SlopOuttake.menu(at, o)       opens the items in a SlopUI menu at an element or { x, y }
     SlopOuttake.button(o, opts)   a toolbar button "Open in…" that opens the menu under itself
     SlopOuttake.handover({ from, to, types?, label, run(ctx), replaces? }) → off()   a richer handover to one app
     SlopOuttake.extend(fn(ctx) → items | null) → off()                               items from a shared feature
     SlopOuttake.send(to, o)       the plain handover to one app (what an app item does)
   Event 'slop:outtake' on document: { phase: 'items', from, type, ctx, add(item) } while a menu is made (the menus are
   often made before the output exists: ctx.name() and ctx.blob() are read only when an item acts), and
   { phase: 'sent', from, to, type, name, id } after a file went out. */
(function () {
  'use strict';
  if (window.SlopOuttake) return;
  const O = (window.SlopOuttake = {});
  const H = () => (document.documentElement.dataset.offline ? null : window.SlopHub || null);
  const toast = (m) => { if (window.SlopUI && window.SlopUI.toast) window.SlopUI.toast(m); };
  const handovers = [], extensions = [];
  const EVENT = 'slop:outtake';
  O.EVENT = EVENT;

  const typeMatches = (type, list) => !list || !list.length || list.some((p) => (H() ? H().matches(type, p) : p === type || (p.endsWith('/*') && type.startsWith(p.slice(0, -1)))));
  /** The context every handover and extension gets: the output, read once on first use. */
  function context(o) {
    let blob = null;
    const from = o.from || (H() && H().self && H().self.app) || '';
    const ctx = {
      from, type: o.type || '', data: o.data || null,
      name: () => (typeof o.name === 'function' ? o.name() : o.name) || 'Untitled',
      blob: () => (blob = blob || Promise.resolve().then(() => o.get())),
    };
    return ctx;
  }
  function emit(detail) { document.dispatchEvent(new CustomEvent(EVENT, { detail })); }

  /** The plain handover: the file to Slop Drive and the app opened on it (a new tab). Resolves the Drive id. */
  O.send = async function (to, o) {
    const ctx = o && o.blob ? o : context(o);
    const hub = H();
    if (!hub) throw new Error('Slop Drive is not available here');
    const app = hub.appById(to);
    const id = await hub.sendTo(to, await ctx.blob(), ctx.name(), { from: ctx.from || undefined });
    emit({ phase: 'sent', from: ctx.from, to, type: ctx.type, name: ctx.name(), id });
    toast('Opened in ' + (app ? app.name : to));
    return id;
  };
  const guard = (fn) => async () => { try { await fn(); } catch (e) { toast('Could not send: ' + ((e && e.message) || e)); } };

  /** The items for one output (see the header). */
  O.items = function (o) {
    o = o || {};
    const ctx = context(o), verb = o.verb || 'Open in', out = [];
    const exclude = new Set(o.exclude || []);
    const hub = H();
    const mine = handovers.filter((h) => (!h.from || h.from === ctx.from) && typeMatches(ctx.type, h.types));
    for (const h of mine) {
      if (h.when && !h.when(ctx)) continue;
      out.push({ label: h.label, to: h.to, act: guard(async () => { const r = await h.run(ctx); emit({ phase: 'sent', from: ctx.from, to: h.to, type: ctx.type, name: ctx.name(), id: r }); }) });
    }
    const replaced = new Set(mine.filter((h) => h.replaces && h.to).map((h) => h.to));
    // Slop Workflows comes in one way: its own entry (shared/ops/entry.js) gives "Run a workflow…" and "Add to a
    // workflow…" (which opens the Workflows page on the file), so its plain "Open in Slop Workflows" is not listed twice.
    const WF = window.SlopWorkflowEntry;
    if (WF) replaced.add('workflows');
    if (hub) {
      for (const a of hub.appsAccepting(ctx.type)) {
        if (exclude.has(a.id) || replaced.has(a.id) || a.id === ctx.from) continue;
        out.push({ label: verb + ' ' + a.name, to: a.id, act: guard(() => O.send(a.id, ctx)) });
      }
    }
    const extra = [];
    if (WF && ctx.from !== 'workflows') {
      const asFile = async () => { const b = await ctx.blob(); return b && b.name ? b : new File([b], ctx.name(), { type: ctx.type || b.type || '' }); };
      try { extra.push(...WF.menuItems(async () => [await asFile()], { app: ctx.from })); } catch (e) { console.warn('SlopWorkflowEntry', e); }
    }
    for (const fn of extensions) { try { extra.push(...[].concat(fn(ctx) || [])); } catch (e) { console.warn('SlopOuttake extension', e); } }
    emit({ phase: 'items', from: ctx.from, type: ctx.type, ctx, add: (item) => { if (item) extra.push(item); } });
    if (extra.length) out.push(...(out.length && o.separators ? ['-'] : []), ...extra);
    if (hub && o.folder !== false) {
      out.push({ label: 'Save to Slop Drive…', act: async () => {
        try {
          const id = await hub.saveToDrive(await ctx.blob(), ctx.name(), { from: ctx.from || undefined });
          if (id) emit({ phase: 'sent', from: ctx.from, to: 'drive', type: ctx.type, name: ctx.name(), id });
        } catch (e) { toast('Could not save: ' + ((e && e.message) || e)); }
      } });
    }
    return out;
  };

  /** Opens the items in a SlopUI menu at an element (under it) or a point. */
  O.menu = function (at, o) {
    const items = O.items(Object.assign({ separators: true }, o));
    const list = items.length ? items : [{ label: 'No app opens this yet', disabled: true }];
    let x = 0, y = 0;
    if (at && at.getBoundingClientRect) { const r = at.getBoundingClientRect(); x = r.left; y = r.bottom + 4; } else if (at) { x = at.x; y = at.y; }
    if (window.SlopUI && window.SlopUI.menu) window.SlopUI.menu(list, x, y);
    return list;
  };
  /** A toolbar button that opens the menu. opts: { label ('Open in…'), cls, title }. o may be a function (read on click). */
  O.button = function (o, opts) {
    opts = opts || {};
    const b = document.createElement('button');
    b.type = 'button';
    b.className = opts.cls || 'sui-btn';
    b.textContent = opts.label || 'Open in…';
    if (opts.title) b.title = opts.title;
    b.setAttribute('aria-haspopup', 'menu');
    b.addEventListener('click', () => O.menu(b, typeof o === 'function' ? o() : o));
    return b;
  };

  /** A richer handover from one app (from) to another (to) for some types: it is listed first, and with replaces: true
   *  it stands in for that app's plain item. run(ctx) does the work (ctx.blob(), ctx.name(), ctx.type). */
  O.handover = function (h) {
    if (!h || !h.label || typeof h.run !== 'function') throw new Error('SlopOuttake.handover: label and run are needed');
    handovers.push(h);
    return () => { const i = handovers.indexOf(h); if (i >= 0) handovers.splice(i, 1); };
  };
  /** Items from a shared feature for every output (fn(ctx) → items or null). */
  O.extend = function (fn) {
    extensions.push(fn);
    return () => { const i = extensions.indexOf(fn); if (i >= 0) extensions.splice(i, 1); };
  };
})();
