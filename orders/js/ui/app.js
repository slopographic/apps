// Slop Orders boot: the shared document app (shared/docs/doc-app.js) with the order routes (list, new, o/<id>, data).
(function (g) {
  'use strict';
  g.SlopDocs.docApp.start({ ns: (g.SlopOrders = g.SlopOrders || {}), app: 'orders', route: 'o', noun: 'order' });
})(typeof window !== 'undefined' ? window : globalThis);
