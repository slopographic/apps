/* SlopClean: the controller. Opens pictures through the one intake (shared/intake, spec 'clean': Open, a drop, a paste,
 * Slop Drive ?drive=<id>, a PWA launch), cleans them with the chosen
 * categories, and hands out the results: a download (one file, or a zip through the shared SlopZip), a copy saved to
 * Slop Drive, or (only for a picture opened from Drive, after a confirmation) a replaced original. Classic script. */
(function () {
  'use strict';
  const CL = (window.CL = window.CL || {});
  const UI = () => window.SlopUI, H = () => window.SlopHub;
  const $ = (id) => document.getElementById(id);
  const S = (CL.state = { items: [], remove: window.SlopClean.resolve({}) });
  let timer = 0;

  /** Read and add pictures, then clean them with the current choices. */
  async function addFiles(files, extra = {}) {
    const list = [...files].filter(Boolean);
    if (!list.length) return;
    for (const f of list) S.items.push(await CL.io.load(f, f.name, extra));
    await runClean();
  }
  async function runClean() {
    for (const it of S.items) await CL.io.clean(it, S.remove);
    render();
  }
  /** Choices changed: clean again after a short pause, so a run of clicks does one pass. */
  function changed() { clearTimeout(timer); timer = setTimeout(runClean, 120); render(); }

  function removeAll() {
    S.remove = window.SlopClean.resolve({});
    runClean();
  }
  function forget(item) {
    if (item.thumb) URL.revokeObjectURL(item.thumb);
    S.items = S.items.filter((x) => x !== item);
    render();
  }
  const blobOf = (item) => new Blob([item.out.bytes], { type: item.out.mime });

  function download(item) { UI().download(blobOf(item), CL.io.copyName(item.name)); }
  async function downloadAll() {
    const ready = S.items.filter((x) => x.out);
    if (!ready.length) return UI().toast('Nothing cleaned yet');
    if (ready.length === 1) return download(ready[0]);
    UI().toast('Zipping…');
    const zip = await window.SlopZip.zip(ready.map((x) => ({ name: CL.io.copyName(x.name), data: blobOf(x), time: Date.now() })));
    UI().download(zip, 'slop-clean.zip');
  }
  /** Copies only: each cleaned picture is written as a new Drive file in the folder the person picks. */
  async function saveAll(only) {
    const ready = (only ? [only] : S.items).filter((x) => x.out);
    if (!ready.length) return UI().toast('Nothing cleaned yet');
    const folderId = await H().pickFolder({ title: 'Save cleaned copies to Slop Drive', start: await H().appFolderId('clean') });
    if (folderId === undefined) return;
    for (const it of ready) await H().put(blobOf(it), { name: CL.io.copyName(it.name), from: 'clean', folderId });
    UI().toast(ready.length === 1 ? 'Saved a copy to Slop Drive' : `Saved ${ready.length} copies to Slop Drive`);
  }
  /** Overwrites the Drive file this picture was opened from. Asks first, and says it cannot be undone. */
  async function replace(item) {
    if (!item.driveId || !item.out) return;
    const ok = await UI().confirm('Replace the original in Slop Drive?',
      `“${item.name}” will be overwritten with the cleaned picture. The metadata is gone from that file for good. Cancel to keep the original.`,
      'Replace original', { danger: true });
    if (!ok) return;
    await H().update(item.driveId, { blob: blobOf(item), type: item.out.mime });
    item.blob = blobOf(item); item.bytes = item.out.bytes;
    item.findings = window.SlopClean.inspect(item.bytes).findings; item.size = item.bytes.length; item.out = null;
    UI().toast('Replaced the original in Slop Drive');
    render();
  }

  function render() {
    const found = S.items.reduce((n, it) => n + it.findings.length, 0);
    const gone = S.items.reduce((n, it) => n + (it.out ? it.findings.length - it.out.after.length : 0), 0);
    $('cl-stat').textContent = S.items.length
      ? `${S.items.length} picture${S.items.length === 1 ? '' : 's'} · ${found} item${found === 1 ? '' : 's'} found · ${gone} removed`
      : '';
    $('cl-all').disabled = !S.items.some((x) => x.out);
    $('cl-save-all').disabled = $('cl-all').disabled;
    CL.report.render(S, { view: CL.report.view, download, save: (it) => saveAll(it), replace, close: forget });
    CL.choices.render(S, changed);
    if (window.SlopGuard && SlopGuard.setUnsaved) SlopGuard.setUnsaved('clean', S.items.some((x) => x.out));
  }

  /** The one way in: every source reaches addFiles (a picture from Slop Drive keeps its record: Replace original). */
  function registerIntake() {
    window.SlopIntake.register({
      id: 'clean', accept: { types: ['image/*'], exts: ['.jpg', '.jpeg', '.png', '.webp', '.tif', '.tiff'], noun: 'a picture' },
      processAll: async (files, ctx) => {
        for (const f of files) S.items.push(await CL.io.load(f, f.name, f.slopDrive ? { driveId: f.slopDrive.id } : {}));
        await runClean();
        return files.map((f) => f.name);
      },
    });
    window.SlopIntake.dropTarget(document.body, { to: 'clean' });
  }
  const openPicker = () => window.SlopIntake.pick({ to: 'clean', accept: CL.io.ACCEPT });

  function wire() {
    $('cl-open').addEventListener('click', openPicker);
    $('cl-open-empty').addEventListener('click', openPicker);
    $('cl-remove-all').addEventListener('click', removeAll);
    $('cl-all').addEventListener('click', downloadAll);
    $('cl-save-all').addEventListener('click', () => saveAll());
    if (window.SlopCmd && SlopCmd.register) SlopCmd.register([
      { id: 'cl.open', title: 'Open pictures…', group: 'File', keys: ['Mod+O'], run: openPicker, keywords: ['add', 'import', 'photo'] },
      { id: 'cl.download', title: 'Download cleaned pictures', group: 'File', keys: ['Mod+S'], run: downloadAll, keywords: ['zip', 'save'] },
      { id: 'cl.remove-all', title: 'Remove all metadata (default choices)', group: 'Edit', keys: ['Shift+Mod+R'], run: removeAll, keywords: ['strip', 'clean'] },
    ]);
  }

  async function boot() {
    registerIntake();
    wire();
    render();
    await window.SlopIntake.launch({ to: 'clean' });
  }
  document.addEventListener('DOMContentLoaded', boot);
  CL.app = { addFiles, runClean, render, state: S };
})();
