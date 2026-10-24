/* Slop Resize's headless operation, for Slop Workflows (registry: shared/ops/registry.js):
 *   resize.image   Slop Resize's own picture code (resize/js/core/size.js for the geometry, resize/js/image/image.js to
 *                  draw and encode: halving steps, fit / cover / stretch / fit inside with an anchor, a background colour,
 *                  a target file size searched over the quality). JPG, PNG, WebP or AVIF out, or the picture's own format.
 * specOf(options) turns these options into Slop Resize's spec (size.js normalize). */
import { register } from './registry.js';
import { scripts, stem, pictureKind, MIME, IMAGE_IN } from './load.js';

const g = globalThis;
const FILES = ['resize/js/core/size.js', 'resize/js/core/format.js', 'resize/js/image/image.js'];
const ANCHORS = [['center', 'Centre'], ['top', 'Top'], ['bottom', 'Bottom'], ['left', 'Left'], ['right', 'Right'], ['top-left', 'Top left'], ['top-right', 'Top right'], ['bottom-left', 'Bottom left'], ['bottom-right', 'Bottom right']];

export const RESIZE_OPTIONS = [
  { key: 'mode', type: 'select', label: 'Resize by', value: 'size', options: [['size', 'Width and height'], ['long', 'Longest side'], ['scale', 'Percentage']] },
  { key: 'width', type: 'number', label: 'Width (px)', min: 0, max: 16384, hint: 'Blank: follows the height and the picture’s proportions.' },
  { key: 'height', type: 'number', label: 'Height (px)', min: 0, max: 16384 },
  { key: 'long', type: 'number', label: 'Longest side (px)', min: 1, max: 16384, value: 1600 },
  { key: 'scale', type: 'number', label: 'Percentage', min: 1, max: 400, value: 50 },
  { key: 'fit', type: 'select', label: 'Fit', value: 'fit', options: [['fit', 'Fit in the box (adds a border)'], ['cover', 'Fill the box (crops)'], ['within', 'Fit inside, no border'], ['stretch', 'Stretch to the box']] },
  { key: 'anchor', type: 'select', label: 'Keep (crop and border position)', value: 'center', options: ANCHORS },
  { key: 'background', type: 'select', label: 'Border and see-through areas', value: 'transparent', options: [['transparent', 'See-through (white for JPG)'], ['color', 'A colour']] },
  { key: 'bgColor', type: 'color', label: 'Colour', value: '#ffffff' },
  { key: 'format', type: 'select', label: 'Format', value: 'keep', options: [['keep', 'Keep the format'], ['jpg', 'JPG'], ['png', 'PNG'], ['webp', 'WebP'], ['avif', 'AVIF']] },
  { key: 'quality', type: 'range', label: 'Quality', min: 10, max: 100, value: 90 },
  { key: 'maxKB', type: 'number', label: 'Largest file size (KB)', min: 0, max: 1e6, hint: 'Blank for no limit. JPG, WebP and AVIF lower their quality to fit.' },
];

export function specOf(o = {}) {
  const mode = ['size', 'long', 'scale'].includes(o.mode) ? o.mode : 'size';
  return { mode: mode === 'size' && Number(o.maxKB) > 0 ? 'bytes' : mode, w: Number(o.width) || 0, h: Number(o.height) || 0,
    long: Number(o.long) || 0, scale: Number(o.scale) || 50, keepRatio: o.fit !== 'stretch', fill: o.fit || 'fit', anchor: o.anchor || 'center',
    bg: o.background === 'color' ? o.bgColor || '#ffffff' : 'transparent', resample: 'best' };
}
const outKind = (k, o = {}) => (o.format && o.format !== 'keep' ? o.format : pictureKind(k));

async function resize(files, o) {
  await scripts(FILES, () => !!(g.SlopResize && g.SlopResize.image && g.SlopResize.size && g.SlopResize.format));
  const f = files[0], kind = outKind(f.kind, o);
  const r = await g.SlopResize.image.run(f.file, specOf(o), { mime: MIME[kind], quality: (Number(o.quality) || 90) / 100, maxBytes: Math.round((Number(o.maxKB) || 0) * 1024) });
  const out = [{ name: `${stem(f.name)}-${r.w}x${r.h}.${r.ext}`, blob: r.blob, kind: r.ext }];
  if (r.note) out.info = r.note;
  return out;
}

export const RESIZE_OPS = register([
  { id: 'resize.image', label: 'Resize', group: 'Pictures', from: IMAGE_IN, mode: 'each', out: outKind,
    description: 'Exact pixels, the longest side or a percentage; fit, fill or stretch; a target file size; JPG, PNG, WebP or AVIF.',
    keywords: ['resize', 'scale', 'square', 'thumbnail', 'smaller', 'compress image', 'dimensions'], options: RESIZE_OPTIONS, run: resize },
], { app: 'resize', label: 'Slop Resize' });
