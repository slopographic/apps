// Invoices list: status filter (draft, issued, paid, void, overdue), search, overdue rows highlighted, the outstanding
// balance per customer, and a row menu. "From an order" creates a draft from a confirmed or fulfilled order.
(function (g) {
  'use strict';
  const S = g.SlopData;
  const NS = (g.SlopInvoices = g.SlopInvoices || {});
  const U = NS.util;
  const M = g.SlopDocs.model;
  const UI = g.SlopUI;
  const h = U.h;
  const $ = (id) => document.getElementById(id);
  let rowsById = new Map();

  async function draw() {
    if (!$('view-list') || $('view-list').hidden) return;
    const s = await U.settings();
    const r = await NS.invoices.list({ status: $('iStatus').value, search: $('iSearch').value });
    if (!r.ok) { $('iSummary').textContent = U.refusal(r); return; }
    const all = await NS.invoices.list({});
    rowsById = new Map(r.value.map((x) => [x.id, x]));
    $('iRows').replaceChildren(...r.value.map((x) => row(x, s)));
    $('iEmpty').hidden = r.value.length > 0;
    $('iSummary').textContent = `${r.value.length} invoice${r.value.length === 1 ? '' : 's'}`;
    const due = all.ok ? NS.invoices.outstanding(all.value) : [];
    $('iOutstanding').replaceChildren(...(due.length ? due.map((d) => outRow(d, s)) : [h('p', { class: 'empty', text: 'Nothing is owed. Every issued invoice is paid or void.' })]));
  }

  function row(x, s) {
    const cls = x.overdue ? 'orow overdue' : 'orow';
    const label = x.overdue ? 'Overdue' : NS.preview.STATUS[x.status];
    return h('div', { class: cls, role: 'row', tabindex: 0, dataset: { id: x.id } },
      h('span', { class: 'who', text: `${x.number || 'draft'} · ${x.customerName}` }),
      h('span', { class: 'amt num', text: U.money(x.total, x.currency || s.currency, s.locale) }),
      h('div', { class: 'meta' },
        h('span', { class: `chip ${x.overdue ? 'overdue' : x.status}`, text: label }),
        h('span', { text: x.dueDate ? `Due ${x.dueDate}` : x.date }),
        x.status === 'issued' ? h('span', { text: `Balance ${U.money(x.balance, x.currency, s.locale)}` }) : null,
        x.orderId ? h('span', { text: 'from order' }) : null,
        x.sample ? h('span', { class: 'chip sample', text: 'Sample' }) : null));
  }

  function outRow(d, s) {
    return h('div', { class: 'orow', role: 'row' },
      h('span', { class: 'who', text: d.customerName }),
      h('span', { class: 'amt num', text: U.money(d.due, d.currency, s.locale) }),
      h('div', { class: 'meta' }, h('span', { text: `${d.count} invoice${d.count === 1 ? '' : 's'}` }),
        d.overdue ? h('span', { class: 'bad-text', text: `${U.money(d.overdue, d.currency, s.locale)} overdue` }) : null));
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
    $('iFromOrder').addEventListener('click', fromOrder);
    NS.sampleActions.mount();
    const box = $('iRows');
    box.addEventListener('click', (e) => { const r = e.target.closest('[data-id]'); if (r) NS.app.go(`i/${r.dataset.id}`); });
    box.addEventListener('keydown', (e) => {
      const r = e.target.closest && e.target.closest('[data-id]');
      if (r && e.key === 'Enter') NS.app.go(`i/${r.dataset.id}`);
    });
    if (g.SlopCtx) {
      SlopCtx.bind(box, (target) => {
        const r = target && target.closest ? target.closest('[data-id]') : null;
        const x = r && rowsById.get(r.dataset.id);
        return x ? menuFor(x) : null;
      });
    }
  }

  NS.views = NS.views || {};
  NS.views.list = { mount, refresh: draw, onShow: draw };
  NS.listView = { draw, menuFor, fromOrder };
})(typeof window !== 'undefined' ? window : globalThis);
