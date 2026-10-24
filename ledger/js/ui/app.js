// Slop Ledger boot: the business router (shared/biz/router.js) with one view per tab (journal, gl, trial, accounts, rates, bank;
// #hash). The open tab is redrawn whenever the store reports a change, and the header shows the base currency.
(function (g) {
  'use strict';
  const NS = (g.SlopLedger = g.SlopLedger || {});
  const $ = (id) => document.getElementById(id);
  const VIEWS = ['journal', 'gl', 'trial', 'accounts', 'rates', 'bank'];
  NS.state = { view: 'journal' };

  /** The base currency in the header. */
  async function label() { $('baseLabel').textContent = `Base currency ${(await NS.util.settings()).base}`; }

  /** Draws the open tab and the header. */
  async function render() {
    await label();
    const v = NS.views[NS.state.view];
    if (v && v.render) await v.render();
  }

  const app = g.SlopBiz.router.start({
    ns: NS, app: 'ledger', parse: (h) => ({ view: VIEWS.includes(h) ? h : 'journal' }),
    after: () => { label(); }, refresh: render,
  });
  NS.app = Object.assign(app, { render, refreshSoon: () => render() });
})(typeof window !== 'undefined' ? window : globalThis);
