// The Credit note view (#c/<credit note id>): one credit note as a printable sheet: the company and customer blocks, the
// invoice it credits, the reason, the subtotal, tax and amount credited, and what was paid back and how. Print it, or open
// the invoice. The record bar (shared/biz/docbar.js) names it by its number.
(function (g) {
  'use strict';
  const S = g.SlopData;
  const NS = (g.SlopInvoices = g.SlopInvoices || {});
  const U = NS.util;
  const h = U.h;
  const $ = (id) => document.getElementById(id);
  const METHOD = { bank: 'bank transfer', cash: 'cash', card: 'card', other: 'other means' };

  /** Draws the credit note, or says that it is gone. */
  async function show(id) {
    const cn = await S.store.get('creditNotes', id);
    if (!cn.ok || !cn.value) { $('cnSheet').replaceChildren(h('p', { class: 'msg bad', text: 'That credit note does not exist.' })); return; }
    const c = cn.value;
    const [inv, cust, s] = await Promise.all([S.store.get('invoices', c.invoiceId), S.store.get('customers', c.customerId), U.settings()]);
    const invoice = inv.ok && inv.value ? inv.value : null, customer = cust.ok && cust.value ? cust.value : { name: '' };
    const m = (v) => U.money(v, c.currency, s.locale);
    const lines = g.SlopBiz.sheet.lines;
    const row = (label, value, cls) => h('tr', { class: cls }, h('td', { text: label }), h('td', { class: 'num', text: value }));
    $('cnSheet').replaceChildren(h('article', { class: 'doc-sheet credit-note' },
      g.SlopBiz.sheet.head(s, 'Credit note', [`No. ${c.number}`, `Date ${c.date}`, invoice ? `For invoice ${invoice.number}` : null]),
      h('div', { class: 'sheet-to' }, h('span', { class: 'sub', text: 'To' }), h('b', { text: customer.name }), ...[customer.email, ...lines(customer.address)].filter(Boolean).map((x) => h('div', { text: x }))),
      h('p', { class: 'note', text: c.reason ? `Reason: ${c.reason}` : `Credit against invoice ${invoice ? invoice.number : ''}.` }),
      h('div', { class: 'sheet-scroll' }, h('table', { class: 'grid-t' },
        h('tbody', null, row('Subtotal', m(c.subtotal || 0)), row('Tax', m(c.tax || 0))),
        h('tfoot', null, h('tr', null, h('th', { text: 'Amount credited' }), h('th', { class: 'num', text: m(c.amount) }))))),
      c.refund ? h('p', { class: 'sheet-total' }, h('span', { text: `Paid back to you by ${METHOD[c.method] || 'bank transfer'}` }), h('b', { text: m(c.refund) }))
        : h('p', { class: 'note', text: `${m(c.amount)} is taken off what is owed on invoice ${invoice ? invoice.number : ''}.` })));
    $('cnInvoice').href = `#i/${c.invoiceId}`;
    g.SlopBiz.docbar.title(`Credit note ${c.number}`);
  }

  function mount() { $('cnPrint').addEventListener('click', () => g.print()); }

  NS.views = NS.views || {};
  NS.views.credit = { mount, onShow: show };
  NS.creditNote = { show };
})(typeof window !== 'undefined' ? window : globalThis);
