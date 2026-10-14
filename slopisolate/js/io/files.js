/* SlopIsolate — getting images in: the file picker, the built-in sample, drag and drop, and paste.
 * Every route ends in CO.process.add(files), which keeps only the image files. */
(function () {
  'use strict';
  const CO = window.CO, U = CO.util;
  const F = CO.files = {};
  const toast = (msg) => { if (window.SlopUI) SlopUI.toast(msg); };

  /** Hand files to the queue. Non-image files are skipped; tell the user when nothing was usable. */
  /** The first-use notice: shown once, the first time files are given to the app. */
  const NOTICE = {
    title: 'Remove backgrounds on this device',
    lines: ['Slop Isolate removes the background from a picture with an AI model that runs in your browser.'],
    downloads: [
      { name: 'Fast model (U²-Netp)', bytes: 4574105 },
      { name: 'Quality model (IS-Net)', bytes: 46535524 },
      { name: 'Portrait model (MODNet)', bytes: 25888640 },
    ],
  };
  async function take(files) {
    const list = [...(files || [])];
    if (!list.length) return [];
    if (window.SlopFirstRun && !(await SlopFirstRun.once('slopisolate', NOTICE))) return [];
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
    if (!firstUse) firstUse = window.SlopFirstRun ? SlopFirstRun.once('slopisolate', NOTICE) : Promise.resolve(true);
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

  /** Drag and drop onto the workspace (a compact zone above the stage, and the window). Pasting stays below. */
  F.init = function () {
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
