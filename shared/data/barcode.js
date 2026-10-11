// GS1 check digits for EAN-8, UPC-A (GTIN-12), EAN-13 and GTIN-14.
(function (g) {
  'use strict';
  const ns = (g.SlopData = g.SlopData || {});

  /** Check digit for `body`, the code without its last digit. Weights 3 and 1 counted from the right. */
  function checkDigit(body) {
    const s = String(body);
    let sum = 0;
    for (let i = 0; i < s.length; i++) sum += (s.charCodeAt(i) - 48) * ((s.length - i) % 2 ? 3 : 1);
    return (10 - (sum % 10)) % 10;
  }

  /** Spaces and hyphens removed. Returns '' for empty input. */
  function normalizeEan(code) {
    return code === undefined || code === null ? '' : String(code).replace(/[\s-]/g, '');
  }

  /** True for 8, 12, 13 or 14 digits whose last digit is the GS1 check digit. */
  function isValidEan(code) {
    const s = String(code ?? '');
    if (!/^(?:\d{8}|\d{12,14})$/.test(s)) return false;
    return checkDigit(s.slice(0, -1)) === s.charCodeAt(s.length - 1) - 48;
  }

  ns.barcode = { checkDigit, normalizeEan, isValidEan };
})(typeof window !== 'undefined' ? window : globalThis);
