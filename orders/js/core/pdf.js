// The order PDF and paper data: the order, its customer and the company block from settings, drawn through the shared
// renderer (shared/docs/pdf-render.js) from the order's view (shared/docs/doc-view.js) in its template. Pure: bytes out.
(function (g) {
  'use strict';
  const S = g.SlopData;
  const NS = (g.SlopOrders = g.SlopOrders || {});
  const M = g.SlopDocs.model;

  /** The order with its customer and company, for the PDF (read only). Result: { order, customer, company, locale }. */
  async function load(id) {
    const r = await NS.orders.get(id);
    if (!r.ok) return r;
    if (!r.value) return S.result.fail('not_found', 'this order no longer exists');
    const c = await S.store.get('customers', r.value.customerId);
    if (!c.ok) return c;
    const s = await NS.util.settings();
    return S.result.ok({ order: r.value, customer: c.value || {}, company: { name: s.companyName, address: s.address, taxNumber: s.taxNumber }, locale: s.locale });
  }

  /** The view of a loaded order (the paper and the PDF both draw it). */
  function viewOf(ctx) {
    const o = ctx.order;
    return g.SlopDocs.view.build({
      kind: 'order', title: 'Order', id: o.id, number: o.number || '', statusText: M.STATUS_LABEL[o.status] || '',
      date: o.date, dueDate: '', notes: o.notes || '', currency: o.currency, locale: ctx.locale, lines: o.lines,
      customer: ctx.customer, customerId: o.customerId, company: ctx.company, totals: M.totals(o.lines), paid: 0, balance: null,
      money: (m) => NS.util.money(m, o.currency, ctx.locale), pdfSeed: o.pdfSeed, pdfLayout: o.pdfLayout,
    });
  }

  /** The PDF bytes for an order id: { ok: true, value } or a refusal. */
  async function orderPdf(id) {
    const c = await load(id);
    if (!c.ok) return c;
    return g.SlopDocs.pdf.renderPdf(viewOf(c.value));
  }

  NS.pdf = { load, viewOf, orderPdf };
})(typeof window !== 'undefined' ? window : globalThis);
