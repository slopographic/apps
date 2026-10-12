/* Slop Hex: SlopCmd commands, the Menu button's menu and the right-click menu for the bytes.
 * Classic script; exposes window.HexCommands. Shortcuts are bound here through SlopCmd only, so the keys are not
 * handled twice (Ctrl+C in the byte grid is the one exception, see grid.js). */
(function () {
  'use strict';
  if (window.HexCommands) return;
  const A = () => window.HexApp;
  const has = () => !!A().doc();
  const canUndo = () => has() && A().doc().canUndo();
  const canRedo = () => has() && A().doc().canRedo();
  const focusEl = (id) => () => { const el = document.getElementById(id); if (el) { el.focus(); el.select && el.select(); } };

  function commandList() {
    const C = (id, title, group, keys, extra = {}) => Object.assign({ id: 'hex.' + id, title, group, keys, run: () => {} }, extra);
    return [
      C('open', 'Open file…', 'File', ['Mod+O'], { keywords: ['load', 'computer', 'picker'], run: () => A().pickComputer() }),
      C('drive', 'Open from Slop Drive…', 'File', [], { keywords: ['load', 'drive'], run: () => A().pickDrive() }),
      C('save', 'Save version to Slop Drive', 'File', ['Mod+S'], { keywords: ['write', 'drive', 'version'], when: has, run: () => A().saveVersion() }),
      C('saveas', 'Save to Slop Drive as new file…', 'File', [], { keywords: ['drive', 'new', 'folder'], when: has, run: () => A().saveAs() }),
      C('download', 'Download file', 'File', ['Mod+Alt+S'], { keywords: ['save', 'computer'], when: has, run: () => A().download() }),
      C('rename', 'Rename…', 'File', [], { keywords: ['name', 'title'], when: has, run: () => window.SlopDocTabs.rename(null) }),
      C('undo', 'Undo', 'Edit', ['Mod+Z'], { keywords: ['back'], when: canUndo, run: () => A().undo() }),
      C('redo', 'Redo', 'Edit', ['Mod+Y', 'Mod+Shift+Z'], { keywords: ['forward'], when: canRedo, run: () => A().redo() }),
      C('copy', 'Copy selection as hex', 'Edit', [], { keywords: ['clipboard'], when: has, run: () => A().copySel() }),
      C('goto', 'Go to offset…', 'Go', ['Mod+G'], { keywords: ['jump', 'seek', 'address'], run: focusEl('hx-goto') }),
      C('find', 'Find…', 'Go', ['Mod+F'], { keywords: ['search', 'bytes', 'text'], run: focusEl('hx-q') }),
      C('next', 'Find next', 'Go', ['F3'], { keywords: ['search'], when: has, run: () => A().find(1) }),
      C('prev', 'Find previous', 'Go', ['Shift+F3'], { keywords: ['search', 'back'], when: has, run: () => A().find(-1) }),
      C('sha', 'Recalculate SHA-256', 'Info', [], { keywords: ['hash', 'checksum', 'digest'], when: has, run: () => A().computeSha() }),
    ];
  }

  function register() {
    if (!window.SlopCmd) return;
    SlopCmd.init({ app: 'hex' });
    SlopCmd.register(commandList());
  }

  const key = (id) => (window.SlopCtx ? SlopCtx.keyFor('hex.' + id) : '');
  const editItems = () => [
    { label: 'Undo', key: key('undo'), disabled: !canUndo(), act: () => A().undo() },
    { label: 'Redo', key: key('redo'), disabled: !canRedo(), act: () => A().redo() },
    { label: 'Copy selection as hex', key: key('copy'), disabled: !has(), act: () => A().copySel() },
    '-',
    { label: 'Go to offset…', key: key('goto'), act: focusEl('hx-goto') },
    { label: 'Find…', key: key('find'), act: focusEl('hx-q') },
    { label: 'Find next', key: key('next'), disabled: !has(), act: () => A().find(1) },
    { label: 'Find previous', key: key('prev'), disabled: !has(), act: () => A().find(-1) },
  ];

  /** The Menu button: files first, then the editing commands. */
  function menuItems() {
    return [
      { label: 'Open file…', key: key('open'), act: () => A().pickComputer() },
      { label: 'Open from Slop Drive…', act: () => A().pickDrive() },
      '-',
      { label: 'Save version to Slop Drive', key: key('save'), disabled: !has(), act: () => A().saveVersion() },
      { label: 'Save to Slop Drive as new file…', disabled: !has(), act: () => A().saveAs() },
      { label: 'Download file', disabled: !has(), act: () => A().download() },
      { label: 'Rename…', disabled: !has(), act: () => window.SlopDocTabs.rename(null) },
      '-',
      ...editItems(),
      '-',
      { label: 'Recalculate SHA-256', disabled: !has(), act: () => A().computeSha() },
    ];
  }

  /** Right-click on the bytes: the editing commands. */
  function contextItems() {
    if (!has()) return null;
    return editItems();
  }

  window.HexCommands = { commandList, register, menuItems, contextItems };
})();
