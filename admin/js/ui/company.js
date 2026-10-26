// The Company tab: the profile form (name, address, tax number, default currency, locale, default tax rate), and a
// pointer to Slop Inventory, where the product catalogue is kept (it is not copied here).
(function (g) {
  'use strict';
  const NS = (g.SlopAdmin = g.SlopAdmin || {});
  const UI = g.SlopUI;
  const el = UI.el;
  const $ = (id) => document.getElementById(id);
  const t = (k, v) => (g.SlopI18n ? g.SlopI18n.t(k, v) : k);

  async function render() {
    if (document.activeElement && document.activeElement.closest && document.activeElement.closest('#cForm')) return;
    const s = await NS.util.settings();
    const f = NS.profile.asForm(s);
    $('cName').value = f.companyName;
    $('cAddress').value = f.address;
    $('cTax').value = f.taxNumber;
    $('cCur').value = f.defaultCurrency;
    $('cLocale').value = f.locale;
    $('cRate').value = f.defaultTaxRate;
  }

  async function save() {
    $('cMsg').textContent = '';
    const r = await NS.profile.save({ companyName: $('cName').value, address: $('cAddress').value, taxNumber: $('cTax').value,
      defaultCurrency: $('cCur').value, locale: $('cLocale').value, defaultTaxRate: $('cRate').value });
    if (!r.ok) { $('cMsg').textContent = t('admin.co.not_saved', { why: NS.util.refusal(r) }); return; }
    UI.toast(t('admin.co.saved'));
  }

  function mount() {
    $('cCurList').replaceChildren(...g.SlopData.locale.currencies().map((c) => el('option', { value: c })));
    $('cSave').addEventListener('click', save);
  }

  NS.views = NS.views || {};
  NS.views.company = { mount, render };
})(typeof window !== 'undefined' ? window : globalThis);
