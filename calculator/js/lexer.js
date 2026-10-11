/* Slopculator tokens. Pure, classic script. Exposes window.SlopCalc.lexer:
 *   CalcError(message, pos, code, extra)  the one error type every stage throws (code: syntax | unit | type | math | rate)
 *   tokenize(text)  → [{ type, value, pos }], types: num, word, date, time, op, lp, rp, comma, pct, end
 * Numbers are plain (1000, 2.5; no thousands separator, because a comma separates function arguments).
 * × ÷ − √ are the same as * / - sqrt. ** is the same as ^. */
(function (g) {
  'use strict';
  const ns = (g.SlopCalc = g.SlopCalc || {});

  class CalcError extends Error {
    constructor(message, pos = 0, code = 'syntax', extra = {}) {
      super(message);
      this.name = 'CalcError';
      this.pos = pos;
      this.code = code;
      Object.assign(this, extra);
    }
  }

  const OPS = { '+': '+', '-': '-', '−': '-', '*': '*', '×': '*', '/': '/', '÷': '/', '^': '^', '**': '^', '√': 'sqrt' };
  const RULES = [
    ['date', /^\d{4}-\d{2}-\d{2}(?![\d-])/],
    ['time', /^\d{1,2}:\d{2}(?![\d:])/],
    ['num', /^(?:\d+(?:\.\d+)?|\.\d+)/],
    ['word', /^[A-Za-z_]+/],
    ['op', /^(?:\*\*|[-+*/^−×÷√])/],
  ];
  const PUNCT = { '(': 'lp', ')': 'rp', ',': 'comma', '%': 'pct' };

  function tokenize(text) {
    const s = String(text == null ? '' : text);
    const out = [];
    let i = 0;
    while (i < s.length) {
      const c = s[i];
      if (/\s/.test(c) || c === '°') { i++; continue; }
      const rest = s.slice(i);
      let hit = null;
      for (const [type, rx] of RULES) {
        const m = rx.exec(rest);
        if (m) { hit = { type, text: m[0] }; break; }
      }
      if (!hit && PUNCT[c]) hit = { type: PUNCT[c], text: c };
      if (!hit) throw new CalcError(`Unexpected character “${c}”`, i);
      const tok = { type: hit.type, value: hit.text, pos: i };
      if (hit.type === 'num') tok.value = parseFloat(hit.text);
      if (hit.type === 'op') { tok.value = OPS[hit.text]; }
      out.push(tok);
      i += hit.text.length;
    }
    out.push({ type: 'end', value: '', pos: s.length });
    return out;
  }

  ns.lexer = Object.freeze({ CalcError, tokenize });
  ns.CalcError = CalcError;
})(typeof window !== 'undefined' ? window : globalThis);
