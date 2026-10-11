// Opt-in ECB reference rates. Nothing is fetched unless the 'rates' consent category is on, and the check
// runs on every call. Nothing runs in the background: updateRates() is started by the Settings button, and
// updateOnOpen() only runs when the person also ticked "Update on open" (a setting in the record).
// The XML is parsed with DOMParser and never evaluated. Rows are EUR-based, one per currency, source 'ecb'.
(function (g) {
  'use strict';
  const ns = (g.SlopData = g.SlopData || {});
  const { ok, fail } = ns.result;
  const ECB_URL = 'https://www.ecb.europa.eu/stats/eurofxref/eurofxref-daily.xml';
  const ECB_HOST = 'www.ecb.europa.eu';
  const ECB_BASE = 'EUR';

  /** True when the visitor has turned on the 'rates' category in Settings. Missing consent state means off. */
  function consentAllowed() {
    try { return !!(g.SlopConsentState && g.SlopConsentState.current().rates); } catch (e) { return false; }
  }

  /** Pure given a DOMParser: { date (the ECB reference day), rates: [{ quote, rate }] } with rate scaled by 1e6. */
  function parseEcb(text, Parser) {
    if (typeof text !== 'string' || !text.trim()) return fail('invalid', 'The file from the ECB is empty.');
    if (typeof Parser !== 'function') return fail('unavailable', 'This browser cannot read XML, so no rates were read.');
    let doc = null;
    try { doc = new Parser().parseFromString(text, 'application/xml'); } catch (e) { doc = null; }
    if (!doc || doc.getElementsByTagName('parsererror').length) return fail('invalid', 'The file from the ECB could not be read.');
    const cubes = Array.from(doc.getElementsByTagName('Cube'));
    const dateCube = cubes.find((c) => c.getAttribute('time'));
    const date = dateCube ? dateCube.getAttribute('time') : '';
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return fail('invalid', 'The file from the ECB has no reference date.');
    const rates = [];
    for (const c of cubes) {
      const quote = c.getAttribute('currency');
      if (!quote) continue;
      const rate = ns.locale.parseRate(c.getAttribute('rate'));
      if (!ns.locale.isCurrency(quote) || rate === null) return fail('invalid', `The file from the ECB has a bad rate for ${quote}.`);
      rates.push({ quote, rate });
    }
    return rates.length ? ok({ date, rates }) : fail('invalid', 'The file from the ECB has no rates.');
  }

  /** Stores one row per quote for `today` inside one transaction. A same-day row with the same rate is left alone. */
  function storeToday(parsed, today) {
    return ns.store.transact(async (tx) => {
      const all = await tx.list('exchangeRates');
      if (!all.ok) return all;
      const out = { date: today, referenceDate: parsed.date, added: [], unchanged: [] };
      for (const { quote, rate } of parsed.rates) {
        const hit = ns.fx.pickRate(all.value, ECB_BASE, quote, today);
        if (hit && !hit.inverted && hit.row.date === today && hit.row.source === 'ecb' && hit.rate === rate) { out.unchanged.push(quote); continue; }
        const prev = hit && !hit.inverted ? hit.rate : null;
        const w = await tx.put('exchangeRates', { base: ECB_BASE, quote, date: today, rate, source: 'ecb', note: `ECB reference ${parsed.date}` });
        if (!w.ok) return w;
        out.added.push({ quote, rate, previous: prev });
      }
      return ok(out);
    });
  }

  /** Downloads and stores the ECB rates. opts (for tests): fetch, allowed, DOMParser, today.
   *  Nothing is fetched while consent is off. A failed download stores nothing and says so. */
  async function updateRates(opts = {}) {
    if (!(opts.allowed || consentAllowed)()) return fail('consent_off', 'Exchange rate updates are off. Turn on Exchange rates in Settings first.');
    const f = opts.fetch || g.fetch;
    if (typeof f !== 'function') return fail('unavailable', 'This browser cannot download the rates. No rates were stored.');
    let text;
    try {
      const res = await f(ECB_URL, { cache: 'no-store', credentials: 'omit', referrerPolicy: 'no-referrer' });
      if (!res || !res.ok) return fail('http', `The European Central Bank did not answer (${res ? res.status : 'no response'}). No rates were stored.`);
      text = await res.text();
    } catch (e) {
      return fail('network', 'Could not reach the European Central Bank. No rates were stored.');
    }
    const parsed = parseEcb(text, opts.DOMParser || g.DOMParser);
    if (!parsed.ok) return fail(parsed.code, `${parsed.message} No rates were stored.`);
    return storeToday(parsed.value, opts.today || ns.ledger.today());
  }

  /** Runs updateRates() only when the person ticked "Update on open" and the rates category is on. */
  async function updateOnOpen(opts = {}) {
    const s = await ns.store.get('settings', 'main');
    if (!s.ok || !s.value || !s.value.ratesUpdateOnOpen) return ok({ skipped: 'off' });
    if (!(opts.allowed || consentAllowed)()) return ok({ skipped: 'consent' });
    return updateRates(opts);
  }

  ns.rates = { ECB_URL, ECB_HOST, ECB_BASE, consentAllowed, parseEcb, storeToday, updateRates, updateOnOpen };
})(typeof window !== 'undefined' ? window : globalThis);
