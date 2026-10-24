/* SlopIsolate — getting images in. ONE way in: every route (the picker, the drop zone #isoDrop and the queue sidebar,
 * paste, the sample, Open from Slop Drive, a file another app sent with ?drive=) calls CO.files.take(files, opts), and one
 * image is simply a batch of one. take() is shaped like the suite's intake (accept rules → the first-use gate → process
 * each file → after the batch): accept = ACCEPT, gate = F.gate(), process = CO.process.add (the bounded model pool in
 * io/process.js, so every file of a batch is cut out at once, up to the pool size), after = the "not images" toast. */
(function () {
  'use strict';
  const CO = window.CO, U = CO.util;
  const F = CO.files = {};
  const S = () => CO.state;
  const toast = (msg) => { if (window.SlopUI) SlopUI.toast(msg); };

  /** The first-use notice: shown once, the first time files are given to the app. Only the chosen model downloads
   * (the others when they are first picked), so the notice names that one, with its size from the model registry. */
  F.notice = function () {
    const M = window.SlopCutoutModels, m = M.get(CO.state.model);
    return {
      title: 'Remove backgrounds on this device',
      lines: ['Slop Isolate removes the background from a picture with an AI model that runs in your browser.',
        'Another model is downloaded only if you choose it in the Model panel.'],
      downloads: [{ name: `${m.name} model (${m.arch.split(' (')[0]})`, bytes: m.bytes }],
    };
  };
  /** What the app takes: images and videos (SlopDrop's rule format; the drop zone and paste refuse the rest with a reason). */
  const ACCEPT = F.ACCEPT = {
    types: ['image/*', 'video/*'],
    exts: ['.jpg', '.jpeg', '.png', '.webp', '.avif', '.gif', '.bmp', '.tif', '.tiff', '.mp4', '.m4v', '.mov', '.webm'],
    noun: 'an image or a video',
  };
  F.accepts = (f) => U.isImage(f) || !!(CO.video && CO.video.isVideo(f));

  /** The first-use gate: one notice for a batch, whichever route it came by. Batches that arrive while it is open wait on
   *  the same notice. Cancelling asks again next time. Resolves true to carry on. */
  let gating = null;
  F.gate = function () {
    if (!window.SlopFirstRun) return Promise.resolve(true);
    if (!gating) gating = Promise.resolve(SlopFirstRun.once('slopisolate', F.notice())).finally(() => { gating = null; });
    return gating;
  };

  /** THE way files enter the app. files: a list (or FileList); opts: { source, driveId, origin }. Resolves with the new
   *  image items (queued, the first on screen), or [] when the notice was cancelled or nothing could be used. */
  F.take = async function (files, opts = {}) {
    const list = [...(files || [])];
    if (!list.length) return [];
    if (!(await F.gate())) return [];
    const ok = list.filter(F.accepts);
    if (!ok.length) { toast(list.length === 1 ? 'That file is not an image' : 'Those files are not images'); return []; }
    return CO.process.add(ok, opts);
  };

  /** Open the system file picker (several images at once). */
  F.open = async function () {
    if (!window.SlopUI) return [];
    const files = await SlopUI.pickFiles({ accept: 'image/*', multiple: true });
    return F.take(files, { source: 'picker' });
  };
  /** The built-in sample image (a generated Sloppo goo on a busy background). */
  F.sample = async function () {
    return F.take([await CO.sample.make()], { source: 'sample' });
  };
  /** A file from Slop Drive (File ▸ Open from Slop Drive, or one another app sent here). rec: a Slop Hub record. */
  F.fromDrive = function (rec, extra = {}) {
    if (!rec) return Promise.resolve([]);
    return F.take([new File([rec.blob], rec.name || 'Untitled', { type: rec.type })], Object.assign({ source: 'drive', driveId: rec.id }, extra));
  };

  /** The drop zone's batch: SlopDrop hands over the accepted files of a drop (or paste, or its Choose files) in begin();
   *  they all go into take() at once, then process(file) only reports each file until its cut-out is ready. */
  let pendingBatch = null;
  function begin(files) { pendingBatch = { files, items: F.take(files, { source: 'drop' }) }; }
  async function report(file, progress) {
    const items = pendingBatch ? await pendingBatch.items : [];
    if (CO.video && CO.video.isVideo(file)) {
      const v = (await Promise.all(items.videos || [])).find((x) => x.file === file);
      if (!v || v.status === 'error') throw new Error(v ? v.error || 'cannot be read' : 'cannot be read');
      return v.id;
    }
    const it = items.find((x) => x.file === file);
    if (!it) throw new Error(F.accepts(file) ? 'was not added' : 'is not an image');
    return F.settled(it, progress);
  }
  /** Resolves with the item id once it is cut out (rejects when it fails or is removed); progress(0..1) on the way. */
  F.settled = function (it, progress) {
    return new Promise((resolve, reject) => {
      const offs = [], end = (fn, v) => { offs.forEach((off) => off()); fn(v); };
      const check = () => {
        if (it.status === 'done') end(resolve, it.id);
        else if (it.status === 'error') end(reject, new Error(it.error || 'could not be cut out'));
        else if (!S().get(it.id)) end(reject, new Error('was removed'));
      };
      offs.push(CO.on('item', (x) => { if (x === it) check(); }), CO.on('list', check));
      if (progress) offs.push(CO.on('progress', (d) => { if (d && d.it === it && it.progress != null) progress(it.progress); }));
      check();
    });
  };

  /** What the app makes and how, in the empty card (the drop zone is a compact strip, so the card carries it). */
  const PREVIEW = {
    picture: { src: '../assets/shots/cutout.jpg', alt: 'A picture before and after: the busy background is gone, the subject is kept' },
    steps: ['Drop images, several at once', 'The AI cuts out the subject; touch up with Keep and Remove', 'Download a PNG with a clear background'],
  };

  /** Drag and drop onto the workspace (a compact zone above the stage, and the window). Pasting stays below. */
  F.init = function () {
    const pv = SlopDrop.panel.preview(PREVIEW);
    if (pv) U.$('#emptyIntro').append(pv);
    // The workspace and the queue sidebar take drops; a paste goes through the same batch (SlopDrop registers it with
    // shared/intake). Either way the files reach take() once, in begin().
    F.drop = SlopDrop.attach(U.$('#isoDrop'), {
      accept: ACCEPT,
      compact: true,
      targets: [U.$('#workspace'), U.$('#queue')],
      begin,
      process: report,
    });
  };
})();
