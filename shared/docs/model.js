// Document lines for Slop Orders and Slop Invoices: pure helpers over SlopData.money. No DOM, no storage.
// Money is integer minor units; tax rates and discounts are integer basis points (2000 = 20.00%). Typed percent
// text ("7.5") and typed money text ("12.50") are parsed here so both apps read them the same way.
// Classic script. Exposes window.SlopDocs.model.
(function (g) {
  'use strict';
  const S = g.SlopData;
  const NS = (g.SlopDocs = g.SlopDocs || {});
  const PCT = /^\d{1,3}(\.\d{1,2})?$/;

  /** Basis points from typed percent text: "20" -> 2000, "7.5" -> 750. Blank is 0. Null when not 0 to 100. */
  function bpFromPercent(text) {
    const t = String(text ?? '').trim();
    if (t === '') return 0;
    if (!PCT.test(t)) return null;
    const bp = S.money.parseMinor(t, 'USD');   // two decimals of a percent are exactly basis points
    return bp !== null && bp >= 0 && bp <= 10000 ? bp : null;
  }

  /** Typed percent text from basis points: 750 -> "7.5", 2000 -> "20". */
  const percentText = (bp) => (bp ? String(Number((bp / 100).toFixed(2))) : '');

  /** Minor units from typed money text in a currency, or null. Negative and blank are null. */
  function amountFromText(text, currency) {
    const t = String(text ?? '').trim();
    if (t === '') return null;
    const v = S.money.parseMinor(t, currency);
    return v !== null && v >= 0 ? v : null;
  }

  /** Minor units as plain text for an input, such as 1250 -> "12.50" (no thousands separator). */
  const amountText = (minor, currency) => S.money.plainMinor(minor, currency);

  /** A new line, optionally filled from a product (sku, name as description, price and tax rate). */
  function newLine(product, taxRateDefault = 0) {
    if (!product) return { description: '', qty: 1, unitPrice: 0, taxRate: taxRateDefault };
    return { productId: product.id, sku: product.sku, description: product.name, qty: 1, unitPrice: product.price, taxRate: product.taxRate };
  }

  /** Stored shape of a line: blank product fields dropped, discount kept only when it is set. */
  function cleanLine(l) {
    const out = { description: String(l.description ?? '').trim(), qty: l.qty, unitPrice: l.unitPrice, taxRate: l.taxRate };
    if (l.productId) out.productId = l.productId;
    if (l.sku) out.sku = l.sku;
    if (l.discount) out.discount = l.discount;
    return out;
  }

  /** Plain-words problems with one line (empty when it is fine). Mirrors the schema's rules for a line. */
  function lineErrors(l) {
    const e = [];
    const t = (k) => (g.SlopI18n ? g.SlopI18n.t(k) : k);
    if (!l.description) e.push(t('biz.ln.e_desc'));
    if (!Number.isSafeInteger(l.qty) || l.qty < 1) e.push(t('biz.ln.e_qty'));
    if (!Number.isSafeInteger(l.unitPrice) || l.unitPrice < 0) e.push(t('biz.ln.e_price'));
    if (!Number.isSafeInteger(l.taxRate) || l.taxRate < 0 || l.taxRate > 10000) e.push(t('biz.ln.e_tax'));
    if (!Number.isSafeInteger(l.discount ?? 0) || (l.discount ?? 0) < 0 || (l.discount ?? 0) > 10000) e.push(t('biz.ln.e_disc'));
    return e;
  }

  /** Totals for lines, computed by SlopData.money. Null when any line is not valid yet. */
  function totals(lines) {
    if (!Array.isArray(lines) || !lines.length) return { subtotal: 0, tax: 0, total: 0, byRate: [] };
    if (lines.some((l) => lineErrors(l).length)) return null;
    return S.money.documentTotals(lines.map(cleanLine));
  }

  /** Line total (net plus tax) for one line, or 0 when the line is not valid yet. */
  function lineTotal(l) {
    return lineErrors(l).length ? 0 : S.money.lineAmounts(cleanLine(l)).total;
  }

  /** ISO date plus n days (UTC arithmetic, so the day never shifts). */
  const addDays = (iso, n) => S.ledger.addDays(iso, n);


  NS.model = { bpFromPercent, percentText, amountFromText, amountText, newLine, cleanLine, lineErrors, totals, lineTotal, addDays };
})(typeof window !== 'undefined' ? window : globalThis);
