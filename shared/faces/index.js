/* SlopFaces: on-device face detection, OFF by default. Classic script; exposes window.SlopFaces:
 *   enabled() / setEnabled(on)  the opt-in, stored once in SlopProfile ('faces', 'detect'). Off until the person turns it on.
 *   status()                    'off' | 'idle' | 'loading' | 'ready' | 'unavailable'
 *   detect(source)              [{ x, y, w, h, score }] in the source's pixels. While off: [] and no model work at all.
 *   analyse(scope, id, stamp, blob)  cached detection for one picture: { w, h, faces } or null (off, or unreadable).
 *   onChange(fn)                fires when the setting or the model state changes (also from another tab).
 *   setBackend({ detect }) / MODEL  tests stub the detector; MODEL describes the vendored file.
 * The model is vendor/face/ (YuNet, MIT). ONNX Runtime Web is vendor/onnxruntime-web/. Needs decode.js, cache.js and
 * copy.js first, and profile.js with app-options.js for the setting. Everything is in try/catch. See shared/faces/HANDOFF.md. */
(function (g) {
  'use strict';
  const F = (g.SlopFaces = g.SlopFaces || {});
  const MODEL = Object.freeze({
    id: 'yunet-2023mar', file: 'face_detection_yunet_2023mar.onnx', bytes: 232589, licence: 'MIT',
    sha256: '8f2383e4dd3cfbb4553ea8718107fc0423210dc964f9f4280604804ed2552fa4',
  });
  const MIN_SCORE = 0.6, MAX_IOU = 0.3;
  F.MODEL = MODEL;
  F.MODEL_ID = MODEL.id;

  /** The vendor folder, found from this script's own URL (so it works from any app folder). */
  const VENDOR = (() => {
    try {
      const cs = typeof document !== 'undefined' && document.currentScript;
      const base = cs && cs.src ? cs.src : (g.location ? g.location.href : 'http://localhost/');
      return new URL('../../vendor/', base).href;
    } catch (e) { return '/vendor/'; }
  })();

  let backend = null, state = 'idle', loading = null, lastError = '';
  const hex = (buf) => Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, '0')).join('');
  const profile = () => g.SlopProfile || null;

  function changed() {
    try { g.dispatchEvent(new g.CustomEvent('slop-faces-change')); } catch (e) { /* no event target here */ }
  }
  F.onChange = (fn) => { try { g.addEventListener('slop-faces-change', fn); } catch (e) { /* ignore */ } };

  /** The opt-in. Read from SlopProfile each time, so a change in another tab or on the Profile page applies at once. */
  F.enabled = function () {
    try { const P = profile(); return !!(P && P.get('faces', 'detect', false) === true); } catch (e) { return false; }
  };
  /** Turns detection on or off. Off also frees the model. Returns { ok } or { ok: false, error }. */
  F.setEnabled = function (on) {
    try {
      const P = profile();
      if (!P) return { ok: false, error: 'Settings are not available in this page.' };
      const r = P.set('faces', 'detect', !!on);
      if (!r || !r.ok) return { ok: false, error: (r && r.error) || 'Could not save the setting.' };
      if (!on) { backend = null; state = 'idle'; loading = null; }
      changed();
      return { ok: true };
    } catch (e) { return { ok: false, error: 'Could not save the setting.' }; }
  };
  F.status = () => (!F.enabled() ? 'off' : state);
  F.lastError = () => lastError;

  /** Letterboxes the source into the model's square input and returns the BGR planes (0 to 255) and the scale. */
  function preprocess(source, w, h) {
    const S = F.INPUT_SIZE, scale = F.scaleFor(w, h);
    const c = document.createElement('canvas');
    c.width = S; c.height = S;
    const ctx = c.getContext('2d', { willReadFrequently: true });
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, S, S);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high'; // a clean downscale: the boxes then match the reference decoder closely
    ctx.drawImage(source, 0, 0, w * scale, h * scale);
    const px = ctx.getImageData(0, 0, S, S).data, plane = S * S, t = new Float32Array(3 * plane);
    for (let i = 0; i < plane; i++) { t[i] = px[i * 4 + 2]; t[plane + i] = px[i * 4 + 1]; t[2 * plane + i] = px[i * 4]; }
    return { tensor: t, scale };
  }

  /** Loads the model once: fetch, check the sha256, then open it with ONNX Runtime Web (one thread, no proxy). */
  async function loadModel() {
    const modelUrl = new URL('face/' + MODEL.file, VENDOR).href;
    const res = await fetch(modelUrl);
    if (!res.ok) throw new Error('The face model could not be loaded (' + res.status + ').');
    const bytes = await res.arrayBuffer();
    if (!g.crypto || !g.crypto.subtle) throw new Error('This browser cannot check the face model.');
    if (hex(await g.crypto.subtle.digest('SHA-256', bytes)) !== MODEL.sha256) throw new Error('The face model failed its checksum.');
    const ort = await import(new URL('onnxruntime-web/ort.wasm.min.mjs', VENDOR).href);
    ort.env.wasm.numThreads = 1;
    ort.env.wasm.proxy = false;
    ort.env.wasm.wasmPaths = { mjs: new URL('onnxruntime-web/ort-wasm-simd-threaded.mjs', VENDOR).href, wasm: new URL('onnxruntime-web/ort-wasm-simd-threaded.wasm', VENDOR).href };
    ort.env.logLevel = 'error';
    const session = await ort.InferenceSession.create(new Uint8Array(bytes), { executionProviders: ['wasm'], graphOptimizationLevel: 'all' });
    const input = session.inputNames[0];
    return {
      async detect(source) {
        const w = source.width || source.naturalWidth, h = source.height || source.naturalHeight;
        if (!w || !h) return [];
        const { tensor, scale } = preprocess(source, w, h);
        const out = await session.run({ [input]: new ort.Tensor('float32', tensor, [1, 3, F.INPUT_SIZE, F.INPUT_SIZE]) });
        const data = {};
        for (const k of Object.keys(out)) data[k] = out[k].data;
        return F.filterBoxes(F.decodeYunet(data, { scale, minScore: MIN_SCORE }), { minScore: MIN_SCORE, maxIou: MAX_IOU });
      },
    };
  }

  /** The loaded detector, loading it on first use. Shares one load between callers. A load that finishes after the
   * setting was turned off is dropped. */
  function ensure() {
    if (backend) return Promise.resolve(backend);
    if (!loading) {
      state = 'loading';
      const p = loadModel().then((b) => {
        if (loading !== p) return b; // turned off (or stubbed) while loading
        backend = b; state = 'ready'; lastError = '';
        return b;
      }, (e) => {
        if (loading === p) { state = 'unavailable'; loading = null; }
        throw e;
      });
      loading = p;
    }
    return loading;
  }
  /** Boxes from the detector. Null when off or the source is empty. Throws when the model fails (analyse() relies on
   * that, so a failure is never stored as "no faces"). */
  async function detectRaw(source) {
    if (!F.enabled() || !source) return null;
    const b = backend || await ensure();
    return b.detect(source);
  }

  /** Faces in a picture (an ImageBitmap, canvas, image or video frame). [] when the opt-in is off, the picture is
   * empty or anything fails: the caller never has to catch. */
  F.detect = async function (source) {
    try {
      const boxes = await detectRaw(source);
      return boxes ? boxes.map((f) => ({ x: f.x, y: f.y, w: f.w, h: f.h, score: f.score })) : [];
    } catch (e) { lastError = (e && e.message) || String(e); return []; }
  };

  /** Cached detection for one picture. Reads the stored result when its stamp (and the model) match, otherwise
   * detects, stores and returns it. Null when detection is off or the picture cannot be read. */
  F.analyse = async function (scope, id, stamp, blob) {
    try {
      if (!F.enabled() || !blob) return null;
      const row = await F.cache.get(scope, id, stamp);
      if (row) return { w: row.w, h: row.h, faces: row.faces, cached: true };
      if (!g.createImageBitmap) return null;
      const bmp = await g.createImageBitmap(blob);
      const w = bmp.width, h = bmp.height;
      let faces;
      try { faces = await detectRaw(bmp); } finally { if (bmp.close) bmp.close(); }
      if (!faces) return null;
      const res = { w, h, faces: faces.map((f) => ({ x: f.x, y: f.y, w: f.w, h: f.h, score: f.score })) };
      await F.cache.put(scope, id, stamp, res);
      return Object.assign({ cached: false }, res);
    } catch (e) { lastError = (e && e.message) || String(e); return null; }
  };

  /** Tests: replaces the model with a stub { detect(source) -> boxes }, or restores it with null. */
  F.setBackend = function (b) {
    backend = b || null;
    loading = null;
    state = b ? 'ready' : 'idle';
  };

  // Another tab turned the setting on or off.
  try { g.addEventListener('storage', (e) => { if (e.key === 'slop-profile') changed(); }); } catch (e) { /* no storage events */ }
})(typeof window !== 'undefined' ? window : globalThis);
