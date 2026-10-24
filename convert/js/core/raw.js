/* Camera RAW conversions of File convert: CR2, CR3, NEF, ARW, DNG, RAF, ORF, RW2, PEF, SRW and the rest that SlopRaw
 * (shared/raw/) opens, to JPG, PNG or WebP. The RAW file is developed by LibRaw in WebAssembly (shared/raw/engine.js,
 * downloaded once after its first-use notice): white balance, exposure, highlights, sRGB, the camera's orientation.
 * When the engine cannot run or the person declines it, the camera's embedded JPEG preview is used and the status line
 * says so. The live preview (opts.rawPreview) uses the embedded preview only, so dropping a file downloads nothing.
 * Browser only. Exports RAW_KINDS, RAW (catalog entries) and rawPreviewBlob. */
import '../../../shared/raw/tiff.js';
import '../../../shared/raw/detect.js';
import '../../../shared/raw/preview.js';
import '../../../shared/raw/raw.js';
import { makeCanvas, canvasToBlob, sizeFor } from './image.js';
import { stemOf as base } from '../io/files.js';

const R = globalThis.SlopRaw;
// a module has no currentScript: tell SlopRaw where the engine script is
globalThis.SlopRawBase = new URL('../../../shared/raw/', import.meta.url).href;

export const RAW_KINDS = globalThis.SlopRawDetect.EXTS.slice();
const MIME = { jpg: 'image/jpeg', png: 'image/png', webp: 'image/webp' };
const SIZE = [
  { key: 'width', type: 'number', label: 'Width (px)', min: 1, max: 10000, hint: 'Leave blank to keep the full size. Height follows the proportions.' },
  { key: 'height', type: 'number', label: 'Height (px)', min: 1, max: 10000 },
];
const WB = { key: 'wb', type: 'select', label: 'White balance', value: 'camera', options: [['camera', 'As shot (camera)'], ['auto', 'Auto'], ['daylight', 'Daylight']] };
const EXPOSURE = { key: 'exposure', type: 'select', label: 'Exposure', value: '0',
  options: ['-2', '-1.5', '-1', '-0.5', '0', '0.5', '1', '1.5', '2'].map((v) => [v, (Number(v) > 0 ? '+' : '') + v + ' EV']) };
const HIGHLIGHTS = { key: 'highlights', type: 'select', label: 'Highlights', value: 'clip', options: [['clip', 'Clip'], ['blend', 'Blend'], ['rebuild', 'Rebuild']] };
const QUALITY = { key: 'quality', type: 'range', label: 'Quality', min: 10, max: 100, value: 92 };
const DEVELOP = [WB, EXPOSURE, HIGHLIGHTS];

/** The camera's embedded JPEG preview of a RAW file, or null (for the before panel of the live preview). */
export async function rawPreviewBlob(file) {
  const p = await R.previewCanvas(file, 1200).catch(() => null);
  return p ? canvasToBlob(p.canvas, 'image/jpeg', 0.9) : null;
}

function rawTo(to) {
  return async (files, o = {}) => {
    const f = files[0];
    const r = await R.image(f.file, { mode: o.rawPreview ? 'preview' : 'full', wb: o.wb || 'camera', exposure: Number(o.exposure) || 0, highlights: o.highlights || 'clip' });
    const src = { w: r.canvas.width, h: r.canvas.height };
    const { W, H } = sizeFor(src, { width: o.width, height: o.height });
    const c = makeCanvas(W, H), g = c.getContext('2d');
    g.imageSmoothingQuality = 'high';
    g.drawImage(r.canvas, 0, 0, W, H);
    const blob = await canvasToBlob(c, MIME[to], (o.quality ?? 92) / 100);
    if (blob.type !== MIME[to]) throw new Error(`This browser cannot write ${to.toUpperCase()} images.`);
    const out = [{ name: `${base(f.name)}.${to}`, blob }];
    if (r.note) out.info = r.note;
    else if (r.from === 'preview' && o.rawPreview) out.info = 'The preview shows the camera\'s embedded JPEG. Convert develops the RAW file.';
    return out;
  };
}

export const RAW = [
  { id: 'raw-to-jpg', label: 'RAW to JPG', group: 'Camera RAW', from: RAW_KINDS, ext: 'jpg', mode: 'each', options: [...DEVELOP, ...SIZE, QUALITY], run: rawTo('jpg') },
  { id: 'raw-to-png', label: 'RAW to PNG', group: 'Camera RAW', from: RAW_KINDS, ext: 'png', mode: 'each', options: [...DEVELOP, ...SIZE], run: rawTo('png') },
  { id: 'raw-to-webp', label: 'RAW to WebP', group: 'Camera RAW', from: RAW_KINDS, ext: 'webp', mode: 'each', options: [...DEVELOP, ...SIZE, QUALITY], run: rawTo('webp') },
];
