/* SlopBackup: the small helper any Slopographic page can include (or load lazily) to back up and restore
 * everything this site keeps in the browser. It loads the real work (zip.js, codec.js, core.js, ui.js)
 * on first use. Classic script, exposes window.SlopBackup:
 *   SlopBackup.exportNow()            build slopographic-backup-YYYY-MM-DD.slop and download it
 *   SlopBackup.importFile(file, opts) restore a backup ({ mode: 'merge' | 'replace' })
 *   SlopBackup.openDialog()           the Backup & restore dialog (export, import with merge/replace)
 *   SlopBackup.kit()                  resolves with the SlopUI dialog kit, loading it if the page lacks it */
(function () {
  'use strict';
  if (window.SlopBackup) return;
  const me = document.currentScript && document.currentScript.src;
  const ROOT = me ? new URL('../../', me).href : new URL('/', location.href).href;
  const jobs = new Map();
  function load(rel) {
    if (!jobs.has(rel)) jobs.set(rel, new Promise((res, rej) => {
      const s = document.createElement('script'); s.src = new URL(rel, ROOT).href;
      s.onload = res; s.onerror = () => { jobs.delete(rel); rej(new Error('Could not load ' + rel)); };
      document.head.append(s);
    }));
    return jobs.get(rel);
  }
  let kitP = null;
  /** The SlopUI kit. Some pages own a different window.SlopUI (the homepage), so load the kit beside it. */
  function kit() {
    if (window.SlopUI && window.SlopUI.dialog) return Promise.resolve(window.SlopUI);
    if (!kitP) kitP = (async () => {
      if (!document.querySelector('link[href*="slopui.css"]')) {
        const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = new URL('shared/slopui.css', ROOT).href; document.head.append(l);
        await new Promise((r) => { l.onload = r; l.onerror = r; });
      }
      const prev = window.SlopUI;
      window.SlopUI = undefined;
      let k;
      try { await load('shared/slopui.js'); } finally { k = window.SlopUI; if (prev) window.SlopUI = prev; }
      return k;
    })();
    return kitP;
  }
  async function ready() {
    await Promise.all(['shared/backup/zip.js', 'shared/backup/codec.js', 'shared/backup/core.js'].map(load));
    return window.SlopBackupCore;
  }
  async function exportNow({ onProgress } = {}) {
    const core = await ready(), ui = await kit();
    const { blob, name, manifest } = await core.exportAll({ onProgress });
    ui.download(blob, name);
    try { localStorage.setItem('slop-backup-last', String(Date.now())); } catch (e) { /* storage blocked */ }
    return { name, size: blob.size, manifest };
  }
  async function importFile(file, opts) { const core = await ready(); return core.importBackup(file, opts); }
  async function openDialog(opts) { await ready(); const ui = await kit(); await load('shared/backup/ui.js'); return window.SlopBackupUI.open(ui, opts); }
  function lastExport() { try { return +localStorage.getItem('slop-backup-last') || 0; } catch (e) { return 0; } }
  window.SlopBackup = { exportNow, importFile, openDialog, kit, ready, load, lastExport, ROOT };
})();
