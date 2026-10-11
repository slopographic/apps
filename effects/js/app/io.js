// Slop Effects files: a new project, Slop Drive (save and open a project file, kind 'effects', and add media from Drive),
// media from this computer (and relinking a missing one), and the 'effects-project' config kind through shared/config.
// A project references media by name, size and Drive id; the files stay in the media bin. Opening a project reports the
// media it lists that is not in this session, so the person can relink it. Classic script: window.SlopEffects.io.
(function (g) {
  'use strict';
  const ns = (g.SlopEffects = g.SlopEffects || {});
  const P = () => ns.project;
  const M = () => ns.media;
  const DEFAULT_COMP = { width: 1920, height: 1080, fps: 30, duration: 5, background: '#000000' };
  const MEDIA_ACCEPT = 'image/*,video/*';
  const fileName = (doc) => `${String(doc.name || 'Untitled').replace(/[\\/:*?"<>|]+/g, '-').trim() || 'Untitled'}.effects.json`;

  /** Builds the io actions. S, act, ka, ui: the state, the actions, the key actions, and { toast, dialog }. */
  function create(S, act, ui) {
    const toast = (m) => { if (g.SlopUI) g.SlopUI.toast(m); else ui.toast && ui.toast(m); };
    const UI = () => g.SlopUI;

    /** Kind for a picked file or Drive record, or null with a message. */
    function kindFor(type, name) {
      const k = M().kindOf(type);
      if (!k) toast(`${name || 'That file'} is not an image or video`);
      return k;
    }

    async function importFromComputer() {
      const files = await UI().pickFiles({ accept: MEDIA_ACCEPT, multiple: true });
      for (const f of files) {
        const kind = kindFor(f.type, f.name);
        if (!kind) continue;
        try {
          const entry = await M().add({ id: act.nextMediaId(), name: f.name, size: f.size, kind }, f);
          act.addMediaLayer(entry);
        } catch (e) { toast(`${f.name}: ${e.message}`); }
      }
    }

    async function importFromDrive() {
      const rec = await g.SlopHub.pickFromDrive({ accept: ['image/*', 'video/*'], title: 'Add an image or video from Slop Drive' });
      if (!rec) return;
      const full = await g.SlopHub.get(rec.id);
      if (!full || !full.blob) { toast('That file is not in Slop Drive any more'); return; }
      const kind = kindFor(full.type || full.blob.type, rec.name);
      if (!kind) return;
      try {
        const entry = await M().add({ id: act.nextMediaId(), name: rec.name, size: full.size, kind, driveId: rec.id }, full.blob);
        act.addMediaLayer(entry);
      } catch (e) { toast(e.message); }
    }

    /** Relinks a missing media id to a file from this computer (the layers keep their id). */
    async function relink(mediaId) {
      const [f] = await UI().pickFiles({ accept: MEDIA_ACCEPT });
      if (!f) return;
      const kind = kindFor(f.type, f.name);
      if (!kind) return;
      try {
        const entry = await M().add({ id: mediaId, name: f.name, size: f.size, kind }, f);
        S.edit('Relink media', (d) => ns.layers.addMedia(d, M().info(entry)));
        toast('Relinked ' + f.name);
      } catch (e) { toast(e.message); }
    }

    function newProject() {
      S.replace(ns.core.newDoc({ name: 'Untitled', comp: DEFAULT_COMP }), 'New project');
      S.setFile({ name: '', driveId: '' });
    }

    /**
     * Builds a document from project rows, pairing its media with the bin. A matched item takes the bin's id and record;
     * a missing one gets a fresh id (so it cannot point at another file) and is returned in missing.
     */
    function build(data) {
      const doc = P().fromData(data);
      const { map, missing } = M().match(data.media);
      let next = Math.max(0, ...M().list().map((e) => parseInt(String(e.id).replace(/\D/g, ''), 10) || 0), ...data.media.map((m) => parseInt(String(m.id).replace(/\D/g, ''), 10) || 0)) + 1;
      for (const rec of missing) map.set(rec.id, 'm' + next++);
      const fresh = new Map(missing.map((rec) => [rec.id, map.get(rec.id)]));
      doc.media = data.media.map((rec) => {
        const binId = map.get(rec.id);
        if (binId && !fresh.has(rec.id)) return M().info(M().get(binId));
        return { ...rec, id: binId };
      });
      doc.layers.forEach((l) => { if (l.source.mediaId && map.has(l.source.mediaId)) l.source.mediaId = map.get(l.source.mediaId); });
      return { doc, missing: missing.map((rec) => ({ ...rec, id: fresh.get(rec.id) })) };
    }

    /** Lists the media a project needs that is not in this session (its layers keep the slot; relink from the layer panel). */
    function reportMissing(missing) {
      if (!missing.length) return;
      const items = missing.map((m) => { const li = document.createElement('li'); li.textContent = `${m.name} (${m.kind})`; return li; });
      const list = document.createElement('ul');
      list.append(...items);
      const body = document.createElement('div');
      const p = document.createElement('p');
      p.textContent = 'These files are not in this session. Their layers stay in the project. Select a layer and choose Relink media to point it at the file:';
      body.append(p, list);
      UI().dialog({ title: 'Missing media', body, buttons: [{ label: 'OK', primary: true }] });
    }

    /** Opens rows from a file or a config. Replaces the document (one undo step). */
    function openRows(data, label, file) {
      const problems = P().problems(data);
      if (problems.length) { toast(`Cannot open: ${problems[0]}`); return false; }
      const { doc, missing } = build(data);
      S.replace(doc, label);
      S.setFile(file || { name: '', driveId: '' });
      toast(`Opened ${doc.name}`);
      reportMissing(missing);
      return true;
    }

    async function saveDrive() {
      const doc = S.doc;
      const blob = new Blob([P().toFile(doc)], { type: 'application/json' });
      const name = fileName(doc);
      const meta = { kind: 'effects' };
      if (S.file.driveId && (await g.SlopHub.get(S.file.driveId))) {
        await g.SlopHub.put(blob, { id: S.file.driveId, name, from: 'effects', app: 'effects', meta });
        S.setFile({ name: doc.name });
        toast('Saved to Slop Drive');
        return;
      }
      const start = await g.SlopHub.appFolderId('effects');
      const folderId = await g.SlopHub.pickFolder({ title: `Save “${name}” to Slop Drive`, start });
      if (folderId === undefined) return;
      const id = await g.SlopHub.put(blob, { name, from: 'effects', app: 'effects', meta, folderId });
      S.setFile({ name: doc.name, driveId: id });
      toast('Saved to Slop Drive');
    }

    async function openDrive() {
      const rec = await g.SlopHub.pickFromDrive({ accept: ['application/json'], title: 'Open a Slop Effects project' });
      if (!rec) return;
      const full = await g.SlopHub.get(rec.id);
      if (!full || !full.blob) { toast('That file is not in Slop Drive any more'); return; }
      let parsed;
      try { parsed = P().fromFile(await full.blob.text()); } catch (e) { toast(e.message); return; }
      const check = g.SlopConfig ? P().checkConfig(g.SlopConfig, parsed.data) : { ok: true, errors: [] };
      if (!check.ok) { toast(`Cannot open: ${check.errors[0] ? check.errors[0].path + ' ' + check.errors[0].message : 'the file is not valid'}`); return; }
      openRows(parsed.data, 'Open ' + parsed.name, { name: parsed.name, driveId: rec.id });
    }

    /** Registers the effects-project config kind (import and export through shared/config). */
    function registerConfig() {
      const C = g.SlopConfig;
      if (!C || !C.registerKind || C.getKind(P().KIND, P().APP)) return;
      C.registerKind(P().KIND, P().APP, P().kindSchema(C.F), async (data) => {
        const problems = P().problems(data);
        if (problems.length) return { ok: false, message: problems[0] };
        const { doc, missing } = build(data);
        S.replace(doc, 'Import config');
        reportMissing(missing);
        return { ok: true };
      }, {
        label: 'Slop Effects project',
        description: 'Layers, keyframes, effects and composition. Media is listed by name, not included.',
        read: async () => P().toData(S.doc),
      });
    }

    return { importFromComputer, importFromDrive, relink, newProject, saveDrive, openDrive, openRows, registerConfig, build, toast };
  }

  ns.io = { create, DEFAULT_COMP, fileName };
})(typeof window !== 'undefined' ? window : globalThis);
