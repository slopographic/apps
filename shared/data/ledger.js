// Double-entry ledger. Posted entries are immutable: a correction is a reversing entry.
// The pure helpers (validateEntry, summarize, reverseLines) need no storage. postIn/reverseIn run
// inside a store transaction. postJournal, reverseJournal and trialBalance are the public calls.
(function (g) {
  'use strict';
  const ns = (g.SlopData = g.SlopData || {});
  const { ok, fail } = ns.result;
  const TYPE_SIDE = { asset: 'debit', expense: 'debit', liability: 'credit', equity: 'credit', revenue: 'credit' };

  /** Local calendar date as YYYY-MM-DD. */
  function today() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  /** Errors for an entry before posting: shape, positive whole amounts, balance and, when `accounts` is given, known codes. */
  function validateEntry(entry, accounts) {
    const errors = ns.schema.prepare('journal', entry, { skipKey: true }).errors.slice();
    if (accounts && entry && Array.isArray(entry.lines)) {
      const known = new Set(accounts.map((a) => a.code));
      for (const l of entry.lines) if (l && !known.has(l.account)) errors.push({ field: 'lines', message: `unknown account ${l.account}` });
    }
    return errors;
  }

  /** The same entry with each line's sides swapped. */
  function reverseLines(lines) {
    return lines.map((l) => ({ account: l.account, debit: l.credit, credit: l.debit }));
  }

  /** Pure trial balance: per-account totals and balance (normal side), plus the checks that totals agree. */
  function summarize(entries, accounts) {
    const rows = new Map(accounts.map((a) => [a.code, { code: a.code, name: a.name, type: a.type, debit: 0, credit: 0 }]));
    const errors = [];
    let debit = 0, credit = 0;
    for (const e of entries) {
      let ed = 0, ec = 0;
      for (const l of e.lines || []) {
        ed += l.debit;
        ec += l.credit;
        const row = rows.get(l.account);
        if (row) { row.debit += l.debit; row.credit += l.credit; } else errors.push(`entry ${e.id}: unknown account ${l.account}`);
      }
      if (ed !== ec) errors.push(`entry ${e.id} does not balance (${ed} debit, ${ec} credit)`);
      debit += ed;
      credit += ec;
    }
    if (debit !== credit) errors.push(`debits and credits differ by ${debit - credit}`);
    const list = [...rows.values()].map((r) => ({ ...r, balance: TYPE_SIDE[r.type] === 'debit' ? r.debit - r.credit : r.credit - r.debit }));
    return { rows: list, debit, credit, balanced: errors.length === 0, errors };
  }

  /** Posts an entry inside a transaction. Rejects unknown accounts and a source that was already posted. */
  async function postIn(tx, input) {
    const accts = await tx.list('accounts');
    if (!accts.ok) return accts;
    const errors = validateEntry(input, accts.value);
    if (errors.length) return tx.fail(fail('invalid', ns.schema.errorText(errors), { errors }));
    const dup = await tx.list('journal', { index: 'source', value: input.source, includeDeleted: true });
    if (!dup.ok) return dup;
    if (dup.value.length) return tx.fail(fail('duplicate_source', `${input.source} has already been posted`));
    return tx.put('journal', { date: input.date, memo: input.memo, source: input.source, lines: input.lines, reverses: input.reverses }, { posting: true });
  }

  /** Reverses a posted entry inside a transaction. Reversing the same entry twice is rejected by the source rule. */
  async function reverseIn(tx, id, opts = {}) {
    const j = await tx.get('journal', id);
    if (!j.ok) return j;
    if (!j.value) return tx.fail(fail('not_found', `no journal entry ${id}`));
    return postIn(tx, {
      date: opts.date || today(), memo: opts.memo || `Reversal of ${j.value.memo || id}`,
      source: `reversal:${id}`, reverses: id, lines: reverseLines(j.value.lines),
    });
  }

  /** Posts one balanced entry. Example: { date, memo, source: 'manual:42', lines: [{ account: '1000', debit: 500 }, { account: '4000', credit: 500 }] } */
  const postJournal = (input) => ns.store.transact((tx) => postIn(tx, input));
  const reverseJournal = (id, opts) => ns.store.transact((tx) => reverseIn(tx, id, opts));

  /** Trial balance of the whole ledger. Fails with code 'unbalanced' (and the summary) when totals disagree. */
  function trialBalance() {
    return ns.store.readAll(async (tx) => {
      const a = await tx.list('accounts');
      if (!a.ok) return a;
      const j = await tx.list('journal');
      if (!j.ok) return j;
      const s = summarize(j.value, a.value);
      return s.balanced ? ok(s) : Object.assign(fail('unbalanced', s.errors[0], { errors: s.errors }), { summary: s });
    });
  }

  ns.ledger = { TYPE_SIDE, today, validateEntry, reverseLines, summarize, postIn, reverseIn, postJournal, reverseJournal, trialBalance };
})(typeof window !== 'undefined' ? window : globalThis);
