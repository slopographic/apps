// The Bank tab: reconcile a bank (or cash) account with its statement. Import the bank's CSV: each line is kept once
// (bankLines; a second import of the same statement adds nothing) and matched to the journal entry that moved the account
// by the same amount within 5 days (core/bank.js). What is left is for the person: money in that equals an open invoice's
// balance can be recorded as its payment; money out can be recorded as an expense; anything else can be set aside. The
// statement's totals and the difference still to explain are at the top.
(function (g) {
  'use strict';
  const S = g.SlopData, UI = g.SlopUI, el = UI.el;
  const NS = (g.SlopLedger = g.SlopLedger || {});
  const $ = (id) => document.getElementById(id);
  const STATUS = { open: 'To review', matched: 'Matched', ignored: 'Set aside' };
  let cache = null;   // { lines, moves, invoices, settings } of the last render

  const account = () => $('bkAccount').value;
  const list = async (name, o) => { const r = await S.store.list(name, o); return r.ok ? r.value : []; };

  /** Reads the statement file and stores its new lines, then matches. Says how many were new. */
  async function importFile(file) {
    // the one CSV parser of the site (convert/js/core/csv.js, an ES module), loaded when a statement is imported
    const { parseCsv } = await import(new URL('../convert/js/core/csv.js', document.baseURI).href);
    const s = await NS.util.settings();
    const parsed = NS.bank.linesOf(parseCsv(await file.text()), { dayFirst: !/^en-US$/i.test(s.locale) });
    if (!parsed.columns) { UI.alert('Not a statement', 'No date and amount columns were found. A bank CSV needs a header row with a date and an amount (or money in and money out).'); return; }
    const have = new Set((await list('bankLines')).map((l) => l.key)), acct = account();
    let added = 0;
    for (const l of parsed.lines) {
      const key = `${acct}|${l.key}`;
      if (have.has(key)) continue;
      const w = await S.store.put('bankLines', { key, account: acct, date: l.date, description: l.description, amount: l.amount, currency: s.base, status: 'open', source: file.name, importedAt: Date.now() });
      if (w.ok) added++;
    }
    const matched = await autoMatch();
    UI.toast(`${added} new line${added === 1 ? '' : 's'} from ${file.name}${matched ? `, ${matched} matched` : ''}${parsed.skipped ? `; ${parsed.skipped} skipped (no date or amount)` : ''}`);
    await render();
  }

  /** Matches every open line of the account it can; returns how many it matched. */
  async function autoMatch() {
    const acct = account(), lines = (await list('bankLines')).filter((l) => l.account === acct);
    const pairs = NS.bank.match(lines, NS.bank.moves(await list('journal'), acct));
    for (const p of pairs) await S.store.put('bankLines', { ...p.line, status: 'matched', journalId: p.move.journalId });
    return pairs.length;
  }

  async function setStatus(line, status) {
    const r = await S.store.put('bankLines', { ...line, status, journalId: status === 'matched' ? line.journalId : undefined });
    if (!r.ok) UI.alert('Not changed', NS.util.refusal(r));
    await render();
  }

  /** Money in: the open invoices whose balance is exactly this line's amount. */
  function invoicesFor(line) {
    if (line.amount <= 0) return [];
    return cache.invoices.filter((x) => x.due === line.amount);
  }
  async function recordPayment(line, inv) {
    const r = await S.billing.recordPayment({ invoiceId: inv.id, amount: line.amount, date: line.date, method: line.account === '1000' ? 'cash' : 'bank', note: line.description.slice(0, 300) || undefined });
    if (!r.ok) { UI.alert('Payment not recorded', NS.util.refusal(r)); return; }
    await autoMatch();
    UI.toast(`Payment for ${inv.number} recorded and matched`);
    await render();
  }
  /** Money out as an expense: the supplier (the statement's text to start with) and the category; no tax to reclaim. */
  async function recordExpense(line) {
    const accts = (await list('accounts')).filter((a) => a.type === 'expense').sort((a, b) => a.code.localeCompare(b.code));
    const supplier = UI.field('Supplier', el('input', { value: line.description.slice(0, 200), maxlength: 200 }));
    const cat = UI.select(accts.map((a) => [a.code, `${a.code} ${a.name}`]), accts[0] ? accts[0].code : '5000');
    UI.dialog({
      title: 'Record as an expense', body: el('div', null, el('p', { class: 'note' }, `${line.date} · ${NS.util.money(-line.amount, cache.settings.base, cache.settings.locale)} paid from ${line.account === '1000' ? 'cash' : 'the bank'}`), supplier, UI.field('Category', cat)),
      buttons: [{ label: 'Cancel' }, { label: 'Record expense', primary: true, act: async () => {
        const r = await S.expenses.record({ date: line.date, supplier: supplier.querySelector('input').value.trim() || 'Bank', description: line.description.slice(0, 300) || undefined,
          account: cat.value, amount: -line.amount, tax: 0, currency: cache.settings.base, method: line.account === '1000' ? 'cash' : 'bank' });
        if (!r.ok) { UI.alert('Expense not recorded', NS.util.refusal(r)); return false; }
        await autoMatch(); await render();
        return undefined;
      } }],
    });
  }

  function row(line) {
    const s = cache.settings, m = (v) => NS.util.money(v, s.base, s.locale);
    const acts = [];
    if (line.status === 'open') {
      for (const inv of invoicesFor(line).slice(0, 2)) acts.push(el('button', { type: 'button', class: 'btn small primary', onclick: () => recordPayment(line, inv) }, `Payment for ${inv.number}`));
      if (line.amount < 0) acts.push(el('button', { type: 'button', class: 'btn small', onclick: () => recordExpense(line) }, 'Record as expense…'));
      acts.push(el('button', { type: 'button', class: 'btn small', onclick: () => setStatus(line, 'ignored') }, 'Set aside'));
    } else if (line.status === 'matched') acts.push(el('button', { type: 'button', class: 'btn small', onclick: () => setStatus(line, 'open') }, 'Unmatch'));
    else acts.push(el('button', { type: 'button', class: 'btn small', onclick: () => setStatus(line, 'open') }, 'Bring back'));
    const move = line.journalId && cache.moves.find((x) => x.journalId === line.journalId);
    return el('tr', { class: `bk-${line.status}` }, el('td', null, line.date), el('td', null, line.description || '—', move ? el('div', { class: 'note' }, `Matched: ${move.memo || 'journal entry'} (${move.date})`) : null),
      el('td', { class: 'num' }, m(line.amount)), el('td', null, el('span', { class: `chip ${line.status === 'matched' ? 'paid' : line.status === 'ignored' ? 'void' : 'issued'}` }, STATUS[line.status])),
      el('td', null, el('div', { class: 'toolbar' }, acts)));
  }

  async function render() {
    const acct = account(), s = await NS.util.settings();
    const [lines, journal, invoices, payments] = await Promise.all([list('bankLines'), list('journal'), list('invoices', { index: 'status', value: 'issued' }), list('payments')]);
    const mine = lines.filter((l) => l.account === acct).sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
    const due = invoices.filter((x) => !x.deletedAt).map((x) => ({ id: x.id, number: x.number, due: S.billing.balanceDue(x, payments.filter((p) => p.invoiceId === x.id)) }));
    cache = { lines: mine, moves: NS.bank.moves(journal, acct), invoices: due, settings: s };
    const count = (st) => mine.filter((l) => l.status === st).length, m = (v) => NS.util.money(v, s.base, s.locale);
    const open = mine.filter((l) => l.status === 'open');
    $('bkStats').replaceChildren(...[[String(mine.length), 'Statement lines'], [String(count('matched')), 'Matched'], [String(open.length), 'To review'],
      [String(count('ignored')), 'Set aside'], [m(open.reduce((t, l) => t + l.amount, 0)), 'Still to explain']].map(([v, k]) => el('div', { class: 'stat' }, el('b', null, v), el('span', null, k))));
    const shown = $('bkShowAll').checked ? mine : open;
    $('bkRows').replaceChildren(...shown.map(row));
    $('bkEmpty').hidden = shown.length > 0;
    $('bkEmpty').textContent = mine.length ? 'Every line is matched or set aside. Tick the box to see them.' : 'No statement yet. Import your bank’s CSV export: each line is matched to the books where it can be.';
  }

  function mount() {
    $('bkImport').addEventListener('click', () => $('bkPick').click());
    $('bkPick').addEventListener('change', async (e) => { const f = e.target.files[0]; e.target.value = ''; if (f) await importFile(f); });
    $('bkAccount').addEventListener('change', render);
    $('bkShowAll').addEventListener('change', render);
    $('bkMatch').addEventListener('click', async () => { const n = await autoMatch(); UI.toast(n ? `${n} matched` : 'Nothing new to match'); await render(); });
  }

  NS.views = NS.views || {};
  NS.views.bank = { mount, render };
  NS.bankView = { importFile, autoMatch, render };
})(typeof window !== 'undefined' ? window : globalThis);
