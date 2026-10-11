/* SlopIsolate — export. One image: its look rendered at full resolution, encoded in S.exportOpts.format and
 * downloaded. Many images: every finished item into one zip. A fresh worker job is built per item so the
 * export always matches the item's settings and brush edits; the job and the decoded bitmap are freed after. */
(function () {
  'use strict';
  const CO = window.CO, U = CO.util, S = CO.state, C = CO.compose, P = CO.process;
  const MIME = { png: 'image/png', webp: 'image/webp', jpg: 'image/jpeg' };
  const toast = (msg) => { if (window.SlopUI) SlopUI.toast(msg); };
  const busy = (on, msg, progress) => CO.emit('busy', { on, msg, progress: progress == null ? null : progress });

  /** Encode a canvas in the chosen format. JPG has no alpha, so the JPG background fills first. */
  async function encode(canvas) {
    const o = S.exportOpts;
    const fmt = MIME[o.format] ? o.format : 'png';
    let src = canvas;
    if (fmt === 'jpg') {
      src = U.canvas(canvas.width, canvas.height);
      const g = U.ctx(src);
      g.fillStyle = o.jpgBg || '#ffffff';
      g.fillRect(0, 0, src.width, src.height);
      g.drawImage(canvas, 0, 0);
    }
    const q = fmt === 'png' ? undefined : U.clamp(Number(o.quality) || 0.92, 0.01, 1);
    const blob = await U.blobOf(src, MIME[fmt], q);
    // Browsers without WebP encoding fall back to PNG: name the file after what was really written.
    const ext = blob.type === 'image/webp' ? 'webp' : blob.type === 'image/jpeg' ? 'jpg' : 'png';
    return { blob, ext };
  }

  /** Build a fresh record for an item, hand its full-resolution render to fn, then free the job and bitmap. */
  async function withPicture(it, fn) {
    const act = await P.build(it);
    try { return await fn(C.render(it, act)); }
    finally {
      if (act.bitmap && act.bitmap.close) act.bitmap.close();
      Promise.resolve(SlopCutout.release(act.jobId)).catch(() => {});
    }
  }

  /** Render and encode one item. */
  const encodeItem = (it) => withPicture(it, (canvas) => encode(canvas));

  CO.export = {};

  /** Export one image and download it as <name>-cutout.<ext>. */
  CO.export.one = async function (it) {
    it = it || S.current();
    if (!it) return toast('Open an image first');
    if (it.status !== 'done') return toast('Wait until the cutout is ready');
    busy(true, 'Exporting…');
    try {
      const { blob, ext } = await encodeItem(it);
      const name = U.baseName(it.name) + '-cutout.' + ext;
      if (window.SlopUI) SlopUI.download(blob, name);
      toast('Saved ' + name + ' · ' + U.fmtBytes(blob.size));
    } catch (e) {
      console.error(e);
      toast('Export failed: ' + (e.message || e));
    } finally { busy(false); }
  };

  /** Export every finished image into one zip (slop-cutouts.zip). Names are made unique. */
  CO.export.all = async function () {
    const items = S.items.filter((it) => it.status === 'done' && it.kind !== 'video');
    if (!items.length) return toast('No finished cutouts to export yet');
    const entries = [], used = new Set();
    let failed = 0;
    try {
      for (let i = 0; i < items.length; i++) {
        const it = items[i];
        busy(true, `Exporting ${i + 1} of ${items.length}…`, i / items.length);
        try {
          const { blob, ext } = await encodeItem(it);
          const base = U.baseName(it.name) + '-cutout';
          let name = base + '.' + ext;
          for (let n = 2; used.has(name.toLowerCase()); n++) name = `${base}-${n}.${ext}`;
          used.add(name.toLowerCase());
          entries.push({ name, blob });
        } catch (e) { failed++; console.error(e); }
      }
      if (!entries.length) return toast('Export failed for every image');
      busy(true, 'Zipping…', 1);
      const zip = await CO.zip(entries);
      if (window.SlopUI) SlopUI.download(zip, 'slop-cutouts.zip');
      toast(`Saved ${entries.length} cutout${entries.length === 1 ? '' : 's'} to a zip` + (failed ? ` (${failed} failed)` : ''));
    } catch (e) {
      console.error(e);
      toast('Export failed: ' + (e.message || e));
    } finally { busy(false); }
  };
})();
