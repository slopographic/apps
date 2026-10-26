/* File convert's words (shared/i18n/APPS-HOWTO.md). The tables are convert/i18n/<code>/<part>.js.
 *   tr(key, en, vars)  the text of a key in the chosen language, through SlopI18n. en is the English of the key (the same
 *                      text as convert/i18n/en), used where the tables are not loaded: Node and the tests of the pure
 *                      converters, or another app's page before they arrive. en may be [other, one] for a plural.
 *   onLang(fn)         re-runs fn after a language change, once the new tables are in (for UI built once).
 * On a page that has SlopI18n but not these tables (another app's Convert dialog, Slop Workflows), the first tr() adds
 * convert/i18n/index.js, and the onLang listeners re-run when the tables are in. */
const g = globalThis;
const INDEX = new URL('../../i18n/index.js', import.meta.url).href;
let asked = false;

function ensure() {
  const S = g.SlopI18n, d = g.document;
  if (asked || !S || !d || !d.createElement) return;
  asked = true;
  if ([...d.scripts].some((s) => s.src === INDEX)) return;
  const s = d.createElement('script');
  s.src = INDEX;
  s.setAttribute('data-late', '');
  (d.head || d.documentElement).appendChild(s);
}

const show = (v) => (typeof v === 'number' && isFinite(v) ? v.toLocaleString('en') : String(v));

export function tr(key, en, vars) {
  ensure();
  const S = g.SlopI18n;
  if (S && S.has && S.has(key)) return S.t(key, vars);
  let s = Array.isArray(en) ? (vars && vars.n === 1 && en[1] != null ? en[1] : en[0]) : en;
  if (s == null) return key;
  return vars ? String(s).replace(/\{(\w+)\}/g, (m, k) => (k in vars ? show(vars[k]) : m)) : s;
}

export function onLang(fn) {
  if (!g.addEventListener) return () => {};
  const h = () => fn();
  g.addEventListener('slopi18n', h);
  return () => g.removeEventListener('slopi18n', h);
}
