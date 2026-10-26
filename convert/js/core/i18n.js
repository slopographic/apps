/* File convert's words (shared/i18n/APPS-HOWTO.md). The tables convert/i18n/<code>/<part>.js are the one source of the
 * text: no English is kept in the code.
 *   tr(key, vars)  the text of a key in the chosen language, through SlopI18n; vars fill {name}, and vars.n picks the
 *                  plural form (key#one). A key no table holds comes back as the key.
 *   onLang(fn)     re-runs fn after a language change, once the new tables are in (for UI built once).
 *   ready()        resolves once the tables are in.
 * In a page, this module waits (top-level await) until the tables are in, so no code of convert runs without its words:
 * a page that has SlopI18n but not these tables (another app's Convert dialog, Slop Workflows, the ops) gets
 * convert/i18n/index.js added, and a page without SlopI18n at all (a test page) gets shared/i18n/i18n.js first.
 * In Node (the tests, tools/seo, the shared ops) there is no page: tr reads the English tables from disk (nodeTable), the
 * same files a page runs, so Node and the page say the same words. */
const g = globalThis;
const INDEX = new URL('../../i18n/index.js', import.meta.url).href;
const FRAMEWORK = new URL('../../../shared/i18n/i18n.js', import.meta.url).href;
const PROBE = 'convert.card.go';   // any key of the tables: present once they are in
const IN_NODE = !!(g.process && g.process.versions && g.process.versions.node);
let loading = null;

/** Adds a classic script once; resolves when it ran (or failed). */
function addScript(src) {
  const d = g.document;
  if ([...d.scripts].some((s) => s.src === src)) return Promise.resolve();
  return new Promise((res) => {
    const s = d.createElement('script');
    s.src = src;
    s.setAttribute('data-late', '');
    s.onload = s.onerror = () => res();
    (d.head || d.documentElement).appendChild(s);
  });
}

/** Brings the tables into a page that lacks them; resolves once they are in. */
function ensure() {
  const d = g.document;
  if (loading) return loading;
  if (IN_NODE || !d || !d.createElement) return (loading = Promise.resolve());
  loading = (async () => {
    if (!g.SlopI18n) await addScript(FRAMEWORK);
    const S = g.SlopI18n;
    if (!S || (S.has && S.has(PROBE))) return;
    await addScript(INDEX);
    if (S.ready) await S.ready();
  })();
  return loading;
}

/* ---- Node: the English tables, run as a page runs them (convert/i18n/index.js names the parts; ui.* from shared). */
let table = null;
function nodeTable() {
  if (table) return table;
  table = {};
  const get = g.process && g.process.getBuiltinModule;
  if (typeof get !== 'function' || !import.meta.url.startsWith('file:')) return table;
  const fs = get('node:fs'), vm = get('node:vm');
  const run = (href, api) => {
    const ctx = { SlopI18n: api, document: { currentScript: { src: href } } };
    ctx.window = ctx;
    vm.runInNewContext(fs.readFileSync(new URL(href), 'utf8'), ctx, { filename: href });
  };
  const add = (code, dict) => { if (code === 'en') Object.assign(table, dict); };
  let parts = [];
  run(INDEX, { source: (spec) => { parts = spec.parts || []; } });
  for (const p of parts) run(new URL(`../../i18n/en/${p}.js`, import.meta.url).href, { add });
  run(FRAMEWORK.replace(/i18n\.js$/, 'ui/en.js'), { add });
  return table;
}
let plural = null;
function fromNode(key, vars) {
  const tb = nodeTable();
  if (vars && typeof vars.n === 'number') {
    plural = plural || new Intl.PluralRules('en');
    const p = tb[key + '#' + plural.select(vars.n)];
    if (typeof p === 'string') return p;
  }
  return typeof tb[key] === 'string' ? tb[key] : null;
}
const show = (v) => (typeof v === 'number' && isFinite(v) ? v.toLocaleString('en') : String(v));

export function tr(key, vars) {
  const S = g.SlopI18n;
  if (S && S.has && S.has(key)) return S.t(key, vars);
  if (!IN_NODE) { ensure(); return key; }
  const s = fromNode(key, vars);
  if (s == null) return key;
  return vars ? s.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? show(vars[k]) : m)) : s;
}

export const ready = () => ensure();

export function onLang(fn) {
  if (!g.addEventListener) return () => {};
  const h = () => fn();
  g.addEventListener('slopi18n', h);
  return () => g.removeEventListener('slopi18n', h);
}

// In a page, the tables are in before any module that imports this one runs (a load that hangs is given up after 15 s).
if (!IN_NODE && g.document) {
  let timer = 0;
  await Promise.race([ensure(), new Promise((res) => { timer = setTimeout(res, 15000); })]);
  clearTimeout(timer);
}
