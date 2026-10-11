// The invoice on the page: the paper view in the invoice's template (the same layout as the PDF), with the fields edited in
// place. The state is the editor's (NS.editor.live()). A change is checked with the form's own rules (the messages the save
// gives) and then the editor repaints both the form and the page. Issued invoices show the page read only.
(function (g) {
  'use strict';
  const S = g.SlopData;
  const NS = (g.SlopInvoices = g.SlopInvoices || {});
  const U = NS.util;
  const M = g.SlopDocs.model;
  const L = g.SlopDocs.layouts;
  const DATE = /^\d{4}-\d{2}-\d{2}$/;
  const st = () => NS.editor.live();
  let controller = null;

  /** The document for the paper view, from the editor's state. */
  function doc() {
    const s = st();
    const customer = s.customers.find((c) => c.id === s.customerId) || {};
    const issued = s.status === 'issued' || s.status === 'paid';
    return {
      kind: 'invoice', title: 'Invoice', id: s.id, number: s.number,
      statusText: s.status === 'issued' && s.balance <= 0 ? 'Paid' : NS.preview.STATUS[s.status] || '',
      date: s.date, dueDate: s.dueDate, notes: s.notes, currency: s.currency, locale: s.locale, lines: s.lines,
      customer, customerId: s.customerId, company: s.company, totals: M.totals(s.lines),
      paid: s.paid, balance: issued ? s.balance : null, money: (m) => U.money(m, s.currency, s.locale),
      pdfSeed: s.pdfSeed, pdfLayout: s.pdfLayout,
    };
  }

  /** The form's own check for one field, as the save would give it (null when it is fine). */
  function fieldError(name, idx) {
    const s = st();
    if (name === 'customer') return s.customerId ? null : 'Choose a customer first, or add a new one.';
    if (name === 'date') return DATE.test(s.date) ? null : 'Enter the invoice date.';
    if (name === 'dueDate') return !s.dueDate || DATE.test(s.dueDate) ? null : 'Enter the due date as a date, or leave it blank.';
    if (!s.lines[idx]) return null;
    const e = M.lineErrors(s.lines[idx]);
    return e.length ? `Line ${idx + 1}: ${e.join('; ')}.` : null;
  }

  /** The company name is the shared settings' company name (the one the settings page edits). */
  async function saveCompany(name) {
    const s = st();
    s.company = { ...s.company, name: name.trim() };
    NS.editor.repaint();
    const cur = await S.store.get('settings', 'main');
    const base = cur.ok && cur.value ? cur.value : S.schema.DEFAULT_SETTINGS;
    const r = await S.store.put('settings', { ...base, companyName: s.company.name });
    if (!r.ok) NS.editor.note(U.refusal(r));
  }

  /** One change from the paper or the layout pick. Drafts only; the same state the form's inputs write. */
  function field(name, idx, value) {
    if (name === 'company') return saveCompany(value);
    const s = st();
    if (s.status !== 'draft') return;
    if (name === 'layout') s.pdfLayout = value;
    else if (name === 'seed') s.pdfSeed = L.newSeed();
    else if (name === 'customer') s.customerId = value;
    else if (name === 'date') s.date = value;
    else if (name === 'dueDate') s.dueDate = value;
    else if (name === 'notes') s.notes = value;
    else if (s.lines[idx]) s.lines[idx] = { ...s.lines[idx], [name]: g.SlopDocs.lines.parseField(name, value, s.currency) };
    else return;
    NS.editor.edited(name === 'layout' || name === 'seed' ? '' : fieldError(name, idx));
  }

  function mount() {
    controller = g.SlopDocs.page.mount({
      root: document.getElementById('view-edit'), host: document.getElementById('ePage'),
      modes: document.getElementById('eModes'), layout: document.getElementById('eLayout'),
      doc, canEdit: () => st().status === 'draft', customers: () => st().customers, field,
    });
  }

  NS.page = { mount, paint: () => controller && controller.paint() };
})(typeof window !== 'undefined' ? window : globalThis);
