/* SlopCutout worker: runs ONNX Runtime Web and the full pre/post-processing off the main thread.
 * Classic worker (importScripts for the pipeline, dynamic import() for ONNX Runtime's ES module).
 * Backend: WebGPU when available (full build), else single-thread WebAssembly SIMD (wasm-only build).
 * No COOP/COEP on the site → no SharedArrayBuffer → numThreads = 1, proxy off.
 * Protocol (all messages carry id): main → { type: 'init'|'load'|'segment'|'finish'|'release'|'cached'|'info'|'ping'|'fail', … }
 *                                   worker → { id, type: 'progress', data } | { id, type: 'done', data } | { id, type: 'error', message }. */
/* global importScripts */
'use strict';
importScripts('pipeline.js', 'refine.js', 'models.js', 'loader.js');
const P = self.SlopCutoutPipeline, M = self.SlopCutoutModels, L = self.SlopCutoutLoader;
const cfg = { vendor: new URL('../../vendor/onnxruntime-web/', self.location.href).href, models: new URL('../../vendor/models/', self.location.href).href, backend: 'auto', sources: null };
let ortp = null, backend = null;
const sessions = new Map(), jobs = new Map();
/** One model pass at a time in this worker: segment messages are async, so two can be in flight here, and a session
 *  must not run twice at once (the WebGPU backend's run is asynchronous and shares its buffers between runs). */
let gate = Promise.resolve();
function exclusive(fn) { const p = gate.then(fn, fn); gate = p.catch(() => {}); return p; }
const send = (id, type, data, transfer) => self.postMessage({ id, type, data }, transfer || []);

/* ---------- ONNX Runtime ---------- */
async function gpuOK() {
  if (cfg.backend === 'wasm' || !self.navigator || !navigator.gpu) return false;
  try {
    const a = await navigator.gpu.requestAdapter({ powerPreference: 'high-performance' });
    if (!a) return false;
    const info = a.info || (a.requestAdapterInfo ? await a.requestAdapterInfo() : {}) || {};
    // A software adapter (SwiftShader, llvmpipe) is far slower than WebAssembly: skip it.
    if (a.isFallbackAdapter || info.isFallbackAdapter) return false;
    return !/swiftshader|llvmpipe|software|basic render/i.test([info.vendor, info.architecture, info.device, info.description].join(' '));
  } catch (e) { return false; }
}
/** A source URL: the vendored file, or a Blob URL from an offline single-file build. */
const src = (base, file) => (cfg.sources && cfg.sources[file]) || base + file;
function initOrt(progress) {
  if (!ortp) ortp = (async () => {
    const gpu = await gpuOK();
    const js = gpu ? 'ort.min.mjs' : 'ort.wasm.min.mjs', glue = gpu ? 'ort-wasm-simd-threaded.jsep.mjs' : 'ort-wasm-simd-threaded.mjs', wasm = gpu ? 'ort-wasm-simd-threaded.jsep.wasm' : 'ort-wasm-simd-threaded.wasm';
    const ort = await import(src(cfg.vendor, js));
    ort.env.wasm.numThreads = 1;
    ort.env.wasm.proxy = false;
    ort.env.wasm.wasmPaths = { mjs: src(cfg.vendor, glue), wasm: src(cfg.vendor, wasm) };
    ort.env.logLevel = 'error';
    const bin = await L.fetchCached(src(cfg.vendor, wasm), { onProgress: (p) => progress({ phase: 'runtime', ...p }) });
    ort.env.wasm.wasmBinary = bin.buffer;
    backend = gpu ? 'webgpu' : 'wasm';
    return ort;
  })().catch((e) => { ortp = null; throw e; });
  return ortp;
}
async function session(modelId, progress, forceWasm) {
  const m = M.get(modelId);
  if (sessions.has(m.id) && !forceWasm) return sessions.get(m.id);
  const p = (async () => {
    const ort = await initOrt(progress);
    const file = await L.fetchCached(src(cfg.models, m.file), { sha256: m.sha256, bytes: m.bytes, onProgress: (x) => progress({ phase: 'model', model: m.id, ...x }) });
    progress({ phase: 'init', model: m.id });
    const t0 = performance.now();
    let s = null;
    if (backend === 'webgpu' && !forceWasm) {
      try { s = await ort.InferenceSession.create(file.buffer, { executionProviders: ['webgpu', 'wasm'], graphOptimizationLevel: 'all' }); s.backend = 'webgpu'; }
      catch (e) { console.warn('SlopCutout: WebGPU session failed, using WebAssembly', e); }
    }
    if (!s) { s = await ort.InferenceSession.create(file.buffer, { executionProviders: ['wasm'], graphOptimizationLevel: 'all' }); s.backend = 'wasm'; }
    s.initMs = performance.now() - t0;
    s.cached = file.cached;
    return s;
  })();
  if (forceWasm && sessions.has(m.id)) sessions.get(m.id).then((old) => old.release && old.release()).catch(() => {});
  sessions.set(m.id, p);
  p.catch(() => sessions.delete(m.id));
  return p;
}

/* ---------- images ---------- */
function pixels(img) {
  if (img && img.data && img.width) return { W: img.width, H: img.height, rgba: new Uint8ClampedArray(img.data.buffer || img.data) };
  const W = img.width, H = img.height, c = new OffscreenCanvas(W, H), x = c.getContext('2d', { willReadFrequently: true });
  x.drawImage(img, 0, 0);
  if (img.close) img.close();
  return { W, H, rgba: x.getImageData(0, 0, W, H).data };
}

/** Run the model on rgba and return the low-res mask (Float32 0..1) and its size. */
async function infer(modelId, rgba, W, H, progress) {
  const m = M.get(modelId), ort = await initOrt(progress);
  let s = await session(m.id, progress);
  const [tw, th] = M.inputSize(m, W, H);
  progress({ phase: 'infer', model: m.id });
  const small = P.resizeRGBA(rgba, W, H, tw, th);
  const tensor = new ort.Tensor('float32', P.toTensor(small, tw, th, m), [1, 3, th, tw]);
  const feed = (sess) => ({ [sess.inputNames.includes(m.input) ? m.input : sess.inputNames[0]]: tensor });
  let t0 = performance.now(), out;
  try {
    out = await exclusive(() => s.run(feed(s)));
    if (s.backend === 'webgpu') { const d = out[s.outputNames[0]].data; for (let i = 0; i < d.length; i += 97) if (!Number.isFinite(d[i])) throw new Error('non-finite output'); }
  } catch (e) {
    if (s.backend !== 'webgpu') throw e;
    console.warn('SlopCutout: WebGPU run failed, retrying on WebAssembly:', e.message);
    s = await session(m.id, progress, true);
    t0 = performance.now(); out = await exclusive(() => s.run(feed(s)));
  }
  const ms = performance.now() - t0;
  const res = out[s.outputNames[0]], dims = res.dims, low = new Float32Array(res.data);
  if (res.dispose) res.dispose();
  if (m.minMax) P.minMax(low); else for (let i = 0; i < low.length; i++) low[i] = P.clamp(low[i], 0, 1);
  return { low, mw: dims[dims.length - 1], mh: dims[dims.length - 2], ms, backend: s.backend, initMs: s.initMs, cached: s.cached };
}

/* ---------- handlers ---------- */
const handlers = {
  ping(d, progress) { for (let i = 1; i <= ((d && d.steps) || 0); i++) progress({ phase: 'ping', loaded: i, total: d.steps }); return { pong: d && d.value, time: Date.now() }; },
  fail: (d) => { throw new Error((d && d.message) || 'Requested failure'); },
  init(d) { Object.assign(cfg, d || {}); return { ok: true }; },
  async info() { return { backend, gpu: !!(self.navigator && navigator.gpu), loaded: [...sessions.keys()], jobs: jobs.size }; },
  async load(d, progress) { const s = await session(d.model, progress); return { model: M.get(d.model).id, backend: s.backend, initMs: s.initMs, cached: s.cached }; },
  async cached() {
    const out = {};
    for (const id of M.ids) out[id] = await L.isCached(src(cfg.models, M.MODELS[id].file), M.MODELS[id].sha256);
    return out;
  },
  /** { image, model, jobId?, refine = true, settings } → { width, height, base, mask, cutout, timings } */
  async segment(d, progress) {
    const t0 = performance.now();
    const { W, H, rgba } = pixels(d.image);
    const r = await infer(d.model, rgba, W, H, progress);
    progress({ phase: 'refine', model: d.model });
    const t1 = performance.now();
    const base = d.refine === false ? P.plainUpsample(r.low, r.mw, r.mh, W, H) : P.guidedUpsample(rgba, W, H, r.low, r.mw, r.mh, d.guided || {});
    const fin = P.finish(rgba, W, H, base, null, d.settings || {});
    if (d.jobId != null) jobs.set(d.jobId, { rgba, W, H, base });
    const baseOut = d.jobId != null ? base.slice() : base;
    const timings = { total: performance.now() - t0, infer: r.ms, post: performance.now() - t1, init: r.initMs, backend: r.backend, cached: r.cached, input: M.inputSize(d.model, W, H) };
    return { result: { width: W, height: H, base: baseOut, mask: fin.mask, cutout: fin.cutout, low: d.wantLow ? r.low : null, lowSize: [r.mw, r.mh], model: M.get(d.model).id, timings },
      transfer: [baseOut.buffer, fin.mask.buffer, fin.cutout.buffer] };
  },
  /** { jobId, edit?, settings, base? } → { mask, cutout } using the job's stored pixels. */
  async finish(d) {
    const j = jobs.get(d.jobId);
    if (!j) throw new Error('Unknown cutout job ' + d.jobId);
    if (d.base) j.base = new Uint8ClampedArray(d.base);
    const fin = P.finish(j.rgba, j.W, j.H, j.base, d.edit ? new Uint8ClampedArray(d.edit) : null, d.settings || {});
    return { result: { width: j.W, height: j.H, mask: fin.mask, cutout: fin.cutout }, transfer: [fin.mask.buffer, fin.cutout.buffer] };
  },
  /** { jobId, image, base } → stores pixels + an existing base mask (from an earlier segment) for finish(). */
  job(d) {
    const { W, H, rgba } = pixels(d.image), base = new Uint8ClampedArray(d.base);
    if (base.length !== W * H) throw new Error('Mask size does not match the image');
    jobs.set(d.jobId, { rgba, W, H, base });
    return { width: W, height: H };
  },
  release(d) { jobs.delete(d.jobId); return { ok: true }; },
};

self.onmessage = async (e) => {
  const { id, type, data } = e.data || {};
  const h = handlers[type];
  if (!h) { self.postMessage({ id, type: 'error', message: 'Unknown message ' + type }); return; }
  try {
    const out = await h(data, (p) => send(id, 'progress', p));
    if (out && out.transfer) send(id, 'done', out.result, out.transfer); else send(id, 'done', out);
  } catch (err) {
    self.postMessage({ id, type: 'error', message: (err && err.message) || String(err) });
  }
};
