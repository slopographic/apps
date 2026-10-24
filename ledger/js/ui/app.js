// Slop Ledger boot: the business router (shared/biz/router.js) with one view per tab (journal, gl, trial, accounts, rates, bank, fin;
// #hash). The open tab is redrawn whenever the store reports a change, and the header shows the base currency.
// A link with no hash may name the tab to open (?view=bank|fin|trial|gl|accounts|rates|journal, from a task page): this visit
// only (NS.presetOf, pure; unknown values are ignored, nothing is stored).
(function (g) {
  'use strict';
  const NS = (g.SlopLedger = g.SlopLedger || {});
  const $ = (id) => document.getElementById(id);
  const VIEWS = ['journal', 'gl', 'trial', 'accounts', 'rates', 'bank', 'fin'];
  NS.state = { view: 'journal' };

  /** The preset in a page address: { view } when it names a tab, else {}. */
  NS.presetOf = (search) => {
    const view = new URLSearchParams(search || '').get('view');
    return VIEWS.includes(view) ? { view } : {};
  };

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
    start: async () => NS.presetOf(location.search).view,
  });
  NS.app = Object.assign(app, { render, refreshSoon: () => render() });
})(typeof window !== 'undefined' ? window : globalThis);
