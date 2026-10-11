/* SlopAIKit appTools: the "Control apps" tool set. Classic script; adds SlopAIKit.appTools.
 *   appTools.build(env) → tools for SlopAIKit.tools.run
 * env: { apps(): SLOP_APPS, hub: SlopHub, cmd: SlopCmd (only inside an app, via the side panel), open(url),
 *        confirm(title, message), appId }
 * Destructive actions (commands that delete, clear, close, reset, …) always ask the person first. */
(function () {
  'use strict';
  const K = (window.SlopAIKit = window.SlopAIKit || {});
  const DESTRUCTIVE = /\b(delete|remove|trash|purge|clear|erase|empty|reset|close|discard|revert|overwrite|replace|wipe|destroy|new|flatten|merge|crop|quit)\b/i;
  const isDestructiveCommand = (c) => !!c && (DESTRUCTIVE.test(c.title || '') || DESTRUCTIVE.test((c.id || '').replace(/[._-]/g, ' ')));

  function listCommands(cmd) {
    let list = [];
    try { list = cmd.list() || []; } catch (e) { return []; }
    return list.filter((c) => { try { return !c.when || c.when(); } catch (e) { return false; } })
      .map((c) => ({ id: c.id, title: c.title, group: c.group || '' }));
  }

  function build(env = {}) {
    const apps = env.apps || (() => window.SLOP_APPS || []);
    const hub = env.hub !== undefined ? env.hub : window.SlopHub;
    const open = env.open || ((url) => window.open(url, '_blank'));
    const tools = [
      { name: 'list_apps', description: 'List the Slopographic apps, games and experiments (id, name, what it does).', params: {},
        run: () => apps().map((a) => ({ id: a.id, name: a.name, kind: a.kind, does: a.tagline, status: a.status })) },
      { name: 'open_app', description: 'Open a Slopographic app in a new tab, by its id (for example "photoslop", "vector", "pdf", "drive").',
        params: { id: { type: 'string', description: 'app id', required: true } },
        run: (a) => {
          const app = apps().find((x) => x.id === a.id || x.name.toLowerCase() === String(a.id).toLowerCase());
          if (!app) throw new Error(`No app "${a.id}". Use list_apps to see the ids.`);
          const url = hub && hub.urlOf ? hub.urlOf(app) : new URL(app.path, location.href).href;
          open(url);
          return `Opened ${app.name}.`;
        } },
      { name: 'save_to_drive', description: 'Save text as a new file in Slop Drive (the shared local drive).',
        params: { name: { type: 'string', description: 'file name with extension, e.g. notes.md', required: true }, content: { type: 'string', description: 'the file text', required: true } },
        run: async (a) => {
          if (!hub || !hub.put) throw new Error('Slop Drive is not available on this page.');
          const name = String(a.name).replace(/[\\/:*?"<>|]+/g, '-').slice(0, 120) || 'untitled.txt';
          const type = /\.html?$/i.test(name) ? 'text/html' : /\.json$/i.test(name) ? 'application/json' : /\.md$/i.test(name) ? 'text/markdown' : 'text/plain';
          const id = await hub.put(new Blob([String(a.content)], { type }), { name, from: 'ai' });
          return `Saved "${name}" to Slop Drive (id ${id}).`;
        } },
      { name: 'list_files', description: 'List files in Slop Drive, optionally filtered by a word in the name.',
        params: { query: { type: 'string', description: 'word to filter by' } },
        run: async (a) => {
          if (!hub || !hub.list) throw new Error('Slop Drive is not available on this page.');
          const q = String(a.query || '').toLowerCase();
          const files = (await hub.list()).filter((f) => !q || f.name.toLowerCase().includes(q)).slice(0, 40);
          return files.map((f) => ({ name: f.name, type: f.type, size: f.size, from: f.from }));
        } },
    ];
    const cmd = env.cmd;
    if (cmd && cmd.list && cmd.run) {
      const label = env.appId ? `the ${((apps().find((a) => a.id === env.appId) || {}).name) || env.appId} app` : 'this app';
      tools.push(
        { name: 'list_commands', description: `List the commands of ${label} that can run right now (id and title).`, params: {}, run: () => listCommands(cmd) },
        { name: 'run_command', description: `Run one command of ${label} by its id (get ids from list_commands).`,
          params: { id: { type: 'string', description: 'command id', required: true } },
          destructive: (a) => isDestructiveCommand(listCommands(cmd).find((c) => c.id === a.id) || { id: a.id }),
          confirmText: (a) => { const c = listCommands(cmd).find((x) => x.id === a.id); return `The assistant wants to run “${c ? c.title : a.id}” in ${label}. This may change or remove your work.`; },
          run: (a) => {
            const c = listCommands(cmd).find((x) => x.id === a.id);
            if (!c) throw new Error(`No command "${a.id}" right now. Use list_commands.`);
            cmd.run(a.id);
            return `Ran “${c.title}”.`;
          } });
    }
    return tools;
  }

  K.appTools = { build, isDestructiveCommand, listCommands, DESTRUCTIVE };
})();
