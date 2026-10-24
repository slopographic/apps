/* Slopographic packs: the one way a pack gets onto this device. Used by the Get more dialog (get-more.js) and by fonts
 * downloaded just in time (shared/fonts/jit.js). Every file comes from a host listed in packs.json, must match its
 * manifest byte length and SHA-256, and the pack is stored in one transaction (shared/library/store.js) or not at all.
 * Needs manifest.js and store.js. Classic script; exposes window.SlopLibraryInstall:
 *   loadManifest() -> Promise<{ packs, errors, hosts }>     packs.json, read once, validated; never rejects
 *   installed() -> Promise<{ id: record }>                     installed packs ({} when storage is unavailable)
 *   install(pack, onStatus?) -> Promise                        rejects with the reason; nothing is stored then
 *   onChange(fn) -> unsubscribe                                fn(pack) after an install or a removal (pack null)
 *   changed(pack)                                              tells the listeners (get-more.js calls it after removing) */
(function (root) {
  'use strict';
  const doc = root.document;
  const SELF = (doc && doc.currentScript && doc.currentScript.src) || (root.location && root.location.href) || '';
  const PACKS_URL = new URL('packs.json', SELF).href;
  const M = () => root.SlopLibraryManifest, S = () => root.SlopLibraryStore;
  const listeners = new Set();
  let manifestP = null;

  function loadManifest() {
    if (!manifestP) {
      manifestP = fetch(PACKS_URL, { cache: 'no-cache' })
        .then((r) => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
        .then((j) => M().validate(j))
        .catch((e) => ({ packs: [], errors: ['The pack list could not be read (' + e.message + ').'], hosts: [] }));
    }
    return manifestP;
  }
  async function installed() {
    try { const rows = await S().listPacks(); return Object.fromEntries(rows.map((r) => [r.id, r])); } catch (e) { return {}; }
  }
  function changed(pack) { for (const fn of listeners) { try { fn(pack); } catch (e) { /* a listener must not break an install */ } } }

  async function install(p, onStatus) {
    const say = (t) => { if (onStatus) onStatus(t); };
    const blobs = {}, m = await loadManifest();
    let n = 0;
    for (const f of p.files) {
      say(`Downloading ${f.name} (${++n} of ${p.files.length})…`);
      const r = await fetch(f.url, { credentials: 'omit', redirect: 'follow', cache: 'no-cache' });
      if (!r.ok) throw new Error(`${f.name}: HTTP ${r.status}`);
      if (!M().allowedUrl(r.url || f.url, m.hosts)) throw new Error(`${f.name}: redirected to a host that is not allowed`);
      const buf = await r.arrayBuffer();
      const v = await M().verifyBytes(buf, f);
      if (!v.ok) throw new Error(v.reason);
      const type = p.kind === 'model' ? 'application/octet-stream' : f.name.endsWith('.woff2') ? 'font/woff2' : 'font/' + f.name.split('.').pop().toLowerCase();
      blobs[f.name] = new Blob([buf], { type });
    }
    say('Storing…');
    await S().savePack(p, blobs);
    changed(p);
  }

  root.SlopLibraryInstall = { loadManifest, installed, install, changed, onChange: (fn) => { listeners.add(fn); return () => listeners.delete(fn); } };
})(typeof window !== 'undefined' ? window : globalThis);
