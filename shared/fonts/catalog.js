/* Slopographic font catalogue (window.SlopFontCatalog), for every app. One answer to "which families can this app use":
 * - the bundled library, read from shared/fonts/library/index.json (the one font list; picker.js and the tests agree with it);
 * - the fonts installed from "Get more" packs and the font files the person added, both in IndexedDB (shared/library/store.js).
 * It also reads PostScript font names ("ABCDEF+Barlow-SemiBold"), picks a face by weight and style, names the closest bundled
 * family for a font that is not installed, and checks a font file the person owns with fontkit (vendor/fontkit) before storing it.
 * Nothing is downloaded here. A face is embeddable in a saved PDF when it is a TTF, OTF or WOFF file (fontkit cannot subset
 * WOFF2); a bundled face names its embeddable copy in index.json ("pdf"). Classic script; needs shared/fonts/picker.js. */
(function (root) {
  'use strict';
  const doc = root.document;
  const SELF = (doc && doc.currentScript && doc.currentScript.src) || root.location.href;
  const LIB = new URL('library/', SELF).href;
  const FONTKIT = new URL('../../vendor/fontkit/fontkit.min.js', SELF).href;
  /** The bundled family that stands in for a font the app does not have, by category. */
  const CLOSEST = { sans: 'Source Sans 3', serif: 'Merriweather', mono: 'Space Mono' };
  const WEIGHTS = { thin: 100, extralight: 200, ultralight: 200, light: 300, regular: 400, normal: 400, book: 400, medium: 500, semibold: 600, demibold: 600, bold: 700, extrabold: 800, ultrabold: 800, black: 900, heavy: 900 };
  const WEIGHT_WORDS = Object.keys(WEIGHTS).sort((a, b) => b.length - a.length);
  const SUBSET = /^[A-Z]{6}\+/;
  let indexP = null, fkP = null;

  /** Resolves once the picker's library scripts (store, manifest, Get more) are on the page. */
  function ready() { return root.SlopFonts ? root.SlopFonts.ready() : Promise.resolve(); }
  /** The bundled font index: the one list of bundled faces. Resolves [] when it cannot be read. */
  function bundled() {
    if (!indexP) {
      indexP = fetch(LIB + 'index.json', { cache: 'no-cache' })
        .then((r) => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
        .then((j) => (j.fonts || []).map((f) => ({ family: f.family, weight: String(f.weight), style: f.style || 'normal', category: f.category || 'sans', source: 'bundled', url: LIB + f.file, embed: f.pdf ? LIB + f.pdf : null })))
        .catch(() => []);
    }
    return indexP;
  }
  /** Every face the app can load: bundled faces, then installed ones. A face has family, weight (a number or "min max"), style. */
  async function faces() {
    const list = (await bundled()).slice();
    try {
      await ready();
      const store = root.SlopLibraryStore;
      if (!store) return list;
      for (const p of await store.listPacks()) {
        if (p.kind === 'model') continue; // AI models are not fonts
        for (const f of p.files) list.push({ family: f.family, weight: String(f.weight), style: f.style || 'normal', category: guessCategory(f.family), source: 'installed', key: `${p.id}/${f.name}`, embed: !/\.woff2$/i.test(f.name) });
      }
    } catch (e) { /* storage unavailable: bundled faces only */ }
    return list;
  }
  /** Families the app can use: name, category and where they come from (bundled or installed). */
  async function families() {
    const seen = new Map();
    for (const f of await faces()) if (!seen.has(f.family)) seen.set(f.family, { name: f.family, category: f.category, source: f.source });
    return [...seen.values()];
  }
  /** Whether a family (exact name) has at least one face installed or bundled. */
  async function hasFamily(name) { return (await faces()).some((f) => f.family === name); }
  /** The weight range a face covers: [400, 400] for a static face, [100, 900] for a variable one. */
  function range(w) { const n = String(w).trim().split(/\s+/).map(Number); return [n[0], n[1] || n[0]]; }
  /** The embeddable face of a family that best fits a weight (100-900) and style (style counts after weight), or null when
   * the family has no embeddable face. */
  async function pickFace(family, weight, italic) {
    const want = italic ? 'italic' : 'normal', target = Number(weight) || 400;
    let best = null, bestD = Infinity;
    for (const f of await faces()) {
      if (f.family !== family || !f.embed) continue;
      const [lo, hi] = range(f.weight);
      const d = (target >= lo && target <= hi ? 0 : Math.min(Math.abs(target - lo), Math.abs(target - hi))) + (f.style === want ? 0 : 1000);
      if (d < bestD) { best = f; bestD = d; }
    }
    return best;
  }
  /** The file bytes of a face for embedding: fetched for a bundled face, read from IndexedDB for an installed one. */
  async function bytesOf(face) {
    if (face.source === 'bundled') {
      const r = await fetch(face.embed, { cache: 'force-cache' });
      if (!r.ok) throw new Error(`${face.embed}: HTTP ${r.status}`);
      return new Uint8Array(await r.arrayBuffer());
    }
    const blob = await root.SlopLibraryStore.getBlob(face.key);
    if (!blob) throw new Error('The font file is not on this device any more.');
    return new Uint8Array(await blob.arrayBuffer());
  }
  /** A PostScript font name as { family, weight, italic, subset, name }. "ABCDEF+BarlowCondensed-SemiBold" is the subset
   * "Barlow Condensed", weight 600. A name with no style part is Regular. A subset is marked by its six-letter tag (most
   * writers) or by a numeric suffix ("Barlow-Regular-9742", pdf-lib). */
  function parseName(ps) {
    let s = String(ps || '');
    let subset = SUBSET.test(s);
    if (subset) s = s.slice(7);
    if (/-\d{3,}$/.test(s)) { subset = true; s = s.replace(/-\d{3,}$/, ''); }
    const dash = s.indexOf('-');
    const base = dash < 0 ? s : s.slice(0, dash), style = (dash < 0 ? '' : s.slice(dash + 1)).toLowerCase().replace(/[\s_]/g, '');
    let weight = 400;
    const word = WEIGHT_WORDS.find((w) => style.includes(w));
    if (word) weight = WEIGHTS[word];
    return { family: base.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/\s+/g, ' ').trim(), weight, italic: /italic|oblique/.test(style), subset, name: s };
  }
  /** Whether a family reads as serif, mono or sans, from its name. */
  function guessCategory(name) {
    const n = String(name || '');
    if (/mono|courier|consol|code/i.test(n)) return 'mono';
    if (/serif|times|georgia|garamond|palatino|cambria|minion|caslon|bodoni|roman/i.test(n) && !/sans/i.test(n)) return 'serif';
    return 'sans';
  }
  /** The bundled family that stands in for a family the app does not have (same category). */
  function closestFamily(name) { return CLOSEST[guessCategory(name)]; }
  /** The "Get more" pack that lists a family: { id, name }, or null when no listed pack has it. */
  async function packFor(family) {
    try {
      await ready();
      const m = await root.SlopLibrary.loadManifest();
      const p = m.packs.find((x) => x.kind !== 'model' && x.files.some((f) => f.family === family));
      return p ? { id: p.id, name: p.name } : null;
    } catch (e) { return null; }
  }
  /** fontkit, loaded once from vendor/fontkit on first use. */
  function fontkit() {
    if (root.fontkit) return Promise.resolve(root.fontkit);
    if (!fkP) fkP = new Promise((resolve, reject) => {
      const s = doc.createElement('script');
      s.src = FONTKIT; s.async = false;
      s.onload = () => (root.fontkit ? resolve(root.fontkit) : reject(new Error('fontkit did not load')));
      s.onerror = () => reject(new Error('fontkit could not be loaded'));
      doc.head.append(s);
    });
    return fkP;
  }
  /** Adds a font file the person owns (TTF, OTF, WOFF or WOFF2). fontkit must read it; it is then stored in IndexedDB the
   * same way a pack is (one pack per file, marked as the person's own). Resolves { family, weight, italic }. */
  async function addUserFile(file) {
    const ext = (String(file.name).split('.').pop() || '').toLowerCase();
    if (!['ttf', 'otf', 'woff', 'woff2'].includes(ext)) throw new Error('Choose a font file: TTF, OTF or WOFF.');
    if (ext === 'woff2') throw new Error('WOFF2 files cannot be used in a PDF yet. Drop the TTF, OTF or WOFF version of the font.');
    const bytes = new Uint8Array(await file.arrayBuffer());
    if (bytes.length > 20 * 1024 * 1024) throw new Error('That font file is larger than 20 MB.');
    await ready();
    const store = root.SlopLibraryStore;
    if (!store || !(await store.available())) throw new Error('This browser cannot keep fonts on the device (IndexedDB is unavailable).');
    let f;
    try { const fk = await fontkit(); f = fk.create(bytes); if (f.fonts) f = f.fonts[0]; } catch (e) { throw new Error('That file is not a font this app can read.'); }
    const family = String(f.familyName || '').trim();
    if (!family) throw new Error('That font file has no family name.');
    const w = (f['OS/2'] && f['OS/2'].usWeightClass) || 400, italic = /italic|oblique/i.test(f.subfamilyName || '');
    const sha = await root.SlopLibraryManifest.sha256Hex(bytes), id = 'user-' + family.toLowerCase().replace(/[^a-z0-9]+/g, '-') + '-' + sha.slice(0, 8);
    const name = 'font.' + ext, style = italic ? 'italic' : 'normal';
    const pack = { id, kind: 'font', name: family + ' (your file)', licence: 'user', licenceUrl: '', description: 'A font file added on this device. Nothing is uploaded.', size: bytes.length,
      files: [{ name, url: '', size: bytes.length, sha256: sha, family, weight: String(w), style }] };
    await store.savePack(pack, { [name]: new Blob([bytes], { type: 'font/' + ext }) });
    return { family, weight: w, italic, id };
  }

  root.SlopFontCatalog = { ready, faces, families, hasFamily, pickFace, bytesOf, parseName, guessCategory, closestFamily, packFor, fontkit, addUserFile, range };
})(typeof window !== 'undefined' ? window : globalThis);
