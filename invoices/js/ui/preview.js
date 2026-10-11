// The printable invoice: a plain sheet built from the context (number, dates, customer, lines, tax by rate, total,
// paid and balance). It is shown on the Print view, which the browser prints with its own print dialog (print CSS in
// css/invoices.css hides the app chrome). The same context feeds the PDF.
(function (g) {
  'use strict';
  const NS = (g.SlopInvoices = g.SlopInvoices || {});
  const U = NS.util;
  const UI = g.SlopUI;
  const h = U.h;
  const $ = (id) => document.getElementById(id);
  const STATUS = { draft: 'Draft', issued: 'Issued', paid: 'Paid', void: 'Void' };

  /** The sheet as DOM for one context from NS.context.load. */
  function build(ctx) {
    const inv = ctx.invoice, c = ctx.customer || {}, co = ctx.company, m = ctx.money;
    const rows = inv.lines.map((l) => h('tr', null,
      h('td', { text: l.description }), h('td', { class: 'n', text: String(l.qty) }), h('td', { class: 'n', text: m(l.unitPrice) }),
      h('td', { class: 'n', text: l.discount ? `${(l.discount / 100).toFixed(2).replace(/\.?0+$/, '')}%` : '' }),
      h('td', { class: 'n', text: m(l.net) }), h('td', { class: 'n', text: m(l.tax) }), h('td', { class: 'n', text: m(l.total) })));
    const sums = [['Subtotal', m(ctx.totals.subtotal)],
      ...ctx.totals.byRate.map((r) => [`Tax ${(r.rate / 100).toFixed(2).replace(/\.?0+$/, '')}% on ${m(r.net)}`, m(r.tax)]),
      ['Total', m(ctx.totals.total)]];
    if (ctx.paid) sums.push(['Paid', m(ctx.paid)]);
    if (inv.status === 'issued' || inv.status === 'paid') sums.push(['Balance due', m(ctx.balance)]);
    return h('article', { class: 'sheet', 'aria-label': `Invoice ${inv.number || 'draft'}` },
      h('header', { class: 'sheet-head' },
        h('div', null, h('h1', { class: 'sheet-co', text: co.name || 'Your company' }),
          h('p', { class: 'sheet-addr', text: co.address }),
          co.taxNumber ? h('p', { class: 'sheet-addr', text: `Tax number: ${co.taxNumber}` }) : null),
        h('div', { class: 'sheet-meta' }, h('h2', { class: 'sheet-title', text: 'Invoice' }),
          h('p', null, h('b', { text: 'Number ' }), h('span', { class: 'mono', text: inv.number || 'draft' })),
          h('p', null, h('b', { text: 'Date ' }), inv.date), inv.dueDate ? h('p', null, h('b', { text: 'Due ' }), inv.dueDate) : null,
          h('p', null, h('span', { class: 'sheet-status', text: STATUS[inv.status] }))),
      ),
      h('section', { class: 'sheet-bill' }, h('h3', { text: 'Bill to' }),
        h('p', { class: 'strong', text: c.name || '(no customer)' }), c.email ? h('p', { text: c.email }) : null,
        c.phone ? h('p', { text: c.phone }) : null, c.address ? h('p', { class: 'sheet-addr', text: c.address }) : null),
      h('table', { class: 'sheet-table' },
        h('thead', null, h('tr', null, h('th', { text: 'Description' }), h('th', { class: 'n', text: 'Qty' }), h('th', { class: 'n', text: 'Unit price' }),
          h('th', { class: 'n', text: 'Disc.' }), h('th', { class: 'n', text: 'Net' }), h('th', { class: 'n', text: 'Tax' }), h('th', { class: 'n', text: 'Total' }))),
        h('tbody', null, rows)),
      h('dl', { class: 'sheet-sums' }, sums.map(([k, v]) => [h('dt', { text: k, class: k === 'Total' ? 'grand' : '' }), h('dd', { text: v, class: k === 'Total' ? 'grand' : '' })])),
      inv.notes ? h('p', { class: 'sheet-notes', text: inv.notes }) : null);
  }

  /** Loads the invoice and shows its sheet on the Print view. */
  async function show(id) {
    const r = await NS.context.load(id);
    const box = $('pSheet');
    if (!r.ok) { box.replaceChildren(h('p', { class: 'msg bad', text: U.refusal(r) })); return; }
    box.replaceChildren(build(r.value));
  }

  /** Makes the one-page PDF for an invoice and downloads it. A refusal (for example too many lines) says why. */
  async function pdf(id) {
    const c = await NS.context.load(id);
    if (!c.ok) { UI.alert('Not available', U.refusal(c)); return; }
    const r = await NS.pdf.invoicePdf(c.value);
    if (!r.ok) { UI.alert('PDF not made', `The PDF was not made: ${r.message}.`); return; }
    UI.download(new Blob([r.value], { type: 'application/pdf' }), `${c.value.invoice.number || 'draft'}.pdf`);
    UI.toast('PDF downloaded');
  }

  NS.preview = { build, show, pdf, STATUS };
})(typeof window !== 'undefined' ? window : globalThis);
