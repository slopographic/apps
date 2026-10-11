// The Trial balance tab: base-currency totals per account with the check that debits equal credits, the foreign
// totals in their own currencies (not added to the base), and the CSV export.
(function (g) {
  'use strict';
  const S = g.SlopData;
  const NS = (g.SlopLedger = g.SlopLedger || {});
  const UI = g.SlopUI;
  const el = UI.el;
  const $ = (id) => document.getElementById(id);
  let last = null;

  async function render() {
    const s = await NS.util.settings();
    const money = (m, c) => NS.util.money(m, c, s.locale);
    const r = await S.ledger.trialBalance();
    const tb = r.ok ? r.value : r.summary || null;
    last = tb ? { tb, base: s.base } : null;
    if (!tb) {
      $('tCheck').textContent = `The trial balance could not be read. ${NS.util.refusal(r)}`;
      $('tRows').replaceChildren();
      return;
    }
    $('tRows').replaceChildren(...tb.rows.map((x) => el('tr', null,
      el('td', null, x.code), el('td', null, x.name), el('td', { class: 'num' }, x.debit ? money(x.debit, s.base) : ''),
      el('td', { class: 'num' }, x.credit ? money(x.credit, s.base) : ''), el('td', { class: 'num' }, money(x.balance, s.base)))));
    $('tDr').textContent = money(tb.debit, s.base);
    $('tCr').textContent = money(tb.credit, s.base);
    $('tCheck').textContent = r.ok
      ? `Check: base debits equal base credits (${money(tb.debit, s.base)}). The trial balance agrees.`
      : `Check failed: base debits and credits differ. ${tb.errors.join(' ')}`;
    $('tCheck').className = r.ok ? 'note ok' : 'note msg';
    const fx = tb.foreign || [];
    $('tForeign').hidden = fx.length === 0;
    $('tForeignRows').replaceChildren(...fx.map((f) => el('li', null,
      `${f.currency}: debits ${NS.util.money(f.debit, f.currency, s.locale)}, credits ${NS.util.money(f.credit, f.currency, s.locale)} · ${f.balanced ? 'balanced' : 'not balanced'}`)));
  }

  function mount() {
    $('tExport').addEventListener('click', () => {
      if (!last) { UI.toast('Nothing to export yet.'); return; }
      const f = NS.csv.trialCsv(last.tb, last.base, NS.util.today());
      UI.download(f.blob, f.name);
    });
  }

  NS.views = NS.views || {};
  NS.views.trial = { mount, render };
})(typeof window !== 'undefined' ? window : globalThis);
