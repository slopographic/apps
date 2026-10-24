// Slop Admin boot: the business router (shared/biz/router.js) with one view per tab (company, numbering, taxes, data,
// storage; #hash). The open tab is redrawn whenever the store reports a change.
(function (g) {
  'use strict';
  const NS = (g.SlopAdmin = g.SlopAdmin || {});
  const VIEWS = ['company', 'numbering', 'taxes', 'data', 'storage'];
  NS.state = { view: 'company' };

  /** Draws the open tab. */
  async function render() {
    const v = NS.views[NS.state.view];
    if (v && v.render) await v.render();
  }

  const app = g.SlopBiz.router.start({ ns: NS, app: 'admin', parse: (h) => ({ view: VIEWS.includes(h) ? h : 'company' }), refresh: render });
  NS.app = Object.assign(app, { render, refreshSoon: () => render() });
})(typeof window !== 'undefined' ? window : globalThis);
