/* Slopographic shared font picker (window.SlopFonts). Classic script.
 * One font list: the bundled index, shared/fonts/library/index.json, is read here and nowhere else; the packs and the
 * person's own files are read from IndexedDB by catalog.js. No family name is written in code.
 * - bundledIndex(): the bundled faces (read once).
 * - load(family): registers a family's faces with FontFace when it is needed. Nothing is fetched at start-up.
 * - attach(select, opts): fills a <select> (standard names, then bundled, downloaded and own families) and adds a
 *   "Get more…" button and a "Fonts…" button (the Fonts panel, panel.js). Nothing downloads by itself.
 *   opts.preview: a sample line (.slop-font-sample) after the buttons, set in the chosen family once its faces load.
 * The catalogue (catalog.js), the Fonts panel and the missing-font check (panel.js) load on first use (deps()).
 * Needs no CDN and no network for bundled fonts after the first load (the service worker caches them). */
(function (root) {
  'use strict';
  const doc = root.document;
  const SELF = (doc && doc.currentScript && doc.currentScript.src) || root.location.href;
  const LIB = new URL('library/', SELF).href;
  /** Scripts this module needs, in order. Each is loaded only when its global is missing. */
  const DEPS = [
    [() => root.SlopLibraryManifest, '../library/manifest.js'],
    [() => root.SlopLibraryStore, '../library/store.js'],
    [() => root.SlopLibrary, '../library/get-more.js'],
    [() => root.SlopFontCatalog, 'catalog.js'],
    [() => root.SlopFonts && root.SlopFonts.openPanel, 'panel.js'],
  ];
  const GENERIC = { serif: 'serif', mono: 'monospace', sans: 'sans-serif' };
  const GROUP = { bundled: 'Bundled (offline)', installed: 'Downloaded', own: 'Your own' };

  let indexP = null, depsP = null, known = [], cssDone = false;
  const meta = new Map();          // family -> { category }
  const loaded = new Map();        // family -> { promise, faces: FontFace[], bundled }

  /** Loads the library scripts, the catalogue and the Fonts panel (in order) when the page does not have them yet. */
  function deps() {
    if (depsP) return depsP;
    depsP = DEPS.reduce((chain, [have, file]) => chain.then(() => (have() ? null : new Promise((resolve) => {
      const s = doc.createElement('script');
      s.src = new URL(file, SELF).href; s.async = false;
      s.onload = s.onerror = () => resolve();
      doc.head.append(s);
    }))), Promise.resolve());
    return depsP;
  }

  /** The bundled font index: the one list of bundled faces. Resolves [] when it cannot be read. */
  function bundledIndex() {
    if (!indexP) {
      indexP = fetch(LIB + 'index.json', { cache: 'no-cache' })
        .then((r) => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
        .then((j) => { for (const f of j.fonts || []) if (!meta.has(f.family)) meta.set(f.family, { category: f.category || 'sans' }); return j.fonts || []; })
        .catch(() => []);
    }
    return indexP;
  }

  /** Every family the app can use (from the catalogue): { name, category, source: 'bundled' | 'installed' | 'own' }. */
  async function families() { await deps(); return root.SlopFontCatalog.families(); }

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
        const packs = await root.SlopLibraryStore.listPacks();
        const pick = (match) => packs.flatMap((p) => p.files.filter(match).map((f) => [p, f]));
        let hits = pick((x) => x.family === family);
        // a name with no faces of its own (Calibri) draws with an installed family that has the same widths (Carlito)
        if (!hits.length) hits = pick((x) => (x.metricFor || []).some((m) => m.toLowerCase() === family.toLowerCase()));
        for (const [p, f] of hits) {
          const blob = await root.SlopLibraryStore.getBlob(`${p.id}/${f.name}`);
          if (blob) await add(await blob.arrayBuffer(), { weight: f.weight, style: f.style });
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

  /** After a pack is installed or removed (or a font file is added): forget downloaded faces so they re-read the store. */
  function dropDownloaded() {
    for (const [k, r] of loaded) if (!r.bundled) { for (const ff of r.faces) doc.fonts.delete(ff); loaded.delete(k); }
  }

  /** CSS font-family list for a family name: the name, then a generic guessed from the bundled category. */
  function stack(family) {
    const m = meta.get(family);
    return `"${String(family).replace(/"/g, '')}", ${GENERIC[m ? m.category : 'sans'] || 'sans-serif'}`;
  }
  /** The standard names (Helvetica, Times, Courier) as CSS stacks: they are not installed families, so the sample uses a
   *  system face with the same look. */
  const STANDARD_CSS = { Helvetica: 'Arial, Helvetica, sans-serif', Times: '"Times New Roman", Times, serif', Courier: '"Courier New", Courier, monospace' };
  function sampleStack(family) { return STANDARD_CSS[family] || stack(family); }

  /** Rebuilds the options. Legacy entries are a name or a [value, label] pair. The value in the select (or current) is kept
   * even when that font is not installed, so a saved document still shows it. */
  function render(sel, legacy, fams, current) {
    const want = sel.value || current || '';
    const groups = [['Standard', []], [GROUP.bundled, []], [GROUP.installed, []], [GROUP.own, []]];
    const slot = { bundled: 1, installed: 2, own: 3 };
    const seen = new Set();
    for (const l of legacy) { const [v, text] = Array.isArray(l) ? l : [l, l]; if (!seen.has(v)) { seen.add(v); groups[0][1].push([v, text]); } }
    // a family with the same widths as an Office font says so: "Carlito (Calibri)"
    for (const f of fams) if (!seen.has(f.name)) { seen.add(f.name); groups[slot[f.source] || 2][1].push([f.name, f.metricFor && f.metricFor.length ? `${f.name} (${f.metricFor.join(', ')})` : f.name]); }
    const via = want && !seen.has(want) && fams.find((f) => (f.metricFor || []).some((m) => m.toLowerCase() === want.toLowerCase()));
    if (want && !seen.has(want)) groups[0][1].unshift([want, want + (via ? ` (set in ${via.name})` : ' (not installed)')]);
    sel.replaceChildren(...groups.filter((g) => g[1].length).map(([label, items]) => {
      const og = doc.createElement('optgroup'); og.label = label;
      for (const [v, text] of items) { const o = doc.createElement('option'); o.value = v; o.textContent = text; og.append(o); }
      return og;
    }));
    sel.value = want;
  }

  /** Family names the picker last listed (synchronous, for menus). Empty until the first attach has listed them. */
  function names() { return known.slice(); }

  /** Connects a <select> to the picker. opts: { value, legacy: [names or [value, label]], onPick(family), getMore: true,
   * docFonts(): the names the document uses (the Fonts panel lists them; default: the current value) }.
   * Returns { refresh(), set(family), button (Get more), fontsButton (Fonts…) }. When the select is already in the page the
   * two buttons are inserted after it; otherwise the caller places them. */
  function attach(sel, opts = {}) {
    const legacy = opts.legacy || [];
    const standard = legacy.map((l) => (Array.isArray(l) ? l[0] : l));
    const current = opts.value || standard[0] || '';
    if (!cssDone) {
      cssDone = true;
      doc.head.append(Object.assign(doc.createElement('style'), { textContent: '.slop-getmore{font:inherit;font-size:11px;padding:1px 6px;margin-left:4px;border:1px solid currentColor;border-radius:4px;background:transparent;color:inherit;cursor:pointer;opacity:.85;white-space:nowrap}.slop-font-sample{margin:4px 0 0;font-size:16px;line-height:1.3;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}' }));
    }
    const refresh = async () => {
      const fams = await families();
      known = fams.map((f) => f.name);
      render(sel, legacy, fams, sel.value || current);
      showSample(sel.value || current);
    };
    // The sample line (opts.preview): the family's own face, once it is loaded, so the person sees how the name looks.
    const sample = doc.createElement('p');
    sample.className = 'slop-font-sample';
    sample.setAttribute('aria-hidden', 'true');
    sample.textContent = opts.sampleText || 'The quick brown fox jumps over 13 lazy dogs';
    const showSample = (f) => { if (f) sample.style.fontFamily = sampleStack(f); };
    render(sel, legacy, [], current);
    showSample(sel.value || current);
    refresh().then(() => load(sel.value)).then(() => showSample(sel.value));
    sel.addEventListener('change', async () => {
      const f = sel.value;
      showSample(f);
      await load(f);
      showSample(f);
      if (opts.onPick) opts.onPick(f);
    });
    const button = (text, title, onClick) => {
      const b = doc.createElement('button');
      b.type = 'button'; b.className = 'slop-getmore'; b.textContent = text; b.title = title;
      b.addEventListener('click', onClick);
      return b;
    };
    const btn = button('Get more…', 'Optional font packs. Downloads start only when you click them.', async () => {
      await deps();
      if (root.SlopLibrary) root.SlopLibrary.open({ onInstalled: () => refresh() });
    });
    const fbtn = button('Fonts…', 'The Fonts panel: the fonts this document uses, what is installed, and how to add one.', async () => {
      await deps();
      const docFonts = opts.docFonts ? opts.docFonts() : [sel.value];
      root.SlopFonts.openPanel({
        fonts: docFonts, standard, title: 'Fonts',
        onUse: ({ use }) => { sel.value = use; sel.dispatchEvent(new Event('change')); },
        onAdd: () => refresh(),
      });
    });
    if (opts.getMore !== false && sel.parentNode) sel.insertAdjacentElement('afterend', btn);
    if (opts.getMore !== false && sel.parentNode) btn.insertAdjacentElement('afterend', fbtn);
    if (opts.getMore !== false) {
      deps().then(async () => {
        if (!root.SlopLibrary) return;
        const m = await root.SlopLibrary.loadManifest();
        if (!m.packs.length) btn.textContent = 'Get more (no packs listed)';
        // A select that was rebuilt (the PDF text panel rebuilds on each selection) no longer needs the listener.
        root.SlopLibrary.onChange(async () => { if (!sel.isConnected) return; dropDownloaded(); await refresh(); load(sel.value); });
      });
    }
    if (opts.preview && sel.parentNode) (opts.getMore !== false ? fbtn : sel).insertAdjacentElement('afterend', sample);
    return {
      refresh, button: btn, fontsButton: fbtn, preview: sample,
      set(family) { sel.value = family; showSample(family); return load(family).then(() => showSample(family)); }
    };
  }

  root.SlopFonts = { families, names, load, stack, attach, bundledIndex, ready: () => deps() };
})(typeof window !== 'undefined' ? window : globalThis);
