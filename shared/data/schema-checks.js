// The checks the record table (schema-defs.js) names: errors for a stock movement, a journal entry and its currency
// fields, and each document's own rules. Pure: each takes a record and returns a list of errors in plain words.
// Load order: money.js, barcode.js, schema-checks.js, schema-defs.js, schema.js. Exposes window.SlopData.schemaChecks.
(function (g) {
  'use strict';
  const ns = (g.SlopData = g.SlopData || {});
  const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);

  /** Errors for one stock movement: a receipt or return adds stock, a sale removes it, nothing is zero. */
  function movementError(reason, qty) {
    if (!Number.isSafeInteger(qty) || qty === 0) return 'quantity must be a non-zero whole number';
    if ((reason === 'receipt' || reason === 'return') && qty < 0) return `a ${reason} must add stock (positive)`;
    if (reason === 'sale' && qty > 0) return 'a sale must remove stock (negative)';
    return null;
  }

  /** Errors for a journal: each line has exactly one positive side and the base totals agree. */
  function journalErrors(lines) {
    if (!Array.isArray(lines)) return [];
    const out = [];
    let dr = 0, cr = 0;
    for (const l of lines) {
      if (!isObj(l) || !Number.isSafeInteger(l.debit) || !Number.isSafeInteger(l.credit)) continue;
      if ((l.debit > 0) === (l.credit > 0)) out.push('each line needs a positive debit or a positive credit, not both or neither');
      dr += l.debit;
      cr += l.credit;
    }
    if (dr !== cr) out.push(`debits (${dr}) and credits (${cr}) do not balance`);
    return out;
  }

  /** Errors for the currency fields of a journal entry: amountBase equals the base debits; a foreign entry's original amounts balance too. */
  function fxErrors(r) {
    if (!Array.isArray(r.lines)) return [];
    const sum = (k) => r.lines.reduce((s, l) => s + (isObj(l) && Number.isSafeInteger(l[k]) ? l[k] : 0), 0);
    const out = [];
    if (r.amountBase !== undefined && r.amountBase !== sum('debit')) out.push('amountBase must equal the base debits');
    if (!r.rateId) return out;
    if (r.amount !== sum('origDebit')) out.push('amount must equal the original debits');
    if (sum('origDebit') !== sum('origCredit')) out.push('original debits and credits do not balance');
    return out;
  }

  const invoiceCheck = (r, o = {}) => {
    if (r.status === 'draft') return r.number ? ['a draft has no number yet'] : [];
    const out = [];
    if (!r.number && !o.deferNumber) out.push('an issued invoice needs a number');
    if (!r.lines || !r.lines.length) out.push('an issued invoice needs at least one line');
    return out;
  };
  const orderCheck = (r, o = {}) => (!r.number && !o.deferNumber ? ['an order needs a number'] : []);
  const purchaseCheck = (r, o = {}) => (!r.number && !o.deferNumber ? ['a purchase order needs a number'] : []);
  const quoteCheck = (r, o = {}) => (!r.number && !o.deferNumber ? ['a quote needs a number'] : []);
  const countCheck = (r) => {
    const ids = (r.lines || []).map((l) => l && l.productId);
    const out = new Set(ids).size === ids.length ? [] : ['each product can be counted once per count'];
    for (const l of r.lines || []) {
      if (isObj(l) && Number.isSafeInteger(l.counted) && Number.isSafeInteger(l.expected) && l.diff !== l.counted - l.expected) out.push('diff must equal counted minus expected');
    }
    return out;
  };
  /** Calendar events: timed ones need start and end (ms); all-day ones need startDay and endDay (inclusive). */
  const eventCheck = (r) => {
    if (r.allDay) {
      if (!r.startDay) return ['an all-day event needs a start day'];
      if (r.endDay && r.endDay < r.startDay) return ['the end day is before the start day'];
      return [];
    }
    if (r.start === undefined) return ['a timed event needs a start'];
    if (r.end !== undefined && r.end < r.start) return ['the end is before the start'];
    return [];
  };
  /** Tasks: a due time needs a due date, and a repeating task needs a due date to repeat from. */
  const taskCheck = (r) => {
    const out = [];
    if (r.dueTime && !r.due) out.push('a task with a due time needs a due date');
    if (r.freq && r.freq !== 'none' && !r.due) out.push('a repeating task needs a due date');
    return out;
  };
  const rateCheck = (r) => (r.base && r.base === r.quote ? ['base and quote must be different currencies'] : []);

  ns.schemaChecks = { movementError, journalErrors, fxErrors, invoiceCheck, orderCheck, purchaseCheck, quoteCheck, countCheck, eventCheck, taskCheck, rateCheck };
})(typeof window !== 'undefined' ? window : globalThis);
