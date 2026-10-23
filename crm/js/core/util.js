// Slop CRM core helpers: the namespace, pipeline stages, dates and money display. Classic script. Exposes window.SlopCrm.
(function (g) {
  'use strict';
  const S = g.SlopData;
  const NS = (g.SlopCrm = g.SlopCrm || {});
  const STAGES = ['lead', 'contacted', 'customer', 'lost'];
  const STAGE_LABEL = { lead: 'Lead', contacted: 'Contacted', customer: 'Customer', lost: 'Lost' };
  const pad = (n) => String(n).padStart(2, '0');

  /** Local calendar date as YYYY-MM-DD (the day the person sees). */
  function today() {
    const d = new Date();
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }

  /** True for a real calendar date written YYYY-MM-DD. */
  function isDate(s) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(s || ''))) return false;
    const d = new Date(`${s}T00:00:00Z`);
    return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
  }

  /** "a, b ,c" -> ['a', 'b', 'c'] (blanks dropped, duplicates removed). */
  function tags(text) {
    return [...new Set(String(text || '').split(',').map((s) => s.trim()).filter(Boolean))];
  }

  /** Text for a failed Result: the first message, which already names the fields that are wrong. */
  function refusal(r) {
    return (r && r.message) || 'Could not save. Nothing changed.';
  }

  NS.STAGES = STAGES;
  NS.stageLabel = (s) => STAGE_LABEL[s] || s;
  // Settings (currency, locale) and money are SlopBiz's (shared/biz/biz.js).
  NS.util = { STAGES, STAGE_LABEL, today, isDate, settings: g.SlopBiz.settings, tags, refusal, money: g.SlopBiz.money,
    date: (iso, loc) => S.locale.formatDate(iso, loc) };
})(typeof window !== 'undefined' ? window : globalThis);
