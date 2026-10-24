// Issue a credit note against an issued or paid invoice through SlopData.credits.issue. The amount defaults to all that can
// still be credited. When the credit is more than is still owed, the rest is paid back, so the dialog asks how.
(function (g) {
  'use strict';
  const S = g.SlopData;
  const NS = (g.SlopInvoices = g.SlopInvoices || {});
  const U = NS.util;
  const M = g.SlopDocs.model;
  const UI = g.SlopUI;
  const h = U.h;

  /** Opens the dialog for an invoice. onDone() runs after the credit note is stored. */
  async function open(invoiceId, onDone) {
    const c = await NS.context.load(invoiceId);
    if (!c.ok) { UI.alert('Not available', U.refusal(c)); return; }
    const inv = c.value.invoice, money = c.value.money;
    if (inv.status !== 'issued' && inv.status !== 'paid') { UI.alert('No credit note', 'Only an issued or paid invoice can be credited.'); return; }
    const most = S.credits.creditable(inv), due = Math.max(0, S.billing.balanceDue(inv, c.value.payments));
    const amount = h('input', { type: 'text', inputmode: 'decimal', value: M.amountText(most, inv.currency) });
    const date = h('input', { type: 'date', value: S.ledger.today() });
    const reason = h('input', { type: 'text', maxlength: 300, autocomplete: 'off', placeholder: 'Returned goods, a price agreed later…' });
    const method = UI.select([['bank', 'Bank transfer'], ['cash', 'Cash'], ['card', 'Card'], ['other', 'Other']], 'bank');
    const refundRow = UI.field('Pay back by', method);
    const refundNote = h('p', { class: 'note' });
    const msg = h('p', { class: 'msg bad', role: 'status' });
    /** Shows how the credit lands: off the balance, and what is paid back (with its method) when it is more than is owed. */
    const preview = () => {
      const minor = M.amountFromText(amount.value, inv.currency) || 0;
      const { applied, refund } = S.credits.effect(due, Math.min(minor, most));
      refundRow.hidden = !refund;
      refundNote.textContent = minor ? `${money(applied)} comes off what is owed${refund ? `; ${money(refund)} is paid back to the customer` : ''}.` : '';
    };
    amount.addEventListener('input', preview);
    const body = h('div', { class: 'credit-dialog' },
      h('p', { class: 'note', text: `${inv.number} · total ${money(inv.total)} · owed ${money(due)} · can still be credited ${money(most)}` }),
      UI.field(`Amount to credit (${inv.currency})`, amount), UI.field('Date', date), UI.field('Reason', reason), refundRow, refundNote, msg);
    preview();
    UI.dialog({
      title: 'Credit note',
      body,
      buttons: [{ label: 'Cancel' }, {
        label: 'Issue credit note', primary: true,
        act: async () => {
          const minor = M.amountFromText(amount.value, inv.currency);
          if (!minor) { msg.textContent = 'Enter an amount above zero, with no more decimals than the currency has.'; return false; }
          if (minor > most) { msg.textContent = `Only ${money(most)} can still be credited.`; return false; }
          const r = await S.credits.issue({ invoiceId, amount: minor, date: date.value, reason: reason.value.trim() || undefined, method: method.value });
          if (!r.ok) { msg.textContent = U.refusal(r); return false; }
          UI.toast(`${r.value.number} issued${r.value.refund ? `: ${money(r.value.refund)} to pay back` : ''}`);
          if (onDone) onDone();
          return undefined;
        },
      }],
    });
    setTimeout(() => amount.select(), 30);
  }

  NS.creditDialog = { open };
})(typeof window !== 'undefined' ? window : globalThis);
