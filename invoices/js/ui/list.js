// Invoices list: status filter (draft, issued, paid, void, overdue), search, overdue rows marked, the outstanding balance
// per customer, and a row menu; both lists are SlopList (shared/ui/list.js). "From an order" creates a draft from a
// confirmed or fulfilled order.
(function (g) {
  'use strict';
  const S = g.SlopData;
  const NS = (g.SlopInvoices = g.SlopInvoices || {});
  const U = NS.util;
  const M = g.SlopDocs.model;
  const UI = g.SlopUI;
  const h = U.h;
  const $ = (id) => document.getElementById(id);
  let list = null, owed = null, settings = null, openId = null;

  async function draw() {
    if (!$('view-list') || $('view-list').hidden) return;
    settings = await U.settings();
    const r = await NS.invoices.list({ status: $('iStatus').value, search: $('iSearch').value });
    if (!r.ok) { $('iSummary').textContent = U.refusal(r); return; }
    const all = await NS.invoices.list({});
    openId = NS.state.view === 'edit' ? NS.editor.id() : null;
    list.set(r.value);
    owed.set(all.ok ? NS.invoices.outstanding(all.value) : []);
  }

  /** One invoice as a SlopList row: number and customer, the total, its status (overdue first), due date, balance and links.
   *  The invoice open beside the list is the selected row. */
  function row(x) {
    const s = settings;
    return { title: `${x.number || 'draft'} · ${x.customerName}`, amount: U.money(x.total, x.currency || s.currency, s.locale),
      cls: x.overdue ? 'is-overdue' : '', selected: x.id === openId,
      meta: [{ chip: x.overdue ? 'Overdue' : U.STATUS[x.status], cls: x.overdue ? 'bad' : { paid: 'good', void: 'void' }[x.status] || '' },
        x.dueDate ? `Due ${x.dueDate}` : x.date, x.status === 'issued' ? `Balance ${U.money(x.balance, x.currency, s.locale)}` : null,
        x.orderId ? 'from order' : null, x.sample ? { chip: 'Sample', cls: 'warn' } : null] };
  }

  /** What one customer owes: the total due, the number of invoices, and the overdue part. */
  function owedRow(d) {
    const s = settings;
    return { title: d.customerName, amount: U.money(d.due, d.currency, s.locale),
      meta: [`${d.count} invoice${d.count === 1 ? '' : 's'}`, d.overdue ? { chip: `${U.money(d.overdue, d.currency, s.locale)} overdue`, cls: 'bad' } : null] };
  }

  async function run(promise, okText) {
    const r = await promise;
    if (!r.ok) { UI.alert('Not done', U.refusal(r)); return r; }
    if (okText) UI.toast(okText);
    draw();
    return r;
  }

  function menuFor(x) {
    const items = [{ label: 'Open invoice', act: () => NS.app.go(`i/${x.id}`) }, { label: 'Preview / print', act: () => NS.app.go(`p/${x.id}`) }];
    if (x.status === 'draft') {
      items.push({ label: 'Issue…', act: async () => { if (await UI.confirm('Issue invoice', 'Issue this invoice? It gets the next invoice number and is posted to the ledger. Issued invoices cannot be edited.', 'Issue')) run(NS.invoices.issue(x.id), 'Invoice issued'); } });
      items.push({ label: 'Delete draft…', act: async () => { if (await UI.confirm('Delete draft', 'Delete this draft? It has no number yet, so nothing else changes.', 'Delete', { danger: true })) run(NS.invoices.removeDraft(x.id), 'Draft deleted'); } });
    }
    items.push({ label: 'Export PDF', act: () => NS.preview.pdf(x.id) });
    if (x.status !== 'draft') items.push({ label: `Statement for ${x.customerName}`, act: () => NS.app.go(`s/${x.customerId}`) });
    if (x.status === 'issued') {
      items.push({ label: 'Record payment…', act: () => NS.paymentDialog.open(x.id, () => draw()) });
      if (!x.paid) items.push({ label: 'Void…', act: async () => { if (await UI.confirm('Void invoice', `Void ${x.number}? The journal entry is reversed. The number stays used.`, 'Void', { danger: true })) run(NS.invoices.voidInvoice(x.id), `${x.number} voided`); } });
    }
    return items;
  }

  /** Dialog: pick a confirmed or fulfilled order that has no invoice yet, then create the draft. */
  async function fromOrder() {
    const o = await S.store.list('orders');
    const c = await NS.invoices.customers();
    if (!o.ok || !c.ok) { UI.alert('Not available', U.refusal(o.ok ? c : o)); return; }
    const names = new Map(c.value.map((x) => [x.id, x.name]));
    const eligible = o.value.filter((x) => (x.status === 'open' || x.status === 'fulfilled') && !x.invoiceId)
      .sort((a, b) => String(b.number).localeCompare(String(a.number)));
    if (!eligible.length) { UI.alert('No order to invoice', 'Only a confirmed or fulfilled order without an invoice can be invoiced here. Confirm an order first.'); return; }
    const sel = h('select', { class: 'sui-input' }, eligible.map((x) => h('option', { value: x.id, text: `${x.number} · ${names.get(x.customerId) || '(no customer)'} · ${x.date}` })));
    UI.dialog({
      title: 'Invoice an order',
      body: UI.field('Order', sel),
      buttons: [{ label: 'Cancel' }, {
        label: 'Create draft', primary: true,
        act: async () => {
          const s = await U.settings();
          const ord = eligible.find((x) => x.id === sel.value);
          const r = await S.billing.invoiceFromOrder(sel.value, { dueDate: M.addDays(ord.date, s.paymentTermsDays) });
          if (!r.ok) { UI.alert('Not created', U.refusal(r)); return false; }
          UI.toast('Draft created from the order');
          NS.app.go(`i/${r.value.id}`);
          return undefined;
        },
      }],
    });
  }

  function mount() {
    $('iSearch').addEventListener('input', draw);
    $('iStatus').addEventListener('change', draw);
    $('iNew').addEventListener('click', () => NS.app.go('new'));
    $('iEmptyNew').addEventListener('click', () => NS.app.go('new'));
    $('iFromOrder').addEventListener('click', fromOrder);
    NS.sampleActions.mount();
    list = g.SlopList.mount($('iRows'), { label: 'Invoices', noun: ['invoice', 'invoices'], summary: $('iSummary'), empty: $('iEmpty'),
      row, open: (x) => NS.app.go(`i/${x.id}`), menu: menuFor });
    owed = g.SlopList.mount($('iOutstanding'), { key: 'key', label: 'Outstanding balances', noun: ['customer', 'customers'],
      empty: 'Nothing is owed. Every issued invoice is paid or void.', row: owedRow,
      open: (d) => NS.app.go(`s/${d.customerId}`), menu: (d) => [{ label: 'Customer statement', act: () => NS.app.go(`s/${d.customerId}`) }] });
  }

  NS.views = NS.views || {};
  NS.views.list = { mount, refresh: draw, onShow: draw };
  NS.listView = { draw, menuFor, fromOrder };
})(typeof window !== 'undefined' ? window : globalThis);
