// Slop Inventory boot: the business router (shared/biz/router.js) with one view per tab (products, scan, stock, count,
// reports, data; #hash). Without a #view it opens the view Inventory was left on (ui/view-state.js), with its scroll. The open
// view is refreshed, with the settings re-read, whenever the store reports a change (from this tab or another one).
(function (g) {
  'use strict';
  const NS = (g.SlopInv = g.SlopInv || {});
  const U = NS.util;
  const VIEWS = ['products', 'scan', 'stock', 'count', 'reports', 'data'];
  let place = null;

  NS.state = { settings: { currency: 'USD', locale: 'en-US', defaultTaxRate: 0 }, view: 'products' };

  /** Re-reads the settings and redraws the open view. */
  async function refresh() {
    NS.state.settings = await U.settings();
    const view = NS.views[NS.state.view];
    if (view && view.refresh) await view.refresh();
  }

  /** The view Inventory was left on, when the address names none. */
  async function start() {
    NS.state.settings = await U.settings();
    place = await NS.viewState.restore();
    return place && VIEWS.includes(place.view) ? place.view : null;
  }

  const app = g.SlopBiz.router.start({
    ns: NS, app: 'inventory', parse: (h) => ({ view: VIEWS.includes(h) ? h : 'products' }),
    start, refresh, ready: () => NS.viewState.restoreScroll(place),
  });
  NS.app = Object.assign(app, { refresh, refreshSoon: () => refresh() });
})(typeof window !== 'undefined' ? window : globalThis);
