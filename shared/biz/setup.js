// Getting started with the business apps: the first steps, each done or not, worked out from the shared data (never stored),
// with the app that does it. Slop Admin shows them on its Get started tab. Classic script, loaded after shared/data and
// biz.js. SlopBiz.setup = { STEPS, steps(settings, counts) (pure), load() -> Result of { steps, done, total } }.
(function (g) {
  'use strict';
  const B = (g.SlopBiz = g.SlopBiz || {});

  // id, the step, why it matters, where it is done (a path from the site root), and when it counts as done.
  const STEPS = [
    { id: 'company', title: 'Add your company details', why: 'Your name, address and tax number go on every quote, invoice and purchase order.',
      href: 'admin/#company', done: (s) => !!(s.companyName && s.companyName.trim()) },
    { id: 'customer', title: 'Add your first customer', why: 'Customers are shared by CRM, Quotes, Orders, Invoices and Timesheets.',
      href: 'crm/', done: (s, c) => c.customers > 0 },
    { id: 'product', title: 'Add a product or service', why: 'Products fill document lines with a price and tax rate, and Inventory keeps their stock.',
      href: 'inventory/#products', done: (s, c) => c.products > 0 },
    { id: 'sell', title: 'Send a quote or an invoice', why: 'A quote becomes an order or an invoice in one click; an issued invoice is posted to your books.',
      href: 'invoices/#new', done: (s, c) => c.quotes + c.invoices > 0 },
    { id: 'spend', title: 'Record an expense', why: 'Expenses and supplier bills go into the same books, so Reports can show your profit.',
      href: 'expenses/#new', done: (s, c) => c.expenses > 0 },
  ];

  /** Pure: each step with done. counts: { customers (not suppliers), products, quotes, invoices, expenses }. */
  function steps(settings, counts) {
    const c = { customers: 0, products: 0, quotes: 0, invoices: 0, expenses: 0, ...counts };
    return STEPS.map((st) => ({ id: st.id, title: st.title, why: st.why, href: st.href, done: !!st.done(settings || {}, c) }));
  }

  /** Reads the settings and the counts in one transaction and works out the steps. */
  async function load() {
    const S = g.SlopData;
    const r = await S.store.readAll(async (tx) => {
      const out = {};
      for (const n of ['customers', 'products', 'quotes', 'invoices', 'expenses']) {
        const l = await tx.list(n);
        if (!l.ok) return l;
        out[n] = n === 'customers' ? l.value.filter((x) => !x.supplier).length : l.value.length;
      }
      const s = await tx.get('settings', 'main');
      if (!s.ok) return s;
      return S.result.ok({ settings: s.value || {}, counts: out });
    });
    if (!r.ok) return r;
    const list = steps(r.value.settings, r.value.counts);
    return S.result.ok({ steps: list, done: list.filter((x) => x.done).length, total: list.length });
  }

  B.setup = { STEPS, steps, load };
})(typeof window !== 'undefined' ? window : globalThis);
