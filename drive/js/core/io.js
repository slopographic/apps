/* Slop Drive — core/io: upload from the computer (files and whole folders), download (files, or folders
 * and selections as a .zip), and "Open with…" any Slopographic app that accepts the type. */
'use strict';
(function (DR) {
  const S = DR.S, H = () => window.SlopHub;

  /** Import [{ file, path: 'a/b/c.png' }] into folder dest, creating subfolders from the paths. */
  DR.importFiles = async function (list, dest = S.section === 'folder' ? S.cwd : null) {
    if (!list.length) return [];
    const made = new Map(), ids = [];
    async function folderFor(parts) {
      let parent = dest, key = '';
      for (const p of parts) {
        key += '/' + p;
        if (!made.has(key)) {
          const existing = [...S.folders.values()].find((f) => f.parent === parent && !f.trashedAt && f.name === p);
          let id = existing && existing.id;
          if (!id) { id = await H().createFolder(p, parent); S.folders.set(id, { id, name: p, parent, isFolder: true }); }
          made.set(key, id);
        }
        parent = made.get(key);
      }
      return parent;
    }
    DR.status && DR.status(`Uploading ${list.length} file${list.length === 1 ? '' : 's'}…`);
    for (const { file, path } of list) {
      const parts = (path || file.name).split('/').filter(Boolean);
      const name = parts.pop() || file.name, folder = await folderFor(parts);
      const type = DR.guessType(name, file.type);
      const blob = file.type === type ? file : new Blob([file], { type });
      const id = await H().put(blob, { name: DR.uniqueName(folder, name, false), from: 'upload', folderId: folder, meta: { lastModified: file.lastModified } });
      S.files.set(id, { id, name, parent: folder, isFolder: false });
      ids.push('f:' + id);
    }
    await DR.done(`Uploaded ${list.length} file${list.length === 1 ? '' : 's'}`);
    if (DR.select) DR.select(ids.filter((k) => DR.item(k) && DR.item(k).parent === (S.section === 'folder' ? S.cwd : null)));
    return ids;
  };
  DR.uploadPicker = async function (folders = false) {
    const i = DR.el('input', { type: 'file', multiple: true, style: 'position:fixed;left:-9999px' });
    if (folders) i.webkitdirectory = true;
    document.body.append(i);
    const files = await new Promise((res) => { i.addEventListener('change', () => res([...i.files]), { once: true }); i.click(); });
    i.remove();
    return DR.importFiles(files.map((f) => ({ file: f, path: f.webkitRelativePath || f.name })));
  };
  /** Read a drop: DataTransferItems may hold folders (webkitGetAsEntry). */
  DR.readDrop = async function (dt) {
    const out = [], entries = [...(dt.items || [])].map((it) => it.webkitGetAsEntry && it.webkitGetAsEntry()).filter(Boolean);
    if (!entries.length) return [...(dt.files || [])].map((f) => ({ file: f, path: f.name }));
    const fileOf = (e) => new Promise((res, rej) => e.file(res, rej));
    const readAll = (dir) => new Promise((res) => { const r = dir.createReader(), acc = []; const step = () => r.readEntries((b) => { if (!b.length) res(acc); else { acc.push(...b); step(); } }, () => res(acc)); step(); });
    async function walk(e, prefix) {
      if (e.isFile) { try { out.push({ file: await fileOf(e), path: prefix + e.name }); } catch (err) { /* unreadable */ } }
      else if (e.isDirectory) for (const c of await readAll(e)) await walk(c, prefix + e.name + '/');
    }
    for (const e of entries) await walk(e, '');
    return out;
  };

  /* ---------- download ---------- */
  DR.downloadFile = (r) => { window.SlopUI.download(r.blob, r.name); DR.touch(r); };
  /** Zip entries for a set of items (folders recurse; trashed children are skipped unless in the Trash view). */
  function zipEntries(items, prefix = '', out = []) {
    for (const it of items) {
      if (it.isFolder) {
        const { folders, files } = DR.children(it.id);
        out.push({ name: prefix + it.name + '/', data: null, time: it.modified });
        zipEntries([...folders, ...files], prefix + it.name + '/', out);
      } else out.push({ name: prefix + it.name, data: it.blob, time: it.modified });
    }
    return out;
  }
  DR.zipEntries = zipEntries;
  DR.download = async function (items) {
    if (!items.length) return;
    if (items.length === 1 && !items[0].isFolder) return DR.downloadFile(items[0]);
    DR.status && DR.status('Zipping…');
    const blob = await window.SlopZip.zip(zipEntries(items));
    window.SlopUI.download(blob, (items.length === 1 ? items[0].name : 'Slop Drive') + '.zip');
    DR.status && DR.status('');
  };

  /* ---------- open with ---------- */
  DR.appsFor = (r) => {
    if (!r || r.isFolder) return [];
    const own = DR.creatorOf ? DR.creatorOf(r) : null;
    const rest = window.SLOP_APPS.filter((a) => a.kind === 'app' && a.id !== 'drive' && a !== own && (a.accepts || []).some((p) => H().matches(r.type, p)));
    return own ? [own, ...rest] : rest;
  };
  DR.openWith = async function (r, appId) {
    if (!r || r.isFolder) return;
    const app = H().appById(appId);
    r.opened = Date.now();
    await H().update(r.id, { opened: r.opened }, { touch: false });
    await H().sendTo(appId, null, r.name, { id: r.id });
    DR.toast(`Opened in ${app ? app.name : appId}`);
  };
  /** Double-click / Enter: folders open, files open in their first app, or in Quick Look if no app takes them. */
  DR.open = function (it) {
    if (!it) return;
    if (it.isFolder) { if (it.trashedAt || DR.hidden(it)) return DR.toast('Restore the folder to open it'); return DR.go(it.id); }
    const apps = DR.appsFor(it);
    if (apps.length && !it.trashedAt) return DR.openWith(it, apps[0].id);
    DR.quickLook && DR.quickLook(it);
  };
})(window.DR);
