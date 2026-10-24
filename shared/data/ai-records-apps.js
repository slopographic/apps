/* SlopDataAI.APPS: which records each business app's assistant works on (shared/data/ai-records.js install(app)), how a
 * posting-only record is made (SlopData.expenses.record), and the app's own steps through SlopData and the app's PDF
 * (SlopDocs.docPdf, shared/docs): issue an invoice, record a payment, a document's PDF to Slop Drive, invoices from time,
 * stock movements. Classic script, loaded after ai-records.js. */
(function (g) {
  'use strict';
  const D = () => g.SlopData, AI = g.SlopDataAI;
  const S = (name, description, extra) => Object.assign({ name, type: 'string', maxLength: 200, description }, extra);
  const TO = { name: 'to', type: 'enum', values: ['drive', 'download', 'both'], default: 'drive' };
  const LINES = { name: 'lines', type: 'array', required: true, maxItems: 100,
    items: { type: 'object', properties: { description: { type: 'string' }, qty: { type: 'number' }, unit_price: { type: 'string', description: 'like 12.50' }, tax_rate: { type: 'string', description: 'percent like 20' }, sku: { type: 'string' } } },
    description: 'the lines: [{ description, qty, unit_price, tax_rate }]' };
  const today = () => new Date().toISOString().slice(0, 10);

  /** A document's PDF through the app's own renderer (SlopDocs.docPdf: NS.pdf.load or NS.context.load, then viewOf). */
  async function docPdf(ns, id) {
    const NS = g[ns];
    if (!NS || !NS.pdf || !g.SlopDocs || !g.SlopDocs.pdf) throw new Error('This page cannot make the PDF');
    const c = await (NS.pdf.load || NS.context.load)(id);
    const ctx = AI.unwrap(c, 'Open');
    const bytes = AI.unwrap(await g.SlopDocs.pdf.renderPdf(NS.pdf.viewOf(ctx)), 'PDF');
    const doc = ctx.invoice || ctx.order || ctx.quote || ctx.purchase || ctx.doc || ctx.record || {};
    return { blob: new Blob([bytes], { type: 'application/pdf' }), name: `${doc.number || 'draft'}.pdf` };
  }
  /** A document id from an id or a number (INV-0003). */
  async function docId(collection, q) {
    const r = await D().store.get(collection, String(q));
    if (r.ok && r.value) return r.value.id;
    const list = AI.unwrap(await D().store.list(collection), 'List'), hit = list.find((x) => x.number === String(q).trim());
    if (!hit) throw new Error(`No ${collection} ${q}`);
    return hit.id;
  }
  function pdfCommand(add, collection, ns, noun) {
    add(`export_${noun}_pdf`, `Export the ${noun} as PDF`, [S('id', `the ${noun} id or number`, { required: true }), TO],
      async (a) => { const p = await docPdf(ns, await docId(collection, a.id)); return AI.save(p.blob, p.name, a.to, collection); },
      { description: `The ${noun}'s PDF (the same as Print), to Slop Drive and/or a download.` });
  }
  /** A draft document from a customer name and plain lines. */
  function docCommand(add, collection, noun, extraArgs = []) {
    add(`create_${noun}`, `Create ${noun === 'order' ? 'an' : 'a'} ${noun}`, [S('customer', noun === 'purchase' ? 'the supplier name (made when new)' : 'the customer name (made when new)', { required: true }),
      S('email', 'their e-mail, for a new customer'), LINES, S('date', 'YYYY-MM-DD, today when empty', { maxLength: 10 }), S('currency', 'ISO code, the default when empty', { maxLength: 3 }),
      S('notes', 'notes on the document', { maxLength: 2000 })].concat(extraArgs),
    async (a) => {
      const fields = { customer: a.customer, date: a.date || today(), lines: a.lines.map((l) => ({ description: l.description, qty: l.qty || 1, unitPrice: l.unit_price ?? l.unitPrice ?? l.price ?? 0, taxRate: l.tax_rate ?? l.taxRate ?? 0, sku: l.sku })) };
      if (noun === 'purchase') fields.supplier = true;
      if (a.currency) fields.currency = a.currency;
      if (a.notes) fields.notes = a.notes;
      if (a.due_days != null) fields.dueDate = D().ledger.addDays(fields.date, a.due_days);
      if (a.valid_days != null) fields.validUntil = D().ledger.addDays(fields.date, a.valid_days);
      if (a.email && !(await D().store.list('customers')).value.some((c) => c.name.toLowerCase() === a.customer.toLowerCase())) fields.customerId = await AI.customerId(a.customer, { email: a.email });
      const rec = await AI.toRecord(collection, fields);
      const made = AI.unwrap(await D().store.put(collection, rec), `New ${noun}`);
      AI.remember({ kind: 'created', collection, id: made.id });
      let note = '';
      if (a.issue && collection === 'invoices') { const r = AI.unwrap(await D().billing.issue(made.id), 'Issue'); note = ` Issued as ${r.number || (await D().store.get('invoices', made.id)).value.number}.`; }
      const now = AI.unwrap(await D().store.get(collection, made.id), 'Read');
      return { done: `Created ${noun} ${now.number || '(draft)'} for ${a.customer}, total ${D().money.formatMinor(now.total || 0, now.currency || 'USD')}.${note}`, id: made.id, number: now.number || null };
    }, { description: `Make ${noun === 'order' ? 'an' : 'a'} ${noun} in one step: the customer by name and the lines with prices.` });
  }

  const CUSTOMER_TYPES = ['customers'];
  AI.APPS = {
    invoices: { label: 'Slop Invoices', collections: ['invoices', 'customers', 'products'], extra(add) {
      docCommand(add, 'invoices', 'invoice', [{ name: 'due_days', type: 'number', min: 0, max: 365, integer: true, description: 'days until due' }, { name: 'issue', type: 'boolean', default: false, description: 'issue it now (number it, post it)' }]);
      add('issue_invoice', 'Issue an invoice', [S('id', 'invoice id or number', { required: true })], async (a) => { const id = await docId('invoices', a.id); AI.unwrap(await D().billing.issue(id), 'Issue'); return `Issued ${(await D().store.get('invoices', id)).value.number}.`; },
        { destructive: false, description: 'Number and post a draft invoice (it cannot be edited after).' });
      add('record_payment', 'Record a payment', [S('id', 'invoice id or number', { required: true }), S('amount', 'like 120.00; the balance when empty'), { name: 'method', type: 'enum', values: D().schema.ENUM.payMethod, default: 'bank' }, S('date', 'YYYY-MM-DD', { maxLength: 10 })],
        async (a) => {
          const id = await docId('invoices', a.id), inv = (await D().store.get('invoices', id)).value;
          const pays = (await D().store.list('payments', { index: 'invoiceId', value: id })).value || [];
          const amount = a.amount ? (await AI.toRecord('payments', { amount: a.amount, currency: inv.currency })).amount : D().billing.balanceDue(inv, pays);
          AI.unwrap(await D().billing.recordPayment({ invoiceId: id, amount, method: a.method, date: a.date || today() }), 'Payment');
          return `Recorded ${D().money.formatMinor(amount, inv.currency)} on ${inv.number}.`;
        });
      pdfCommand(add, 'invoices', 'SlopInvoices', 'invoice');
    } },
    orders: { label: 'Slop Orders', collections: ['orders', 'customers', 'products'], extra(add) { docCommand(add, 'orders', 'order'); pdfCommand(add, 'orders', 'SlopOrders', 'order'); } },
    quotes: { label: 'Slop Quotes', collections: ['quotes', 'customers', 'products'], extra(add) {
      docCommand(add, 'quotes', 'quote', [{ name: 'valid_days', type: 'number', min: 0, max: 365, integer: true, description: 'days the quote is valid' }]); pdfCommand(add, 'quotes', 'SlopQuotes', 'quote');
    } },
    purchases: { label: 'Slop Purchases', collections: ['purchases', 'customers', 'products'], extra(add) { docCommand(add, 'purchases', 'purchase'); pdfCommand(add, 'purchases', 'SlopPurchases', 'purchase'); } },
    crm: { label: 'Slop CRM', collections: CUSTOMER_TYPES },
    contacts: { label: 'Slop Contacts', collections: CUSTOMER_TYPES },
    inventory: { label: 'Slop Inventory', collections: ['products', 'stockMovements'], post: { stockMovements: (r) => D().stock.move(r) }, extra(add) {
      add('stock_move', 'Move stock', [S('product', 'product id, SKU or name', { required: true }), { name: 'qty', type: 'number', min: -1e6, max: 1e6, integer: true, required: true, description: 'positive in, negative out' },
        { name: 'reason', type: 'enum', values: D().schema.ENUM.stockReason, default: 'adjustment' }, S('location', 'default main')],
      async (a) => {
        const list = AI.unwrap(await D().store.list('products'), 'Products'), q = String(a.product).toLowerCase();
        const p = list.find((x) => x.id === a.product || x.sku.toLowerCase() === q) || list.find((x) => x.name.toLowerCase().includes(q));
        if (!p) throw new Error(`No product “${a.product}”`);
        AI.unwrap(await D().stock.move({ productId: p.id, qty: a.qty, reason: a.reason, location: a.location || 'main', date: today() }), 'Stock');
        return `Moved ${a.qty} of ${p.name}; on hand now ${AI.unwrap(await D().stock.onHand(p.id), 'Stock')}.`;
      });
    } },
    expenses: { label: 'Slop Expenses', collections: ['expenses'], post: { expenses: (r) => D().expenses.record(r) } },
    timesheets: { label: 'Slop Timesheets', collections: ['timeEntries', 'customers'] },
    todo: { label: 'Slop To-do', collections: ['tasks'] },
    calendar: { label: 'Slop Calendar', collections: ['events', 'tasks'] },
  };
})(typeof window !== 'undefined' ? window : globalThis);
