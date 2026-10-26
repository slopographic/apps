// The purchase order PDF: the shared document PDF (shared/docs/doc-pdf.js), with the supplier under "Order from" and the
// expected date under the date. Pure: bytes out.
(function (g) {
  'use strict';
  const NS = (g.SlopPurchases = g.SlopPurchases || {});
  const P = g.SlopDocs.docPdf.create({
    ns: NS, collection: 'purchases', kind: 'purchase', title: 'Purchase order', statusLabel: NS.util.STATUS,   // i18n-ignore: the document's own printed words
    view: (po) => ({ partyTitle: 'Order from', moreMeta: [{ label: 'Expected', value: po.expectedDate, field: 'expectedDate' }] }),   // i18n-ignore: the document's own printed words
  });
  NS.pdf = { load: P.load, viewOf: P.viewOf, purchasePdf: P.pdf };
})(typeof window !== 'undefined' ? window : globalThis);
