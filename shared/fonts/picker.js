/* Slopographic shared font picker (window.SlopFonts). Classic script.
 * - Bundled families come from shared/fonts/library/index.json (open licences, WOFF2, served from this origin).
 *   They are loaded with FontFace only when a person picks them, so nothing is fetched at start-up.
 * - Downloaded families come from the "Get more" packs in IndexedDB (shared/library/store.js).
 * - attach(select, opts) fills a <select> with the app's standard fonts, bundled families and downloaded
 *   families, and adds a "Get more" button after it. Nothing here downloads anything by itself.
 * Needs no CDN and no network for bundled fonts after the first load (the service worker caches them). */
(function (root) {
  'use strict';
  const doc = root.document;
  const SELF = (doc && doc.currentScript && doc.currentScript.src) || root.location.href;
  const LIB = new URL('library/', SELF).href;
  const DEPS = ['manifest.js', 'store.js', 'get-more.js'];
  const GENERIC = { serif: 'serif', mono: 'monospace', sans: 'sans-serif' };

  let indexP = null, depsP = null;
  const meta = new Map();          // family -> { category }
  const loaded = new Map();        // family -> { promise, faces: FontFace[] }

  /** Adds the three library scripts (in order) if the page has not loaded them. */
  function deps() {
    if (depsP) return depsP;
    if (root.SlopLibrary && root.SlopLibraryStore && root.SlopLibraryManifest) return (depsP = Promise.resolve());
    depsP = DEPS.reduce((chain, f) => chain.then(() => new Promise((resolve) => {
      const s = doc.createElement('script');
      s.src = new URL('../library/' + f, SELF).href; s.async = false;
      s.onload = s.onerror = () => resolve();
      doc.head.append(s);
    })), Promise.resolve());
    return depsP;
  }

  /** The bundled font index (empty list when it cannot be read). */
  function bundledIndex() {
    if (!indexP) {
      indexP = fetch(LIB + 'index.json', { cache: 'no-cache' })
        .then((r) => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
        .then((j) => { for (const f of j.fonts || []) if (!meta.has(f.family)) meta.set(f.family, { category: f.category || 'sans' }); return j.fonts || []; })
        .catch(() => []);
    }
    return indexP;
  }

  /** Family names, in the order they should show. source: 'bundled' or 'downloaded'. */
  async function families() {
    const list = [], seen = new Set();
    for (const f of await bundledIndex()) if (!seen.has(f.family)) { seen.add(f.family); list.push({ name: f.family, source: 'bundled' }); }
    try {
      await deps();
      for (const p of await root.SlopLibraryStore.listPacks()) {
        for (const f of p.files) if (!seen.has(f.family)) { seen.add(f.family); list.push({ name: f.family, source: 'downloaded' }); }
      }
    } catch (e) { /* storage unavailable: bundled fonts only */ }
    return list;
  }

  /** Registers every face of a family with the document. Resolves true when at least one face is ready. */
  function load(family) {
    if (!family) return Promise.resolve(false);
    if (loaded.has(family)) return loaded.get(family).promise;
    const rec = { faces: [], promise: null };
    rec.promise = (async () => {
      const add = async (src, desc) => {
        const ff = new FontFace(family, src, desc);
        doc.fonts.add(ff); rec.faces.push(ff);
        await ff.load();
      };
      try {
        const bundled = (await bundledIndex()).filter((f) => f.family === family);
        if (bundled.length) {
          for (const f of bundled) await add(`url("${LIB + f.file}") format("woff2")`, { weight: f.weight, style: f.style });
          return true;
        }
        await deps();
        for (const p of await root.SlopLibraryStore.listPacks()) {
          for (const f of p.files.filter((x) => x.family === family)) {
            const blob = await root.SlopLibraryStore.getBlob(`${p.id}/${f.name}`);
            if (blob) await add(await blob.arrayBuffer(), { weight: f.weight, style: f.style });
          }
        }
        return rec.faces.length > 0;
      } catch (e) {
        for (const ff of rec.faces) doc.fonts.delete(ff);
        loaded.delete(family);
        return false;
      }
    })();
    loaded.set(family, rec);
    return rec.promise;
  }

  /** CSS font-family list for a family name: the name, then a generic guessed from the bundled category. */
  function stack(family) {
    const m = meta.get(family);
    return `"${String(family).replace(/"/g, '')}", ${GENERIC[m ? m.category : 'sans'] || 'sans-serif'}`;
  }

  /** Fills the select. current is kept even when it is not installed, so a saved document still shows it. */
  async function fill(sel, legacy, current) {
    const fams = await families();
    const groups = [['Standard', []], ['Bundled (offline)', []], ['Downloaded', []]];
    const seen = new Set();
    for (const n of legacy || []) if (!seen.has(n)) { seen.add(n); groups[0][1].push(n); }
    for (const f of fams) if (!seen.has(f.name)) { seen.add(f.name); groups[f.source === 'bundled' ? 1 : 2][1].push(f.name); }
    if (current && !seen.has(current)) groups[0][1].unshift(current);
    sel.replaceChildren(...groups.filter((g) => g[1].length).map(([label, names]) => {
      const og = doc.createElement('optgroup'); og.label = label;
      for (const n of names) { const o = doc.createElement('option'); o.value = n; o.textContent = n === current && !seen.has(n) ? n + ' (not installed)' : n; og.append(o); }
      return og;
    }));
    sel.value = current;
  }

  /** Connects a <select> to the picker. opts: { value, legacy: [names], onPick(family), getMore: true }.
   * Returns { refresh() }. onPick runs after the chosen family is registered with the document. */
  function attach(sel, opts = {}) {
    const legacy = opts.legacy || [];
    let current = opts.value || (legacy[0] || '');
    const refresh = () => fill(sel, legacy, sel.value || current);
    fill(sel, legacy, current);
    load(current);
    sel.addEventListener('change', async () => {
      const f = sel.value;
      await load(f);
      if (opts.onPick) opts.onPick(f);
    });
    if (opts.getMore !== false) {
      const btn = doc.createElement('button');
      btn.type = 'button'; btn.className = 'slop-getmore'; btn.textContent = 'Get more…';
      btn.title = 'Optional font packs. Downloads start only when you click them.';
      btn.addEventListener('click', async () => {
        await deps();
        if (root.SlopLibrary) root.SlopLibrary.open({ onInstalled: () => refresh() });
      });
      sel.insertAdjacentElement('afterend', btn);
      deps().then(() => root.SlopLibraryManifest && root.SlopLibrary.loadManifest()).then((m) => {
        if (m && !m.packs.length) btn.textContent = 'Get more (no packs listed)';
      });
      if (root.SlopLibrary) root.SlopLibrary.onChange(() => { loaded.forEach((r, k) => { if (!r.faces.length) loaded.delete(k); }); refresh(); });
    }
    return { refresh, set(family) { current = family; sel.value = family; return load(family); } };
  }

  root.SlopFonts = { families, load, stack, attach, bundledIndex, ready: () => deps() };
})(typeof window !== 'undefined' ? window : globalThis);
