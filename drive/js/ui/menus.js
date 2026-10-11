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
  const sortSub = () => [['name', 'Name'], ['kind', 'Kind'], ['size', 'Size'], ['modified', 'Modified'], ['app', 'App']]
    .map(([k, l]) => ({ label: l, check: S.sort.key === k, act: () => { S.sort = { key: k, dir: S.sort.key === k ? -S.sort.dir : 1 }; DR.savePrefs(); DR.render(); } }));

  DR.contextMenu = function (x, y) {
    const items = DR.selected(), UI = window.SlopUI;
    let m;
    if (!items.length) {
      m = [
        { label: 'New folder', key: 'Ctrl+Shift+N', act: () => DR.newFolder(DR.dest()), disabled: !DR.canAddHere() },
        { label: 'Upload files…', key: 'Ctrl+U', act: () => DR.uploadPicker(false) },
        { label: 'Paste', key: 'Ctrl+V', act: () => DR.paste(), disabled: !S.clip || !DR.canAddHere() },
        '-',
        { label: 'Select all', key: 'Ctrl+A', act: () => DR.selectAll() },
        { label: 'View', sub: DR.VIEWS.map(([v, l, k]) => ({ label: l, key: k, check: S.view === v, act: () => DR.setView(v) })) },
        { label: 'Sort by', sub: sortSub() },
      ];
      if (S.section === 'trash') m.push('-', { label: 'Empty Trash…', act: () => DR.emptyTrash() });
    } else if (S.section === 'trash' || items.every((i) => i.trashedAt)) {
      m = [
        { label: 'Restore', act: () => DR.restore(items) },
        { label: 'Delete forever…', act: () => DR.purge(items) },
        '-',
        { label: 'Quick look', key: 'Space', act: () => DR.quickLook(items[0]), disabled: items.length !== 1 || items[0].isFolder },
        { label: 'Download', act: () => DR.download(items) },
        '-',
        { label: 'Empty Trash…', act: () => DR.emptyTrash() },
      ];
    } else {
      const one = items.length === 1 ? items[0] : null, file = one && !one.isFolder ? one : null, folder = one && one.isFolder ? one : null;
      const apps = file ? DR.appsFor(file) : [];
      const allStarred = items.every((i) => i.starred);
      m = [
        folder ? { label: 'Open', key: 'Enter', act: () => DR.open(folder) } : null,
        file ? { label: apps.length ? `Open in ${apps[0].name}` : 'Open', key: 'Enter', act: () => DR.open(file) } : null,
        file ? { label: 'Open with', sub: apps.length ? apps.map((a) => ({ label: a.name, act: () => DR.openWith(file, a.id) })) : [{ label: 'No app opens this type', disabled: true }] } : null,
        file ? { label: 'Quick look', key: 'Space', act: () => DR.quickLook(file) } : null,
        one && (S.section !== 'folder' || DR.searching()) ? { label: 'Show in folder', act: () => DR.reveal(one) } : null,
        '-',
        { label: items.length === 1 && file ? 'Download' : 'Download as .zip', act: () => DR.download(items) },
        { label: allStarred ? 'Remove star' : 'Add star', key: 'S', act: () => DR.setStar(items, !allStarred) },
        one ? { label: 'Rename…', key: 'F2', act: () => DR.rename(one) } : null,
        '-',
        { label: 'Copy', key: 'Ctrl+C', act: () => DR.clipCopy(false) },
        { label: 'Cut', key: 'Ctrl+X', act: () => DR.clipCopy(true) },
        folder ? { label: 'Paste into folder', key: 'Ctrl+V', act: () => DR.paste(folder.id), disabled: !S.clip } : null,
        { label: 'Duplicate', key: 'Ctrl+D', act: () => DR.duplicate(items) },
        { label: 'Move to…', key: 'Ctrl+M', act: () => DR.moveDialog(items) },
        { label: 'Copy to…', act: () => DR.moveDialog(items, true) },
        folder ? { label: 'New folder inside', act: () => DR.newFolder(folder.id) } : null,
        '-',
        { label: 'Info', key: 'I', act: () => { DR.toggleInfo(true); if (DR.isMobile()) DR.sheet(true); } },
        { label: 'Move to Trash', key: 'Del', act: () => DR.trash(items) },
      ];
    }
    UI.menu(m.filter((x, i, a) => x && !(x === '-' && (i === 0 || a[i - 1] === '-'))), x, y);
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
    const el = DR.el;
    window.SlopUI.dialog({ title: 'Keyboard shortcuts', cls: 'keys-dlg', body: el('div', { class: 'keys' }, DR.SHORTCUTS.map(([k, d]) => el('div', { class: 'krow' }, el('kbd', null, k), el('span', null, d)))), buttons: [{ label: 'Close', primary: true }] });
  };
})(window.DR);
