// The Accounts tab: the chart of accounts. Add an account (four-digit code, name, type) and rename one.
// Codes and types do not change, and accounts are never deleted.
(function (g) {
  'use strict';
  const NS = (g.SlopLedger = g.SlopLedger || {});
  const UI = g.SlopUI;
  const el = UI.el;
  const $ = (id) => document.getElementById(id);

  function rename(a) {
    UI.prompt('Rename account', `Name for ${a.code}`, a.name, { ok: 'Rename' }).then(async (name) => {
      if (name === null) return;
      const r = await NS.accounts.rename(a.code, name);
      UI.toast(r.ok ? 'Account renamed' : NS.util.refusal(r));
    });
  }

  async function render() {
    const r = await NS.util.accounts();
    if (!r.ok) { $('aRows').replaceChildren(el('tr', null, el('td', { colspan: 4, class: 'msg' }, NS.util.refusal(r)))); return; }
    $('aRows').replaceChildren(...r.value.map((a) => el('tr', { 'data-code': a.code, 'data-name': a.name },
      el('td', null, a.code), el('td', null, a.name), el('td', null, a.type),
      el('td', null, el('button', { type: 'button', class: 'btn small', 'aria-label': `Rename ${a.code}`, onclick: () => rename(a) }, 'Rename')))));
  }

  function mount() {
    $('aType').replaceChildren(...NS.accounts.TYPES.map((t) => el('option', { value: t }, t)));
    $('aAdd').addEventListener('click', async () => {
      const r = await NS.accounts.add({ code: $('aCode').value, name: $('aName').value, type: $('aType').value });
      $('aMsg').textContent = r.ok ? '' : NS.util.refusal(r);
      if (r.ok) { UI.toast(`Account ${r.value.code} added`); $('aCode').value = ''; $('aName').value = ''; }
    });
    g.SlopCtx.bind($('aRows'), (t) => {
      const tr = t && t.closest && t.closest('tr[data-code]');
      return tr ? [{ label: 'Rename…', act: () => rename({ code: tr.dataset.code, name: tr.dataset.name }) }] : null;
    });
  }

  NS.views = NS.views || {};
  NS.views.accounts = { mount, render };
})(typeof window !== 'undefined' ? window : globalThis);
