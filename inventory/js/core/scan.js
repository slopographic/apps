// One scan: look the code up (EAN with a valid check digit, else SKU), then apply the chosen action.
// Receive, Sell and Count each make at most one stock movement or count tally, so Undo can reverse it:
// a receipt or sale is reversed by a counter-movement; a count tally is taken back out of the open count.
// Every call returns a log entry. It never throws and never leaves a half-made change.
(function (g) {
  'use strict';
  const S = g.SlopData;
  const NS = (g.SlopInv = g.SlopInv || {});
  const U = NS.util;
  const { fail } = S.result;
  let seq = 0;
  const UNDOABLE = ['received', 'sold', 'counted'];
  const EAN_LENGTHS = [8, 12, 13, 14];

  /** The check digit a digit-only code should end in, when it has an EAN length but the digit is wrong; else null. */
  function wrongCheckDigit(digits) {
    if (!/^\d+$/.test(digits) || !EAN_LENGTHS.includes(digits.length) || S.barcode.isValidEan(digits)) return null;
    return S.barcode.checkDigit(digits.slice(0, -1));
  }

  function finish(entry, status, message, extra) {
    return Object.assign(entry, { status, message }, extra || {});
  }

  /** Runs a stock change for a found product, then reads on hand again for the log. */
  async function movement(entry, run, status, text) {
    const r = await run();
    if (!r.ok) return finish(entry, 'refused', U.refusal(r));
    entry.movementId = (r.value && r.value.id) || null;
    const after = await S.stock.onHand(entry.productId, entry.location);
    entry.onHandAfter = after.ok ? after.value : null;
    return finish(entry, status, text(entry));
  }

  /** Scans one code. opts: { action: receive|sell|count|lookup, location, qty, source }. */
  async function scan(raw, opts = {}) {
    const code = String(raw ?? '').trim();
    const entry = {
      id: `scan-${++seq}`, at: Date.now(), code, source: opts.source || 'keyboard', action: opts.action || 'receive',
      location: U.cleanLocation(opts.location), qty: opts.qty ?? 1, status: 'ignored', message: 'Nothing was scanned',
      productId: null, sku: '', name: '', onHandBefore: null, onHandAfter: null, movementId: null, tally: 0,
    };
    if (!code) return entry;
    const r = await S.stock.lookupBarcode(code);
    if (!r.ok) return finish(entry, 'refused', U.refusal(r));
    const digits = S.barcode.normalizeEan(code);
    if (!r.value) {
      const want = wrongCheckDigit(digits);
      if (want !== null) return finish(entry, 'rejected', `Not a valid EAN: the check digit should be ${want}. Nothing was changed.`);
      if (S.barcode.isValidEan(digits)) {
        return finish(entry, 'unknown', `No product has EAN ${digits}. Create a product with this EAN, or link the EAN to an existing product.`, { canCreate: true });
      }
      return finish(entry, 'unknown', `No product has SKU or EAN ${code}. Link the code to an existing product, or create one.`, { canCreate: false });
    }
    const p = r.value;
    Object.assign(entry, { productId: p.id, sku: p.sku, name: p.name });
    const before = await S.stock.onHand(p.id, entry.location);
    if (!before.ok) return finish(entry, 'refused', U.refusal(before));
    entry.onHandBefore = before.value;
    const qty = entry.qty;
    const shown = `${p.name} (${p.sku}) at ${entry.location}`;
    const needsQty = entry.action === 'receive' || entry.action === 'sell' || entry.action === 'count';
    if (needsQty && !(Number.isSafeInteger(qty) && qty > 0)) return finish(entry, 'refused', 'The quantity must be a whole number above zero.');
    switch (entry.action) {
      case 'receive':
        return movement(entry, () => NS.stockOps.receive({ productId: p.id, location: entry.location, qty, note: 'Scan' }), 'received',
          (e) => `Received ${qty}. ${shown}: ${e.onHandAfter} on hand.`);
      case 'sell':
        return movement(entry, () => NS.stockOps.sell({ productId: p.id, location: entry.location, qty, note: 'Scan' }), 'sold',
          (e) => `Sold ${qty}. ${shown}: ${e.onHandAfter} left.`);
      case 'count': {
        if (!NS.count.isOpen()) return finish(entry, 'refused', 'No count is open. Start one in the Count tab, then scan again.');
        const t = NS.count.add(p.id, qty);
        if (!t.ok) return finish(entry, 'refused', U.refusal(t));
        entry.tally = qty;
        return finish(entry, 'counted', `Counted ${qty} more: ${t.value} in this count. Nothing changes until the count is posted.`);
      }
      default:
        return finish(entry, 'found', `${shown}: ${entry.onHandBefore} on hand.`);
    }
  }

  /** Reverses one scan's effect. A movement gets a counter-movement; a count tally is taken back. */
  async function undo(entry) {
    if (!entry || !UNDOABLE.includes(entry.status)) return fail('invalid', 'this scan has nothing to undo');
    if (entry.movementId) {
      const m = await S.store.get('stockMovements', entry.movementId);
      if (!m.ok || !m.value) return fail('not_found', 'the movement for this scan is missing');
      const r = await NS.stockOps.undo(m.value);
      if (!r.ok) return fail(r.code, U.refusal(r));
      const after = await S.stock.onHand(entry.productId, entry.location);
      Object.assign(entry, {
        status: 'undone', undoneBy: r.value.id, onHandAfter: after.ok ? after.value : entry.onHandAfter,
        message: `Undone by a counter-movement of ${r.value.qty > 0 ? '+' : ''}${r.value.qty}. On hand is back to ${entry.onHandBefore}.`,
      });
      return S.result.ok(entry);
    }
    const t = NS.count.add(entry.productId, -entry.tally);
    if (!t.ok) return fail(t.code, U.refusal(t));
    Object.assign(entry, { status: 'undone', message: 'Undone: taken back out of the count.' });
    return S.result.ok(entry);
  }

  /** Undoes the newest scan that can still be undone. Resolves to the same Result as undo(). */
  function undoLast(log) {
    const entry = (log || []).find((e) => UNDOABLE.includes(e.status));
    return entry ? undo(entry) : Promise.resolve(fail('invalid', 'there is no scan to undo'));
  }

  NS.scan = { scan, undo, undoLast, wrongCheckDigit, UNDOABLE };
})(typeof window !== 'undefined' ? window : globalThis);
