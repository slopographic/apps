// The printable and PDF view of one invoice, loaded from SlopData: the invoice, its customer and payments, the
// balance (from billing), the tax breakdown (SlopData.money) and the company block from settings.
(function (g) {
  'use strict';
  const S = g.SlopData;
  const NS = (g.SlopInvoices = g.SlopInvoices || {});
  const { ok, fail } = S.result;

  /** Resolves to { invoice, customer, payments, paid, balance, totals, company, money(minor) } or a failed Result. */
  async function load(id) {
    const got = await NS.invoices.get(id);
    if (!got.ok) return got;
    if (!got.value) return fail('not_found', 'this invoice no longer exists');
    const s = await NS.util.settings();
    const { invoice, payments, customer } = got.value;
    const paid = S.billing.paidOn(payments);
    const balance = invoice.status === 'issued' ? S.billing.balanceDue(invoice, payments) : invoice.status === 'draft' ? invoice.total : 0;
    return ok({
      invoice, customer, payments, paid, balance,
      totals: S.money.documentTotals(invoice.lines),
      company: { name: s.companyName, address: s.address, taxNumber: s.taxNumber }, locale: s.locale,
      money: (minor) => NS.util.money(minor, invoice.currency, s.locale),
    });
  }

  NS.context = { load };
})(typeof window !== 'undefined' ? window : globalThis);
