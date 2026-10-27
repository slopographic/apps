/* Store-app mode: knows whether the page runs inside one of the suite's own apps instead of a browser, and in the
 * iPhone/iPad app hides what an App Store app may not show: ways to get the suite elsewhere (the install button, "Add to
 * Home Screen" help, desktop downloads, other platforms and stores: App Review 2.3.10) and outside payments (tip jar,
 * Patreon, Gumroad: 3.1.1). Everything else works as on the website.
 * Classic script, loaded first by the app's pages (mobile/ios/bundle.mjs adds the tag after native/native.js; the
 * desktop app's bundle may do the same). On the website it changes nothing. Exposes window.SlopNative:
 *   SlopNative.kind()          'ios' (the iPhone/iPad app: Capacitor, capacitor://), 'desktop' (the desktop app: app://)
 *                              or null (a browser)
 *   SlopNative.isApp()         true in either app
 *   SlopNative.isStoreApp()    true in the iPhone/iPad app (the one App Review sees)
 *   SlopNative.webOnlyPath(p)  true for a page that is the website's own (comparisons, the app pages, All tools)
 *   SlopNative.hideLinks(doc)  hides the links to those pages (and a list item or line that holds only that link)
 * On <html>: class native-app and native-<kind> in an app, store-app in the iPhone/iPad app. In the store app this
 * hides: [data-web-only] (a page marks website-only text with it), .pwa-install, the tip jar ([data-donate]), the brand's
 * payment links ([data-brand-link=patreon|gumroad|support]), ad slots (.slop-ad), the desktop downloads
 * (#desktop-download) and the footer site map of the website's pages (.fnav).
 * Test hook: window.SLOP_NATIVE = 'ios' | 'desktop' set before this file loads stands in for the app.
 * Tests: tests/native/store-app.test.html (browser), tests/node/native-app.test.mjs (Node). */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else if (root.document && !root.SlopNative) { root.SlopNative = api; api.install(root); }
})(typeof window !== 'undefined' ? window : globalThis, function () {
  'use strict';

  /** The website's own pages: marketing and comparison pages a store app does not link to. */
  const WEB_ONLY = [/^\/best\//, /^\/compare\//, /^\/all-tools\//, /^\/apps\/[^/]+\//];
  const HIDE = ['[data-web-only]', '.pwa-install', '[data-donate]', '[data-brand-link="patreon"]', '[data-brand-link="gumroad"]',
    '[data-brand-link="support"]', '.slop-ad', '#desktop-download', '.fnav'];
  /** The style the store app adds (selectors above, hidden whatever a script sets later). */
  const STYLE = HIDE.map((s) => `.store-app ${s}`).join(',') + '{display:none!important}';

  /** 'ios' | 'desktop' | null for a window (or a stand-in { location, Capacitor, NATIVE_CONFIG, SLOP_NATIVE }). */
  function kind(win) {
    const w = win || (typeof window !== 'undefined' ? window : {});
    if (w.SLOP_NATIVE === 'ios' || w.SLOP_NATIVE === 'desktop') return w.SLOP_NATIVE;
    const proto = (w.location && w.location.protocol) || '';
    if (proto === 'capacitor:' || (w.Capacitor && typeof w.Capacitor === 'object') || w.NATIVE_CONFIG) return 'ios';
    if (proto === 'app:' || (w.SlopDesktop && w.SlopDesktop.desktop)) return 'desktop';
    return null;
  }

  /** True for a path (or an address on this site) that is one of the website's own pages. */
  function webOnlyPath(p) {
    const path = String(p || '').split('#')[0].split('?')[0];
    return WEB_ONLY.some((re) => re.test(path));
  }

  /** Hides every link to a website-only page; a list item or line that holds only that link goes with it. */
  function hideLinks(doc) {
    const origin = doc.location ? doc.location.origin : '';
    let n = 0;
    for (const a of doc.querySelectorAll('a[href]')) {
      let u;
      try { u = new URL(a.getAttribute('href'), doc.baseURI); } catch (e) { continue; }
      if (u.origin !== origin || !webOnlyPath(u.pathname)) continue;
      const box = a.parentElement;
      const alone = box && /^(LI|P)$/.test(box.tagName) && box.textContent.trim() === a.textContent.trim();
      (alone ? box : a).hidden = true;
      (alone ? box : a).setAttribute('data-web-only', '');
      n++;
    }
    return n;
  }

  function install(win) {
    const k = kind(win), html = win.document.documentElement;
    if (!k) return null;
    html.classList.add('native-app', 'native-' + k);
    if (k !== 'ios') return k;
    html.classList.add('store-app');
    const style = win.document.createElement('style');
    style.setAttribute('data-store-app', '');
    style.textContent = STYLE;
    (win.document.head || html).appendChild(style);
    const run = () => hideLinks(win.document);
    if (win.document.readyState === 'loading') win.document.addEventListener('DOMContentLoaded', run, { once: true });
    else run();
    return k;
  }

  return {
    kind: () => kind(),
    isApp: () => kind() !== null,
    isStoreApp: () => kind() === 'ios',
    webOnlyPath, hideLinks, install, detect: kind, STYLE, HIDE,
  };
});
