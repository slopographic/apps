/* SlopAIKit webllm: the real engine (vendor/web-llm, WebGPU) plus model cache management. Classic script;
 * adds SlopAIKit.WebLLMEngine and SlopAIKit.models. The 6.6 MB library is imported only when a model loads.
 * Downloads: weights from huggingface.co, kernels (.wasm) from raw.githubusercontent.com, once, into the Cache API
 * (scopes webllm/model, webllm/config, webllm/wasm). Pause = abort the load; finished shards stay cached, so
 * Resume continues where it stopped. */
(function () {
  'use strict';
  const K = (window.SlopAIKit = window.SlopAIKit || {});
  const me = document.currentScript && document.currentScript.src;
  const LIB = new URL('../../vendor/web-llm/web-llm.js', me || location.href).href;
  const LOCAL_KEY = 'slop-ai.local-models', LOCAL_HOST = 'https://local-model.slopographic.invalid/';
  let libP = null;
  const lib = () => (libP = libP || import(LIB));

  const readLocal = () => { try { return JSON.parse(localStorage.getItem(LOCAL_KEY)) || []; } catch (e) { return []; } };
  const writeLocal = (l) => { try { localStorage.setItem(LOCAL_KEY, JSON.stringify(l)); } catch (e) { /* blocked */ } };
  async function appConfig() {
    const w = await lib();
    return Object.assign({}, w.prebuiltAppConfig, { model_list: [...w.prebuiltAppConfig.model_list, ...readLocal()] });
  }
  /** "https://huggingface.co/mlc-ai/X" → "https://huggingface.co/mlc-ai/X/resolve/main/" (same rule as WebLLM). */
  function cleanUrl(u) { u += u.endsWith('/') ? '' : '/'; if (!/.+\/resolve\/.+\//.test(u)) u += 'resolve/main/'; return u; }
  const hfUrl = (id) => cleanUrl('https://huggingface.co/mlc-ai/' + id.replace(/-1k$/, ''));
  const urlFor = (id) => { const l = readLocal().find((r) => r.model_id === id); return l ? cleanUrl(l.model) : hfUrl(id); };

  class WebLLMEngine extends K.Engine {
    constructor() { super(); this.kind = 'webllm'; this.engine = null; }
    async load(model, onProgress, { signal } = {}) {
      const w = await lib();
      const id = typeof model === 'string' ? model : model.loadId || model.id;
      if (this.engine) { try { await this.engine.unload(); } catch (e) { /* ignore */ } }
      const engine = new w.MLCEngine({ appConfig: await appConfig(), initProgressCallback: (p) => onProgress && onProgress({ progress: p.progress, text: p.text }) });
      this.engine = engine;
      const abort = () => engine.unload().catch(() => {});
      if (signal) { if (signal.aborted) throw Object.assign(new Error('Cancelled'), { name: 'AbortError' }); signal.addEventListener('abort', abort, { once: true }); }
      try { await engine.reload(id); } catch (e) {
        this.engine = null;
        if (signal && signal.aborted) throw Object.assign(new Error('Cancelled'), { name: 'AbortError' });
        throw e;
      } finally { if (signal) signal.removeEventListener('abort', abort); }
      this.model = typeof model === 'string' ? { id, name: id } : model; this.loaded = true;
    }
    async unload() { if (this.engine) await this.engine.unload().catch(() => {}); this.engine = null; this.loaded = false; }
    async *_raw(messages, opts = {}) {
      if (!this.engine) throw new Error('No model loaded');
      const req = { messages, stream: true, stream_options: { include_usage: true } };
      if (opts.temperature != null) req.temperature = opts.temperature;
      if (opts.max_tokens) req.max_tokens = opts.max_tokens;
      const chunks = await this.engine.chat.completions.create(req);
      for await (const c of chunks) {
        if (opts.signal && opts.signal.aborted) { this.engine.interruptGenerate(); }
        const d = c.choices && c.choices[0] && c.choices[0].delta && c.choices[0].delta.content;
        if (d) yield d;
        if (c.usage) yield { usage: c.usage };
      }
    }
  }

  /* ---------- cache management without loading the library ---------- */
  async function keysUnder(scope, prefix) {
    if (!self.caches) return [];
    try { const c = await caches.open(scope); return (await c.keys()).filter((r) => r.url.startsWith(prefix)).map((r) => ({ cache: c, req: r })); } catch (e) { return []; }
  }
  /** { state: 'none' | 'partial' | 'ready', bytes, shards, total } for a model id. */
  async function status(id) {
    const base = urlFor(id), keys = await keysUnder('webllm/model', base);
    let bytes = 0, total = 0, shards = 0, hasIndex = false;
    for (const k of keys) {
      const res = await k.cache.match(k.req);
      const len = res && +res.headers.get('content-length');
      if (k.req.url.endsWith('ndarray-cache.json')) { hasIndex = true; try { total = ((await res.clone().json()).records || []).length; } catch (e) { /* bad json */ } }
      else if (/params_shard_\d+\.bin$/.test(k.req.url)) shards++;
      bytes += len > 0 ? len : 0;
    }
    const state = !keys.length ? 'none' : hasIndex && total && shards >= total ? 'ready' : 'partial';
    return { state, bytes, shards, total };
  }
  async function remove(id) {
    const base = urlFor(id);
    for (const scope of ['webllm/model', 'webllm/config']) for (const k of await keysUnder(scope, base)) await k.cache.delete(k.req);
    const l = readLocal(); if (l.some((r) => r.model_id === id)) writeLocal(l.filter((r) => r.model_id !== id));
  }

  /** Load an MLC model folder from disk (input webkitdirectory or showDirectoryPicker): files go into the same caches
   * WebLLM reads, under a private URL, so it never downloads anything. Returns the new model id. */
  async function importFolder(files) {
    files = [...files].map((f) => (f.file ? f : { file: f, path: f.webkitRelativePath || f.name }));
    const cfg = files.find((f) => /(^|\/)mlc-chat-config\.json$/.test(f.path));
    if (!cfg) throw new Error('This folder has no mlc-chat-config.json. Pick an MLC model folder (for example Qwen2.5-1.5B-Instruct-q4f16_1-MLC).');
    const root = cfg.path.replace(/mlc-chat-config\.json$/, '');
    const name = (root.replace(/\/$/, '').split('/').pop() || 'local-model').replace(/[^\w.-]+/g, '-');
    const id = 'local:' + name, base = cleanUrl(LOCAL_HOST + encodeURIComponent(name));
    const model = await caches.open('webllm/model'), config = await caches.open('webllm/config'), wasmC = await caches.open('webllm/wasm');
    let wasm = null;
    for (const f of files) {
      if (!f.path.startsWith(root)) continue;
      const rel = f.path.slice(root.length);
      const res = () => new Response(f.file, { headers: { 'content-type': 'application/octet-stream', 'content-length': String(f.file.size) } });
      if (/\.wasm$/.test(rel)) { wasm = base + rel; await wasmC.put(wasm, res()); continue; }
      await (rel === 'mlc-chat-config.json' ? config : model).put(base + rel, res());
    }
    if (!wasm) {
      const known = K.catalog && K.catalog.byId(name);
      const w = await lib(), rec = known && w.prebuiltAppConfig.model_list.find((r) => r.model_id === name);
      if (!rec) throw new Error('This folder has no .wasm model library. Add the matching *-webgpu.wasm from github.com/mlc-ai/binary-mlc-llm-libs to the folder.');
      wasm = rec.model_lib;
    }
    const l = readLocal().filter((r) => r.model_id !== id);
    l.push({ model: base, model_id: id, model_lib: wasm, vram_required_MB: 0, low_resource_required: false });
    writeLocal(l);
    return id;
  }

  K.WebLLMEngine = WebLLMEngine;
  K.models = { lib, appConfig, status, remove, importFolder, locals: readLocal, urlFor, LIB };
})();
