/* Slop Watermark: SlopCmd commands (the Ctrl+K palette and the shortcut editor) for the page's own actions, and the
 * assistant's commands with arguments (ai-commands.js, an ES module), loaded by SlopCmd.prepare() when the AI panel first
 * asks. Classic script, after main.js. */
(function () {
  'use strict';
  function loadAI() {
    const need = window.SlopCmdSources ? Promise.resolve() : new Promise((res, rej) => {
      const s = Object.assign(document.createElement('script'), { src: '../shared/commands/sources.js' });
      s.onload = () => res(); s.onerror = () => rej(new Error('Could not load sources.js')); document.head.append(s);
    });
    return need.then(() => import(new URL('js/ai-commands.js', location.href).href));
  }
  function init() {
    const C = window.SlopCmd, A = window.WMApp;
    if (!C || !A) return;
    C.init({ app: 'watermark' });
    const has = () => window.WMItems.count() > 0 && !A.busy();
    C.register([
      { id: 'wm.open', title: 'Open files…', group: 'File', keys: [], keywords: ['add', 'import', 'pictures', 'videos', 'pdf'], run: () => window.SlopIntake.pick({ to: 'watermark' }) },
      { id: 'wm.apply', title: 'Apply to all', group: 'Watermark', keys: [], keywords: ['run', 'start', 'stamp'], when: has, run: () => A.applyAll() },
      { id: 'wm.zip', title: 'Download all (ZIP)', group: 'File', keys: [], when: () => window.WMItems.outCount() > 0, run: () => A.downloadZip() },
      { id: 'wm.clear', title: 'Clear the list', group: 'Edit', keys: [], when: has, run: () => A.clearAll() },
    ]);
    if (C.provide) C.provide({ prepare: loadAI });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
