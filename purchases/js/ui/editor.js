// The purchase order editor: the shared document editor (shared/docs/doc-editor.js, its party a supplier) with what is the
// purchase order's own: the expected date, the link to the bill, and the actions its status allows (place the order,
// receive it into stock, record the supplier's bill as an expense, cancel).
(function (g) {
  'use strict';
  const NS = (g.SlopPurchases = g.SlopPurchases || {});
  const U = NS.util;
  const UI = g.SlopUI;
  const S = g.SlopData;
  const h = U.h;
  const $ = (id) => document.getElementById(id);
  const DATE = /^\d{4}-\d{2}-\d{2}$/;
  const METHODS = [['bank', 'Bank transfer'], ['card', 'Card'], ['cash', 'Cash'], ['other', 'Other']];
  let ed = null;

  const extra = {
    blank: (st) => Object.assign(st, { expectedDate: '', expenseId: null, receivedAt: '' }),
    apply: (st, rec) => Object.assign(st, { expectedDate: rec.expectedDate || '', expenseId: rec.expenseId || null, receivedAt: rec.receivedAt || '' }),
    fieldError: (name, st) => (name !== 'expectedDate' ? undefined : !st.expectedDate || DATE.test(st.expectedDate) ? null : 'Enter the expected date, or leave it empty.'),
    collect(st) {
      if (st.expectedDate && !DATE.test(st.expectedDate)) return { error: 'Enter the expected date, or leave it empty.' };
      if (st.expectedDate && st.expectedDate < st.date) return { error: 'The expected date is before the order date.' };
      return { expectedDate: st.expectedDate || '' };
    },
    paint(st, ro) {
      $('eExpected').value = st.expectedDate || '';
      $('eExpected').disabled = ro;
      const box = $('eLinks');
      box.replaceChildren();
      if (st.receivedAt) box.append(`Received ${st.receivedAt}. `);
      if (st.expenseId) box.append('Bill: ', h('a', { href: `../expenses/#e/${st.expenseId}`, text: 'recorded in Slop Expenses' }));
    },
    mount(st, edited) { $('eExpected').addEventListener('input', (e) => { st.expectedDate = e.target.value; edited(); }); },
  };

  function actions(st) {
    const b = (label, fn, cls = 'btn') => h('button', { type: 'button', class: cls, text: label, onclick: fn });
    const out = [];
    if (!ed.isNew()) out.push(b('Export PDF', ed.exportPdf));
    if (st.status === 'draft') out.push(b(ed.isNew() ? 'Save draft' : 'Save', () => ed.save()), b('Place order', place, 'btn primary'));
    if (st.status === 'ordered') out.push(b('Save changes', () => ed.save()), b('Receive…', receive, 'btn primary'));
    if ((st.status === 'ordered' || st.status === 'received') && !st.expenseId && !ed.isNew()) out.push(b('Record bill…', bill, st.status === 'received' ? 'btn primary' : 'btn'));
    if ((st.status === 'draft' || st.status === 'ordered') && !ed.isNew()) out.push(b('Cancel order…', cancel, 'btn danger'));
    if (st.status === 'received') out.push(h('p', { class: 'note', text: st.expenseId ? 'Received and billed. The order is closed.' : 'Received: its products are in stock. Record the bill when it comes.' }));
    if (st.status === 'cancelled') out.push(h('p', { class: 'note', text: 'Cancelled purchase orders cannot be changed.' }));
    return out;
  }

  /** Saves first, runs one step on the saved order, reloads it, and says what happened (or why not). */
  async function act(run, done) {
    if (!(await ed.saveIfNeeded())) return;
    const r = await run(ed.id());
    if (!r.ok) { UI.alert('Not done', U.refusal(r)); return; }
    await ed.reload();
    const text = done(ed.live().number);
    ed.setMsg(text);
    UI.toast(text);
  }

  const place = () => act((id) => NS.purchases.setStatus(id, 'ordered'), (n) => `${n} is ordered.`);

  async function receive() {
    const n = ed.live().lines.filter((l) => l.productId).length;
    const yes = await UI.confirm('Receive order', `Receive ${ed.live().number}? ${n ? `${n} product line${n === 1 ? '' : 's'} go${n === 1 ? 'es' : ''} into stock at the main location.` : 'No line is a product, so stock does not change.'}`, 'Receive');
    if (yes) await act((id) => NS.purchases.receive(id), (num) => `${num} is received. Stock is updated.`);
  }

  async function cancel() {
    const yes = await UI.confirm('Cancel order', `Cancel ${ed.live().number}? A cancelled purchase order cannot be changed.`, 'Cancel order', { danger: true });
    if (yes) await act((id) => NS.purchases.setStatus(id, 'cancelled'), (num) => `${num} is cancelled.`);
  }

  /** Dialog: the bill's date, expense category and how it was paid; records it as a posted expense. */
  async function bill() {
    if (!(await ed.saveIfNeeded())) return;
    const accts = await g.SlopBiz.expenseAccounts();
    const date = h('input', { type: 'date', value: S.ledger.today() });
    const account = UI.select(accts.map((a) => [a.code, `${a.code} ${a.name}`]), accts[0] && accts[0].code);
    const method = UI.select(METHODS, 'bank');
    const st = ed.live();
    UI.dialog({
      title: 'Record the bill',
      body: h('div', null, h('p', { class: 'note', text: `${st.number}: ${U.money(g.SlopDocs.model.totals(st.lines).total, st.currency, st.locale)}, tax included, is posted to the books as a paid expense, with its tax to reclaim.` }),
        UI.field('Date', date), UI.field('Category', account), UI.field('Paid by', method)),
      buttons: [{ label: 'Cancel' }, { label: 'Record bill', primary: true,
        act: async () => { await act((id) => NS.purchases.recordBill(id, { date: date.value, account: account.value, method: method.value }), (n) => `The bill for ${n} is recorded.`); } }],
    });
  }

  ed = g.SlopDocs.docEditor.create({
    ns: NS, noun: 'purchase order', title: 'New purchase order', route: 'po', party: 'supplier',
    data: { get: (id) => NS.purchases.get(id), save: (f) => NS.purchases.save(f), customers: () => NS.purchases.suppliers(), products: () => NS.purchases.products() },
    statusLabel: U.STATUS, locked: (st) => st.status === 'received' || st.status === 'cancelled',
    dateError: 'Enter the order date.', extra, actions,
  });

  NS.editor = Object.assign(ed, {
    place, receive, bill, cancel,
    state: () => { const st = ed.live(); return { open: !!st.id || st.lines.length > 0, status: st.status, billed: !!st.expenseId, dirty: st.dirty, isNew: ed.isNew() }; },
  });
  NS.views = NS.views || {};
  NS.views.edit = { mount: ed.mount, refresh: () => {}, onShow: (id, t) => (t && t.reorder ? NS.reorder.open(t.reorder) : ed.open(id || null)) };
})(typeof window !== 'undefined' ? window : globalThis);
