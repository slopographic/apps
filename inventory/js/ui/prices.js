// The Price list view: every product by name with its SKU, unit, price, tax rate and price with tax (core/pricelist.js), as a
// printable business sheet (SlopBiz.sheet) under the company block; a search narrows it. Print it, or download it as CSV.
(function (g) {
  'use strict';
  const S = g.SlopData;
  const NS = (g.SlopInv = g.SlopInv || {});
  const U = NS.util;
  const h = U.h;
  const $ = (id) => document.getElementById(id);
  let shown = [], settings = null;

  async function refresh() {
    settings = await U.settings();
    const r = await S.store.list('products');
    shown = NS.pricelist.rows(r.ok ? r.value : [], { search: $('plSearch').value });
    const m = (v) => U.money(v, settings.currency, settings.locale);
    $('plSheet').replaceChildren(h('article', { class: 'doc-sheet' },
      g.SlopBiz.sheet.head(settings, 'Price list', [`Date ${S.ledger.today()}`, `Prices in ${settings.currency}`]),
      shown.length ? h('div', { class: 'sheet-scroll' }, h('table', { class: 'grid-t' },
        h('thead', null, h('tr', null, ['SKU', 'Product', 'Unit', 'Price', 'Tax', 'With tax'].map((x, i) => h('th', { class: i >= 3 ? 'num' : '', text: x })))),
        h('tbody', null, shown.map((p) => h('tr', null, h('td', { class: 'mono', text: p.sku }), h('td', { text: p.name }), h('td', { text: p.unit }),
          h('td', { class: 'num', text: m(p.price) }), h('td', { class: 'num', text: `${(p.taxRate / 100).toFixed(p.taxRate % 100 ? 2 : 0)}%` }), h('td', { class: 'num', text: m(p.gross) }))))))
        : h('p', { class: 'note', text: $('plSearch').value ? 'No product matches the search.' : 'No products yet. Add them on the Products tab.' }),
      h('p', { class: 'note', text: 'Prices with tax use each product’s own tax rate.' })));
    $('plCount').textContent = `${shown.length} product${shown.length === 1 ? '' : 's'}`;
  }

  /** Downloads what is shown as CSV. */
  function downloadCsv() {
    const text = NS.pricelist.csv(shown, (v) => S.money.plainMinor(v, settings.currency));
    g.SlopUI.download(new Blob([text], { type: 'text/csv' }), `price-list-${S.ledger.today()}.csv`);
  }

  /** The view's toolbar (search, Print, Download CSV, the count) and the sheet's place, built here to keep the page short. */
  function mount() {
    $('view-prices').replaceChildren(
      h('div', { class: 'toolbar no-print' },
        h('label', { class: 'search' }, h('span', { class: 'sr', text: 'Search the price list' }),
          h('input', { id: 'plSearch', type: 'search', placeholder: 'Search SKU, name or EAN', autocomplete: 'off' })),
        h('button', { type: 'button', class: 'btn primary', id: 'plPrint', text: 'Print…' }),
        h('button', { type: 'button', class: 'btn', id: 'plCsv', text: 'Download CSV' }),
        h('span', { class: 'note', id: 'plCount' })),
      h('div', { id: 'plSheet' }));
    $('plSearch').addEventListener('input', refresh);
    $('plPrint').addEventListener('click', () => g.print());
    $('plCsv').addEventListener('click', downloadCsv);
  }

  NS.views = NS.views || {};
  NS.views.prices = { mount, refresh, onShow: refresh };
  NS.prices = { refresh, downloadCsv, shown: () => shown };
})(typeof window !== 'undefined' ? window : globalThis);
