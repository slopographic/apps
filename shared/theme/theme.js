/* Slopographic theme: one choice for every page (System, Light, Dark, Classic 98, Slopographic Lime).
 * Classic script, exposes window.SlopTheme. Load it in the <head> of every page, after shared/profile/profile.js, with
 * data-app on the script tag: "home" for the homepage, "settings" for Settings, the app's folder name for an app, and
 * nothing for any other page. It runs before first paint: it reads the choice, sets data-theme and the --sl-* variables,
 * and injects the override styles ahead of every app stylesheet.
 * Storage: the choice is kept in SlopProfile under appId 'theme', key 'mode' (default 'system', so 'system' is stored as
 * no override). Each app's own theme key is mirrored from that choice, so an app that reads its key at boot shows the
 * same theme. Where an app's key differs from the choice, the app's key wins on that page (a theme changed in the
 * app's own menu). A person who never chose a theme keeps the one in their old app keys. The legacy keys are listed in
 * APPS below and in storage/INVENTORY.md. */
(function (g) {
  'use strict';
  var doc = typeof document !== 'undefined' ? document : null;
  var DEFAULT = 'system';
  var SYSTEM = 'system';

  function th(id, name, scheme, bg, surface, text, accent, border) {
    return { id: id, name: name, scheme: scheme, tokens: { background: bg, surface: surface, text: text, accent: accent, border: border } };
  }
  /** The real themes. Every theme has all five tokens; System resolves to one of these. */
  var THEMES = Object.freeze([
    th('light', 'Light', 'light', '#ebe7de', '#f8f6f1', '#0a0a0a', '#5f7d00', '#dcd6c9'),
    th('dark', 'Dark', 'dark', '#0a0a0a', '#151518', '#f1ede4', '#d4ff3a', '#2a2a30'),
    th('classic', 'Classic 98', 'light', '#c0c0c0', '#ffffff', '#000000', '#000080', '#808080'),
    th('lime', 'Slopographic Lime', 'dark', '#0d1206', '#171f0c', '#f1ffb8', '#d4ff3a', '#33461a'),
  ]);
  var IDS = THEMES.map(function (t) { return t.id; });
  var byId = {};
  THEMES.forEach(function (t) { byId[t.id] = t; });

  /* Native values each app's own CSS and boot code understand, per shared theme id. */
  var STD = { light: 'light', dark: 'pro', classic: 'classic', lime: 'pro' };       // Light, Pro and Classic 98
  var NO_CLASSIC = { light: 'light', dark: 'pro', classic: 'pro', lime: 'pro' };    // Light and Pro only
  var DARK_CSS = { light: 'light', dark: 'dark', classic: 'dark', lime: 'dark' };   // data-theme light or dark only
  /* Each app's legacy key: fmt 'json' (a JSON string), 'raw' (a plain string) or 'prefs' (the theme field of a JSON object).
   * identity: the page uses the shared id as data-theme. Apps not listed keep their own data-theme and get the variables. */
  var APPS = {
    home: { identity: true },
    settings: { identity: true },
    drive: { key: 'slop-drive.theme', fmt: 'json', native: STD },
    ai: { key: 'slop-ai.prefs', fmt: 'prefs', native: STD },
    admin: { key: 'slop-admin.theme', fmt: 'json', native: NO_CLASSIC },
    cutout: { key: 'slop-cutout.theme', fmt: 'json', native: STD },
    slopedit: { key: 'slopedit.theme', fmt: 'json', native: STD },
    pdf: { key: 'slop-pdf.theme', fmt: 'json', native: STD },
    docs: { key: 'slop-docs.theme', fmt: 'json', native: NO_CLASSIC },
    tables: { key: 'slop-tables.theme', fmt: 'json', native: NO_CLASSIC },
    crm: { key: 'slop-crm.theme', fmt: 'json', native: NO_CLASSIC },
    invoices: { key: 'slop-invoices.theme', fmt: 'json', native: NO_CLASSIC },
    orders: { key: 'slop-orders.theme', fmt: 'json', native: NO_CLASSIC },
    ledger: { key: 'slop-ledger.theme', fmt: 'json', native: NO_CLASSIC },
    press: { key: 'slop.press.theme', fmt: 'json', native: STD },
    gallery: { key: 'slop-gallery.theme', fmt: 'json', native: NO_CLASSIC },
    '3d': { key: 'slop-3d.theme', fmt: 'json', native: NO_CLASSIC },
    inventory: { key: 'slop-inventory.theme', fmt: 'json', native: NO_CLASSIC },
    vector: { key: 'slopvector.theme', fmt: 'raw', native: STD },
    label: { key: 'sloplabel-theme', fmt: 'raw', native: STD },
    contacts: { key: null, native: DARK_CSS },
  };

  /* Overrides for the app pages: surface, text and accent only (apps keep their own background and borders). The homepage
   * and Settings take the background and border too. --sl-on-accent is the ink or white that reads on the accent. */
  var CSS = [
    'html:root[data-slop-theme]{--panel:var(--sl-surface);--surface:var(--sl-surface);--fg:var(--sl-text);--text:var(--sl-text);',
    '--accent:var(--sl-accent);--accent-ink:var(--sl-on-accent)}',
    'html:root[data-slop-theme][data-slop-app=home],html:root[data-slop-theme][data-slop-app=settings]{',
    '--bg:var(--sl-background);--ink:var(--sl-background);--ink-2:var(--sl-surface);--ink-3:var(--sl-surface);',
    '--bone:var(--sl-text);--bone-dim:color-mix(in srgb,var(--sl-text) 62%,transparent);',
    '--bone-faint:color-mix(in srgb,var(--sl-text) 38%,transparent);--line:var(--sl-border);',
    '--slop:var(--sl-accent);--slop-deep:var(--sl-accent)}',
  ].join('');

  var prof = g.SlopProfile && typeof g.SlopProfile.create === 'function'
    ? g.SlopProfile.create({ options: { theme: { mode: { label: 'Theme', type: 'enum', values: [SYSTEM].concat(IDS), default: DEFAULT } } } })
    : null;
  var page = { app: '', choice: DEFAULT };
  var watching = false;

  function store() { try { return g.localStorage || null; } catch (e) { return null; } }
  function prefersLight() { try { return !!(g.matchMedia && g.matchMedia('(prefers-color-scheme: light)').matches); } catch (e) { return false; } }
  function resolve(choice) {
    if (choice === SYSTEM) return prefersLight() ? 'light' : 'dark';
    return byId[choice] ? choice : 'dark';
  }
  function native(entry, id) { return entry.identity ? id : entry.native[id]; }
  /** The shared choice that an app's native value stands for ('system' for the System choice, null if unknown). */
  function fromNative(entry, v) {
    if (v === SYSTEM) return SYSTEM;
    for (var i = 0; i < IDS.length; i++) if (entry.native[IDS[i]] === v) return IDS[i];
    return null;
  }
  function legacyRead(e) {
    var s = store();
    if (!s || !e.key) return null;
    try {
      var raw = s.getItem(e.key);
      if (raw === null) return null;
      if (e.fmt === 'raw') return raw;
      var v = JSON.parse(raw);
      return e.fmt === 'prefs' ? (v && typeof v === 'object' ? v.theme : null) : v;
    } catch (err) { return null; }
  }
  function legacyWrite(e, value) {
    var s = store();
    if (!s || !e.key) return;
    try {
      if (e.fmt === 'raw') { s.setItem(e.key, value); return; }
      if (e.fmt === 'prefs') {
        var o = JSON.parse(s.getItem(e.key) || 'null');
        o = o && typeof o === 'object' && !Array.isArray(o) ? o : {};
        o.theme = value;
        s.setItem(e.key, JSON.stringify(o));
        return;
      }
      s.setItem(e.key, JSON.stringify(value));
    } catch (err) { /* blocked or full: the app keeps its own value */ }
  }

  /** The stored choice: the profile's, else the first app key the person set, else the default. */
  function current() {
    var o = prof ? prof.overrides('theme') : {};
    if (o.mode !== undefined) return o.mode;
    for (var app in APPS) {
      var e = APPS[app];
      if (!e.key) continue;
      var c = fromNative(e, legacyRead(e));
      if (c) return c;
    }
    return DEFAULT;
  }
  /** The choice for one page: the app's own key wins only where it differs from the stored choice. */
  function choiceFor(app) {
    var choice = current(), e = APPS[app];
    if (e && e.key) {
      var pv = legacyRead(e), pick = fromNative(e, pv);
      if (pick && pick !== SYSTEM && native(e, resolve(choice)) !== pv) choice = pick;
    }
    return choice;
  }
  function onColor(hex) {
    var n = parseInt(hex.slice(1), 16);
    var lum = (0.2126 * ((n >> 16) & 255) + 0.7152 * ((n >> 8) & 255) + 0.0722 * (n & 255)) / 255;
    return lum > 0.6 ? '#0a0a0a' : '#ffffff';
  }

  /** The theme whose colours a page is painted with. An app whose own look is dark (its native value maps back to a dark
   * theme) takes the dark colours where the choice is light, so Classic 98 never puts light surfaces under its dark text. */
  function tokenTheme(e, id) {
    if (!e || e.identity) return byId[id];
    var back = fromNative(e, e.native[id]);
    return back && byId[back] && (byId[back].scheme === 'dark') !== (byId[id].scheme === 'dark') ? byId[back] : byId[id];
  }

  /** Paints a choice on this page: data-theme (for the apps that use it), the --sl-* variables and the colour scheme. */
  function paint(choice) {
    var id = resolve(choice), root = doc && doc.documentElement;
    if (!root) return id;
    var e = APPS[page.app], t = tokenTheme(e, id);
    root.setAttribute('data-slop-theme', id);
    if (e) root.setAttribute('data-theme', native(e, id));
    var tk = t.tokens;
    root.style.setProperty('--sl-background', tk.background);
    root.style.setProperty('--sl-surface', tk.surface);
    root.style.setProperty('--sl-text', tk.text);
    root.style.setProperty('--sl-accent', tk.accent);
    root.style.setProperty('--sl-border', tk.border);
    root.style.setProperty('--sl-on-accent', onColor(tk.accent));
    root.style.colorScheme = t.scheme;
    return id;
  }
  function refresh() { page.choice = choiceFor(page.app); return paint(page.choice); }
  /** Paints a theme id or 'system' on this page without saving it. With no argument, paints the stored choice for this page. */
  function apply(choice) {
    if (choice === undefined) return refresh();
    if (choice !== SYSTEM && !byId[choice]) return resolve(SYSTEM);
    page.choice = choice;
    return paint(choice);
  }

  /** Follows the operating system while the choice is System. */
  function watch() {
    if (watching || !g.matchMedia) return;
    watching = true;
    try {
      var mq = g.matchMedia('(prefers-color-scheme: light)');
      var on = function () { if (page.choice === SYSTEM) paint(page.choice); };
      if (mq.addEventListener) mq.addEventListener('change', on); else mq.addListener(on);
    } catch (e) { /* no media queries: stays on its first resolution */ }
  }

  /** Saves a choice (a theme id or 'system'), mirrors it into each app's key and applies it here. */
  function set(choice) {
    if (choice !== SYSTEM && !byId[choice]) return { ok: false, error: 'That theme is not in the list.' };
    if (!prof) return { ok: false, error: 'Could not save: browser storage is blocked.' };
    var r = prof.set('theme', 'mode', choice);
    if (!r.ok) return r;
    for (var app in APPS) {
      var e = APPS[app];
      if (e.key) legacyWrite(e, choice === SYSTEM ? SYSTEM : e.native[choice]);
    }
    var id = refresh();
    try { if (g.dispatchEvent && g.CustomEvent) g.dispatchEvent(new g.CustomEvent('slop-theme', { detail: { choice: choice, id: id } })); } catch (err) { /* older browser */ }
    return { ok: true, id: id };
  }

  /** Runs at first paint from the page's <head>. */
  function load() {
    var self = doc && doc.currentScript;
    page.app = (self && self.getAttribute('data-app')) || '';
    if (doc && doc.head && !doc.getElementById('slop-theme-style')) {
      var s = doc.createElement('style');
      s.id = 'slop-theme-style';
      s.textContent = CSS;
      doc.head.appendChild(s);
    }
    if (doc && doc.documentElement) doc.documentElement.setAttribute('data-slop-app', page.app);
    refresh();
    watch();
    try {
      g.addEventListener && g.addEventListener('storage', function (ev) { if (!ev.key || ev.key.indexOf('slop') === 0) refresh(); });
    } catch (e) { /* no storage events */ }
  }

  g.SlopTheme = Object.freeze({
    THEMES: THEMES,
    SYSTEM: SYSTEM,
    DEFAULT: DEFAULT,
    get: current,
    resolve: resolve,
    set: set,
    apply: apply,
    load: load,
    appKeys: function () { return Object.keys(APPS).filter(function (a) { return APPS[a].key; }); },
  });
  load();
})(typeof window !== 'undefined' ? window : globalThis);
