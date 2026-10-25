/* Slop Upscale: SlopCmd commands (the Ctrl+K palette and the shortcut editor) for the page's own buttons, and the
 * assistant's commands with arguments (ai-commands.js), loaded by SlopCmd.prepare() when the AI panel first asks.
 * Classic script, after main.js. */
(function (g) {
  'use strict';
  const U = g.SlopUpscale, $ = (id) => document.getElementById(id);
  function loadAI() {
    if (U.aiCommands) return Promise.resolve();
    const one = (src) => new Promise((res, rej) => {
      const s = Object.assign(document.createElement('script'), { src, async: false });
      s.onload = () => res(); s.onerror = () => rej(new Error('Could not load ' + src)); document.head.append(s);
    });
    return (g.SlopCmdSources ? Promise.resolve() : one('../shared/commands/sources.js')).then(() => one('js/app/ai-commands.js'));
  }
  function init() {
    const C = g.SlopCmd;
    if (!C) return;
    C.init({ app: 'upscale' });
    const click = (id) => () => { const b = $(id); if (b && !b.disabled) b.click(); };
    const on = (id) => () => { const b = $(id); return !!b && !b.disabled; };
    C.register([
      { id: 'up.open', title: 'Open a picture or video…', group: 'File', keys: [], keywords: ['add', 'import'], run: click('up-open') },
      { id: 'up.drive', title: 'Open from Slop Drive…', group: 'File', keys: [], keywords: ['drive'], run: click('up-drive') },
      { id: 'up.run', title: 'Upscale', group: 'Upscale', keys: [], keywords: ['start', 'enlarge', 'bigger'], when: on('up-run'), run: click('up-run') },
      { id: 'up.download', title: 'Download the result', group: 'File', keys: [], when: on('up-download'), run: click('up-download') },
      { id: 'up.save', title: 'Save the result to Slop Drive', group: 'File', keys: [], when: on('up-save'), run: click('up-save') },
      { id: 'up.clear', title: 'Clear', group: 'Edit', keys: [], when: on('up-clear'), run: click('up-clear') },
    ]);
    if (C.provide) C.provide({ prepare: loadAI });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})(typeof window !== 'undefined' ? window : globalThis);
