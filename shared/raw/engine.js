/* Camera RAW: the full decoder, LibRaw 0.22.1 compiled to WebAssembly (libraw-wasm 1.6.0; LibRaw is LGPL-2.1 or
 * CDDL-1.0, see the cdn's engines/libraw/libraw-wasm-1.6.0/SOURCE.md). Its two files (about 1.4 MB) are fetched just in
 * time from the Slopographic cdn at a pinned commit, the first time a RAW file is developed, after the shared first-use
 * notice (shared/firstrun/notice.js). The download goes through the shared installer (shared/library/install.js: allowed
 * host, byte length and SHA-256 checked, kept in IndexedDB), so it happens once per browser. Decoding runs in a Web
 * Worker (worker.js). Loads its helpers on first use. Classic script; exposes window.SlopRawEngine:
 *   PACK                                  the engine as an installer pack (files, sizes, checksums, pinned URLs)
 *   settingsFor(opts) -> LibRaw settings  pure: { wb: 'camera'|'auto'|'daylight', exposure (EV), highlights:
 *                                         'clip'|'blend'|'rebuild', bits: 8|16, half }
 *   ready({ ask, onStatus }) -> Promise   resolves when the engine can run; rejects (err.code 'declined' when the
 *                                         person said no; ask: false never shows the notice and rejects instead)
 *   decode(bytes, opts, onProgress) -> Promise<{ width, height, bits, data, meta }>   see worker.js for data
 *   installed() -> Promise<boolean>       forget() -> Promise   (removes the stored engine, for tests and settings) */
(function (root) {
  'use strict';
  const doc = root.document;
  const SELF = (doc && doc.currentScript && doc.currentScript.src) || (root.location && root.location.href) || '';
  const BASE = 'https://raw.githubusercontent.com/slopographic/cdn/0cd1e199373a327108ba91702e597d767fbfc3f9/engines/libraw/libraw-wasm-1.6.0/';
  const FILES = [
    { name: 'libraw.js', size: 69155, sha256: 'e23952fca5b268550af1f84619af5c0c035e5db3bde0e4d5a20300f1614a9487' },
    { name: 'libraw.wasm', size: 1417725, sha256: '8947f7e668e488461c3e9defe7007583aa8477b4886aa603b36b407f2f0846ff' },
  ];
  const PACK = {
    id: 'engine-libraw', kind: 'model', name: 'Camera RAW engine (LibRaw 0.22.1, WebAssembly)', licence: 'LGPL-2.1 or CDDL-1.0',
    licenceUrl: BASE + 'SOURCE.md', size: FILES.reduce((n, f) => n + f.size, 0), files: FILES.map((f) => ({ ...f, url: BASE + f.name })),
  };
  const NOTICE = {
    title: 'Download the camera RAW engine?',
    lines: ['Developing a camera RAW photo needs the RAW engine (LibRaw, compiled to run in your browser; LGPL-2.1 or CDDL-1.0 licence). It is downloaded once from Slopographic\'s file store, checked, and kept in this browser.'],
    downloads: [{ name: 'Camera RAW engine (LibRaw 0.22.1)', bytes: PACK.size }],
  };
  // SlopUI too: SlopFirstRun lets everything through when a page has no dialog kit (File convert's pages), and the
  // engine must not download without the notice
  const DEPS = [['SlopUI', '../slopui.js'], ['SlopLibraryManifest', '../library/manifest.js'], ['SlopLibraryStore', '../library/store.js'], ['SlopLibraryInstall', '../library/install.js'], ['SlopFirstRun', '../firstrun/notice.js']];
  let depsP = null, readyP = null, worker = null, seq = 0;
  const pending = new Map();

  function load(src) {
    return new Promise((res, rej) => { const s = doc.createElement('script'); s.src = new URL(src, SELF).href; s.async = false; s.onload = res; s.onerror = () => rej(new Error('Could not load ' + src)); doc.head.append(s); });
  }
  function deps() {
    if (!root.SlopUI && doc && !doc.querySelector('link[href*="slopui.css"]')) {
      doc.head.append(Object.assign(doc.createElement('link'), { rel: 'stylesheet', href: new URL('../slopui.css', SELF).href }));
    }
    if (!depsP) depsP = DEPS.reduce((p, [g, src]) => p.then(() => (root[g] ? null : load(src))), Promise.resolve());
    depsP.catch(() => { depsP = null; });
    return depsP;
  }

  const HIGHLIGHT = { clip: 0, blend: 2, rebuild: 5 };
  /** LibRaw settings for the develop options. Exposure is a brightness factor of 2^EV after LibRaw's own auto level. */
  function settingsFor(o = {}) {
    const ev = Math.max(-3, Math.min(3, Number(o.exposure) || 0));
    return {
      useCameraWb: o.wb === 'camera' || o.wb == null, useAutoWb: o.wb === 'auto',
      bright: Math.round(Math.pow(2, ev) * 1000) / 1000, highlight: HIGHLIGHT[o.highlights] || 0,
      outputBps: o.bits === 16 ? 16 : 8, outputColor: 1, userFlip: -1, halfSize: !!o.half, userQual: o.half ? 0 : 3,
    };
  }

  /** The stored engine record when it is the current version (same checksums), or null. */
  async function record() {
    const rows = await root.SlopLibraryStore.listPacks().catch(() => []);
    const r = rows.find((x) => x.id === PACK.id);
    return r && FILES.every((f) => r.files.some((g) => g.name === f.name && g.sha256 === f.sha256)) ? r : null;
  }
  async function installed() { await deps(); return !!(await record()); }

  function declined() { const e = new Error('The camera RAW engine was not downloaded'); e.code = 'declined'; return e; }

  /** Starts the worker with the stored files (the script as a blob URL, the WebAssembly as bytes). */
  async function start() {
    const S = root.SlopLibraryStore;
    const [js, wasm] = await Promise.all(FILES.map((f) => S.getBlob(`${PACK.id}/${f.name}`)));
    if (!js || !wasm) throw new Error('The RAW engine is missing from this browser');
    const jsUrl = URL.createObjectURL(new Blob([js], { type: 'text/javascript' }));
    worker = new Worker(new URL('worker.js', SELF).href, { type: 'module' });
    worker.onmessage = ({ data }) => {
      const p = pending.get(data.id);
      if (!p) return;
      if (data.progress) { if (p.onProgress) p.onProgress(data.progress); return; }
      pending.delete(data.id);
      if (data.ok) p.resolve(data.out); else p.reject(new Error(data.error));
    };
    worker.onerror = (e) => { const err = new Error('The RAW engine stopped' + (e && e.message ? ': ' + e.message : '')); reset(err); };
    const buf = await wasm.arrayBuffer();
    await call({ op: 'init', jsUrl, wasm: buf }, [buf]);
  }
  function call(msg, transfer, onProgress) {
    return new Promise((resolve, reject) => {
      const id = ++seq;
      pending.set(id, { resolve, reject, onProgress });
      worker.postMessage({ ...msg, id }, transfer || []);
    });
  }
  /** Stops the worker and fails what was waiting, so the next call starts a fresh one. */
  function reset(err) {
    try { if (worker) worker.terminate(); } catch (e) { /* gone */ }
    worker = null; readyP = null;
    for (const p of pending.values()) p.reject(err || new Error('The RAW engine was stopped'));
    pending.clear();
  }

  async function prepare(o) {
    const say = (t) => { if (o.onStatus) o.onStatus(t); };
    await deps();
    if (!(await record())) {
      if (o.ask === false) throw declined();
      if (!(await root.SlopFirstRun.once('raw-engine', NOTICE))) throw declined();
      say('Downloading the camera RAW engine…');
      try { await root.SlopLibraryInstall.install(PACK, (t) => say('RAW engine: ' + t)); } catch (e) { throw new Error('The camera RAW engine could not be downloaded (' + e.message + ')'); }
    }
    say('Starting the camera RAW engine…');
    await start();
  }
  function ready(o = {}) {
    if (!readyP) { readyP = prepare(o); readyP.catch(() => { if (worker) reset(); readyP = null; }); }
    return readyP;
  }

  /** Develops one RAW file. bytes: Uint8Array or ArrayBuffer (copied, so the caller keeps it). */
  async function decode(bytes, opts = {}, onProgress) {
    const say = (t) => { if (onProgress) onProgress(t); };
    await ready({ ask: opts.ask, onStatus: say });
    const copy = new Uint8Array(bytes instanceof ArrayBuffer ? bytes.slice(0) : bytes);   // a typed array is copied by the constructor
    const words = { open: 'Reading the RAW file…', develop: 'Developing…' };
    return call({ op: 'decode', bytes: copy, settings: settingsFor(opts) }, [copy.buffer], (p) => say(words[p] || p));
  }

  async function forget() {
    reset();
    await deps();
    await root.SlopLibraryStore.removePack(PACK.id).catch(() => {});
  }

  root.SlopRawEngine = { PACK, NOTICE, settingsFor, ready, decode, installed, forget, reset };
})(typeof window !== 'undefined' ? window : globalThis);
