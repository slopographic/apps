/* Slop Resize: images. Decodes with createImageBitmap (an <img> when that fails), draws with canvas and high-quality
 * smoothing, halving in steps first when a picture shrinks by more than 2×, and encodes to JPEG, PNG, WebP or AVIF.
 * A maximum file size searches the quality of the lossy types (JPEG, WebP, AVIF).
 * Classic script; exposes window.SlopResize.image. Needs core/size.js and core/format.js. */
(function (g) {
  'use strict';
  const NS = g.SlopResize, I = (NS.image = {});
  const canvas = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
  const smooth = (ctx) => { ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high'; };

  /** Decode a picture file. Resolves with { node, w, h, close() }. */
  I.load = async function (blob) {
    try {
      const bmp = await createImageBitmap(blob, { imageOrientation: 'from-image' });
      return { node: bmp, w: bmp.width, h: bmp.height, close: () => bmp.close() };
    } catch (e) { /* try an <img> below */ }
    const url = URL.createObjectURL(blob);
    try {
      const img = new Image();
      img.src = url;
      await img.decode();
      if (!img.naturalWidth || !img.naturalHeight) throw new Error('empty');
      return { node: img, w: img.naturalWidth, h: img.naturalHeight, close: () => {} };
    } catch (e) {
      throw new Error('The browser cannot read this picture');
    } finally { URL.revokeObjectURL(url); }
  };

  /** Size of a picture file without keeping it decoded. */
  I.probe = async function (blob) {
    const s = await I.load(blob);
    try { return { w: s.w, h: s.h }; } finally { s.close(); }
  };

  /** Draw a loaded picture at the size the spec gives. bg is a colour behind the picture, or null.
   *  Resolves nothing; returns { canvas, w, h }. */
  I.render = function (s, spec, { bg = null, even = false } = {}) {
    const d = NS.size.dims({ w: s.w, h: s.h }, spec, { even });
    let cur = s.node, cw = s.w, ch = s.h;
    // Step down by halves while a side stays at or above the drawn size: one big bilinear pass loses detail.
    for (;;) {
      const nw = cw / 2 >= d.dw ? Math.ceil(cw / 2) : cw;
      const nh = ch / 2 >= d.dh ? Math.ceil(ch / 2) : ch;
      if (nw === cw && nh === ch) break;
      const c = canvas(nw, nh), cx = c.getContext('2d');
      smooth(cx);
      cx.drawImage(cur, 0, 0, nw, nh);
      cur = c; cw = nw; ch = nh;
    }
    const out = canvas(d.w, d.h), ctx = out.getContext('2d');
    if (bg) { ctx.fillStyle = bg; ctx.fillRect(0, 0, d.w, d.h); }
    smooth(ctx);
    ctx.drawImage(cur, d.x, d.y, d.dw, d.dh);
    return { canvas: out, w: d.w, h: d.h };
  };

  /** Encode a canvas. Rejects when the browser cannot write that type (it would quietly send PNG instead). */
  I.encode = function (cv, mime, quality) {
    return new Promise((res, rej) => cv.toBlob((b) => (b && b.type === mime ? res(b) : rej(new Error(`This browser cannot write ${mime}`))), mime, quality));
  };

  /** Resize one picture file. o = { mime, quality (0–1), maxBytes (0 = no limit) }.
   *  Resolves with { blob, w, h, ext, note }. note is '' or a line to show the person. */
  I.run = async function (file, spec, o) {
    const fmt = NS.format.byMime(o.mime);
    if (!fmt) throw new Error('Unknown image type ' + o.mime);
    const s = await I.load(file);
    try {
      const bg = spec.bg !== 'transparent' ? spec.bg : (fmt.alpha ? null : '#ffffff');
      const r = I.render(s, spec, { bg });
      let blob = await I.encode(r.canvas, fmt.mime, o.quality);
      let note = '';
      if (o.maxBytes > 0 && blob.size > o.maxBytes) {
        if (!fmt.lossy) {
          note = `${fmt.label} cannot be made smaller by quality. Use JPEG, WebP or AVIF for a size limit.`;
        } else {
          const lowest = await I.encode(r.canvas, fmt.mime, 0.05);
          let best = lowest;
          if (lowest.size > o.maxBytes) {
            note = `Even the lowest quality is ${NS.format.bytes(lowest.size)}, over the ${NS.format.bytes(o.maxBytes)} limit. Make the picture smaller as well.`;
          } else {
            let lo = 0.05, hi = o.quality;
            for (let i = 0; i < 7 && hi - lo > 0.01; i++) {
              const mid = (lo + hi) / 2, b = await I.encode(r.canvas, fmt.mime, mid);
              if (b.size <= o.maxBytes) { best = b; lo = mid; } else hi = mid;
            }
          }
          blob = best;
        }
      }
      return { blob, w: r.w, h: r.h, ext: fmt.ext, note };
    } finally { s.close(); }
  };
})(typeof window !== 'undefined' ? window : globalThis);
