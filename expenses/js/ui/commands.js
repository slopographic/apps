// Slop Expenses commands (the palette and [data-cmd] buttons), through SlopBiz.commands (shared/biz/biz.js).
(function (g) {
  'use strict';
  const NS = (g.SlopExpenses = g.SlopExpenses || {});
  const open = () => { const e = NS.editor && NS.editor.current(); return !!e && location.hash.startsWith('#e/'); };
  const COMMANDS = [
    { id: 'view.list', title: 'Go to Expenses', group: 'Go to', run: () => NS.app.go('list') },
    { id: 'view.summary', title: 'Go to Summary', group: 'Go to', keywords: ['totals', 'report', 'month'], run: () => NS.app.go('summary') },
    { id: 'expenses.new', title: 'Expenses: new expense', group: 'Expenses', keywords: ['add', 'record', 'receipt', 'bill'], run: () => NS.app.go('new') },
    { id: 'expenses.csv', title: 'Expenses: download CSV', group: 'Expenses', keywords: ['export', 'spreadsheet', 'accountant'], run: () => NS.summaryView.exportCsv() },
    { id: 'expense.void', title: 'Expense: void…', group: 'Expense', when: () => open() && NS.editor.current().status === 'posted', run: () => NS.listView.voidOne(NS.editor.current()) },
    { id: 'expense.copy', title: 'Expense: record a copy', group: 'Expense', when: open, run: () => NS.app.go(`new/${NS.editor.current().id}`) },
  ];
  NS.commands = { init: () => { NS.commands.run = g.SlopBiz.commands('expenses', COMMANDS); }, list: COMMANDS };
})(typeof window !== 'undefined' ? window : globalThis);
