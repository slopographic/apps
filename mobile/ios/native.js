/* The iPhone and iPad app's page glue (mobile/ios): loaded first on every page of the app's bundled copy of the site
 * (mobile/ios/bundle.mjs adds the tag), never on the website. Classic script; window.NATIVE_CONFIG comes from
 * native/config.js, written by the bundle step.
 *   1. Engines from the app: a fetch of a cdn engine file (the video, HEIC, RAW and 3D engines) is answered from the
 *      app's own copy (/cdn/<path>), so the app never downloads code. The answer has no URL of its own, so the download
 *      helper's host check (shared/cdn/assets.js fetchVerified) sees the cdn address it asked for.
 *   2. No downloaded code: any other fetch of a script or WebAssembly file from another host is refused (App Review 2.5.2);
 *      models, font packs and other data still download at first use.
 *   3. Saving: a download link (a[download] on a blob: or data: address, clicked or .click()ed) opens the share sheet
 *      (Save to Files, AirDrop, Mail...) through Capacitor's Filesystem and Share plugins, or the Web Share API.
 * Pure helpers are exported for Node (tests/node/mobile-ios.test.mjs); the browser installs the hooks. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else if (root.document) api.install(root);
})(typeof window !== 'undefined' ? window : globalThis, function () {
  'use strict';

  const CODE = /\.(m?js|wasm)$/i;

  /** The address without its query and hash. */
  const bare = (u) => String(u).split('#')[0].split('?')[0];
  /** The app's own copy of a cdn file (a path like /cdn/engines/...), or null. map: { url: local path }. */
  const localFor = (u, map) => (map && Object.prototype.hasOwnProperty.call(map, bare(u)) ? map[bare(u)] : null);
  /** True for a script or WebAssembly file on another host (what the app must not download). */
  function isRemoteCode(u, origin) {
    let x;
    try { x = new URL(String(u), origin); } catch (e) { return false; }
    if (x.protocol !== 'https:' && x.protocol !== 'http:') return false;
    return x.origin !== origin && CODE.test(x.pathname);
  }
  /** The file an anchor saves: { href, name } for a download link to a blob: or data: address, else null. */
  function saveTarget(a) {
    if (!a || typeof a.getAttribute !== 'function' || !a.hasAttribute('download')) return null;
    const href = a.href || a.getAttribute('href') || '';
    if (!/^(blob|data):/.test(href)) return null;
    return { href, name: (a.getAttribute('download') || '').replace(/[\\/:*?"<>|]+/g, '_').trim() || 'download' };
  }
  /** The URL a fetch input names (a string, a URL or a Request). */
  const urlOf = (input) => (input && typeof input === 'object' && 'url' in input ? input.url : String(input));

  /** A blob as base64 (what the Filesystem plugin writes), in chunks so a large file does not overflow the call stack. */
  async function base64Of(blob) {
    const bytes = new Uint8Array(await blob.arrayBuffer());
    let s = '';
    for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    return btoa(s);
  }

  /** Hands one file to the share sheet. plugins: Capacitor's { Filesystem, Share } when the app has them. */
  async function share(win, blob, name, plugins) {
    if (plugins && plugins.Filesystem && plugins.Share) {
      const saved = await plugins.Filesystem.writeFile({ path: name, data: await base64Of(blob), directory: 'CACHE' });
      await plugins.Share.share({ title: name, files: [saved.uri] });
      return 'plugin';
    }
    const file = new File([blob], name, { type: blob.type || 'application/octet-stream' });
    if (win.navigator.canShare && win.navigator.canShare({ files: [file] })) { await win.navigator.share({ files: [file], title: name }); return 'web'; }
    win.open(URL.createObjectURL(blob), '_blank');
    return 'open';
  }

  function install(win) {
    if (!win || win.__nativeInstalled) return;
    win.__nativeInstalled = true;
    const cfg = win.NATIVE_CONFIG || {}, origin = win.location.origin, fetch0 = win.fetch.bind(win);
    win.fetch = function (input, init) {
      const u = urlOf(input), local = localFor(u, cfg.local);
      if (local) {
        return fetch0(local).then((r) => {
          if (!r.ok) throw new TypeError(`${local}: HTTP ${r.status}`);
          return r.blob().then((b) => new Response(b, { status: 200, headers: { 'content-type': r.headers.get('content-type') || 'application/octet-stream' } }));
        });
      }
      if (isRemoteCode(u, origin)) return Promise.reject(new TypeError(`${bare(u)}: the app does not download code (everything it runs is built in)`));
      return fetch0(input, init);
    };
    const plugins = () => (win.Capacitor && win.Capacitor.Plugins) || null;
    const save = (t) => {
      fetch0(t.href).then((r) => r.blob()).then((b) => share(win, b, t.name, plugins()))
        .catch((e) => { if (!/cancel|abort/i.test(String(e && (e.message || e)))) console.warn('save', e); });
    };
    const click0 = win.HTMLAnchorElement.prototype.click;
    win.HTMLAnchorElement.prototype.click = function () {
      const t = saveTarget(this);
      if (t) { save(t); return; }
      return click0.call(this);
    };
    win.document.addEventListener('click', (e) => {
      const a = e.target && e.target.closest ? e.target.closest('a[download]') : null, t = saveTarget(a);
      if (!t || e.defaultPrevented) return;
      e.preventDefault();
      save(t);
    }, true);
    win.document.documentElement.classList.add('native-app');
  }

  return { localFor, isRemoteCode, saveTarget, share, install, bare };
});
