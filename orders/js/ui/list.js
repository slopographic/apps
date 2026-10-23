// Orders list: search, status filter, one row per order (SlopList, shared/ui/list.js: click or Enter opens it, the arrows
// move, right-click or the Menu key opens its menu). Every action is a SlopOrders action (core/actions.js, core/fulfil.js),
// so the list and the editor agree.
(function (g) {
  'use strict';
  const NS = (g.SlopOrders = g.SlopOrders || {});
  const U = NS.util;
  const M = g.SlopDocs.model;
  const UI = g.SlopUI;
  const $ = (id) => document.getElementById(id);
  const CHIP = { open: '', fulfilled: 'good', cancelled: 'void' }; // SlopList chip classes per status
  let list = null, settings = null;

  async function draw() {
    if (!$('view-list') || $('view-list').hidden) return;
    settings = await U.settings();
    const r = await NS.orders.list({ status: $('oStatus').value, search: $('oSearch').value });
    if (!r.ok) { $('oSummary').textContent = U.refusal(r); return; }
    list.set(r.value);
  }

  /** One order as a SlopList row: number and customer, the total, and its status, date, lines and links. */
  function row(x) {
    const lines = x.lines.length, s = settings;
    return { title: `${x.number} · ${x.customerName}`, amount: U.money(x.total, x.currency || s.currency, s.locale),
      meta: [{ chip: M.STATUS_LABEL[x.status] || x.status, cls: CHIP[x.status] || '' }, x.date, `${lines} line${lines === 1 ? '' : 's'}`,
        x.invoiceId ? 'invoiced' : null, x.sample ? { chip: 'Sample', cls: 'warn' } : null] };
  }

  /** Runs a Result-returning action from the menu: a plain message on refusal, then redraws. */
  async function run(promise, okText) {
    const r = await promise;
    if (!r.ok) { UI.alert('Not done', U.refusal(r)); return; }
    if (okText) UI.toast(okText);
    draw();
  }

  async function fulfil(x) {
    const yes = await UI.confirm('Fulfil order', `Fulfil ${x.number}? Stock on its product lines is taken out of the main location.`, 'Fulfil');
    if (yes) run(NS.actions.fulfilId(x.id), `${x.number} fulfilled`);
  }

  async function cancel(x) {
    const yes = await UI.confirm('Cancel order', `Cancel ${x.number}? A cancelled order cannot be changed.`, 'Cancel order', { danger: true });
    if (yes) run(NS.actions.cancelId(x.id), `${x.number} cancelled`);
  }

  function menuFor(x) {
    const items = [{ label: 'Open order', act: () => NS.app.go(`o/${x.id}`) }];
    if (x.status === 'draft') items.push({ label: 'Confirm order', act: () => run(NS.actions.confirmId(x.id), `${x.number} confirmed`) });
    if (x.status === 'open') items.push({ label: 'Fulfil…', act: () => fulfil(x) });
    if (x.status === 'draft' || x.status === 'open') items.push({ label: 'Cancel order…', act: () => cancel(x) });
    if ((x.status === 'open' || x.status === 'fulfilled') && !x.invoiceId) {
      items.push({ label: 'Convert to invoice', act: () => run(NS.actions.convertId(x.id), 'Invoice draft created') });
    }
    if (x.invoiceId) items.push({ label: 'Open invoice', act: () => { location.href = `../invoices/#i/${x.invoiceId}`; } });
    return items;
  }

  function mount() {
    $('oSearch').addEventListener('input', draw);
    $('oStatus').addEventListener('change', draw);
    $('oNew').addEventListener('click', () => NS.app.go('new'));
    NS.sampleActions.mount();
    list = g.SlopList.mount($('oRows'), { label: 'Orders', noun: ['order', 'orders'], summary: $('oSummary'),
      empty: 'No orders match. Start one with New order.', row, open: (x) => NS.app.go(`o/${x.id}`), menu: menuFor });
  }

  NS.listView = { mount, draw, menuFor };
  NS.views = NS.views || {};
  NS.views.list = { mount, refresh: draw, onShow: draw };
})(typeof window !== 'undefined' ? window : globalThis);
