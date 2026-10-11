// Manual journal entries. buildEntry checks the typed lines and says what is wrong before anything is written
// (the data layer checks again, so a refusal from either side shows a message). Posting goes through
// SlopData.ledger, which converts a foreign currency at the stored rate. Posted entries are never edited.
(function (g) {
  'use strict';
  const S = g.SlopData;
  const NS = (g.SlopLedger = g.SlopLedger || {});
  const U = NS.util;

  /** Pure: turns typed rows into journal lines. rows: [{ account, debit, credit }] as text. Returns a Result. */
  function buildEntry(input, knownCodes) {
    const errors = [];
    const date = String(input.date || '').trim();
    const memo = String(input.memo || '').trim();
    const cur = String(input.currency || '').trim().toUpperCase();
    if (!U.isDate(date)) errors.push('Pick a real date (the day of the entry).');
    if (!S.locale.isCurrency(cur)) errors.push('Currency must be a three-letter code, such as USD.');
    const rows = (input.rows || []).filter((r) => (r.account || '').trim() || (r.debit || '').trim() || (r.credit || '').trim());
    if (rows.length < 2) errors.push('An entry needs at least two lines.');
    const lines = [];
    rows.forEach((r, i) => {
      const n = i + 1, acct = String(r.account || '').trim();
      const d = String(r.debit || '').trim(), c = String(r.credit || '').trim();
      if (!acct) { errors.push(`Line ${n}: choose an account.`); return; }
      if (knownCodes && !knownCodes.includes(acct)) { errors.push(`Line ${n}: account ${acct} does not exist.`); return; }
      if ((d && c) || (!d && !c)) { errors.push(`Line ${n}: enter an amount on the debit or the credit side, not both.`); return; }
      const side = d ? 'debit' : 'credit';
      const minor = S.money.parseMinor(d || c, cur || 'USD');
      if (minor === null || minor <= 0) { errors.push(`Line ${n}: the amount must be a positive number with at most ${S.money.digits(cur || 'USD')} decimals.`); return; }
      lines.push({ account: acct, debit: side === 'debit' ? minor : 0, credit: side === 'credit' ? minor : 0 });
    });
    if (errors.length) return { ok: false, message: errors[0], errors };
    const dr = lines.reduce((s, l) => s + l.debit, 0), cr = lines.reduce((s, l) => s + l.credit, 0);
    if (dr !== cr) {
      const f = (m) => U.money(m, cur, 'en-US');
      return { ok: false, message: `Debits (${f(dr)}) and credits (${f(cr)}) do not balance. The difference is ${f(Math.abs(dr - cr))}. Nothing was posted.`, errors: [] };
    }
    return { ok: true, value: { date, memo: memo || undefined, currency: cur, lines } };
  }

  /** Posts a checked entry. The source is unique per manual entry. Returns the stored journal row. */
  function post(entry) {
    return S.ledger.postJournal({ ...entry, source: `manual:${S.store.newId()}` });
  }

  /** Reverses a posted entry at today's date. A second reversal of the same entry is refused by the data layer. */
  function reverse(id, memo) {
    return S.ledger.reverseJournal(id, { date: U.today(), memo: memo || undefined });
  }

  /** Journal entries, newest first. Resolves to a Result. */
  async function list() {
    const r = await S.store.list('journal');
    if (!r.ok) return r;
    const v = r.value.slice().sort((a, b) => (a.date === b.date ? (b.createdAt || 0) - (a.createdAt || 0) : a.date < b.date ? 1 : -1));
    return { ok: true, value: v };
  }

  /** Ids of entries that have a reversing entry. */
  const reversedIds = (entries) => new Set(entries.filter((e) => e.reverses).map((e) => e.reverses));

  NS.journal = { buildEntry, post, reverse, list, reversedIds };
})(typeof window !== 'undefined' ? window : globalThis);
