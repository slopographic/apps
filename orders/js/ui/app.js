// Slop Orders boot: the shared document app (shared/docs/doc-app.js) with the order routes (list, new, o/<id>, data) and
// d/<id>, an order's delivery note (ui/delivery.js), whose tab shows only while it is open.
(function (g) {
  'use strict';
  const NS = (g.SlopOrders = g.SlopOrders || {});
  const $ = (id) => document.getElementById(id);
  const more = (h) => (h.startsWith('d/') && h.length > 2 ? { view: 'delivery', arg: h.slice(2) } : null);
  const after = (t) => { $('tab-delivery').hidden = t.view !== 'delivery'; };
  const tabRoute = (n) => (n === 'edit' ? NS.editor.route() : n === 'delivery' ? location.hash.slice(1) : n);
  g.SlopDocs.docApp.start({ ns: NS, app: 'orders', route: 'o', noun: 'order', more, after, tabRoute });
})(typeof window !== 'undefined' ? window : globalThis);
