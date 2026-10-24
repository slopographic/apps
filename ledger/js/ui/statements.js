// The Statements tab: the profit and loss for a period and the balance sheet at its last day, as printable sheets
// (shared/biz/sheet.js) from the journal (core/statements.js). A period is this month, this quarter, this year, last year,
// or two dates. Print gives both sheets; Download CSV gives both as one file.
(function (g) {
  'use strict';
  const S = g.SlopData, UI = g.SlopUI, el = UI.el;
  const NS = (g.SlopLedger = g.SlopLedger || {});
  const $ = (id) => document.getElementById(id);
  let last = null;   // { pnl, bs, base } of the last render, for the CSV

  /** The dates of the chosen period; Custom keeps the dates typed. */
  function range() {
    const kind = $('fsPeriod').value;
    if (kind !== 'custom') { const p = NS.statements.period(kind, NS.util.today()); $('fsFrom').value = p.from; $('fsTo').value = p.to; }
    $('fsFrom').disabled = $('fsTo').disabled = kind !== 'custom';
    return { from: $('fsFrom').value, to: $('fsTo').value || NS.util.today() };
  }

  /** A section of a statement: its rows, then its total. */
  function section(title, list, total, m) {
    return [el('tr', { class: 'fs-head' }, el('th', { colspan: 2 }, title)),
      ...list.map((r) => el('tr', null, el('td', null, `${r.code} ${r.name}`.trim()), el('td', { class: 'num' }, m(r.amount)))),
      ...(list.length ? [] : [el('tr', null, el('td', { class: 'sub' }, 'Nothing in this period'), el('td', { class: 'num' }, m(0)))]),
      el('tr', { class: 'fs-total' }, el('th', null, `Total ${title.toLowerCase()}`), el('th', { class: 'num' }, m(total)))];
  }
  const sheet = (s, title, meta, body, foot) => el('article', { class: 'doc-sheet fs-sheet' }, g.SlopBiz.sheet.head(s, title, meta),
    el('div', { class: 'sheet-scroll' }, el('table', { class: 'grid-t' }, el('tbody', null, ...body))), foot);

  async function render() {
    const { from, to } = range(), s = await NS.util.settings(), biz = await g.SlopBiz.settings();
    const [j, a] = await Promise.all([S.store.list('journal'), S.store.list('accounts')]);
    const entries = j.ok ? j.value : [], accounts = a.ok ? a.value : [];
    const m = (v) => NS.util.money(v, s.base, s.locale);
    const pnl = NS.statements.profitAndLoss(entries, accounts, { from, to });
    const bs = NS.statements.balanceSheet(entries, accounts, { at: to });
    last = { pnl, bs, base: s.base };
    const result = el('p', { class: 'sheet-total' }, el('span', null, pnl.result >= 0 ? 'Profit' : 'Loss'), el('b', null, m(Math.abs(pnl.result))));
    const check = el('p', { class: bs.balanced ? 'note ok' : 'msg bad' }, bs.balanced
      ? `Assets ${m(bs.totalAssets)} = liabilities ${m(bs.totalLiabilities)} + equity ${m(bs.totalEquity)}. It balances.`
      : `It does not balance: assets ${m(bs.totalAssets)}, liabilities and equity ${m(bs.totalLiabilities + bs.totalEquity)}. Check the trial balance.`);
    const equity = bs.equity.concat([{ code: '', name: 'Result to date (not yet closed into equity)', amount: bs.resultToDate }]);
    $('fsSheets').replaceChildren(
      sheet(biz, 'Profit and loss', [`${from} to ${to}`, `In ${s.base}`], [...section('Revenue', pnl.revenue, pnl.totalRevenue, m), ...section('Expenses', pnl.expenses, pnl.totalExpenses, m)], result),
      sheet(biz, 'Balance sheet', [`At ${to}`, `In ${s.base}`], [...section('Assets', bs.assets, bs.totalAssets, m), ...section('Liabilities', bs.liabilities, bs.totalLiabilities, m),
        ...section('Equity', equity, bs.totalEquity, m)], check));
  }

  /** Both statements as one CSV: statement, section, account, amount (plain decimals). */
  function csv() {
    if (!last) return;
    const { pnl, bs, base } = last, d = (v) => S.money.plainMinor(v, base), out = [['Statement', 'Section', 'Account', 'Amount']];
    const put = (st, sec, list) => list.forEach((r) => out.push([st, sec, `${r.code} ${r.name}`.trim(), d(r.amount)]));
    put('Profit and loss', 'Revenue', pnl.revenue); put('Profit and loss', 'Expenses', pnl.expenses);
    out.push(['Profit and loss', 'Result', '', d(pnl.result)]);
    put('Balance sheet', 'Assets', bs.assets); put('Balance sheet', 'Liabilities', bs.liabilities); put('Balance sheet', 'Equity', bs.equity);
    out.push(['Balance sheet', 'Equity', 'Result to date', d(bs.resultToDate)]);
    const cell = (v) => (/[",\n]/.test(v) ? `"${String(v).replace(/"/g, '""')}"` : v);
    UI.download(new Blob([out.map((r) => r.map(cell).join(',')).join('\r\n') + '\r\n'], { type: 'text/csv' }), `statements-${pnl.from}-to-${pnl.to}.csv`);
  }

  function mount() {
    for (const id of ['fsPeriod', 'fsFrom', 'fsTo']) $(id).addEventListener('change', render);
    $('fsPrint').addEventListener('click', () => g.print());
    $('fsCsv').addEventListener('click', csv);
  }

  NS.views = NS.views || {};
  NS.views.fin = { mount, render };
  NS.statementsView = { render, csv };
})(typeof window !== 'undefined' ? window : globalThis);
