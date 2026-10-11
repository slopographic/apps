/* Language switcher foundation. Classic script, exposes window.SlopI18n. Load it in the <head> of a page, after
 * shared/profile/profile.js (and after shared/theme/theme.js), then its strings file: shared/i18n/strings.js.
 * The language list (LANGS) is data: add an entry to make a language choosable. A language that is not complete falls
 * back to English key by key, so a page never shows an empty label.
 * Storage: the choice is kept in SlopProfile under appId 'lang', key 'mode' (default 'en').
 * Use: t(key, vars) gives the text (English when the language lacks the key, the key itself when English lacks it too).
 * apply() sets lang and dir on <html> and replaces the text of [data-i18n="key"] elements and the attributes listed in
 * [data-i18n-attr="attr:key"] (several separated by ';'). It runs at first paint of the body and after every set().
 * create(opts) makes an independent instance (used by the node tests). See shared/i18n/HANDOFF.md. */
(function (g) {
  'use strict';
  var LANGS = Object.freeze([
    Object.freeze({ code: 'en', name: 'English', dir: 'ltr', complete: true }),
  ]);
  var DEFAULT = 'en';
  var KEY_RE = /\{(\w+)\}/g;

  function create(opts) {
    opts = opts || {};
    var doc = opts.document !== undefined ? opts.document : (typeof document !== 'undefined' ? document : null);
    var list = opts.languages || LANGS;
    var byCode = {};
    list.forEach(function (l) { byCode[l.code] = l; });
    var tables = {};
    var prof = opts.profile !== undefined ? opts.profile : (g.SlopProfile && typeof g.SlopProfile.create === 'function'
      ? g.SlopProfile.create({
        storage: opts.storage,
        options: { lang: { mode: { label: 'Language', type: 'enum', values: list.map(function (l) { return l.code; }), default: DEFAULT } } },
      })
      : null);

    /** The stored language code, or the default when the stored one is not in the list. */
    function get() {
      var c = prof ? prof.get('lang', 'mode', DEFAULT) : DEFAULT;
      return byCode[c] ? c : DEFAULT;
    }
    /** The string for a key in one language, or null when that language does not have it. */
    function find(code, key) {
      var t = tables[code];
      return t && Object.prototype.hasOwnProperty.call(t, key) && typeof t[key] === 'string' ? t[key] : null;
    }
    function fill(s, vars) {
      if (!vars) return s;
      return s.replace(KEY_RE, function (m, name) { return Object.prototype.hasOwnProperty.call(vars, name) ? String(vars[name]) : m; });
    }
    /** Text for a key in the chosen language, falling back to English, then to the key itself. */
    function t(key, vars) {
      var s = find(get(), key);
      if (s === null) s = find(DEFAULT, key);
      if (s === null) return key;
      return fill(s, vars);
    }
    /** Adds strings for one language code. Later calls add or replace keys; nothing is removed. */
    function add(code, dict) {
      if (!dict || typeof dict !== 'object') return;
      tables[code] = Object.assign(tables[code] || {}, dict);
    }
    /** Sets lang and dir on <html>, and replaces the text and attributes of the marked elements. A key missing in the
     * chosen language and in English leaves the element as it is (the HTML holds the English text). */
    function apply() {
      if (!doc || !doc.documentElement) return get();
      var code = get(), root = doc.documentElement;
      root.setAttribute('lang', code);
      root.setAttribute('dir', byCode[code].dir === 'rtl' ? 'rtl' : 'ltr');
      var pick = function (key) { var s = find(code, key); return s === null ? find(DEFAULT, key) : s; };
      var nodes = doc.querySelectorAll('[data-i18n]');
      for (var i = 0; i < nodes.length; i++) {
        var s = pick(nodes[i].getAttribute('data-i18n'));
        if (s !== null) nodes[i].textContent = s;
      }
      nodes = doc.querySelectorAll('[data-i18n-attr]');
      for (var j = 0; j < nodes.length; j++) {
        nodes[j].getAttribute('data-i18n-attr').split(';').forEach(function (pair) {
          var at = pair.indexOf(':');
          if (at < 1) return;
          var v = pick(pair.slice(at + 1).trim());
          if (v !== null) nodes[j].setAttribute(pair.slice(0, at).trim(), v);
        });
      }
      return code;
    }
    /** Saves a language code, applies it on this page and tells listeners ('slop-lang'). */
    function set(code) {
      if (!byCode[code]) return { ok: false, error: 'That language is not in the list.' };
      if (!prof) return { ok: false, error: 'Could not save: browser storage is blocked.' };
      var r = prof.set('lang', 'mode', code);
      if (!r.ok) return r;
      apply();
      try { if (g.dispatchEvent && g.CustomEvent) g.dispatchEvent(new g.CustomEvent('slop-lang', { detail: { code: code } })); } catch (e) { /* older browser */ }
      return { ok: true, code: code };
    }
    /** Runs at first paint from the page's <head>: sets the language on <html> now, and the text once the DOM is ready. */
    function load() {
      if (!doc || !doc.documentElement) return;
      if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', apply); else apply();
      try { g.addEventListener && g.addEventListener('storage', function (ev) { if (!ev.key || ev.key === 'slop-profile') apply(); }); } catch (e) { /* no storage events */ }
    }
    return {
      LANGS: list,
      DEFAULT: DEFAULT,
      langs: function () { return list.slice(); },
      get: get,
      set: set,
      t: t,
      add: add,
      apply: apply,
      load: load,
      create: create,
    };
  }

  var api = create();
  g.SlopI18n = Object.freeze(api);
  api.load();
})(typeof window !== 'undefined' ? window : globalThis);
