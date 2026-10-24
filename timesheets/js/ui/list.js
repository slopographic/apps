// Slop Timesheets list: period, customer, state and search filters, the totals for what is shown, and one row per entry
// (SlopList, shared/ui/list.js: click or Enter opens it, right-click or the Menu key opens its menu). CSV of what is shown.
(function (g) {
  'use strict';
  const S = g.SlopData, B = g.SlopBiz, UI = g.SlopUI;
  const NS = (g.SlopTimesheets = g.SlopTimesheets || {});
  const C = () => NS.core;
  const $ = (id) => document.getElementById(id);
  const STATE = { open: { chip: 'To bill', cls: '' }, billed: { chip: 'Billed', cls: 'good' }, internal: { chip: 'Internal', cls: 'void' } };
  let list = null, settings = null, shown = [];

  const filters = () => ({ period: $('tPeriod').value, customerId: $('tCustomer').value, state: $('tState').value, search: $('tSearch').value });
  const moneyLine = (amounts) => Object.entries(amounts).map(([cur, m]) => B.money(m, cur, settings.locale)).join(' + ');

  async function fillCustomers() {
    const r = await NS.entries.customers(), sel = $('tCustomer'), was = sel.value;
    sel.replaceChildren(B.h('option', { value: '', text: 'Every customer' }), ...(r.ok ? r.value : []).map((c) => B.h('option', { value: c.id, text: c.name })));
    sel.value = was;
  }

  async function draw() {
    if ($('view-list').hidden) return;
    settings = await B.settings();
    const r = await NS.entries.rows();
    if (!r.ok) { $('tSummary').textContent = B.refusal(r); return; }
    shown = C().filter(r.value, filters(), S.ledger.today());
    list.set(shown);
    const t = C().summary(shown, S.timesheets.amountOf);
    $('tTotal').textContent = shown.length ? `${C().hm(t.minutes)} h · billable ${C().hm(t.billableMinutes)} h${Object.keys(t.amounts).length ? ` · ${moneyLine(t.amounts)}` : ''}` : '';
  }

  /** One entry as a SlopList row: what was done, the time and its value, and the date, customer, project and state. */
  function row(x) {
    const st = STATE[x.state];
    return { title: x.description, amount: `${C().hm(x.minutes)} h`,
      meta: [{ chip: st.chip, cls: st.cls }, x.date, x.customerName || null, x.project || null,
        x.billable ? B.money(x.amount, x.currency, settings.locale) : null, x.invoiceNumber ? `on ${x.invoiceNumber}` : null] };
  }

  async function remove(x) {
    const yes = await UI.confirm('Delete time', `Delete "${x.description}" (${C().hm(x.minutes)} h on ${x.date})?`, 'Delete', { danger: true });
    if (!yes) return;
    const r = await NS.entries.remove(x.id);
    if (!r.ok) UI.alert('Not deleted', B.refusal(r)); else { UI.toast('Time deleted'); draw(); }
  }

  function menuFor(x) {
    const items = [{ label: 'Open', act: () => NS.app.go(`t/${x.id}`) }, { label: 'Log again today', act: () => NS.app.go(`new/${x.id}`) }];
    if (x.state === 'open') items.push({ label: `Bill ${x.customerName || 'this customer'}…`, act: () => NS.app.go(`bill/${x.customerId}`) });
    if (x.state === 'billed') items.push({ label: `Open invoice ${x.invoiceNumber}`, act: () => { location.href = `../invoices/#i/${x.invoiceId}`; } });
    if (x.state !== 'billed') items.push({ label: 'Delete…', act: () => remove(x) });
    return items;
  }

  /** Downloads the shown rows as CSV. */
  function downloadCsv() {
    if (!shown.length) { UI.toast('Nothing to export'); return; }
    const text = C().csv(shown, S.timesheets.amountOf, (m, c) => S.money.plainMinor(m, c || settings.currency));
    UI.download(new Blob([text], { type: 'text/csv' }), `timesheet-${S.ledger.today()}.csv`);
    UI.toast('CSV downloaded');
  }

  function mount() {
    for (const id of ['tSearch', 'tPeriod', 'tCustomer', 'tState']) $(id).addEventListener(id === 'tSearch' ? 'input' : 'change', draw);
    $('tNew').addEventListener('click', () => NS.app.go('new'));
    $('tCsv').addEventListener('click', downloadCsv);
    list = g.SlopList.mount($('tRows'), { label: 'Time', noun: ['entry', 'entries'], summary: $('tSummary'),
      empty: 'No time here yet. Start the timer, or log time with Log time.', row, open: (x) => NS.app.go(`t/${x.id}`), menu: menuFor });
  }

  NS.views = NS.views || {};
  NS.views.list = { mount, show: async () => { await fillCustomers(); await draw(); if (NS.timer) NS.timer.paint(); }, refresh: draw };
  NS.listView = { draw, menuFor, downloadCsv };
})(typeof window !== 'undefined' ? window : globalThis);
