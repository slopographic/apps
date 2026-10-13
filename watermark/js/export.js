/* Slop Watermark: Apply to all (one output per picture), and the ZIP of the results. Classic script.
 * Exposes window.WMExport. Outputs are kept in memory until the setup changes or the list is cleared. */
(function () {
  'use strict';
  const ZIP_NAME = 'watermarked-images.zip';

  /** "photo.jpg" → "photo-watermarked.jpg"; a name already used in this batch gets "-2", "-3"... */
  function outName(name, ext, used) {
    const base = name.replace(/\.[^./\\]+$/, '') + '-watermarked';
    let out = base + ext, n = 2;
    while (used.has(out.toLowerCase())) out = base + '-' + n++ + ext;
    used.add(out.toLowerCase());
    return out;
  }

  /** Renders every picture in order, each with cfgOf(item) (its own group's setup). progress(done, total, name) before
   *  each one; cancelled() is checked between them. Resolves with { done, failed, stopped }. A picture that fails keeps an error and no output. */
  async function applyAll(items, cfgOf, logoBitmap, progress, cancelled) {
    const used = new Set();
    window.WMItems.clearOuts();
    let done = 0, failed = 0;
    for (const item of items) {
      if (cancelled()) break;
      progress(done + failed, items.length, item.name);
      try {
        const r = await window.WMRender.renderItem(item, cfgOf(item), logoBitmap);
        window.WMItems.setOut(item.id, { blob: r.blob, name: outName(item.name, r.ext, used) });
        done++;
      } catch (err) {
        window.WMItems.setError(item.id, (err && err.message) || 'could not be written');
        failed++;
      }
    }
    return { done, failed, stopped: cancelled() && done + failed < items.length };
  }

  /** One ZIP of every finished output (store only: the pictures are already compressed). */
  async function zipAll(items) {
    const entries = items.filter((x) => x.out).map((x) => ({ name: x.out.name, data: x.out.blob, time: Date.now() }));
    return window.SlopZip.zip(entries);
  }
  function downloadOne(item) {
    if (item.out) window.SlopUI.download(item.out.blob, item.out.name);
  }

  window.WMExport = { applyAll, zipAll, downloadOne, outName, ZIP_NAME };
})();
