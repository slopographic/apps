// The invoice editor: the shared document editor (shared/docs/doc-editor.js) with what is the invoice's own: the due date,
// payments and balance, the top bar's number and status, the link to its order, and the actions its status allows. A draft
// is editable and can be issued or deleted; an issued invoice is read only, and payments and void go through billing.
(function (g) {
  'use strict';
  const S = g.SlopData;
  const NS = (g.SlopInvoices = g.SlopInvoices || {});
  const U = NS.util;
  const M = g.SlopDocs.model;
  const UI = g.SlopUI;
  const h = U.h;
  const $ = (id) => document.getElementById(id);
  const DATE = /^\d{4}-\d{2}-\d{2}$/;
  let ed = null;

  /** The status words: an issued invoice with nothing left to pay reads Paid. */
  const statusText = (st) => U.statusText(st.status, st.balance);

  const extra = {
    blank: (st, s) => Object.assign(st, { dueDate: M.addDays(st.date, s.paymentTermsDays), orderId: null, payments: [], paid: 0, balance: 0 }),
    /** The due date and order link from the record; the payments and balance from billing (NS.context). */
    async apply(st, rec) {
      Object.assign(st, { dueDate: rec.dueDate || '', orderId: rec.orderId || null, payments: [], paid: 0, balance: 0 });
      const c = await NS.context.load(rec.id);
      if (c.ok) Object.assign(st, { payments: c.value.payments, paid: c.value.paid, balance: c.value.balance });
    },
    fieldError: (name, st) => (name !== 'dueDate' ? undefined : !st.dueDate || DATE.test(st.dueDate) ? null : 'Enter the due date as a date, or leave it blank.'),
    collect: (st) => (st.dueDate && !DATE.test(st.dueDate) ? { error: 'Enter the due date as a date, or leave it blank.' } : { dueDate: st.dueDate || undefined }),
    paint(st, ro) {
      const label = statusText(st);
      $('tbNum').textContent = st.id ? st.number || 'No number yet' : 'New invoice';
      $('tbStatus').textContent = label;
      $('tbStatus').className = `chip ${st.status}`;
      document.querySelector('.app').dataset.docStatus = st.status;
      $('eDue').value = st.dueDate;
      $('eDue').disabled = ro;
      $('eBalance').textContent = st.status === 'issued' ? `Balance due ${U.money(st.balance, st.currency, st.locale)}` : '';
      $('eOrder').replaceChildren(...(st.orderId ? ['From order: ', h('a', { href: `../orders/#o/${st.orderId}`, text: 'open the order' })] : []));
      const box = $('ePayments');
      if (!st.payments.length) box.replaceChildren(h('p', { class: 'note', text: st.status === 'issued' ? 'No payments yet.' : '' }));
      else box.replaceChildren(h('ul', { class: 'report' }, st.payments.map((p) => h('li', { text: `${p.date} · ${p.method} · ${U.money(p.amount, st.currency, st.locale)}${p.note ? ` · ${p.note}` : ''}` }))));
    },
    mount(st, edited) { $('eDue').addEventListener('input', (e) => { st.dueDate = e.target.value; edited(); }); },
  };

  function actions(st) {
    const b = (label, fn, cls = 'btn', disabled = false, title) => h('button', { type: 'button', class: cls, text: label, onclick: fn, disabled, title });
    const out = [];
    if (ed.isNew()) out.push(b('Random sample', () => NS.sampleActions.quick()));
    if (st.status === 'draft') {
      out.push(b(ed.isNew() ? 'Save draft' : 'Save', () => ed.save()), b('Issue…', issue, 'btn primary'));
      if (!ed.isNew()) out.push(b('Delete draft…', removeDraft, 'btn danger'));
    }
    if (st.status === 'issued') {
      out.push(b('Record payment…', () => NS.paymentDialog.open(st.id, ed.reload), 'btn primary'));
      out.push(b('Void…', voidInvoice, 'btn danger', st.payments.length > 0, st.payments.length ? 'Not allowed while payments exist' : 'Reverse the issue entry and void'));
    }
    if (!ed.isNew() && st.status !== 'void') out.push(b('Repeat…', () => NS.repeatDialog.open(st.id, () => NS.app.go('repeat'))));
    if (!ed.isNew()) out.push(b('Preview / print', preview), b('Export PDF', () => saveThen(() => NS.preview.pdf(st.id))));
    if (st.status === 'paid' || st.status === 'void') out.push(h('p', { class: 'note', text: st.status === 'paid' ? 'Paid in full. The invoice is closed.' : 'Void. The number stays used.' }));
    return out;
  }

  /** Runs fn after saving when there are changes or the invoice is new (a save in flight is waited for first). */
  async function saveThen(fn) { return (await ed.saveIfNeeded()) ? fn() : undefined; }

  /** Asks, runs one billing step on the saved invoice, reloads it, and says what happened (or why not). */
  async function step(question, run, failTitle, done) {
    if (question && !(await UI.confirm(...question))) return;
    await saveThen(async () => {
      const r = await run(ed.id());
      if (!r.ok) { UI.alert(failTitle, U.refusal(r)); return; }
      await ed.reload();
      UI.toast(done(ed.live().number));
    });
  }

  const issue = () => step(['Issue invoice', 'Issue this invoice? It gets the next invoice number and is posted to the ledger. Issued invoices cannot be edited.', 'Issue'],
    NS.invoices.issue, 'Not issued', (n) => `${n} issued`);
  const voidInvoice = () => step(['Void invoice', `Void ${ed.live().number}? The journal entry is reversed. The number stays used.`, 'Void', { danger: true }],
    NS.invoices.voidInvoice, 'Not voided', (n) => `${n} voided`);

  async function removeDraft() {
    if (!(await UI.confirm('Delete draft', 'Delete this draft? It has no number yet, so nothing else changes.', 'Delete', { danger: true }))) return;
    const r = await NS.invoices.removeDraft(ed.id());
    if (!r.ok) { UI.alert('Not deleted', U.refusal(r)); return; }
    ed.clean();
    NS.app.go('list');
  }

  const preview = () => saveThen(() => NS.app.go(`p/${ed.id()}`));

  /** The stored invoice alone (NS.invoices.get also gives its payments and customer); null when it is gone. */
  async function invoiceOnly(id) {
    const r = await NS.invoices.get(id);
    return r.ok ? S.result.ok(r.value ? r.value.invoice : null) : r;
  }

  ed = g.SlopDocs.docEditor.create({
    ns: NS, noun: 'invoice', title: 'New invoice', route: 'i',
    data: { get: invoiceOnly, save: (f) => NS.invoices.saveDraft(f), customers: () => NS.invoices.customers(), products: () => NS.invoices.products() },
    statusLabel: U.STATUS, statusText, locked: (st) => st.status !== 'draft',
    heading: (st) => (st.id ? st.number || 'Draft invoice' : 'New invoice'), savedText: () => 'Draft saved.',
    dateError: 'Enter the invoice date.', extra, actions,
  });

  NS.editor = Object.assign(ed, {
    issue, voidInvoice, removeDraft, preview,
    state: () => { const st = ed.live(); return { open: !!st.id || st.lines.length > 0, status: st.status, payments: st.payments.length, dirty: st.dirty, isNew: ed.isNew() }; },
  });
  NS.views = NS.views || {};
  NS.views.edit = { mount: ed.mount, refresh: () => {}, onShow: (id) => ed.open(id || null) };
})(typeof window !== 'undefined' ? window : globalThis);
