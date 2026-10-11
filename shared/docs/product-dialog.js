// "New product" from inside an order or an invoice line: a small dialog that stores a product through SlopData.store
// and hands the record back to the caller. Classic script, uses SlopUI. Exposes window.SlopDocs.productDialog.
(function (g) {
  'use strict';
  const S = g.SlopData;
  const NS = (g.SlopDocs = g.SlopDocs || {});

  /** Small DOM builder (same as customer-dialog.js). */
  function h(tag, attrs, ...kids) {
    const e = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs || {})) {
      if (v === false || v === null || v === undefined) continue;
      if (k === 'class') e.className = v;
      else if (k === 'text') e.textContent = v;
      else if (v === true) e.setAttribute(k, '');
      else e.setAttribute(k, String(v));
    }
    for (const c of kids.flat()) if (c !== null && c !== undefined && c !== false) e.append(c instanceof Node ? c : document.createTextNode(String(c)));
    return e;
  }

  /** Opens the dialog. onSaved(record) runs after the product is stored. opts.currency sets how the price is read. */
  function open(onSaved, opts) {
    // Read at open time: this script can load before shared/slopui.js.
    const UI = g.SlopUI;
    const currency = (opts && opts.currency) || 'USD';
    const sku = h('input', { type: 'text', maxlength: 80, autocomplete: 'off' });
    const name = h('input', { type: 'text', maxlength: 200, autocomplete: 'off' });
    const price = h('input', { type: 'text', inputmode: 'decimal', maxlength: 20, autocomplete: 'off', placeholder: '0.00' });
    const tax = h('input', { type: 'text', inputmode: 'decimal', maxlength: 6, autocomplete: 'off', value: '0' });
    const unit = h('input', { type: 'text', maxlength: 20, autocomplete: 'off', value: 'each' });
    const msg = h('p', { class: 'msg bad', role: 'status' });
    const body = h('div', null,
      UI.field('SKU', sku), UI.field('Name', name), UI.field(`Price (${currency})`, price),
      UI.field('Tax %', tax), UI.field('Unit', unit), msg);
    UI.dialog({
      title: 'New product',
      body,
      buttons: [
        { label: 'Cancel' },
        {
          label: 'Add product', primary: true,
          act: async () => {
            const code = sku.value.trim(), n = name.value.trim();
            if (!code || !/^\S+$/.test(code)) { msg.textContent = 'SKU is required, with no spaces.'; return false; }
            if (!n) { msg.textContent = 'Name is required.'; return false; }
            const amount = g.SlopData.money.parseMinor(price.value.trim(), currency);
            if (amount === null || amount < 0) { msg.textContent = 'Enter a price such as 12.50.'; return false; }
            const rate = NS.model.bpFromPercent(tax.value.trim() || '0');
            if (rate === null || rate === undefined) { msg.textContent = 'Enter a tax % such as 20.'; return false; }
            const r = await S.store.put('products', { sku: code, name: n, price: amount, taxRate: rate, unit: unit.value.trim() || 'each' });
            if (!r.ok) { msg.textContent = r.message || 'Not saved. The SKU may already be used.'; return false; }
            UI.toast(`Added ${n}`);
            onSaved(r.value);
            return undefined;
          },
        },
      ],
    });
    setTimeout(() => sku.focus(), 30);
  }

  NS.productDialog = { open };
})(typeof window !== 'undefined' ? window : globalThis);
