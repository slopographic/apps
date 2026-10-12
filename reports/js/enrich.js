/* Slop Reports: derived fields. A report names them in "enrich"; each one adds a field to every row of its source
 * collection and reads the other collections it needs from data (read-only). Pure. Classic script: sets
 * window.SlopReports.enrich. */
(function (g) {
  'use strict';
  const ns = (g.SlopReports = g.SlopReports || {});
  const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : 0);

  ns.enrich = {
    /** Invoices: paid (the payments made, in the invoice's currency) and balance (total less paid, for an issued invoice; 0 otherwise). */
    invoiceBalance(rows, data) {
      const paid = new Map();
      for (const p of data.payments || []) paid.set(p.invoiceId, (paid.get(p.invoiceId) || 0) + num(p.amount));
      return rows.map((r) => {
        const got = paid.get(r.id) || 0;
        return { ...r, paid: got, balance: r.status === 'issued' ? Math.max(0, num(r.total) - got) : 0 };
      });
    },
    /** Customers: value, the total of their issued and paid invoices in the base currency. An invoice in another currency
     * counts only with its amountBase; one with neither is left out, since it cannot be converted. */
    customerValue(rows, data) {
      const main = (data.settings || []).find((s) => s.id === 'main') || {};
      const baseCur = main.defaultCurrency || 'USD';
      const value = new Map();
      for (const inv of data.invoices || []) {
        if (inv.status !== 'issued' && inv.status !== 'paid') continue;
        let base;
        if (typeof inv.amountBase === 'number') base = inv.amountBase;
        else if (!inv.currency || inv.currency === baseCur) base = num(inv.total);
        else continue;
        value.set(inv.customerId, (value.get(inv.customerId) || 0) + base);
      }
      return rows.map((r) => ({ ...r, value: value.get(r.id) || 0 }));
    },
  };
})(typeof window !== 'undefined' ? window : globalThis);
