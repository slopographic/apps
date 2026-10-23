// The boot and router that the document apps share (Slop Orders, Slop Quotes): opens the shared store, mounts the views,
// routes the #hash (list, new, <route>/<id>, data), and redraws the list when the store reports a change (from this tab or
// another). The editor is not redrawn under the person, and leaving it with unsaved changes asks first. View tabs are
// SlopTabs; the edit tab exists only while a document is open. Classic script.
// SlopDocs.docApp.start(cfg) sets ns.state and ns.app ({ show, go, route, boot }). cfg: { ns, app: 'orders', route: 'o',
// noun: 'order' }. The views are ns.views.list, .edit and .data ({ mount, refresh, onShow(arg) }).
(function (g) {
  'use strict';
  const D = (g.SlopDocs = g.SlopDocs || {});
  const VIEWS = ['list', 'edit', 'data'];

  function start(cfg) {
    const NS = cfg.ns, S = g.SlopData, UI = g.SlopUI;
    const $ = (id) => document.getElementById(id);
    let timer = 0, tabs = null;

    /** Shows one view and marks its tab. */
    function show(name, arg) {
      if (!VIEWS.includes(name)) return undefined;
      NS.state.view = name;
      $('tab-edit').hidden = name !== 'edit';
      tabs.show(name);
      if (g.SlopLayouts) g.SlopLayouts.refresh(cfg.app);
      const view = NS.views[name];
      return view && view.onShow ? view.onShow(arg) : undefined;
    }

    /** The route for the current hash: list, new, <route>/<id> or data. */
    function parse() {
      const h = location.hash.slice(1), pre = `${cfg.route}/`;
      if (h === 'data') return { view: 'data' };
      if (h === 'new') return { view: 'edit', arg: null };
      if (h.startsWith(pre) && h.length > pre.length) return { view: 'edit', arg: h.slice(pre.length) };
      return { view: 'list' };
    }

    /** Moves to a route ('list', 'new', '<route>/<id>', 'data'). Hash changes run route(). */
    function go(path) { location.hash = path; }

    async function route() {
      const t = parse();
      const staying = t.view === 'edit' && t.arg === NS.editor.id();
      if (NS.state.view === 'edit' && NS.editor.isDirty() && !staying) {
        const yes = await UI.confirm('Leave without saving', `This ${cfg.noun} has unsaved changes. Leave anyway?`, 'Leave', { danger: true });
        if (!yes) { history.replaceState(null, '', `#${NS.editor.route()}`); return; }
        NS.editor.clean();
      }
      show(t.view, t.arg);
    }

    function redrawList() {
      clearTimeout(timer);
      timer = setTimeout(() => { if (NS.state.view === 'list' && NS.views.list) NS.views.list.refresh(); }, 40);
    }

    async function boot() {
      const ready = await S.store.ready();
      if (!ready.ok) {
        $('boot').textContent = `Storage is not available here: ${NS.util.refusal(ready)}. Nothing can be saved in this window.`;
        return;
      }
      $('boot').hidden = true;
      // a tab click or the tab keys route through the #hash, which shows the view (route)
      tabs = g.SlopTabs.mount(document.querySelector('.tabs'), { select: (n) => go(n === 'edit' ? NS.editor.route() : n) });
      for (const name of VIEWS) if (NS.views[name] && NS.views[name].mount) NS.views[name].mount();
      NS.commands.init();
      if (g.SlopHub) { try { g.SlopHub.register(cfg.app); } catch (e) { /* the hub is optional */ } }
      S.store.subscribe(redrawList);
      addEventListener('hashchange', route);
      await route();
    }

    NS.state = { view: 'list' };
    NS.app = { show, go, route, boot };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
    else boot();
    return NS.app;
  }

  D.docApp = { start };
})(typeof window !== 'undefined' ? window : globalThis);
