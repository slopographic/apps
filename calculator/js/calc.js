/* Slopculator public entry: calc(text, opts) → { ok, value, text } or { ok:false, error:{ code, message, pos, from?, to? } }.
 * opts: { today, ans, rate } (see evaluate.js). Pure, classic script, loaded last. Exposes window.SlopCalc.calc. */
(function (g) {
  'use strict';
  const ns = (g.SlopCalc = g.SlopCalc || {});

  function calc(text, opts) {
    const o = opts || {};
    try {
      const tree = ns.parse(text);
      const value = ns.evaluate(tree, { today: o.today, ans: o.ans || null, rate: o.rate || null });
      return { ok: true, value, text: ns.format(value) };
    } catch (e) {
      if (e && e.name === 'CalcError') {
        return { ok: false, error: { code: e.code, message: e.message, pos: e.pos, from: e.from, to: e.to } };
      }
      throw e;
    }
  }

  ns.calc = calc;
})(typeof window !== 'undefined' ? window : globalThis);
