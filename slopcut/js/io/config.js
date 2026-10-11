/* SlopCut: the config kind 'project' (app slopedit) in the shared format (shared/config, HANDOFF.md there). Export writes
   the sequence, markers and tracks with their clips (io/config-map.js holds the data). Import replaces the timeline in one
   undo step. Media is never in the file: a file the bin does not hold becomes a 'missing' record, and the person is asked
   to add it; a file added later with the same name fills that record (library.js). Also the Config menu and palette
   commands. Loaded after ui/commands.js and io/config-map.js. */
(function () {
  'use strict';
  const SE = window.SE, U = SE.util, L = SE.media, CM = SE.configMap, C = window.SlopConfig, D = window.SlopConfigDialog;
  const APP = 'slopedit';
  const MB = (n) => (n >= 1e6 ? (n / 1e6).toFixed(1) + ' MB' : Math.max(1, Math.round(n / 1e3)) + ' KB');

  /** Finds the bin record for a file name (or makes a missing one). Returns the id. */
  function resolver(p, created) {
    const byName = new Map();
    return (file, kind) => {
      if (byName.has(file.name)) return byName.get(file.name);
      const found = p.media.find((m) => m.name === file.name);
      if (found) { byName.set(file.name, found.id); return found.id; }
      const meta = { id: U.uid('m'), name: file.name, kind, type: '', size: file.size, dur: NaN, w: 0, h: 0, hasAudio: kind === 'audio', from: 'config' };
      created.push(meta);
      byName.set(file.name, meta.id);
      return meta.id;
    };
  }

  /** Asks the person to add the media the import lists as missing. Nothing is blocked: the timeline is already in place. */
  function askForMedia(missing) {
    if (!missing.length || !window.SlopUI) return;
    const list = SlopUI.el('ul', { class: 'sui-errors' }, missing.map((m) => SlopUI.el('li', null, `${m.name} (${MB(m.size || 0)})`)));
    SlopUI.dialog({
      title: 'Add the media for this config',
      body: SlopUI.el('div', null,
        SlopUI.el('p', { class: 'sui-p' }, 'The timeline is in place. These files are not in the bin yet. Add them; each one is matched by its name:'),
        list),
      buttons: [{ label: 'Later' }, { label: 'Add files…', primary: true, act: () => { SE.app.openDialog(); } }],
    });
  }

  /** Apply: the checked data replaces the sequence in one undo step. */
  async function apply(d) {
    const p = SE.doc, created = [];
    const parts = CM.fromData(d, resolver(p, created));
    for (const m of created) L.addMissing(m);
    const used = new Set();
    for (const t of parts.tracks) void t;
    SE.change('Import config', (doc) => {
      Object.assign(doc, { w: parts.w, h: parts.h, fps: parts.fps, tracks: parts.tracks, clips: parts.clips, markers: parts.markers });
      for (const m of created) doc.media.push(m);
      for (const c of parts.clips) if (c.media) used.add(c.media);
    });
    SE.app.select([]);
    // every file the timeline uses that is not ready yet: listed so the person can add it
    const missing = SE.doc.media.filter((m) => used.has(m.id) && (!L.get(m.id) || L.get(m.id).status !== 'ready'));
    askForMedia(missing);
  }

  /** Export: the project as data. Titles and random effect layers are left out (the format has no kind for them yet). */
  let lastSkipped = 0;
  C.registerKind('project', APP, CM.SCHEMA, apply, {
    label: 'Project', description: 'Frame size, markers, and tracks with their clips (media by name and size)',
    check: CM.check,
    read: () => { const r = CM.toData(SE.doc); lastSkipped = r.skipped; return r.data; },
  });

  /** Commands for the palette and the Config menu. */
  const cmds = D.commands({ app: APP, prefix: 'slopedit' });
  if (SE.cmd && SE.cmd.add) SE.cmd.add(cmds);
  if (window.SlopConfigDialog) D.bindDrop({ app: APP });

  /** The Config submenu of File. */
  SE.config = {
    menu: () => cmds.map((c) => SE.cmd.item(c.id)),
    skippedOnExport: () => lastSkipped,
  };
})();
