/* SlopCutout: on-device AI background removal for any Slopographic app. Classic script, sets window.SlopCutout.
 * The model runs in a Web Worker (shared/cutout/worker.js) so the page never freezes.
 *
 *   const r = await SlopCutout.removeBackground(fileOrBitmap, { model: 'quality', onProgress });
 *   r.mask      Uint8ClampedArray (w*h, 0..255): the final alpha (use it as a layer mask)
 *   r.cutout    ImageData: the original pixels with that alpha (edge colours decontaminated)
 *   r.base      Uint8ClampedArray: the refined model mask before threshold/feather/brush edits
 *   r.width, r.height, r.model, r.timings { infer, post, total, backend, cached }
 *   await r.toBlob('image/png')   → Blob of the cutout
 *
 * opts: model 'fast' | 'quality' | 'portrait'; refine (edge-aware upscale, default true); threshold (0..1, .5);
 *   softness (0..1, 1 = keep the soft matte); feather (px); decontaminate (default true);
 *   keep: true keeps the pixels in the worker so finish(r.jobId, settings, edit) can re-run the cheap
 *   post-processing (threshold, brush edits, feather) at full resolution; call release(r.jobId) after.
 *   createJob(input, base) does the same later for a stored base mask without re-running the model.
 *   onProgress({ phase: 'runtime'|'model'|'init'|'infer'|'refine', loaded, total, cached, model }).
 * Accepts Blob/File, ImageBitmap, HTMLImageElement, canvas (incl. OffscreenCanvas) or ImageData. */
(function () {
  'use strict';
  if (window.SlopCutout) return;
  const SCRIPT = document.currentScript;
  const BASE = SCRIPT && SCRIPT.src ? new URL('./', SCRIPT.src).href : new URL('shared/cutout/', location.href).href;
  const conf = { workerUrl: BASE + 'worker.js', init: null };
  let worker = null, seq = 0, jobSeq = 0;
  const pending = new Map();

  function fail(msg) {
    for (const p of pending.values()) p.reject(new Error(msg));
    pending.clear();
    if (worker) worker.terminate();
    worker = null;
  }
  function ensure() {
    if (worker) return worker;
    worker = new Worker(conf.workerUrl);
    worker.onmessage = (e) => {
      const { id, type, data, message } = e.data || {}, p = pending.get(id);
      if (!p) return;
      if (type === 'progress') { if (p.onProgress) try { p.onProgress(data); } catch (err) { console.warn(err); } return; }
      pending.delete(id);
      if (type === 'error') p.reject(new Error(message || 'Background removal failed')); else p.resolve(data);
    };
    worker.onerror = (e) => { e.preventDefault(); fail('The background remover stopped' + (e.message ? ': ' + e.message : ' (out of memory?)')); };
    if (conf.init) worker.postMessage({ id: ++seq, type: 'init', data: conf.init });
    return worker;
  }
  /** Low-level RPC to the worker. */
  function call(type, data, { onProgress, transfer, signal } = {}) {
    return new Promise((resolve, reject) => {
      if (signal && signal.aborted) { reject(new DOMException('Aborted', 'AbortError')); return; }
      const w = ensure(), id = ++seq;
      pending.set(id, { resolve, reject, onProgress });
      if (signal) signal.addEventListener('abort', () => { if (pending.delete(id)) reject(new DOMException('Aborted', 'AbortError')); }, { once: true });
      w.postMessage({ id, type, data }, transfer || []);
    });
  }

  /** Turn any supported input into something we can transfer to the worker. */
  async function prepare(input, { transfer: give = false } = {}) {
    if (typeof ImageData !== 'undefined' && input instanceof ImageData) {
      const copy = new Uint8ClampedArray(input.data);
      return { image: { width: input.width, height: input.height, data: copy }, transfer: [copy.buffer] };
    }
    let bmp;
    if (input instanceof Blob) {
      try { bmp = await createImageBitmap(input, { imageOrientation: 'from-image' }); }
      catch (e) { bmp = await decodeViaImg(input); }
    } else if (typeof ImageBitmap !== 'undefined' && input instanceof ImageBitmap) bmp = give ? input : await createImageBitmap(input);
    else if (input && (input.width || input.naturalWidth)) bmp = await createImageBitmap(input);
    else throw new Error('Unsupported image');
    return { image: bmp, transfer: [bmp] };
  }
  /** Fallback decode (e.g. SVG blobs that createImageBitmap rejects). */
  function decodeViaImg(blob) {
    return new Promise((res, rej) => {
      const url = URL.createObjectURL(blob), img = new Image();
      img.onload = () => { const c = document.createElement('canvas'); c.width = img.naturalWidth || 1024; c.height = img.naturalHeight || 1024; c.getContext('2d').drawImage(img, 0, 0, c.width, c.height); URL.revokeObjectURL(url); createImageBitmap(c).then(res, rej); };
      img.onerror = () => { URL.revokeObjectURL(url); rej(new Error('Could not read this image')); };
      img.src = url;
    });
  }

  const settingsOf = (o) => ({ threshold: o.threshold, softness: o.softness, feather: o.feather, decontaminate: o.decontaminate, decontaminateStrength: o.decontaminateStrength });
  function wrap(r, extra) {
    const out = Object.assign({}, r, extra);
    out.cutout = new ImageData(r.cutout, r.width, r.height);
    out.toBlob = (type = 'image/png', quality) => toBlob(out.cutout, type, quality);
    out.maskImageData = () => maskToImageData(out.mask, r.width, r.height);
    return out;
  }

  async function removeBackground(input, opts = {}) {
    const { image, transfer } = await prepare(input, opts);
    const jobId = opts.keep ? 'j' + (++jobSeq) : null;
    const r = await call('segment', { image, model: opts.model || 'fast', jobId, refine: opts.refine, guided: opts.guided, wantLow: !!opts.wantLow, settings: settingsOf(opts) },
      { onProgress: opts.onProgress, transfer, signal: opts.signal });
    return wrap(r, { jobId });
  }
  /** Re-run threshold → brush edit → feather → decontaminate at full resolution for a kept job.
   *  edit: optional Uint8Array (w*h, 128 = untouched, 255 = keep, 0 = remove); it is copied. */
  async function finish(jobId, settings = {}, edit = null, { base } = {}) {
    const e = edit ? edit.slice() : null, b = base ? base.slice() : null;
    const r = await call('finish', { jobId, settings: settingsOf(settings), edit: e && e.buffer, base: b && b.buffer }, { transfer: [e && e.buffer, b && b.buffer].filter(Boolean) });
    return wrap(r, { jobId });
  }

  /** Store an image plus a base mask from an earlier removeBackground() in the worker, without running
   *  the model again, so finish() works on it. Resolves with the new jobId. */
  async function createJob(input, base) {
    const { image, transfer } = await prepare(input), b = base.slice(), jobId = 'j' + (++jobSeq);
    await call('job', { jobId, image, base: b.buffer }, { transfer: transfer.concat([b.buffer]) });
    return jobId;
  }

  /* ---------- helpers ---------- */
  function canvasOf(imageData) {
    const c = typeof OffscreenCanvas !== 'undefined' ? new OffscreenCanvas(imageData.width, imageData.height) : Object.assign(document.createElement('canvas'), { width: imageData.width, height: imageData.height });
    c.getContext('2d').putImageData(imageData, 0, 0);
    return c;
  }
  function toBlob(imageData, type = 'image/png', quality) {
    const c = canvasOf(imageData);
    if (c.convertToBlob) return c.convertToBlob({ type, quality });
    return new Promise((res) => c.toBlob(res, type, quality));
  }
  /** Grey RGBA view of a mask (white = keep), e.g. for a PhotoSlop layer mask or a preview. */
  function maskToImageData(mask, w, h) {
    const d = new Uint8ClampedArray(w * h * 4);
    for (let i = 0, j = 0; i < mask.length; i++, j += 4) { d[j] = d[j + 1] = d[j + 2] = mask[i]; d[j + 3] = 255; }
    return new ImageData(d, w, h);
  }

  window.SlopCutout = {
    removeBackground, finish, createJob,
    release: (jobId) => (jobId && worker ? call('release', { jobId }) : Promise.resolve()),
    /** Download (or read from cache) and initialise a model ahead of time. */
    load: (model = 'fast', onProgress) => call('load', { model }, { onProgress }),
    /** { fast: bool, quality: bool, portrait: bool }: which models are already stored on this device. */
    cached: () => call('cached'),
    info: () => call('info'),
    /** configure({ workerUrl, backend: 'auto'|'wasm', vendor, models, sources }) before the first call. */
    configure(o = {}) {
      if (o.workerUrl) conf.workerUrl = o.workerUrl;
      const init = {};
      for (const k of ['backend', 'vendor', 'models', 'sources']) if (o[k] !== undefined) init[k] = o[k];
      conf.init = Object.assign(conf.init || {}, init);
      if (worker && Object.keys(init).length) { if (o.backend !== undefined) fail('Restarting with a new backend'); else worker.postMessage({ id: ++seq, type: 'init', data: init }); }
    },
    terminate: () => fail('Stopped'),
    call, toBlob, maskToImageData, canvasOf, BASE,
    get busy() { return pending.size; },
  };
})();
