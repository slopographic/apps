// Record a payment against an issued invoice through SlopData.billing.recordPayment. The amount defaults to the balance.
(function (g) {
  'use strict';
  const S = g.SlopData;
  const NS = (g.SlopInvoices = g.SlopInvoices || {});
  const U = NS.util;
  const M = g.SlopDocs.model;
  const UI = g.SlopUI;
  const h = U.h;

  /** Opens the dialog for an invoice. onDone() runs after a payment is stored. */
  async function open(invoiceId, onDone) {
    const c = await NS.context.load(invoiceId);
    if (!c.ok) { UI.alert('Not available', U.refusal(c)); return; }
    const inv = c.value.invoice;
    if (inv.status !== 'issued') { UI.alert('No payment', 'Payments can be recorded only against an issued invoice.'); return; }
    const due = c.value.balance;
    const amount = h('input', { type: 'text', inputmode: 'decimal', value: M.amountText(due, inv.currency) });
    const date = h('input', { type: 'date', value: S.ledger.today() });
    const method = UI.select([['bank', 'Bank transfer'], ['cash', 'Cash'], ['card', 'Card'], ['other', 'Other']], 'bank');
    const note = h('input', { type: 'text', maxlength: 300, autocomplete: 'off' });
    const msg = h('p', { class: 'msg bad', role: 'status' });
    const body = h('div', null,
      h('p', { class: 'note', text: `${inv.number} · balance due ${c.value.money(due)}` }),
      UI.field(`Amount (${inv.currency})`, amount), UI.field('Date', date), UI.field('Method', method), UI.field('Note', note), msg);
    UI.dialog({
      title: 'Record payment',
      body,
      buttons: [{ label: 'Cancel' }, {
        label: 'Record payment', primary: true,
        act: async () => {
          const minor = M.amountFromText(amount.value, inv.currency);
          if (!minor) { msg.textContent = 'Enter an amount above zero, with no more decimals than the currency has.'; return false; }
          if (minor > due) { msg.textContent = `Only ${c.value.money(due)} is due.`; return false; }
          const r = await S.billing.recordPayment({ invoiceId, amount: minor, date: date.value, method: method.value, note: note.value.trim() || undefined });
          if (!r.ok) { msg.textContent = U.refusal(r); return false; }
          UI.toast(minor === due ? `${inv.number} is paid` : 'Payment recorded');
          if (onDone) onDone();
          return undefined;
        },
      }],
    });
    setTimeout(() => amount.select(), 30);
  }

  NS.paymentDialog = { open };
})(typeof window !== 'undefined' ? window : globalThis);
