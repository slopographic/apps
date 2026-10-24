// The boot and #hash router every business app shares: opens the shared store (a plain message when it cannot), mounts the
// views, wires the view tabs (SlopTabs, shared/ui/tabs.js), registers the commands and the hub, redraws the current view
// when the store reports a change (from this tab or another), and shows a view for each hash. Classic script.
// SlopBiz.router.start(cfg) sets ns.app = { go, route, boot, parse, show } and returns it. cfg:
//   ns, app                 the namespace (ns.views, ns.commands, ns.util) and the app id ('expenses')
//   parse(hash)             -> { view, arg?, ... } for the hash without '#'
//   editRoute()             the hash the edit tab goes to (default: the current hash, or 'new')
//   editLabel?(t)           the edit tab's text for a route
//   leave?(t)               async: false keeps the person where they are (unsaved changes); the hash is put back
//   current?()              the hash to put back when leave() says no
// The views are ns.views[name] = { mount?, show?(arg, t) (or onShow), refresh? }. The edit tab (#tab-edit) shows only on the edit view.
(function (g) {
  'use strict';
  const B = (g.SlopBiz = g.SlopBiz || {});

  function start(cfg) {
    const NS = cfg.ns, $ = (id) => document.getElementById(id);
    let tabs = null, timer = 0, at = null;

    /** Moves to a route. Hash changes run route(). */
    const go = (path) => { location.hash = path; };

    /** Shows one view for a parsed route and marks its tab. */
    async function show(t) {
      at = t;
      NS.state = Object.assign(NS.state || {}, { view: t.view });
      const edit = $('tab-edit');
      if (edit) { edit.hidden = t.view !== 'edit'; if (cfg.editLabel) edit.textContent = cfg.editLabel(t); }
      tabs.show(t.view);
      if (g.SlopLayouts) g.SlopLayouts.refresh(cfg.app);
      const v = NS.views[t.view];
      const fn = v && (v.show || v.onShow);
      return fn ? fn(t.arg, t) : undefined;
    }

    async function route() {
      const t = cfg.parse(location.hash.slice(1));
      if (at && cfg.leave && !(await cfg.leave(t, at))) { history.replaceState(null, '', `#${cfg.current()}`); return; }
      await show(t);
    }

    function redraw() {
      clearTimeout(timer);
      timer = setTimeout(() => { const v = at && NS.views[at.view]; if (v && v.refresh) v.refresh(); }, 40);
    }

    async function boot() {
      const S = g.SlopData, ready = await S.store.ready();
      if (!ready.ok) { $('boot').textContent = `Storage is not available here: ${B.refusal(ready)}. Nothing can be saved in this window.`; return; }
      $('boot').hidden = true;
      const editRoute = cfg.editRoute || (() => location.hash.slice(1) || 'new');
      tabs = g.SlopTabs.mount(document.querySelector('.tabs'), { select: (name) => go(name === 'edit' ? editRoute() : name) });
      for (const v of Object.values(NS.views)) if (v.mount) v.mount();
      if (NS.commands) NS.commands.init();
      if (g.SlopHub) { try { g.SlopHub.register(cfg.app); } catch (e) { /* the hub is optional */ } }
      S.store.subscribe(redraw);
      addEventListener('hashchange', route);
      await route();
    }

    NS.views = NS.views || {};
    NS.app = { go, route, boot, parse: () => cfg.parse(location.hash.slice(1)), show: (name, arg) => show({ view: name, arg }) };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
    else boot();
    return NS.app;
  }

  B.router = { start };
})(typeof window !== 'undefined' ? window : globalThis);
