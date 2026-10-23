// Slop Orders boot: opens the shared store, mounts the views, routes the #hash (list, new, o/<id>, data), and redraws
// the list when the store reports a change (from this tab or another). The editor is not redrawn under the person.
(function (g) {
  'use strict';
  const S = g.SlopData;
  const NS = (g.SlopOrders = g.SlopOrders || {});
  const UI = g.SlopUI;
  const $ = (id) => document.getElementById(id);
  const VIEWS = ['list', 'edit', 'data'];
  let timer = 0, tabs = null;

  /** Shows one view and marks its tab (SlopTabs, shared/ui/tabs.js). The edit tab exists only while an order is open. */
  function show(name, arg) {
    if (!VIEWS.includes(name)) return undefined;
    NS.state.view = name;
    $('tab-edit').hidden = name !== 'edit';
    tabs.show(name);
    if (window.SlopLayouts) SlopLayouts.refresh('orders');
    const view = NS.views[name];
    return view && view.onShow ? view.onShow(arg) : undefined;
  }

  /** The route for the current hash: list, new, o/<id> or data. */
  function parse() {
    const h = location.hash.slice(1);
    if (h === 'data') return { view: 'data' };
    if (h === 'new') return { view: 'edit', arg: null };
    if (h.startsWith('o/') && h.length > 2) return { view: 'edit', arg: h.slice(2), route: h };
    return { view: 'list' };
  }

  /** Moves to a route ('list', 'new', 'o/<id>', 'data'). Hash changes run route(). */
  function go(path) { location.hash = path; }

  async function route() {
    const t = parse();
    const onOrder = NS.state.view === 'edit';
    const staying = t.view === 'edit' && t.arg === NS.editor.id();
    if (onOrder && NS.editor.isDirty() && !staying) {
      const yes = await UI.confirm('Leave without saving', 'This order has unsaved changes. Leave anyway?', 'Leave', { danger: true });
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
    if (g.SlopHub) { try { SlopHub.register('orders'); } catch (e) { /* the hub is optional */ } }
    S.store.subscribe(redrawList);
    addEventListener('hashchange', route);
    await route();
  }

  NS.state = { view: 'list' };
  NS.app = { show, go, route, boot };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})(typeof window !== 'undefined' ? window : globalThis);
