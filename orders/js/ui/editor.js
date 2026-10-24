// The order editor: the shared document editor (shared/docs/doc-editor.js) with what is the order's own: its statuses,
// the link to its invoice, and the actions (confirm, fulfil, cancel, convert to invoice) that the current status allows.
(function (g) {
  'use strict';
  const NS = (g.SlopOrders = g.SlopOrders || {});
  const U = NS.util;
  const UI = g.SlopUI;
  const S = g.SlopData;
  const h = U.h;
  const $ = (id) => document.getElementById(id);
  let ed = null;

  const extra = {
    blank: (st) => Object.assign(st, { invoiceId: null, invoiceNumber: '' }),
    async apply(st, rec) {
      st.invoiceId = rec.invoiceId || null;
      st.invoiceNumber = '';
      if (st.invoiceId) {
        const inv = await S.store.get('invoices', st.invoiceId);
        st.invoiceNumber = inv.ok && inv.value ? (inv.value.number || 'draft') : '';
      }
    },
    paint(st) {
      const box = $('eInvoice');
      box.replaceChildren();
      if (st.invoiceId) box.append('Invoice: ', h('a', { href: `../invoices/#i/${st.invoiceId}`, text: st.invoiceNumber || 'draft' }));
    },
  };

  function actions(st) {
    const b = (label, fn, cls = 'btn') => h('button', { type: 'button', class: cls, text: label, onclick: fn });
    const out = [];
    if (ed.isNew()) out.push(b('Random sample', () => NS.sampleActions.quick()));
    if (!ed.isNew()) out.push(b('Export PDF', ed.exportPdf));
    if (st.status === 'draft') {
      out.push(b(ed.isNew() ? 'Save draft' : 'Save', () => ed.save()), b('Confirm order', confirm, 'btn primary'));
      if (!ed.isNew()) out.push(b('Cancel order', cancel, 'btn danger'));
    }
    if (st.status === 'open') out.push(b('Save changes', () => ed.save()), b('Fulfil…', fulfil, 'btn primary'), b('Cancel order', cancel, 'btn danger'));
    if ((st.status === 'open' || st.status === 'fulfilled') && !st.invoiceId) out.push(b('Convert to invoice', convert));
    if ((st.status === 'open' || st.status === 'fulfilled') && !ed.isNew()) out.push(b('Delivery note', () => ed.saveIfNeeded().then((ok) => ok && NS.app.go(`d/${ed.id()}`))));
    if (st.status === 'fulfilled') out.push(h('p', { class: 'note', text: 'Fulfilled: stock has been taken out and the order is closed.' }));
    if (st.status === 'cancelled') out.push(h('p', { class: 'note', text: 'Cancelled orders cannot be changed.' }));
    return out;
  }

  /** Runs one action on the saved order, reloads it, and says what happened (or why not, in a dialog when alertTitle). */
  async function act(run, done, alertTitle) {
    const r = await run(ed.id());
    if (!r.ok) { if (alertTitle) UI.alert(alertTitle, U.refusal(r)); else ed.setMsg(U.refusal(r), true); return; }
    await ed.reload();
    const st = ed.live();
    ed.setMsg(done(st.number));
    UI.toast(done(st.number));
  }

  async function confirm() {
    if (await ed.saveIfNeeded()) await act(NS.actions.confirmId, (n) => `${n} is confirmed.`);
  }

  async function fulfil() {
    const yes = await UI.confirm('Fulfil order', `Fulfil ${ed.live().number}? Stock on its product lines is taken out of the main location.`, 'Fulfil');
    if (yes && (await ed.saveIfNeeded())) await act(NS.fulfil.fulfil, (n) => `${n} is fulfilled. Stock is updated.`, 'Not fulfilled');
  }

  async function cancel() {
    if (ed.isNew()) return ed.back(true);
    const yes = await UI.confirm('Cancel order', `Cancel ${ed.live().number}? A cancelled order cannot be changed.`, 'Cancel order', { danger: true });
    if (yes) await act(NS.actions.cancelId, (n) => `${n} is cancelled.`, 'Not cancelled');
    return undefined;
  }

  async function convert() {
    if (await ed.saveIfNeeded()) await act(NS.actions.convertId, () => 'Invoice draft created. The order keeps a link to it.', 'Not converted');
  }

  ed = g.SlopDocs.docEditor.create({
    ns: NS, noun: 'order', title: 'New order', route: 'o',
    data: { get: (id) => NS.orders.get(id), save: (f) => NS.orders.save(f), customers: () => NS.orders.customers(), products: () => NS.orders.products() },
    statusLabel: g.SlopDocs.model.STATUS_LABEL, locked: (st) => st.status === 'fulfilled' || st.status === 'cancelled',
    dateError: 'Enter the order date.', extra, actions,
  });

  NS.editor = Object.assign(ed, {
    confirm, fulfil, cancel, convert,
    state: () => { const st = ed.live(); return { open: !!st.id || st.lines.length > 0, status: st.status, invoiceId: st.invoiceId, dirty: st.dirty, isNew: ed.isNew() }; },
  });
  NS.views = NS.views || {};
  NS.views.edit = { mount: ed.mount, refresh: () => {}, onShow: (id) => ed.open(id || null) };
})(typeof window !== 'undefined' ? window : globalThis);
