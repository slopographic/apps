// Reorder: a new purchase order filled in for one product (from Slop Inventory's low-stock list, #reorder/<product id>): the
// supplier and buying price it was last bought at, and the quantity that brings it back above its reorder level, less what is
// already on order (SlopData.purchases.lastBought and suggestQty). It is a draft with unsaved changes; nothing is stored
// until it is saved.
(function (g) {
  'use strict';
  const S = g.SlopData;
  const NS = (g.SlopPurchases = g.SlopPurchases || {});
  const M = g.SlopDocs.model;

  /** Opens the editor on a new purchase order for productId, filled in. */
  async function open(productId) {
    const ed = NS.editor;
    if (!(await ed.open(null))) return false;
    const [p, moves, pos] = await Promise.all([S.store.get('products', productId), S.store.list('stockMovements', { index: 'productId', value: productId }), S.store.list('purchases')]);
    if (!p.ok || !p.value) { ed.note('That product no longer exists.'); return false; }
    const prod = p.value, all = pos.ok ? pos.value : [];
    const onHand = moves.ok ? S.stock.onHandOf(moves.value, productId) : 0;
    const qty = S.purchases.suggestQty(prod.reorderLevel, onHand, S.purchases.onOrder(all).get(productId) || 0);
    const last = S.purchases.lastBought(all, productId);
    const st = ed.live();
    const line = M.newLine(prod, st.defaultTaxRate);
    st.lines = [{ ...line, qty, unitPrice: last ? last.unitPrice : line.unitPrice, taxRate: last ? last.taxRate : line.taxRate }];
    if (last && st.customers.some((c) => c.id === last.supplierId)) st.customerId = last.supplierId;
    ed.edited(last ? '' : 'Choose the supplier, and check the buying price: it starts at the selling price.');
    ed.setMsg(`${qty} × ${prod.name}: ${onHand} on hand${prod.reorderLevel ? `, reorder at ${prod.reorderLevel}` : ''}.${last ? ' Supplier and price as last time.' : ' Choose the supplier and check the price.'}`);
    return true;
  }

  NS.reorder = { open };
})(typeof window !== 'undefined' ? window : globalThis);
