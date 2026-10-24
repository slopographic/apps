// Slop Expenses: what a receipt says, from the lines of text OCR read off its photo (top to bottom). Pure: no page, no
// storage, so the Node tests load it as it is. Exposes SlopExpenses.receipt = { parse, amountsIn, dateIn }.
//   parse(lines, { currency, dayFirst }) -> { supplier, date, total, tax, currency, found: [field names] }
//     total and tax are minor units (cents) in `currency`; date is YYYY-MM-DD. A field not found is null.
//   The total is the amount on the line that says so (TOTAL, AMOUNT DUE, SUMMA, ATT BETALA, GESAMT…), the last such line
//   when there are several, never a subtotal; failing that, the largest amount not on a tax line. Tax is the amount on a VAT, tax, MOMS, MwSt,
//   IVA, TVA or GST line (not its rate). The supplier is the first line that reads like a name, not an address or a number.
(function (g) {
  'use strict';
  const NS = (g.SlopExpenses = g.SlopExpenses || {});
  const TOTAL = /\b(grand\s*total|total\s*(due|amount|to\s*pay)?|amount\s*(due|paid)|balance\s*due|to\s*pay|summa|att\s*betala|totalt|gesamt(betrag)?|zu\s*zahlen|totale|montant|importe)\b/i;
  const SUB = /\b(sub\s*-?\s*total|delsumma|zwischensumme|netto|net\s*amount)\b/i;
  const TAX = /\b(vat|tax|moms|mwst|ust|iva|tva|gst|hst|pst)\b/i;
  const NOT_NAME = /\b(receipt|kvitto|invoice|faktura|tel|phone|fax|www\.|https?:|@|org\.?\s*nr|vat\s*no|cashier|kassa|table|order|date|time|street|st\.|road|ave)\b/i;
  const SYMBOL = { '$': 'USD', '€': 'EUR', '£': 'GBP', '¥': 'JPY', '₹': 'INR' };
  const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
  const pad = (n) => String(n).padStart(2, '0');

  /** Money amounts on a line, as minor units: 1,234.50 and 1.234,50 and 1 234,50 and 12.5 are all read. Percentages are not. */
  function amountsIn(line) {
    const out = [];
    const rx = /(\d{1,3}(?:[ .,' ]\d{3})+|\d+)([.,]\d{1,2})(?!\d)(?!\s*%)/g;
    let m;
    while ((m = rx.exec(String(line)))) {
      const whole = m[1].replace(/[ .,' ]/g, ''), frac = m[2].slice(1).padEnd(2, '0');
      out.push(Number(whole) * 100 + Number(frac));
    }
    return out;
  }

  /** A real calendar day as YYYY-MM-DD, or null. */
  function day(y, mo, d) {
    if (y < 100) y += 2000;
    const t = new Date(Date.UTC(y, mo - 1, d));
    return t.getUTCFullYear() === y && t.getUTCMonth() === mo - 1 && t.getUTCDate() === d ? `${y}-${pad(mo)}-${pad(d)}` : null;
  }
  /** The first date on a line: 2026-10-24, 24/10/2026 (or 10/24/2026 when dayFirst is false, or when 24 cannot be a month),
   *  24.10.26, 24 Oct 2026, Oct 24, 2026. */
  function dateIn(line, dayFirst = true) {
    const s = String(line);
    let m = /\b(\d{4})[-./](\d{1,2})[-./](\d{1,2})\b/.exec(s);
    if (m) return day(+m[1], +m[2], +m[3]);
    m = /\b(\d{1,2})[-./](\d{1,2})[-./](\d{2,4})\b/.exec(s);
    if (m) {
      const a = +m[1], b = +m[2], y = +m[3];
      const df = a > 12 ? true : b > 12 ? false : dayFirst;
      return df ? day(y, b, a) : day(y, a, b);
    }
    m = /\b(\d{1,2})\s+([a-z]{3})[a-z]*\.?\s+(\d{4})\b/i.exec(s);
    if (m && MONTHS.includes(m[2].toLowerCase())) return day(+m[3], MONTHS.indexOf(m[2].toLowerCase()) + 1, +m[1]);
    m = /\b([a-z]{3})[a-z]*\.?\s+(\d{1,2}),?\s+(\d{4})\b/i.exec(s);
    if (m && MONTHS.includes(m[1].toLowerCase())) return day(+m[3], MONTHS.indexOf(m[1].toLowerCase()) + 1, +m[2]);
    return null;
  }

  function parse(lines, { currency = null, dayFirst = true } = {}) {
    const L = (lines || []).map((x) => String(x || '').trim()).filter(Boolean);
    let total = null, tax = null, date = null, supplier = null, cur = null;
    for (const line of L) {
      const amounts = amountsIn(line);
      if (amounts.length && TOTAL.test(line) && !SUB.test(line) && !TAX.test(line)) total = amounts[amounts.length - 1];
      else if (amounts.length && TAX.test(line) && !TOTAL.test(line) && tax === null) tax = amounts[amounts.length - 1];
      if (!date) date = dateIn(line, dayFirst);
      if (!cur) { const sym = Object.keys(SYMBOL).find((k) => line.includes(k)); const code = /\b(USD|EUR|GBP|SEK|NOK|DKK|CHF|JPY|CAD|AUD)\b/.exec(line); cur = code ? code[1] : sym ? SYMBOL[sym] : null; }
      if (!supplier && /[a-z]{2}/i.test(line) && !/\d{3,}/.test(line) && !NOT_NAME.test(line) && !TOTAL.test(line) && line.length <= 60) supplier = line.replace(/\s{2,}/g, ' ');
    }
    if (total === null) { const all = L.filter((l) => !TAX.test(l)).flatMap(amountsIn); if (all.length) total = Math.max(...all); }
    if (tax !== null && total !== null && tax >= total) tax = null;   // a tax line's amount above the total is a misread
    const out = { supplier, date, total, tax, currency: cur || currency };
    out.found = ['supplier', 'date', 'total', 'tax'].filter((k) => out[k] !== null);
    return out;
  }

  NS.receipt = { parse, amountsIn, dateIn };
})(typeof window !== 'undefined' ? window : globalThis);
