// Slop Expenses boot: opens the shared store, mounts the views, and routes the #hash: list, new, e/<id> (one expense)
// and summary. The view tabs are SlopTabs (shared/ui/tabs.js); the list redraws when the store reports a change (from
// this tab or another).
(function (g) {
  'use strict';
  const S = g.SlopData, B = g.SlopBiz;
  const NS = (g.SlopExpenses = g.SlopExpenses || {});
  const $ = (id) => document.getElementById(id);
  let tabs = null, timer = 0;

  /** The route for the current hash. */
  function parse() {
    const h = location.hash.slice(1);
    if (h === 'summary') return { view: 'summary' };
    if (h === 'new' || h.startsWith('new/')) return { view: 'edit', arg: null, copyOf: h.slice(4) || null };
    if (h.startsWith('e/') && h.length > 2) return { view: 'edit', arg: h.slice(2) };
    return { view: 'list' };
  }
  /** Moves to a route ('list', 'new', 'new/<id>' to copy one, 'e/<id>', 'summary'). */
  const go = (path) => { location.hash = path; };

  async function route() {
    const t = parse();
    $('tab-edit').hidden = t.view !== 'edit';
    $('tab-edit').textContent = t.arg ? 'Expense' : 'New expense';
    tabs.show(t.view);
    const v = NS.views[t.view];
    if (v && v.show) await v.show(t.arg, t);
  }

  function redraw() {
    clearTimeout(timer);
    timer = setTimeout(() => { const v = NS.views[tabs.current()]; if (v && v.refresh) v.refresh(); }, 40);
  }

  async function boot() {
    const ready = await S.store.ready();
    if (!ready.ok) { $('boot').textContent = `Storage is not available here: ${B.refusal(ready)}. Nothing can be saved in this window.`; return; }
    $('boot').hidden = true;
    tabs = g.SlopTabs.mount(document.querySelector('.tabs'), { select: (name) => go(name === 'edit' ? (location.hash.slice(1) || 'new') : name) });
    for (const v of Object.values(NS.views)) if (v.mount) v.mount();
    NS.commands.init();
    if (g.SlopHub) { try { g.SlopHub.register('expenses'); } catch (e) { /* the hub is optional */ } }
    S.store.subscribe(redraw);
    addEventListener('hashchange', route);
    await route();
  }

  NS.views = NS.views || {};
  NS.app = { go, route, boot, parse };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})(typeof window !== 'undefined' ? window : globalThis);
