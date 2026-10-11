/* Slop AI Tools: helpers shared by the tool pages. Classic script; exposes window.SlopAITools.
 *  - worker client: one inference worker (workers/infer.worker.js) per page; call(type, data) resolves with the result
 *  - ensure(modelId): reads the model's files from IndexedDB or vendor/ and hands them to the worker once
 *  - gate(toolId): shows the device or model problem on the page, with Get more, and resolves when the tool can run
 *  - files and output: pick, decode images and audio, download, save to Slop Drive, open Slop Docs */
(function (root) {
  'use strict';
  const doc = root.document, R = root.SlopAIModels, M = root.SlopAIManager, S = root.SlopAISupport;
  const WORKER_URL = new URL('workers/infer.worker.js', doc.currentScript.src).href;
  let worker = null, seq = 0;
  const pending = new Map(), loading = new Map();

  function w() {
    if (worker) return worker;
    worker = new Worker(WORKER_URL);
    worker.onmessage = (e) => {
      const { id, type, data, message } = e.data || {}, p = pending.get(id);
      if (!p) return;
      if (type === 'progress') { if (p.onProgress) p.onProgress(data); return; }
      pending.delete(id);
      if (type === 'done') p.resolve(data); else p.reject(new Error(message || 'The worker failed'));
    };
    worker.onerror = (e) => {
      for (const p of pending.values()) p.reject(new Error('The worker stopped: ' + (e.message || 'unknown error')));
      pending.clear(); worker = null; loading.clear();
    };
    return worker;
  }
  /** Sends one message to the worker. opts: { transfer: [ArrayBuffer...], onProgress(data) }. */
  function call(type, data, opts = {}) {
    const id = ++seq;
    return new Promise((resolve, reject) => {
      pending.set(id, { resolve, reject, onProgress: opts.onProgress });
      w().postMessage({ id, type, data }, opts.transfer || []);
    });
  }
  /** Loads a model's files into the worker once per page. Rejects with a plain reason. */
  function ensure(modelId, onStatus) {
    if (!loading.has(modelId)) loading.set(modelId, (async () => {
      if (onStatus) onStatus('Reading the model from this device…');
      const files = await M.readAll(modelId);
      if (onStatus) onStatus('Starting the model…');
      await call('load', { model: modelId, files }, { transfer: Object.values(files) });
    })().catch((e) => { loading.delete(modelId); throw e; }));
    return loading.get(modelId);
  }

  /**
   * Checks a tool before its page is used. Shows the reason in the #gate element when it cannot run.
   * When a model is missing, the page shows a Get more button; onReady() runs once everything is in place.
   */
  async function gate(toolId, onReady) {
    const box = doc.getElementById('gate');
    const tool = R.TOOLS.find((t) => t.id === toolId);
    const sup = S.check(toolId);
    box.replaceChildren();
    if (!sup.ok) { box.append(panel('Not supported on this device', sup.reason)); return false; }
    for (const id of tool.models) {
      if ((await M.status(id)) !== 'needs-download') continue;
      const m = R.byId(id);
      const btn = doc.createElement('button');
      btn.type = 'button'; btn.className = 'ai-pri'; btn.textContent = 'Get more…';
      btn.addEventListener('click', () => root.SlopAIGetMore.open(id, { onInstalled: () => gate(toolId, onReady) }));
      const p = panel('This tool needs a model', `${m.name} (${R.LICENCES[m.licence]}, ${R.formatSize(R.downloadBytes(m))}). Nothing downloads until you press Get more and confirm.`);
      p.append(btn);
      box.append(p);
      return false;
    }
    if (onReady) onReady();
    return true;
  }
  function panel(title, body) {
    const d = doc.createElement('section');
    d.className = 'ai-panel';
    const h = doc.createElement('h2'); h.textContent = title; h.style.marginTop = '0';
    const p = doc.createElement('p'); p.className = 'ai-meta'; p.textContent = body;
    d.append(h, p);
    return d;
  }

  /** Decodes an image file to an ImageBitmap; { bitmap, w, h }. */
  async function image(file) {
    const bitmap = await root.createImageBitmap(file);
    return { bitmap, w: bitmap.width, h: bitmap.height };
  }
  /** Decodes the audio track of an audio or video file to 16 kHz mono Float32Array. */
  async function audioSamples(file) {
    const buf = await file.arrayBuffer();
    const Ctx = root.AudioContext || root.webkitAudioContext, ctx = new Ctx();
    try {
      const decoded = await ctx.decodeAudioData(buf);
      const frames = Math.ceil(decoded.duration * 16000), off = new root.OfflineAudioContext(1, Math.max(1, frames), 16000);
      const src = off.createBufferSource(); src.buffer = decoded; src.connect(off.destination); src.start(0);
      const rendered = await off.startRendering();
      return rendered.getChannelData(0).slice();
    } finally { ctx.close && ctx.close(); }
  }
  /** Starts a download of a Blob or text under a file name. */
  function download(name, data, type = 'text/plain') {
    const blob = data instanceof Blob ? data : new Blob([data], { type });
    const url = URL.createObjectURL(blob), a = doc.createElement('a');
    a.href = url; a.download = name; doc.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  }
  /** Puts a file in Slop Drive and returns its id, or null when Drive is not available. */
  async function toDrive(name, blob, from, meta) {
    if (!root.SlopHub) return null;
    return root.SlopHub.put(blob, { name, type: blob.type || 'application/octet-stream', from, meta: meta || {} });
  }
  /** Opens Slop Docs on a Drive file (or on nothing, for a new document). */
  function openDocs(driveId) {
    const app = root.SlopHub && root.SlopHub.appById('docs');
    if (app) root.open(root.SlopHub.urlOf(app, driveId ? { drive: driveId } : null), '_blank');
  }
  /** Turns a number of seconds into hh:mm:ss,mmm for SRT. */
  function srtTime(s) {
    const ms = Math.round(s * 1000), h = Math.floor(ms / 3600000), m = Math.floor((ms % 3600000) / 60000), sec = Math.floor((ms % 60000) / 1000), r = ms % 1000;
    return [h, m, sec].map((v) => String(v).padStart(2, '0')).join(':') + ',' + String(r).padStart(3, '0');
  }

  root.SlopAITools = { call, ensure, gate, image, audioSamples, download, toDrive, openDocs, srtTime, panel };
})(typeof window !== 'undefined' ? window : globalThis);
