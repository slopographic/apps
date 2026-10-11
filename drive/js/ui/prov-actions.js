/* Slop Drive — ui/prov-actions: the menu for a row of the Drives tree (right-click, or a long press on touch) and the
 * actions it runs. A folder or file: Move to…, Copy to… (the picker shows every place), New folder inside, Delete… (for
 * good, from the folder). A drive: Allow access when needed, Refresh, Rename, and Remove from Slop Drive (which forgets the
 * folder; nothing in it is deleted). Every action reports its own failure in a message. */
'use strict';
(function (DR) {
  const safe = (fn) => async () => { try { await fn(); } catch (x) { window.SlopUI.alert('Not done', (x && x.message) || String(x)); } };

  DR.providerMenu = function (e, x, y) {
    const d = e.desc, ok = d.status === 'granted', local = d.id.indexOf('dir:') === 0;
    const rows = e.root ? [
      ok ? null : { label: 'Allow access', act: safe(() => DR.providerAllow(d)) },
      { label: 'New folder inside', act: safe(() => DR.providerNewFolder(e)), disabled: !ok },
      { label: 'Refresh', act: () => DR.refreshProviders() },
      '-',
      local ? { label: 'Rename…', act: safe(() => DR.renameLocalDrive(d)) } : null,
      local ? { label: 'Remove from Slop Drive…', act: safe(() => DR.removeLocalDrive(d)) } : null,
    ] : [
      e.isFolder ? { label: 'New folder inside', act: safe(() => DR.providerNewFolder(e)) } : null,
      e.isFolder ? '-' : null,
      { label: 'Move to…', act: safe(() => DR.providerTransfer(e, true)) },
      { label: 'Copy to…', act: safe(() => DR.providerTransfer(e, false)) },
      '-',
      { label: 'Delete…', act: safe(() => DR.providerDelete(e)) },
    ];
    window.SlopUI.menu(rows.filter((r) => r), x, y);
  };

  /** Move or copy one row to a place the picker returns. */
  DR.providerTransfer = async function (e, move) {
    const target = await DR.providerPicker({
      title: `${move ? 'Move' : 'Copy'} “${e.name}” to…`, ok: move ? 'Move here' : 'Copy here',
      exclude: e.isFolder ? [{ id: e.desc.id, ref: e.ref }] : [], start: { id: e.desc.id, ref: e.parent },
    });
    if (!target) return null;
    return DR.transferEntries([e], await DR.resolveDest(target), { move });
  };

  DR.providerNewFolder = async function (e) {
    const name = await window.SlopUI.prompt('New folder', 'Name', 'New folder', { ok: 'Create' });
    if (!name || !name.trim()) return;
    await e.provider.mkdir(e.ref, await e.provider.uniqueName(e.ref, name.trim().slice(0, 200), true));
    DR.provChanged();
  };

  /** Deletes a file or a folder from its local folder, for good. */
  DR.providerDelete = async function (e) {
    const what = e.isFolder ? `The folder “${e.name}” and everything in it` : `“${e.name}”`;
    const yes = await window.SlopUI.confirm('Delete from the folder?', `${what} will be deleted from “${e.desc.label}” on this computer. This cannot be undone.`, 'Delete', { danger: true });
    if (!yes) return;
    await e.provider.remove(e.ref, e.isFolder);
    DR.provChanged();
  };
})(window.DR);
