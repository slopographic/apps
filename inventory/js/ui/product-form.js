// Product add and edit dialog. The data layer validates every value; this shows its errors beside the fields.
// Price and tax rate are typed as plain decimals and converted with money.parseMinor (never through floats).
(function (g) {
  'use strict';
  const S = g.SlopData;
  const NS = (g.SlopInv = g.SlopInv || {});
  const U = NS.util;
  const UI = g.SlopUI;
  const { h } = U;

  /** One labelled row: the control, a hint, and an error line that the save fills in. */
  function fieldRow(label, control, hint) {
    const msg = h('span', { class: 'ferr', role: 'alert' });
    const row = h('label', { class: 'frow' }, h('span', { class: 'flabel', text: label }), control,
      hint ? h('span', { class: 'fhint', text: hint }) : null, msg);
    return { row, control, msg };
  }

  /** Opens the dialog. opts: { product? (edit), sku?, ean? (prefill for a new product), onSaved?(product) }. */
  async function open(opts = {}) {
    const st = await U.settings();
    const p = opts.product || null;
    const input = (attrs) => h('input', { class: 'sui-input', autocomplete: 'off', spellcheck: 'false', ...attrs });
    const fields = {
      sku: fieldRow('SKU', input({ value: p ? p.sku : opts.sku || '', maxlength: 80 }), 'Short code, no spaces. Must be unique.'),
      ean: fieldRow('EAN', input({ value: p ? p.ean || '' : opts.ean || '', inputmode: 'numeric', maxlength: 18 }), 'Optional barcode. Its check digit is checked.'),
      name: fieldRow('Name', input({ value: p ? p.name : '', maxlength: 200 })),
      price: fieldRow('Price', input({ value: p ? U.majorText(p.price, st.currency) : '', inputmode: 'decimal' }), `Amount in ${st.currency}, before tax.`),
      taxRate: fieldRow('Tax rate %', input({ value: U.percentText(p ? p.taxRate : st.defaultTaxRate), inputmode: 'decimal' }), 'For example 20, or 7.5.'),
      unit: fieldRow('Unit', input({ value: p ? p.unit || 'each' : 'each', maxlength: 20 })),
      reorderLevel: fieldRow('Reorder level', input({ value: p && p.reorderLevel !== undefined ? String(p.reorderLevel) : '', type: 'number', min: 0, step: 1, inputmode: 'numeric' }),
        'Alert when on hand is at or below this. Blank means no alert.'),
    };
    const form = h('form', { class: 'pform', novalidate: true, onsubmit: (e) => e.preventDefault() }, Object.values(fields).map((f) => f.row));
    const top = h('p', { class: 'form-error', role: 'alert' });
    const clear = () => { top.textContent = ''; for (const f of Object.values(fields)) f.msg.textContent = ''; };
    const showErrors = (r) => {
      let general = true;
      for (const e of r.errors || []) {
        if (fields[e.field]) { fields[e.field].msg.textContent = e.message; general = false; }
      }
      if (r.code === 'conflict') {
        const key = /ean/i.test(r.message) ? 'ean' : 'sku';
        fields[key].msg.textContent = r.message;
        general = false;
      }
      if (general) top.textContent = U.refusal(r);
    };

    async function save() {
      clear();
      const rec = { ...(p || {}) };
      const price = S.money.parseMinor(fields.price.control.value, st.currency);
      const tax = S.money.parseMinor(fields.taxRate.control.value, 'USD');
      const reorderText = fields.reorderLevel.control.value.trim();
      const reorder = reorderText === '' ? undefined : U.wholeOf(reorderText);
      let bad = false;
      const flag = (k, text) => { fields[k].msg.textContent = text; bad = true; };
      if (fields.price.control.value.trim() === '') flag('price', 'is required');
      else if (price === null) flag('price', 'use a plain amount such as 12.50');
      if (tax === null || tax < 0 || tax > 10000) flag('taxRate', 'use a percentage from 0 to 100, with at most two decimals');
      if (reorderText !== '' && (!Number.isSafeInteger(reorder) || reorder < 0)) flag('reorderLevel', 'must be a whole number of zero or more');
      if (bad) { top.textContent = 'Not saved. Fix the fields marked above.'; return false; }
      Object.assign(rec, {
        sku: fields.sku.control.value, ean: fields.ean.control.value, name: fields.name.control.value,
        price, taxRate: tax, unit: fields.unit.control.value, reorderLevel: reorder,
      });
      const r = await NS.products.save(rec);
      if (!r.ok) { showErrors(r); return false; }
      if (opts.onSaved) opts.onSaved(r.value);
      if (UI && UI.toast) UI.toast(p ? 'Product saved' : `Created ${r.value.sku}`);
      return true;
    }

    const body = h('div', null, form, top);
    SlopFormReset.snapshot(body);
    UI.dialog({
      title: p ? 'Edit product' : 'New product',
      body,
      buttons: [{ label: 'Cancel' }, SlopFormReset.dialogButton(body), { label: p ? 'Save' : 'Create product', primary: true, act: save }],
    });
    setTimeout(() => fields[p ? 'name' : 'sku'].control.focus(), 30);
  }

  NS.productForm = { open };
})(typeof window !== 'undefined' ? window : globalThis);
