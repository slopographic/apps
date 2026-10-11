/* SlopCut: autosave of the project to IndexedDB (media blobs are stored as they are imported),
   restore on start, new project, and Slop Hub launch (?drive=<id>). */
(function () {
  'use strict';
  const SE = window.SE, U = SE.util, M = SE.model;
  const S = SE.session = {};
  let restoring = false;

  S.enabled = () => U.store.get('autosave', true);
  S.save = async function () {
    if (!S.enabled() || restoring) return;
    try { await U.idb.set('project', { v: 1, time: Date.now(), playhead: SE.player ? SE.player.time : 0, doc: M.snapshot(SE.doc) }); SE.emit('saved', {}); }
    catch (e) { console.warn('SlopCut: autosave failed', e); }
  };
  const later = U.debounce(S.save, 700);
  SE.on('change', later);
  SE.on('autosave', later);
  SE.on('media-ready', later);
  addEventListener('pagehide', () => later.flush());

  /** Restore the autosaved project. Returns true when something was restored. */
  S.restore = async function () {
    if (!S.enabled()) return false;
    let rec = null;
    try { rec = await U.idb.get('project'); } catch (e) { return false; }
    if (!rec || !rec.doc) return false;
    restoring = true;
    try {
      SE.setDoc(rec.doc);
      await SE.media.restore(SE.doc.media);
      if (SE.player && rec.playhead) SE.player.seek(rec.playhead);
      SE.emit('change', { label: 'Restore', history: true });
    } catch (e) { console.warn('SlopCut: could not restore', e); return false; }
    finally { restoring = false; }
    return true;
  };
  /** Start over. Media blobs of the old project are deleted. */
  S.newProject = async function (ask = true) {
    if (ask && SE.doc.clips.length && !(await SlopUI.confirm('New project', 'Start a new project? The current one is replaced (save it first with File ▸ Save project if you want to keep it).', 'New project', { danger: true }))) return;
    if (SE.player) SE.player.pause();
    SE.media.clear();
    SE.setDoc(M.newProject());
    SE.project.driveId = null;
    if (SE.player) SE.player.seek(0);
    SE.app.select([]);
    await S.save();
  };
  SE.act.newProject = () => S.newProject(true);

  /** Opened from another app with ?drive=<id>: import that file. */
  S.launch = async function () {
    if (!window.SlopHub || SE.offline) return false;
    const rec = await SlopHub.consumeLaunch();
    if (!rec) return false;
    if (SE.reel && SE.reel.isManifest(rec)) return SE.reel.launch(rec); // a reel from Slop Gallery (io/reel.js)
    if (rec.meta && rec.meta.matteId) { await SE.cutout.receive({ id: rec.id, matteId: rec.meta.matteId, clipId: rec.meta.clipId || null, name: rec.name }); return true; } // a matte pair from SlopIsolate
    const f = new File([rec.blob], rec.name, { type: rec.type });
    if (/\.slopedit$/i.test(rec.name || '')) await SE.project.openFile(f, rec.id);
    else await SE.app.importFiles([f], { from: 'drive' });
    SlopUI.toast('Opened ' + rec.name + ' from Slop Drive');
    return true;
  };
})();
