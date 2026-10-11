/* Slop 3D files: open, import, save to Slop Drive, download, OBJ export and PNG render. Everything stays in the
 * browser: files are read with FileReader and written as Blobs, and Slop Drive (SlopHub) is the only store.
 * Opening a .s3d replaces the scene; importing an OBJ, GLB, glTF or image adds to it. Sets window.Slop3D.files. */
(function () {
  'use strict';
  const S = (window.Slop3D = window.Slop3D || {});
  const M = S.model, A = S.actions, st = S.state, s = st.s;
  const ACCEPT_UI = '.s3d,.json,.obj,.glb,.gltf,image/*,model/gltf-binary,model/obj';
  const ACCEPT_DRIVE = ['application/x-slop-3d', 'model/gltf-binary', 'model/obj', 'model/gltf+json', 'image/*', 'text/plain', 'application/octet-stream', 'application/json'];
  const MAX_IMAGE = 8 * 1024 * 1024;
  const toast = (msg) => { if (window.SlopUI) SlopUI.toast(msg); };
  const hub = () => window.SlopHub || null;
  const guard = () => { if (window.SlopGuard) SlopGuard.setUnsaved('3d', s.file.dirty); };
  const baseName = (n) => (String(n || 'Untitled').replace(/\.[^.]+$/, '') || 'Untitled');
  const extOf = (n) => (String(n || '').split('.').pop() || '').toLowerCase();

  function confirmDiscard() {
    return s.file.dirty && s.doc.roots.length
      ? SlopUI.confirm('Discard changes?', 'This scene has changes that are not saved to Slop Drive. Continue anyway?', 'Continue', { danger: true })
      : Promise.resolve(true);
  }
  /** Replaces the whole document (new scene or opened file). */
  function replaceScene(doc, file) {
    s.doc = doc;
    s.sel = [];
    s.history.reset(doc);
    s.file = Object.assign({ name: 'Untitled', driveId: null, folderId: null, dirty: false }, file);
    st.emit('doc', null);
    st.emit('sel');
    st.emit('file');
    guard();
  }
  async function newScene() {
    if (!(await confirmDiscard())) return;
    replaceScene(M.defaultScene('Untitled'), {});
  }

  /** Reads a File or a Drive record's blob: text for .s3d/.obj/.gltf, ArrayBuffer for .glb, data URL for images. */
  const readText = (blob) => blob.text();
  const readBuffer = (blob) => blob.arrayBuffer();
  const readDataUrl = (blob) => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = () => rej(new Error('could not read the image')); r.readAsDataURL(blob); });

  /** Imports an image as a standing plane textured with the picture (the picture is stored inside the file). */
  async function imageTree(blob, name) {
    if (blob.size > MAX_IMAGE) throw new Error('This image is larger than 8 MB');
    const url = await readDataUrl(blob);
    const dims = await new Promise((res, rej) => { const im = new Image(); im.onload = () => res([im.naturalWidth || 1, im.naturalHeight || 1]); im.onerror = () => rej(new Error('This image cannot be read')); im.src = url; });
    const aspect = dims[0] / dims[1], w = Math.min(4, Math.max(0.2, aspect));
    return { type: 'mesh', name, transform: { r: [90, 0, 0] }, geom: { kind: 'plane', width: w, depth: 1 },
      material: { color: '#ffffff', roughness: 0.9, metallic: 0, opacity: 1, map: url } };
  }
  /** Turns any supported blob into an import tree (with warnings). Throws for unknown or broken files. */
  async function treeFor(blob, name) {
    const ext = extOf(name), base = baseName(name);
    if (ext === 'obj') return { tree: S.obj.parse(await readText(blob), base), warnings: [] };
    if (ext === 'glb' || ext === 'gltf') {
      const input = ext === 'glb' ? await readBuffer(blob) : await readText(blob);
      const r = S.glb.importGltf(input);
      r.tree.name = base;
      return r;
    }
    if (blob.type.startsWith('image/') || /^(png|jpe?g|gif|webp|bmp)$/.test(ext)) return { tree: await imageTree(blob, base), warnings: [] };
    throw new Error('Slop 3D cannot open this kind of file');
  }

  /** Opens a file: a .s3d replaces the scene, a model or image goes into a new scene. */
  async function openBlob(blob, name, extra = {}) {
    const ext = extOf(name);
    try {
      if (ext === 's3d' || ext === 'json' || blob.type === S.format.MIME) {
        const r = S.format.parse(await readText(blob));
        if (!r.ok) { SlopUI.alert('Could not open that file', 'It is not a valid Slop 3D scene:\n' + r.errors.join('\n')); return false; }
        replaceScene(r.scene, { name: baseName(name), driveId: extra.driveId || null, folderId: extra.folderId ?? null, dirty: false });
        return true;
      }
      const { tree, warnings } = await treeFor(blob, name);
      replaceScene(M.defaultScene(baseName(name)), { name: baseName(name), dirty: true });
      A.importTree(tree);
      if (warnings.length) toast(warnings[0]);
      return true;
    } catch (e) { SlopUI.alert('Could not open that file', e.message || String(e)); return false; }
  }
  /** Adds a model or image to the current scene (File > Import). */
  async function importBlob(blob, name) {
    try {
      const { tree, warnings } = await treeFor(blob, name);
      A.importTree(tree);
      toast(warnings.length ? warnings[0] : 'Imported ' + baseName(name));
      return true;
    } catch (e) { SlopUI.alert('Could not import that file', e.message || String(e)); return false; }
  }
  async function openDialog() {
    if (!(await confirmDiscard())) return;
    const [f] = await SlopUI.pickFiles({ accept: ACCEPT_UI });
    if (f) await openBlob(f, f.name);
  }
  async function importDialog() {
    const [f] = await SlopUI.pickFiles({ accept: ACCEPT_UI });
    if (f) await importBlob(f, f.name);
  }
  async function openFromDrive() {
    const h = hub();
    if (!h) { toast('Slop Drive is not available'); return; }
    const rec = await h.pickFromDrive({ accept: ACCEPT_DRIVE });
    if (!rec || !rec.blob) return;
    if (!(await confirmDiscard())) return;
    const scene = extOf(rec.name) === 's3d';
    if (scene) await openBlob(rec.blob, rec.name, { driveId: rec.id, folderId: rec.folderId });
    else await openBlob(rec.blob, rec.name);
  }
  /** Opens the record that launched this page with ?drive=<id>. */
  async function launch() {
    const h = hub();
    if (!h || !h.consumeLaunch) return;
    const rec = await h.consumeLaunch();
    if (rec && rec.blob) await openBlob(rec.blob, rec.name, { driveId: rec.id, folderId: rec.folderId });
  }

  const sceneName = () => s.file.name || 'Untitled';
  function sceneBlob() { return new Blob([S.format.serialize(s.doc)], { type: S.format.MIME }); }
  function download(blob, name) { if (window.SlopUI) SlopUI.download(blob, name); }
  /** Saves to Slop Drive: updates the linked record, or asks for a folder the first time. */
  async function save() {
    const h = hub(), blob = sceneBlob(), name = sceneName() + '.s3d';
    if (!h) { download(blob, name); return; }
    try {
      if (s.file.driveId && (await h.get(s.file.driveId))) await h.update(s.file.driveId, { blob, name, type: S.format.MIME });
      else { const id = await h.saveToDrive(blob, name, { from: '3d' }); if (!id) return; s.file.driveId = id; }
      s.file.dirty = false;
      st.emit('file');
      guard();
      toast('Saved to Slop Drive');
    } catch (e) { toast('Could not save: ' + (e.message || e)); }
  }
  function downloadScene() { download(sceneBlob(), sceneName() + '.s3d'); s.file.dirty = false; st.emit('file'); guard(); }
  function exportObj() {
    if (!s.doc.roots.length) { toast('Nothing to export yet'); return; }
    download(new Blob([S.obj.write(s.doc)], { type: 'model/obj' }), sceneName() + '.obj');
  }
  let stageRef = null;
  /** Renders the viewport to PNG at 1× or 2× the on-screen size. */
  async function exportPng(scale) {
    if (!stageRef) return;
    try { download(await stageRef.capture(scale), `${sceneName()}-${scale}x.png`); toast('Picture saved'); }
    catch (e) { toast(e.message || 'Could not render'); }
  }

  S.files = { newScene, openDialog, importDialog, openFromDrive, launch, save, downloadScene, exportObj, exportPng,
    bindStage(stage) { stageRef = stage; }, openBlob, importBlob, replaceScene, sceneBlob, ACCEPT_UI, confirmDiscard };
})();
