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
  /** Names of the bundled families (must match library/index.json; a test checks this). */
  const BUNDLED = ['Inter', 'Roboto', 'Open Sans', 'Lato', 'Montserrat', 'Playfair Display', 'Merriweather', 'Oswald', 'Source Sans 3', 'Nunito', 'Raleway', 'Space Mono'];
  const GENERIC = { serif: 'serif', mono: 'monospace', sans: 'sans-serif' };

  let indexP = null, depsP = null, downloadedNames = [], cssDone = false;
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
        if (p.kind === 'model') continue; // AI models are not fonts
        for (const f of p.files) if (!seen.has(f.family)) { seen.add(f.family); list.push({ name: f.family, source: 'downloaded' }); }
      }
    } catch (e) { /* storage unavailable: bundled fonts only */ }
    downloadedNames = list.filter((f) => f.source === 'downloaded').map((f) => f.name);
    return list;
  }

  /** Registers every face of a family with the document. Resolves true when at least one face is ready. */
  function load(family) {
    if (!family) return Promise.resolve(false);
    if (loaded.has(family)) return loaded.get(family).promise;
    const rec = { faces: [], promise: null, bundled: false };
    rec.promise = (async () => {
      const add = async (src, desc) => {
        const ff = new FontFace(family, src, desc);
        doc.fonts.add(ff); rec.faces.push(ff);
        await ff.load();
      };
      try {
        const bundled = (await bundledIndex()).filter((f) => f.family === family);
        if (bundled.length) {
          rec.bundled = true;
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

  /** After a pack is installed or removed: forget downloaded faces so they re-read the store. */
  function dropDownloaded() {
    for (const [k, r] of loaded) if (!r.bundled) { for (const ff of r.faces) doc.fonts.delete(ff); loaded.delete(k); }
  }

  /** CSS font-family list for a family name: the name, then a generic guessed from the bundled category. */
  function stack(family) {
    const m = meta.get(family);
    return `"${String(family).replace(/"/g, '')}", ${GENERIC[m ? m.category : 'sans'] || 'sans-serif'}`;
  }

  /** Rebuilds the options. Legacy entries are a name or a [value, label] pair; the order is standard names,
   * bundled families, downloaded ones. The value in the select (or current) is kept even when that font is not
   * installed, so a saved document still shows it. */
  function render(sel, legacy, extra, current) {
    const want = sel.value || current || '';
    const groups = [['Standard', []], ['Bundled (offline)', []], ['Downloaded', []]];
    const seen = new Set();
    for (const l of legacy) { const [v, text] = Array.isArray(l) ? l : [l, l]; if (!seen.has(v)) { seen.add(v); groups[0][1].push([v, text]); } }
    for (const f of BUNDLED.map((name) => ({ name, source: 'bundled' })).concat(extra)) {
      if (seen.has(f.name)) continue;
      seen.add(f.name); groups[f.source === 'bundled' ? 1 : 2][1].push([f.name, f.name]);
    }
    if (want && !seen.has(want)) { groups[0][1].unshift([want, want + ' (not installed)']); }
    sel.replaceChildren(...groups.filter((g) => g[1].length).map(([label, items]) => {
      const og = doc.createElement('optgroup'); og.label = label;
      for (const [v, text] of items) { const o = doc.createElement('option'); o.value = v; o.textContent = text; og.append(o); }
      return og;
    }));
    sel.value = want;
  }

  /** Synchronous list of bundled and downloaded family names known so far (for menus). */
  function names() { return BUNDLED.concat(downloadedNames); }

  /** Connects a <select> to the picker. opts: { value, legacy: [names], onPick(family), getMore: true }.
   * The options are there at once; downloaded families are added when the store answers.
   * Returns { refresh(), set(family), button } - the Get more button is inserted after the select when
   * the select is already in the page, otherwise the caller places handle.button. */
  function attach(sel, opts = {}) {
    const legacy = opts.legacy || [];
    const current = opts.value || (Array.isArray(legacy[0]) ? legacy[0][0] : legacy[0]) || '';
    if (!cssDone) {
      cssDone = true;
      doc.head.append(Object.assign(doc.createElement('style'), { textContent: '.slop-getmore{font:inherit;font-size:11px;padding:1px 6px;margin-left:4px;border:1px solid currentColor;border-radius:4px;background:transparent;color:inherit;cursor:pointer;opacity:.85;white-space:nowrap}' }));
    }
    const refresh = async () => { const fams = await families(); render(sel, legacy, fams.filter((f) => f.source === 'downloaded'), sel.value || current); };
    render(sel, legacy, [], current);
    load(sel.value);
    refresh();
    sel.addEventListener('change', async () => {
      const f = sel.value;
      await load(f);
      if (opts.onPick) opts.onPick(f);
    });
    const btn = doc.createElement('button');
    btn.type = 'button'; btn.className = 'slop-getmore'; btn.textContent = 'Get more…';
    btn.title = 'Optional font packs. Downloads start only when you click them.';
    btn.addEventListener('click', async () => {
      await deps();
      if (root.SlopLibrary) root.SlopLibrary.open({ onInstalled: () => refresh() });
    });
    if (opts.getMore !== false) {
      if (sel.parentNode) sel.insertAdjacentElement('afterend', btn);
      deps().then(async () => {
        if (!root.SlopLibrary) return;
        const m = await root.SlopLibrary.loadManifest();
        if (!m.packs.length) btn.textContent = 'Get more (no packs listed)';
        root.SlopLibrary.onChange(async () => { dropDownloaded(); await refresh(); load(sel.value); });
      });
    }
    return {
      refresh, button: btn,
      set(family) { sel.value = family; return load(family); }
    };
  }

  root.SlopFonts = { families, names, load, stack, attach, bundledIndex, ready: () => deps() };
})(typeof window !== 'undefined' ? window : globalThis);
