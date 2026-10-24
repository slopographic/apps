/* SlopIsolate — getting images in: the file picker, the built-in sample, drag and drop, and paste.
 * Every route ends in CO.process.add(files), which keeps only the image files. */
(function () {
  'use strict';
  const CO = window.CO, U = CO.util;
  const F = CO.files = {};
  const toast = (msg) => { if (window.SlopUI) SlopUI.toast(msg); };

  /** Hand files to the queue. Non-image files are skipped; tell the user when nothing was usable. */
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
  async function take(files) {
    const list = [...(files || [])];
    if (!list.length) return [];
    if (window.SlopFirstRun && !(await SlopFirstRun.once('slopisolate', F.notice()))) return [];
    const items = CO.process.add(list);
    if (!items.length) toast('Those files are not images');
    return items;
  }

  /** Open the system file picker (several images at once). */
  F.open = async function () {
    if (!window.SlopUI) return [];
    const files = await SlopUI.pickFiles({ accept: 'image/*', multiple: true });
    return take(files);
  };

  /** Add files that were dropped or pasted elsewhere (the queue sidebar): the same route as the picker and the drop strip. */
  F.addFiles = function (list) {
    return take(list);
  };

  /** Add the built-in sample image (a generated Sloppo goo on a busy background). */
  F.sample = async function () {
    const file = await CO.sample.make();
    return take([file]);
  };

  const editable = (t) => !!t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName));
  const DROP_RULES = {
    types: ['image/*', 'video/*'],
    exts: ['.jpg', '.jpeg', '.png', '.webp', '.avif', '.gif', '.bmp', '.tif', '.tiff', '.mp4', '.m4v', '.mov', '.webm'],
    noun: 'an image or a video',
  };
  /** One dropped file into the queue. Resolves with the item id once it is cut out (or the video is open), so the
   *  drop list shows the decode as progress; rejects with the reason when the file cannot be used. */
  let firstUse = null;
  /** One notice for a whole drop: every file in it waits on the same choice. Cancelling asks again next time. */
  function gateFirstUse() {
    if (!firstUse) firstUse = window.SlopFirstRun ? SlopFirstRun.once('slopisolate', F.notice()) : Promise.resolve(true);
    return firstUse.then((ok) => { if (!ok) { firstUse = null; throw new Error('cancelled'); } return true; });
  }
  function ingest(file, progress) {
    return gateFirstUse().then(() => ingestNow(file, progress));
  }
  function ingestNow(file, progress) {
    if (CO.video && CO.video.isVideo(file)) {
      return CO.video.addItem(file).then(() => {
        const it = S().items.slice().reverse().find((x) => x.name === file.name);
        if (!it || it.status === 'error') throw new Error(it ? it.error || 'cannot be read' : 'cannot be read');
        return it.id;
      });
    }
    const items = CO.process.add([file]);
    if (!items.length) return Promise.reject(new Error('is not an image'));
    const it = items[0];
    return new Promise((resolve, reject) => {
      const offs = [];
      const finish = () => offs.forEach((off) => off());
      offs.push(CO.on('item', (x) => {
        if (x !== it) return;
        if (it.status === 'done') { finish(); resolve(it.id); }
        else if (it.status === 'error') { finish(); reject(new Error(it.error || 'could not be cut out')); }
      }));
      offs.push(CO.on('progress', (d) => { if (d && d.it === it && it.progress != null) progress(it.progress); }));
    });
  }
  const S = () => CO.state;

  /** What the app makes and how, in the empty card (the drop zone is a compact strip, so the card carries it). */
  const PREVIEW = {
    picture: { src: '../assets/shots/cutout.jpg', alt: 'A picture before and after: the busy background is gone, the subject is kept' },
    steps: ['Drop images, several at once', 'The AI cuts out the subject; touch up with Keep and Remove', 'Download a PNG with a clear background'],
  };

  /** Drag and drop onto the workspace (a compact zone above the stage, and the window). Pasting stays below. */
  F.init = function () {
    const pv = SlopDrop.panel.preview(PREVIEW);
    if (pv) U.$('#emptyIntro').append(pv);
    SlopDrop.attach(U.$('#isoDrop'), {
      accept: DROP_RULES,
      compact: true,
      targets: [U.$('#workspace')],
      process: ingest,
      done: (sum) => {
        const last = sum.added[sum.added.length - 1];
        const it = last && S().get(last.value);
        if (it && it.status === 'done' && CO.process.select) CO.process.select(it);
      },
    });

    window.addEventListener('paste', (e) => {
      if (editable(e.target) || !e.clipboardData) return;
      const files = [];
      for (const it of e.clipboardData.items || []) {
        if (it.kind !== 'file' || !/^image\//.test(it.type)) continue;
        const f = it.getAsFile();
        if (f) files.push(f);
      }
      if (!files.length) return;
      e.preventDefault();
      take(files);
    });
  };
})();
