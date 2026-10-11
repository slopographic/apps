/* Slop Clean: reading pictures, previews, decode checks and copy names. Classic script; sets window.CL.io.
 * An item is one picture: { id, name, size, blob, bytes, driveId, format, label, findings, out, error, thumb }. */
(function () {
  'use strict';
  const CL = (window.CL = window.CL || {});
  let seq = 0;
  const ACCEPT = 'image/jpeg,image/png,image/webp,image/tiff,.jpg,.jpeg,.png,.webp,.tif,.tiff';

  /** "photo.jpg" -> "photo (clean).jpg" */
  function copyName(name) {
    const i = name.lastIndexOf('.');
    return i > 0 ? `${name.slice(0, i)} (clean)${name.slice(i)}` : `${name} (clean)`;
  }

  /** Read one picture and list what it holds. Never throws: a file that cannot be read gets an error instead. */
  async function load(blob, name, { driveId = null } = {}) {
    const item = { id: 'p' + (++seq), name: name || 'picture', size: blob.size, blob, bytes: null, driveId, format: null, label: '', findings: [], out: null, error: '', thumb: null };
    try {
      item.bytes = new Uint8Array(await blob.arrayBuffer());
      const ins = C().inspect(item.bytes);
      item.format = ins.format; item.label = ins.label; item.findings = ins.findings || [];
      if (!ins.supported) item.error = ins.format ? `${ins.label} files are not supported. Export the picture as JPEG, PNG, WebP or TIFF first.` : 'This is not a JPEG, PNG, WebP or TIFF picture.';
      else if (ins.format !== 'tiff') item.thumb = URL.createObjectURL(blob);
    } catch (err) {
      item.error = err.message || 'This file could not be read.';
    }
    return item;
  }

  /** Clean one item with the chosen categories. The result is checked by decoding it (TIFF: the structure only). */
  async function clean(item, remove) {
    item.out = null; item.error = '';
    if (!item.bytes || !item.format || item.error) return item;
    try {
      const out = C().strip(item.bytes, { remove });
      if (out.format !== 'tiff') {
        const bmp = await createImageBitmap(new Blob([out.bytes], { type: out.mime }));
        const ok = bmp.width > 0 && bmp.height > 0;
        bmp.close();
        if (!ok) throw new Error('The cleaned picture would not decode');
      }
      item.out = out;
    } catch (err) {
      item.error = `Could not clean this picture: ${String(err.message || err).replace(/\.+$/, '')}. The original is untouched.`;
    }
    return item;
  }

  const C = () => window.SlopClean;
  CL.io = { ACCEPT, copyName, load, clean };
})();
