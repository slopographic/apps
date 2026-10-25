/* SlopAIKit picker: the model choice and the download notice, one component for every page that needs a model
 * (the side panel on every app, and Slop AI's own download consent). Classic script; adds SlopAIKit.picker.
 *   picker.gpu() → Promise<{ ok, reason }>          can this browser run a WebGPU model at all (asked once)
 *   picker.consent(model, { partial, sizeMB }) → Promise<bool>
 *        the shared first-use notice (shared/firstrun/notice.js) with the real download size, the hosts and the
 *        licence; once per model (key 'slop-firstrun:ai-model:<id>'). A model already on this device needs no notice.
 *   picker.render(box, { appName, onReady(engine), engine: () => new Engine }) → draws the choice into box:
 *        no WebGPU → a plain message and what still works; otherwise the models with size, GPU memory, licence and
 *        a "good at app control" mark (strength 'tools'), Download / Use with progress and Cancel.
 *   picker.FIT: the catalog ids that follow tool instructions well enough to control an app, best first.
 *   Order: with an own-key provider in use, its section ("Use your own AI account", with the Model choice) comes first
 *        and the local models follow under "Models on this device"; otherwise the local models come first.
 *   picker.loadCloud() → loads "Use your own AI account" (shared/ai/cloud/), shown under the models in render, and
 *        also when this browser has no WebGPU: a provider with the person's own key works in every browser.
 * Downloads happen only after a click and the notice. Nothing is uploaded. */
(function () {
  'use strict';
  const K = (window.SlopAIKit = window.SlopAIKit || {});
  const FIT = ['Qwen2.5-1.5B-Instruct-q4f16_1-MLC', 'Llama-3.2-3B-Instruct-q4f16_1-MLC', 'Qwen2.5-3B-Instruct-q4f16_1-MLC', 'Qwen2.5-7B-Instruct-q4f16_1-MLC'];
  const MB = 1048576;
  let gpuP = null;
  const h = (tag, attrs, ...kids) => { const n = document.createElement(tag); for (const k in attrs || {}) { const v = attrs[k]; if (v == null || v === false) continue; if (k === 'class') n.className = v; else if (k.startsWith('on')) n.addEventListener(k.slice(2), v); else n.setAttribute(k, v === true ? '' : v); } for (const c of kids.flat()) if (c != null && c !== false) n.append(c.nodeType ? c : document.createTextNode(c)); return n; };
  const size = (mb) => (window.SlopFirstRun ? SlopFirstRun.size(mb * MB) : (mb >= 1024 ? (mb / 1024).toFixed(1) + ' GB' : Math.round(mb) + ' MB'));

  /** Can this browser run a WebGPU model? An adapter request that does not answer in GPU_WAIT ms counts as no. */
  const GPU_WAIT = 5000;
  function gpu() {
    return (gpuP = gpuP || (async () => {
      if (!navigator.gpu) return { ok: false, reason: 'no-api' };
      const late = new Promise((res) => setTimeout(() => res('late'), GPU_WAIT));
      try { const a = await Promise.race([navigator.gpu.requestAdapter(), late]); return a === 'late' ? { ok: false, reason: 'error' } : a ? { ok: true } : { ok: false, reason: 'no-adapter' }; } catch (e) { return { ok: false, reason: 'error' }; }
    })());
  }
  const noGpuText = (r) => (r === 'no-api'
    ? 'This browser cannot run the AI models: they need WebGPU, which it does not have.'
    : 'This browser has WebGPU switched off or no graphics adapter it can use, so the AI models cannot run here.');
  const NO_GPU_HELP = 'Use a recent Chrome or Edge on a computer (version 113 or later), or Safari 26 on a Mac or iPhone. On Linux, Chrome may need chrome://flags/#enable-unsafe-webgpu.';

  /** shared/firstrun/notice.js, loaded on first need. */
  function notice() {
    if (window.SlopFirstRun) return Promise.resolve(window.SlopFirstRun);
    return new Promise((res) => {
      const s = document.createElement('script');
      s.src = new URL('../firstrun/notice.js', K.base || document.baseURI).href;
      s.onload = () => res(window.SlopFirstRun || null); s.onerror = () => res(null);
      document.head.append(s);
    });
  }
  async function consent(m, o = {}) {
    const F = await notice();
    const bytes = Math.round((o.sizeMB || m.sizeMB || 0) * MB);
    const lines = [`${m.name} runs on this device with WebGPU, so what you ask it stays here.`,
      'It is downloaded from huggingface.co, with its GPU code from raw.githubusercontent.com.',
      `Licence: ${m.license ? m.license.name : 'see the model page'}${m.license && m.license.commercial ? '; commercial use: ' + m.license.commercial : ''}.`];
    if (o.partial) lines.push('Part of it is already downloaded; it continues where it stopped.');
    if (!F) return window.confirm(lines.join('\n') + `\n\nDownload about ${size(bytes / MB)}?`);
    return F.once('ai-model:' + m.id, { title: 'Download ' + m.name + '?', lines, downloads: bytes ? [{ name: m.name, bytes }] : [] });
  }

  function prefs() { try { return JSON.parse(localStorage.getItem('slop-ai.prefs')) || {}; } catch (e) { return {}; } }
  async function statusOf(id) {
    if (!K.models) await K.load(['webllm']);
    return K.models.status(id).catch(() => ({ state: 'none', bytes: 0 }));
  }

  const CATALOG = ['main', 'open', 'cloud', 'more', 'local', 'images'].map((g) => 'cloud/catalog/' + g);   // the providers, as data
  const CLOUD = ['cloud/net', ...CATALOG, 'cloud/providers', 'cloud/free', 'cloud/anthropic', 'cloud/openai', 'cloud/compat', 'cloud/gemini', 'cloud/keys', 'cloud/meter', 'cloud/engine', 'cloud/pick', 'cloud/local', 'cloud/local-ui', 'cloud/free-guide', 'cloud/connect'];
  const loadCloud = () => K.load(['cmdtools', ...CLOUD]);
  async function cloud(box, o) {
    box.append(h('p', { class: 'sap-dim sap-pick-wait' }, 'Loading “Use your own AI account”…'));
    try { await loadCloud(); box.textContent = ''; K.cloud.connect.render(box, { onReady: o.onReady, onForget: o.onForget, open: o.cloudOpen, appId: o.appId, tools: o.tools }); }
    catch (e) { box.textContent = ''; box.append(failed('“Use your own AI account” did not load', e)); console.warn('Slop AI: own-key providers', e); }
  }
  /** A line saying what did not load, instead of an empty space. */
  const failed = (what, e) => h('p', { class: 'sap-pick-no sap-kit-error', role: 'alert' }, `${what} (${(e && e.message) || e}). Check the connection, then open this again.`);

  async function render(box, o = {}) {
    box.textContent = '';
    const wrap = h('div', { class: 'sap-pick' }), more = h('div', { class: 'sap-pick-cloud' });
    // a provider in use comes first (its model choice at the top); the models on this device follow under a heading
    let active = '';
    try { active = (JSON.parse(localStorage.getItem('slop-ai.cloud') || 'null') || {}).active || ''; } catch (e) { active = ''; }
    // Without WebGPU (most phones, Firefox) the own account comes first and open: it works in every browser. It loads at
    // once, beside the device check, so the choice is never an empty space while the GPU is asked.
    const noApi = !navigator.gpu;
    if (active || noApi) { box.append(more, wrap); if (active) wrap.append(h('p', { class: 'sap-pick-local-h' }, h('b', null, 'Models on this device'))); o = Object.assign({ cloudOpen: true }, o); }
    else box.append(wrap, more);
    const cloudP = cloud(more, o);
    const wait = h('p', { class: 'sap-dim sap-pick-wait' }, 'Checking what this device can run…');
    wrap.before(wait);
    try { await local(box, wrap, more, o); } catch (e) { wrap.append(failed('The models on this device could not be listed', e)); console.warn('Slop AI: local models', e); }
    wait.remove();
    const g = await K.picker.gpu();
    if (!g.ok) await cloudP.then(() => { const det = more.querySelector('details.sap-cloud'); if (det) det.open = true; });
    return cloudP;
  }
  /** The models on this device (or why there are none), into wrap. */
  async function local(box, wrap, more, o) {
    const g = await K.picker.gpu();
    if (!g.ok) {
      if (more.parentNode === box && box.firstChild !== more) box.prepend(more);   // the account first when nothing runs here
      wrap.append(h('p', { class: 'sap-pick-no', role: 'alert' }, noGpuText(g.reason)), h('p', { class: 'sap-dim' }, NO_GPU_HELP),
        h('p', { class: 'sap-dim' }, `You can still use every menu and tool of ${o.appName || 'this app'} yourself, or connect your own AI account above. A model that `, aiLink(), ' runs in another tab of this browser is used here too.'));
      return;
    }
    await K.load(['catalog', 'webllm']);
    const p = prefs(), list = K.catalog.list.slice().sort((a, b) => rank(a) - rank(b));
    const st = new Map(await Promise.all(list.map(async (m) => [m.id, await statusOf(m.id)])));
    const have = list.find((m) => (st.get(m.id) || {}).state === 'ready' && (m.id === p.defaultModel || m.id === p.lastModel)) || list.find((m) => (st.get(m.id) || {}).state === 'ready');
    wrap.append(h('p', null, h('b', null, active ? 'Or a model on this device.' : 'Pick a model to start.'), ' It downloads once and then works offline, on your graphics card.'));
    const rows = o.rows = h('div', { class: 'sap-pick-list' });
    for (const m of list.filter((x) => FIT.includes(x.id) || x === have || x.id === p.defaultModel)) rows.append(row(m, st.get(m.id) || {}, m === have, o));
    wrap.append(rows, h('p', { class: 'sap-dim' }, 'Smaller models are faster but follow instructions less well. More models and settings: ', aiLink(), '.'));
  }
  const aiLink = () => h('a', { href: new URL('../../ai/#models', K.base || document.baseURI).href, target: '_blank', rel: 'noopener' }, 'Slop AI');
  const rank = (m) => { const i = FIT.indexOf(m.id); return i < 0 ? 99 : i; };

  function row(m, st, best, o) {
    const ready = st.state === 'ready';
    const bar = h('i'), prog = h('div', { class: 'sap-pbar', hidden: true }, bar), msg = h('div', { class: 'sap-dim sap-pick-msg' });
    const go = h('button', { type: 'button', class: 'sap-btn' + (best || (!ready && m.id === K.catalog.DEFAULT) ? ' primary' : ''), 'data-model': m.id }, ready ? 'Use' : st.state === 'partial' ? 'Resume download' : 'Download');
    const cancel = h('button', { type: 'button', class: 'sap-btn', hidden: true }, 'Cancel');
    let ctl = null;
    cancel.addEventListener('click', () => { if (ctl) ctl.abort(); });
    go.addEventListener('click', async () => {
      if (!ready && !(await consent(m, { partial: st.state === 'partial' }))) return;
      const eng = o.engine ? o.engine() : new K.WebLLMEngine();
      ctl = new AbortController();
      go.disabled = true; cancel.hidden = false; prog.hidden = false; msg.textContent = ready ? 'Loading…' : 'Downloading…';
      try {
        await eng.load(m, (x) => { bar.style.width = Math.round((x.progress || 0) * 100) + '%'; msg.textContent = x.text || ''; }, { signal: ctl.signal });
        try { const pr = prefs(); pr.lastModel = m.id; localStorage.setItem('slop-ai.prefs', JSON.stringify(pr)); } catch (e) { /* storage blocked */ }
        if (o.onReady) o.onReady(eng, m);
      } catch (e) {
        msg.textContent = ctl.signal.aborted ? 'Cancelled. Finished parts stay, so it can resume.' : 'Could not load it: ' + friendly(e);
        msg.classList.add('bad');
        if (!ctl.signal.aborted && e && e.shader) gpuFailed(msg, m, e, o);
      } finally { go.disabled = false; cancel.hidden = true; ctl = null; }
    });
    const fit = (m.strengths || []).includes('tools');
    return h('div', { class: 'sap-pick-row' + (best ? ' best' : '') },
      h('div', { class: 'sap-pick-h' }, h('b', null, m.name), fit ? h('span', { class: 'sap-badge' }, 'good at app control') : null, ready ? h('span', { class: 'sap-badge dim' }, 'on this device') : null),
      h('div', { class: 'sap-dim' }, `${ready ? 'Downloaded' : 'Download ' + size(m.sizeMB)} · needs about ${size(m.vramMB)} of GPU memory · ${m.license ? m.license.short || m.license.name : ''}`),
      h('div', { class: 'sap-acts' }, go, cancel), prog, msg);
  }
  /** The GPU could not compile the model (webllm.js tried f16, then f32): the plain message, details and two ways on. */
  async function gpuFailed(msg, m, e, o) {
    await K.load(['sysinfo', 'gpu-help']);
    const sys = await K.sysinfo.collect({ bench: false }).catch(() => null);
    msg.textContent = ''; msg.classList.remove('bad');
    const smaller = K.catalog.list.filter((x) => x.vramMB < m.vramMB && !(e.tried || []).includes(x.id)).sort((a, b) => b.vramMB - a.vramMB)[0];
    K.gpuHelp.render(msg, { model: m, error: e, sys,
      onSmaller: smaller && o.rows ? () => { let b = o.rows.querySelector(`[data-model="${smaller.id}"]`); if (!b) { o.rows.append(row(smaller, {}, false, o)); b = o.rows.querySelector(`[data-model="${smaller.id}"]`); } b.scrollIntoView({ block: 'nearest' }); b.click(); } : null,
      onCloud: () => { const c = document.querySelector('.sap-cloud'); if (c) { c.open = true; c.scrollIntoView({ block: 'start' }); } } });
  }
  function friendly(e) {
    const s = String((e && e.message) || e);
    if (/fetch|network|load failed/i.test(s)) return 'the download failed. Check the connection and press Download again (finished parts are kept).';
    if (/quota|storage|space/i.test(s)) return 'this site has no storage left. Free space in Slop Drive ▸ Storage, then try again.';
    return s;
  }

  K.picker = { gpu, consent, render, FIT, noGpuText, NO_GPU_HELP, loadCloud, CLOUD };
})();
