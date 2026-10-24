// The one view of a document that the paper view, the print view and the PDF all draw: the company block, the number and
// dates, the bill-to, the lines (text as shown, with the raw value each editable cell edits), the totals and the notes.
// Money is formatted here through the app's money function; the renderers only lay it out. Pure: no DOM, no storage.
// Classic script, loaded after shared/data and shared/docs/model.js and pdf-layouts.js. Exposes window.SlopDocs.view.
(function (g) {
  'use strict';
  const S = g.SlopData;
  const NS = (g.SlopDocs = g.SlopDocs || {});
  const M = NS.model;

  const lines = (text) => String(text || '').split('\n').map((t) => t.trim()).filter(Boolean);

  /** The view of one document. doc: { kind ('invoice' | 'order'), title, id, number, statusText, date, dueDate, notes,
   *  currency, locale, lines, customer { name, email, phone, address }, company { name, address, taxNumber },
   *  totals (SlopDocs.model totals, or null when a line is not complete), paid, balance (null hides the row), money(minor),
   *  pdfSeed, pdfLayout, moreMeta [{ label, value, field }] (more dated fields under the date, such as a quote's Valid until) }. */
  function build(doc) {
    const money = doc.money || ((m) => S.money.formatMinor(m, doc.currency || 'USD', doc.locale || 'en-US'));
    const c = doc.customer || {};
    const co = doc.company || {};
    const rowOf = (l, index) => {
      const bad = M.lineErrors(l).length > 0;
      const a = bad ? null : S.money.lineAmounts(M.cleanLine(l));
      return {
        index, bad,
        description: l.description || '',
        qty: l.qty == null ? '' : String(l.qty),
        unit: Number.isSafeInteger(l.unitPrice) ? money(l.unitPrice) : '',
        disc: l.discount ? `${M.percentText(l.discount)}%` : '',
        tax: a ? money(a.tax) : '',
        total: a ? money(a.total) : '',
        raw: {
          description: l.description || '', qty: l.qty == null ? '' : String(l.qty),
          unitPrice: Number.isSafeInteger(l.unitPrice) ? M.amountText(l.unitPrice, doc.currency || 'USD') : '',
          taxRate: M.percentText(l.taxRate ?? 0), discount: M.percentText(l.discount || 0),
        },
      };
    };
    const totals = [];
    if (doc.totals) {
      const t = doc.totals;
      totals.push({ label: 'Subtotal (before tax)', value: money(t.subtotal) });
      for (const r of t.byRate) totals.push({ label: `Tax ${M.percentText(r.rate) || '0'}% on ${money(r.net)}`, value: money(r.tax) });
      totals.push({ label: 'Total', value: money(t.total), strong: true });
    }
    if (doc.paid) totals.push({ label: 'Paid', value: money(doc.paid) });
    if (doc.balance !== null && doc.balance !== undefined) totals.push({ label: 'Balance due', value: money(doc.balance), strong: true });
    const meta = [{ label: 'Date', value: doc.date || '', field: 'date' }];
    if (doc.kind === 'invoice') meta.push({ label: 'Due', value: doc.dueDate || '', field: 'dueDate' });
    for (const m of doc.moreMeta || []) meta.push({ label: m.label, value: m.value || '', field: m.field });
    const ls = doc.lines || [];
    return {
      kind: doc.kind, title: doc.title || ({ order: 'Order', quote: 'Quote' }[doc.kind] || 'Invoice'),
      number: doc.number || 'draft', statusText: doc.statusText || '',
      style: NS.layouts.resolve({ id: doc.id, pdfSeed: doc.pdfSeed, pdfLayout: doc.pdfLayout }),
      company: { name: co.name || 'Your company', lines: lines(co.address), taxNumber: co.taxNumber || '', field: 'company' },
      meta,
      bill: { title: 'Bill to', name: c.name || '', lines: [c.email, c.phone, ...lines(c.address)].filter(Boolean), field: 'customer', customerId: doc.customerId ?? c.id ?? '' },
      hasDiscount: ls.some((l) => l.discount),
      rows: ls.map(rowOf),
      totals,
      totalsNote: doc.totals ? '' : 'Totals appear when every line is complete.',
      notes: { text: doc.notes || '', field: 'notes' },
      editable: doc.editable !== false,
    };
  }

  NS.view = { build };
})(typeof window !== 'undefined' ? window : globalThis);
