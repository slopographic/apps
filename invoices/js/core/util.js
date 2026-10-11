// Slop Invoices: shared helpers for the UI and the tests. Classic script, loaded after shared/data. Exposes window.SlopInvoices.util.
// Nothing here stores anything; it formats, parses and explains.
(function (g) {
  'use strict';
  const S = g.SlopData;
  const NS = (g.SlopInvoices = g.SlopInvoices || {});

  // Plain words for each refusal code. The data layer's own message follows after a colon.
  const PLAIN = {
    has_payments: 'Cannot void: this invoice has payments',
    overpayment: 'Payment is more than the balance due',
    invalid_transition: 'That change is not allowed for this invoice',
    not_found: 'That record no longer exists',
    conflict: 'Already done',
    invalid: 'Not saved',
    immutable: 'This record cannot be changed',
    posting_required: 'Status changes go through issue, payment and void only',
    blocked: 'Blocked by another tab',
    unavailable: 'Storage is not available in this browser',
  };
  const FIELD = { customerId: 'Customer', date: 'Date', dueDate: 'Due date', lines: 'Lines', notes: 'Notes', currency: 'Currency', amount: 'Amount' };

  /** One readable line for a failed Result. */
  function refusal(r) {
    if (!r) return 'Something went wrong';
    if (Array.isArray(r.errors) && r.errors.length) {
      return r.errors.map((e) => (e.field ? `${FIELD[e.field] || e.field} ${e.message}` : e.message)).join('. ');
    }
    const head = PLAIN[r.code];
    if (head) return r.message ? `${head}: ${r.message}` : head;
    return r.message || 'Something went wrong';
  }

  /** Settings the app needs: company name and address, currency, locale, payment terms and default tax rate. */
  async function settings() {
    const r = await S.store.get('settings', 'main');
    const s = r.ok && r.value ? r.value : S.schema.DEFAULT_SETTINGS;
    return {
      currency: s.defaultCurrency || 'USD', locale: s.locale || 'en-US', defaultTaxRate: s.defaultTaxRate || 0,
      paymentTermsDays: s.paymentTermsDays ?? 30, companyName: s.companyName || '', address: s.address || '', taxNumber: s.taxNumber || '',
    };
  }

  /** Money for display only (Intl formatting of an integer amount). */
  const money = (minor, currency, locale) => S.money.formatMinor(minor, currency, locale);

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

  NS.util = { PLAIN, FIELD, refusal, settings, money, h, ok: S.result.ok, fail: S.result.fail };
})(typeof window !== 'undefined' ? window : globalThis);
