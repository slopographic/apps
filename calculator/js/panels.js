/* Slopculator side panels: the searchable history (kept per viewer) and the exchange rates (manual rates, and a note
 * about Slop Ledger's rates). Classic script. Exposes window.SlopCalcPanels: init({ pick, history, setHistory,
 * ratesChanged, status }), renderHistory(list), renderRates(). Rows are built with textContent, never innerHTML. */
(function () {
  'use strict';
  const R = window.SlopCalcRates;
  const $ = (id) => document.getElementById(id);
  const el = { hist: $('sc-history'), none: $('sc-history-none'), q: $('sc-hq'), clear: $('sc-history-clear'),
    rateList: $('sc-rate-list'), rateForm: $('sc-rate-form'), ledger: $('sc-ledger-note') };
  let o = { pick() {}, history: () => [], setHistory() {}, ratesChanged() {}, status() {} };
  let shown = [];

  function renderHistory(list) {
    const q = (el.q.value || '').trim().toLowerCase();
    shown = (list || []).filter((h) => !q || h.expr.toLowerCase().includes(q) || h.text.toLowerCase().includes(q));
    el.hist.replaceChildren(...shown.map((h) => {
      const li = document.createElement('li');
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'sc-hist-item';
      const a = document.createElement('span'); a.className = 'sc-hist-expr'; a.textContent = h.expr;
      const v = document.createElement('span'); v.className = 'sc-hist-val'; v.textContent = '= ' + h.text;
      b.append(a, v);
      b.addEventListener('click', () => o.pick(h.expr));
      li.append(b);
      return li;
    }));
    el.none.hidden = shown.length > 0;
    el.none.textContent = (o.history() || []).length ? 'No history matches the search.' : 'Calculations you finish appear here.';
    el.clear.disabled = !(o.history() || []).length;
  }

  function renderRates() {
    el.ledger.textContent = R.ledgerReady()
      ? 'Rates from Slop Ledger are used when there is no manual rate for the pair.'
      : 'Slop Ledger rates are not loaded, so only manual rates are used.';
    const rows = R.manual();
    el.rateList.replaceChildren(...rows.map((r) => {
      const li = document.createElement('li');
      li.className = 'sc-rate-row';
      const t = document.createElement('span');
      t.textContent = `1 ${r.from} = ${Number(r.factor.toPrecision(10))} ${r.to}`;
      const d = document.createElement('button');
      d.type = 'button';
      d.className = 'sc-btn sc-small';
      d.textContent = 'Remove';
      d.setAttribute('aria-label', `Remove the rate from ${r.from} to ${r.to}`);
      d.addEventListener('click', () => { R.removeManual(r.from, r.to); renderRates(); o.ratesChanged(); });
      li.append(t, d);
      return li;
    }));
    if (!rows.length) {
      const li = document.createElement('li');
      li.className = 'sc-none';
      li.textContent = 'No manual rates yet.';
      el.rateList.append(li);
    }
  }

  function bindRateForm() {
    el.rateForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const from = $('sc-rate-from').value.trim().toUpperCase();
      const to = $('sc-rate-to').value.trim().toUpperCase();
      const f = Number($('sc-rate-factor').value);
      if (!/^[A-Z]{3}$/.test(from) || !/^[A-Z]{3}$/.test(to)) { o.status('Currency codes are three letters, such as USD and EUR'); return; }
      if (!R.setManual(from, to, f)) { o.status('Enter a rate above zero, and two different currencies'); return; }
      el.rateForm.reset();
      renderRates();
      o.status(`Saved: 1 ${from} = ${f} ${to}`);
      o.ratesChanged();
    });
  }

  function init(opts) {
    o = Object.assign(o, opts);
    el.q.addEventListener('input', () => renderHistory(o.history()));
    el.clear.addEventListener('click', () => { o.setHistory([]); renderHistory([]); o.status('History cleared'); });
    bindRateForm();
    renderRates();
  }

  window.SlopCalcPanels = { init, renderHistory: (list) => renderHistory(list), renderRates };
})();
