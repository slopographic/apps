/* SlopScripts: which writing system a character belongs to, and which language font pack (shared/library/packs.json,
 * ids noto-*) can set it. Pure, no DOM: the Node tests load it (module.exports) and the browser gets window.SlopScripts.
 *   scriptOf(cp) -> 'latin' | 'greek' | 'cyrillic' | 'arabic' | 'hebrew' | 'devanagari' | … | 'han' | 'kana' | 'hangul'
 *                   | 'common' (spaces, digits, punctuation, symbols: set in whatever font is around them)
 *   packOf(cp, { han }) -> the pack id that sets cp ('noto-arabic' …), or null for 'common'. han: 'sc' | 'tc' | 'jp' | 'kr'
 *                   picks the Chinese characters' pack (kana and hangul always pick jp and kr).
 *   hanFor(text, lang) -> 'jp' when the text has kana, 'kr' when it has hangul, else from the language tag
 *                   (zh-TW, zh-HK, zh-Hant -> tc; ja -> jp; ko -> kr), else 'sc'.
 *   isRtl(cp) -> true for the right-to-left scripts (Arabic, Hebrew, Thaana, Syriac, N'Ko).
 *   PACKS: { id: { label, scripts } } for the language packs; packsFor(text, covered, opts) -> the packs a text needs
 *   beyond what covered(cp) says the current font can set. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.SlopScripts = api;
})(typeof window !== 'undefined' ? window : globalThis, function () {
  'use strict';
  // [first, last, script], sorted by first code point. Code points in no range are 'common'.
  const RANGES = [
    [0x0041, 0x005a, 'latin'], [0x0061, 0x007a, 'latin'], [0x00aa, 0x00aa, 'latin'], [0x00ba, 0x00ba, 'latin'],
    [0x00c0, 0x00d6, 'latin'], [0x00d8, 0x00f6, 'latin'], [0x00f8, 0x024f, 'latin'], [0x0250, 0x02af, 'latin'],
    [0x0370, 0x03ff, 'greek'], [0x0400, 0x052f, 'cyrillic'], [0x0530, 0x058f, 'armenian'], [0x0590, 0x05ff, 'hebrew'],
    [0x0600, 0x065f, 'arabic'], [0x0660, 0x0669, 'arabic-digit'], [0x066a, 0x06ef, 'arabic'], [0x06f0, 0x06f9, 'arabic-digit'],
    [0x06fa, 0x06ff, 'arabic'], [0x0700, 0x074f, 'syriac'], [0x0750, 0x077f, 'arabic'], [0x0780, 0x07bf, 'thaana'],
    [0x07c0, 0x07ff, 'nko'], [0x08a0, 0x08ff, 'arabic'], [0x0900, 0x097f, 'devanagari'], [0x0980, 0x09ff, 'bengali'],
    [0x0a00, 0x0a7f, 'gurmukhi'], [0x0a80, 0x0aff, 'gujarati'], [0x0b00, 0x0b7f, 'oriya'], [0x0b80, 0x0bff, 'tamil'],
    [0x0c00, 0x0c7f, 'telugu'], [0x0c80, 0x0cff, 'kannada'], [0x0d00, 0x0d7f, 'malayalam'], [0x0d80, 0x0dff, 'sinhala'],
    [0x0e00, 0x0e7f, 'thai'], [0x0e80, 0x0eff, 'lao'], [0x0f00, 0x0fff, 'tibetan'], [0x1000, 0x109f, 'myanmar'],
    [0x10a0, 0x10ff, 'georgian'], [0x1100, 0x11ff, 'hangul'], [0x1200, 0x139f, 'ethiopic'], [0x13a0, 0x13ff, 'cherokee'],
    [0x1780, 0x17ff, 'khmer'], [0x1800, 0x18af, 'mongolian'], [0x19e0, 0x19ff, 'khmer'], [0x1c80, 0x1c8f, 'cyrillic'],
    [0x1e00, 0x1eff, 'latin'], [0x1f00, 0x1fff, 'greek'], [0x2c60, 0x2c7f, 'latin'], [0x2d00, 0x2d2f, 'georgian'],
    [0x2d80, 0x2ddf, 'ethiopic'], [0x2de0, 0x2dff, 'cyrillic'], [0x2e80, 0x2fdf, 'han'], [0x3001, 0x303f, 'han'],
    [0x3040, 0x30ff, 'kana'], [0x3130, 0x318f, 'hangul'], [0x31f0, 0x31ff, 'kana'], [0x3400, 0x4dbf, 'han'],
    [0x4e00, 0x9fff, 'han'], [0xa640, 0xa69f, 'cyrillic'], [0xa720, 0xa7ff, 'latin'], [0xa8e0, 0xa8ff, 'devanagari'],
    [0xab70, 0xabbf, 'cherokee'], [0xac00, 0xd7af, 'hangul'], [0xf900, 0xfaff, 'han'], [0xfb1d, 0xfb4f, 'hebrew'],
    [0xfb50, 0xfdff, 'arabic'], [0xfe70, 0xfeff, 'arabic'], [0xff01, 0xff5e, 'han'], [0xff66, 0xff9f, 'kana'],
    [0xffa0, 0xffdc, 'hangul'], [0x20000, 0x2fa1f, 'han'],
  ];
  const PACKS = {
    'noto-sans': { label: 'Latin, Greek and Cyrillic', scripts: ['latin', 'greek', 'cyrillic'] },
    'noto-arabic': { label: 'Arabic', scripts: ['arabic', 'arabic-digit'] }, 'noto-hebrew': { label: 'Hebrew', scripts: ['hebrew'] },
    'noto-devanagari': { label: 'Devanagari (Hindi, Marathi, Nepali)', scripts: ['devanagari'] }, 'noto-bengali': { label: 'Bengali', scripts: ['bengali'] },
    'noto-tamil': { label: 'Tamil', scripts: ['tamil'] }, 'noto-telugu': { label: 'Telugu', scripts: ['telugu'] },
    'noto-kannada': { label: 'Kannada', scripts: ['kannada'] }, 'noto-malayalam': { label: 'Malayalam', scripts: ['malayalam'] },
    'noto-gujarati': { label: 'Gujarati', scripts: ['gujarati'] }, 'noto-gurmukhi': { label: 'Gurmukhi (Punjabi)', scripts: ['gurmukhi'] },
    'noto-oriya': { label: 'Odia', scripts: ['oriya'] }, 'noto-sinhala': { label: 'Sinhala', scripts: ['sinhala'] },
    'noto-thai': { label: 'Thai', scripts: ['thai'] }, 'noto-lao': { label: 'Lao', scripts: ['lao'] }, 'noto-khmer': { label: 'Khmer', scripts: ['khmer'] },
    'noto-myanmar': { label: 'Myanmar (Burmese)', scripts: ['myanmar'] }, 'noto-georgian': { label: 'Georgian', scripts: ['georgian'] },
    'noto-armenian': { label: 'Armenian', scripts: ['armenian'] }, 'noto-ethiopic': { label: 'Ethiopic (Amharic)', scripts: ['ethiopic'] },
    'noto-tibetan': { label: 'Tibetan', scripts: ['tibetan'] }, 'noto-thaana': { label: 'Thaana (Dhivehi)', scripts: ['thaana'] },
    'noto-mongolian': { label: 'Mongolian', scripts: ['mongolian'] }, 'noto-cherokee': { label: 'Cherokee', scripts: ['cherokee'] },
    'noto-sc': { label: 'Chinese (simplified)', scripts: [] }, 'noto-tc': { label: 'Chinese (traditional)', scripts: [] },
    'noto-jp': { label: 'Japanese', scripts: ['kana'] }, 'noto-kr': { label: 'Korean', scripts: ['hangul'] },
  };
  const BY_SCRIPT = {};
  for (const [id, p] of Object.entries(PACKS)) for (const s of p.scripts) BY_SCRIPT[s] = id;
  const RTL = new Set(['arabic', 'hebrew', 'thaana', 'syriac', 'nko']);

  function scriptOf(cp) {
    let lo = 0, hi = RANGES.length - 1;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1, r = RANGES[mid];
      if (cp < r[0]) hi = mid - 1; else if (cp > r[1]) lo = mid + 1; else return r[2];
    }
    return 'common';
  }
  const isRtl = (cp) => RTL.has(scriptOf(cp));
  function hanFor(text, lang) {
    for (const ch of String(text || '')) { const s = scriptOf(ch.codePointAt(0)); if (s === 'kana') return 'jp'; if (s === 'hangul') return 'kr'; }
    const l = String(lang || '').toLowerCase();
    if (/^zh-(tw|hk|mo)|^zh-hant/.test(l)) return 'tc';
    if (l.startsWith('ja')) return 'jp';
    if (l.startsWith('ko')) return 'kr';
    return 'sc';
  }
  function packOf(cp, opts) {
    const s = scriptOf(cp);
    if (s === 'han') return 'noto-' + ((opts && opts.han) || 'sc');
    return BY_SCRIPT[s] || null;
  }
  /** The packs a text needs: one for each character covered(cp) cannot set (in the order first met). */
  function packsFor(text, covered, opts) {
    const out = [];
    for (const ch of String(text || '')) {
      const cp = ch.codePointAt(0);
      if (ch === '\n' || (covered && covered(cp))) continue;
      const p = packOf(cp, opts);
      if (p && !out.includes(p)) out.push(p);
    }
    return out;
  }

  return { scriptOf, packOf, hanFor, isRtl, packsFor, PACKS, RANGES };
});
