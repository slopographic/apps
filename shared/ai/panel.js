/* Slop AI side panel: an AI chat any Slopographic page can embed with ONE tag:
 *     <script src="(../)shared/ai/panel.js" defer></script>
 * The shell's header AI button (shell/header.js) loads it on the first click, so no page carries it at first paint.
 * Optional attributes on the tag: data-button="false" (no floating button; open it yourself), data-app="<app id>".
 * Wide screens: the panel sits beside the app (the page narrows by its width above 900 px). Phones (≤ 640 px): a
 * bottom sheet (shared/ui/sheet.js, SlopSheet). It reuses a model already loaded in another tab (Slop AI) over the
 * bridge, or one downloaded before ("Use"); with none, it shows the model choice (picker.js, shared with Slop AI).
 * With "Control <app>" on, the model runs the app's SlopCmd commands with their arguments (cmdtools.js); each one is a
 * step in the chat ("Gaussian blur, radius 8 ✓"), Stop ends the run between steps, destructive ones ask first, and
 * "Undo all AI changes" rolls the app back to before the last request (SlopCmd.checkpoint). The run is panel-run.js.
 * API: window.SlopAIPanel = { open(), close(), toggle(), send(text), use(engine), get messages(), ready, isOpen }. */
(function () {
  'use strict';
  if (window.SlopAIPanel) return;
  const me = document.currentScript;
  const base = me ? new URL('./', me.src).href : new URL('../shared/ai/', location.href).href;
  const opts = { button: !me || me.dataset.button !== 'false', app: me && me.dataset.app };
  const K = (window.SlopAIKit = window.SlopAIKit || {});
  K.base = K.base || base;
  const css = document.createElement('link'); css.rel = 'stylesheet'; css.href = base + 'panel.css'; document.head.append(css);
  const add = (src, test) => new Promise((res, rej) => { if (test && test()) return res(); const s = document.createElement('script'); s.src = new URL(src + '.js', base).href; s.async = false; s.onload = res; s.onerror = () => rej(new Error('load ' + src)); document.head.append(s); });
  const kit = Promise.all([add('slopai', () => window.SlopAI), add('../commands/args', () => window.SlopCmdArgs), add('../ui/sheet', () => window.SlopSheet)])
    .then(() => window.SlopAI.loaded).then(() => K.load(['apptools', 'cmdtools', 'md', 'catalog', 'picker', 'panel-run']));

  const h = (tag, attrs, ...kids) => { const n = document.createElement(tag); for (const k in attrs || {}) { const v = attrs[k]; if (v == null || v === false) continue; if (k === 'class') n.className = v; else if (k.startsWith('on')) n.addEventListener(k.slice(2), v); else n.setAttribute(k, v === true ? '' : v); } for (const c of kids.flat()) if (c != null && c !== false) n.append(c.nodeType ? c : document.createTextNode(c)); return n; };
  const SPARK = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3c.6 4.6 2.4 6.4 7 7-4.6.6-6.4 2.4-7 7-.6-4.6-2.4-6.4-7-7 4.6-.6 6.4-2.4 7-7z"/></svg>';
  const appId = () => opts.app || (window.SlopHub && SlopHub.self && SlopHub.self.app) || location.pathname.split('/').filter(Boolean)[0] || 'home';
  const appName = () => { const a = (window.SLOP_APPS || []).find((x) => x.id === appId()); return a ? a.name : 'this page'; };
  const WIDE = '(min-width: 901px)';

  const P = { messages: [], local: null, busy: null, h, appId, appName, K };
  let host = null, root = null, sheet = null;

  function build() {
    if (root) return;
    P.toolsBox = h('input', { type: 'checkbox', checked: !!window.SlopCmd });
    P.input = h('textarea', { rows: 2, placeholder: 'Ask about ' + appName() + ', or say what to do…', 'aria-label': 'Message' });
    P.sendBtn = h('button', { type: 'button', class: 'sap-send', 'aria-label': 'Send', onclick: () => (P.busy ? P.stop() : P.send()) }, '↑');
    P.input.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); if (!P.busy) P.send(); } if (e.key !== 'Escape') e.stopPropagation(); });
    P.list = h('div', { class: 'sap-list', role: 'log', 'aria-live': 'polite' });
    P.status = h('div', { class: 'sap-status' });
    P.undoBtn = h('button', { type: 'button', class: 'sap-btn sap-undo', hidden: true, onclick: () => P.undoAll() }, '↶ Undo all AI changes');
    root = h('aside', { class: 'sap ssh-panel', role: 'complementary', 'aria-label': 'Slop AI', hidden: true },
      h('header', null, h('span', { class: 'sap-logo', html: null }), h('b', null, 'Slop AI'), P.status, h('button', { type: 'button', class: 'sap-x', 'aria-label': 'Close Slop AI', onclick: close }, '×')),
      P.list,
      h('div', { class: 'sap-bar' }, h('label', { class: 'sap-tools' }, P.toolsBox, ' Control ' + appName()), P.undoBtn),
      h('div', { class: 'sap-comp' }, P.input, P.sendBtn),
      h('div', { class: 'sap-foot' }, 'Runs on your device. Nothing leaves it.'));
    root.querySelector('.sap-logo').innerHTML = SPARK;
    host = h('div', { class: 'sap-host' }, root);
    document.body.append(host);
    P.render();
  }
  function fab() {
    if (!opts.button || document.querySelector('.sap-fab')) return;
    const b = h('button', { type: 'button', class: 'sap-fab', title: 'Slop AI', 'aria-label': 'Open Slop AI', onclick: toggle });
    b.innerHTML = SPARK; document.body.append(b);
  }

  P.engine = () => (P.local && P.local.loaded ? P.local : window.SlopAI && SlopAI.engine());
  P.renderStatus = function () {
    if (!P.status) return;
    const m = window.SlopAI && SlopAI.model, fabEl = document.querySelector('.sap-fab');
    if (fabEl) fabEl.classList.toggle('on', !!m);
    document.querySelectorAll('.sh-ai').forEach((b) => b.classList.toggle('on', !!m));
    P.status.textContent = m ? (m.name || m.id || 'Model') + (m.kind === 'remote' ? ' · shared' : m.kind === 'fake' ? ' · demo' : '') : 'no model yet';
  };
  P.render = function () {
    if (!P.list) return;
    P.renderStatus();
    const picking = !P.messages.length && !P.engine() && K.picker;
    if (picking && P.pickBox && P.pickBox.isConnected) return;   // keep the model choice (and a download in progress) as it is
    P.list.textContent = ''; P.pickBox = null;
    if (!P.messages.length) {
      if (P.engine()) P.list.append(h('div', { class: 'sap-empty' }, `Ask anything, or tell me what to do in ${appName()}. For example: “blur the background”.`));
      else if (picking) {
        const box = P.pickBox = h('div', { class: 'sap-empty' });
        P.list.append(box);
        K.picker.render(box, { appName: appName(), onReady: (eng) => P.use(eng) });
      } else P.list.append(h('div', { class: 'sap-empty' }, 'Loading…'));
    }
    for (const m of P.messages) P.list.append(P.view ? P.view(m) : h('div', { class: 'sap-msg ' + m.role }, m.display != null ? m.display : m.content));
    P.list.scrollTop = P.list.scrollHeight;
  };
  /** A model this page loaded itself (the picker, a test's fake engine): used here and shared with other tabs. */
  P.use = function (eng) { P.local = eng; if (window.SlopAI) SlopAI.use(eng); P.render(); };

  const beside = () => window.matchMedia && matchMedia(WIDE).matches;
  function layout() {
    const on = !!root && !root.hidden;
    document.documentElement.classList.toggle('sap-beside', on && beside());
    document.body.classList.toggle('sap-open', on);
    window.dispatchEvent(new Event('resize'));   // the app re-fits its canvas to the narrower page
  }
  function attachSheet() {
    if (sheet || !window.SlopSheet) return;
    sheet = SlopSheet.attach({ root: host, panel: root, side: 'bottom', phone: '(max-width: 640px)', label: 'Slop AI',
      onChange: (open, why) => { if (!open && why !== 'api' && why !== 'wide') { root.hidden = true; layout(); } } });
  }
  function open() {
    build(); attachSheet();
    root.hidden = false;
    if (sheet && sheet.isPhone()) sheet.open();
    layout(); P.renderStatus();
    setTimeout(() => P.input.focus({ preventScroll: true }), 0);
    kit.then(P.render);
    return kit;
  }
  function close() { if (sheet && sheet.isOpen()) sheet.close(); if (root) root.hidden = true; layout(); }
  function toggle() { if (root && !root.hidden) close(); else open(); }
  if (window.matchMedia) matchMedia(WIDE).addEventListener('change', layout);

  const start = () => { fab(); kit.then(() => { SlopAI.on('change', () => { P.renderStatus(); if (root && !P.messages.length) P.render(); }); P.renderStatus(); }).catch((e) => console.warn('Slop AI panel:', e.message)); };
  if (document.body) start(); else document.addEventListener('DOMContentLoaded', start);
  window.SlopAIPanel = { open, close, toggle, send: (t) => { open(); return kit.then(() => P.send(t)); }, use: (e) => kit.then(() => P.use(e)),
    get messages() { return P.messages; }, get isOpen() { return !!root && !root.hidden; }, ready: kit, _p: P };
  K.panel = P;
})();
