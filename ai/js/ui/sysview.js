/* Slop AI — ui/sysview: "Can my PC run it?" — the system report, the per-model verdict table and WebGPU help. */
'use strict';
(function (AI) {
  const K = AI.K, el = AI.el;
  AI.sys = null;
  AI.VERDICT = { good: ['✅', 'Runs well'], slow: ['⚠️', 'Slow'], no: ['❌', 'Won’t fit'] };
  AI.verdictText = (v) => (v.level === 'good' ? `✅ runs well ~${v.tps} tok/s` : v.level === 'slow' ? `⚠️ slow ~${v.tps} tok/s` : '❌ won’t fit');

  /** Run the check. bench defaults to true (about a second of GPU work); tests pass AI.sysOptions. */
  AI.runCheck = async function ({ bench = true } = {}) {
    const st = AI.$('sysStep');
    const opts = Object.assign({ bench, onStep: (t) => { if (st) st.textContent = t; } }, AI.sysOptions || {});
    AI.sysBusy = true; render();
    try { AI.sys = AI.sysMock ? JSON.parse(JSON.stringify(AI.sysMock)) : await K.sysinfo.collect(opts); }
    catch (e) { AI.sys = { gpu: { ok: false, reason: 'error', error: String(e.message || e) }, browser: {}, storage: {}, bench: null }; }
    AI.sysBusy = false;
    AI.emit('sys', AI.sys); render();
    return AI.sys;
  };
  AI.recommended = (purpose) => (AI.sys ? K.sysinfo.recommend(AI.sys, K.catalog.list, purpose) : null);

  const row = (k, v, cls) => el('div', { class: 'kv' + (cls ? ' ' + cls : '') }, el('span', null, k), el('b', null, v == null || v === '' ? '—' : v));
  const gb = (b) => (b ? (b / 1073741824).toFixed(b >= 1073741824 * 10 ? 0 : 1) + ' GB' : '—');
  const mb = (b) => (b ? Math.round(b / 1048576) + ' MB' : '—');

  function specCards(s) {
    const g = s.gpu || {}, b = s.browser || {}, st = s.storage || {}, be = s.bench;
    const gpuName = g.ok ? [g.vendor, g.architecture].filter(Boolean).join(' · ') || 'Unnamed GPU' : 'No WebGPU';
    const cards = [
      el('div', { class: 'card spec' + (g.ok ? '' : ' bad') }, el('h3', null, 'GPU'), row('Adapter', gpuName), row('Description', g.description || (g.ok ? 'hidden by the browser' : '')),
        row('WebGPU', g.ok ? (g.isFallback ? 'yes, software only' : 'yes') : 'not available'), row('shader-f16', g.ok ? (g.f16 ? 'yes' : 'no (uses f32 builds)') : '—')),
      el('div', { class: 'card spec' }, el('h3', null, 'GPU limits'), row('maxBufferSize', g.ok ? mb(g.limits.maxBufferSize) : '—'), row('maxStorageBufferBindingSize', g.ok ? mb(g.limits.maxStorageBufferBindingSize) : '—'),
        row('Workgroup storage', g.ok ? Math.round(g.limits.maxComputeWorkgroupStorageSize / 1024) + ' KB' : '—'), row('Model memory budget', g.ok ? AI.fmtMB(K.sysinfo.budgetMB(s)) + ' (estimate)' : '—')),
      el('div', { class: 'card spec' }, el('h3', null, 'Machine'), row('RAM', s.ramGB ? (s.ramGB >= 8 ? '8 GB or more' : s.ramGB + ' GB') : 'not reported'), row('CPU threads', s.cores),
        row('Browser', [b.name, b.version].filter(Boolean).join(' ')), row('System', [b.os, b.osVersion, b.arch].filter(Boolean).join(' · '))),
      el('div', { class: 'card spec' }, el('h3', null, 'Storage'), row('Free for this site', st.quota ? gb(st.quota - (st.usage || 0)) : '—'), row('Used', st.usage != null ? AI.fmtBytes(st.usage) : '—'),
        row('Kept when space is low', st.persisted == null ? '—' : st.persisted ? 'yes' : 'no'),
        st.persisted === false ? el('button', { type: 'button', class: 'btn sm', onclick: async () => { const ok = await navigator.storage.persist().catch(() => false); AI.toast(ok ? 'The browser will keep your models' : 'The browser said no (it decides by how often you visit)'); AI.runCheck({ bench: false }); } }, 'Ask to keep it') : null),
      el('div', { class: 'card spec' }, el('h3', null, 'Benchmark'), row('Matrix multiply', be && be.gflops ? be.gflops + ' GFLOPS' : be && be.error ? 'failed' : '—'), row('Memory bandwidth', be && be.bandwidthGBs ? be.bandwidthGBs + ' GB/s' : '—'),
        el('button', { type: 'button', class: 'btn sm', id: 'btnBench', disabled: !g.ok || AI.sysBusy, onclick: () => AI.runCheck({ bench: true }) }, be ? 'Run again' : 'Run the benchmark (1 s)')),
    ];
    return el('div', { class: 'spec-grid' }, cards);
  }

  function helpCard(s) {
    const tips = K.sysinfo.help(s);
    if (!tips.length) return null;
    return el('div', { class: 'card help' }, el('h2', null, s.gpu.ok ? 'Only a software GPU' : 'WebGPU is missing'),
      el('p', { class: 'lead' }, 'Local models need WebGPU, the browser’s modern graphics API. Here is how to get it:'),
      el('ul', null, tips.map((t) => el('li', null, t))),
      el('p', { class: 'dim' }, 'You can still look around with the demo engine (canned replies, nothing downloads).'),
      el('button', { type: 'button', class: 'btn', onclick: () => AI.switchEngine('fake').then(() => AI.setTab('models')) }, 'Try the demo engine'));
  }

  function verdictTable(s) {
    const rec = AI.recommended('chat'), recCode = AI.recommended('code');
    const t = el('table', { class: 'verdicts' }, el('thead', null, el('tr', null, ['Model', 'Download', 'GPU memory', 'Verdict', ''].map((h) => el('th', null, h)))));
    const tb = el('tbody');
    for (const m of K.catalog.list) {
      const v = K.sysinfo.verdict(s, m);
      tb.append(el('tr', { class: 'v-' + v.level, 'data-id': m.id },
        el('td', null, el('b', null, m.name), m.id === rec ? el('span', { class: 'badge rec' }, 'Recommended') : m.id === recCode ? el('span', { class: 'badge rec' }, 'Best for code') : null, el('div', { class: 'faint' }, m.license.short)),
        el('td', null, '~' + AI.fmtMB(m.sizeMB)), el('td', null, AI.fmtMB(v.vram || m.vramMB)),
        el('td', null, el('span', { class: 'verdict ' + v.level }, AI.verdictText(v)), v.reason ? el('div', { class: 'faint' }, v.reason) : null),
        el('td', null, v.level !== 'no' ? el('button', { type: 'button', class: 'btn sm', onclick: () => { AI.focusModel = m.id; AI.setTab('models'); } }, 'Get') : null)));
    }
    t.append(tb);
    return el('div', { class: 'card table-card' }, el('h2', null, 'What this device can run'),
      el('p', { class: 'faint' }, 'Speeds are estimates from the memory bandwidth benchmark; real numbers show in every chat reply.'), el('div', { class: 'table-wrap' }, t));
  }

  function render() {
    const v = AI.$('view-sys');
    if (!v) return;
    v.textContent = '';
    const s = AI.sys;
    const head = el('div', { class: 'page-head' },
      el('div', null, el('h1', null, 'Can my PC run it?'), el('p', { class: 'lead' }, 'Slop AI runs language models on your own GPU, in this browser. Here is what this device has and which models it can run.')),
      el('div', { class: 'head-acts' },
        el('button', { type: 'button', class: 'btn', disabled: AI.sysBusy, onclick: () => AI.runCheck({ bench: !!(s && s.bench) }) }, AI.icon('redo'), 'Check again'),
        el('button', { type: 'button', class: 'btn primary', id: 'btnSpecCard', disabled: !s || AI.sysBusy, onclick: () => AI.specCardDialog(AI.sys) }, AI.icon('share'), 'Spec card')));
    const inner = el('div', { class: 'page-in' }, head);
    if (AI.sysBusy || !s) inner.append(el('div', { class: 'card busy' }, el('span', { class: 'spinner' }), el('span', { id: 'sysStep' }, 'Checking…')));
    if (s) inner.append(specCards(s), helpCard(s), verdictTable(s));
    v.append(inner);
  }
  AI.renderSys = render;
  AI.on('tab', ({ tab }) => {
    if (tab !== 'sys') return;
    if (!AI.sysBusy && (!AI.sys || (!AI.sys.bench && !AI.benchTried))) { AI.benchTried = true; AI.runCheck({ bench: true }); } else render();
  });
})(window.AI);
