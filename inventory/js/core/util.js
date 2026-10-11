// Slop Inventory: shared helpers. Classic script, loaded after shared/data. Exposes window.SlopInv.util.
// Nothing here stores anything; it formats, parses and explains.
(function (g) {
  'use strict';
  const S = g.SlopData;
  const NS = (g.SlopInv = g.SlopInv || {});

  // Plain words for each refusal code. The data layer's own message follows in brackets.
  const PLAIN = {
    insufficient_stock: 'Refused: this would take stock below zero',
    in_use: 'Cannot delete',
    conflict: 'Another product already uses that SKU or EAN',
    not_found: 'That item no longer exists',
    invalid: 'Not saved',
    immutable: 'Stock history cannot be changed',
    posting_required: 'Stock changes go through the stock rules only',
    blocked: 'Blocked by another tab',
    unavailable: 'Storage is not available in this browser',
  };
  const FIELD = { sku: 'SKU', ean: 'EAN', name: 'Name', price: 'Price', taxRate: 'Tax rate', unit: 'Unit', reorderLevel: 'Reorder level', description: 'Description' };

  /** One readable line for a failed Result. */
  function refusal(r) {
    if (!r) return 'Something went wrong';
    if (Array.isArray(r.errors) && r.errors.length) {
      return r.errors.map((e) => (e.field ? `${FIELD[e.field] || e.field} ${e.message}` : e.message)).join('. ');
    }
    const head = PLAIN[r.code];
    if (head) return r.message ? `${head} (${r.message})` : head;
    return r.message || 'Something went wrong';
  }

  /** Store settings the inventory needs: currency, locale and the default tax rate for new products. */
  async function settings() {
    const r = await S.store.get('settings', 'main');
    const s = r.ok && r.value ? r.value : S.schema.DEFAULT_SETTINGS;
    return { currency: s.defaultCurrency || 'USD', locale: s.locale || 'en-US', defaultTaxRate: s.defaultTaxRate || 0 };
  }

  /** Money for display only (Intl formatting of an integer amount). */
  const money = (minor, currency, locale) => S.money.formatMinor(minor, currency, locale);

  /** Minor units as plain text with the currency's decimals, such as 1250 -> "12.50". Round-trips with parseMinor. */
  function majorText(minor, currency) {
    const d = S.money.digits(currency);
    const neg = minor < 0;
    const s = String(Math.abs(minor)).padStart(d + 1, '0');
    const body = d ? `${s.slice(0, -d)}.${s.slice(-d)}` : s;
    return (neg ? '-' : '') + body;
  }

  /** A basis-point rate as text: 2000 -> "20.00". */
  const percentText = (bp) => majorText(bp, 'USD');

  /** A whole number from typed text, or NaN. */
  function wholeOf(v) {
    const t = String(v ?? '').trim();
    return /^-?\d+$/.test(t) ? Number(t) : NaN;
  }

  /** A location name as typed, or 'main' when blank. */
  const cleanLocation = (v) => String(v ?? '').trim().slice(0, 40) || 'main';

  /** Small DOM builder: h('a', { class, href, onclick, dataset }, 'text', child). Text children are escaped by the DOM. */
  function h(tag, attrs, ...kids) {
    const e = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs || {})) {
      if (v === false || v === null || v === undefined) continue;
      if (k === 'class') e.className = v;
      else if (k === 'text') e.textContent = v;
      else if (k.startsWith('on') && typeof v === 'function') e.addEventListener(k.slice(2), v);
      else if (k === 'dataset') Object.assign(e.dataset, v);
      else if (v === true) e.setAttribute(k, '');
      else e.setAttribute(k, String(v));
    }
    for (const c of kids.flat()) {
      if (c === null || c === undefined || c === false) continue;
      e.append(c instanceof Node ? c : document.createTextNode(String(c)));
    }
    return e;
  }

  const plural = (n, one, many = one + 's') => `${n} ${n === 1 ? one : many}`;
  const stamp = (ms) => new Date(ms).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

  NS.util = { PLAIN, FIELD, refusal, settings, money, majorText, percentText, wholeOf, cleanLocation, h, plural, stamp, ok: S.result.ok, fail: S.result.fail };
})(typeof window !== 'undefined' ? window : globalThis);
