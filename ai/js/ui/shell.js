/* Slop AI — ui/shell: tabs, theme, the model chip and the More menu. */
'use strict';
(function (AI) {
  const E = AI.E;
  AI.TABS = [['chat', 'Chat', 'chat'], ['build', 'Build', 'build'], ['models', 'Models', 'models'], ['sys', 'Can my PC run it?', 'sys']];
  AI.THEMES = [['pro', 'Pro'], ['light', 'Light'], ['classic', 'Classic 98']];
  const rendered = new Set();

  AI.setTab = function (tab) {
    if (!AI.TABS.some((t) => t[0] === tab)) tab = 'chat';
    AI.tab = tab; AI.prefs.tab = tab; AI.savePrefs();
    for (const b of AI.$('tabs').children) b.setAttribute('aria-selected', String(b.dataset.tab === tab));
    for (const v of document.querySelectorAll('.view')) v.classList.toggle('on', v.dataset.view === tab);
    const first = !rendered.has(tab); rendered.add(tab);
    AI.emit('tab', { tab, first });
  };

  AI.setTheme = function (t) {
    document.documentElement.setAttribute('data-theme', t);
    AI.prefs.theme = t; AI.savePrefs();
    AI.emit('theme', t);
  };

  function renderChip() {
    const chip = AI.$('modelChip');
    chip.className = 'chip' + (E.ready() ? ' ready' : E.state === 'loading' ? ' loading' : '');
    chip.textContent = '';
    chip.append(AI.el('i', { class: 'dot' }));
    if (E.state === 'loading') {
      const m = E.modelFor(E.loadingId);
      chip.append(AI.el('span', null, (m ? m.name : 'Model') + ' ' + Math.round(E.progress * 100) + '%'), AI.el('span', { class: 'bar' }, AI.el('i', { style: `width:${Math.round(E.progress * 100)}%` })));
    } else chip.append(AI.el('span', null, E.label() || (E.state === 'paused' ? 'Download paused' : 'No model loaded')));
    chip.title = E.state === 'loading' ? E.text : E.ready() ? 'Model loaded on this device' : 'Pick a model';
  }

  /** Models already on this device (downloaded or loaded from a folder), for the switcher. */
  async function readyModels() {
    const out = [];
    for (const m of AI.allModels()) { const st = await E.status(m.id).catch(() => null); if (st && st.state === 'ready') out.push(m); }
    return out;
  }
  async function chipMenu() {
    const r = AI.$('modelChip').getBoundingClientRect(), items = [];
    if (E.state === 'loading') items.push({ label: 'Pause download', act: () => E.pause() }, { label: 'Cancel download', act: () => E.cancel() });
    if (E.state === 'paused' && E.loadingId) items.push({ label: 'Resume download', act: () => E.load(E.loadingId, { skipConsent: true }) }, { label: 'Cancel download', act: () => E.cancel() });
    const cur = E.model && E.engine && E.engine.loaded ? E.model.id : null;
    const others = (await readyModels()).filter((m) => m.id !== cur);
    if (others.length) items.push({ label: cur ? 'Switch model' : 'Load a downloaded model', sub: others.map((m) => ({ label: m.name, act: () => E.load(m.id, { skipConsent: true }) })) });
    if (E.engine && E.engine.loaded) items.push({ label: 'Unload model (free GPU memory)', act: () => E.unload() });
    items.push({ label: 'Choose a model…', act: () => AI.setTab('models') }, { label: 'Can my PC run it?', act: () => AI.setTab('sys') });
    window.SlopUI.menu(items, r.left, r.bottom + 4);
  }

  AI.moreMenu = function () {
    const r = AI.$('btnMore').getBoundingClientRect();
    window.SlopUI.menu([
      { label: 'Search commands…', key: window.SlopCmd && SlopCmd.keyFor ? SlopCmd.keyFor('ai.palette') : 'Ctrl+K', act: () => AI.openPalette(), disabled: !window.SlopCmd },
      { label: 'Keyboard shortcuts…', act: () => window.SlopCmd && SlopCmd.openKeymap ? SlopCmd.openKeymap() : AI.toast('Shortcuts are not available'), disabled: !window.SlopCmd },
      '-',
      { label: 'New chat', act: () => AI.newChat() },
      { label: 'Import a conversation (.json)…', act: () => AI.importConv() },
      { label: 'Open a chat from Slop Drive…', act: () => AI.openChatFromDrive(), disabled: !window.SlopHub },
      { label: 'Save this chat to Slop Drive', act: () => AI.saveChatToDrive(), disabled: !window.SlopHub || !(AI.chat && AI.chat.conv && AI.chat.conv.messages.length) },
      { label: 'Export this conversation', sub: AI.exportItems ? AI.exportItems() : [], disabled: !AI.conv },
      '-',
      { label: 'Theme', sub: AI.THEMES.map(([t, l]) => ({ label: l, check: document.documentElement.getAttribute('data-theme') === t, act: () => AI.setTheme(t) })) },
      { label: E.isFake() ? 'Use the real engine (WebLLM)' : 'Use the demo engine (canned replies, no download)', act: () => AI.switchEngine(E.isFake() ? 'webllm' : 'fake') },
      { label: 'About Slop AI', act: () => AI.about() },
    ], r.right - 240, r.bottom + 4);
  };

  AI.switchEngine = async function (kind) {
    await E.unload();
    AI.prefs.engine = kind === 'fake' ? 'fake' : undefined; AI.savePrefs();
    const u = new URL(location.href); u.searchParams.delete('engine'); history.replaceState(null, '', u.pathname + u.search + u.hash);
    AI.toast(kind === 'fake' ? 'Demo engine: canned replies, nothing is downloaded' : 'Real engine: models run on your GPU');
    AI.emit('engine', E);
  };

  AI.about = () => window.SlopUI.alert('About Slop AI', AI.el('div', { class: 'about' },
    AI.el('p', null, 'Slop AI runs open language models entirely on your device with WebGPU, using WebLLM (Apache-2.0) by the MLC team.'),
    AI.el('p', null, 'Models download once from huggingface.co after you click Download, then work offline. Your chats are stored in this browser (IndexedDB) and never leave your device.'),
    AI.el('p', { class: 'dim' }, 'Each model has its own licence, shown on its card.')));

  AI.initShell = function () {
    const tabs = AI.$('tabs');
    for (const [id, label, icon] of AI.TABS) {
      const b = AI.el('button', { type: 'button', class: 'tab', role: 'tab', 'data-tab': id, id: 'tab-' + id, onclick: () => AI.setTab(id) }, AI.icon(icon), AI.el('span', null, label));
      tabs.append(b);
    }
    AI.$('btnCmd').append(AI.icon('cmd')); AI.$('btnMore').append(AI.icon('more'));
    AI.$('btnMore').onclick = AI.moreMenu;
    AI.$('btnCmd').onclick = () => AI.openPalette();
    AI.$('modelChip').onclick = chipMenu;
    AI.on('engine', renderChip);
    renderChip();
  };
  AI.openPalette = (q) => (window.SlopCmd && SlopCmd.open ? SlopCmd.open(q) : null);
})(window.AI);
