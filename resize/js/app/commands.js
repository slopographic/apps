/* Slop Resize: SlopCmd commands and their keys (the palette and the shortcut editor both list them). Classic script; adds
 * window.SlopResize.commands.install(api), where api is the controller in main.js. A command that changes a setting
 * sets the panel's own control and fires 'change', so the panel updates exactly as if the person had picked it.
 * SlopCmd.prepare() loads ai-commands.js: the assistant's commands with arguments, its state summary and checkpoint. */
(function (g) {
  'use strict';
  const NS = g.SlopResize, C = (NS.commands = {});
  const $ = (id) => document.getElementById(id);

  function setField(id, value) {
    const e = $(id);
    if (!e) return;
    e.value = String(value);
    e.dispatchEvent(new Event('change', { bubbles: true }));
  }
  const busy = () => NS.queue.busy();
  const hasItems = () => NS.queue.items().some((i) => i.src);
  const hasDone = () => NS.queue.items().some((i) => i.status === 'done');
  const hasUnsaved = () => NS.queue.items().some((i) => i.status === 'done' && !i.drive);

  C.install = function (api) {
    if (!g.SlopCmd) return;
    const MODES = [['size', 'Resize by width and height'], ['scale', 'Resize by percentage'], ['long', 'Resize by long edge'], ['bytes', 'Limit file size (images)']];
    const FILLS = [['fit', 'Fit (letterbox)'], ['cover', 'Cover (crop)'], ['stretch', 'Stretch'], ['within', 'Fit inside (no padding)']];
    const list = [
      { id: 'rs.open', title: 'Open pictures and videos…', group: 'File', keys: ['Mod+O'], keywords: ['add', 'import', 'photo', 'video'], run: () => api.open() },
      { id: 'rs.drive', title: 'Open from Slop Drive…', group: 'File', keys: ['Shift+Mod+O'], keywords: ['drive', 'saved', 'file'], run: () => api.drive() },
      { id: 'rs.zip', title: 'Download all (zip)', group: 'File', keys: ['Mod+S'], keywords: ['save', 'zip', 'download'], when: hasDone, run: () => api.downloadAll() },
      { id: 'rs.save-drive', title: 'Save results to Slop Drive', group: 'File', keys: ['Shift+Mod+S'], keywords: ['drive', 'keep', 'store'], when: () => hasUnsaved() && !busy(), run: () => api.saveAll() },
      { id: 'rs.run', title: 'Resize all', group: 'Resize', keys: ['Mod+Enter'], keywords: ['start', 'go', 'convert', 'run'], when: () => hasItems() && !busy(), run: () => api.run() },
      { id: 'rs.cancel', title: 'Cancel the run', group: 'Resize', keys: ['Escape'], keywords: ['stop', 'abort'], when: busy, run: () => api.cancel() },
      { id: 'rs.clear', title: 'Clear the list', group: 'Edit', keywords: ['remove', 'empty', 'reset'], when: () => !busy() && NS.queue.items().length > 0, run: () => api.clear() },
      { id: 'rs.preset-save', title: 'Save settings as preset…', group: 'Presets', keys: ['Shift+Mod+P'], keywords: ['saved', 'remember'], run: () => $('rs-save-as').click() },
      { id: 'rs.preset-apply', title: 'Apply saved settings', group: 'Presets', keywords: ['saved', 'load'], run: () => $('rs-apply').click() },
      ...MODES.map(([mode, title]) => ({ id: 'rs.mode.' + mode, title, group: 'Size', keywords: ['mode', 'scale', 'dimensions'], run: () => setField('rs-mode', mode) })),
      ...FILLS.map(([fill, title]) => ({ id: 'rs.fill.' + fill, title: 'Fill: ' + title, group: 'Size', keywords: ['fill', 'letterbox', 'crop', 'stretch'], run: () => { setField('rs-mode', 'size'); setField('rs-fill', fill); } })),
      ...NS.size.PRESETS.map((p) => ({ id: 'rs.target.' + p.id, title: 'Target size: ' + p.label, group: 'Target size', keywords: ['resize', 'dimensions', `${p.w}x${p.h}`, `${p.w}×${p.h}`], run: () => setField('rs-preset', p.id) })),
    ];
    g.SlopCmd.register(list);
    if (g.SlopCmd.provide) g.SlopCmd.provide({ prepare: loadAICommands });   // the assistant's commands load when first needed
  };

  /** ai-commands.js (commands with arguments, the state summary, the checkpoint), loaded on demand, never on first paint. */
  function loadAICommands() {
    if (NS.aiCommands) return Promise.resolve();
    return new Promise((res, rej) => {
      const s = document.createElement('script');
      s.src = 'js/app/ai-commands.js';
      s.onload = () => res();
      s.onerror = () => rej(new Error('Could not load js/app/ai-commands.js'));
      document.head.append(s);
    });
  }
})(typeof window !== 'undefined' ? window : globalThis);
