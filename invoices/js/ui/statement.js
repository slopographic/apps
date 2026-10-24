// The Statement view (#s/<customer id>): one customer's account in one currency, as a printable sheet: the company and
// customer blocks, every issued invoice and payment with a running balance (from a date, or from the start), what is owed
// now and how late it is (SlopData.statement). Print it, download it as CSV, or write a payment reminder (ui/reminder.js).
(function (g) {
  'use strict';
  const S = g.SlopData;
  const NS = (g.SlopInvoices = g.SlopInvoices || {});
  const U = NS.util;
  const h = U.h;
  const $ = (id) => document.getElementById(id);
  const AGE = [['current', 'Not yet due'], ['d30', '1–30 days late'], ['d60', '31–60 days late'], ['d90', '61–90 days late'], ['over90', 'Over 90 days late']];
  let cur = null;   // { customer, invoices, payments, settings }

  /** Reads the customer, their invoices and the payments, and fills the currency pick. */
  async function load(customerId) {
    const [c, inv, pay, settings] = await Promise.all([S.store.get('customers', customerId), S.store.list('invoices'), S.store.list('payments'), U.settings()]);
    if (!c.ok || !c.value) { cur = null; return false; }
    cur = { customer: c.value, invoices: inv.ok ? inv.value : [], payments: pay.ok ? pay.value : [], settings };
    const list = S.statement.currencies(cur.invoices, customerId);
    $('stCurrency').replaceChildren(...(list.length ? list : [settings.currency]).map((x) => h('option', { value: x, text: x })));
    $('stCurrency').closest('label').hidden = list.length < 2;
    return true;
  }

  function build() {
    return S.statement.build(cur.invoices, cur.payments, cur.customer.id, { currency: $('stCurrency').value, from: $('stFrom').value, today: S.ledger.today() });
  }

  /** Draws the sheet. */
  function draw() {
    if (!cur) { $('stSheet').replaceChildren(h('p', { class: 'msg bad', text: 'That customer no longer exists.' })); return; }
    const st = build(), s = cur.settings, c = cur.customer;
    const m = (v) => U.money(v, st.currency, s.locale);
    const lines = (t) => String(t || '').split('\n').map((x) => x.trim()).filter(Boolean);
    const row = (cells, cls) => h('tr', { class: cls }, cells.map((x, i) => h('td', { class: i >= 4 ? 'num' : '' }, x)));
    $('stSheet').replaceChildren(h('article', { class: 'statement' },
      h('header', { class: 'st-head' },
        h('div', null, h('b', { text: s.companyName || 'Your company' }), ...lines(s.address).map((x) => h('div', { text: x })), s.taxNumber ? h('div', { text: `Tax number ${s.taxNumber}` }) : null),
        h('div', { class: 'st-title' }, h('h2', { text: 'Statement' }), h('div', { text: `Date ${st.today}` }), st.from ? h('div', { text: `From ${st.from}` }) : null)),
      h('div', { class: 'st-to' }, h('span', { class: 'sub', text: 'To' }), h('b', { text: c.name }), ...[c.email, c.phone, ...lines(c.address)].filter(Boolean).map((x) => h('div', { text: x }))),
      h('p', { class: 'st-total' }, h('span', { text: 'Balance owed' }), h('b', { text: m(st.closing) })),
      h('div', { class: 'st-scroll' }, h('table', { class: 'grid-t st-table' },
        h('thead', null, h('tr', null, ['Date', 'What', 'Invoice', 'Due', 'Charged', 'Paid', 'Balance'].map((x, i) => h('th', { class: i >= 4 ? 'num' : '', text: x })))),
        h('tbody', null, st.from ? row(['', 'Opening balance', '', '', '', '', m(st.opening)], 'st-open') : null,
          st.lines.map((l) => row([l.date, l.kind === 'invoice' ? 'Invoice' : 'Payment, thank you', l.ref, l.due, l.debit ? m(l.debit) : '', l.credit ? m(l.credit) : '', m(l.balance)])),
          st.lines.length ? null : h('tr', null, h('td', { colspan: 7, class: 'sub', text: 'Nothing in this period.' }))),
        h('tfoot', null, h('tr', null, h('th', { colspan: 6, text: 'Balance owed' }), h('th', { class: 'num', text: m(st.closing) }))))),
      h('div', { class: 'stats st-age' }, AGE.map(([k, label]) => h('div', { class: `stat${st.ageing[k] && k !== 'current' ? ' is-late' : ''}` }, h('b', { text: m(st.ageing[k]) }), h('span', { text: label })))),
      st.owed.length ? h('p', { class: 'note', text: `Still open: ${st.owed.map((o) => `${o.ref} ${m(o.left)}${o.late ? ` (${o.late} days late)` : ''}`).join(' · ')}.` }) : h('p', { class: 'note', text: 'Nothing is owed. Thank you.' })));
    $('stTitle').textContent = `${c.name}: statement`;
    $('stRemind').disabled = st.closing <= 0;
  }

  /** Downloads the statement as CSV. */
  function downloadCsv() {
    if (!cur) return;
    const st = build();
    const text = S.statement.csv(st, (v) => S.money.plainMinor(v, st.currency));
    g.SlopUI.download(new Blob([text], { type: 'text/csv' }), `statement-${cur.customer.name.replace(/[^\w.-]+/g, '-')}-${st.today}.csv`);
  }

  async function show(customerId) {
    $('stFrom').value = '';
    await load(customerId);
    draw();
  }

  function mount() {
    $('stCurrency').addEventListener('change', draw);
    $('stFrom').addEventListener('input', draw);
    $('stPrint').addEventListener('click', () => g.print());
    $('stCsv').addEventListener('click', downloadCsv);
    $('stRemind').addEventListener('click', () => cur && NS.reminder.open(build(), cur.customer, cur.settings));
    $('stBack').addEventListener('click', () => NS.app.go('list'));
  }

  NS.statementView = { show, draw, build, downloadCsv };
  NS.views = NS.views || {};
  NS.views.statement = { mount, refresh: () => { if (cur) show(cur.customer.id); }, onShow: show };
})(typeof window !== 'undefined' ? window : globalThis);
