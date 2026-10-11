// Numbering sequences (invoice and order numbers): the prefix and the zero-padding change how new numbers look.
// The next number can only move forward; the schema refuses a lower value. Numbers already issued never change.
(function (g) {
  'use strict';
  const S = g.SlopData;
  const NS = (g.SlopAdmin = g.SlopAdmin || {});
  const { ok, fail } = S.result;

  /** The sequences, in a fixed order (invoice, then order). */
  async function list() {
    const r = await S.store.list('numbering');
    if (!r.ok) return r;
    const order = ['invoice', 'order'];
    return ok(r.value.slice().sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id)));
  }

  /** Saves one sequence. Returns the stored record. */
  async function save(id, input) {
    const cur = await S.store.get('numbering', id);
    if (!cur.ok) return cur;
    if (!cur.value) return fail('not_found', `No numbering sequence ${id}.`);
    const prefix = String(input.prefix ?? '');
    const pad = Number(String(input.pad ?? '').trim());
    const next = Number(String(input.next ?? '').trim());
    if (!Number.isInteger(pad) || pad < 1 || pad > 12) return fail('invalid', 'Zero-padding is a whole number from 1 to 12.');
    if (!Number.isSafeInteger(next) || next < 1) return fail('invalid', 'The next number is a whole number from 1 upward.');
    if (next < cur.value.next) return fail('invalid', `The next number can only move forward (it is ${cur.value.next} now). Issued numbers are never reused.`);
    return S.store.put('numbering', { ...cur.value, prefix, pad, next });
  }

  /** What the next number will look like, for the preview. */
  const preview = (seq) => S.numbering.format(seq, seq.next);

  NS.numbering = { list, save, preview };
})(typeof window !== 'undefined' ? window : globalThis);
