// The Journal tab: a manual entry form (two or more lines, debits equal credits), the posted entries with their
// base amounts next to the original ones, reversing entries, and the journal CSV export.
(function (g) {
  'use strict';
  const S = g.SlopData;
  const NS = (g.SlopLedger = g.SlopLedger || {});
  const UI = g.SlopUI;
  const el = UI.el;
  const $ = (id) => document.getElementById(id);
  const money = (m, c, l) => NS.util.money(m, c, l);
  let accountsCache = [];

  /** One line of the form: account, debit, credit, remove. */
  function lineRow() {
    const sel = el('select', { class: 'l-acct', 'aria-label': 'Account' }, [el('option', { value: '' }, 'Choose an account…'),
      ...accountsCache.map((a) => el('option', { value: a.code }, `${a.code} ${a.name}`))]);
    const dr = el('input', { class: 'l-dr', type: 'text', inputmode: 'decimal', placeholder: 'Debit', 'aria-label': 'Debit', oninput: updateTotals });
    const cr = el('input', { class: 'l-cr', type: 'text', inputmode: 'decimal', placeholder: 'Credit', 'aria-label': 'Credit', oninput: updateTotals });
    return el('div', { class: 'line-row' }, sel, dr, cr,
      el('button', { type: 'button', class: 'btn small', 'aria-label': 'Remove line', onclick: (e) => { e.currentTarget.parentNode.remove(); updateTotals(); } }, '✕'));
  }

  /** The typed rows as text, read from the form. */
  const formRows = () => [...$('jLines').querySelectorAll('.line-row')].map((r) => ({
    account: r.querySelector('.l-acct').value, debit: r.querySelector('.l-dr').value, credit: r.querySelector('.l-cr').value }));

  /** Live totals while typing: the same parse the posting uses, so the figures agree with what gets posted. */
  function updateTotals() {
    const cur = ($('jCur').value || 'USD').trim().toUpperCase();
    let dr = 0, cr = 0, bad = false;
    for (const r of formRows()) {
      const d = S.money.parseMinor(r.debit.trim() || '0', cur), c = S.money.parseMinor(r.credit.trim() || '0', cur);
      if (d === null || c === null) { bad = true; continue; }
      dr += d; cr += c;
    }
    const f = (m) => money(m, cur, $('jLocale').value);
    $('jTotals').textContent = bad ? 'Check the amounts: each needs at most the currency’s decimals.'
      : `Debits ${f(dr)} · Credits ${f(cr)} · ${dr === cr && dr > 0 ? 'Balanced' : 'Not balanced yet'}`;
  }

  /** Fills the form's account choices, keeping each line's current choice. */
  function fillAccounts() {
    for (const sel of $('jLines').querySelectorAll('.l-acct')) {
      const keep = sel.value;
      sel.replaceChildren(el('option', { value: '' }, 'Choose an account…'), ...accountsCache.map((a) => el('option', { value: a.code }, `${a.code} ${a.name}`)));
      sel.value = keep;
    }
  }

  async function post() {
    const msg = $('jMsg');
    msg.textContent = '';
    const built = NS.journal.buildEntry({ date: $('jDate').value, memo: $('jMemo').value, currency: $('jCur').value, rows: formRows() },
      accountsCache.map((a) => a.code));
    if (!built.ok) { msg.textContent = `Not posted. ${built.message}`; return false; }
    const r = await NS.journal.post(built.value);
    if (!r.ok) { msg.textContent = `Not posted. ${NS.util.refusal(r)}`; return false; }
    UI.toast('Entry posted');
    $('jMemo').value = '';
    $('jLines').replaceChildren(lineRow(), lineRow());
    updateTotals();
    return true;
  }

  function reverseEntry(e) {
    UI.confirm('Reverse this entry?', `A new entry dated today reverses “${e.memo || e.source}”. The original stays as it is.`, 'Reverse', { danger: true })
      .then(async (yes) => {
        if (!yes) return;
        const r = await NS.journal.reverse(e.id);
        UI.toast(r.ok ? 'Reversed' : NS.util.refusal(r));
      });
  }

  /** The amount cell: the original and the base amount side by side when they differ. */
  function amountCell(base, orig, origCur, baseCur, loc) {
    if (orig === undefined || orig === null || !origCur || origCur === baseCur) return money(base, baseCur, loc);
    return el('span', { class: 'pair' }, el('span', { class: 'orig' }, money(orig, origCur, loc)), el('span', { class: 'arrow' }, ' = '), money(base, baseCur, loc));
  }

  function entryCard(e, names, reversed, base, loc) {
    const fx = !!e.rateId;
    const tags = [e.reverses ? 'Reversal' : null, e.source.startsWith('manual:') || e.reverses ? null : 'From a module', reversed.has(e.id) ? 'Reversed' : null].filter(Boolean);
    const rows = e.lines.map((l) => el('tr', null,
      el('td', null, `${l.account} ${names.get(l.account) || ''}`),
      el('td', { class: 'num' }, l.debit ? amountCell(l.debit, fx ? l.origDebit : undefined, e.currency, base, loc) : ''),
      el('td', { class: 'num' }, l.credit ? amountCell(l.credit, fx ? l.origCredit : undefined, e.currency, base, loc) : '')));
    return el('article', { class: 'entry', 'data-id': e.id, 'data-reversed': reversed.has(e.id) ? '1' : '0', 'aria-label': `Entry ${e.date} ${e.memo || ''}` },
      el('header', { class: 'e-head' }, el('b', null, S.locale.formatDate(e.date, loc)), el('span', { class: 'memo' }, e.memo || 'No memo'),
        tags.map((t) => el('span', { class: 'tag' }, t))),
      el('table', { class: 'lines' }, el('thead', null, el('tr', null, el('th', null, 'Account'), el('th', { class: 'num' }, `Debit (${base})`), el('th', { class: 'num' }, `Credit (${base})`))),
        el('tbody', null, rows)),
      fx ? el('p', { class: 'note' }, `Entered in ${e.currency}. Rate ${(e.rate / 1e6).toFixed(6)} on ${e.date}: ${money(e.amount, e.currency, loc)} = ${money(e.amountBase, base, loc)}.`) : null,
      !reversed.has(e.id) ? el('div', { class: 'e-actions' }, el('button', { type: 'button', class: 'btn small', onclick: () => reverseEntry(e) }, 'Reverse…')) : null);
  }

  async function render() {
    const s = await NS.util.settings();
    $('jLocale').value = s.locale;
    $('jCur').value = $('jCur').value || s.base;
    const acc = await NS.util.accounts();
    if (acc.ok) accountsCache = acc.value;
    fillAccounts();
    if (!$('jLines').children.length) $('jLines').replaceChildren(lineRow(), lineRow());
    updateTotals();
    const list = await NS.journal.list();
    if (!list.ok) { $('jRows').replaceChildren(el('p', { class: 'msg', role: 'alert' }, NS.util.refusal(list))); return; }
    const names = new Map(accountsCache.map((a) => [a.code, a.name]));
    const reversed = NS.journal.reversedIds(list.value);
    $('jRows').replaceChildren(...list.value.map((e) => entryCard(e, names, reversed, s.base, s.locale)));
    $('jEmpty').hidden = list.value.length > 0;
    $('jCount').textContent = `${list.value.length} entr${list.value.length === 1 ? 'y' : 'ies'}`;
  }

  function mount() {
    $('jDate').value = NS.util.today();
    $('jCur').setAttribute('list', 'jCurList');
    $('jCurList').replaceChildren(...S.locale.currencies().map((c) => el('option', { value: c })));
    $('jAddLine').addEventListener('click', () => { $('jLines').append(lineRow()); fillAccounts(); updateTotals(); });
    $('jPost').addEventListener('click', post);
    $('jCur').addEventListener('input', updateTotals);
    $('jExport').addEventListener('click', async () => {
      const list = await NS.journal.list();
      const s = await NS.util.settings();
      if (!list.ok) { UI.toast(NS.util.refusal(list)); return; }
      const f = NS.csv.journalCsv(list.value, accountsCache, s.base, NS.util.today());
      UI.download(f.blob, f.name);
    });
    g.SlopCtx.bind($('jRows'), (t) => {
      const card = t && t.closest && t.closest('.entry');
      if (!card) return null;
      if (card.dataset.reversed === '1') return [{ label: 'Already reversed', disabled: true }];
      return [{ label: 'Reverse…', act: () => reverseEntry({ id: card.dataset.id, memo: card.querySelector('.memo').textContent }) }];
    });
  }

  NS.views = NS.views || {};
  NS.views.journal = { mount, render, updateTotals };
})(typeof window !== 'undefined' ? window : globalThis);
