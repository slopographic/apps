// Slop Expenses boot: the business router (shared/biz/router.js) with the expense routes: list, new, new/<id> (a copy of
// one), e/<id> (one expense) and summary.
(function (g) {
  'use strict';
  const NS = (g.SlopExpenses = g.SlopExpenses || {});

  /** The route for a hash. */
  function parse(h) {
    if (h === 'summary') return { view: 'summary' };
    if (h === 'new' || h.startsWith('new/')) return { view: 'edit', arg: null, copyOf: h.slice(4) || null };
    if (h.startsWith('e/') && h.length > 2) return { view: 'edit', arg: h.slice(2) };
    return { view: 'list' };
  }

  g.SlopBiz.router.start({ ns: NS, app: 'expenses', parse, editLabel: (t) => (t.arg ? 'Expense' : 'New expense') });
})(typeof window !== 'undefined' ? window : globalThis);
