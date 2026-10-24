// Customer statements: one customer's issued invoices and payments in one currency, oldest first, with a running balance,
// what was owed before the period (opening) and at its end (closing), and how old the amount still owed is (ageing by days
// past the due date: not yet due, 1-30, 31-60, 61-90, over 90). Pure: the invoices and payments come in, nothing is stored.
// Drafts, void and deleted invoices are left out (a void invoice owes nothing). Exposes SlopData.statement.
(function (g) {
  'use strict';
  const ns = (g.SlopData = g.SlopData || {});
  const DAY = 86400000;
  const days = (from, to) => Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / DAY);
  const counts = (inv) => (inv.status === 'issued' || inv.status === 'paid') && !inv.deletedAt;

  /** The currencies a customer has issued invoices in, most used first. */
  function currencies(invoices, customerId) {
    const n = new Map();
    for (const inv of invoices) if (inv.customerId === customerId && counts(inv)) n.set(inv.currency, (n.get(inv.currency) || 0) + 1);
    return [...n.entries()].sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1)).map(([c]) => c);
  }

  /** The statement. opts: { currency, from (YYYY-MM-DD, '' = from the start), today }. Result: { currency, from, today,
   *  opening, lines: [{ date, kind: 'invoice' | 'payment', ref, due, debit, credit, balance }], closing, owed: [{ ref, date,
   *  due, left, late }], ageing: { current, d30, d60, d90, over90 } }. Money is minor units. */
  function build(invoices, payments, customerId, { currency, from = '', today }) {
    const mine = invoices.filter((inv) => inv.customerId === customerId && inv.currency === currency && counts(inv));
    const byId = new Map(mine.map((inv) => [inv.id, inv]));
    const events = [];
    for (const inv of mine) events.push({ date: inv.date, kind: 'invoice', ref: inv.number || '', due: inv.dueDate || inv.date, debit: inv.total, credit: 0, at: 0 });
    for (const p of payments) {
      const inv = byId.get(p.invoiceId);
      if (inv) events.push({ date: p.date, kind: 'payment', ref: inv.number || '', due: '', debit: 0, credit: p.amount, at: 1 });
    }
    events.sort((a, b) => (a.date === b.date ? a.at - b.at : a.date < b.date ? -1 : 1));
    let opening = 0, balance = 0;
    const lines = [];
    for (const e of events) {
      balance += e.debit - e.credit;
      if (from && e.date < from) { opening = balance; continue; }
      lines.push({ date: e.date, kind: e.kind, ref: e.ref, due: e.due, debit: e.debit, credit: e.credit, balance });
    }
    const paid = new Map();
    for (const p of payments) if (byId.has(p.invoiceId)) paid.set(p.invoiceId, (paid.get(p.invoiceId) || 0) + p.amount);
    const ageing = { current: 0, d30: 0, d60: 0, d90: 0, over90: 0 }, owed = [];
    for (const inv of mine) {
      const left = inv.total - (paid.get(inv.id) || 0);
      if (left <= 0) continue;
      const late = Math.max(0, days(inv.dueDate || inv.date, today));
      owed.push({ ref: inv.number || '', date: inv.date, due: inv.dueDate || inv.date, left, late });
      ageing[late === 0 ? 'current' : late <= 30 ? 'd30' : late <= 60 ? 'd60' : late <= 90 ? 'd90' : 'over90'] += left;
    }
    owed.sort((a, b) => (a.due < b.due ? -1 : 1));
    return { currency, from, today, opening, lines, closing: balance, owed, ageing };
  }

  /** Pure: the statement as CSV (a header, then one line per event, with plain amounts through plain(minor)). */
  function csv(st, plain) {
    const cell = (v) => { const s = String(v ?? ''); return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
    const out = [['Date', 'What', 'Invoice', 'Due', 'Charged', 'Paid', 'Balance'].join(',')];
    if (st.from) out.push(['', 'Opening balance', '', '', '', '', plain(st.opening)].map(cell).join(','));
    for (const l of st.lines) out.push([l.date, l.kind === 'invoice' ? 'Invoice' : 'Payment', l.ref, l.due, l.debit ? plain(l.debit) : '', l.credit ? plain(l.credit) : '', plain(l.balance)].map(cell).join(','));
    return out.join('\r\n') + '\r\n';
  }

  /** Pure: a payment reminder for a statement's open invoices: { tone: 'none' | 'friendly' | 'firm' | 'final', subject, body }.
   *  The tone follows the most overdue invoice: due or up to 30 days late is friendly, up to 60 firm, beyond that final.
   *  who: { customer, company }; money(minor) formats an amount. Nothing owed: tone none and no text. */
  function reminder(st, { customer, company }, money) {
    if (!st.owed.length || st.closing <= 0) return { tone: 'none', subject: '', body: '' };
    const late = Math.max(...st.owed.map((o) => o.late));
    const tone = late <= 30 ? 'friendly' : late <= 60 ? 'firm' : 'final';
    const list = st.owed.map((o) => `- ${o.ref}, due ${o.due}: ${money(o.left)}${o.late ? ` (${o.late} day${o.late === 1 ? '' : 's'} late)` : ''}`).join('\n');
    const subject = { friendly: `A reminder: ${money(st.closing)} to pay`, firm: `Overdue: ${money(st.closing)} to pay`, final: `Final reminder: ${money(st.closing)} overdue` }[tone];
    const open = {
      friendly: 'A friendly reminder that the invoices below are open. If you have already paid, thank you, and please ignore this message.',
      firm: 'The invoices below are now overdue. Please arrange payment as soon as you can, or let us know if there is a problem with them.',
      final: 'Despite our earlier reminders, the invoices below are still unpaid and well past their due dates. Please pay the balance within 7 days, or contact us today to agree how it will be paid.',
    }[tone];
    const sign = company && company.trim() ? `Thank you,\n${company.trim()}` : 'Thank you.';   // no company name: no name line
    const body = `Hello ${customer},\n\n${open}\n\n${list}\n\nBalance owed: ${money(st.closing)}\n\n${sign}`;
    return { tone, subject, body };
  }

  ns.statement = { currencies, build, csv, reminder };
})(typeof window !== 'undefined' ? window : globalThis);
