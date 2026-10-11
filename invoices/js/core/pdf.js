// The invoice PDF: the shared renderer (shared/docs/pdf-render.js) over the invoice's view (shared/docs/doc-view.js) in its
// template (shared/docs/pdf-layouts.js, from the invoice's seed or its pick). Pure bytes out; the UI downloads them.
// A long invoice runs onto more pages. The fonts are the standard Helvetica or Times (see pdf-render.js).
(function (g) {
  'use strict';
  const NS = (g.SlopInvoices = g.SlopInvoices || {});
  const V = g.SlopDocs.view;

  /** The view of a loaded context (NS.context.load): the invoice, its customer, balance, totals and company. */
  function viewOf(ctx) {
    const inv = ctx.invoice;
    const issued = inv.status === 'issued' || inv.status === 'paid';
    return V.build({
      kind: 'invoice', title: 'Invoice', id: inv.id, number: inv.number || '', statusText: NS.preview.STATUS[inv.status] || '',
      date: inv.date, dueDate: inv.dueDate || '', notes: inv.notes || '', currency: inv.currency, locale: ctx.locale,
      lines: inv.lines, customer: ctx.customer || {}, customerId: inv.customerId, company: ctx.company,
      totals: ctx.totals, paid: ctx.paid || 0, balance: issued ? ctx.balance : null, money: ctx.money,
      pdfSeed: inv.pdfSeed, pdfLayout: inv.pdfLayout,
    });
  }

  /** The PDF bytes for a loaded invoice: { ok: true, value } or a refusal. */
  async function invoicePdf(ctx) {
    return g.SlopDocs.pdf.renderPdf(viewOf(ctx));
  }

  NS.pdf = { invoicePdf, viewOf };
})(typeof window !== 'undefined' ? window : globalThis);
