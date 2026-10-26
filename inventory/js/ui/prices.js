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
  const t = (k, v) => (g.SlopI18n ? g.SlopI18n.t(k, v) : k);
  // The price list itself is a document the person prints or sends: its own words stay the document's (i18n-ignore below)

  async function refresh() {
    settings = await U.settings();
    const r = await S.store.list('products');
    shown = NS.pricelist.rows(r.ok ? r.value : [], { search: $('plSearch').value });
    const m = (v) => U.money(v, settings.currency, settings.locale);
    $('plSheet').replaceChildren(h('article', { class: 'doc-sheet' },
      g.SlopBiz.sheet.head(settings, 'Price list', [`Date ${S.ledger.today()}`, `Prices in ${settings.currency}`]),   // i18n-ignore: the printed price list stays the document's words
      shown.length ? h('div', { class: 'sheet-scroll' }, h('table', { class: 'grid-t' },
        h('thead', null, h('tr', null, ['SKU', 'Product', 'Unit', 'Price', 'Tax', 'With tax'].map((x, i) => h('th', { class: i >= 3 ? 'num' : '', text: x })))),   // i18n-ignore: the printed price list stays the document's words
        h('tbody', null, shown.map((p) => h('tr', null, h('td', { class: 'mono', text: p.sku }), h('td', { text: p.name }), h('td', { text: p.unit }),
          h('td', { class: 'num', text: m(p.price) }), h('td', { class: 'num', text: `${(p.taxRate / 100).toFixed(p.taxRate % 100 ? 2 : 0)}%` }), h('td', { class: 'num', text: m(p.gross) }))))))
        : h('p', { class: 'note', text: $('plSearch').value ? 'No product matches the search.' : 'No products yet. Add them on the Products tab.' }),   // i18n-ignore: the printed price list stays the document's words
      h('p', { class: 'note', text: 'Prices with tax use each product’s own tax rate.' })));   // i18n-ignore: the printed price list stays the document's words
    $('plCount').textContent = t('inventory.pl.count', { n: shown.length });
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
        h('label', { class: 'search' }, h('span', { class: 'sr', text: t('inventory.pl.search') }),
          h('input', { id: 'plSearch', type: 'search', placeholder: t('inventory.pl.search_ph'), autocomplete: 'off' })),
        h('button', { type: 'button', class: 'btn primary', id: 'plPrint', text: t('inventory.pl.print') }),   // i18n-ignore: CSS class names
        h('button', { type: 'button', class: 'btn', id: 'plCsv', text: t('inventory.pl.csv') }),
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
