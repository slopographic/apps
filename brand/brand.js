/* Slopographic brand: reads brand/brand.json and applies it to the page.
 * Classic script, loads with the page (or through shell/shell.js). Exposes window.SlopBrand.
 *   SlopBrand.ready    Promise that resolves with the applied config (never rejects)
 *   SlopBrand.config   the config in use (defaults where brand.json is missing or invalid)
 *   SlopBrand.order    the default app order (ids), from appOrder
 *   SlopBrand.apply(c) apply any config object again (used by tests and by live previews)
 * What it touches (hooks in the markup, see brand/README.md):
 *   document.title           the word "Slopographic" in the title is replaced by the name
 *   [data-brand-name]        text: name (also header .brand-name)
 *   [data-brand-tagline]     text: tagline
 *   [data-brand-logo]        the logo image (or the first svg in header .brand)
 *   [data-brand-home], header a.brand (app pages)  href: home, when home is set
 *   [data-brand-footer]      text: footer line
 *   [data-brand-link=patreon|support|reddit|x|tiktok]  href; hidden when empty
 *   CSS variables --brand-ink, --brand-paper, --brand-accent on :root. Pages that set
 *   <html data-brand-tokens> also get --ink, --bone and --slop, which the homepage uses.
 * Data source: data-brand-src on this script tag (relative to the site root), default brand/brand.json.
 * Missing or broken brand.json: the defaults below are used and nothing else breaks. */
(function () {
  'use strict';
  if (window.SlopBrand) return;
  const self = document.currentScript;
  const ROOT = self && self.src ? new URL('../', self.src) : new URL('/', location.href);
  const DEFAULTS = Object.freeze({
    name: 'Slopographic',
    tagline: 'Office and creative software that runs in your browser.',
    logo: '',
    home: '',
    colors: Object.freeze({ ink: '#0a0a0a', paper: '#f1ede4', accent: '#d4ff3a' }),
    footer: '',
    links: Object.freeze({ patreon: '', support: '', reddit: '', x: '', tiktok: '' }),
    appOrder: Object.freeze([]),
  });
  const COLOR = /^#[0-9a-f]{3,8}$/i;
  const str = (v, d) => (typeof v === 'string' ? v.trim() : d);
  // Allowed: https links, mailto:, and paths without a scheme (no javascript: or other schemes).
  const URL_OK = /^(https:\/\/[^\s"'<>]+|http:\/\/[^\s"'<>]+|mailto:[^\s"'<>]+|\/[^\s"'<>]*|\.{1,2}\/[^\s"'<>]*|[\w][\w./-]*)$/;
  const safeUrl = (v) => (typeof v === 'string' && URL_OK.test(v.trim()) ? v.trim() : '');

  const LINK_KEYS = ['patreon', 'support', 'reddit', 'x', 'tiktok'];
  /** Merge raw JSON over the defaults. Unknown or invalid values fall back to the defaults. */
  function normalize(raw) {
    const r = raw && typeof raw === 'object' ? raw : {};
    const colors = Object.assign({}, DEFAULTS.colors);
    for (const k of Object.keys(colors)) if (r.colors && COLOR.test(r.colors[k])) colors[k] = r.colors[k];
    const links = {};
    for (const k of LINK_KEYS) links[k] = safeUrl(r.links && r.links[k]);
    const appOrder = Array.isArray(r.appOrder) ? r.appOrder.filter((x) => typeof x === 'string' && /^[\w-]+$/.test(x)) : [];
    return {
      name: str(r.name, DEFAULTS.name) || DEFAULTS.name,
      tagline: str(r.tagline, DEFAULTS.tagline),
      logo: str(r.logo, DEFAULTS.logo),
      home: safeUrl(r.home) || DEFAULTS.home,
      colors,
      footer: str(r.footer, DEFAULTS.footer),
      links,
      appOrder,
    };
  }

  let current = normalize(null);
  let appliedName = DEFAULTS.name;
  const setText = (sel, text) => document.querySelectorAll(sel).forEach((n) => { n.textContent = text; });

  function applyLogo(src) {
    const targets = [...document.querySelectorAll('[data-brand-logo]')];
    if (!targets.length) document.querySelectorAll('header .brand').forEach((a) => { const s = a.querySelector('svg'); if (s) targets.push(s); });
    for (const t of targets) {
      const cls = t.getAttribute('class') || '';
      if (!src) { if (t.tagName.toLowerCase() === 'img') t.hidden = true; continue; }
      if (t.tagName.toLowerCase() === 'img') { t.src = new URL(src, ROOT).href; t.hidden = false; continue; }
      const img = document.createElement('img');
      img.alt = '';
      img.className = cls;
      img.setAttribute('aria-hidden', 'true');
      img.src = new URL(src, ROOT).href;
      img.onerror = () => { img.remove(); t.hidden = false; };
      t.replaceWith(img);
      img.dataset.brandLogo = '';
    }
  }

  function apply(cfg) {
    current = normalize(cfg);
    const root = document.documentElement;
    const c = current.colors;
    root.style.setProperty('--brand-ink', c.ink);
    root.style.setProperty('--brand-paper', c.paper);
    root.style.setProperty('--brand-accent', c.accent);
    if (root.hasAttribute('data-brand-tokens')) {
      root.style.setProperty('--ink', c.ink);
      root.style.setProperty('--bone', c.paper);
      root.style.setProperty('--slop', c.accent);
    }
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', c.ink);
    if (document.title.includes(appliedName)) document.title = document.title.split(appliedName).join(current.name);
    appliedName = current.name;
    setText('[data-brand-name], header .brand-name', current.name);
    setText('[data-brand-tagline]', current.tagline);
    setText('[data-brand-footer]', current.footer);
    if (current.home) document.querySelectorAll('[data-brand-home], header a.brand:not([data-view])').forEach((a) => { a.setAttribute('href', current.home); });
    document.querySelectorAll('[data-brand-link]').forEach((a) => {
      const url = current.links[a.dataset.brandLink] || '';
      if (url) { a.setAttribute('href', url); a.hidden = false; } else a.hidden = true;
    });
    applyLogo(current.logo);
    window.SlopBrand.config = current;
    window.SlopBrand.order = current.appOrder;
    document.dispatchEvent(new CustomEvent('slopbrand', { detail: current }));
    return current;
  }

  window.SlopBrand = { config: current, order: [], apply, normalize, DEFAULTS, ROOT, ready: null };
  const src = (self && self.dataset.brandSrc) || 'brand/brand.json';
  window.SlopBrand.ready = fetch(new URL(src, ROOT), { cache: 'no-cache' })
    .then((r) => { if (!r.ok) throw new Error('brand ' + r.status); return r.json(); })
    .catch(() => null)
    .then((json) => apply(json));
})();
