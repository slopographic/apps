/* Language switcher foundation. Classic script, exposes window.SlopI18n. Load it in the <head> of a page, after
 * shared/profile/profile.js (and after shared/theme/theme.js). It loads its own string tables, lazily: the shared chrome
 * (shared/i18n/strings.js + <code>.js), the shared components (shared/i18n/ui/<code>.js), and an app's tables when the
 * page names them (an app's i18n/index.js calls source()). Only English and the chosen language are fetched.
 * The language list (LANGS) is data: add an entry to make a language choosable. A key the chosen language lacks is read
 * from English, so a page never shows an empty label. quality: 'beta' marks a table that has not had a native review.
 * Storage: the choice is kept in SlopProfile under appId 'lang', key 'mode' (default DEFAULT_CHOICE: 'en', or the brand
 * profile's defaultLang in a white-label build; opts.defaultLang in create() overrides it).
 * Use: t(key, vars) gives the text (English when the language lacks the key, the key itself when English lacks it too).
 * A number vars.n picks a plural form: 'key#one', 'key#few', ... (Intl.PluralRules of the language), else 'key'.
 * apply() sets lang and dir on <html> and replaces the text of [data-i18n="key"] elements and the attributes listed in
 * [data-i18n-attr="attr:key"] (several separated by ';'), filling {placeholders} from the element's data-i18n-vars (JSON)
 * and {brand} from the brand profile (brand/brand.js). num(), date(), money(), list() format with Intl in the language.
 * label(v, vars): t(v) when v is a known key, v() when a function, else v (how shared components take labels).
 * on(fn) calls fn whenever the language changes and its tables are in (the 'slopi18n' event on window).
 * create(opts) makes an independent instance (used by the node tests). See shared/i18n/HANDOFF.md and APPS-HOWTO.md. */
(function (g) {
  'use strict';
  var L = function (code, name, en, dir, extra) { return Object.freeze(Object.assign({ code: code, name: name, en: en, dir: dir, complete: true }, extra || {})); };
  var BETA = { quality: 'beta' };   // script: the stylesheet in shared/i18n/script/ the language needs (fonts, line breaks)
  var LANGS = Object.freeze([
    L('en', 'English', 'English', 'ltr'),
    L('es', 'Español', 'Spanish', 'ltr'),
    L('fr', 'Français', 'French', 'ltr'),
    L('de', 'Deutsch', 'German', 'ltr'),
    L('pt-BR', 'Português (Brasil)', 'Portuguese (Brazil)', 'ltr'),
    L('it', 'Italiano', 'Italian', 'ltr'),
    L('ar', 'العربية', 'Arabic', 'rtl'),
    L('sv', 'Svenska', 'Swedish', 'ltr', { appNames: true }),
    L('zh-CN', '简体中文', 'Chinese (Simplified)', 'ltr', { script: 'han-sc' }),
    L('zh-TW', '繁體中文', 'Chinese (Traditional)', 'ltr', { script: 'han-tc' }),
    L('ja', '日本語', 'Japanese', 'ltr', { script: 'jpan' }),
    L('ko', '한국어', 'Korean', 'ltr', { script: 'kore' }),
    L('hi', 'हिन्दी', 'Hindi', 'ltr', { script: 'deva' }),
    L('ru', 'Русский', 'Russian', 'ltr', { script: 'cyrl' }),
    L('uk', 'Українська', 'Ukrainian', 'ltr', { script: 'cyrl' }),
    L('pl', 'Polski', 'Polish', 'ltr'),
    L('nl', 'Nederlands', 'Dutch', 'ltr'),
    L('tr', 'Türkçe', 'Turkish', 'ltr'),
    L('id', 'Bahasa Indonesia', 'Indonesian', 'ltr'),
    L('vi', 'Tiếng Việt', 'Vietnamese', 'ltr', { script: 'viet' }),
    L('he', 'עברית', 'Hebrew', 'rtl', { script: 'hebr' }),
    L('sw', 'Kiswahili', 'Swahili', 'ltr', BETA),
    L('am', 'አማርኛ', 'Amharic', 'ltr', { quality: 'beta', script: 'ethi' }),
    L('ha', 'Hausa', 'Hausa', 'ltr', BETA),
    L('yo', 'Yorùbá', 'Yoruba', 'ltr', { quality: 'beta', script: 'viet' }),
    L('ig', 'Igbo', 'Igbo', 'ltr', { quality: 'beta', script: 'viet' }),
    L('zu', 'isiZulu', 'Zulu', 'ltr', BETA),
    L('xh', 'isiXhosa', 'Xhosa', 'ltr', BETA),
    L('af', 'Afrikaans', 'Afrikaans', 'ltr', BETA),
  ]);
  var DEFAULT = 'en';   // the fallback language: a key missing in the chosen language is read from here
  // The language a visitor gets when nothing is stored. The white-label build (tools/whitelabel) rewrites the literal after
  // the marker from the brand profile's defaultLang; keep it on one line.
  var DEFAULT_CHOICE = /*profile:defaultLang*/'en';
  var KEY_RE = /\{(\w+)\}/g;
  // The shared components' tables beyond ui/<code>.js: shared/i18n/ui/<code>/<part>.js, for the languages that have them
  // (the others read English). Written by node tools/i18n/i18n.mjs index ui; keep it on one line.
  var UI_PARTS = /*ui-parts*/{ parts: ['ai', 'ai2', 'ai5', 'ai6', 'ai7', 'ai8', 'firstrun', 'guides', 'models', 'ops', 'ops2', 'ops3', 'preview', 'watermark', 'widgets'], langs: ['en', 'sv'] };
  var me = typeof document !== 'undefined' ? document.currentScript : null;

  function create(opts) {
    opts = opts || {};
    var doc = opts.document !== undefined ? opts.document : (typeof document !== 'undefined' ? document : null);
    var list = opts.languages || LANGS;
    var byCode = {};
    list.forEach(function (l) { byCode[l.code] = l; });
    var choice = typeof opts.defaultLang === 'string' ? opts.defaultLang : DEFAULT_CHOICE;
    if (!byCode[choice]) choice = DEFAULT;
    var tables = {}, sources = [], fetched = {}, pending = [], rules = {}, fmts = {};
    var applied = null;   // the brand name the last apply() filled in
    var prof = opts.profile !== undefined ? opts.profile : (g.SlopProfile && typeof g.SlopProfile.create === 'function'
      ? g.SlopProfile.create({
        storage: opts.storage,
        options: { lang: { mode: { label: 'Language', type: 'enum', values: list.map(function (l) { return l.code; }), default: choice } } },
      })
      : null);

    /** The stored language code, or the default choice when nothing is stored or the stored one is not in the list. */
    function get() {
      var c = prof ? prof.get('lang', 'mode', choice) : choice;
      return byCode[c] ? c : choice;
    }
    /** The string for a key in one language, or null when that language does not have it. */
    function find(code, key) {
      var t = tables[code];
      return t && Object.prototype.hasOwnProperty.call(t, key) && typeof t[key] === 'string' ? t[key] : null;
    }
    function fill(s, vars) {
      if (!vars) return s;
      return s.replace(KEY_RE, function (m, name) {
        if (!Object.prototype.hasOwnProperty.call(vars, name)) return m;
        var v = vars[name];
        return typeof v === 'number' ? num(v) : String(v);
      });
    }
    /** The CLDR plural category of n in a language: 'one', 'few', 'many', 'other', ... ('other' without Intl). */
    function pluralOf(code, n) {
      try { return (rules[code] = rules[code] || new Intl.PluralRules(code)).select(n); } catch (e) { return n === 1 ? 'one' : 'other'; }
    }
    /** A key in one language: the plural form for vars.n first ('key#one'), then the plain key. */
    function lookup(code, key, vars) {
      if (vars && typeof vars.n === 'number') { var p = find(code, key + '#' + pluralOf(code, vars.n)); if (p !== null) return p; }
      return find(code, key);
    }
    /** The brand's name for {brand}: the white-label profile's (brand/brand.js), else this site's. */
    function brand() {
      var b = g.SlopBrand && g.SlopBrand.config;
      return b && typeof b.name === 'string' && b.name ? b.name : 'Slopographic';
    }
    /** Text for a key in the chosen language, falling back to English, then to the key itself. */
    function t(key, vars) {
      var s = lookup(get(), key, vars);
      if (s === null) s = lookup(DEFAULT, key, vars);
      if (s === null) return key;
      return fill(s, Object.assign({ brand: brand() }, vars || {}));
    }
    /** True when the key has a string in the chosen language or in English. */
    function has(key) { return find(get(), key) !== null || find(DEFAULT, key) !== null; }
    /** A label a shared component was given: a function is called, a string that is a key is translated, any other
     * string is the user's own text. Components keep the value and call label() again on every change (live switch). */
    function label(v, vars) { if (typeof v === 'function') v = v(vars); return typeof v === 'string' && has(v) ? t(v, vars) : v; }
    /** Adds strings for one language code. Later calls add or replace keys; nothing is removed. */
    function add(code, dict) {
      if (!dict || typeof dict !== 'object') return;
      tables[code] = Object.assign(tables[code] || {}, dict);
    }
    /* ---- Intl, in the chosen language */
    function intl(kind, opt) {
      var code = get(), id = kind + code + JSON.stringify(opt || {});
      if (!fmts[id]) { try { fmts[id] = new Intl[kind](code, opt); } catch (e) { fmts[id] = new Intl[kind]('en', opt); } }
      return fmts[id];
    }
    function num(n, opt) { return typeof n === 'number' && isFinite(n) ? intl('NumberFormat', opt).format(n) : String(n); }
    function date(d, opt) { var v = d instanceof Date ? d : new Date(d); return isNaN(v) ? '' : intl('DateTimeFormat', opt || { dateStyle: 'medium' }).format(v); }
    function money(n, currency, opt) { return num(n, Object.assign({ style: 'currency', currency: currency || 'EUR' }, opt || {})); }
    function listOf(items, opt) { try { return intl('ListFormat', opt || { type: 'conjunction' }).format(items.map(String)); } catch (e) { return items.join(', '); } }

    /** Sets lang and dir on <html>, and replaces the text and attributes of the marked elements. A key missing in the
     * chosen language and in English leaves the element as it is (the HTML holds the English text). */
    function apply(scope) {
      if (!doc || !doc.documentElement) return get();
      var code = get(), root = doc.documentElement;
      applied = brand();
      root.setAttribute('lang', code);
      root.setAttribute('dir', byCode[code].dir === 'rtl' ? 'rtl' : 'ltr');
      var at = scope && scope.querySelectorAll ? scope : doc;
      var varsOf = function (el) {
        var v = { brand: brand() }, raw = el.getAttribute('data-i18n-vars');
        if (raw) { try { Object.assign(v, JSON.parse(raw)); } catch (e) { /* not JSON: no vars */ } }
        return v;
      };
      var pick = function (key, el) { var s = find(code, key); if (s === null) s = find(DEFAULT, key); return s === null ? null : fill(s, varsOf(el)); };
      var nodes = at.querySelectorAll('[data-i18n]');
      for (var i = 0; i < nodes.length; i++) {
        var s = pick(nodes[i].getAttribute('data-i18n'), nodes[i]);
        if (s !== null) nodes[i].textContent = s;
      }
      nodes = at.querySelectorAll('[data-i18n-attr]');
      for (var j = 0; j < nodes.length; j++) {
        nodes[j].getAttribute('data-i18n-attr').split(';').forEach(function (pair) {
          var c = pair.indexOf(':');
          if (c < 1) return;
          var v = pick(pair.slice(c + 1).trim(), nodes[j]);
          if (v !== null) nodes[j].setAttribute(pair.slice(0, c).trim(), v);
        });
      }
      return code;
    }
    /* ---- Loading: a source is { ns, files(code) → [url, ...] }. English and the chosen language are fetched, once. */
    var offline = function () { return !!(doc && doc.querySelector && doc.querySelector('meta[content="offline"]')); };
    /** The chosen language's script stylesheet (shared/i18n/script/<script>.css: local font fallbacks, line breaking). */
    var cssRoot = '';
    function style(code, parsing) {
      var l = byCode[code], href = l && l.script && cssRoot ? cssRoot + 'script/' + l.script + '.css' : '';
      if (!href || fetched[href]) return;
      fetched[href] = Promise.resolve(true);
      if (parsing) { doc.write('<link rel="stylesheet" href="' + href + '">'); return; }
      var k = doc.createElement('link');
      k.rel = 'stylesheet'; k.href = href;
      (doc.head || doc.documentElement).appendChild(k);
    }
    function fetchOne(url, parsing) {
      if (fetched[url]) return fetched[url];
      if (parsing) { doc.write('<script src="' + url.replace(/"/g, '&quot;') + '"><\/script>'); return (fetched[url] = Promise.resolve(true)); }
      return (fetched[url] = new Promise(function (res) {
        var s = doc.createElement('script');
        s.src = url; s.async = false;
        s.onload = function () { res(true); };
        s.onerror = function () { res(false); };
        (doc.head || doc.documentElement).appendChild(s);
      }));
    }
    /** Fetches the tables of every source for English and a language (default: the chosen one). Resolves once they ran. */
    function need(code, parsing) {
      code = code || get();
      if (!doc || !doc.createElement || offline()) return Promise.resolve(true);
      style(code, parsing);
      var codes = code === DEFAULT ? [DEFAULT] : [DEFAULT, code];
      var p = [];
      sources.forEach(function (src) { codes.forEach(function (c) { src.files(c).forEach(function (u) { p.push(fetchOne(u, parsing)); }); }); });
      var all = Promise.all(p);
      pending.push(all);
      return all;
    }
    /** Registers a table source. spec: { ns, base (folder URL, ends in /), parts: ['menus', ...], langs: ['en', 'sv', ...] }
     * for app tables at <base><code>/<part>.js, or { ns, files: function (code) { return [urls]; } }. A language not in
     * langs is not fetched (it falls back to English). At parse time the tables are written into the page, so they run
     * before the scripts that follow; later they are added and the page re-applies when they are in. */
    function source(spec) {
      if (!spec || !spec.ns || sources.some(function (s) { return s.ns === spec.ns; })) return;
      var files = spec.files || function (code) {
        return (spec.langs || [DEFAULT]).indexOf(code) < 0 ? [] : (spec.parts || ['main']).map(function (p) { return spec.base + code + '/' + p + '.js'; });
      };
      sources.push({ ns: spec.ns, files: files });
      var parsing = !!(doc && doc.readyState === 'loading' && doc.currentScript && !doc.currentScript.hasAttribute('data-late'));
      need(get(), parsing).then(function () { if (!parsing) changed(); });
    }
    /** Resolves when every table asked for so far has run. */
    function ready() { return Promise.all(pending.slice()).then(function () { return get(); }); }
    function emit(name) {
      try { if (g.dispatchEvent && g.CustomEvent) g.dispatchEvent(new g.CustomEvent(name, { detail: { code: get() } })); } catch (e) { /* older browser */ }
    }
    /** The tables of the chosen language are in: apply the marked elements and tell JS-built UI ('slopi18n'). */
    function changed() { apply(); emit('slopi18n'); }
    /** Calls fn() after every language change, once the new tables are in. Returns a function that stops it. */
    function on(fn) {
      if (!g.addEventListener) return function () {};
      var h = function () { fn(get()); };
      g.addEventListener('slopi18n', h);
      return function () { g.removeEventListener('slopi18n', h); };
    }
    /** Saves a language code, applies it on this page and tells listeners ('slop-lang' now, 'slopi18n' once its tables are in). */
    function set(code) {
      if (!byCode[code]) return { ok: false, error: 'That language is not in the list.' };
      if (!prof) return { ok: false, error: 'Could not save: browser storage is blocked.' };
      var r = prof.set('lang', 'mode', code);
      if (!r.ok) return r;
      apply();
      emit('slop-lang');
      need(code).then(changed);
      return { ok: true, code: code };
    }
    /** Runs at first paint from the page's <head>: sets the language on <html> now, and the text once the DOM is ready. */
    function load() {
      if (!doc || !doc.documentElement) return;
      if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', function () { apply(); }); else apply();
      try { g.addEventListener && g.addEventListener('storage', function (ev) { if (!ev.key || ev.key === 'slop-profile') { apply(); need().then(changed); } }); } catch (e) { /* no storage events */ }
      // {brand} follows the profile's name once it is in (only when it differs: a rewrite of every label moves the page)
      if (doc.addEventListener) doc.addEventListener('slopbrand', function () { if (brand() !== applied) apply(); });
      var root = me && me.src ? me.src.replace(/[^/]*$/, '') : '';
      if (!root) return;
      cssRoot = root;
      source({ ns: 'chrome', files: function (c) {
        if (c === DEFAULT) return [root + 'strings.js'];
        return [root + c + '.js'].concat(byCode[c] && byCode[c].appNames ? [root + c + '-apps.js'] : []);
      } });
      source({ ns: 'ui', files: function (c) {
        return [root + 'ui/' + c + '.js'].concat(UI_PARTS.langs.indexOf(c) < 0 ? [] : UI_PARTS.parts.map(function (p) { return root + 'ui/' + c + '/' + p + '.js'; }));
      } });
    }
    return {
      LANGS: list,
      UI_PARTS: UI_PARTS,
      DEFAULT: DEFAULT,
      DEFAULT_CHOICE: choice,
      langs: function () { return list.slice(); },
      lang: function (code) { return byCode[code || get()] || null; },
      get: get,
      set: set,
      t: t,
      has: has,
      label: label,
      add: add,
      apply: apply,
      load: load,
      source: source,
      need: need,
      ready: ready,
      on: on,
      plural: function (n) { return pluralOf(get(), n); },
      num: num,
      date: date,
      money: money,
      list: listOf,
      create: create,
    };
  }

  var api = create();
  g.SlopI18n = Object.freeze(api);
  api.load();
})(typeof window !== 'undefined' ? window : globalThis);
