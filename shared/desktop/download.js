/* The desktop app's download links (desktop/README.md), drawn into an element of the page (Settings ▸ Updates):
 *   on the website: "Download for Windows · Mac · Linux", each a link to that system's installer in the newest GitHub
 *     Release, from brand/brand.json "desktop": { release: '<…/releases/latest>', files: { windows, mac, linux } }.
 *     A brand without a desktop release has no "desktop" in its brand.json (tools/whitelabel/emit.mjs brandJson), and
 *     the element stays hidden;
 *   in the desktop app (window.SlopDesktop, desktop/main/preload.js): the app's version and a "Check for updates" button.
 * Words: shared/desktop/i18n (English and Swedish; other languages read English). Classic script; needs SlopI18n.
 *   SlopDesktopDownload.mount(el, brandUrl?)  → Promise<'app' | 'links' | 'none'>
 *   SlopDesktopDownload.links(desktop, ua?)   → [{ os, href, mine }] for a brand.json "desktop" block (mine: this system) */
(function () {
  'use strict';
  if (window.SlopDesktopDownload) return;
  const SELF = document.currentScript && document.currentScript.src;
  const OS = [['windows', 'Windows', /Windows/i], ['mac', 'Mac', /Mac OS X|Macintosh/i], ['linux', 'Linux', /Linux|X11/i]];
  const tr = (k, vars) => (window.SlopI18n ? window.SlopI18n.t(k, vars) : k);

  function links(desktop, ua) {
    if (!desktop || !desktop.release || !desktop.files) return [];
    const base = String(desktop.release).replace(/\/+$/, '');
    const agent = String(ua == null ? navigator.userAgent : ua);
    const out = OS.filter(([id]) => desktop.files[id]).map(([id, name, re]) => ({ os: name, href: `${base}/download/${encodeURIComponent(desktop.files[id])}`, mine: re.test(agent) && !/Android|iPhone|iPad/i.test(agent) }));
    return out.sort((a, b) => Number(b.mine) - Number(a.mine));   // this system's first
  }
  /** An element whose text follows the language (SlopI18n.apply re-reads data-i18n). */
  function said(tag, key, vars) {
    const n = document.createElement(tag);
    n.setAttribute('data-i18n', key);
    if (vars) n.setAttribute('data-i18n-vars', JSON.stringify(vars));
    n.textContent = tr(key, vars);
    return n;
  }

  async function mount(el, brandUrl) {
    if (!el) return 'none';
    const D = window.SlopDesktop;
    el.textContent = '';
    if (D && D.desktop) {
      el.append(said('span', 'desktop.app.version', { version: D.version || '?' }), ' ');
      if (D.checkForUpdates) {
        const b = said('button', 'desktop.app.check');
        b.type = 'button';
        b.className = 'btn';
        b.addEventListener('click', () => D.checkForUpdates());
        el.append(b);
      }
      el.hidden = false;
      return 'app';
    }
    let brand = null;
    try {
      const url = brandUrl || (SELF ? new URL('../../brand/brand.json', SELF).href : '/brand/brand.json');
      const r = await fetch(url, { cache: 'no-cache' });
      brand = r.ok ? await r.json() : null;
    } catch (e) { brand = null; }   // offline: no links, nothing breaks
    const list = links(brand && brand.desktop);
    if (!list.length) { el.hidden = true; return 'none'; }
    el.append(said('span', 'desktop.download.lede'), ' ');
    list.forEach((l, i) => {
      if (i) el.append(' · ');
      const a = said('a', 'desktop.download.for', { os: l.os });
      a.href = l.href;
      a.rel = 'noopener';
      if (l.mine) a.className = 'desktop-mine';
      el.append(a);
    });
    el.hidden = false;
    return 'links';
  }

  window.SlopDesktopDownload = { mount, links };
})();
