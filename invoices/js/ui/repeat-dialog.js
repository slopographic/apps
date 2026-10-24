// "Repeat…": makes a repeating schedule from a saved invoice (SlopData.recurring.fromInvoice): every N weeks or months,
// from a first date (default: one period after the invoice), with an optional end date and the payment terms for due dates.
(function (g) {
  'use strict';
  const S = g.SlopData;
  const NS = (g.SlopInvoices = g.SlopInvoices || {});
  const U = NS.util;
  const UI = g.SlopUI;
  const h = U.h;

  /** Opens the dialog for an invoice id. onDone(schedule) runs after the schedule is stored. */
  async function open(invoiceId, onDone) {
    const got = await S.store.get('invoices', invoiceId);
    if (!got.ok || !got.value) { UI.alert('Not available', got.ok ? 'That invoice no longer exists.' : U.refusal(got)); return; }
    const inv = got.value, s = await U.settings();
    const every = h('input', { type: 'number', min: 1, max: 36, value: 1, inputmode: 'numeric' });
    const unit = UI.select([['month', 'months'], ['week', 'weeks']], 'month');
    const start = h('input', { type: 'date', value: S.recurring.step(inv.date, 1, 'month') });
    const end = h('input', { type: 'date' });
    const msg = h('p', { class: 'msg bad', role: 'status' });
    unit.addEventListener('change', () => { start.value = S.recurring.step(inv.date, Number(every.value) || 1, unit.value); });
    const body = h('div', null,
      h('p', { class: 'note', text: `Copies the customer, lines and notes of ${inv.number || 'this draft'} onto a new draft invoice each time. Drafts are made when you open Slop Invoices on or after their date; you check and issue them.` }),
      h('div', { class: 'inline' }, UI.field('Every', every), UI.field('Period', unit)),
      UI.field('First new invoice on', start), UI.field('Last one on or before (optional)', end), msg);
    UI.dialog({
      title: 'Repeat this invoice',
      body,
      buttons: [{ label: 'Cancel' }, {
        label: 'Repeat', primary: true,
        act: async () => {
          const n = Number(every.value);
          if (!Number.isInteger(n) || n < 1 || n > 36) { msg.textContent = 'Every is a whole number from 1 to 36.'; return false; }
          if (!start.value) { msg.textContent = 'Choose the date of the first new invoice.'; return false; }
          const r = await S.recurring.fromInvoice(invoiceId, { every: n, unit: unit.value, start: start.value, endDate: end.value || undefined, dueDays: s.paymentTermsDays });
          if (!r.ok) { msg.textContent = U.refusal(r); return false; }
          UI.toast(`Repeats ${S.recurring.describe(r.value)} from ${r.value.nextDate}`);
          if (onDone) onDone(r.value);
          return undefined;
        },
      }],
    });
  }

  NS.repeatDialog = { open };
})(typeof window !== 'undefined' ? window : globalThis);
