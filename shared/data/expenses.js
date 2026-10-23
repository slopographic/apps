// Expenses: money going out (a supplier's bill, a receipt). The only code that records or voids one: each step writes the
// expense and its journal entry in one transaction, so the books always match. An expense is posted when it is recorded
// (paid): the expense account is debited with the amount without tax, the tax account with the reclaimable tax (it lowers
// the tax owed), and cash or bank is credited with what was paid. Voiding reverses that entry. A foreign-currency expense
// is posted at its date's rate (see fx.js).
(function (g) {
  'use strict';
  const ns = (g.SlopData = g.SlopData || {});
  const { fail } = ns.result;
  const A = () => ns.schema.ACCT;

  /** Pure: journal lines for an expense: amount (tax included), tax, account (the expense account) and method (cash or bank). */
  function expenseLines(e) {
    const net = e.amount - (e.tax || 0);
    const lines = [];
    if (net) lines.push({ account: e.account || A().EXPENSES, debit: net, credit: 0 });
    if (e.tax) lines.push({ account: A().TAX_PAYABLE, debit: e.tax, credit: 0 });
    lines.push({ account: e.method === 'cash' ? A().CASH : A().BANK, debit: 0, credit: e.amount });
    return lines;
  }

  /** Records a paid expense and posts it. input: { date, supplier, description, account, amount, tax, currency, method,
   *  receiptId, notes }. account must be an expense account in the chart (default 5000). */
  function record(input) {
    const e = { ...(input || {}) };
    return ns.store.transact(async (tx) => {
      const acct = await tx.get('accounts', e.account || A().EXPENSES);
      if (!acct.ok) return acct;
      if (!acct.value || acct.value.type !== 'expense') return fail('invalid', `account ${e.account} is not an expense account`, [{ field: 'account', message: 'choose an expense account' }]);
      const id = ns.store.newId();
      const rec = await tx.put('expenses', { ...e, id, account: acct.value.code, date: e.date || ns.ledger.today(), status: 'posted' }, { posting: true });
      if (!rec.ok) return rec;
      const j = await ns.ledger.postIn(tx, {
        date: rec.value.date, memo: `Expense: ${rec.value.supplier}`, source: `expense:${id}`, lines: expenseLines(rec.value), currency: rec.value.currency,
      });
      if (!j.ok) return j;
      return tx.put('expenses', { ...rec.value, rateId: j.value.rateId, rate: j.value.rate, amountBase: j.value.amountBase }, { posting: true });
    });
  }

  /** Posted -> void: reverses the expense's journal entry. The record stays, marked void, so the history is kept. */
  function voidExpense(id) {
    return ns.store.transact(async (tx) => {
      const r = await tx.get('expenses', id);
      if (!r.ok) return r;
      if (!r.value) return fail('not_found', `no expense ${id}`);
      if (r.value.status !== 'posted') return fail('invalid_transition', 'only a posted expense can be voided');
      const v = await tx.put('expenses', { ...r.value, status: 'void' }, { posting: true });
      if (!v.ok) return v;
      const je = await tx.list('journal', { index: 'source', value: `expense:${id}`, includeDeleted: true });
      if (!je.ok) return je;
      if (je.value.length) {
        const rev = await ns.ledger.reverseIn(tx, je.value[0].id, { memo: `Void expense: ${r.value.supplier}` });
        if (!rev.ok) return rev;
      }
      return v;
    });
  }

  /** Pure: totals of posted expenses (void ones left out), in their own currencies: { count, amount, tax, byAccount }. */
  function totals(list) {
    const out = { count: 0, amount: 0, tax: 0, byAccount: {} };
    for (const e of list || []) {
      if (e.status === 'void' || e.deletedAt) continue;
      out.count++; out.amount += e.amount; out.tax += e.tax || 0;
      out.byAccount[e.account] = (out.byAccount[e.account] || 0) + e.amount;
    }
    return out;
  }

  ns.expenses = { expenseLines, record, voidExpense, totals };
})(typeof window !== 'undefined' ? window : globalThis);
