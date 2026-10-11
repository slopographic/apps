// Products view: search, sort, low-stock filter, the product rows, and the row menu (edit, show movements, delete).
(function (g) {
  'use strict';
  const S = g.SlopData;
  const NS = (g.SlopInv = g.SlopInv || {});
  const U = NS.util;
  const UI = g.SlopUI;
  const $ = (id) => document.getElementById(id);
  let rows = [];

  const COMPARE = {
    name: (a, b) => a.name.localeCompare(b.name),
    sku: (a, b) => a.sku.localeCompare(b.sku),
    onHand: (a, b) => a.onHand - b.onHand,
    price: (a, b) => a.price - b.price,
  };

  function rowEl(r, st) {
    return U.h('div', { class: 'row' + (r.low ? ' is-low' : ''), role: 'row', tabindex: 0, dataset: { id: r.id } },
      U.h('span', { role: 'cell', class: 'c-name' }, U.h('b', { class: 'mono', text: r.sku }), U.h('span', { class: 'sub', text: r.name })),
      U.h('span', { role: 'cell', class: 'mono', 'data-label': 'EAN', text: r.ean || '—' }),
      U.h('span', { role: 'cell', 'data-label': 'Price', text: U.money(r.price, st.currency, st.locale) }),
      U.h('span', { role: 'cell', 'data-label': 'Tax', text: `${U.percentText(r.taxRate)}%` }),
      U.h('span', { role: 'cell', class: 'num', 'data-label': 'On hand', text: `${r.onHand} ${r.unit}` }, r.low ? U.h('span', { class: 'badge warn', text: 'Low' }) : null),
      U.h('span', { role: 'cell', 'data-label': 'Reorder', text: r.reorderLevel === undefined ? '—' : String(r.reorderLevel) }));
  }

  /** Redraws the rows from the last read, applying the search, filter and sort. */
  function draw() {
    const st = NS.state.settings || { currency: 'USD', locale: 'en-US' };
    const q = $('pSearch').value.trim().toLowerCase();
    const filter = $('pFilter').value;
    const list = rows
      .filter((r) => (!q || [r.sku, r.ean, r.name].some((x) => String(x).toLowerCase().includes(q))))
      .filter((r) => filter !== 'low' || r.low)
      .sort(COMPARE[$('pSort').value] || COMPARE.name);
    $('pRows').replaceChildren(...list.map((r) => rowEl(r, st)));
    $('pEmpty').hidden = list.length > 0;
    const t = NS.rows.totalsOf(rows);
    $('pSummary').textContent = `${U.plural(t.products, 'product')} · ${t.low} at or below reorder level · stock value ${U.money(t.value, st.currency, st.locale)} · showing ${list.length}`;
  }

  async function refresh() {
    const r = await NS.rows.stockRows();
    if (!r.ok) { $('pSummary').textContent = U.refusal(r); return; }
    rows = r.value;
    draw();
  }

  async function openEdit(id) {
    const r = await S.store.get('products', id);
    if (!r.ok || !r.value) { if (UI) UI.toast(r.ok ? 'That product no longer exists' : U.refusal(r)); return; }
    NS.productForm.open({ product: r.value, onSaved: () => NS.app.refresh() });
  }

  async function remove(id) {
    const r = await S.store.get('products', id);
    if (!r.ok || !r.value) return;
    const name = r.value.name;
    const yes = await UI.confirm('Delete product', `Delete ${name}? This cannot be undone.`, 'Delete', { danger: true });
    if (!yes) return;
    const d = await NS.products.remove(id);
    if (!d.ok) { UI.alert('Not deleted', `${name} cannot be deleted: ${d.message}.`); return; }
    UI.toast(`Deleted ${name}`);
    NS.app.refresh();
  }

  function mount() {
    $('pSearch').addEventListener('input', draw);
    $('pSort').addEventListener('change', draw);
    $('pFilter').addEventListener('change', draw);
    $('pAdd').addEventListener('click', () => NS.productForm.open({ onSaved: () => NS.app.refresh() }));
    const box = $('pRows');
    box.addEventListener('click', (e) => { const row = e.target.closest('[data-id]'); if (row) openEdit(row.dataset.id); });
    box.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter') return;
      const row = e.target.closest('[data-id]');
      if (row) openEdit(row.dataset.id);
    });
    if (g.SlopCtx) {
      SlopCtx.bind(box, (target) => {
        const row = target && target.closest ? target.closest('[data-id]') : null;
        if (!row) return null;
        const id = row.dataset.id;
        return [
          { label: 'Edit product', act: () => openEdit(id) },
          { label: 'Show movements', act: () => NS.app.show('stock', id) },
          '-',
          { label: 'Delete product', act: () => remove(id) },
        ];
      });
    }
  }

  NS.views = NS.views || {};
  NS.views.products = { mount, refresh, draw, openEdit, remove, onShow: () => refresh() };
})(typeof window !== 'undefined' ? window : globalThis);
