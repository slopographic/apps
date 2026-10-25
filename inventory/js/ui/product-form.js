// The product form: the products view's right panel (shared/biz/panel.js, set up in ui/app.js), "New product" until a
// product is opened for editing; Create product / Save at the panel's foot, Cancel back to a new one. On a phone the panel
// is a bottom sheet that opens with the form. The data layer validates every value; its errors show beside the fields.
// Price and tax rate are typed as plain decimals and converted with money.parseMinor (never through floats).
(function (g) {
  'use strict';
  const S = g.SlopData;
  const NS = (g.SlopInv = g.SlopInv || {});
  const U = NS.util;
  const UI = g.SlopUI;
  const { h } = U;
  const $ = (id) => document.getElementById(id);
  let fields = null, opts = {}, st = { currency: 'USD', defaultTaxRate: 0 };

  /** One labelled row: the control, a hint, and an error line that the save fills in. */
  function fieldRow(label, control, hint) {
    const msg = h('span', { class: 'ferr', role: 'alert' });
    const tip = hint != null ? h('span', { class: 'fhint', text: hint }) : null;
    const row = h('label', { class: 'frow' }, h('span', { class: 'flabel', text: label }), control, tip, msg);
    return { row, control, msg, tip };
  }

  /** Builds the fields once, into the form in the page. */
  function build() {
    const input = (attrs) => h('input', { class: 'sui-input', autocomplete: 'off', spellcheck: 'false', ...attrs });
    fields = {
      sku: fieldRow('SKU', input({ maxlength: 80 }), 'Short code, no spaces. Must be unique.'),
      ean: fieldRow('EAN', input({ inputmode: 'numeric', maxlength: 18 }), 'Optional barcode. Its check digit is checked.'),
      name: fieldRow('Name', input({ maxlength: 200 })),
      price: fieldRow('Price', input({ inputmode: 'decimal' }), ''),
      taxRate: fieldRow('Tax rate %', input({ inputmode: 'decimal' }), 'For example 20, or 7.5.'),
      unit: fieldRow('Unit', input({ maxlength: 20 })),
      reorderLevel: fieldRow('Reorder level', input({ type: 'number', min: 0, step: 1, inputmode: 'numeric' }), 'Alert when on hand is at or below this. Blank means no alert.'),
    };
    $('pFields').replaceChildren(...Object.values(fields).map((f) => f.row));
    $('pForm').addEventListener('submit', (e) => { e.preventDefault(); save(); });
    $('pCancel').addEventListener('click', () => open({ show: false }));
  }

  function clear() { $('pFormErr').textContent = ''; for (const f of Object.values(fields)) f.msg.textContent = ''; }
  function showErrors(r) {
    let general = true;
    for (const e of r.errors || []) if (fields[e.field]) { fields[e.field].msg.textContent = e.message; general = false; }
    if (r.code === 'conflict') { fields[/ean/i.test(r.message) ? 'ean' : 'sku'].msg.textContent = r.message; general = false; }
    if (general) $('pFormErr').textContent = U.refusal(r);
  }

  /**
   * Fills the form. opts: { product? (edit), sku?, ean? (prefill for a new product), onSaved?(product), back? (the view to
   * return to once saved, such as 'scan'), show? (false: only reset it, without moving to it) }.
   */
  async function open(o = {}) {
    if (!fields) build();
    opts = o;
    st = await U.settings();
    const p = o.product || null, F = fields;
    F.sku.control.value = p ? p.sku : o.sku || '';
    F.ean.control.value = p ? p.ean || '' : o.ean || '';
    F.name.control.value = p ? p.name : '';
    F.price.control.value = p ? U.majorText(p.price, st.currency) : '';
    F.price.tip.textContent = `Amount in ${st.currency}, before tax.`;
    F.taxRate.control.value = U.percentText(p ? p.taxRate : st.defaultTaxRate);
    F.unit.control.value = p ? p.unit || 'each' : 'each';
    F.reorderLevel.control.value = p && p.reorderLevel !== undefined ? String(p.reorderLevel) : '';
    clear();
    $('pFormTitle').textContent = p ? `Edit ${p.name}` : 'New product';
    $('pSave').textContent = p ? 'Save' : 'Create product';
    $('pCancel').hidden = !p && !o.sku && !o.ean;
    if (o.show === false) return;
    if (NS.state.view !== 'products') await NS.app.show('products');
    const rp = NS.productPanel;
    if (rp && rp.frame && rp.frame.isPhone()) rp.frame.openSheet();
    setTimeout(() => F[p ? 'name' : 'sku'].control.focus(), 40);
  }

  async function save() {
    clear();
    const F = fields, p = opts.product || null, rec = { ...(p || {}) };
    const price = S.money.parseMinor(F.price.control.value, st.currency);
    const tax = S.money.parseMinor(F.taxRate.control.value, 'USD');
    const reorderText = F.reorderLevel.control.value.trim();
    const reorder = reorderText === '' ? undefined : U.wholeOf(reorderText);
    let bad = false;
    const flag = (k, text) => { F[k].msg.textContent = text; bad = true; };
    if (F.price.control.value.trim() === '') flag('price', 'is required');
    else if (price === null) flag('price', 'use a plain amount such as 12.50');
    if (tax === null || tax < 0 || tax > 10000) flag('taxRate', 'use a percentage from 0 to 100, with at most two decimals');
    if (reorderText !== '' && (!Number.isSafeInteger(reorder) || reorder < 0)) flag('reorderLevel', 'must be a whole number of zero or more');
    if (bad) { $('pFormErr').textContent = 'Not saved. Fix the fields marked above.'; return false; }
    Object.assign(rec, { sku: F.sku.control.value, ean: F.ean.control.value, name: F.name.control.value, price, taxRate: tax, unit: F.unit.control.value, reorderLevel: reorder });
    const r = await NS.products.save(rec);
    if (!r.ok) { showErrors(r); return false; }
    const done = opts;
    if (UI && UI.toast) UI.toast(p ? 'Product saved' : `Created ${r.value.sku}`);
    const rp = NS.productPanel;
    if (rp && rp.frame && rp.frame.isPhone()) rp.frame.closeSheet();
    await open({ show: false });   // back to a new product
    if (done.back) await NS.app.show(done.back);
    if (done.onSaved) done.onSaved(r.value);
    else NS.app.refresh();
    return true;
  }

  NS.productForm = { open, save };
})(typeof window !== 'undefined' ? window : globalThis);
