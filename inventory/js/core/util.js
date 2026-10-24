// Slop Inventory: shared helpers. Classic script, loaded after shared/data and shared/biz/biz.js (refusal, settings, money
// and h are SlopBiz's). Exposes window.SlopInv.util.
// Nothing here stores anything; it formats, parses and explains.
(function (g) {
  'use strict';
  const S = g.SlopData;
  const NS = (g.SlopInv = g.SlopInv || {});

  // Plain words for each refusal code. The data layer's own message follows in brackets.
  const PLAIN = {
    insufficient_stock: 'Refused: this would take stock below zero',
    in_use: 'Cannot delete',
    conflict: 'Another product already uses that SKU or EAN',
    not_found: 'That item no longer exists',
    invalid: 'Not saved',
    immutable: 'Stock history cannot be changed',
    posting_required: 'Stock changes go through the stock rules only',
    blocked: 'Blocked by another tab',
    unavailable: 'Storage is not available in this browser',
  };
  const FIELD = { sku: 'SKU', ean: 'EAN', name: 'Name', price: 'Price', taxRate: 'Tax rate', unit: 'Unit', reorderLevel: 'Reorder level', description: 'Description' };

  const B = g.SlopBiz;
  /** One readable line for a failed Result (SlopBiz.refusal with the inventory's words, the message in brackets). */
  const refusal = (r) => B.refusal(r, { plain: PLAIN, fields: FIELD, brackets: true });

  /** Minor units as plain text with the currency's decimals, such as 1250 -> "12.50" (SlopData.money.plainMinor). */
  const majorText = (minor, currency) => S.money.plainMinor(minor, currency);

  /** A basis-point rate as text: 2000 -> "20.00". */
  const percentText = (bp) => majorText(bp, 'USD');

  /** A whole number from typed text, or NaN. */
  function wholeOf(v) {
    const t = String(v ?? '').trim();
    return /^-?\d+$/.test(t) ? Number(t) : NaN;
  }

  /** A location name as typed, or 'main' when blank. */
  const cleanLocation = (v) => String(v ?? '').trim().slice(0, 40) || 'main';

  const plural = (n, one, many = one + 's') => `${n} ${n === 1 ? one : many}`;
  const stamp = (ms) => new Date(ms).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

  NS.util = { PLAIN, FIELD, refusal, settings: B.settings, money: B.money, majorText, percentText, wholeOf, cleanLocation, h: B.h, plural, stamp, ok: S.result.ok, fail: S.result.fail };
})(typeof window !== 'undefined' ? window : globalThis);
