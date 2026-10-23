// Quotes list: search, status filter (expired = open and past the valid-until date), one row per quote (SlopList,
// shared/ui/list.js: click or Enter opens it, the arrows move, right-click or the Menu key opens its menu).
(function (g) {
  'use strict';
  const NS = (g.SlopQuotes = g.SlopQuotes || {});
  const U = NS.util;
  const UI = g.SlopUI;
  const $ = (id) => document.getElementById(id);
  const CHIP = { sent: '', accepted: 'good', declined: 'void' }; // SlopList chip classes per status
  let list = null, settings = null;

  async function draw() {
    if (!$('view-list') || $('view-list').hidden) return;
    settings = await U.settings();
    const r = await NS.quotes.list({ status: $('qStatus').value, search: $('qSearch').value });
    if (!r.ok) { $('qSummary').textContent = U.refusal(r); return; }
    list.set(r.value);
  }

  /** One quote as a SlopList row: number and customer, the total, its status (expired first), dates and links. */
  function row(x) {
    const s = settings;
    return { title: `${x.number} · ${x.customerName}`, amount: U.money(x.total, x.currency || s.currency, s.locale), cls: x.expired ? 'is-overdue' : '',
      meta: [x.expired ? { chip: 'Expired', cls: 'bad' } : { chip: U.STATUS[x.status] || x.status, cls: CHIP[x.status] || '' }, x.date,
        x.validUntil ? `Valid until ${x.validUntil}` : null, x.orderId ? 'ordered' : null, x.invoiceId ? 'invoiced' : null] };
  }

  /** Runs a Result-returning action from the menu: a plain message on refusal, then redraws. */
  async function run(promise, okText) {
    const r = await promise;
    if (!r.ok) { UI.alert('Not done', U.refusal(r)); return; }
    UI.toast(okText);
    draw();
  }

  function menuFor(x) {
    const items = [{ label: 'Open quote', act: () => NS.app.go(`q/${x.id}`) }];
    const open = x.status === 'draft' || x.status === 'sent';
    if (x.status === 'draft') items.push({ label: 'Mark as sent', act: () => run(NS.quotes.setStatus(x.id, 'sent'), `${x.number} sent`) });
    if ((open || x.status === 'accepted') && !x.orderId && !x.invoiceId) {
      items.push({ label: 'Make order', act: () => run(NS.quotes.toOrder(x.id), `${x.number} accepted; order made`) });
      items.push({ label: 'Make invoice', act: () => run(NS.quotes.toInvoice(x.id), `${x.number} accepted; draft invoice made`) });
    }
    if (open) items.push({ label: 'Decline', act: () => run(NS.quotes.setStatus(x.id, 'declined'), `${x.number} declined`) });
    if (x.status === 'declined') items.push({ label: 'Reopen', act: () => run(NS.quotes.setStatus(x.id, 'draft'), `${x.number} reopened`) });
    if (x.orderId) items.push({ label: 'Open order', act: () => { location.href = `../orders/#o/${x.orderId}`; } });
    if (x.invoiceId) items.push({ label: 'Open invoice', act: () => { location.href = `../invoices/#i/${x.invoiceId}`; } });
    return items;
  }

  function mount() {
    $('qSearch').addEventListener('input', draw);
    $('qStatus').addEventListener('change', draw);
    $('qNew').addEventListener('click', () => NS.app.go('new'));
    list = g.SlopList.mount($('qRows'), { label: 'Quotes', noun: ['quote', 'quotes'], summary: $('qSummary'),
      empty: 'No quotes match. Start one with New quote.', row, open: (x) => NS.app.go(`q/${x.id}`), menu: menuFor });
  }

  NS.listView = { mount, draw, menuFor };
  NS.views = NS.views || {};
  NS.views.list = { mount, refresh: draw, onShow: draw };
})(typeof window !== 'undefined' ? window : globalThis);
