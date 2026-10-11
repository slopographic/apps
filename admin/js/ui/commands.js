// Slop Admin commands, registered with SlopCmd (palette, remappable keys). Also wires every [data-cmd] button.
(function (g) {
  'use strict';
  const NS = (g.SlopAdmin = g.SlopAdmin || {});
  const COMMANDS = [
    { id: 'view.company', title: 'Go to Company profile', group: 'Go to', run: () => NS.app.show('company') },
    { id: 'view.numbering', title: 'Go to Numbering', group: 'Go to', run: () => NS.app.show('numbering') },
    { id: 'view.taxes', title: 'Go to Tax rates', group: 'Go to', run: () => NS.app.show('taxes') },
    { id: 'view.data', title: 'Go to Data', group: 'Go to', run: () => NS.app.show('data') },
    { id: 'view.storage', title: 'Go to Storage', group: 'Go to', run: () => NS.app.show('storage') },
    { id: 'data.backup', title: 'Data: download a full backup', group: 'Data', run: () => { NS.app.show('data'); document.getElementById('dBackup').click(); } },
    { id: 'data.everything', title: 'Data: export or import everything in one file', group: 'Data', run: () => { NS.app.show('data'); document.getElementById('dEverything').click(); } },
    { id: 'data.restore', title: 'Data: restore from a backup file…', group: 'Data', run: () => { NS.app.show('data'); document.getElementById('dRestore').click(); } },
    { id: 'data.reset', title: 'Data: reset all data…', group: 'Data', run: () => { NS.app.show('data'); NS.views.data.reset(); } },
  ];
  const byId = Object.fromEntries(COMMANDS.map((c) => [c.id, c]));

  /** Runs a command through SlopCmd when it is loaded (recents and remapped keys apply), else directly. */
  function run(id) {
    if (g.SlopCmd && g.SlopCmd.get(id)) return g.SlopCmd.run(id);
    const c = byId[id];
    if (!c) return false;
    c.run();
    return true;
  }

  function init() {
    if (g.SlopCmd) {
      g.SlopCmd.init({ app: 'admin' });
      g.SlopCmd.register(COMMANDS.map((c) => ({ id: c.id, title: c.title, group: c.group, keywords: [], keys: [], run: () => c.run() })));
    }
    document.addEventListener('click', (e) => {
      const el = e.target.closest && e.target.closest('[data-cmd]');
      if (!el || el.disabled) return;
      e.preventDefault();
      run(el.dataset.cmd);
    });
  }

  NS.commands = { init, run, list: COMMANDS };
})(typeof window !== 'undefined' ? window : globalThis);
