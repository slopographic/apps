// Record definitions: enums, the default chart, settings and sequences, field specs and the collection
// table (DEFS). Pure data plus the small check helpers the table names. schema.js validates against it.
// Load order: money.js, barcode.js, schema-defs.js, schema.js. Exposes window.SlopData.schemaDefs.
(function (g) {
  'use strict';
  const ns = (g.SlopData = g.SlopData || {});
  const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);

  const ENUM = {
    stage: ['lead', 'contacted', 'customer', 'lost'],
    invoiceStatus: ['draft', 'issued', 'paid', 'void'],
    orderStatus: ['draft', 'open', 'fulfilled', 'cancelled'],   // open = confirmed
    quoteStatus: ['draft', 'sent', 'accepted', 'declined'],
    pdfLayout: ['classic', 'modern', 'minimal', 'bold', 'sidebar'],   // PDF and print template (shared/docs/pdf-layouts.js); absent = random from pdfSeed
    accountType: ['asset', 'liability', 'equity', 'revenue', 'expense'],
    payMethod: ['cash', 'bank', 'card', 'other'],
    stockReason: ['receipt', 'sale', 'adjustment', 'transfer', 'count', 'return'],
    rateSource: ['manual', 'ecb', 'fixed'],
    tagColor: ['blue', 'green', 'amber', 'red', 'violet', 'teal', 'pink', 'grey'],
    eventKind: ['event', 'call', 'meeting'],
    repeatFreq: ['none', 'daily', 'weekly', 'monthly', 'yearly'],
    priority: ['none', 'low', 'high'],
    reminderSource: ['event', 'task', 'custom'],
    expenseStatus: ['posted', 'void'],
  };
  const ACCT = { CASH: '1000', BANK: '1010', AR: '1200', TAX_PAYABLE: '2100', EQUITY: '3000', REVENUE: '4000', EXPENSES: '5000' };
  const DEFAULT_CHART = [
    { code: '1000', name: 'Cash', type: 'asset' }, { code: '1010', name: 'Bank', type: 'asset' }, { code: '1200', name: 'Accounts Receivable', type: 'asset' },
    { code: '2100', name: 'Sales Tax Payable', type: 'liability' }, { code: '3000', name: 'Equity', type: 'equity' },
    { code: '4000', name: 'Sales Revenue', type: 'revenue' }, { code: '5000', name: 'Expenses', type: 'expense' },
  ];
  // defaultCurrency is the ledger's base currency. locale is refined from the browser by currency.js at seed time.
  const DEFAULT_SETTINGS = { id: 'main', defaultCurrency: 'USD', locale: 'en-US', defaultTaxRate: 0, paymentTermsDays: 30, ratesUpdateOnOpen: false };
  const DEFAULT_SEQUENCES = [{ id: 'invoice', prefix: 'INV-', pad: 4, next: 1 }, { id: 'order', prefix: 'ORD-', pad: 4, next: 1 }, { id: 'quote', prefix: 'QUO-', pad: 4, next: 1 }];
  const INVOICE_NEXT = { draft: ['issued'], issued: ['paid', 'void'], paid: [], void: [] };
  const ORDER_NEXT = { draft: ['open', 'cancelled'], open: ['fulfilled', 'cancelled'], fulfilled: [], cancelled: [] };
  // A sent quote can go back to draft to be revised; a declined one can be reopened; an accepted one is final.
  const QUOTE_NEXT = { draft: ['sent', 'accepted', 'declined'], sent: ['draft', 'accepted', 'declined'], accepted: [], declined: ['draft'] };
  const RX = { currency: /^[A-Z]{3}$/, locale: /^[A-Za-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$/ };

  // Field specs. t = type; req = required; def = default; min/max/values/pattern/itemMax as named.
  const F = {
    id: (o) => ({ t: 'id', ...o }),
    str: (o) => ({ t: 'string', max: 200, ...o }),
    text: (o) => ({ t: 'text', max: 5000, ...o }),
    int: (o) => ({ t: 'int', min: -1e9, max: 1e9, ...o }),
    mny: (o) => ({ t: 'money', min: 0, ...o }),
    rate: (o) => ({ t: 'rate', ...o }),
    fxRate: (o) => ({ t: 'int', min: 1, max: 1e12, ...o }),
    date: (o) => ({ t: 'date', ...o }),
    ts: (o) => ({ t: 'ts', ...o }),
    en: (values, o) => ({ t: 'enum', values, ...o }),
    cur: (o) => ({ t: 'currency', ...o }),
    bool: (o) => ({ t: 'bool', ...o }),
    entries: (o) => ({ t: 'entries', max: 10, valMax: 200, ...o }),
  };
  const LINE = {
    productId: F.id(), sku: F.str({ max: 80 }), description: F.str({ req: true, max: 300 }),
    qty: F.int({ req: true, min: 1, max: 1e6 }), unitPrice: F.mny({ req: true }), taxRate: F.rate({ req: true }),
    discount: F.int({ min: 0, max: 10000 }),   // basis points off the line net (absent = none)
    net: F.mny(), tax: F.mny(), total: F.mny(),
  };
  // debit and credit are base-currency minor units. origDebit and origCredit are the original amounts of a foreign posting.
  const JLINE = { account: F.str({ req: true, max: 4, pattern: /^\d{4}$/ }), debit: F.mny({ def: 0 }), credit: F.mny({ def: 0 }), origDebit: F.mny({}), origCredit: F.mny({}) };
  const COUNT = { productId: F.id({ req: true }), expected: F.int({ req: true }), counted: F.int({ req: true, min: 0 }), diff: F.int({ req: true }) };

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

  const DEFS = {
    settings: { key: 'id', singleton: 'main', fields: {
      id: F.id({ req: true, def: 'main' }), companyName: F.str({}), address: F.text({ max: 1000 }), taxNumber: F.str({ max: 60 }),
      defaultCurrency: F.cur({ def: 'USD' }), locale: { t: 'locale', def: 'en-US' }, defaultTaxRate: F.rate({ def: 0 }),
      paymentTermsDays: F.int({ min: 0, max: 365, def: 30 }), ratesUpdateOnOpen: F.bool({ def: false }) } },
    // The first phone, e-mail and address are kept in phone, email and address (other apps read them). Each has a
    // label (mobile, work, home, other ...). Further values are in phones, emails and addresses ({ label, value }).
    customers: { key: 'id', softDelete: true, indexes: [{ name: 'name', key: 'name' }, { name: 'stage', key: 'stage' }, { name: 'categories', key: 'categories', multi: true }], fields: {
      id: F.id({ req: true }), name: F.str({ req: true }), email: F.str({ max: 200 }), phone: F.str({ max: 60 }), address: F.text({ max: 1000 }),
      categories: { t: 'strings', max: 20, itemMax: 40, def: [] }, stage: F.en(ENUM.stage, { def: 'lead' }), notes: F.text({}),
      contactId: F.str({ max: 80 }), followUp: F.date({}), sample: F.bool({}),   // sample: made by a random-sample generator (absent otherwise)
      groupIds: { t: 'strings', max: 50, itemMax: 80, def: [] }, tagIds: { t: 'strings', max: 50, itemMax: 80, def: [] },
      company: F.str({ max: 200 }), department: F.str({ max: 200 }), title: F.str({ max: 200 }), website: F.str({ max: 300 }),
      birthday: F.str({ max: 20 }), photo: F.str({ max: 400000 }),
      phoneLabel: F.str({ max: 40 }), emailLabel: F.str({ max: 40 }), addressLabel: F.str({ max: 40 }),
      phones: F.entries({ max: 10, valMax: 60 }), emails: F.entries({ max: 10, valMax: 200 }), addresses: F.entries({ max: 10, valMax: 1000 }) } },
    // Groups: named sets a customer can belong to (many to many). Customers keep the group ids in groupIds.
    customerGroups: { key: 'id', fields: {
      id: F.id({ req: true }), name: F.str({ req: true, max: 60 }) } },
    // Tags: coloured labels with one definition each. Customers keep the tag ids in tagIds. Merge and delete update customers.
    customerTags: { key: 'id', fields: {
      id: F.id({ req: true }), name: F.str({ req: true, max: 40 }), color: F.en(ENUM.tagColor, { req: true, def: 'blue' }) } },
    products: { key: 'id', unique: ['sku', 'ean'], refs: [{ collection: 'stockMovements', index: 'productId' }],
      indexes: [{ name: 'sku', key: 'sku', unique: true }, { name: 'ean', key: 'ean', unique: true }, { name: 'name', key: 'name' }], fields: {
      id: F.id({ req: true }), sku: F.str({ req: true, max: 80, pattern: /^\S+$/ }), ean: { t: 'ean' }, name: F.str({ req: true }),
      description: F.text({}), price: F.mny({ req: true }), taxRate: F.rate({ req: true }), unit: F.str({ max: 20, def: 'each' }),
      reorderLevel: F.int({ min: 0, max: 1e9 }), sample: F.bool({}) } },
    orders: { key: 'id', derive: true, unique: ['number'], autoNumber: { seq: 'order', when: () => true }, check: orderCheck, docCurrency: true,
      noRemove: 'orders cannot be deleted; cancel them instead',
      indexes: [{ name: 'number', key: 'number', unique: true }, { name: 'customerId', key: 'customerId' }, { name: 'status', key: 'status' }, { name: 'date', key: 'date' }], fields: {
      id: F.id({ req: true }), number: F.str({ max: 40 }), customerId: F.id({ req: true }), date: F.date({ req: true }), currency: F.cur({}),
      status: F.en(ENUM.orderStatus, { def: 'draft' }), lines: { t: 'lines', min: 1, req: true }, subtotal: F.mny(), tax: F.mny(), total: F.mny(),
      notes: F.text({}), invoiceId: F.id({}), quoteId: F.id({}), sample: F.bool({}),
      pdfSeed: F.int({ min: 0, max: 2147483647 }), pdfLayout: F.en(ENUM.pdfLayout, {}) } },
    invoices: { key: 'id', softDelete: true, derive: true, unique: ['number'], check: invoiceCheck, docCurrency: true,
      autoNumber: { seq: 'invoice', when: (r) => r.status !== 'draft' },
      removeRule: (r) => (r.status !== 'draft' ? 'issued invoices cannot be deleted; void them instead' : null),
      indexes: [{ name: 'number', key: 'number', unique: true }, { name: 'customerId', key: 'customerId' }, { name: 'status', key: 'status' }, { name: 'date', key: 'date' }], fields: {
      id: F.id({ req: true }), number: F.str({ max: 40 }), customerId: F.id({ req: true }), date: F.date({ req: true }), dueDate: F.date({}),
      currency: F.cur({}), status: F.en(ENUM.invoiceStatus, { def: 'draft' }), lines: { t: 'lines', min: 0, def: [] }, subtotal: F.mny(), tax: F.mny(), total: F.mny(),
      rateId: F.id({}), rate: F.fxRate({}), amountBase: F.mny({}),
      notes: F.text({}), orderId: F.id({}), quoteId: F.id({}), issuedAt: F.ts({}), sample: F.bool({}),
      pdfSeed: F.int({ min: 0, max: 2147483647 }), pdfLayout: F.en(ENUM.pdfLayout, {}) } },
    // Quotes (estimates): a priced offer. Nothing is posted; an accepted quote becomes an order or a draft invoice (quotes.js).
    quotes: { key: 'id', derive: true, unique: ['number'], autoNumber: { seq: 'quote', when: () => true }, check: quoteCheck, docCurrency: true,
      noRemove: 'quotes cannot be deleted; decline them instead',
      indexes: [{ name: 'number', key: 'number', unique: true }, { name: 'customerId', key: 'customerId' }, { name: 'status', key: 'status' }, { name: 'date', key: 'date' }], fields: {
      id: F.id({ req: true }), number: F.str({ max: 40 }), customerId: F.id({ req: true }), date: F.date({ req: true }), validUntil: F.date({}),
      currency: F.cur({}), status: F.en(ENUM.quoteStatus, { def: 'draft' }), lines: { t: 'lines', min: 1, req: true }, subtotal: F.mny(), tax: F.mny(), total: F.mny(),
      notes: F.text({}), orderId: F.id({}), invoiceId: F.id({}), sample: F.bool({}),
      pdfSeed: F.int({ min: 0, max: 2147483647 }), pdfLayout: F.en(ENUM.pdfLayout, {}) } },
    payments: { key: 'id', immutable: true, postingOnly: true, indexes: [{ name: 'invoiceId', key: 'invoiceId' }, { name: 'date', key: 'date' }], fields: {
      id: F.id({ req: true }), invoiceId: F.id({ req: true }), amount: F.mny({ req: true, min: 1 }), date: F.date({ req: true }),
      currency: F.cur({}), rateId: F.id({}), rate: F.fxRate({}), amountBase: F.mny({}),
      method: F.en(ENUM.payMethod, { def: 'bank' }), note: F.str({ max: 300 }) } },
    accounts: { key: 'code', noRemove: 'accounts cannot be deleted', indexes: [{ name: 'type', key: 'type' }], fields: {
      code: F.str({ req: true, max: 4, pattern: /^\d{4}$/ }), name: F.str({ req: true }), type: F.en(ENUM.accountType, { req: true }) } },
    journal: { key: 'id', immutable: true, postingOnly: true, unique: ['source'], check: (r) => [...journalErrors(r.lines), ...fxErrors(r)],
      indexes: [{ name: 'source', key: 'source', unique: true }, { name: 'date', key: 'date' }, { name: 'reverses', key: 'reverses' }], fields: {
      id: F.id({ req: true }), date: F.date({ req: true }), memo: F.str({ max: 300 }), source: F.str({ req: true, max: 200 }),
      currency: F.cur({}), amount: F.mny({}), amountBase: F.mny({}), rateId: F.id({}), rate: F.fxRate({}),
      lines: { t: 'jlines', min: 2, req: true }, reverses: F.id({}) } },
    // Rates are immutable: a correction is a new dated row. rate = units of quote per 1 unit of base, scaled by 1e6.
    exchangeRates: { key: 'id', immutable: true, check: rateCheck, fields: {
      id: F.id({ req: true }), base: F.cur({ req: true }), quote: F.cur({ req: true }), date: F.date({ req: true }),
      rate: F.fxRate({ req: true }), source: F.en(ENUM.rateSource, { req: true, def: 'manual' }), note: F.str({ max: 300 }) } },
    stockMovements: { key: 'id', immutable: true, postingOnly: true, check: (r) => [movementError(r.reason, r.qty)].filter(Boolean),
      indexes: [{ name: 'productId', key: 'productId' }, { name: 'location', key: 'location' }], fields: {
      id: F.id({ req: true }), productId: F.id({ req: true }), location: F.str({ req: true, max: 40, def: 'main' }),
      qty: F.int({ req: true }), reason: F.en(ENUM.stockReason, { req: true }), date: F.date({ req: true }), ref: F.str({ max: 200 }), note: F.text({ max: 300 }) } },
    stockCounts: { key: 'id', immutable: true, postingOnly: true, check: countCheck, indexes: [{ name: 'location', key: 'location' }, { name: 'date', key: 'date' }], fields: {
      id: F.id({ req: true }), location: F.str({ req: true, max: 40 }), date: F.date({ req: true }), lines: { t: 'countLines', min: 1, req: true },
      notes: F.text({}), status: F.en(['posted'], { def: 'posted' }) } },
    numbering: { key: 'id', noRemove: 'sequences cannot be deleted', fields: {
      id: F.id({ req: true }), prefix: F.str({ max: 20 }), pad: F.int({ min: 1, max: 12, def: 4 }), next: F.int({ req: true, min: 1, max: 1e12 }) } },
    // Calendar events. Timed events keep epoch ms in start and end; all-day events keep startDay and endDay (inclusive).
    // tz is the zone the event was made in. freq, until and remind (minutes before start) describe repeats and reminders.
    events: { key: 'id', check: eventCheck, indexes: [{ name: 'customerId', key: 'customerId' }, { name: 'start', key: 'start' }], fields: {
      id: F.id({ req: true }), title: F.str({ req: true, max: 200 }), allDay: F.bool({ def: false }),
      startDay: F.date({}), endDay: F.date({}), start: F.ts({}), end: F.ts({}), tz: F.str({ req: true, max: 64 }),
      location: F.str({ max: 200 }), notes: F.text({}), color: F.en(ENUM.tagColor, { def: 'blue' }), kind: F.en(ENUM.eventKind, { def: 'event' }),
      freq: F.en(ENUM.repeatFreq, { def: 'none' }), until: F.date({}), remind: F.int({ min: 0, max: 525600 }),
      customerId: F.id({}), uid: F.str({ max: 120 }) } },
    // To-do tasks. due (YYYY-MM-DD) and dueTime (HH:MM, in tz) are the due moment. parentId makes a subtask.
    tasks: { key: 'id', check: taskCheck, indexes: [{ name: 'list', key: 'list' }, { name: 'customerId', key: 'customerId' }, { name: 'parentId', key: 'parentId' }], fields: {
      id: F.id({ req: true }), title: F.str({ req: true, max: 200 }), notes: F.text({}), due: F.date({}),
      dueTime: F.str({ max: 5, pattern: /^([01]\d|2[0-3]):[0-5]\d$/ }), tz: F.str({ max: 64 }), priority: F.en(ENUM.priority, { def: 'none' }),
      list: F.str({ max: 40, def: 'Inbox' }), tags: { t: 'strings', max: 20, itemMax: 40, def: [] }, parentId: F.id({}),
      done: F.bool({ def: false }), doneAt: F.ts({}), freq: F.en(ENUM.repeatFreq, { def: 'none' }), until: F.date({}),
      remind: F.int({ min: 0, max: 525600 }), customerId: F.id({}) } },
    // Money going out (shared/data/expenses.js writes them with their journal entry). amount is what was paid, tax included;
    // tax is the reclaimable part. account is the expense account in the chart.
    // Time worked (shared/data/timesheets.js bills it). minutes and rate (per hour, minor units) price it; billable time
    // needs a customer. invoiceId is the invoice it was billed on; time on a void or deleted invoice is open again.
    timeEntries: { key: 'id', check: (r) => (r.billable && !r.customerId ? ['billable time needs a customer'] : []),
      removeRule: (r) => (r.invoiceId ? 'billed time cannot be deleted; void its invoice first' : null),
      indexes: [{ name: 'date', key: 'date' }, { name: 'customerId', key: 'customerId' }, { name: 'invoiceId', key: 'invoiceId' }], fields: {
      id: F.id({ req: true }), date: F.date({ req: true }), customerId: F.id({}), project: F.str({ max: 80 }), description: F.str({ req: true, max: 300 }),
      minutes: F.int({ req: true, min: 1, max: 1440 }), rate: F.mny({ def: 0 }), currency: F.cur({}), billable: F.bool({ def: true }),
      invoiceId: F.id({}), sample: F.bool({}) } },
    expenses: { key: 'id', postingOnly: true, check: (r) => (r.tax > r.amount ? ['tax cannot be more than the amount paid'] : []),
      indexes: [{ name: 'date', key: 'date' }, { name: 'supplier', key: 'supplier' }, { name: 'status', key: 'status' }], fields: {
      id: F.id({ req: true }), date: F.date({ req: true }), supplier: F.str({ req: true, max: 200 }), description: F.str({ max: 300 }),
      account: F.str({ req: true, max: 4, pattern: /^\d{4}$/ }), amount: F.mny({ req: true, min: 1 }), tax: F.mny({ def: 0 }),
      currency: F.cur({}), rateId: F.id({}), rate: F.fxRate({}), amountBase: F.mny({}),
      method: F.en(ENUM.payMethod, { def: 'bank' }), status: F.en(ENUM.expenseStatus, { def: 'posted' }),
      receiptId: F.str({ max: 200 }), notes: F.text({}), sample: F.bool({}) } },
    // Reminders. Custom reminders are rows of their own (source custom). Event and task reminders are read from the
    // events and tasks; a row here only records what the person did (snoozedUntil, firedAt, dismissedAt) for one of them.
    reminders: { key: 'id', indexes: [{ name: 'source', key: 'source' }], fields: {
      id: F.id({ req: true }), source: F.en(ENUM.reminderSource, { req: true }), refId: F.id({}), title: F.str({ req: true, max: 200 }),
      at: F.ts({ req: true }), snoozedUntil: F.ts({}), firedAt: F.ts({}), dismissedAt: F.ts({}) } },
  };
  const COLLECTIONS = Object.keys(DEFS);

  ns.schemaDefs = {
    ENUM, ACCT, DEFAULT_CHART, DEFAULT_SETTINGS, DEFAULT_SEQUENCES, INVOICE_NEXT, ORDER_NEXT, QUOTE_NEXT, RX, F, LINE, JLINE, COUNT,
    DEFS, COLLECTIONS, movementError, journalErrors, fxErrors,
  };
})(typeof window !== 'undefined' ? window : globalThis);
