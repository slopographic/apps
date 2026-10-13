/* Slop Drive — ui/prov-drives: adding, renaming and removing named local drives, allowing access again, and the help
 * text. A local drive is a folder picked on this computer. The browser keeps its handle in this browser's storage, and Slop
 * Drive asks again when the browser needs it (a button press). Removing a drive forgets the handle only: nothing in the
 * folder is deleted. */
'use strict';
(function (DR) {
  const el = DR.el;
  const NEEDS_CHROME = 'Local drives need Chrome or Edge. Your browser cannot pick a folder for Slop Drive, so nothing was added.';
  DR.LOCAL_DRIVES_HELP = [
    'A local drive is a folder on this computer that you pick. Slop Drive reads and writes it through this browser. Nothing is uploaded.',
    'Each browser keeps its own list of local drives. One browser cannot see the drives of another browser, even on the same computer.',
    'A folder is shared across browsers only in two ways: pick the same folder in each browser (on each machine, or in a folder that a sync or network share keeps the same), or let a cloud provider keep copies in step.',
    'Moving a file out of a local drive removes the original from that folder once the copy is made. Moving out of Slop Drive sends the original to the Trash, where it can be restored.',
    'Chrome and Edge only. A drive that needs access again shows “Allow access” on its name. Press it, and the browser asks.',
  ];
  DR.localDrivesHelp = function () {
    window.SlopUI.dialog({
      title: 'About local drives', cls: 'pv-help-dlg',
      body: el('div', { class: 'pv-help' }, DR.LOCAL_DRIVES_HELP.map((t) => el('p', { class: 'sui-p' }, t)), el('p', { class: 'sui-p' },
        el('a', { href: '/how-it-works/' }, 'How this works, and the browser specs behind it'),
        ': the official spec for local folders is the ',
        el('a', { href: 'https://wicg.github.io/file-system-access/', rel: 'noopener', target: '_blank' }, 'File System Access API'), '.')),
      buttons: [{ label: 'Close', primary: true }],
    });
  };

  /** Picks a folder (the browser needs the press), then asks for a name. A name already used gets " (2)". */
  DR.addLocalDrive = async function () {
    if (typeof window.showDirectoryPicker !== 'function') return window.SlopUI.alert('Local drives need Chrome or Edge', NEEDS_CHROME);
    let h;
    try { h = await window.showDirectoryPicker({ mode: 'readwrite' }); } catch (e) { if (e && e.name === 'AbortError') return; throw e; }
    const taken = new Set((await DR.drivesAll()).map((d) => d.name.toLowerCase()));
    const typed = await window.SlopUI.prompt('Name this drive', 'Name', h.name, { ok: 'Add drive' });
    if (!typed || !typed.trim()) return;
    const name = DR.dirUniqueName(taken, typed.trim().slice(0, 80), true);
    await DR.driveSave({ id: DR.newDriveId(), name, handle: h, added: Date.now() });
    await DR.refreshProviders();
    DR.toast(`Added “${name}”. Nothing was copied.`);
  };

  const record = async (d) => (await DR.drivesAll()).find((x) => 'dir:' + x.id === d.id) || null;
  DR.renameLocalDrive = async function (d) {
    const rec = await record(d);
    if (!rec) return;
    const typed = await window.SlopUI.prompt('Rename drive', 'Name', rec.name, { ok: 'Rename' });
    if (!typed || !typed.trim() || typed.trim() === rec.name) return;
    await DR.driveSave(Object.assign({}, rec, { name: typed.trim().slice(0, 80) }));
    await DR.refreshProviders();
  };
  DR.removeLocalDrive = async function (d) {
    const yes = await window.SlopUI.confirm('Remove this drive?', `“${d.label}” is removed from Slop Drive in this browser. Nothing in the folder is deleted.`, 'Remove', { cancel: 'Keep it' });
    if (!yes) return;
    const rec = await record(d);
    if (rec) await DR.driveForget(rec.id);
    await DR.refreshProviders();
  };

  /** The browser asks for access again. Needs the press that called this. */
  DR.providerAllow = async function (d) {
    const p = await DR.dirAllow(d.handle);
    if (p !== 'granted') return window.SlopUI.alert('Access not granted', `The browser did not allow access to “${d.label}”. Press “Allow access” again, or remove it and add the folder again.`);
    await DR.refreshProviders();
  };
})(window.DR);
