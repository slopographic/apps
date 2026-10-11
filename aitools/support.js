/* Slop AI Tools: can this device run a tool? Returns { ok, reason } with a plain reason when it cannot, so the hub
 * can say why instead of hiding the tool. Checks are local and synchronous (no network, no model load).
 * Classic script; exposes window.SlopAISupport. */
(function (root) {
  'use strict';
  const nav = root.navigator || {};
  const has = {
    wasm: typeof root.WebAssembly === 'object' && typeof root.WebAssembly.instantiate === 'function',
    worker: typeof root.Worker === 'function',
    idb: !!root.indexedDB,
    subtle: !!(root.crypto && root.crypto.subtle),
    canvas: typeof root.OffscreenCanvas === 'function' || !!(typeof document !== 'undefined' && document.createElement('canvas').getContext),
    audio: typeof root.AudioContext === 'function' || typeof root.webkitAudioContext === 'function',
  };
  /** The memory the browser reports, in GB (undefined when the browser does not say). */
  const memoryGB = () => (typeof nav.deviceMemory === 'number' ? nav.deviceMemory : undefined);

  /** What each tool needs: wasm, audio, canvas (booleans) and minMemoryGB. */
  const NEEDS = {
    ocr: { wasm: true, minMemoryGB: 2 },
    speech: { wasm: true, audio: true, minMemoryGB: 2 },
    denoise: { canvas: true, minMemoryGB: 1 },
    tags: { wasm: true, minMemoryGB: 2 },
    portrait: { wasm: true, minMemoryGB: 2 },
  };
  const MODEL_TOOLS = new Set(['ocr', 'speech', 'tags', 'portrait']);

  /** Reasons a tool cannot run here, as plain sentences. Empty when it can. */
  function reasons(tool) {
    const n = NEEDS[tool];
    if (!n) return ['Unknown tool ' + tool];
    const out = [];
    if (n.wasm && !has.wasm) out.push('This browser has no WebAssembly, which the models need.');
    if (n.audio && !has.audio) out.push('This browser cannot decode audio.');
    if (n.canvas && !has.canvas) out.push('This browser has no canvas.');
    if (MODEL_TOOLS.has(tool) && !has.worker) out.push('This browser cannot run background workers.');
    if (MODEL_TOOLS.has(tool) && tool !== 'portrait' && !has.idb) out.push('Models are stored in IndexedDB, which is turned off here.');
    if (MODEL_TOOLS.has(tool) && tool !== 'portrait' && !has.subtle) out.push('Model files are checked with SHA-256, so the page must be opened over https.');
    const mem = memoryGB();
    if (n.minMemoryGB && mem !== undefined && mem < n.minMemoryGB) out.push(`This device reports ${mem} GB of memory; this tool needs about ${n.minMemoryGB} GB.`);
    return out;
  }

  /** { ok, reason }: reason is the first problem, or '' when the tool can run. */
  function check(tool) {
    const r = reasons(tool);
    return { ok: r.length === 0, reason: r[0] || '', reasons: r };
  }

  root.SlopAISupport = { check, reasons, has };
})(typeof window !== 'undefined' ? window : globalThis);
