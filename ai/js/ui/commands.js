/* Slop AI — ui/commands: every action as a command for the shared palette (window.SlopCmd). Without SlopCmd a
 * small private key map still handles the essentials. */
'use strict';
(function (AI) {
  const E = AI.E;
  AI.commands = function () {
    const C = (id, title, group, keys, run, extra = {}) => Object.assign({ id: 'ai.' + id, title, group, keys, run }, extra);
    return [
      C('newChat', 'New chat', 'Chat', ['Shift+Mod+O'], () => AI.newChat(), { keywords: ['conversation', 'clear'] }),
      C('stop', 'Stop generating', 'Chat', ['Escape'], () => { AI.chat.stop(); AI.builder.stop(); }, { when: () => AI.chat.busy || AI.builder.busy }),
      C('regenerate', 'Regenerate the last reply', 'Chat', [], () => AI.chat.regenerate(), { when: () => !!(AI.chat.conv && AI.chat.conv.messages.length) && !AI.chat.busy }),
      C('rename', 'Rename chat…', 'Chat', [], () => AI.renameConv(), { when: () => !!(AI.chat.conv && AI.chat.conv.messages.length) }),
      C('delete', 'Delete chat…', 'Chat', [], () => AI.deleteConv(), { when: () => !!(AI.chat.conv && AI.chat.conv.messages.length) }),
      C('settings', 'Persona and settings…', 'Chat', [], () => AI.settingsDialog(AI.chat.conv), { keywords: ['system prompt', 'temperature', 'max tokens'] }),
      C('tools', 'Control apps (agent tools)', 'Chat', [], () => AI.$('btnTools').click(), { checked: () => !!(AI.chat.conv ? AI.chat.conv.tools : AI.prefs.tools), keywords: ['agent', 'tools'] }),
      C('attach', 'Attach a text file…', 'Chat', [], () => AI.chat.attachMenu()),
      C('exportMd', 'Export chat as Markdown to Slop Drive…', 'Chat', [], () => AI.exportItems()[0].act(), { when: () => !!(AI.chat.conv && AI.chat.conv.messages.length) }),
      C('exportJson', 'Export chat as JSON to Slop Drive…', 'Chat', [], () => AI.exportItems()[1].act(), { when: () => !!(AI.chat.conv && AI.chat.conv.messages.length) }),
      C('import', 'Import a conversation…', 'Chat', [], () => AI.importConv()),
      C('save', 'Save chat to Slop Drive', 'Chat', ['Mod+S'], () => AI.saveChatToDrive(), { when: () => !!(AI.chat.conv && AI.chat.conv.messages.length) && !!window.SlopHub }),
      C('openDrive', 'Open a chat from Slop Drive…', 'Chat', [], () => AI.openChatFromDrive(), { when: () => !!window.SlopHub }),
      C('newBuild', 'New mini-app', 'Build', [], () => { AI.setTab('build'); AI.newBuild(); }),
      ...AI.TEMPLATES.map((t) => C('tpl.' + t.id, 'Mini-app template: ' + t.name, 'Build', [], () => { AI.setTab('build'); document.querySelector(`[data-tpl="${t.id}"]`) ? document.querySelector(`[data-tpl="${t.id}"]`).click() : AI.newBuild(); })),
      ...AI.TABS.map(([id, label], i) => C('tab.' + id, 'Go to ' + label, 'Go', ['Alt+' + (i + 1)], () => AI.setTab(id), { checked: () => AI.tab === id })),
      C('unload', 'Unload the model', 'Model', [], () => E.unload(), { when: () => !!(E.engine && E.engine.loaded) }),
      C('pause', 'Pause the download', 'Model', [], () => E.pause(), { when: () => E.state === 'loading' }),
      C('cancel', 'Cancel the download', 'Model', [], () => E.cancel(), { when: () => E.state === 'loading' || E.state === 'paused' }),
      C('disk', 'Load a model from disk…', 'Model', [], () => AI.importModelFolder(), { when: () => !E.isFake() }),
      C('engine', 'Switch demo / real engine', 'Model', [], () => AI.switchEngine(E.isFake() ? 'webllm' : 'fake'), { keywords: ['fake', 'webllm'] }),
      C('check', 'Run the system check', 'Model', [], () => { AI.setTab('sys'); AI.runCheck({ bench: true }); }, { keywords: ['benchmark', 'gpu', 'webgpu'] }),
      C('specCard', 'Share my spec card…', 'Model', [], () => AI.specCardDialog(AI.sys), { when: () => !!AI.sys }),
      C('sloppo', 'Ask Sloppo', 'Help', [], () => AI.askSloppo(), { keywords: ['mascot', 'buddy'] }),
      ...AI.THEMES.map(([t, l]) => C('theme.' + t, 'Theme: ' + l, 'View', [], () => AI.setTheme(t), { checked: () => document.documentElement.getAttribute('data-theme') === t })),
      C('palette', 'Search commands…', 'Help', [], () => AI.openPalette()),
      C('shortcuts', 'Keyboard shortcuts…', 'Help', [], () => window.SlopCmd && SlopCmd.openKeymap && SlopCmd.openKeymap()),
    ];
  };

  /** Register with SlopCmd when it exists; returns true when it did. */
  AI.wireCommands = function () {
    const S = window.SlopCmd;
    if (!S || !S.register) { fallbackKeys(); return false; }
    try { if (S.init) S.init({ app: 'ai' }); S.register(AI.commands()); } catch (e) { console.warn('SlopCmd', e); fallbackKeys(); return false; }
    AI.$('btnCmd').hidden = false;
    return true;
  };
  function fallbackKeys() {
    if (AI._keys) return; AI._keys = true;
    addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && (AI.chat.busy || AI.builder.busy)) { AI.chat.stop(); AI.builder.stop(); }
      if (e.altKey && /^[1-4]$/.test(e.key)) { e.preventDefault(); AI.setTab(AI.TABS[+e.key - 1][0]); }
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'o') { e.preventDefault(); AI.newChat(); }
    });
  }
})(window.AI);
