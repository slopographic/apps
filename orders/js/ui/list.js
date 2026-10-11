// Orders list: search, status filter, one row per order, and a right-click (or Menu key) menu per row.
// Every action is a SlopOrders action (core/actions.js, core/fulfil.js), so the list and the editor agree.
(function (g) {
  'use strict';
  const NS = (g.SlopOrders = g.SlopOrders || {});
  const U = NS.util;
  const M = g.SlopDocs.model;
  const UI = g.SlopUI;
  const h = U.h;
  const $ = (id) => document.getElementById(id);
  let rowsById = new Map();

  async function draw() {
    if (!$('view-list') || $('view-list').hidden) return;
    const s = await U.settings();
    const r = await NS.orders.list({ status: $('oStatus').value, search: $('oSearch').value });
    if (!r.ok) { $('oSummary').textContent = U.refusal(r); return; }
    rowsById = new Map(r.value.map((x) => [x.id, x]));
    $('oRows').replaceChildren(...r.value.map((x) => row(x, s)));
    $('oEmpty').hidden = r.value.length > 0;
    $('oSummary').textContent = `${r.value.length} order${r.value.length === 1 ? '' : 's'}`;
  }

  function row(x, s) {
    const lines = x.lines.length;
    return h('div', { class: 'orow', role: 'row', tabindex: 0, dataset: { id: x.id } },
      h('span', { class: 'who', text: `${x.number} · ${x.customerName}` }),
      h('span', { class: 'amt num', text: U.money(x.total, x.currency || s.currency, s.locale) }),
      h('div', { class: 'meta' },
        h('span', { class: `chip ${x.status}`, text: M.STATUS_LABEL[x.status] || x.status }),
        h('span', { text: x.date }),
        h('span', { text: `${lines} line${lines === 1 ? '' : 's'}` }),
        x.invoiceId ? h('span', { text: 'invoiced' }) : null));
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
    const box = $('oRows');
    box.addEventListener('click', (e) => { const r = e.target.closest('[data-id]'); if (r) NS.app.go(`o/${r.dataset.id}`); });
    box.addEventListener('keydown', (e) => {
      const r = e.target.closest && e.target.closest('[data-id]');
      if (r && e.key === 'Enter') NS.app.go(`o/${r.dataset.id}`);
    });
    if (g.SlopCtx) {
      SlopCtx.bind(box, (target) => {
        const r = target && target.closest ? target.closest('[data-id]') : null;
        const x = r && rowsById.get(r.dataset.id);
        return x ? menuFor(x) : null;
      });
    }
  }

  NS.listView = { mount, draw, menuFor };
  NS.views = NS.views || {};
  NS.views.list = { mount, refresh: draw, onShow: draw };
})(typeof window !== 'undefined' ? window : globalThis);
