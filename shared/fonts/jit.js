/* SlopFontJIT: fonts for any writing system, downloaded just in time. When text needs a script the current font cannot
 * set (Arabic, Chinese, Devanagari…), ready() finds the language font pack for it (shared/library/packs.json, noto-*),
 * asks once (or not at all, when the person chose "download automatically"), downloads it through SlopLibraryInstall
 * (checked by size and SHA-256, kept in this browser) and resolves true. All packs can also be fetched ahead in Get
 * more. Loads its helpers on first use: shared/fonts/scripts.js, shared/library/manifest.js, store.js and install.js.
 * Classic script; exposes window.SlopFontJIT:
 *   ready(text, covered?, { lang?, ask? }) -> Promise<boolean>   true when every pack the text needs is installed;
 *                                                                ask: false never prompts (false unless automatic)
 *   packFor(cp, text?, lang?) -> pack id or null                  the pack that sets cp (the Chinese pack follows the text)
 *   bytes(packId, { bold }) -> Promise<ArrayBuffer|null>          the font file, Bold when there is one and it is asked
 *   family(packId) -> Promise<string>                              its CSS family name ('Noto Sans Arabic')
 *   face(packId) -> Promise                                        adds its FontFace to the page, once, for screen text
 *   auto() / setAuto(bool)                                         the "download automatically" choice (localStorage) */
(function (root) {
  'use strict';
  const doc = root.document;
  const SELF = (doc && doc.currentScript && doc.currentScript.src) || (root.location && root.location.href) || '';
  const KEY = 'slop-fonts.auto';
  const DEPS = [['SlopScripts', 'scripts.js'], ['SlopLibraryManifest', '../library/manifest.js'], ['SlopLibraryStore', '../library/store.js'], ['SlopLibraryInstall', '../library/install.js']];
  let depsP = null;
  const faces = new Map();

  function load(src) {
    return new Promise((res, rej) => { const s = doc.createElement('script'); s.src = new URL(src, SELF).href; s.async = false; s.onload = res; s.onerror = () => rej(new Error('Could not load ' + src)); doc.head.append(s); });
  }
  function deps() {
    if (!depsP) depsP = DEPS.reduce((p, [g, src]) => p.then(() => (root[g] ? null : load(src))), Promise.resolve());
    depsP.catch(() => { depsP = null; });
    return depsP;
  }
  const auto = () => { try { return localStorage.getItem(KEY) === '1'; } catch (e) { return false; } };
  const setAuto = (on) => { try { if (on) localStorage.setItem(KEY, '1'); else localStorage.removeItem(KEY); } catch (e) { /* not kept */ } };
  const lang = () => (root.navigator && root.navigator.language) || 'en';

  function packFor(cp, text, lg) {
    const S = root.SlopScripts;
    return S ? S.packOf(cp, { han: S.hanFor(text || '', lg || lang()) }) : null;
  }

  /** Asks before the first download: the packs, their size and licence, and the "automatically" choice. */
  function ask(packs, M) {
    const names = packs.map((p) => p.name).join(', '), size = M.formatSize(packs.reduce((n, p) => n + p.size, 0));
    const UI = root.SlopUI;
    if (!UI || !UI.dialog) return Promise.resolve(root.confirm(`This text needs ${names} (${size}). Download it now? It is kept in this browser.`));
    return new Promise((res) => {
      const box = UI.el('input', { type: 'checkbox' });
      const body = UI.el('div', { class: 'sfj-ask' },
        UI.el('p', null, `To write this text, the app needs a font for ${packs.map((p) => p.name.replace(/ \(.*\)$/, '')).join(', ')}.`),
        UI.el('ul', null, ...packs.map((p) => UI.el('li', null, `${p.name}: ${M.formatSize(p.size)}, ${M.LICENCES[p.licence] || p.licence}`))),
        UI.el('p', null, 'It downloads once from Slopographic\'s file store and stays in this browser. Your document is not uploaded.'),
        UI.el('label', null, box, ' Download language fonts automatically when needed'));
      UI.dialog({ title: 'Download a font for this language?', body, onClose: (ok) => res(!!ok),
        buttons: [{ label: 'Cancel' }, { label: `Download ${size}`, primary: true, act: () => { if (box.checked) setAuto(true); return true; } }] });
    });
  }

  async function ready(text, covered, opts) {
    const o = opts || {};
    await deps();
    const S = root.SlopScripts, I = root.SlopLibraryInstall, M = root.SlopLibraryManifest;
    const ids = S.packsFor(text, covered, { han: S.hanFor(text, o.lang || lang()) });
    if (!ids.length) return true;
    const have = await I.installed(), missing = ids.filter((id) => !have[id]);
    if (!missing.length) return true;
    const list = (await I.loadManifest()).packs, packs = missing.map((id) => list.find((p) => p.id === id)).filter(Boolean);
    if (packs.length < missing.length) return false;
    // ask: false (a document being opened, say) uses only what is installed: it never downloads without the person's say
    if (!auto()) { if (o.ask === false) return false; if (!(await ask(packs, M))) return false; }
    const toast = (t) => { if (root.SlopUI && root.SlopUI.toast) root.SlopUI.toast(t, 4000); };
    try {
      for (const p of packs) { toast(`Downloading the ${p.name.replace(/ \(.*\)$/, '')} font…`); await I.install(p); }
    } catch (e) { toast('The font could not be downloaded: ' + e.message); return false; }
    toast(packs.length === 1 ? `${packs[0].name.replace(/ \(.*\)$/, '')} font ready.` : 'Fonts ready.');
    return true;
  }

  /** The installed record's file for a weight: Bold (700) when asked and present, else Regular. */
  async function fileOf(id, bold) {
    await deps();
    const rec = (await root.SlopLibraryInstall.installed())[id];
    if (!rec) return null;
    return rec.files.find((f) => f.weight === (bold ? '700' : '400')) || rec.files.find((f) => f.weight === '400') || rec.files[0];
  }
  async function bytes(id, opts) {
    const f = await fileOf(id, opts && opts.bold);
    if (!f) return null;
    const blob = await root.SlopLibraryStore.getBlob(`${id}/${f.name}`);
    return blob ? blob.arrayBuffer() : null;
  }
  async function family(id) { const f = await fileOf(id, false); return f ? f.family : ''; }
  async function face(id) {
    if (faces.has(id)) return faces.get(id);
    const p = (async () => {
      const [fam, buf] = await Promise.all([family(id), bytes(id)]);
      if (!fam || !buf || !root.FontFace || !doc.fonts) return null;
      const ff = new root.FontFace(fam, buf);
      await ff.load(); doc.fonts.add(ff);
      return ff;
    })();
    faces.set(id, p);
    p.catch(() => faces.delete(id));
    return p;
  }

  root.SlopFontJIT = { ready, packFor, bytes, family, face, auto, setAuto, deps };
})(typeof window !== 'undefined' ? window : globalThis);
