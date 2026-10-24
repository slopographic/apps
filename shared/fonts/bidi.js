/* SlopBidi: lays one line of text out for drawing left to right, when it mixes directions (Arabic or Hebrew with Latin
 * and digits) or fonts. A compact form of the Unicode Bidirectional Algorithm (UAX #9): strong types, European and
 * Arabic digits (W2, W7), neutrals take the direction around them (N1, N2), levels (I1, I2), and runs reversed from the
 * highest level down (L2). Explicit embedding controls (LRE, RLO, isolates) are not read: they are treated as neutrals.
 * Pure, no DOM; needs SlopScripts (scripts.js) for the script of each character. The Node tests load it.
 *   segments(text, { base: 'auto' | 'ltr' | 'rtl', fontOf(cp) -> key or null })
 *     -> [{ text, rtl, level, font }] in visual order, left to right. Each segment's text stays in logical order: a
 *        right-to-left segment is shaped and reversed by the font engine (fontkit), as it does for RTL scripts.
 *        fontOf(cp) null means "the font of the characters around it" (spaces, digits, punctuation).
 *   baseOf(text) -> 'rtl' when the first strong character is right-to-left, else 'ltr'. */
(function (root, factory) {
  const api = factory(root.SlopScripts || (typeof require === 'function' ? require('./scripts.js') : null));
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.SlopBidi = api;
})(typeof window !== 'undefined' ? window : globalThis, function (S) {
  'use strict';
  /** The bidi type of a code point: L, R (right-to-left letter), AL (Arabic letter), EN, AN or N (neutral). */
  function typeOf(cp) {
    if (cp >= 0x30 && cp <= 0x39) return 'EN';
    const s = S.scriptOf(cp);
    if (s === 'arabic-digit') return 'AN';
    if (s === 'arabic' || s === 'syriac' || s === 'thaana') return 'AL';
    if (s === 'hebrew' || s === 'nko') return 'R';
    if (s === 'common') return 'N';
    return 'L';
  }
  function baseOf(text) {
    for (const ch of String(text || '')) { const t = typeOf(ch.codePointAt(0)); if (t === 'L') return 'ltr'; if (t === 'R' || t === 'AL') return 'rtl'; }
    return 'ltr';
  }
  /** Resolved levels for the code points of one line. */
  function levels(cps, baseLevel) {
    const t = cps.map(typeOf);
    let strong = baseLevel ? 'R' : 'L';
    for (let i = 0; i < t.length; i++) {                     // W2, W3 and W7
      if (t[i] === 'L' || t[i] === 'R' || t[i] === 'AL') strong = t[i];
      if (t[i] === 'EN' && strong === 'AL') t[i] = 'AN';
      else if (t[i] === 'EN' && strong === 'L') t[i] = 'L';
      if (t[i] === 'AL') t[i] = 'R';
    }
    const dir = (x) => (x === 'L' ? 'L' : x === 'R' || x === 'EN' || x === 'AN' ? 'R' : null);
    const sos = baseLevel ? 'R' : 'L';
    for (let i = 0; i < t.length;) {                          // N1, N2: a run of neutrals takes the direction on both sides
      if (t[i] !== 'N') { i++; continue; }
      let j = i; while (j < t.length && t[j] === 'N') j++;
      const before = i ? dir(t[i - 1]) : sos, after = j < t.length ? dir(t[j]) : sos;
      const d = before === after ? before : sos;
      for (let k = i; k < j; k++) t[k] = d;
      i = j;
    }
    return t.map((x) => {                                    // I1, I2
      if (baseLevel % 2 === 0) return x === 'R' ? baseLevel + 1 : x === 'AN' || x === 'EN' ? baseLevel + 2 : baseLevel;
      return x === 'L' || x === 'EN' || x === 'AN' ? baseLevel + 1 : baseLevel;
    });
  }
  /** L2: reverses every run at or above each level, from the highest down to the lowest odd one. */
  function reorder(items) {
    const max = Math.max(...items.map((x) => x.level)), minOdd = Math.min(...items.map((x) => x.level).filter((l) => l % 2) , max + 1);
    let out = items.slice();
    for (let k = max; k >= minOdd && k >= 1; k--) {
      const next = [];
      for (let i = 0; i < out.length;) {
        if (out[i].level < k) { next.push(out[i++]); continue; }
        let j = i; while (j < out.length && out[j].level >= k) j++;
        next.push(...out.slice(i, j).reverse());
        i = j;
      }
      out = next;
    }
    return out;
  }
  function segments(text, opts) {
    const o = opts || {}, chars = Array.from(String(text || '')), cps = chars.map((c) => c.codePointAt(0));
    if (!chars.length) return [];
    const base = o.base === 'rtl' || (o.base !== 'ltr' && baseOf(text) === 'rtl') ? 1 : 0;
    const lv = levels(cps, base);
    // the font of each character: its own, else the one before it, else the next one that has one
    const fonts = cps.map((cp) => (o.fontOf ? o.fontOf(cp) : null));
    let last = null;
    for (let i = 0; i < fonts.length; i++) { if (fonts[i] == null) fonts[i] = last; else last = fonts[i]; }
    let next = null;
    for (let i = fonts.length - 1; i >= 0; i--) { if (fonts[i] == null) fonts[i] = next; else next = fonts[i]; }
    const runs = [];
    for (let i = 0; i < chars.length; i++) {
      const r = runs[runs.length - 1];
      if (r && r.level === lv[i] && r.font === fonts[i]) r.text += chars[i];
      else runs.push({ text: chars[i], level: lv[i], font: fonts[i] });
    }
    return reorder(runs).map((r) => ({ text: r.text, rtl: r.level % 2 === 1, level: r.level, font: r.font }));
  }
  return { segments, baseOf, levels, typeOf };
});
