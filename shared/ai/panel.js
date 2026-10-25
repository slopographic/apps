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
 * Own AI account (shared/ai/cloud/): a provider connected with the person's own key is just another engine; the
 * header names it ("Claude · Claude Opus 5.5"), the foot says where requests go, and the provider chosen last comes
 * back on the next page when its key is still in this browser. It is never shared with other tabs over the bridge.
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
  const kit = Promise.all([add('slopai', () => window.SlopAI), add('../commands/args', () => window.SlopCmdArgs), add('../ui/sheet', () => window.SlopSheet), add('../ui/resize-panel', () => window.SlopResizePanel)])
    .then(() => window.SlopAI.loaded).then(() => K.load(['permissions', 'permissions-ui', 'app-skills', 'apptools', 'cmdtools', 'filetools', 'optools', 'handoff', 'md', 'catalog', 'picker', 'panel-run', 'model-menu', '../ui/menubutton', 'imagegen/index'])).then(() => K.imageGenReady && K.imageGenReady.catch(() => null))
    .then(() => takeHandoff()).then(() => restoreCloud()).then(() => { if (P.pending && P.engine()) runPending(); });
  /** A request handed over from another app (handoff.js): its conversation, a line saying so, and its task, sent as soon
   * as a model is there. */
  function takeHandoff() {
    const ho = K.handoff && K.handoff.take(appId());
    if (!ho) return;
    P.messages.push(...(ho.messages || []), { role: 'assistant', content: '', display: ho.line || `Continued from ${ho.fromName || 'another app'}.`, note: true, handoff: true });
    P.pending = ho.task; P.chain = ho.chain || null;
    if (!root || root.hidden) open();
  }
  function runPending() { const t = P.pending; P.pending = null; if (t) setTimeout(() => P.send(t), 0); }
  /** The provider chosen last, when its key is still here (keys.js keeps no key in localStorage, only which one). */
  function restoreCloud() {
    let s = null; try { s = JSON.parse(localStorage.getItem('slop-ai.cloud') || 'null'); } catch (e) { s = null; }
    if (!s || !s.active || P.local) return null;
    return K.picker.loadCloud().then(() => K.cloud.connect.restore(appId())).then((eng) => { if (eng && !P.local) P.use(eng); }).catch((e) => console.warn('Slop AI: own key', e));
  }

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
    P.status = h('button', { type: 'button', class: 'sap-status', title: 'Change the model' });   // the quick model menu (model-menu.js)
    P.undoBtn = h('button', { type: 'button', class: 'sap-btn sap-undo', hidden: true, onclick: () => P.undoAll() }, '↶ Undo all AI changes');
    root = h('aside', { class: 'sap ssh-panel', role: 'complementary', 'aria-label': 'Slop AI', hidden: true },
      h('header', null, h('span', { class: 'sap-logo', html: null }), h('b', null, 'Slop AI'), P.status,
        h('button', { type: 'button', class: 'sap-gear', title: 'AI permissions', 'aria-label': 'AI permissions', onclick: () => P.settings() }, '⚙'),
        h('button', { type: 'button', class: 'sap-x', 'aria-label': 'Close Slop AI', onclick: close }, '×')),
      P.list,
      h('div', { class: 'sap-bar' }, h('label', { class: 'sap-tools' }, P.toolsBox, ' Control ' + appName()), P.undoBtn),
      h('div', { class: 'sap-comp' }, P.input, P.sendBtn),
      P.foot = h('div', { class: 'sap-foot' }, 'Runs on your device. Nothing leaves it.'));
    root.querySelector('.sap-logo').innerHTML = SPARK;
    host = h('div', { class: 'sap-host' }, root);
    document.body.append(host);
    P.render();
    kit.then(() => { if (K.modelMenu) K.modelMenu.attach(P); else P.status.addEventListener('click', () => P.choose()); });
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
    const c = P.local && P.local.kind === 'cloud' && P.local.loaded ? P.local.info() : null;
    P.status.textContent = c ? `${c.short} · ${c.name}` : m ? (m.name || m.id || 'Model') + (m.kind === 'remote' ? ' · shared' : m.kind === 'fake' ? ' · demo' : '') : 'no model yet';
    P.status.classList.toggle('cloud', !!c);
    if (P.foot) P.foot.textContent = c ? (P.local.provider.local ? `Sent to ${c.who}. Nothing leaves this computer.` : `Sent to ${c.who} with your key. Files only when you allow each one.`) : 'Runs on your device. Nothing leaves it.';
  };
  /** Forget key: the engine that used it stops here too. */
  P.forgot = (p) => { if (P.local && P.local.kind === 'cloud' && P.local.provider.id === p.id) { P.local = null; P.renderStatus(); } };
  /** The model choice again (the header's model name), over the chat; Back returns to it. */
  P.choose = function () { P.choosing = !P.choosing; P.setting = false; if (P.pickBox) P.pickBox.remove(); P.pickBox = null; P.render(); };
  /** AI permissions (permissions-ui.js): the mode and the remembered "always allow" rules, over the chat. */
  P.settings = function () { P.setting = !P.setting; P.choosing = false; P.pickBox = null; P.render(); };
  P.render = function () {
    if (!P.list) return;
    P.renderStatus();
    const picking = ((!P.messages.length && !P.engine()) || P.choosing) && K.picker;
    if (picking && P.pickBox && P.pickBox.isConnected) return;   // keep the model choice (and a download in progress) as it is
    P.list.textContent = ''; P.pickBox = null;
    if (P.undoBtn) P.undoBtn.hidden = !P.rollback;   // the button follows what can still be undone
    if (P.setting && window.SlopAIPermissions && SlopAIPermissions.renderSettings) {
      const box = h('div', { class: 'sap-empty sap-settings' });
      P.list.append(h('button', { type: 'button', class: 'sap-btn sap-back', onclick: () => P.settings() }, '← Back to the chat'), box);
      SlopAIPermissions.renderSettings(box, { app: appId(), appName: appName() });
      if (K.handoff) K.handoff.renderSetting(box);
      return;
    }
    if (P.choosing && K.picker) {
      const box = P.pickBox = h('div', { class: 'sap-empty' });
      P.list.append(h('button', { type: 'button', class: 'sap-btn sap-back', onclick: () => P.choose() }, '← Back to the chat'), box);
      K.picker.render(box, { appName: appName(), appId: appId(), cloudOpen: true, onReady: (eng) => { P.choosing = false; P.use(eng); }, onForget: P.forgot });
      return;
    }
    if (!P.messages.length) {
      if (P.engine()) P.list.append(h('div', { class: 'sap-empty' }, `Ask anything, or tell me what to do in ${appName()}. For example: “blur the background”.`));
      else if (picking) {
        const box = P.pickBox = h('div', { class: 'sap-empty' });
        P.list.append(box);
        K.picker.render(box, { appName: appName(), appId: appId(), onReady: (eng) => P.use(eng), onForget: P.forgot });
      } else P.list.append(h('div', { class: 'sap-empty' }, 'Loading…'));
    }
    if (P.viewAll) P.list.append(...P.viewAll(P.messages));
    else for (const m of P.messages) P.list.append(h('div', { class: 'sap-msg ' + m.role }, m.display != null ? m.display : m.content));
    P.list.scrollTop = P.list.scrollHeight;
  };
  /** A model this page loaded itself (the picker, a test's fake engine): used here and shared with other tabs. */
  P.use = function (eng) {
    P.local = eng;
    if (window.SlopAI && eng && eng.kind !== 'cloud') SlopAI.use(eng);   // a key-based engine stays in this page
    P.render();
    if (P.pending && eng) runPending();
  };

  const beside = () => window.matchMedia && matchMedia(WIDE).matches;
  function layout() {
    const on = !!root && !root.hidden;
    document.documentElement.classList.toggle('sap-beside', on && beside());
    document.body.classList.toggle('sap-open', on);
    window.dispatchEvent(new Event('resize'));   // the app re-fits its canvas to the narrower page
  }
  let sizer = null;
  function attachSheet() {
    // its width: dragged on its edge, kept per app (shared/ui/resize-panel.js, the one implementation for every side panel)
    if (!sizer && window.SlopResizePanel) sizer = SlopResizePanel.attach(root, { app: opts.app, id: 'ai', edge: 'start', width: 380, min: 300, max: 720, phone: '(max-width: 900px)', label: 'Slop AI',
      apply: (px) => { if (px != null) document.documentElement.style.setProperty('--sap-w', px + 'px'); else document.documentElement.style.removeProperty('--sap-w'); if (root && !root.hidden) window.dispatchEvent(new Event('resize')); } });
    if (sheet || !window.SlopSheet) return;
    sheet = SlopSheet.attach({ root: host, panel: root, side: 'bottom', phone: '(max-width: 640px)', label: 'Slop AI',
      onChange: (open, why) => { if (!open && why !== 'api' && why !== 'wide') { root.hidden = true; layout(); } } });
  }
  function open() {
    build(); attachSheet();
    if (!sizer) kit.then(attachSheet);   // the resize module arrives with the kit
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
