// Slop Inventory boot: opens the shared data store, mounts every view, switches views (tabs and #hash),
// and refreshes the open view whenever the store reports a change (from this tab or another one).
(function (g) {
  'use strict';
  const S = g.SlopData;
  const NS = (g.SlopInv = g.SlopInv || {});
  const U = NS.util;
  const $ = (id) => document.getElementById(id);
  const VIEWS = ['products', 'scan', 'stock', 'count', 'reports', 'data'];
  let timer = 0;

  NS.state = { settings: { currency: 'USD', locale: 'en-US', defaultTaxRate: 0 }, view: 'products' };

  /** Shows one view, marks its tab, and lets the view refresh (arg is passed to its onShow, e.g. a product id). */
  function show(name, arg) {
    if (!VIEWS.includes(name)) return undefined;
    NS.state.view = name;
    for (const v of VIEWS) {
      $(`view-${v}`).hidden = v !== name;
      const t = $(`tab-${v}`);
      t.setAttribute('aria-selected', String(v === name));
      t.tabIndex = v === name ? 0 : -1;
    }
    if (location.hash !== `#${name}`) history.replaceState(null, '', `#${name}`);
    const view = NS.views[name];
    return view && view.onShow ? view.onShow(arg) : undefined;
  }

  /** Re-reads the settings and redraws the open view. */
  async function refresh() {
    NS.state.settings = await U.settings();
    const view = NS.views[NS.state.view];
    if (view && view.refresh) await view.refresh();
  }

  /** Coalesces bursts of store changes into one redraw. */
  const refreshSoon = () => { clearTimeout(timer); timer = setTimeout(refresh, 40); };

  async function boot() {
    const ready = await S.store.ready();
    if (!ready.ok) {
      $('boot').textContent = `Storage is not available here: ${U.refusal(ready)}. Nothing can be saved in this window.`;
      return;
    }
    $('boot').hidden = true;
    for (const name of VIEWS) if (NS.views[name] && NS.views[name].mount) NS.views[name].mount();
    NS.commands.init();
    for (const t of document.querySelectorAll('.tab')) t.addEventListener('click', () => show(t.dataset.view));
    S.store.subscribe(() => refreshSoon());
    addEventListener('hashchange', () => show(location.hash.slice(1)));
    NS.state.settings = await U.settings();
    // An explicit #view wins; otherwise the view Inventory was left on (ui/view-state.js), else Products.
    const hashView = VIEWS.includes(location.hash.slice(1)) ? location.hash.slice(1) : null;
    const place = await NS.viewState.restore();
    const start = hashView || (place && VIEWS.includes(place.view) ? place.view : 'products');
    show(start);
    NS.viewState.restoreScroll(place);
  }

  NS.app = { show, refresh, refreshSoon, boot };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})(typeof window !== 'undefined' ? window : globalThis);
