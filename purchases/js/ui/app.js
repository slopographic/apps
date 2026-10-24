// Slop Purchases boot: the shared document app (shared/docs/doc-app.js) with the routes list, new, po/<id> and data.
(function (g) {
  'use strict';
  g.SlopDocs.docApp.start({ ns: (g.SlopPurchases = g.SlopPurchases || {}), app: 'purchases', route: 'po', noun: 'purchase order' });
})(typeof window !== 'undefined' ? window : globalThis);
