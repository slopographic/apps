/* Slop Gallery: decode an image, apply its EXIF orientation by hand, and make a JPEG thumbnail (long edge <= 320 px).
 * Decoding uses imageOrientation 'none' so the browser never rotates the pixels behind our back: the orientation we
 * read from EXIF is the only one applied, and the stored width/height are the upright ones.
 * Classic script, exposes window.SlopGallery.thumb.make(blob, orientation) -> { blob, w, h }. */
(function () {
  'use strict';
  const G = (window.SlopGallery = window.SlopGallery || {});
  const MAX_EDGE = 320;

  /** The affine matrix [a, b, c, d, e, f] that maps raw pixel coords (rw x rh) to upright coords, for EXIF 1-8. */
  function matrix(o, rw, rh) {
    switch (o) {
      case 2: return [-1, 0, 0, 1, rw, 0];
      case 3: return [-1, 0, 0, -1, rw, rh];
      case 4: return [1, 0, 0, -1, 0, rh];
      case 5: return [0, 1, 1, 0, 0, 0];
      case 6: return [0, 1, -1, 0, rh, 0];
      case 7: return [0, -1, -1, 0, rh, rw];
      case 8: return [0, -1, 1, 0, 0, rw];
      default: return [1, 0, 0, 1, 0, 0];
    }
  }
  /** Upright width/height for a raw size and orientation (5-8 turn the image on its side). */
  function uprightSize(o, rw, rh) { return o >= 5 && o <= 8 ? { w: rh, h: rw } : { w: rw, h: rh }; }

  async function decode(blob) {
    try { return await createImageBitmap(blob, { imageOrientation: 'none' }); } catch (e) { return createImageBitmap(blob); }
  }

  /** Thumbnail for an image Blob. Throws if the browser cannot decode it (for example HEIC in Chromium). */
  async function make(blob, orientation = 1) {
    const bmp = await decode(blob);
    try {
      const o = orientation >= 1 && orientation <= 8 ? orientation : 1;
      const up = uprightSize(o, bmp.width, bmp.height);
      const s = Math.min(1, MAX_EDGE / Math.max(up.w, up.h));
      const cw = Math.max(1, Math.round(up.w * s)), ch = Math.max(1, Math.round(up.h * s));
      const canvas = document.createElement('canvas');
      canvas.width = cw; canvas.height = ch;
      const ctx = canvas.getContext('2d');
      const [a, b, c, d, e, f] = matrix(o, bmp.width, bmp.height);
      ctx.setTransform(a * s, b * s, c * s, d * s, e * s, f * s);
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(bmp, 0, 0, bmp.width, bmp.height);
      const out = await new Promise((res, rej) => canvas.toBlob((x) => (x ? res(x) : rej(new Error('Thumbnail failed'))), 'image/jpeg', 0.82));
      return { blob: out, w: up.w, h: up.h };
    } finally {
      if (bmp.close) bmp.close();
    }
  }

  /** Upright size of an image Blob without keeping the pixels around. */
  async function dims(blob, orientation = 1) {
    const bmp = await decode(blob);
    const up = uprightSize(orientation, bmp.width, bmp.height);
    if (bmp.close) bmp.close();
    return up;
  }

  G.thumb = { make, dims, matrix, uprightSize, MAX_EDGE };
})();
