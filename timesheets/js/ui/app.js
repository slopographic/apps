// Slop Timesheets boot: the business router (shared/biz/router.js) with the routes list, new, new/<id> (log the same work
// again today), t/<id> (one entry), bill and bill/<customer id>.
(function (g) {
  'use strict';
  const NS = (g.SlopTimesheets = g.SlopTimesheets || {});

  /** The route for a hash. */
  function parse(h) {
    if (h === 'bill' || h.startsWith('bill/')) return { view: 'bill', arg: h.slice(5) || null };
    if (h === 'new' || h.startsWith('new/')) return { view: 'edit', arg: null, copyOf: h.slice(4) || null };
    if (h.startsWith('t/') && h.length > 2) return { view: 'edit', arg: h.slice(2) };
    return { view: 'list' };
  }

  NS.state = { prefill: null };
  g.SlopBiz.router.start({ ns: NS, app: 'timesheets', parse, editLabel: (t) => (t.arg ? 'Entry' : 'Log time') });
})(typeof window !== 'undefined' ? window : globalThis);
