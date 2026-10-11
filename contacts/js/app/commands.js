/* Slop Contacts commands: every main action, registered with SlopCmd (palette, remappable keys) and run from
 * any element with data-cmd. Without SlopCmd the buttons still work; the keyboard shortcuts are then off. */
(function () {
  'use strict';
  const SC = window.SlopContacts;
  const S = SC.state;
  const UI = window.SlopUI;
  const io = () => SC.io, tools = () => SC.tools, st = () => SC.storage;
  /** Shortcuts only when no text field or dialog has the focus. */
  const idle = () => {
    const a = document.activeElement;
    return !(a && a.closest && a.closest('input, textarea, select, [contenteditable="true"]')) && !(UI && UI.openDialogs);
  };
  const hasContacts = () => S.list.length > 0;
  const hasSel = () => S.sel.size > 0;

  async function rename() {
    const v = await UI.prompt('Rename list', 'List name (used for the file name in Slop Drive)', S.file.name, { ok: 'Rename' });
    if (v === null) return;
    S.file.name = v.trim() || 'Contacts';
    S.file.dirty = true;
    S.emit('change');
  }
  function about() {
    UI.alert('Slop Contacts', 'Your address book runs entirely in this browser. Import vCard and CSV, clean up and merge duplicates, then export for iOS, Android, Google or Outlook. Lists are saved to Slop Drive on this device; nothing is uploaded.');
  }

  const COMMANDS = [
    { id: 'file.new', title: 'New list', group: 'File', run: () => st().newList() },
    { id: 'file.open', title: 'Open from Slop Drive…', group: 'File', keys: ['Mod+O'], run: () => st().openFromDrive(), when: () => !!window.SlopHub },
    { id: 'file.save', title: 'Save', group: 'File', keys: ['Mod+S'], run: () => st().save() },
    { id: 'file.saveAs', title: 'Save to Slop Drive as…', group: 'File', run: () => st().save({ as: true }), when: () => !!window.SlopHub },
    { id: 'file.rename', title: 'Rename list…', group: 'File', run: rename },
    { id: 'import.files', title: 'Import vCard or CSV…', group: 'File', keys: ['Mod+I'], run: () => io().importPick() },
    { id: 'export.open', title: 'Export…', group: 'File', keys: ['Mod+E'], run: () => io().exportDialog(), when: hasContacts },
    { id: 'export.vcf', title: 'Export vCard 3.0 (.vcf)', group: 'Export', run: () => io().exportAs('vcf'), when: hasContacts },
    { id: 'export.zip', title: 'Export one vCard per contact (.zip)', group: 'Export', run: () => io().exportAs('zip'), when: hasContacts },
    { id: 'export.google', title: 'Export Google Contacts CSV', group: 'Export', run: () => io().exportAs('google'), when: hasContacts },
    { id: 'export.outlook', title: 'Export Outlook CSV', group: 'Export', run: () => io().exportAs('outlook'), when: hasContacts },
    { id: 'contacts.new', title: 'New contact', group: 'Contacts', keys: ['Alt+N'], run: () => SC.editor.open(null) },
    { id: 'contacts.edit', title: 'Edit selected contact', group: 'Contacts', run: () => { const [c] = S.selected(); if (c) SC.editor.open(c.id); }, when: () => S.sel.size === 1 },
    { id: 'contacts.selectAll', title: 'Select all shown', group: 'Contacts', keys: ['Mod+A'], run: () => SC.list.selectShown(true), when: () => idle() && hasContacts() },
    { id: 'contacts.clearSel', title: 'Clear selection', group: 'Contacts', keys: ['Escape'], run: () => S.setSel([]), when: () => idle() && hasSel() },
    { id: 'contacts.delete', title: 'Delete selected…', group: 'Contacts', keys: ['Delete'], run: () => tools().deleteSelected(), when: () => idle() && hasSel() },
    { id: 'contacts.dupes', title: 'Find duplicates…', group: 'Tools', run: () => tools().dupesDialog(), when: () => S.list.length > 1 },
    { id: 'contacts.clean', title: 'Clean up contacts…', group: 'Tools', run: () => tools().cleanDialog(), when: hasContacts },
    { id: 'contacts.findReplace', title: 'Find and replace…', group: 'Tools', keys: ['Mod+H'], run: () => tools().findDialog(), when: hasContacts },
    { id: 'groups.add', title: 'Add selected to group…', group: 'Groups', run: () => tools().addGroupDialog(), when: hasSel },
    { id: 'groups.remove', title: 'Remove selected from group…', group: 'Groups', run: () => tools().removeGroupDialog(), when: hasSel },
    { id: 'groups.showAll', title: 'Show all contacts', group: 'Groups', run: () => { S.group = null; S.emit('render'); } },
    { id: 'settings.country', title: 'Default country code…', group: 'Settings', run: () => tools().countryDialog() },
    { id: 'view.search', title: 'Search contacts', group: 'View', keys: ['Mod+F'], run: () => { const q = document.getElementById('search'); if (q) q.focus(); } },
    { id: 'help.about', title: 'About Slop Contacts', group: 'Help', run: about },
  ];
  const byId = Object.fromEntries(COMMANDS.map((c) => [c.id, c]));

  /** Run a command by id. Goes through SlopCmd when it is loaded (so recents and remapped keys apply). */
  function run(id) {
    const c = byId[id];
    if (!c) return false;
    try {
      if (window.SlopCmd && window.SlopCmd.get(id)) return window.SlopCmd.run(id);
      if (c.when && !c.when()) return false;
      c.run();
      return true;
    } catch (err) {
      console.error(err);
      UI.toast(c.title + ' failed: ' + err.message);
      return false;
    }
  }

  /** Register with SlopCmd and add the ⌘K button. Also wire every [data-cmd] element. */
  function init() {
    const C = window.SlopCmd;
    if (C) {
      C.init({ app: 'contacts' });
      C.register(COMMANDS.map((c) => ({ id: c.id, title: c.title, group: c.group, keys: c.keys || [], when: c.when, run: () => c.run() })));
      C.register([{ id: 'help.keys', title: 'Keyboard shortcuts…', group: 'Help', run: () => C.openKeymap() }]);
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'tb'; b.id = 'btnCmd'; b.title = 'Search commands (Ctrl+K)'; b.setAttribute('aria-label', 'Search commands');
      b.textContent = '⌘K';
      b.addEventListener('click', () => C.open());
      document.getElementById('btnSave').before(b);
    }
    document.addEventListener('click', (e) => {
      const el = e.target.closest && e.target.closest('[data-cmd]');
      if (el && !el.disabled) { e.preventDefault(); run(el.dataset.cmd); }
    });
  }

  SC.commands = { COMMANDS, run, init };
})();
