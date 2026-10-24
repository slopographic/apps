// Slop Expenses: Mark as paid… for a bill that is owed (SlopData.expenses.pay): the date it was paid and how. Used by the
// list's row menu and by the expense's own page. Exposes SlopExpenses.payDialog.open(expense, onDone).
(function (g) {
  'use strict';
  const S = g.SlopData, B = g.SlopBiz, UI = g.SlopUI, el = UI.el;
  const NS = (g.SlopExpenses = g.SlopExpenses || {});

  async function open(e, onDone) {
    const s = await B.settings();
    const date = el('input', { type: 'date', value: S.ledger.today(), min: e.date });
    const method = UI.select([['bank', 'Bank transfer'], ['card', 'Card'], ['cash', 'Cash'], ['other', 'Other']], 'bank');
    const msg = el('p', { class: 'msg bad', role: 'status' });
    UI.dialog({
      title: 'Mark as paid',
      body: el('div', null, el('p', { class: 'note' }, `${e.supplier} · ${B.money(e.amount, e.currency || s.currency, s.locale)}${e.dueDate ? ` · due ${e.dueDate}` : ''}`),
        UI.field('Paid on', date), UI.field('Paid by', method), msg),
      buttons: [{ label: 'Cancel' }, { label: 'Mark as paid', primary: true, act: async () => {
        const r = await S.expenses.pay(e.id, { date: date.value, method: method.value });
        if (!r.ok) { msg.textContent = B.refusal(r); return false; }
        UI.toast(`Bill from ${e.supplier} paid`);
        if (onDone) onDone(r.value);
        return undefined;
      } }],
    });
  }

  NS.payDialog = { open };
})(typeof window !== 'undefined' ? window : globalThis);
