// Reports view: the stock value total (integer money, formatted only for display), the low-stock list (at or below
// each product's reorder level) and the value by product. Everything comes from one read of products and movements.
(function (g) {
  'use strict';
  const NS = (g.SlopInv = g.SlopInv || {});
  const U = NS.util;
  const { h } = U;
  const $ = (id) => document.getElementById(id);

  async function refresh() {
    const r = await NS.rows.stockRows();
    if (!r.ok) { $('kValue').textContent = U.refusal(r); return; }
    const st = NS.state.settings || { currency: 'USD', locale: 'en-US' };
    const rows = r.value;
    const t = NS.rows.totalsOf(rows);
    $('kValue').textContent = U.money(t.value, st.currency, st.locale);
    $('kProducts').textContent = String(t.products);
    $('kUnits').textContent = String(t.units);
    $('kLow').textContent = String(t.low);
    const low = rows.filter((x) => x.low).sort((a, b) => (a.onHand - a.reorderLevel) - (b.onHand - b.reorderLevel) || a.sku.localeCompare(b.sku));
    $('lowList').replaceChildren(...low.map((x) => h('li', { class: 'out' },
      h('span', { text: `${x.sku} ${x.name}` }),
      h('span', { class: 'sub', text: `reorder at ${x.reorderLevel}${x.onOrder ? ` · ${x.onOrder} on order` : ''}` }),
      h('b', { class: 'num', text: `${x.onHand} ${x.unit}` }))));
    $('lowEmpty').hidden = low.length > 0;
    const valued = rows.slice().sort((a, b) => b.value - a.value || a.sku.localeCompare(b.sku));
    $('valueList').replaceChildren(...(valued.length ? valued : []).map((x) => h('li', null,
      h('span', { text: `${x.sku} ${x.name}` }),
      h('span', { class: 'sub num', text: `${x.onHand} × ${U.money(x.price, st.currency, st.locale)}` }),
      h('b', { class: 'num', text: U.money(x.value, st.currency, st.locale) }))));
    if (!valued.length) $('valueList').replaceChildren(h('li', { class: 'empty', text: 'No products yet.' }));
  }

  NS.views = NS.views || {};
  NS.views.reports = { mount: () => {}, refresh, onShow: () => refresh() };
})(typeof window !== 'undefined' ? window : globalThis);
