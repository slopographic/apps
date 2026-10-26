// The quote PDF: the shared document PDF (shared/docs/doc-pdf.js) for a quote, with its valid-until date. Pure: bytes out.
(function (g) {
  'use strict';
  const NS = (g.SlopQuotes = g.SlopQuotes || {});
  const P = g.SlopDocs.docPdf.create({
    ns: NS, collection: 'quotes', kind: 'quote', title: 'Quote', statusLabel: NS.util.STATUS,   // i18n-ignore: the document's own printed words
    view: (q) => ({ moreMeta: [{ label: 'Valid until', value: q.validUntil, field: 'validUntil' }] }),   // i18n-ignore: the document's own printed words
  });
  NS.pdf = { load: P.load, viewOf: P.viewOf, quotePdf: P.pdf };
})(typeof window !== 'undefined' ? window : globalThis);
