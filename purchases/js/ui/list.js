// Purchase orders list: search, status filter (late = ordered and past the expected date; to bill = no bill recorded yet),
// one row per order (SlopList, shared/ui/list.js), and a row menu with the steps its status allows.
(function (g) {
  'use strict';
  const NS = (g.SlopPurchases = g.SlopPurchases || {});
  const U = NS.util;
  const UI = g.SlopUI;
  const $ = (id) => document.getElementById(id);
  const CHIP = { ordered: '', received: 'good', cancelled: 'void' }; // SlopList chip classes per status
  let list = null, settings = null;

  async function draw() {
    if (!$('view-list') || $('view-list').hidden) return;
    settings = await U.settings();
    const r = await NS.purchases.list({ status: $('pStatus').value, search: $('pSearch').value });
    if (!r.ok) { $('pSummary').textContent = U.refusal(r); return; }
    list.set(r.value);
  }

  /** One order as a SlopList row: number and supplier, the total, its status (late first), dates and the bill. */
  function row(x) {
    const s = settings;
    return { title: `${x.number} · ${x.supplierName}`, amount: U.money(x.total, x.currency || s.currency, s.locale), cls: x.late ? 'is-overdue' : '',
      meta: [x.late ? { chip: 'Late', cls: 'bad' } : { chip: U.STATUS[x.status] || x.status, cls: CHIP[x.status] || '' }, x.date,
        x.expectedDate && x.status === 'ordered' ? `Expected ${x.expectedDate}` : null, x.receivedAt ? `Received ${x.receivedAt}` : null,
        x.expenseId ? 'billed' : x.unbilled ? { chip: 'To bill', cls: 'warn' } : null] };
  }

  async function run(promise, okText) {
    const r = await promise;
    if (!r.ok) { UI.alert('Not done', U.refusal(r)); return; }
    UI.toast(okText);
    draw();
  }

  function menuFor(x) {
    const items = [{ label: 'Open purchase order', act: () => NS.app.go(`po/${x.id}`) }];
    if (x.status === 'draft') items.push({ label: 'Place order', act: () => run(NS.purchases.setStatus(x.id, 'ordered'), `${x.number} ordered`) });
    if (x.status === 'ordered') items.push({ label: 'Receive…', act: async () => { if (await UI.confirm('Receive order', `Receive ${x.number}? Its product lines go into stock.`, 'Receive')) run(NS.purchases.receive(x.id), `${x.number} received`); } });
    if (x.unbilled) items.push({ label: 'Record bill…', act: () => NS.app.go(`po/${x.id}`) });
    if (x.expenseId) items.push({ label: 'Open the bill', act: () => { location.href = `../expenses/#e/${x.expenseId}`; } });
    if (x.status === 'draft' || x.status === 'ordered') items.push({ label: 'Cancel order', act: () => run(NS.purchases.setStatus(x.id, 'cancelled'), `${x.number} cancelled`) });
    return items;
  }

  function mount() {
    $('pSearch').addEventListener('input', draw);
    $('pStatus').addEventListener('change', draw);
    $('pNew').addEventListener('click', () => NS.app.go('new'));
    list = g.SlopList.mount($('pRows'), { label: 'Purchase orders', noun: ['purchase order', 'purchase orders'], summary: $('pSummary'),
      empty: 'No purchase orders match. Start one with New purchase order.', row, open: (x) => NS.app.go(`po/${x.id}`), menu: menuFor });
  }

  NS.listView = { mount, draw, menuFor };
  NS.views = NS.views || {};
  NS.views.list = { mount, refresh: draw, onShow: draw };
})(typeof window !== 'undefined' ? window : globalThis);
