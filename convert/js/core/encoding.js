/* Text in an old or foreign encoding (Windows-1252, Latin-1, UTF-16, Shift_JIS …) rewritten as UTF-8. Pure: TextDecoder
 * only, which browsers and Node both have.
 *   ENCODINGS                                 [value, label] for the option: 'auto' first
 *   sniffEncoding(bytes) -> label             a byte-order mark says UTF-8 or UTF-16; text that decodes as UTF-8 is UTF-8;
 *                                             UTF-16 without a mark is told by its zero bytes; else Windows-1252 (which
 *                                             reads every byte, so a Latin-1 file comes out right too)
 *   toUtf8(bytes, { from, bom }) -> { text, from }   from: an ENCODINGS value; bom: start the text with a UTF-8 mark */
import { tr } from './i18n.js';

// The English of the labels (convert.enc.<value>, - as _); ENCODINGS reads them in the chosen language.
const ENC_EN = [
  ['auto', 'Detect'], ['windows-1252', 'Western (Windows-1252)'], ['iso-8859-1', 'Western (ISO-8859-1, Latin-1)'], // i18n-ignore: tr fallback
  ['iso-8859-15', 'Western with € (ISO-8859-15)'], ['macintosh', 'Western (Mac Roman)'], ['windows-1250', 'Central European (Windows-1250)'], // i18n-ignore: tr fallback
  ['iso-8859-2', 'Central European (ISO-8859-2)'], ['windows-1251', 'Cyrillic (Windows-1251)'], ['koi8-r', 'Cyrillic (KOI8-R)'], // i18n-ignore: tr fallback
  ['windows-1253', 'Greek (Windows-1253)'], ['windows-1254', 'Turkish (Windows-1254)'], ['windows-1255', 'Hebrew (Windows-1255)'], // i18n-ignore: tr fallback
  ['windows-1256', 'Arabic (Windows-1256)'], ['windows-874', 'Thai (Windows-874)'], ['shift_jis', 'Japanese (Shift_JIS)'], // i18n-ignore: tr fallback
  ['euc-jp', 'Japanese (EUC-JP)'], ['gb18030', 'Chinese, simplified (GB18030, GBK)'], ['big5', 'Chinese, traditional (Big5)'], // i18n-ignore: tr fallback
  ['euc-kr', 'Korean (EUC-KR)'], ['utf-16le', 'UTF-16 little-endian'], ['utf-16be', 'UTF-16 big-endian'], ['utf-8', 'UTF-8 (only remove bad bytes)'], // i18n-ignore: tr fallback
];
const keyOf = (v) => 'convert.enc.' + v.replace(/-/g, '_');
/** [value, label] pairs; the label (index 1) is read when it is shown, so it follows the language. */
export const ENCODINGS = ENC_EN.map(([v, en]) => {
  const pair = [v];
  Object.defineProperty(pair, 1, { enumerable: true, get: () => tr(keyOf(v), en) });
  return pair;
});
const EN = Object.fromEntries(ENC_EN);

export function sniffEncoding(b) {
  if (b[0] === 0xef && b[1] === 0xbb && b[2] === 0xbf) return 'utf-8';
  if (b[0] === 0xff && b[1] === 0xfe) return 'utf-16le';
  if (b[0] === 0xfe && b[1] === 0xff) return 'utf-16be';
  const n = Math.min(b.length, 4096);
  let evenZero = 0, oddZero = 0;
  for (let i = 0; i < n; i++) if (b[i] === 0) (i % 2 ? oddZero++ : evenZero++);
  if (n >= 4 && oddZero > n / 8 && evenZero === 0) return 'utf-16le';
  if (n >= 4 && evenZero > n / 8 && oddZero === 0) return 'utf-16be';
  try { new TextDecoder('utf-8', { fatal: true }).decode(b); return 'utf-8'; } catch (e) { return 'windows-1252'; }
}

export function toUtf8(bytes, { from = 'auto', bom = false } = {}) {
  const enc = !from || from === 'auto' ? sniffEncoding(bytes) : String(from).toLowerCase();
  let dec;
  try { dec = new TextDecoder(enc); } catch (e) { throw new Error(tr('convert.enc.cannot_read', 'This browser cannot read the {name} encoding.', { name: encodingLabel(enc) })); }
  let text = dec.decode(bytes);   // the decoder drops a byte-order mark of its own encoding
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
  return { text: (bom ? '\uFEFF' : '') + text, from: enc };
}

export const encodingLabel = (v) => (EN[v] ? tr(keyOf(v), EN[v]) : v);
