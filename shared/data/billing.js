// Invoices and payments: the only code that issues, pays or voids an invoice. Each step writes the
// document and its journal entry in one transaction, so the books always match the documents.
// Drafts are ordinary store.put calls; everything after that goes through these functions.
(function (g) {
  'use strict';
  const ns = (g.SlopData = g.SlopData || {});
  const { ok, fail } = ns.result;
  const A = () => ns.schema.ACCT;

  /** Pure: journal lines for an issued invoice. AR is debited for the total; revenue and tax are credited. Empty when the total is zero. */
  function invoiceLines(inv) {
    if (!inv.total) return [];
    const lines = [{ account: A().AR, debit: inv.total, credit: 0 }];
    if (inv.subtotal) lines.push({ account: A().REVENUE, debit: 0, credit: inv.subtotal });
    if (inv.tax) lines.push({ account: A().TAX_PAYABLE, debit: 0, credit: inv.tax });
    return lines;
  }

  /** Pure: total of the payments made against an invoice. */
  const paidOn = (payments) => payments.reduce((s, p) => s + p.amount, 0);

  /** Pure: what is still owed on an invoice given its payments. */
  const balanceDue = (inv, payments) => inv.total - paidOn(payments);

  async function loadInvoice(tx, id) {
    const r = await tx.get('invoices', id);
    if (!r.ok) return r;
    return r.value && !r.value.deletedAt ? ok(r.value) : fail('not_found', `no invoice ${id}`);
  }

  /** Draft -> issued. Takes the next invoice number, writes the journal (AR / revenue / tax) in the same transaction. */
  function issue(id) {
    return ns.store.transact(async (tx) => {
      const inv = await loadInvoice(tx, id);
      if (!inv.ok) return inv;
      if (inv.value.status !== 'draft') return fail('invalid_transition', 'only a draft can be issued');
      const cust = await tx.get('customers', inv.value.customerId);
      if (!cust.ok) return cust;
      if (!cust.value || cust.value.deletedAt) return fail('not_found', 'the customer on this invoice no longer exists');
      const up = await tx.put('invoices', { ...inv.value, status: 'issued', issuedAt: Date.now() }, { posting: true });
      if (!up.ok) return up;
      const lines = invoiceLines(up.value);
      if (!lines.length) return up;
      const j = await ns.ledger.postIn(tx, { date: up.value.date, memo: `Invoice ${up.value.number}`, source: `invoice:${id}:issue`, lines });
      return j.ok ? up : j;
    });
  }

  /** Records a payment against an issued invoice. Partial payments are allowed; the invoice becomes paid when nothing is due. */
  function recordPayment(input) {
    const { invoiceId, amount, date, method, note } = input || {};
    return ns.store.transact(async (tx) => {
      const inv = await loadInvoice(tx, invoiceId);
      if (!inv.ok) return inv;
      if (inv.value.status !== 'issued') return fail('invalid_transition', 'payments can be recorded only against an issued invoice');
      if (!Number.isSafeInteger(amount) || amount < 1) return fail('invalid', 'amount must be a positive whole number of minor units');
      const pays = await tx.list('payments', { index: 'invoiceId', value: invoiceId });
      if (!pays.ok) return pays;
      const due = balanceDue(inv.value, pays.value);
      if (amount > due) return fail('overpayment', `only ${due} is due on this invoice`);
      const id = ns.store.newId();
      const day = date || ns.ledger.today();
      const p = await tx.put('payments', { id, invoiceId, amount, date: day, method: method || 'bank', note }, { posting: true });
      if (!p.ok) return p;
      const bank = method === 'cash' ? A().CASH : A().BANK;
      const j = await ns.ledger.postIn(tx, {
        date: day, memo: `Payment for ${inv.value.number}`, source: `payment:${id}`,
        lines: [{ account: bank, debit: amount, credit: 0 }, { account: A().AR, debit: 0, credit: amount }],
      });
      if (!j.ok) return j;
      if (amount === due) {
        const s = await tx.put('invoices', { ...inv.value, status: 'paid' }, { posting: true });
        if (!s.ok) return s;
      }
      return p;
    });
  }

  /** Issued -> void. Only allowed while no payment exists (payments are immutable; refunds are not built yet). Reverses the issue entry. */
  function voidInvoice(id) {
    return ns.store.transact(async (tx) => {
      const inv = await loadInvoice(tx, id);
      if (!inv.ok) return inv;
      if (inv.value.status !== 'issued') return fail('invalid_transition', 'only an issued invoice can be voided');
      const pays = await tx.list('payments', { index: 'invoiceId', value: id });
      if (!pays.ok) return pays;
      if (pays.value.length) return fail('has_payments', 'this invoice has payments and cannot be voided');
      const v = await tx.put('invoices', { ...inv.value, status: 'void' }, { posting: true });
      if (!v.ok) return v;
      const je = await tx.list('journal', { index: 'source', value: `invoice:${id}:issue`, includeDeleted: true });
      if (!je.ok) return je;
      if (je.value.length) {
        const r = await ns.ledger.reverseIn(tx, je.value[0].id, { memo: `Void ${inv.value.number}` });
        if (!r.ok) return r;
      }
      return v;
    });
  }

  ns.billing = { invoiceLines, paidOn, balanceDue, issue, recordPayment, voidInvoice };
})(typeof window !== 'undefined' ? window : globalThis);
