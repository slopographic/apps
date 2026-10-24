// The quote editor: the shared document editor (shared/docs/doc-editor.js) with what is the quote's own: the valid-until
// date, the links to the order or invoice made from it, and the actions its status allows (send, revise, accept, decline,
// reopen, make an order, make an invoice).
(function (g) {
  'use strict';
  const NS = (g.SlopQuotes = g.SlopQuotes || {});
  const U = NS.util;
  const UI = g.SlopUI;
  const S = g.SlopData;
  const M = g.SlopDocs.model;
  const h = U.h;
  const $ = (id) => document.getElementById(id);
  const DATE = /^\d{4}-\d{2}-\d{2}$/;
  let ed = null;

  /** The number of a linked document, or 'draft'; '' when it no longer exists. */
  async function numberOf(collection, id) {
    if (!id) return '';
    const r = await S.store.get(collection, id);
    return r.ok && r.value ? (r.value.number || 'draft') : '';
  }

  const extra = {
    blank: (st) => Object.assign(st, { validUntil: M.addDays(st.date, 30), orderId: null, invoiceId: null, orderNumber: '', invoiceNumber: '' }),
    async apply(st, rec) {
      Object.assign(st, { validUntil: rec.validUntil || '', orderId: rec.orderId || null, invoiceId: rec.invoiceId || null });
      st.orderNumber = await numberOf('orders', st.orderId);
      st.invoiceNumber = await numberOf('invoices', st.invoiceId);
    },
    collect(st) {
      if (st.validUntil && !DATE.test(st.validUntil)) return { error: 'Enter the valid-until date, or leave it empty.' };
      if (st.validUntil && st.validUntil < st.date) return { error: 'Valid until is before the quote date.' };
      return { validUntil: st.validUntil || '' };
    },
    paint(st, ro) {
      $('eValid').value = st.validUntil || '';
      $('eValid').disabled = ro;
      const box = $('eLinks');
      box.replaceChildren();
      if (st.orderId) box.append('Order: ', h('a', { href: `../orders/#o/${st.orderId}`, text: st.orderNumber || 'draft' }));
      if (st.invoiceId) box.append('Invoice: ', h('a', { href: `../invoices/#i/${st.invoiceId}`, text: st.invoiceNumber || 'draft' }));
    },
    mount(st, edited) { $('eValid').addEventListener('input', (e) => { st.validUntil = e.target.value; edited(); }); },
  };

  function actions(st) {
    const b = (label, fn, cls = 'btn') => h('button', { type: 'button', class: cls, text: label, onclick: fn });
    const open = st.status === 'draft' || st.status === 'sent';
    const free = !st.orderId && !st.invoiceId;
    const out = [];
    if (!ed.isNew()) out.push(b('Export PDF', ed.exportPdf));
    if (st.status === 'draft') out.push(b(ed.isNew() ? 'Save draft' : 'Save', () => ed.save()), b('Mark as sent', send, 'btn primary'));
    if (st.status === 'sent') out.push(b('Save changes', () => ed.save()));
    if ((open || st.status === 'accepted') && free && !ed.isNew()) {
      out.push(b('Make order', toOrder, st.status === 'draft' ? 'btn' : 'btn primary'), b('Make invoice', toInvoice));
    }
    if (st.status === 'sent') out.push(b('Mark accepted', () => status('accepted', (n) => `${n} is accepted.`)), b('Back to draft', () => status('draft', (n) => `${n} is a draft again.`)));
    if (open && !ed.isNew()) out.push(b('Decline…', decline, 'btn danger'));
    if (st.status === 'declined') out.push(b('Reopen', () => status('draft', (n) => `${n} is open again as a draft.`)), h('p', { class: 'note', text: 'Declined. Reopen it to change it or send it again.' }));
    if (st.status === 'accepted') out.push(h('p', { class: 'note', text: free ? 'Accepted. Make an order or an invoice from it.' : 'Accepted and converted. The quote keeps a link to what was made from it.' }));
    if (open && st.validUntil && S.quotes.isExpired(st, S.ledger.today())) out.unshift(h('p', { class: 'note bad-text', text: `This quote expired on ${st.validUntil}. Change the valid-until date to offer it again.` }));
    return out;
  }

  /** Runs one action on the saved quote, reloads it, and says what happened (or why not). */
  async function act(run, done) {
    if (!(await ed.saveIfNeeded())) return false;
    const r = await run(ed.id());
    if (!r.ok) { UI.alert('Not done', U.refusal(r)); return false; }
    await ed.reload();
    const text = done(ed.live().number, r.value);
    ed.setMsg(text);
    UI.toast(text);
    return true;
  }

  const status = (to, done) => act((id) => NS.quotes.setStatus(id, to), done);
  const send = () => status('sent', (n) => `${n} is marked as sent.`);
  const toOrder = () => act(NS.quotes.toOrder, (n, o) => `${n} is accepted. Order ${o.number} is made.`);
  const toInvoice = () => act(NS.quotes.toInvoice, (n) => `${n} is accepted. A draft invoice is made.`);

  async function decline() {
    const yes = await UI.confirm('Decline quote', `Mark ${ed.live().number} as declined? You can reopen it later.`, 'Decline', { danger: true });
    if (yes) await status('declined', (n) => `${n} is declined.`);
  }

  ed = g.SlopDocs.docEditor.create({
    ns: NS, noun: 'quote', title: 'New quote', route: 'q',
    data: { get: (id) => NS.quotes.get(id), save: (f) => NS.quotes.save(f), customers: () => NS.quotes.customers(), products: () => NS.quotes.products() },
    statusLabel: U.STATUS, locked: (st) => st.status === 'accepted' || st.status === 'declined',
    dateError: 'Enter the quote date.', extra, actions,
  });

  NS.editor = Object.assign(ed, {
    send, toOrder, toInvoice, decline,
    state: () => { const st = ed.live(); return { open: !!st.id || st.lines.length > 0, status: st.status, converted: !!(st.orderId || st.invoiceId), dirty: st.dirty, isNew: ed.isNew() }; },
  });
  NS.views = NS.views || {};
  NS.views.edit = { mount: ed.mount, refresh: () => {}, onShow: (id) => ed.open(id || null) };
})(typeof window !== 'undefined' ? window : globalThis);
