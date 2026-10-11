/* ICO container with one PNG-compressed image (the Windows Vista+ form). Pure.
 * encodeIco(pngBytes, width, height) → Uint8Array. Sizes are 1-256 px; 256 is stored as 0 per the format. */
export function encodeIco(pngBytes, width, height) {
  if (!(width >= 1 && width <= 256 && height >= 1 && height <= 256)) throw new Error('ICO images are 1 to 256 px');
  const out = new Uint8Array(22 + pngBytes.length);
  const dv = new DataView(out.buffer);
  dv.setUint16(0, 0, true);                // reserved
  dv.setUint16(2, 1, true);                // type 1 = icon
  dv.setUint16(4, 1, true);                // one image
  out[6] = width === 256 ? 0 : width;
  out[7] = height === 256 ? 0 : height;
  out[8] = 0;                              // colour count (0 = more than 256)
  out[9] = 0;
  dv.setUint16(10, 1, true);               // colour planes
  dv.setUint16(12, 32, true);              // bits per pixel
  dv.setUint32(14, pngBytes.length, true); // image size
  dv.setUint32(18, 22, true);              // offset of the image data
  out.set(pngBytes, 22);
  return out;
}
