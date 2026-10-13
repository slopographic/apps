/* Slop Watermark: reading pictures and logos, and the output format for each input type. Classic script.
 * Exposes window.WMDecode. Pictures are read through an <img> from an object URL, so GIF gives its first frame.
 *   typeOf(file) → accepted MIME type or '' ; loadPicture(url) → Promise<img> ; sizeOf(img, blob) → { w, h }
 *   loadLogo(blob) → Promise<ImageBitmap> (drawn at most LOGO_SIDE px on the long side) ; outputFor(type) → { mime, ext, quality } */
(function () {
  'use strict';
  const LOGO_SIDE = 2048;     // a logo is kept at most this big; the watermark scales it anyway
  const DEFAULT_SIDE = 1024;  // an SVG with no width, height or viewBox
  const TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/svg+xml'];
  const EXT = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.gif': 'image/gif', '.svg': 'image/svg+xml' };

  /** The accepted MIME type of a file, by its type or, when the browser gives none, by its extension. '' when refused. */
  function typeOf(file) {
    if (TYPES.includes(file.type)) return file.type;
    const m = /\.[^./\\]+$/.exec(file.name || '');
    return EXT[m ? m[0].toLowerCase() : ''] || '';
  }

  /** An SVG's size: its width and height attributes, else its viewBox, else 1024 square. */
  function svgSize(text) {
    const tag = (/<svg\b[^>]*>/i.exec(text) || [''])[0];
    const attr = (name) => { const m = new RegExp('\\s' + name + '\\s*=\\s*"([^"]*)"', 'i').exec(tag); return m ? m[1] : ''; };
    const num = (v) => (/%/.test(v) ? 0 : parseFloat(v) || 0);
    let w = num(attr('width')), h = num(attr('height'));
    const vb = attr('viewBox').trim().split(/[\s,]+/).map(Number);
    if (vb.length === 4 && vb[2] > 0 && vb[3] > 0) {
      if (!w && !h) { w = vb[2]; h = vb[3]; }
      else if (!w) w = h * vb[2] / vb[3];
      else if (!h) h = w * vb[3] / vb[2];
    }
    return w > 0 && h > 0 ? { w, h } : { w: DEFAULT_SIDE, h: DEFAULT_SIDE };
  }

  const isSvg = (blob) => blob.type === 'image/svg+xml' || /\.svg$/i.test(blob.name || '');

  /** A decoded <img> for an object URL. Rejects with a reason a person can read. */
  function loadPicture(url) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('could not be read'));
      img.src = url;
    });
  }

  /** The picture's own size. An SVG's size comes from its markup (the browser's own value is not reliable for SVG). */
  async function sizeOf(img, blob) {
    if (isSvg(blob)) return svgSize(await blob.text());
    return { w: img.naturalWidth, h: img.naturalHeight };
  }

  /** A logo as an ImageBitmap, so every format (SVG included) draws the same way. */
  async function loadLogo(blob) {
    const url = URL.createObjectURL(blob);
    try {
      const img = await loadPicture(url);
      const { w, h } = await sizeOf(img, blob);
      const s = Math.min(1, LOGO_SIDE / Math.max(w, h));
      const c = document.createElement('canvas');
      c.width = Math.max(1, Math.round(w * s)); c.height = Math.max(1, Math.round(h * s));
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      return await createImageBitmap(c);
    } finally { URL.revokeObjectURL(url); }
  }

  /** Same format where it can be: JPEG at 0.92, WebP at 0.92, PNG otherwise (transparency; GIF and SVG give their first frame as PNG). */
  function outputFor(type) {
    if (type === 'image/jpeg') return { mime: 'image/jpeg', ext: '.jpg', quality: 0.92 };
    if (type === 'image/webp') return { mime: 'image/webp', ext: '.webp', quality: 0.92 };
    return { mime: 'image/png', ext: '.png' };
  }

  window.WMDecode = { typeOf, svgSize, loadPicture, sizeOf, loadLogo, outputFor, TYPES };
})();
