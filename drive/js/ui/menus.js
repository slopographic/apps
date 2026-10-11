/* Slop Drive — ui/menus: the right-click menu (selection-aware), the internal clipboard (copy / cut / paste)
 * and the keyboard shortcuts dialog. */
'use strict';
(function (DR) {
  const S = DR.S;
  DR.clipCopy = (cut) => { const items = DR.selected().filter((i) => !i.trashedAt); if (!items.length) return; S.clip = { keys: items.map(DR.keyOf), cut }; DR.toast(`${cut ? 'Cut' : 'Copied'} ${items.length} item${items.length === 1 ? '' : 's'}. Paste in any folder`); DR.render(); };
  DR.paste = async function (into = DR.dest()) {
    if (!S.clip) return;
    const items = DR.items(S.clip.keys).filter((i) => !i.trashedAt);
    if (!items.length) { S.clip = null; return; }
    if (S.clip.cut) { await DR.move(items, into); S.clip = null; DR.render(); } else await DR.copy(items, into);
  };
  /** The sort menu: each key (the active one with its direction arrow), then the reverse. Alt+S opens it. */
  DR.sortRows = () => [
    ...DR.SORT_KEYS.map(([k, l]) => { const on = S.sort.key === k; return { label: on ? `${l} ${S.sort.dir > 0 ? '▲' : '▼'}` : l, check: on, act: () => DR.sortClick(k) }; }),
    '-',
    { label: S.sort.dir > 0 ? 'Descending' : 'Ascending', act: () => DR.setSort(S.sort.key, -S.sort.dir) },
  ];
  DR.openSortMenu = function () {
    const r = DR.$('btnSort').getBoundingClientRect();
    window.SlopUI.menu(DR.sortRows(), r.left, r.bottom + 4);
  };

  /** The target kind decides the menu: 'empty' (the folder's background), 'trash' (items in Trash), 'folder' or 'file'. */
  DR.targetKind = function (items) {
    if (!items.length) return 'empty';
    if (S.section === 'trash' || items.every((i) => i.trashedAt)) return 'trash';
    return items.length === 1 && items[0].isFolder ? 'folder' : 'file';
  };
  const emptyRows = () => [
    { label: 'New folder', key: DR.keyLabel('newFolder'), act: () => DR.newFolder(DR.dest()), disabled: !DR.canAddHere() },
    DR.canAddHere() ? DR.newSub(DR.dest()) : null,
    { label: 'Upload files…', key: DR.keyLabel('upload'), act: () => DR.uploadPicker(false) },
    { label: 'Paste', key: DR.keyLabel('paste'), act: () => DR.paste(), disabled: !S.clip || !DR.canAddHere() },
    '-',
    { label: 'Select all', key: DR.keyLabel('selectAll'), act: () => DR.selectAll() },
    { label: 'View', sub: DR.VIEWS.map(([v, l, k]) => ({ label: l, key: k, check: S.view === v, act: () => DR.setView(v) })) },
    { label: 'Sort by', sub: DR.sortRows() },
    S.section === 'trash' ? '-' : null,
    S.section === 'trash' ? { label: 'Empty Trash…', act: () => DR.emptyTrash() } : null,
  ];
  const trashRows = (items) => [
    { label: 'Restore', act: () => DR.restore(items) },
    { label: 'Delete forever…', act: () => DR.purge(items) },
    '-',
    { label: 'Quick look', key: 'Space', act: () => DR.quickLook(items[0]), disabled: items.length !== 1 || items[0].isFolder },
    { label: 'Download', act: () => DR.download(items) },
    '-',
    { label: 'Empty Trash…', act: () => DR.emptyTrash() },
  ];
  /** The "Open in" submenu for one file: the apps that open it, the default first (marked). Picking one remembers it. */
  DR.openInRows = (r) => {
    const apps = DR.orderedAppsFor(r), d = apps[0];
    return apps.length ? apps.map((a) => ({ label: a === d ? `${a.name} (default)` : a.name, act: () => DR.openWith(r, a.id, { remember: true }) }))
      : [{ label: 'No app opens this type', disabled: true }];
  };
  /** Rows for one file or one folder (or several items of both): the open, share and edit rows, then the shared ones. */
  const itemRows = (items) => {
    const one = items.length === 1 ? items[0] : null, file = one && !one.isFolder ? one : null, folder = one && one.isFolder ? one : null;
    const allStarred = items.every((i) => i.starred);
    return [
      folder ? { label: 'Open', key: 'Enter', act: () => DR.open(folder) } : null,
      file ? { label: DR.defaultAppFor(file) ? `Open in ${DR.defaultAppFor(file).name}` : 'Open', key: 'Enter', act: () => DR.open(file) } : null,
      file ? { label: 'Open with', sub: DR.openInRows(file) } : null,
      ...DR.cleanRows(items),
      file ? { label: 'Quick look', key: 'Space', act: () => DR.quickLook(file) } : null,
      one && (S.section !== 'folder' || DR.searching()) ? { label: 'Show in folder', act: () => DR.reveal(one) } : null,
      '-',
      { label: items.length === 1 && file ? 'Download' : 'Download as .zip', act: () => DR.download(items) },
      { label: allStarred ? 'Remove star' : 'Add star', key: DR.keyLabel('star'), act: () => DR.setStar(items, !allStarred) },
      one ? { label: 'Rename…', key: DR.keyLabel('rename'), act: () => DR.rename(one) } : null,
      items.some((i) => !i.isFolder && !i.trashedAt) ? { label: 'Add tags…', act: () => DR.tagPrompt(items) } : null,
      '-',
      { label: 'Copy', key: DR.keyLabel('copy'), act: () => DR.clipCopy(false) },
      { label: 'Cut', key: DR.keyLabel('cut'), act: () => DR.clipCopy(true) },
      folder ? { label: 'Paste into folder', key: DR.keyLabel('paste'), act: () => DR.paste(folder.id), disabled: !S.clip } : null,
      { label: 'Duplicate', key: DR.keyLabel('duplicate'), act: () => DR.duplicate(items) },
      { label: 'Move to…', key: DR.keyLabel('move'), act: () => DR.moveDialog(items) },
      { label: 'Copy to…', act: () => DR.moveDialog(items, true) },
      folder ? { label: 'New folder inside', act: () => DR.newFolder(folder.id) } : null,
      folder ? DR.newSub(folder.id) : null,
      '-',
      { label: 'Info', key: DR.keyLabel('info'), act: () => { DR.toggleInfo(true); if (DR.isMobile()) DR.sheet(true); } },
      { label: 'Move to Trash', key: DR.keyLabel('trash'), act: () => DR.trash(items) },
    ];
  };
  /** The rows for a target kind, with separators that would lead or repeat dropped. */
  DR.menuRows = function (kind, items) {
    const rows = kind === 'empty' ? emptyRows() : kind === 'trash' ? trashRows(items) : itemRows(items);
    return rows.filter((x, i, a) => x && !(x === '-' && (i === 0 || a[i - 1] === '-')));
  };
  /** The right-click menu for the current selection (More, and a long press on touch). */
  DR.contextMenu = function (x, y) {
    const items = DR.selected();
    window.SlopUI.menu(DR.menuRows(DR.targetKind(items), items), x, y);
  };

  DR.SHORTCUTS = [
    ['Enter / double-click', 'Open folder, or open file in its app'], ['Space', 'Quick look'], ['Backspace / Alt+↑', 'Up one folder'],
    ['Arrows', 'Move the focus (Shift extends)'], ['Ctrl+A', 'Select all'], ['Esc', 'Clear selection'],
    ['F2', 'Rename'], ['Delete', 'Move to Trash (Shift+Delete: delete forever)'], ['S', 'Star / unstar'],
    ['Ctrl+C / X / V', 'Copy, cut, paste'], ['Ctrl+D', 'Duplicate'], ['Ctrl+M', 'Move to…'], ['Ctrl+Shift+N', 'New folder'], ['Ctrl+U', 'Upload files'],
    ['/ or Ctrl+F', 'Search'], ['1 – 6', 'Grid, list, compact, columns, nodes, disk usage'], ['I', 'Info panel'],
    ['G then R / S / T / D', 'Go to Recent, Starred, Trash, Slop Drive'], ['?', 'This list'],
  ];
  DR.shortcutsDialog = function () {
    if (window.SlopCmd && window.SlopCmd.openKeymap) return window.SlopCmd.openKeymap();
    const el = DR.el;
    window.SlopUI.dialog({ title: 'Keyboard shortcuts', cls: 'keys-dlg', body: el('div', { class: 'keys' }, DR.SHORTCUTS.map(([k, d]) => el('div', { class: 'krow' }, el('kbd', null, k), el('span', null, d)))), buttons: [{ label: 'Close', primary: true }] });
  };
})(window.DR);
