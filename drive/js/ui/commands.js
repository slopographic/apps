/* Slop Drive — ui/commands: every action as a command for the shared palette and shortcut editor
 * (shared/commands, window.SlopCmd). Without SlopCmd the private map in keys.js still works. */
'use strict';
(function (DR) {
  const S = DR.S;
  const HERE = (document.currentScript && document.currentScript.src) || new URL('js/ui/commands.js', location.href).href;
  const sel = () => DR.selected(), one = () => (S.sel.size === 1 ? sel()[0] : null);
  const live = () => sel().filter((i) => !i.trashedAt);
  const has = () => live().length > 0;
  const inFolder = () => S.section === 'folder';
  /** The command list (also used for the menus' key labels and the fallback shortcuts dialog). */
  DR.commands = function () {
    const C = (id, title, group, keys, run, extra = {}) => Object.assign({ id: 'drive.' + id, title, group, keys, run }, extra);
    const list = [
      C('newFolder', 'New folder', 'File', ['Alt+Shift+Mod+N'], () => DR.newFolder(DR.dest()), { keywords: ['create', 'mkdir'] }),
      ...(DR.creatables ? DR.creatables() : []).map((c) => C('new.' + c.app.id, `New ${c.label.toLowerCase()} (${c.app.name})`, 'File', [], () => DR.createNew(c), { keywords: ['create', 'new', c.ext, c.label] })),
      C('upload', 'Upload files…', 'File', ['Mod+U'], () => DR.uploadPicker(false), { keywords: ['import', 'add'] }),
      C('uploadFolder', 'Upload a folder…', 'File', [], () => DR.uploadPicker(true)),
      C('open', 'Open', 'File', [], () => DR.open(one()), { when: () => !!one() }),
      C('quickLook', 'Quick look', 'File', [], () => DR.quickLook(one()), { when: () => !!one() && !one().isFolder, keywords: ['preview'] }),
      C('download', 'Download', 'File', [], () => DR.download(sel()), { when: () => S.sel.size > 0, keywords: ['zip', 'save'] }),
      C('rename', 'Rename…', 'Edit', ['F2'], () => DR.rename(one()), { when: () => !!one() && !one().trashedAt }),
      C('copy', 'Copy', 'Edit', ['Mod+C'], () => DR.clipCopy(false), { when: has }),
      C('cut', 'Cut', 'Edit', ['Mod+X'], () => DR.clipCopy(true), { when: has }),
      C('paste', 'Paste', 'Edit', ['Mod+V'], () => { const o = one(); DR.paste(o && o.isFolder && !o.trashedAt ? o.id : DR.dest()); }, { when: () => !!S.clip }),
      C('duplicate', 'Duplicate', 'Edit', ['Mod+D'], () => DR.duplicate(live()), { when: has }),
      C('move', 'Move to…', 'Edit', ['Mod+M'], () => DR.moveDialog(live()), { when: has }),
      C('copyTo', 'Copy to…', 'Edit', [], () => DR.moveDialog(live(), true), { when: has }),
      C('star', 'Star / unstar', 'Edit', ['S'], () => { const i = live(); DR.setStar(i, !i.every((x) => x.starred)); }, { when: has, keywords: ['favourite', 'favorite'] }),
      C('trash', 'Move to Trash', 'Edit', ['Delete'], () => (S.section === 'trash' ? DR.purge(sel()) : DR.trash(sel())), { when: () => S.sel.size > 0, keywords: ['delete', 'remove'] }),
      C('purge', 'Delete forever…', 'Edit', ['Shift+Delete'], () => DR.purge(sel()), { when: () => S.sel.size > 0 }),
      C('restore', 'Restore from Trash', 'Edit', [], () => DR.restore(sel()), { when: () => sel().some((i) => i.trashedAt) }),
      C('selectAll', 'Select all', 'Edit', ['Mod+A'], () => DR.selectAll()),
      C('search', 'Search files', 'Go', ['Mod+F'], () => DR.$('search').focus(), { keywords: ['find'] }),
      C('up', 'Up one folder', 'Go', ['Backspace', 'Alt+ArrowUp'], () => DR.up(), { when: () => !!S.cwd || !inFolder() }),
      C('goDrive', 'Go to Slop Drive', 'Go', ['G D'], () => DR.go(null), { keywords: ['home', 'root'] }),
      C('goRecent', 'Go to Recent', 'Go', ['G R'], () => DR.goSection('recent')),
      C('goStarred', 'Go to Starred', 'Go', ['G S'], () => DR.goSection('starred')),
      C('goTrash', 'Go to Trash', 'Go', ['G T'], () => DR.goSection('trash')),
      C('showInFolder', 'Show in folder', 'Go', [], () => DR.reveal(one()), { when: () => !!one() && (!inFolder() || DR.searching()) }),
      C('copyLink', 'Copy link to this view', 'Go', [], () => DR.copyLink(), { keywords: ['share', 'url', 'address', 'link', 'bookmark'] }),
      ...DR.VIEWS.map(([v, label, k]) => C('view.' + v, label + ' view', 'View', [k], () => DR.setView(v), { checked: () => S.view === v, keywords: v === 'usage' ? ['treemap', 'sunburst', 'size', 'space'] : v === 'nodes' ? ['graph', 'tree'] : [] })),
      C('view.treemap', 'Disk usage: treemap', 'View', [], () => { S.usageMode = 'treemap'; DR.savePrefs(); DR.setView('usage'); }, { checked: () => S.view === 'usage' && S.usageMode === 'treemap' }),
      C('view.sunburst', 'Disk usage: sunburst', 'View', [], () => { S.usageMode = 'sunburst'; DR.savePrefs(); DR.setView('usage'); }, { checked: () => S.view === 'usage' && S.usageMode === 'sunburst' }),
      C('info', 'Info panel', 'View', ['I'], () => DR.toggleInfo(), { checked: () => !!S.info, keywords: ['details', 'properties'] }),
      C('sort', 'Sort menu…', 'View', ['Alt+S'], () => DR.openSortMenu(), { keywords: ['order', 'arrange', 'sort by'] }),
      C('tags', 'Add tags to selection…', 'Edit', [], () => DR.tagPrompt(live().filter((i) => !i.isFolder)), { when: () => live().some((i) => !i.isFolder), keywords: ['label', 'tag'] }),
      ...DR.THEMES.map(([t, label]) => C('theme.' + t, 'Theme: ' + label, 'View', [], () => DR.setTheme(t), { checked: () => document.documentElement.getAttribute('data-theme') === t })),
      C('dupes', 'Find duplicates…', 'Tools', [], () => DR.dupesDialog(), { keywords: ['duplicate', 'same', 'space', 'clean'] }),
      C('connectFolder', 'Connect folder…', 'Tools', [], DR.folderAct(() => DR.connectFolder()), { keywords: ['local', 'disk', 'computer', 'folder', 'save'] }),
      C('folderLoadConfig', 'Load config from folder…', 'Tools', [], DR.folderAct(() => DR.folderLoadConfig()), { when: () => !!DR.folderState.name && DR.folderState.perm === 'granted', keywords: ['settings', 'slopographic', 'import'] }),
      C('folderSaveConfig', 'Save config to folder', 'Tools', [], DR.folderAct(() => DR.folderSaveConfig()), { when: () => !!DR.folderState.name && DR.folderState.perm === 'granted', keywords: ['settings', 'slopographic', 'export'] }),
      C('disconnectFolder', 'Disconnect folder…', 'Tools', [], DR.folderAct(() => DR.folderDisconnectAsk()), { when: () => !!DR.folderState.name, keywords: ['forget', 'local'] }),
      C('backup', 'Backup & restore…', 'Tools', [], () => DR.backupDialog(), { keywords: ['import', 'export'] }),
      C('exportBackup', 'Export backup now', 'Tools', [], () => window.SlopBackup.exportNow().then((r) => DR.toast('Saved ' + r.name)), { keywords: ['save everything', 'download'] }),
      C('persist', 'Ask the browser to keep storage', 'Tools', [], () => DR.requestPersist(true), { keywords: ['persist', 'storage'] }),
      C('emptyTrash', 'Empty Trash…', 'Tools', [], () => DR.emptyTrash()),
      C('shortcuts', 'Keyboard shortcuts…', 'Help', ['?'], () => DR.shortcutsDialog()),
    ];
    return list;
  };
  /** Display label for a command's shortcut (SlopCmd's, which reflects the person's own bindings). */
  DR.keyLabel = function (id) {
    if (window.SlopCmd && window.SlopCmd.keyFor) { try { return window.SlopCmd.keyFor('drive.' + id) || undefined; } catch (e) { /* fall through */ } }
    const c = DR.commands().find((x) => x.id === 'drive.' + id);
    return c && c.keys[0] ? c.keys[0].replace('Mod', 'Ctrl') : undefined;
  };
  DR.openPalette = (q) => (window.SlopCmd && window.SlopCmd.open ? window.SlopCmd.open(q) : DR.$('search').focus());

  /** Files as palette results, when the palette supports providers. */
  function fileProvider() {
    return { id: 'drive.files', title: 'Files', search: (query) => {
      const q = String(query || '').trim().toLowerCase();
      if (q.length < 2) return [];
      return [...DR.liveFolders(), ...DR.liveFiles()].filter((it) => it.name.toLowerCase().includes(q)).slice(0, 20)
        .map((it) => ({ id: 'drive.item.' + DR.keyOf(it), title: it.name, group: it.isFolder ? 'Folders' : 'Files', keywords: [DR.kindLabel(it)], run: () => DR.reveal(it) }));
    } };
  }
  DR.wireCommands = function () {
    const C = window.SlopCmd;
    DR.cmdActive = false;
    if (!C || !C.register) return false;
    try {
      if (C.init) C.init({ app: 'drive', target: document });
      C.register(DR.commands());
      const p = fileProvider();
      if (C.addProvider) C.addProvider(p); else if (C.provider) C.provider(p);
      // the assistant's commands with arguments (ai-commands.js), loaded when the AI panel first asks
      if (C.provide) C.provide({ prepare: () => (C.get && C.get('drive.ai.list-items') ? null : new Promise((res, rej) => {
        const s = Object.assign(document.createElement('script'), { src: new URL('ai-commands.js', HERE).href, async: false });
        s.onload = res; s.onerror = () => rej(new Error('Could not load ai-commands.js')); document.head.append(s);
      })) });
      DR.cmdActive = true;
      const b = DR.$('btnCmd'); if (b) b.hidden = false;
    } catch (e) { console.warn('Slop Drive: command palette unavailable', e); }
    return DR.cmdActive;
  };
})(window.DR);
