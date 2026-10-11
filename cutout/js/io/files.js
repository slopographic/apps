/* SlopIsolate — getting images in: the file picker, the built-in sample, drag and drop, and paste.
 * Every route ends in CO.process.add(files), which keeps only the image files. */
(function () {
  'use strict';
  const CO = window.CO, U = CO.util;
  const F = CO.files = {};
  const toast = (msg) => { if (window.SlopUI) SlopUI.toast(msg); };

  /** Hand files to the queue. Non-image files are skipped; tell the user when nothing was usable. */
  function take(files) {
    const list = [...(files || [])];
    if (!list.length) return [];
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

  /** True when a drag carries files (not text or links). */
  const hasFiles = (e) => !!e.dataTransfer && [...(e.dataTransfer.types || [])].includes('Files');
  const editable = (t) => !!t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName));

  /** Drag and drop onto the window, paste of image data, and the drop overlay. Safe to call once. */
  F.init = function () {
    const overlay = U.$('#dropOverlay');
    let depth = 0;
    const show = (on) => { if (overlay) overlay.hidden = !on; };

    window.addEventListener('dragenter', (e) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      depth++;
      show(true);
    });
    window.addEventListener('dragover', (e) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = 'copy';
    });
    window.addEventListener('dragleave', (e) => {
      if (!hasFiles(e)) return;
      depth = Math.max(0, depth - 1);
      if (!depth) show(false);
    });
    window.addEventListener('drop', (e) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      depth = 0;
      show(false);
      take(e.dataTransfer.files);
    });
    // Dragging out of the window or cancelling a drag must also hide the overlay.
    window.addEventListener('dragend', () => { depth = 0; show(false); });

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
