// Checks an export bundle before anything is imported. Pure: no storage access.
// Covers the format, every record against the schema, unique keys, references between collections,
// a balanced ledger, and gapless invoice and order numbering. Returns { ok, errors: [string] }.
(function (g) {
  'use strict';
  const ns = (g.SlopData = g.SlopData || {});
  const FORMAT = 'slop-data';
  const VERSION = 1;

  // [collection, field, target collection]: every id in the field must exist in the target.
  const REFS = [
    ['invoices', 'customerId', 'customers'], ['orders', 'customerId', 'customers'], ['orders', 'invoiceId', 'invoices'],
    ['invoices', 'orderId', 'orders'], ['payments', 'invoiceId', 'invoices'], ['stockMovements', 'productId', 'products'],
    ['quotes', 'customerId', 'customers'], ['quotes', 'orderId', 'orders'], ['quotes', 'invoiceId', 'invoices'],
    ['orders', 'quoteId', 'quotes'], ['invoices', 'quoteId', 'quotes'], ['journal', 'reverses', 'journal'], ['journal', 'rateId', 'exchangeRates'], ['invoices', 'rateId', 'exchangeRates'], ['payments', 'rateId', 'exchangeRates'],
  ];

  function validateBundle(b) {
    if (!b || typeof b !== 'object' || b.format !== FORMAT) return { ok: false, errors: ['not a slop-data export file'] };
    if (b.version !== VERSION) return { ok: false, errors: [`unsupported export version ${b.version}`] };
    if (!b.collections || typeof b.collections !== 'object') return { ok: false, errors: ['the file has no collections'] };
    const cols = { exchangeRates: [], customerGroups: [], customerTags: [], events: [], tasks: [], reminders: [], expenses: [], quotes: [], ...b.collections }; // older exports lack these tables: they read as empty
    const names = ns.schema.COLLECTIONS;
    const errors = [];
    for (const n of names) if (!Array.isArray(cols[n])) errors.push(`${n}: missing or not a list`);
    for (const n of Object.keys(cols)) if (!names.includes(n)) errors.push(`${n}: unknown collection`);
    if (errors.length) return { ok: false, errors };

    const byKey = {};
    for (const n of names) {
      const d = ns.schema.def(n);
      const keys = new Map();
      const uniq = Object.fromEntries((d.unique || []).map((f) => [f, new Set()]));
      byKey[n] = keys;
      cols[n].forEach((rec, i) => {
        const where = `${n}[${i}]`;
        const key = rec && rec[d.key];
        if (typeof key !== 'string' || !key) { errors.push(`${where}: missing ${d.key}`); return; }
        if (keys.has(key)) errors.push(`${where}: duplicate ${d.key} ${key}`);
        keys.set(key, rec);
        for (const e of ns.schema.validate(n, rec)) errors.push(`${where} ${e.field ? e.field + ' ' : ''}${e.message}`);
        for (const f of d.unique || []) {
          if (rec[f] === undefined) continue;
          if (uniq[f].has(rec[f])) errors.push(`${where}: ${f} ${rec[f]} is used twice`);
          uniq[f].add(rec[f]);
        }
      });
    }
    for (const [n, field, target] of REFS) {
      cols[n].forEach((rec, i) => {
        if (rec && rec[field] !== undefined && !byKey[target].has(rec[field])) errors.push(`${n}[${i}]: ${field} ${rec[field]} does not exist`);
      });
    }
    cols.stockCounts.forEach((c, i) => (c.lines || []).forEach((l, j) => {
      if (l && !byKey.products.has(l.productId)) errors.push(`stockCounts[${i}].lines[${j}]: product ${l.productId} does not exist`);
    }));
    cols.journal.forEach((e, i) => (e.lines || []).forEach((l, j) => {
      if (l && !byKey.accounts.has(l.account)) errors.push(`journal[${i}].lines[${j}]: account ${l.account} does not exist`);
    }));
    const tb = ns.ledger.summarize(cols.journal, cols.accounts);
    if (!tb.balanced) errors.push(...tb.errors.map((m) => `ledger: ${m}`));
    errors.push(...numberingErrors(cols));
    return { ok: errors.length === 0, errors };
  }

  /** Invoice and order numbers must run 1..n with the sequence prefix, and the counter must be past the last one. */
  function numberingErrors(cols) {
    const out = [];
    const seqs = new Map(cols.numbering.map((s) => [s.id, s]));
    const pairs = [['invoice', cols.invoices], ['order', cols.orders]];
    for (const [seqId, rows] of pairs) {
      const seq = seqs.get(seqId);
      if (!seq) { out.push(`numbering: sequence ${seqId} is missing`); continue; }
      const nums = rows.filter((r) => r.number).map((r) => ({ number: r.number, p: ns.numbering.parse(r.number) }));
      nums.sort((a, b) => (a.p ? a.p.n : 0) - (b.p ? b.p.n : 0));
      nums.forEach((x, i) => {
        if (!x.p || x.p.prefix !== (seq.prefix || '') || x.p.n !== i + 1) out.push(`${seqId} numbers have a gap or a wrong prefix at ${x.number}`);
      });
      if (nums.length && seq.next <= nums[nums.length - 1].p.n) out.push(`numbering: ${seqId} counter is behind its last number`);
    }
    return out;
  }

  ns.bundleCheck = { validateBundle, FORMAT, VERSION };
})(typeof window !== 'undefined' ? window : globalThis);
