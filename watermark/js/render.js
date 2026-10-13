/* Slop Watermark: paints a picture with the watermark, at its own size (capped), and encodes it. Classic script.
 * Exposes window.WMRender. The engine is shared/watermark/core.js (SlopWatermark.draw). */
(function () {
  'use strict';
  const MAX_SIDE = 8000; // export cap on the long side, in pixels

  /** The export size of a picture: its own size, scaled down only when the long side is over MAX_SIDE. */
  function exportSize(w, h) {
    const s = Math.min(1, MAX_SIDE / Math.max(w, h));
    return { w: Math.max(1, Math.round(w * s)), h: Math.max(1, Math.round(h * s)) };
  }
  /** A size that fits a box, never bigger than the picture. */
  function fit(w, h, maxW, maxH) {
    const s = Math.min(1, maxW / w, maxH / h);
    return { w: Math.max(1, Math.round(w * s)), h: Math.max(1, Math.round(h * s)) };
  }
  /** Draws the picture at w x h into canvas (resized to match), then the watermark. Returns the canvas. */
  function drawInto(canvas, img, w, h, cfg, logoBitmap) {
    canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0, w, h);
    window.SlopWatermark.draw(ctx, w, h, cfg, { image: logoBitmap || null });
    return canvas;
  }
  function encode(canvas, out) {
    return new Promise((resolve, reject) => {
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('could not be written'))), out.mime, out.quality);
    });
  }
  /** One picture, watermarked: { blob, ext }. Falls back to PNG when the browser cannot write the wanted format. */
  async function renderItem(item, cfg, logoBitmap) {
    const img = await window.WMDecode.loadPicture(item.url);
    const s = exportSize(item.w, item.h);
    const canvas = drawInto(document.createElement('canvas'), img, s.w, s.h, cfg, logoBitmap);
    let out = window.WMDecode.outputFor(item.type);
    let blob = await encode(canvas, out);
    if (blob.type !== out.mime) { out = { mime: 'image/png', ext: '.png' }; blob = await encode(canvas, out); }
    canvas.width = 0; canvas.height = 0;
    return { blob, ext: out.ext };
  }

  window.WMRender = { exportSize, fit, drawInto, renderItem, MAX_SIDE };
})();
