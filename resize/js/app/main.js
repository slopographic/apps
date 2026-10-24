/* Slop Resize: the controller. Opens pictures and videos (button, drop, Slop Drive picker, or ?drive=<id> from another
 * app), runs the queue with the panel's settings, and hands out the results: a download (one file, or a zip of them all),
 * or a copy saved to Slop Drive. Originals are never changed. Classic script. */
(function () {
  'use strict';
  const NS = window.SlopResize, $ = (id) => document.getElementById(id);
  const toast = (m) => { if (window.SlopUI) window.SlopUI.toast(m); };
  const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

  function render() {
    const items = NS.queue.items(), busy = NS.queue.busy();
    $('rs-empty').hidden = items.length > 0;
    $('rs-queue-wrap').hidden = items.length === 0;
    NS.list.render($('rs-list'), items, actions);
    const ref = items.find((i) => i.src);
    NS.settings.setSource(ref ? ref.src : null, ref ? ref.name : '');
    const ready = items.some((i) => i.src), done = items.filter((i) => i.status === 'done');
    $('rs-run').disabled = busy || !ready;
    $('rs-cancel').disabled = !busy;
    $('rs-zip').disabled = busy || !done.length;
    $('rs-save-all').disabled = busy || !done.some((i) => !i.drive);
    $('rs-clear').disabled = busy || !items.length;
    $('rs-stat').textContent = NS.list.summary(items);
  }

  async function addFiles(files) {
    let skipped = 0;
    for (const f of [...files]) {
      if (!NS.format.kind(f)) { skipped++; continue; }
      await NS.queue.add(f);
    }
    if (skipped) toast(plural(skipped, 'file skipped: it is not a picture or a video', 'files skipped: they are not pictures or videos'));
  }

  async function addDriveRecord(rec) {
    if (!rec || !rec.blob) { toast('That Drive file has no content'); return; }
    const file = new File([rec.blob], rec.name || 'Untitled', { type: rec.type || rec.blob.type || '' });
    if (window.SlopHub) window.SlopHub.touch(rec.id);
    await NS.queue.add(file, { name: rec.name });
  }

  async function openPicker() {
    const files = await window.SlopUI.pickFiles({ accept: 'image/*,video/*' + (window.SlopRaw ? ',' + window.SlopRaw.ACCEPT : ''), multiple: true });
    await addFiles(files);
  }

  async function openDrive() {
    if (!NS.drive.available()) { toast('Slop Drive is not available on this page'); return; }
    await addDriveRecord(await NS.drive.pick());
  }

  async function run() {
    if (!NS.queue.items().some((i) => i.src)) return;
    const opt = NS.settings.toRun(NS.settings.read());
    await NS.queue.run(opt);
    const items = NS.queue.items(), done = items.filter((i) => i.status === 'done').length;
    const failed = items.filter((i) => i.status === 'error' && i.src).length;
    toast(failed ? `${plural(done, 'file', 'files')} resized, ${failed} failed` : `${plural(done, 'file', 'files')} resized`);
  }

  /** A name that is not already in the zip: "x-500x500.jpg", then "x-500x500 (2).jpg". */
  function uniqueNames(items) {
    const seen = new Map();
    return items.map((it) => {
      const n = it.outName, c = seen.get(n) || 0;
      seen.set(n, c + 1);
      return c ? n.replace(/(\.[^.]+)$/, ` (${c + 1})$1`) : n;
    });
  }

  async function downloadAll() {
    const done = NS.queue.items().filter((i) => i.status === 'done');
    if (!done.length) { toast('Nothing to download yet'); return; }
    if (done.length === 1) { download(done[0]); return; }
    const names = uniqueNames(done);
    const zip = await window.SlopZip.zip(done.map((it, i) => ({ name: names[i], data: it.out.blob })));
    window.SlopUI.download(zip, `slop-resize-${new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-')}.zip`);
    SlopSupport.afterExport('resize');
  }

  function download(it) {
    if (it.out) { window.SlopUI.download(it.out.blob, it.outName); SlopSupport.afterExport('resize'); }
  }

  async function saveTo(items) {
    if (!NS.drive.available()) { toast('Slop Drive is not available on this page'); return; }
    let n = 0;
    for (const it of items) {
      try { it.drive = await NS.drive.save(it.out.blob, it.outName, { source: it.name }); n++; }
      catch (e) { toast('Could not save to Slop Drive: ' + ((e && e.message) || 'unknown error')); break; }
    }
    render();
    if (n) toast(`Saved ${plural(n, 'result', 'results')} to the Slop Resize folder in Slop Drive`);
  }

  /** Sends a row to Slop Upscale: the result when it is done, else the original. Opens Upscale in a new tab. */
  async function sendToUpscale(it) {
    if (!window.SlopHub) { toast('Slop Drive is not available on this page'); return; }
    const done = it.status === 'done' && it.out;
    try { await window.SlopHub.sendTo('upscale', done ? it.out.blob : it.file, done && it.outName ? it.outName : it.name); }
    catch (e) { toast('Could not send to Slop Upscale: ' + e.message); }
  }

  const actions = {
    download,
    save: (it) => saveTo([it]),
    upscale: sendToUpscale,
    remove: (it) => NS.queue.remove(it.id),
  };

  /** Commands for SlopCmd and the keyboard. */
  const api = {
    open: openPicker, drive: openDrive, run, cancel: () => NS.queue.cancel(), downloadAll, saveAll: () => saveTo(NS.queue.items().filter((i) => i.status === 'done' && !i.drive)),
    clear: () => NS.queue.clear(), render, toast, actions,
  };

  function fillSizePresets() {
    const sel = $('rs-preset'), groups = new Map();
    sel.replaceChildren(new Option('Custom size', ''));
    for (const p of NS.size.PRESETS) {
      if (!groups.has(p.group)) { const og = document.createElement('optgroup'); og.label = p.group; groups.set(p.group, og); sel.append(og); }
      groups.get(p.group).append(new Option(p.label, p.id));
    }
    sel.addEventListener('change', () => {
      const p = NS.size.presetById(sel.value);
      if (p) NS.settings.write(Object.assign(NS.settings.read(), NS.size.applyPreset(p)));
    });
  }

  /** Disable the choices this browser cannot make, and say why. */
  async function checkEngines() {
    const [mimes, sup] = await Promise.all([NS.format.imageSupport(), NS.video.support()]);
    for (const opt of $('rs-mime').options) opt.disabled = !mimes.has(opt.value);
    if (!mimes.has($('rs-mime').value)) $('rs-mime').value = 'image/jpeg';
    NS.settings.alphaUI();
    for (const opt of $('rs-vformat').options) opt.disabled = !sup.formats[opt.value];
    const vf = $('rs-vformat');
    if (!sup.formats[vf.value]) vf.value = sup.formats.webm ? 'webm' : 'mp4';
    const off = !sup.ok;
    for (const id of ['rs-vformat', 'rs-vquality', 'rs-fps', 'rs-audio']) $(id).disabled = off;
    const note = $('rs-engine-note');
    note.hidden = sup.ok && sup.formats.mp4 && sup.formats.webm;
    note.textContent = off ? `${sup.reason} Images still work.` : `${sup.formats.mp4 ? 'WebM' : 'MP4'} is not available in this browser, so ${sup.formats.mp4 ? 'MP4' : 'WebM'} is the only video format.`;
    $('rs-video-warning').hidden = !off;
    if (off) $('rs-video-warning').textContent = `Video is not available here. ${sup.reason} Images only.`;
  }

  // Drops (on the left column, or the zone) go through SlopDrop (shared/drop): each file is checked, read by the queue
  // as before, and reported with its progress. A file the queue cannot read shows its error in the zone. The zone is the
  // empty state's only drop area; once files are queued, the whole column still takes drops.
  const DROP_RULES = {
    types: ['image/*', 'video/*'],
    exts: ['.jpg', '.jpeg', '.png', '.webp', '.avif', '.gif', '.bmp', '.tif', '.tiff', '.mp4', '.m4v', '.mov', '.webm', '.mkv', '.ogv', ...(window.SlopRaw ? window.SlopRaw.EXTS.map((e) => '.' + e) : [])],
    noun: 'a picture or a video',
  };
  function wireDrop() {
    SlopDrop.attach($('rs-drop'), {
      accept: DROP_RULES,
      label: 'Drop pictures or videos here',
      hint: 'JPEG, PNG, WebP, AVIF, GIF and camera RAW pictures, and MP4, WebM or MOV video. Many at once. Each file is read and resized in this browser and never uploaded.',
      targets: [$('rs-left')],
      preview: { picture: { src: '../assets/shots/resize.jpg', alt: 'Photos resized from 2400 × 1600 to 1080 × 720, each with its old and new file size' },
        steps: ['Drop pictures or videos, many at once', 'Pick a size, a percentage or a file limit', 'Download the copies as a ZIP'] },
      sample: { label: 'Try it with 4 sample photos', files: () => window.SlopSamples.photos(4, { width: 2400, height: 1600 }) },
      process: async (file) => {
        const it = await NS.queue.add(file);
        if (it.status === 'error') throw new Error(it.err);
        return it.id;
      },
      reveal: () => $('rs-list').lastElementChild,
    });
  }

  function wirePanel() {
    const panel = $('rs-panel');
    panel.addEventListener('change', () => { NS.settings.showModes($('rs-mode').value); NS.settings.labels(); NS.settings.alphaUI(); });
    panel.addEventListener('input', () => NS.settings.labels());
    $('rs-open').addEventListener('click', () => api.open());
    $('rs-drive').addEventListener('click', () => api.drive());
    $('rs-run').addEventListener('click', () => run());
    $('rs-cancel').addEventListener('click', () => api.cancel());
    $('rs-zip').addEventListener('click', () => downloadAll());
    $('rs-save-all').addEventListener('click', () => api.saveAll());
    $('rs-clear').addEventListener('click', () => api.clear());
  }

  async function boot() {
    if (window.SlopHub) window.SlopHub.register('resize');
    fillSizePresets();
    NS.settings.write(Object.assign(NS.settings.fromSaved(NS.settings.DEFAULTS), NS.settings.presetOf(location.search)));
    NS.presets.bind({ select: $('rs-saved'), apply: $('rs-apply'), saveAs: $('rs-save-as'), del: $('rs-delete'), status: toast });
    wirePanel();
    NS.settings.wireLock();
    wireDrop();
    NS.queue.on(render);
    render();
    checkEngines();
    if (window.SlopCmd) { SlopCmd.init({ app: 'resize' }); NS.commands.install(api); }
    if (NS.drive.available()) {
      const rec = await window.SlopHub.consumeLaunch();
      if (rec) await addDriveRecord(rec);
    }
  }

  NS.app = api;
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
