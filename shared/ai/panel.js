/* Slop AI side panel: an AI chat any Slopographic page can embed with ONE tag:
 *     <script src="(../)shared/ai/panel.js" defer></script>
 * Optional attributes on that tag: data-button="false" (no floating button; open it yourself), data-app="<app id>".
 * It reuses a model already loaded in another tab (Slop AI) over the bridge (shared/ai/bridge.js), so the model
 * downloads and loads once. If none is open, "Load here" loads an already-downloaded model in this page (its own
 * copy in GPU memory). With "Control this app" on, the model can run this app's SlopCmd commands, open apps and
 * save to Slop Drive; anything destructive asks first.
 * API: window.SlopAIPanel = { open(), close(), toggle(), send(text), get messages() }. */
(function () {
  'use strict';
  if (window.SlopAIPanel) return;
  const me = document.currentScript;
  const base = me ? new URL('./', me.src).href : new URL('../shared/ai/', location.href).href;
  const opts = { button: !me || me.dataset.button !== 'false', app: me && me.dataset.app };
  const K = (window.SlopAIKit = window.SlopAIKit || {});
  K.base = K.base || base;
  const css = document.createElement('link'); css.rel = 'stylesheet'; css.href = base + 'panel.css'; document.head.append(css);
  const add = (src) => new Promise((res, rej) => { if (src === 'slopai' && window.SlopAI) return res(); const s = document.createElement('script'); s.src = base + src + '.js'; s.async = false; s.onload = res; s.onerror = () => rej(new Error('load ' + src)); document.head.append(s); });
  const kit = add('slopai').then(() => window.SlopAI.loaded).then(() => K.load(['apptools', 'md', 'catalog']));

  const h = (tag, attrs, ...kids) => { const n = document.createElement(tag); for (const k in attrs || {}) { const v = attrs[k]; if (v == null || v === false) continue; if (k === 'class') n.className = v; else if (k.startsWith('on')) n.addEventListener(k.slice(2), v); else n.setAttribute(k, v === true ? '' : v); } for (const c of kids.flat()) if (c != null && c !== false) n.append(c.nodeType ? c : document.createTextNode(c)); return n; };
  const SPARK = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3c.6 4.6 2.4 6.4 7 7-4.6.6-6.4 2.4-7 7-.6-4.6-2.4-6.4-7-7 4.6-.6 6.4-2.4 7-7z"/></svg>';
  const appId = () => opts.app || (window.SlopHub && SlopHub.self && SlopHub.self.app) || location.pathname.split('/').filter(Boolean)[0] || 'home';
  const appName = () => { const a = (window.SLOP_APPS || []).find((x) => x.id === appId()); return a ? a.name : 'this page'; };

  let root = null, list, input, status, toolsBox, sendBtn, busy = null, local = null;
  const messages = [];

  function build() {
    if (root) return;
    toolsBox = h('input', { type: 'checkbox', checked: !!window.SlopCmd });
    input = h('textarea', { rows: 2, placeholder: 'Ask about ' + appName() + '…', 'aria-label': 'Message' });
    sendBtn = h('button', { type: 'button', class: 'sap-send', 'aria-label': 'Send', onclick: () => (busy ? busy.abort() : send()) }, '↑');
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); if (!busy) send(); } e.stopPropagation(); });
    list = h('div', { class: 'sap-list', role: 'log', 'aria-live': 'polite' });
    status = h('div', { class: 'sap-status' });
    root = h('aside', { class: 'sap', role: 'complementary', 'aria-label': 'Slop AI', hidden: true },
      h('header', null, h('b', null, 'Slop AI'), status, h('button', { type: 'button', class: 'sap-x', 'aria-label': 'Close', onclick: close }, '×')),
      list,
      h('label', { class: 'sap-tools' }, toolsBox, ' Control ' + appName()),
      h('div', { class: 'sap-comp' }, input, sendBtn),
      h('div', { class: 'sap-foot' }, 'Runs on your device. Nothing leaves it.'));
    document.body.append(root);
    render();
  }
  function fab() {
    if (!opts.button || document.querySelector('.sap-fab')) return;
    const b = h('button', { type: 'button', class: 'sap-fab', title: 'Slop AI', 'aria-label': 'Open Slop AI', onclick: toggle });
    b.innerHTML = SPARK; document.body.append(b);
  }

  function engine() { return local && local.loaded ? local : window.SlopAI && SlopAI.engine(); }
  function renderStatus() {
    if (!status) return;
    const m = window.SlopAI && SlopAI.model, fabEl = document.querySelector('.sap-fab');
    if (fabEl) fabEl.classList.toggle('on', !!m);
    status.textContent = m ? (m.name || m.id || 'Model') + (m.kind === 'remote' ? ' · shared' : '') : 'no model';
  }
  function render() {
    renderStatus();
    list.textContent = '';
    if (!messages.length) {
      const ready = !!engine();
      list.append(h('div', { class: 'sap-empty' }, ready ? `Ask anything, or tell me what to do in ${appName()}.` : 'No model is loaded yet. Load one in Slop AI (it stays open in its own tab) and this panel uses it.',
        !ready ? h('div', { class: 'sap-acts' }, h('a', { class: 'sap-btn', href: new URL('../../ai/#models', base).href, target: '_blank', rel: 'noopener' }, 'Open Slop AI'), h('button', { type: 'button', class: 'sap-btn', onclick: loadHere }, 'Load here')) : null));
    }
    for (const m of messages) {
      if (m.role === 'tool') { list.append(h('div', { class: 'sap-tool' + (m.ok ? '' : ' bad') }, '🔧 ' + m.name + ': ' + String(m.content).slice(0, 160))); continue; }
      const d = h('div', { class: 'sap-msg ' + m.role });
      if (m.role === 'assistant' && K.md) d.innerHTML = K.md.render(m.display != null ? m.display : m.content); else d.textContent = m.display != null ? m.display : m.content;
      list.append(d);
    }
    list.scrollTop = list.scrollHeight;
  }

  /** Load the default (already downloaded) model into this page: its own GPU copy, shared with other tabs. */
  async function loadHere() {
    await kit; await K.load(['webllm']);
    let prefs = {}; try { prefs = JSON.parse(localStorage.getItem('slop-ai.prefs')) || {}; } catch (e) { /* none */ }
    const ids = [prefs.defaultModel, prefs.lastModel, ...K.catalog.list.map((m) => m.id)].filter(Boolean);
    let id = null;
    for (const x of ids) { const st = await K.models.status(x).catch(() => null); if (st && st.state === 'ready') { id = x; break; } }
    if (!id) { status.textContent = 'nothing downloaded'; list.prepend(h('div', { class: 'sap-tool bad' }, 'No model is downloaded yet. Open Slop AI to download one first.')); return; }
    local = new K.WebLLMEngine();
    status.textContent = 'loading…';
    try {
      await local.load(K.catalog.byId(id) || id, (p) => { status.textContent = Math.round((p.progress || 0) * 100) + '%'; });
      SlopAI.use(local);
    } catch (e) { local = null; status.textContent = 'failed'; list.prepend(h('div', { class: 'sap-tool bad' }, 'Could not load: ' + e.message)); return; }
    render();
  }

  const confirmFn = (title, msg) => (window.SlopUI && SlopUI.confirm ? SlopUI.confirm(title, msg, 'Allow') : Promise.resolve(window.confirm(title + '\n\n' + msg)));
  async function send(text) {
    await kit;
    text = text != null ? text : input.value.trim();
    if (!text || busy) return;
    const eng = engine();
    if (!eng) { render(); return; }
    input.value = '';
    messages.push({ role: 'user', content: text });
    render();
    const tools = toolsBox.checked ? K.appTools.build({ cmd: window.SlopCmd, appId: appId(), confirm: confirmFn }) : [];
    const sys = `You are Slop AI, a helpful assistant inside ${appName()} on slopographic.com. It runs on the user's own device. Be brief.` + (tools.length ? ' You can control this app with the tools below: call list_commands first to see what is possible.' : '');
    const live = h('div', { class: 'sap-msg assistant live' }); list.append(live);
    busy = new AbortController(); sendBtn.textContent = '■';
    let text2 = '';
    try {
      const res = await K.tools.run(eng, [{ role: 'system', content: sys }, ...messages.filter((m) => !m.error)], {
        tools, env: { confirm: confirmFn }, maxSteps: tools.length ? 5 : 1, temperature: 0.5, max_tokens: 768, signal: busy.signal,
        onDelta: (t) => { text2 += t; live.innerHTML = K.md.render(text2.replace(/<tool_call>[\s\S]*$/, '')); list.scrollTop = list.scrollHeight; },
        onTool: ({ phase }) => { if (phase === 'end') text2 = ''; },
      });
      messages.push(...res.messages);
    } catch (e) { messages.push({ role: 'assistant', content: '', display: '⚠️ ' + e.message, error: true }); }
    busy = null; sendBtn.textContent = '↑';
    render();
  }

  function open() { build(); root.hidden = false; document.body.classList.add('sap-open'); renderStatus(); setTimeout(() => input.focus(), 0); kit.then(render); }
  function close() { if (root) root.hidden = true; document.body.classList.remove('sap-open'); }
  function toggle() { if (root && !root.hidden) close(); else open(); }

  const start = () => { fab(); kit.then(() => { SlopAI.on('change', () => { renderStatus(); if (root && !messages.length) render(); }); renderStatus(); }).catch((e) => console.warn('Slop AI panel:', e.message)); };
  if (document.body) start(); else document.addEventListener('DOMContentLoaded', start);
  window.SlopAIPanel = { open, close, toggle, send: (t) => { open(); return send(t); }, get messages() { return messages; }, ready: kit };
})();
