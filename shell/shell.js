/* Slopographic shell: the OS layer. Every app page loads it with one line:
 *   a script tag pointing at ../shell/shell.js          (pages in a folder)
 *   a script tag pointing at shell/shell.js             (the homepage)
 * It loads what it needs in order (brand, registry, SlopUI, the language files, then shell/*.js and shell.css, skipping
 * what is already on the page), applies the chosen language (SlopI18n.apply) once the header is in, adds the Apps and Notifications buttons to the page header, and binds Ctrl+Space.
 * Options on the tag: data-no-header (no buttons), data-brand-src (see brand/brand.js).
 * Exposes window.SlopShell (core helpers) and, once booted, SlopShell.switcher / .drawer / .notify / .tabs.
 * Modules: shell/notify.js SlopNotify · shell/layout.js SlopLayout · shell/tabs.js SlopOpenTabs ·
 *          shell/switcher.js SlopSwitcher · shell/drawer.js SlopDrawer · shell/header.js SlopHeader. */
(function () {
  'use strict';
  if (window.SlopShell) return;
  const me = document.currentScript;
  const ROOT = new URL('../', me && me.src ? me.src : location.href);
  const RECENT_KEY = 'slop.shell.recent.v1';

  function readRecent() {
    try {
      const env = JSON.parse(localStorage.getItem(RECENT_KEY) || 'null');
      if (env && env.v === 1 && Array.isArray(env.data)) return env.data.filter((x) => typeof x === 'string').slice(0, 8);
    } catch (e) { /* unreadable: no recents */ }
    return [];
  }
  function pushRecent(id) {
    const list = [id, ...readRecent().filter((x) => x !== id)].slice(0, 8);
    try { localStorage.setItem(RECENT_KEY, JSON.stringify({ v: 1, data: list })); } catch (e) { /* storage blocked */ }
  }
  /** The registry in default order: the brand's appOrder first, then the registry's own order. */
  function sortedApps() {
    const reg = window.SLOP_APPS || [];
    const order = (window.SlopBrand && window.SlopBrand.order) || [];
    const rank = (a) => { const i = order.indexOf(a.id); return i < 0 ? 1e6 + reg.indexOf(a) : i; };
    return reg.slice().sort((a, b) => rank(a) - rank(b));
  }
  /** The registry app whose folder this page is in (longest path wins), or null on the homepage. */
  function detectCurrent() {
    let best = null, len = -1;
    for (const a of window.SLOP_APPS || []) {
      if (!a.path || a.path.startsWith('#')) continue;
      const p = new URL(a.path, ROOT).pathname;
      if (location.pathname.startsWith(p) && p.length > len) { best = a; len = p.length; }
    }
    return best;
  }

  const S = {
    ROOT,
    currentApp: null,
    noHeader: !!(me && me.hasAttribute('data-no-header')),
    apps: sortedApps,
    brandOrder: () => (window.SlopBrand && window.SlopBrand.order) || [],
    appUrl: (app) => new URL(app.path, ROOT).href,
    navigate(url) { location.assign(url); },
    recent: readRecent,
    /** Text made safe inside HTML (the one escape of the shell's modules). */
    esc: (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]),
    ready: null,
  };
  window.SlopShell = S;

  function addCss(href) {
    if (document.querySelector(`link[data-shell-css="${href}"]`)) return;
    const l = document.createElement('link');
    l.rel = 'stylesheet';
    l.href = new URL(href, ROOT).href;
    l.dataset.shellCss = href;
    document.head.append(l);
  }
  function addScript(src, data) {
    return new Promise((res) => {
      const s = document.createElement('script');
      s.src = new URL(src, ROOT).href;
      s.async = false;
      if (data) Object.assign(s.dataset, data);
      s.onload = () => res(true);
      s.onerror = () => res(false);
      document.head.append(s);
    });
  }

  const queue = [];
  if (!window.SLOP_APPS) queue.push(['shared/apps.js']);
  if (!window.SLOP_ICONS) queue.push(['shared/app-icons.js']); // before brand.js, which puts the app's icon in the header brand
  if (!window.SlopBrand) queue.push(['brand/brand.js', { brandSrc: (me && me.dataset.brandSrc) || '' }]);
  if (!window.SlopUI) { addCss('shared/slopui.css'); queue.push(['shared/slopui.js']); }
  if (!window.SlopI18n) queue.push(['shared/i18n/i18n.js'], ['shared/i18n/strings.js'], ['shared/i18n/es.js'], ['shared/i18n/fr.js'],
    ['shared/i18n/de.js'], ['shared/i18n/pt-BR.js'], ['shared/i18n/it.js'], ['shared/i18n/ar.js']); // one file per language (LANGS)
  addCss('shell/shell.css');
  addCss('brand/brand.css');   // the brand link's app icon and badge
  addCss('shared/ui/hbtn.css');   // the look of every shared header button (Apps, the bell, Drive, Tour, View)
  if (!window.SlopHbtn) queue.push(['shared/ui/hbtn.js']);
  for (const m of ['notify', 'layout', 'tabs', 'switcher', 'drawer', 'header']) queue.push(['shell/' + m + '.js']);

  S.ready = queue.reduce((p, [src, data]) => p.then(() => addScript(src, data)), Promise.resolve()).then(() => {
    S.currentApp = detectCurrent();
    if (S.currentApp) pushRecent(S.currentApp.id);
    S.notify = window.SlopNotify;
    S.tabs = window.SlopOpenTabs;
    S.switcher = window.SlopSwitcher;
    S.drawer = window.SlopDrawer;
    S.layout = window.SlopLayout;
    if (!S.noHeader && window.SlopHeader) window.SlopHeader.mount();
    if (window.SlopI18n) window.SlopI18n.apply(); // the chosen language, from the profile, on every shell page
    return S;
  });
})();
