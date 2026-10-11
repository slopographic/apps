// Money and tax, integers only. Amounts are minor units (cents); rates are basis points
// (2000 = 20.00%). Rounding is HALF AWAY FROM ZERO: 0.5 -> 1, 2.5 -> 3, -0.5 -> -1.
// Products go through BigInt, so no float error can reach a stored amount.
(function (g) {
  'use strict';
  const ns = (g.SlopData = g.SlopData || {});
  const MAX_MINOR = 9e12; // largest amount a record may hold (90 billion in major units)
  const ONE = 10000; // 100.00% in basis points
  const digitCache = new Map();

  /** round(a * b / c), ties away from zero. a, b and c must be safe integers; c must be positive. */
  function mulDiv(a, b, c) {
    if (![a, b, c].every(Number.isSafeInteger)) throw new RangeError('money: expected whole numbers');
    if (c <= 0) throw new RangeError('money: divisor must be positive');
    const A = BigInt(a) * BigInt(b);
    const C = BigInt(c);
    const m = A < 0n ? -A : A;
    const q = (2n * m + C) / (2n * C); // floor(m / C + 1/2)
    const r = Number(A < 0n ? -q : q);
    if (!Number.isSafeInteger(r)) throw new RangeError('money: result out of range');
    return r;
  }

  /** Minor-unit digits for a currency code, from Intl (USD 2, JPY 0). */
  function digits(currency) {
    const code = String(currency || 'USD').toUpperCase();
    if (!digitCache.has(code)) {
      let d = 2;
      try { d = new Intl.NumberFormat('en', { style: 'currency', currency: code }).resolvedOptions().maximumFractionDigits; } catch (e) { /* unknown code: keep 2 */ }
      digitCache.set(code, d);
    }
    return digitCache.get(code);
  }

  /** Parses typed text such as "12.5" into minor units (1250). Null when it is not a plain decimal,
   *  or when it has more decimal places than the currency allows (it is never rounded silently). */
  function parseMinor(text, currency = 'USD') {
    const m = /^(-?)(\d+)(?:\.(\d+))?$/.exec(String(text ?? '').trim());
    if (!m) return null;
    const d = digits(currency);
    const frac = m[3] || '';
    if (frac.length > d) return null;
    const v = Number(BigInt(m[2] + frac.padEnd(d, '0')));
    const n = m[1] && v ? -v : v;
    return Number.isSafeInteger(n) && Math.abs(n) <= MAX_MINOR ? n : null;
  }

  /** Display only, through Intl.NumberFormat with halfExpand rounding (ties away from zero). */
  function formatMinor(minor, currency = 'USD', locale = 'en-US') {
    const code = String(currency || 'USD').toUpperCase();
    const d = digits(code);
    const opts = { style: 'currency', currency: code, minimumFractionDigits: d, maximumFractionDigits: d, roundingMode: 'halfExpand' };
    let nf;
    try { nf = new Intl.NumberFormat(locale || 'en-US', opts); } catch (e) { nf = new Intl.NumberFormat('en-US', opts); }
    return nf.format(Number(minor) / 10 ** d);
  }

  /** Tax on a net amount at a rate in basis points, rounded half away from zero. */
  const taxOn = (net, rateBp) => mulDiv(net, rateBp, ONE);

  /** One line: gross = qty x unit price (exact), net = gross less the discount (basis points, rounded half away),
   *  tax = taxOn(net), total = net + tax. Prices are tax-exclusive. An absent discount is zero. */
  function lineAmounts(line) {
    const gross = mulDiv(line.qty, line.unitPrice, 1);
    const net = line.discount ? mulDiv(gross, 10000 - line.discount, 10000) : gross;
    const tax = taxOn(net, line.taxRate);
    return { net, tax, total: net + tax };
  }

  /** Totals for a list of lines. Tax is rounded per line and then summed; byRate groups net and tax by rate. */
  function documentTotals(lines) {
    let subtotal = 0, tax = 0;
    const rates = new Map();
    for (const l of lines) {
      const a = lineAmounts(l);
      subtotal += a.net;
      tax += a.tax;
      const r = rates.get(l.taxRate) || { rate: l.taxRate, net: 0, tax: 0 };
      r.net += a.net;
      r.tax += a.tax;
      rates.set(l.taxRate, r);
    }
    return { subtotal, tax, total: subtotal + tax, byRate: [...rates.values()].sort((x, y) => x.rate - y.rate) };
  }

  ns.money = { MAX_MINOR, ONE, mulDiv, taxOn, lineAmounts, documentTotals, parseMinor, formatMinor, digits };
})(typeof window !== 'undefined' ? window : globalThis);
