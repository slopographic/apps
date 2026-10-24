// Slop Expenses list: search, status and period filters, the count, and one row per expense (SlopList, shared/ui/list.js).
// A row opens the expense; its menu opens, copies (a new expense with the same details) or voids it.
(function (g) {
  'use strict';
  const S = g.SlopData, B = g.SlopBiz, UI = g.SlopUI;
  const NS = (g.SlopExpenses = g.SlopExpenses || {});
  const $ = (id) => document.getElementById(id);
  let list = null, all = [], settings = null, names = {};

  /** The date range of a period choice, as YYYY-MM-DD ends (both included), counted from today. */
  function period(choice, today = new Date()) {
    const y = today.getFullYear(), m = today.getMonth(), iso = (d) => new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())).toISOString().slice(0, 10);
    if (choice === 'month') return { from: iso(new Date(y, m, 1)), to: iso(new Date(y, m + 1, 0)) };
    if (choice === 'last') return { from: iso(new Date(y, m - 1, 1)), to: iso(new Date(y, m, 0)) };
    if (choice === 'year') return { from: `${y}-01-01`, to: `${y}-12-31` };
    return {};
  }

  async function load() {
    const [r, s, accts] = await Promise.all([S.store.list('expenses'), B.settings(), B.expenseAccounts()]);
    all = r.ok ? r.value : [];
    settings = s;
    names = Object.fromEntries(accts.map((a) => [a.code, a.name]));
    if (!r.ok) $('xSummary').textContent = B.refusal(r);
  }

  function draw() {
    const shown = NS.core.filter(all, { search: $('xSearch').value, status: $('xStatus').value, ...period($('xPeriod').value) });
    list.set(shown);
    const posted = shown.filter((e) => e.status === 'posted'), cur = settings.currency;
    const same = posted.every((e) => (e.currency || cur) === cur);
    $('xTotal').textContent = posted.length && same ? `Total ${B.money(posted.reduce((t, e) => t + e.amount, 0), cur, settings.locale)}` : '';
  }

  async function voidOne(e) {
    const yes = await UI.confirm('Void expense', `Void the expense from ${e.supplier} on ${e.date}? Its entry in the books is reversed; the expense stays in the list as void.`, 'Void expense', { danger: true });
    if (!yes) return;
    const r = await S.expenses.voidExpense(e.id);
    if (!r.ok) { UI.alert('Not voided', B.refusal(r)); return; }
    UI.toast(`Expense from ${e.supplier} voided`);
    refresh();
  }

  function menu(e) {
    const items = [{ label: 'Open', act: () => NS.app.go(`e/${e.id}`) }, { label: 'Record a copy…', act: () => NS.app.go(`new/${e.id}`) }];
    if (e.status === 'posted') items.push({ label: 'Void…', act: () => voidOne(e) });
    return items;
  }

  function mount() {
    if (NS.mileageDialog) NS.mileageDialog.mount();   // Mileage… (ui/mileage.js)
    list = g.SlopList.mount($('xRows'), {
      label: 'Expenses', noun: ['expense', 'expenses'], summary: $('xSummary'),
      empty: 'No expenses match. Record one with New expense.',
      row: (e) => ({
        title: e.supplier + (e.description ? ` · ${e.description}` : ''),
        amount: B.money(e.amount, e.currency || settings.currency, settings.locale), cls: e.status === 'void' ? 'is-void' : '',
        meta: [e.date, names[e.account] || e.account, e.tax ? `tax ${B.money(e.tax, e.currency || settings.currency, settings.locale)}` : null,
          e.method, e.status === 'void' ? { chip: 'Void', cls: 'void' } : null, e.sample ? { chip: 'Sample', cls: 'warn' } : null],
      }),
      open: (e) => NS.app.go(`e/${e.id}`), menu,
    });
    for (const id of ['xSearch', 'xStatus', 'xPeriod']) $(id).addEventListener(id === 'xSearch' ? 'input' : 'change', draw);
    $('xNew').addEventListener('click', () => NS.app.go('new'));
  }

  async function refresh() { await load(); draw(); }

  NS.listView = { period, menu, voidOne };
  NS.views = NS.views || {};
  NS.views.list = { mount, show: refresh, refresh };
})(typeof window !== 'undefined' ? window : globalThis);
