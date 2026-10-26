// Company profile: name, address, tax number, default currency, locale and default tax rate. The record is the shared
// settings (SlopData). The default currency is the ledger's base, so it is refused once any journal entry exists.
(function (g) {
  'use strict';
  const S = g.SlopData;
  const NS = (g.SlopAdmin = g.SlopAdmin || {});
  const { ok, fail } = S.result;

  /** Checks the typed profile and returns the record to store, or a failed Result that names the field. */
  function checked(cur, input) {
    const t = (k) => (g.SlopI18n ? g.SlopI18n.t(k) : k);
    const cc = String(input.defaultCurrency || '').trim().toUpperCase();
    if (!S.locale.isCurrency(cc) || !S.locale.currencies().includes(cc)) return fail('invalid', t('admin.core.currency'));
    const loc = S.locale.canonicalLocale(String(input.locale || '').trim());
    if (!loc) return fail('invalid', t('admin.core.locale'));
    const rate = S.money.parseMinor(String(input.defaultTaxRate ?? '').trim() || '0', 'USD');
    if (rate === null || rate < 0 || rate > 10000) return fail('invalid', t('admin.core.rate'));
    return ok({ ...cur, companyName: input.companyName, address: input.address, taxNumber: input.taxNumber,
      defaultCurrency: cc, locale: loc, defaultTaxRate: rate });
  }

  /** Saves the profile. A refused currency change keeps the old one and says why. */
  async function save(input) {
    const cur = await S.store.get('settings', 'main');
    if (!cur.ok) return cur;
    const base = cur.value || { ...S.schemaDefs.DEFAULT_SETTINGS };
    const rec = checked(base, input);
    if (!rec.ok) return rec;
    return S.store.put('settings', rec.value);
  }

  /** The profile as text for the form (tax rate as a percentage). */
  function asForm(s) {
    return { companyName: s.companyName || '', address: s.address || '', taxNumber: s.taxNumber || '',
      defaultCurrency: s.defaultCurrency || 'USD', locale: s.locale || 'en-US',
      defaultTaxRate: String((s.defaultTaxRate || 0) / 100) };
  }

  NS.profile = { save, checked, asForm };
})(typeof window !== 'undefined' ? window : globalThis);
