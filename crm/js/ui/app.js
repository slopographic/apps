// Slop CRM boot: opens the shared store, mounts every view, switches views (tabs and #hash, plus the customer
// detail panel), and redraws the open view whenever the store reports a change (this tab or another one).
(function (g) {
  'use strict';
  const S = g.SlopData;
  const NS = (g.SlopCrm = g.SlopCrm || {});
  const $ = (id) => document.getElementById(id);
  const TABS = ['customers', 'pipeline', 'followups'];   // the list comes first, and is the start screen
  const VIEWS = [...TABS, 'customer'];
  let timer = 0, lastTab = 'customers', tabs = null;
  const WIDE = g.matchMedia ? g.matchMedia('(min-width: 960px)') : null;
  const isWide = () => !!(WIDE && WIDE.matches);
  NS.state = { view: 'customers', current: null, split: false, settings: { currency: 'USD', locale: 'en-US' } };

  /**
   * Shows one view. `customer` opens the detail for the id in arg. On a wide screen the detail sits beside the
   * Customers list (right pane) once a customer is picked, and the list stays full width until then. Narrower
   * screens show one view at a time: the detail is a full page with Back.
   */
  function show(name, arg) {
    if (!VIEWS.includes(name)) return;
    NS.state.view = name;
    if (name === 'customer') {
      NS.state.current = arg || null;
      if (isWide()) { lastTab = 'customers'; if (location.hash !== '#customers') history.replaceState(null, '', '#customers'); }
    } else { lastTab = name; if (location.hash !== `#${name}`) history.replaceState(null, '', `#${name}`); }
    const split = isWide() && !!NS.state.current && (name === 'customers' || name === 'customer');
    NS.state.split = split;
    const shown = split ? ['customers', 'customer'] : [name];
    for (const v of VIEWS) $(`view-${v}`).hidden = !shown.includes(v);
    if (window.SlopLayouts) SlopLayouts.refresh('crm');
    $('main').classList.toggle('split', split);
    if (tabs) tabs.show(name === 'customer' ? lastTab : name);   // the tab strip only: the panels are shown above
    return render();
  }

  /** Redraws the open view(s) and reloads the settings they format money and dates with. */
  async function render() {
    NS.state.settings = await NS.util.settings();
    const names = NS.state.split ? ['customers', 'customer'] : [NS.state.view];
    for (const n of names) {
      const v = NS.views[n];
      if (v && v.render) await v.render();
    }
  }

  const refreshSoon = () => { clearTimeout(timer); timer = setTimeout(render, 40); };

  async function boot() {
    const ready = await S.store.ready();
    if (!ready.ok) {
      $('boot').textContent = `Storage is not available here: ${ready.message}. Nothing can be saved in this window.`;
      return;
    }
    for (const v of Object.values(NS.views)) if (v.mount) v.mount();
    NS.commands.init();
    // SlopTabs (shared/ui/tabs.js) marks the tabs and gives them the arrow keys; the views and the split are this file's
    tabs = g.SlopTabs.mount(document.querySelector('.tabs'), { select: (n) => show(n), panel: () => null });
    $('dBack').addEventListener('click', () => close());
    S.store.subscribe(() => refreshSoon());
    if (WIDE && WIDE.addEventListener) WIDE.addEventListener('change', () => show(NS.state.view, NS.state.current));
    addEventListener('hashchange', () => { const h = location.hash.slice(1); if (TABS.includes(h)) show(h); });
    try { if (g.SlopHub) g.SlopHub.register('crm'); } catch (e) { /* no hub: the app still works */ }
    const start = TABS.includes(location.hash.slice(1)) ? location.hash.slice(1) : 'customers';
    await show(start);
    $('boot').hidden = true;
  }

  /** Closes the customer detail: back to the list on a wide screen, to the tab it was opened from otherwise. */
  function close() {
    NS.state.current = null;
    return show(lastTab);
  }

  NS.app = { show, render, refreshSoon, boot, close };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})(typeof window !== 'undefined' ? window : globalThis);
