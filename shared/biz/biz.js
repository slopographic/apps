// SlopBiz: the helpers every business app needs on top of SlopData (shared/data): one readable line for a refused
// Result, the settings an app shows (currency, locale, tax, company), money in the person's currency and locale, and the
// expense accounts of the chart, the command wiring and a DOM builder. Every business app uses these (no copies).
// Classic script, loaded after shared/data. Exposes window.SlopBiz (and module.exports for the Node tests).
(function (g) {
  'use strict';
  // Plain words for each refusal code; the data layer's own message follows after a colon. Apps add or override words.
  const PLAIN = {
    invalid: 'Not saved', invalid_transition: 'That change is not allowed', not_found: 'That record no longer exists',
    conflict: 'Already done', immutable: 'This record cannot be changed', posting_required: 'This goes through its own rules only',
    deleted: 'That record was deleted', in_use: 'Still in use', insufficient_stock: 'Not enough stock', overpayment: 'More than is due',
    has_payments: 'It has payments', unbalanced: 'The entry does not balance', quota: 'The browser storage is full',
    blocked: 'Blocked by another tab', unavailable: 'Storage is not available in this browser',
  };

  /** One readable line for a failed Result: the field errors when there are any, else the plain words for its code and the
   *  data layer's message. opts.plain and opts.fields (field id -> label) let an app use its own words; opts.brackets puts the
   *  message in brackets after the words instead of after a colon. */
  function refusal(r, opts = {}) {
    if (!r) return 'Something went wrong';
    const fields = opts.fields || {};
    if (Array.isArray(r.errors) && r.errors.length) {
      return r.errors.map((e) => (e.field ? `${fields[e.field] || e.field} ${e.message}` : e.message)).join('. ');
    }
    const head = (opts.plain || {})[r.code] || PLAIN[r.code];
    if (head) return !r.message ? head : opts.brackets ? `${head} (${r.message})` : `${head}: ${r.message}`;
    return r.message || 'Something went wrong';
  }

  const data = () => g.SlopData;

  /** The settings an app shows: currency, locale, default tax rate, payment terms and the company block. Defaults when nothing
   *  is stored. */
  async function settings() {
    const S = data(), r = await S.store.get('settings', 'main');
    const s = r.ok && r.value ? r.value : S.schema.DEFAULT_SETTINGS;
    return { currency: s.defaultCurrency || 'USD', locale: s.locale || 'en-US', defaultTaxRate: s.defaultTaxRate || 0,
      paymentTermsDays: s.paymentTermsDays ?? 30, companyName: s.companyName || '', address: s.address || '', taxNumber: s.taxNumber || '' };
  }

  /** Minor units as money text in a currency and locale ("€24.00"). */
  const money = (minor, currency, locale) => data().money.formatMinor(minor, currency, locale);

  /** The chart's expense accounts, by code: [{ code, name }]. */
  async function expenseAccounts() {
    const r = await data().store.list('accounts', { index: 'type', value: 'expense' });
    return r.ok ? r.value.map((a) => ({ code: a.code, name: a.name })).sort((a, b) => (a.code < b.code ? -1 : 1)) : [];
  }

  /** An app's commands: registered with SlopCmd (the palette, remappable keys) when the page loads it, and [data-cmd]
   *  elements run them on click. list: [{ id, title, group, keywords, when, run }]. Returns run(id) (true when it ran). */
  function commands(app, own) {
    // every app that keeps records has "Fill with a sample…" (shared/biz/sample.js, loaded when it is first used)
    const list = own.concat([{ id: 'biz.sample', title: 'Data: fill with a sample…', group: 'Data', keywords: ['random', 'example', 'demo', 'seed', 'test data'],
      when: () => !(g.SlopBiz.sample && g.SlopDataAI && g.SlopDataAI.APPS && !g.SlopBiz.sample.kinds(app).length), run: () => sample(app) }]);
    const byId = Object.fromEntries(list.map((c) => [c.id, c]));
    const C = g.SlopCmd;
    if (C) {
      C.init({ app });
      C.register(list.map((c) => ({ id: c.id, title: c.title, group: c.group, keywords: c.keywords || [], keys: [], when: c.when, run: () => c.run() })));
      if (C.provide) C.provide({ prepare: () => assistant(app) });
    }
    function run(id) {
      const c = byId[id];
      if (!c) return false;
      if (C && C.get(id)) return C.run(id);
      if (c.when && !c.when()) return false;
      try { c.run(); } catch (err) { console.error(err); if (g.SlopUI) g.SlopUI.toast(`${c.title} failed: ${err.message}`); }
      return true;
    }
    if (g.document) g.document.addEventListener('click', (e) => {
      const el = e.target.closest && e.target.closest('[data-cmd]');
      if (!el || el.disabled || !byId[el.dataset.cmd]) return;
      e.preventDefault();
      run(el.dataset.cmd);
    });
    return run;
  }

  /** The assistant's record commands (shared/data/ai-records.js, ai-records-apps.js) and the samples (sample.js), loaded
   *  when the AI panel first asks. */
  const HERE = g.document && g.document.currentScript ? g.document.currentScript.src : '';
  const one = (rel) => new Promise((res, rej) => {
    const s = Object.assign(g.document.createElement('script'), { src: new URL(rel, HERE || g.location.href).href, async: false });
    s.onload = res; s.onerror = () => rej(new Error('Could not load ' + rel)); g.document.head.append(s);
  });
  function records() {
    const need = g.SlopDataAI && g.SlopDataAI.APPS ? Promise.resolve() : one('../data/ai-records.js').then(() => one('../data/ai-records-apps.js'));
    return need.then(() => (g.SlopBiz.sample ? null : one('sample.js')));
  }
  function assistant(app) { return records().then(() => g.SlopDataAI.install(app)); }
  /** The "Fill with a sample" dialog (shared/biz/sample.js). */
  function sample(app) { return records().then(() => g.SlopBiz.sample.dialog(app)); }

  /** Small DOM builder: h('a', { class, href, text, dataset, onclick }, 'text', child). Text children are escaped by the DOM. */
  function h(tag, attrs, ...kids) {
    const e = g.document.createElement(tag);
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
      e.append(c instanceof g.Node ? c : g.document.createTextNode(String(c)));
    }
    return e;
  }

  const api = { PLAIN, refusal, settings, money, expenseAccounts, commands, assistant, sampleDialog: sample, h };
  g.SlopBiz = Object.assign(g.SlopBiz || {}, api);   // merge: router.js, backup.js and setup.js may have loaded first
  if (typeof module === 'object' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
