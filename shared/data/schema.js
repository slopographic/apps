// Business record shapes: the single source of truth for every collection. Writes go through
// prepare() (trim, defaults, derived totals, validation) and checkTransition() before store.js saves.
// Money is integer minor units. Tax rates are integer basis points. Dates are YYYY-MM-DD.
(function (g) {
  'use strict';
  const ns = (g.SlopData = g.SlopData || {});
  const MAX = 9e12;
  const META = ['createdAt', 'updatedAt', 'version', 'deletedAt'];
  const ok = (value) => ({ ok: true, value });
  const fail = (code, message, extra) => Object.assign({ ok: false, code, message: message || code }, extra || {});
  const isResult = (v) => !!v && typeof v === 'object' && typeof v.ok === 'boolean';
  const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
  const clone = (v) => (Array.isArray(v) ? v.slice() : v);
  ns.result = { ok, fail, isResult };

  const ENUM = {
    stage: ['lead', 'contacted', 'customer', 'lost'],
    invoiceStatus: ['draft', 'issued', 'paid', 'void'],
    orderStatus: ['open', 'fulfilled', 'cancelled'],
    accountType: ['asset', 'liability', 'equity', 'revenue', 'expense'],
    payMethod: ['cash', 'bank', 'card', 'other'],
    stockReason: ['receipt', 'sale', 'adjustment', 'transfer', 'count', 'return'],
  };
  const ACCT = { CASH: '1000', BANK: '1010', AR: '1200', TAX_PAYABLE: '2100', EQUITY: '3000', REVENUE: '4000', EXPENSES: '5000' };
  const DEFAULT_CHART = [
    { code: '1000', name: 'Cash', type: 'asset' }, { code: '1010', name: 'Bank', type: 'asset' },
    { code: '1200', name: 'Accounts Receivable', type: 'asset' }, { code: '2100', name: 'Sales Tax Payable', type: 'liability' },
    { code: '3000', name: 'Equity', type: 'equity' }, { code: '4000', name: 'Sales Revenue', type: 'revenue' },
    { code: '5000', name: 'Expenses', type: 'expense' },
  ];
  const DEFAULT_SETTINGS = { id: 'main', currency: 'USD', locale: 'en-US', defaultTaxRate: 0, paymentTermsDays: 30 };
  const DEFAULT_SEQUENCES = [{ id: 'invoice', prefix: 'INV-', pad: 4, next: 1 }, { id: 'order', prefix: 'ORD-', pad: 4, next: 1 }];
  const INVOICE_NEXT = { draft: ['issued'], issued: ['paid', 'void'], paid: [], void: [] };
  const ORDER_NEXT = { open: ['fulfilled', 'cancelled'], fulfilled: [], cancelled: [] };
  const RX = { currency: /^[A-Z]{3}$/, locale: /^[A-Za-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$/ };

  // Field specs. t = type; req = required; def = default; min/max/values/pattern/max/itemMax as named.
  const F = {
    id: (o) => ({ t: 'id', ...o }),
    str: (o) => ({ t: 'string', max: 200, ...o }),
    text: (o) => ({ t: 'text', max: 5000, ...o }),
    int: (o) => ({ t: 'int', min: -1e9, max: 1e9, ...o }),
    mny: (o) => ({ t: 'money', min: 0, ...o }),
    rate: (o) => ({ t: 'rate', ...o }),
    date: (o) => ({ t: 'date', ...o }),
    ts: (o) => ({ t: 'ts', ...o }),
    en: (values, o) => ({ t: 'enum', values, ...o }),
  };
  const LINE = {
    productId: F.id(), sku: F.str({ max: 80 }), description: F.str({ req: true, max: 300 }),
    qty: F.int({ req: true, min: 1, max: 1e6 }), unitPrice: F.mny({ req: true }), taxRate: F.rate({ req: true }),
    net: F.mny(), tax: F.mny(), total: F.mny(),
  };
  const JLINE = { account: F.str({ req: true, max: 4, pattern: /^\d{4}$/ }), debit: F.mny({ def: 0 }), credit: F.mny({ def: 0 }) };
  const COUNT = { productId: F.id({ req: true }), expected: F.int({ req: true }), counted: F.int({ req: true, min: 0 }), diff: F.int({ req: true }) };

  /** Errors for one stock movement: a receipt or return adds stock, a sale removes it, nothing is zero. */
  function movementError(reason, qty) {
    if (!Number.isSafeInteger(qty) || qty === 0) return 'quantity must be a non-zero whole number';
    if ((reason === 'receipt' || reason === 'return') && qty < 0) return `a ${reason} must add stock (positive)`;
    if (reason === 'sale' && qty > 0) return 'a sale must remove stock (negative)';
    return null;
  }

  /** Errors for a journal: each line has exactly one positive side and the totals agree. */
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

  const lineOk = (l) => isObj(l) && Number.isSafeInteger(l.qty) && Number.isSafeInteger(l.unitPrice) && Number.isSafeInteger(l.taxRate) && Math.abs(l.qty * l.unitPrice) <= MAX;
  /** Recomputes line amounts and document totals from the lines (in place). Skipped when a line is unusable. */
  function derive(rec) {
    if (!Array.isArray(rec.lines) || !rec.lines.every(lineOk)) return;
    const m = ns.money;
    rec.lines = rec.lines.map((l) => { const a = m.lineAmounts(l); return { ...l, net: a.net, tax: a.tax, total: a.total }; });
    const t = m.documentTotals(rec.lines);
    rec.subtotal = t.subtotal;
    rec.tax = t.tax;
    rec.total = t.total;
  }

  const invoiceCheck = (r, o = {}) => {
    if (r.status === 'draft') return r.number ? ['a draft has no number yet'] : [];
    const out = [];
    if (!r.number && !o.deferNumber) out.push('an issued invoice needs a number');
    if (!r.lines || !r.lines.length) out.push('an issued invoice needs at least one line');
    return out;
  };
  const orderCheck = (r, o = {}) => (!r.number && !o.deferNumber ? ['an order needs a number'] : []);
  const countCheck = (r) => {
    const ids = (r.lines || []).map((l) => l && l.productId);
    const out = new Set(ids).size === ids.length ? [] : ['each product can be counted once per count'];
    for (const l of r.lines || []) {
      if (isObj(l) && Number.isSafeInteger(l.counted) && Number.isSafeInteger(l.expected) && l.diff !== l.counted - l.expected) out.push('diff must equal counted minus expected');
    }
    return out;
  };

  const DEFS = {
    settings: { key: 'id', singleton: 'main', fields: {
      id: F.id({ req: true, def: 'main' }), companyName: F.str({}), address: F.text({ max: 1000 }), taxNumber: F.str({ max: 60 }),
      currency: { t: 'currency', def: 'USD' }, locale: { t: 'locale', def: 'en-US' }, defaultTaxRate: F.rate({ def: 0 }),
      paymentTermsDays: F.int({ min: 0, max: 365, def: 30 }) } },
    customers: { key: 'id', softDelete: true, indexes: [{ name: 'name', key: 'name' }, { name: 'stage', key: 'stage' }, { name: 'categories', key: 'categories', multi: true }], fields: {
      id: F.id({ req: true }), name: F.str({ req: true }), email: F.str({ max: 200 }), phone: F.str({ max: 60 }), address: F.text({ max: 1000 }),
      categories: { t: 'strings', max: 20, itemMax: 40, def: [] }, stage: F.en(ENUM.stage, { def: 'lead' }), notes: F.text({}) } },
    products: { key: 'id', unique: ['sku', 'ean'], refs: [{ collection: 'stockMovements', index: 'productId' }],
      indexes: [{ name: 'sku', key: 'sku', unique: true }, { name: 'ean', key: 'ean', unique: true }, { name: 'name', key: 'name' }], fields: {
      id: F.id({ req: true }), sku: F.str({ req: true, max: 80, pattern: /^\S+$/ }), ean: { t: 'ean' }, name: F.str({ req: true }),
      description: F.text({}), price: F.mny({ req: true }), taxRate: F.rate({ req: true }), unit: F.str({ max: 20, def: 'each' }) } },
    orders: { key: 'id', derive: true, unique: ['number'], autoNumber: { seq: 'order', when: () => true }, check: orderCheck,
      noRemove: 'orders cannot be deleted; cancel them instead',
      indexes: [{ name: 'number', key: 'number', unique: true }, { name: 'customerId', key: 'customerId' }, { name: 'status', key: 'status' }, { name: 'date', key: 'date' }], fields: {
      id: F.id({ req: true }), number: F.str({ max: 40 }), customerId: F.id({ req: true }), date: F.date({ req: true }),
      status: F.en(ENUM.orderStatus, { def: 'open' }), lines: { t: 'lines', min: 1, req: true }, subtotal: F.mny(), tax: F.mny(), total: F.mny(),
      notes: F.text({}), invoiceId: F.id({}) } },
    invoices: { key: 'id', softDelete: true, derive: true, unique: ['number'], check: invoiceCheck,
      autoNumber: { seq: 'invoice', when: (r) => r.status !== 'draft' },
      removeRule: (r) => (r.status !== 'draft' ? 'issued invoices cannot be deleted; void them instead' : null),
      indexes: [{ name: 'number', key: 'number', unique: true }, { name: 'customerId', key: 'customerId' }, { name: 'status', key: 'status' }, { name: 'date', key: 'date' }], fields: {
      id: F.id({ req: true }), number: F.str({ max: 40 }), customerId: F.id({ req: true }), date: F.date({ req: true }), dueDate: F.date({}),
      status: F.en(ENUM.invoiceStatus, { def: 'draft' }), lines: { t: 'lines', min: 0, def: [] }, subtotal: F.mny(), tax: F.mny(), total: F.mny(),
      notes: F.text({}), orderId: F.id({}), issuedAt: F.ts({}) } },
    payments: { key: 'id', immutable: true, postingOnly: true, indexes: [{ name: 'invoiceId', key: 'invoiceId' }, { name: 'date', key: 'date' }], fields: {
      id: F.id({ req: true }), invoiceId: F.id({ req: true }), amount: F.mny({ req: true, min: 1 }), date: F.date({ req: true }),
      method: F.en(ENUM.payMethod, { def: 'bank' }), note: F.str({ max: 300 }) } },
    accounts: { key: 'code', noRemove: 'accounts cannot be deleted', indexes: [{ name: 'type', key: 'type' }], fields: {
      code: F.str({ req: true, max: 4, pattern: /^\d{4}$/ }), name: F.str({ req: true }), type: F.en(ENUM.accountType, { req: true }) } },
    journal: { key: 'id', immutable: true, postingOnly: true, unique: ['source'], check: (r) => journalErrors(r.lines),
      indexes: [{ name: 'source', key: 'source', unique: true }, { name: 'date', key: 'date' }, { name: 'reverses', key: 'reverses' }], fields: {
      id: F.id({ req: true }), date: F.date({ req: true }), memo: F.str({ max: 300 }), source: F.str({ req: true, max: 200 }),
      lines: { t: 'jlines', min: 2, req: true }, reverses: F.id({}) } },
    stockMovements: { key: 'id', immutable: true, postingOnly: true, check: (r) => [movementError(r.reason, r.qty)].filter(Boolean),
      indexes: [{ name: 'productId', key: 'productId' }, { name: 'location', key: 'location' }], fields: {
      id: F.id({ req: true }), productId: F.id({ req: true }), location: F.str({ req: true, max: 40, def: 'main' }),
      qty: F.int({ req: true }), reason: F.en(ENUM.stockReason, { req: true }), date: F.date({ req: true }), ref: F.str({ max: 200 }), note: F.text({ max: 300 }) } },
    stockCounts: { key: 'id', immutable: true, postingOnly: true, check: countCheck, indexes: [{ name: 'location', key: 'location' }, { name: 'date', key: 'date' }], fields: {
      id: F.id({ req: true }), location: F.str({ req: true, max: 40 }), date: F.date({ req: true }), lines: { t: 'countLines', min: 1, req: true },
      notes: F.text({}), status: F.en(['posted'], { def: 'posted' }) } },
    numbering: { key: 'id', noRemove: 'sequences cannot be deleted', fields: {
      id: F.id({ req: true }), prefix: F.str({ max: 20 }), pad: F.int({ min: 1, max: 12, def: 4 }), next: F.int({ req: true, min: 1, max: 1e12 }) } },
  };
  const COLLECTIONS = Object.keys(DEFS);

  const isDate = (v) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
    const d = new Date(`${v}T00:00:00Z`);
    return !isNaN(d) && d.toISOString().slice(0, 10) === v;
  };

  function checkValue(s, v, field, errors) {
    const bad = (message) => errors.push({ field, message });
    switch (s.t) {
      case 'id': if (typeof v !== 'string' || v.length > 80) bad('must be an id of up to 80 characters'); break;
      case 'string': case 'text': case 'currency': case 'locale': {
        const max = s.max || (s.t === 'text' ? 5000 : 200);
        if (typeof v !== 'string' || v.length > max) bad(`must be text of at most ${max} characters`);
        else if (s.pattern && !s.pattern.test(v)) bad('has an invalid format');
        else if (s.t === 'currency' && !RX.currency.test(v)) bad('must be a 3-letter currency code');
        else if (s.t === 'locale' && !RX.locale.test(v)) bad('must be a language tag such as en-US');
        break;
      }
      case 'int': if (!Number.isSafeInteger(v) || v < s.min || v > s.max) bad(`must be a whole number from ${s.min} to ${s.max}`); break;
      case 'money': if (!Number.isSafeInteger(v) || v < s.min || v > MAX) bad(`must be a whole amount in minor units, from ${s.min} to ${MAX}`); break;
      case 'rate': if (!Number.isSafeInteger(v) || v < 0 || v > 10000) bad('must be a tax rate in basis points, 0 to 10000'); break;
      case 'date': if (typeof v !== 'string' || !isDate(v)) bad('must be a date as YYYY-MM-DD'); break;
      case 'ts': if (!Number.isSafeInteger(v) || v < 0) bad('must be a timestamp in milliseconds'); break;
      case 'enum': if (!s.values.includes(v)) bad(`must be one of ${s.values.join(', ')}`); break;
      case 'ean': if (!ns.barcode.isValidEan(v)) bad('must be an EAN-8, UPC-A, EAN-13 or GTIN-14 with a valid check digit'); break;
      case 'strings': if (!Array.isArray(v) || v.length > s.max || v.some((x) => typeof x !== 'string' || !x || x.length > s.itemMax)) bad(`must be up to ${s.max} tags of up to ${s.itemMax} characters`); break;
      case 'lines': case 'jlines': case 'countLines': checkList(s, v, field, errors); break;
    }
  }

  function checkList(s, v, field, errors) {
    if (!Array.isArray(v) || v.length < (s.min || 0)) { errors.push({ field, message: `needs at least ${s.min || 0} entr${s.min > 1 ? 'ies' : 'y'}` }); return; }
    const specs = s.t === 'lines' ? LINE : s.t === 'jlines' ? JLINE : COUNT;
    v.forEach((l, i) => {
      const f = `${field}[${i}]`;
      if (!isObj(l)) { errors.push({ field: f, message: 'must be an object' }); return; }
      checkFields(specs, l, errors, `${f}.`, []);
      if (s.t === 'lines' && Math.abs(l.qty * l.unitPrice) > MAX) errors.push({ field: f, message: 'line amount is too large' });
    });
  }

  function checkFields(specs, rec, errors, prefix, skip) {
    for (const [k, s] of Object.entries(specs)) {
      const v = rec[k];
      if (v === undefined || v === null || v === '') {
        if (s.req && !skip.includes(k)) errors.push({ field: prefix + k, message: 'is required' });
        continue;
      }
      checkValue(s, v, prefix + k, errors);
    }
  }

  function checkMeta(rec, errors) {
    for (const k of ['createdAt', 'updatedAt', 'deletedAt']) {
      if (rec[k] !== undefined && !(Number.isSafeInteger(rec[k]) && rec[k] >= 0)) errors.push({ field: k, message: 'must be a timestamp' });
    }
    if (rec.version !== undefined && !(Number.isSafeInteger(rec.version) && rec.version >= 1)) errors.push({ field: 'version', message: 'must be a whole number from 1' });
  }

  /** Totals must match what the lines say (skipped when the lines already have errors). */
  function checkDerived(rec, errors) {
    if (!Array.isArray(rec.lines) || errors.some((e) => e.field.startsWith('lines'))) return;
    const c = { ...rec, lines: rec.lines.map((l) => ({ ...l })) };
    derive(c);
    const bad = ['subtotal', 'tax', 'total'].some((k) => c[k] !== rec[k])
      || c.lines.some((l, i) => ['net', 'tax', 'total'].some((k) => l[k] !== rec.lines[i][k]));
    if (bad) errors.push({ field: 'total', message: 'does not match the lines' });
  }

  /** Checks a record in its stored shape. opts: skipKey (no id yet), deferNumber (number assigned later). */
  function validate(name, rec, opts = {}) {
    const d = DEFS[name];
    if (!d) return [{ field: '', message: `unknown collection ${name}` }];
    if (!isObj(rec)) return [{ field: '', message: 'record must be an object' }];
    const errors = [];
    for (const k of Object.keys(rec)) if (!(k in d.fields) && !META.includes(k)) errors.push({ field: k, message: `is not a field of ${name}` });
    checkFields(d.fields, rec, errors, '', opts.skipKey ? [d.key] : []);
    checkMeta(rec, errors);
    if (d.derive) checkDerived(rec, errors);
    if (d.check) for (const m of d.check(rec, opts)) errors.push({ field: '', message: m });
    return errors;
  }

  /** Normalises input: trims text, drops blanks, applies defaults, derives totals, then validates.
   *  Returns { ok, value, errors }. Unknown fields are errors; meta fields (createdAt...) are ignored. */
  function prepare(name, input, opts = {}) {
    const d = DEFS[name];
    if (!d) return { ok: false, value: null, errors: [{ field: '', message: `unknown collection ${name}` }] };
    if (!isObj(input)) return { ok: false, value: null, errors: [{ field: '', message: 'record must be an object' }] };
    const errors = [], out = {};
    for (const k of Object.keys(input)) if (!(k in d.fields) && !META.includes(k)) errors.push({ field: k, message: `is not a field of ${name}` });
    for (const [k, s] of Object.entries(d.fields)) {
      let v = typeof input[k] === 'string' ? input[k].trim() : input[k];
      if (v === '' || v === null) v = undefined;
      if (v === undefined) { if (s.def === undefined) continue; v = clone(s.def); } else v = normalize(s, v);
      if (v === '' || v === undefined) continue;
      out[k] = v;
    }
    derive(out);
    errors.push(...validate(name, out, opts));
    return { ok: errors.length === 0, value: out, errors };
  }

  function normalize(s, v) {
    if (s.t === 'ean') return ns.barcode.normalizeEan(v);
    if (s.t === 'currency') return String(v).toUpperCase();
    if (s.t === 'strings' && Array.isArray(v)) return [...new Set(v.map((x) => (typeof x === 'string' ? x.trim() : x)).filter(Boolean))];
    if (s.t === 'lines' && Array.isArray(v)) return v.map((l) => (isObj(l) ? { ...l } : l));
    if (s.t === 'jlines' && Array.isArray(v)) return v.map((l) => (isObj(l) ? { ...l, debit: l.debit ?? 0, credit: l.credit ?? 0 } : l));
    return v;
  }

  /** Why a store.put may not move a record from prev to next, or null. */
  function checkTransition(name, prev, next) {
    const d = DEFS[name];
    if (!d) return 'unknown collection';
    if (d.immutable) return `${name} records cannot be changed`;
    const same = (keys) => keys.every((k) => JSON.stringify(prev[k]) === JSON.stringify(next[k]));
    if (name === 'invoices') {
      if (prev.status !== next.status && !INVOICE_NEXT[prev.status].includes(next.status)) return `an invoice cannot go from ${prev.status} to ${next.status}`;
      if (prev.status !== 'draft' && !same(['customerId', 'date', 'dueDate', 'number', 'lines', 'notes', 'orderId', 'subtotal', 'tax', 'total'])) return 'an issued invoice cannot be changed; void it and issue a new one';
    }
    if (name === 'orders') {
      if (prev.status !== next.status && !ORDER_NEXT[prev.status].includes(next.status)) return `an order cannot go from ${prev.status} to ${next.status}`;
      if (prev.status !== 'open' && !same(['customerId', 'date', 'number', 'lines', 'notes'])) return 'a closed order cannot be changed';
    }
    if (name === 'numbering' && next.next < prev.next) return 'a numbering sequence can only move forward';
    return null;
  }

  /** Why a record may not be deleted, or null. */
  function removable(name, rec) {
    const d = DEFS[name];
    if (!d) return 'unknown collection';
    if (d.immutable) return `${name} records cannot be deleted`;
    if (d.noRemove) return d.noRemove;
    return d.removeRule ? d.removeRule(rec) : null;
  }

  /** Joins errors into one readable line: "lines[0].qty must be a whole number...". */
  function errorText(errors) {
    const e = (errors || [])[0];
    if (!e) return 'invalid record';
    return e.field ? `${e.field} ${e.message}` : e.message;
  }

  ns.schema = {
    COLLECTIONS, MAX_MINOR: MAX, META, ENUM, ACCT, DEFAULT_CHART, DEFAULT_SETTINGS, DEFAULT_SEQUENCES, INVOICE_NEXT, ORDER_NEXT,
    def: (name) => DEFS[name] || null, prepare, validate, checkTransition, removable, derive, movementError, journalErrors, errorText,
  };
})(typeof window !== 'undefined' ? window : globalThis);
